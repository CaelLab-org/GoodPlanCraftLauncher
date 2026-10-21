/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


import { app, screen } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

import { GAME_DIR, LOG_FILE, loadSettings } from './config';
import { describeVersion } from './mods';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');


export interface CrashRecord {
  exitCode: number | null;
  versionId: string;
  username: string;
  startedAt: number;
  durationSec: number | null;
  crashReport: string | null;
  reason: string;
  gameDir: string;
  javaPath: string | null;
  args: string[];
  output: string;
  versionName: string;
}

export interface CrashCause {
  title: string;
  detail: string;
  evidence?: string;
  confidence: 'high' | 'suspect';
}

export interface CrashAnalysis {
  causes: CrashCause[];
  errorLines: string[];
  analyzedFiles: string[];
  hasAnyLog: boolean;
}

interface RuleContext {
  crash: string;
  latest: string;
  hs: string;
  output: string;
  launcher: string;
  all: string;
}


const CRASH_READ_LIMIT: number = 1024 * 1024;
const LOG_ANALYZE_LIMIT: number = 512 * 1024;


function readTail(file: string, maxBytes: number): string {
  try {
    const stat: fs.Stats = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0) return '';
    const start: number = Math.max(0, stat.size - maxBytes);
    const fd: number = fs.openSync(file, 'r');
    const buffer: Buffer = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    fs.closeSync(fd);
    let text: string = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return text;
  } catch {
    return '';
  }
}


function readIfFresh(file: string, sinceMs: number, maxBytes: number): string {
  try {
    const stat: fs.Stats = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0) return '';
    if (sinceMs > 0 && stat.mtimeMs < sinceMs - 120000) return '';
    return readTail(file, maxBytes);
  } catch {
    return '';
  }
}


function clip(text: string, max: number = 240): string {
  const line: string = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max)}…` : line;
}


function firstLine(text: string, pattern: RegExp): string | null {
  const match: RegExpMatchArray | null = text.match(pattern);
  if (!match || match.index === undefined) return null;
  const start: number = text.lastIndexOf('\n', match.index) + 1;
  let end: number = text.indexOf('\n', match.index);
  if (end === -1) end = text.length;
  return clip(text.slice(start, end));
}


function matchingLines(text: string, pattern: RegExp, limit: number): string[] {
  const result: string[] = [];
  const seen: Set<string> = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line: string = raw.trim();
    if (!line || seen.has(line)) continue;
    if (pattern.test(line)) {
      seen.add(line);
      result.push(clip(line, 260));
      if (result.length >= limit) break;
    }
  }
  return result;
}


export function listCrashArtifacts(gameDir: string): Set<string> {
  const found: Set<string> = new Set();
  try {
    const reportDir: string = path.join(gameDir, 'crash-reports');
    if (fs.existsSync(reportDir)) {
      for (const name of fs.readdirSync(reportDir)) {
        if (name.startsWith('crash-') && name.endsWith('.txt')) found.add(path.join(reportDir, name));
      }
    }
  } catch {}
  try {
    for (const name of fs.readdirSync(gameDir)) {
      if (/^hs_err_pid\d+\.log$/.test(name)) found.add(path.join(gameDir, name));
    }
  } catch {}
  return found;
}


function newestFile(files: string[], sinceMs: number): string | null {
  let newest: string | null = null;
  let newestMs: number = 0;
  for (const file of files) {
    try {
      const stat: fs.Stats = fs.statSync(file);
      if (!stat.isFile() || stat.size === 0) continue;
      if (sinceMs > 0 && stat.mtimeMs < sinceMs - 120000) continue;
      if (stat.mtimeMs >= newestMs) {
        newest = file;
        newestMs = stat.mtimeMs;
      }
    } catch {}
  }
  return newest;
}


function collectContext(record: CrashRecord): { ctx: RuleContext; files: string[] } {
  const gameDir: string = record.gameDir || GAME_DIR;
  const since: number = record.startedAt || 0;
  const files: string[] = [];

  let crash: string = '';
  const reportFile: string | null = record.crashReport && fs.existsSync(record.crashReport)
    ? record.crashReport
    : newestFile(Array.from(listCrashArtifacts(gameDir)).filter((f: string) => path.basename(f).startsWith('crash-')), since);
  if (reportFile) {
    crash = readTail(reportFile, CRASH_READ_LIMIT);
    files.push(reportFile);
  }

  const hsFile: string | null = newestFile(Array.from(listCrashArtifacts(gameDir)).filter((f: string) => /^hs_err_pid/.test(path.basename(f))), since);
  const hs: string = hsFile ? readTail(hsFile, LOG_ANALYZE_LIMIT) : '';
  if (hsFile) files.push(hsFile);

  const latestPath: string = path.join(gameDir, 'logs', 'latest.log');
  const latest: string = readIfFresh(latestPath, since, LOG_ANALYZE_LIMIT);
  if (latest) files.push(latestPath);

  const debugPath: string = path.join(gameDir, 'logs', 'debug.log');
  const debug: string = readIfFresh(debugPath, since, LOG_ANALYZE_LIMIT);
  if (debug) files.push(debugPath);

  let launcher: string = '';
  if (LOG_FILE && fs.existsSync(LOG_FILE)) {
    launcher = readTail(LOG_FILE, 256 * 1024);
    files.push(LOG_FILE);
  }

  const output: string = record.output || '';
  return {
    ctx: {
      crash,
      latest: latest || debug,
      hs,
      output,
      launcher,
      all: [crash, latest, debug, hs, output].filter(Boolean).join('\n')
    },
    files
  };
}


interface Rule {
  title: string;
  detail: string;
  confidence: 'high' | 'suspect';
  test: (ctx: RuleContext) => string | null;
}


const RULES: Rule[] = [
  {
    title: '内存不足',
    detail: '游戏运行时内存不够用了。可以在「设置 → 游戏 → 内存分配」里调大分配给游戏的内存（不要超过物理内存），同时关掉其他占内存的程序。装了大型 Mod 或光影的话，也可以先移除试试。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /OutOfMemoryError|Java heap space|insufficient memory for the Java Runtime Environment|an out of memory error/i)
  },
  {
    title: 'Java 无法申请到设定的内存',
    detail: 'JVM 在启动时没能分配到 -Xmx 指定的内存。常见原因是分配值超过可用内存，或者用的是 32 位 Java。请检查「设置 → 游戏 → 内存分配」，以及当前 Java 是否为 64 位。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Could not reserve enough space for object heap|Invalid maximum heap size|Error occurred during initialization of VM/i)
  },
  {
    title: 'Java 版本过高',
    detail: '游戏或 Mod 是按更老的 Java 写的，当前 Java 太新。请换成该游戏版本要求的 Java：1.16.5 及更早用 Java 8，1.17 用 16，1.18–1.20.4 用 17，1.20.5 及以后用 21。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /because module java\.base does not export|NoSuchFieldException: ucp|NashornScriptEngineFactory|java\.lang\.invoke\.LambdaMetafactory|NoSuchMethodError: sun\.security\.util\.ManifestEntryVerifier/i)
  },
  {
    title: 'Java 版本过低',
    detail: '日志里的 UnsupportedClassVersionError 表示游戏或 Mod 的字节码版本比当前 Java 新。请换成更高版本的 Java 再启动。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime|Unsupported class file major version/i)
  },
  {
    title: '当前的 Java 不适合运行 Minecraft',
    detail: 'Minecraft 需要常规的 HotSpot JRE/JDK，不支持 OpenJ9；用 JDK 里的某些类也会让 Forge 报错。请改用 GPCL 自动安装的 Java，或在设置里指定普通的 JDK/JRE。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /OpenJ9 is not supported|J9VMInternals|java\.lang\.ClassCastException: java\.base\/jdk|java\.lang\.ClassCastException: class jdk\./i)
  },
  {
    title: 'Mod 文件被解压了',
    detail: 'Mod 的 .jar 不能解压。请删掉解压出来的文件夹，只把 .jar 文件放进 mods 文件夹。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Extracted mod jars found|appear to be extracted jar files/i)
  },
  {
    title: '缺少 MixinBootstrap',
    detail: '这个版本需要 MixinBootstrap 才能在启动时注入 Mixin。请安装对应版本的 MixinBootstrap，或者重新安装一次 Forge。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /ClassNotFoundException: org\.spongepowered\.asm\.launch\.MixinTweaker/i)
  },
  {
    title: '显卡、驱动或 OpenGL 有问题',
    detail: '游戏没能创建 OpenGL 环境。请更新显卡驱动；笔记本确认用的是独显；如果还不行，可以换一个 Java 版本（老显卡可以试 Java 8）。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /The driver does not appear to support OpenGL|Failed to create (?:GLFW )?window|Couldn't set pixel format|GLFW error/i)
  },
  {
    title: '显卡驱动导致 JVM 崩溃',
    detail: 'EXCEPTION_ACCESS_VIOLATION 出现在显卡相关模块里，通常是驱动问题。请更新或回退显卡驱动，笔记本确认用独显启动。',
    confidence: 'high',
    test: (c) => {
      if (!/EXCEPTION_ACCESS_VIOLATION/i.test(c.all)) return null;
      if (!/(nvoglv|atio6|ig\d+icd|igdumd|opengl32|lwjgl)/i.test(c.all)) return null;
      return firstLine(c.all, /EXCEPTION_ACCESS_VIOLATION/i);
    }
  },
  {
    title: '光影或资源包触发了 OpenGL 错误',
    detail: '先把光影和资源包全部关掉再启动；能启动就是其中一个资源包或光影不兼容，逐个加回来定位。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /1282: Invalid operation/i)
  },
  {
    title: '材质分辨率过高或显存不足',
    detail: '日志提示资源包分辨率过高（Maybe try a lower resolution resourcepack）。请换回默认材质，或移除高清材质。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Maybe try a lower resolution resourcepack/i)
  },
  {
    title: 'Shaders Mod 与 OptiFine 同时安装',
    detail: 'OptiFine 已自带光影支持，不需要也不兼容 Shaders Mod。删除 Shaders Mod 即可。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Shaders Mod detected\. Please remove it/i)
  },
  {
    title: 'OptiFine 与 Forge 版本不兼容',
    detail: '这两者不是任意版本都能搭配。请到 OptiFine 官网确认它支持的 Forge 版本，按对应版本重新安装。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.texture\.SpriteContents\.<init>|RenderSystem\.getBackendDescription|NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.block\.model\.BakedQuad\.<init>|ForgeGui\.renderSelectedItemName|DistanceManager|Font\.ellipsize/i)
  },
  {
    title: '重复安装了同一个 Mod',
    detail: 'mods 文件夹里同一个 Mod 出现了多份（常见于不同版本共存）。请只保留一份，再启动。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Duplicate mods|Found duplicate mods|duplicate mod id|Duplicate mod id/i)
  },
  {
    title: 'Mod 依赖或兼容性检查没通过',
    detail: '日志里提到缺少前置、版本对不上或 Mod 互相冲突。请按下面列出的依赖关系把前置装齐，并确认 Mod 都支持当前的 Minecraft 版本和加载器。',
    confidence: 'high',
    test: (c) => {
      const hits: string[] = matchingLines(c.all, /(?:requires|Requires)[^\n]{0,140}(?:which is missing|is missing)|Missing or unsupported mandatory dependencies|Incompatible mods found|Incompatible mod set|Mod .{1,80} is missing|requires any version of/i, 4);
      return hits.length ? hits.join('\n') : null;
    }
  },
  {
    title: '游戏在加载某个方块或实体时崩溃',
    detail: '这类崩溃通常和某个 Mod 的方块 / 实体有关。可以新建一个世界试试；新世界正常，就说明是原存档里那个方块或实体的问题。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Exception ticking (?:world|entity)|Ticking (?:block|entity)|Block being ticked|Entity being ticked/i)
  },
  {
    title: 'Forge 安装不完整',
    detail: 'Forge 的库文件缺失（常见于手动删过 libraries 或打包过整合包）。请对同一个版本重新安装一次 Forge。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Cannot find launch target fmlclient|Invalid paths argument, contained no existing paths/i)
  },
  {
    title: '文件或内容校验失败',
    detail: '部分文件没有通过签名校验，可能是下载损坏或被改动过。请删掉这个版本重新下载；下载时如果网络不稳定，可以换个镜像源。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /signer information does not match/i)
  },
  {
    title: 'Night Config 的已知问题',
    detail: '部分 Forge 版本自带的 Night Config 有问题。可以安装 Night Config Fixes 模组，或把 Forge 更新到修复后的版本。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /com\.electronwill\.nightconfig\.core\.io\.ParsingException/i)
  },
  {
    title: 'Mod 的配置文件损坏',
    detail: '某个 Mod 读不了自己的配置文件。按日志里的路径删掉对应配置文件（一般是 .toml / .json），让游戏重新生成。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Failed loading config file .+ for modid/i)
  },
  {
    title: 'Mod 需要更高的 Java 版本',
    detail: '日志提示某个 Mod 要求的 Java 版本比当前高。请按提示换成对应版本的 Java。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /requires Java (?:version )?\d+|Java \d+ or (?:later|higher) is required|requires at least Java \d+/i)
  },
  {
    title: 'JVM 参数无效',
    detail: '日志里的 Unrecognized option 表示启动参数里有 JVM 不认识的选项。请检查「设置 → 游戏」里的 JVM 参数，先清空恢复默认再试。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Unrecognized (?:VM )?option/i)
  },
  {
    title: '版本文件不完整',
    detail: 'Java 找不到主类，说明这个版本的 JSON 或 libraries 有缺失。请重新下载这个版本；装过 Forge / Fabric 的话重新安装一次加载器。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Could not find or load main class|Error: Could not find or load main class/i)
  },
  {
    title: 'Java 或游戏文件找不到',
    detail: '启动器没能拉起 Java，常见于 Java 路径失效或游戏文件被移动。请在设置里重新选择 Java，或让 GPCL 重新自动安装 Java。',
    confidence: 'high',
    test: (c) => firstLine(c.launcher, /The system cannot find the file specified|CreateProcess failed|spawn .* ENOENT/i)
  },
  {
    title: '这是手动触发的调试崩溃',
    detail: '日志里有 Manually triggered debug crash，说明崩溃是调试快捷键故意触发的，不是游戏本身的问题。',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Manually triggered debug crash/i)
  },
  {
    title: 'Mod 加载器报告了错误',
    detail: '加载器在日志里给出了具体的错误信息。如果看不懂英文，可以用翻译软件看下面这段，或把错误报告发给别人。',
    confidence: 'suspect',
    test: (c) => {
      const hits: string[] = matchingLines(c.crash || c.latest, /^\s*Failure message:/i, 3);
      return hits.length ? hits.join('\n') : null;
    }
  }
];


function listModFiles(gameDir: string): string[] {
  try {
    return fs.readdirSync(path.join(gameDir, 'mods')).filter((name: string) => /\.jar(\.disabled)?$/i.test(name));
  } catch {
    return [];
  }
}


function modToken(fileName: string): string | null {
  const base: string = fileName.replace(/\.jar(\.disabled)?$/i, '').toLowerCase();
  const parts: string[] = base.split(/[-_+. ]+/).filter((part: string) =>
    part.length > 0
    && !/^\d/.test(part)
    && !/^(fabric|forge|neoforge|quilt|mc|minecraft|universal|common|client|server|api)$/.test(part)
  );
  if (!parts.length) return null;
  const token: string = parts.slice(0, 2).join('').replace(/[^a-z0-9]/g, '');
  return token.length >= 5 ? token : null;
}


function findSuspectMods(gameDir: string, text: string): string[] {
  const mods: string[] = listModFiles(gameDir).filter((name: string) => !name.endsWith('.disabled'));
  if (!mods.length) return [];
  const stackText: string = text
    .split(/\r?\n/)
    .filter((line: string) => /^\s*at [\w.$/]+|Caused by:|Mixin/i.test(line))
    .join('\n')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!stackText) return [];
  const suspects: string[] = [];
  for (const name of mods) {
    const token: string | null = modToken(name);
    if (!token) continue;
    if (stackText.includes(token)) {
      suspects.push(name);
      if (suspects.length >= 5) break;
    }
  }
  return suspects;
}


function collectErrorLines(text: string): string[] {
  const result: string[] = [];
  const seen: Set<string> = new Set();
  const lines: string[] = text.split(/\r?\n/);
  for (let i: number = lines.length - 1; i >= 0 && result.length < 20; i--) {
    const line: string = lines[i].trim();
    if (line.length < 8 || line.length > 400) continue;
    if (!/(Exception|Error|Caused by|FATAL|CRASH|crash|错误|失败)/.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    result.unshift(line);
  }
  return result;
}


export function analyzeCrash(record: CrashRecord): CrashAnalysis {
  const { ctx, files } = collectContext(record);
  const causes: CrashCause[] = [];

  // 先跑高置信度规则；都没命中时才做“可疑 Mod”这类推测，避免把没用的线索混进结论
  for (const rule of RULES) {
    if (rule.confidence !== 'high') continue;
    const evidence: string | null = rule.test(ctx);
    if (evidence === null) continue;
    causes.push({ title: rule.title, detail: rule.detail, evidence: evidence || undefined, confidence: 'high' });
    if (causes.length >= 5) break;
  }

  const hasAnyLog: boolean = Boolean(ctx.crash || ctx.latest || ctx.hs || ctx.output.trim());
  if (!causes.length) {
    for (const rule of RULES) {
      if (rule.confidence !== 'suspect') continue;
      const evidence: string | null = rule.test(ctx);
      if (evidence === null) continue;
      causes.push({ title: rule.title, detail: rule.detail, evidence: evidence || undefined, confidence: 'suspect' });
      break;
    }
  }

  if (!causes.length) {
    const suspects: string[] = findSuspectMods(record.gameDir || GAME_DIR, [ctx.crash, ctx.latest, ctx.hs, ctx.output].filter(Boolean).join('\n'));
    if (suspects.length) {
      causes.push({
        title: '可能是这些 Mod 导致的',
        detail: '崩溃堆栈里出现了下面这些 Mod。可以从最后一个装上的开始，依次禁用它们试试。这只是线索，不能完全确定。',
        evidence: suspects.join('\n'),
        confidence: 'suspect'
      });
    }
  }

  if (!causes.length && ctx.output.trim().length > 0 && ctx.output.trim().length < 300) {
    causes.push({
      title: '游戏几乎没有输出就退出了',
      detail: '这通常是 Java 参数、Java 版本或版本文件的问题。可以先把 JVM 参数恢复默认，再重新下载一次这个版本试试。',
      evidence: clip(ctx.output.trim(), 300),
      confidence: 'suspect'
    });
  }

  if (!causes.length && !hasAnyLog) {
    causes.push({
      title: '没有找到可分析的日志',
      detail: '这次退出没有留下游戏日志或崩溃报告。可以点「查看日志」看一眼，或重新启动一次再看看。',
      confidence: 'suspect'
    });
  }

  return {
    causes,
    errorLines: collectErrorLines(ctx.all),
    analyzedFiles: files,
    hasAnyLog
  };
}


export function sanitizeReportText(text: string, osUserName?: string): string {
  let out: string = String(text);
  out = out.replace(/(--accessToken\s+)(\S+)/gi, '$1***');
  // 启动器日志里是 JSON 数组形式：["--accessToken","eyJ..."]
  out = out.replace(/(--accessToken["']?\s*[,:]\s*["'])([^"']+)(["'])/gi, '$1***$3');
  out = out.replace(/("accessToken"\s*:\s*")([^"]*)(")/gi, '$1***$3');
  let user: string = osUserName || '';
  if (!user) {
    try { user = os.userInfo().username; } catch {}
  }
  if (user && user.length >= 3) {
    const escaped: string = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '***');
  }
  return out;
}


function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


function formatTime(ms: number): string {
  if (!ms) return '未知';
  const d: Date = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}


function listEntries(dir: string, filter?: (name: string) => boolean): { name: string; size: number; mtime: number; dir: boolean }[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry: fs.Dirent) => !filter || filter(entry.name))
      .map((entry: fs.Dirent) => {
        let size: number = 0;
        let mtime: number = 0;
        try {
          const stat: fs.Stats = fs.statSync(path.join(dir, entry.name));
          size = stat.size;
          mtime = stat.mtimeMs;
        } catch {}
        return { name: entry.name, size, mtime, dir: entry.isDirectory() };
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}


function parseXmx(args: string[]): string {
  const hit: string | undefined = args.find((arg: string) => /^-Xmx\d+[kKmMgG]?$/.test(arg));
  return hit ? hit.replace('-Xmx', '') : '未指定';
}


function runCapture(file: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    let output: string = '';
    let done: boolean = false;
    const finish = (text: string): void => {
      if (done) return;
      done = true;
      resolve(text);
    };
    try {
      const child: any = spawn(file, args, { windowsHide: true });
      const timer: any = setTimeout((): void => {
        try { child.kill(); } catch {}
        finish(output);
      }, timeoutMs);
      child.stdout?.on('data', (d: any) => { output += d.toString(); });
      child.stderr?.on('data', (d: any) => { output += d.toString(); });
      child.on('error', (e: any) => { clearTimeout(timer); finish(`${output}(无法执行: ${e.message})`); });
      child.on('close', () => { clearTimeout(timer); finish(output); });
    } catch (e: any) {
      finish(`(无法执行: ${e.message})`);
    }
  });
}


async function collectJavaInfo(javaPath: string | null): Promise<{ path: string; exists: boolean; size: string; mtime: string; version: string }> {
  if (!javaPath) {
    return { path: '(未记录)', exists: false, size: '未知', mtime: '未知', version: '未知' };
  }
  let exists: boolean = false;
  let size: string = '未知';
  let mtime: string = '未知';
  try {
    const stat: fs.Stats = fs.statSync(javaPath);
    exists = stat.isFile();
    size = formatSize(stat.size);
    mtime = formatTime(stat.mtimeMs);
  } catch {}
  // javaw 不挂控制台，-version 的输出拿不到；同目录有 java.exe 就用它取版本
  let probePath: string = javaPath;
  if (path.basename(javaPath).toLowerCase() === 'javaw.exe') {
    const sibling: string = path.join(path.dirname(javaPath), 'java.exe');
    if (fs.existsSync(sibling)) probePath = sibling;
  }
  const version: string = exists
    ? (await runCapture(probePath, ['-version'], 4000)).replace(/^\uFEFF/, '').trim()
    : '(文件不存在)';
  return { path: javaPath, exists, size, mtime, version: version || '未知' };
}


async function collectGpuInfo(): Promise<string> {
  try {
    const info: any = await Promise.race([
      app.getGPUInfo('basic'),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    if (!info) return '未知';
    const devices: any[] = Array.isArray(info.gpuDevice) ? info.gpuDevice : [];
    if (!devices.length) return JSON.stringify(info).slice(0, 600);
    return devices.map((device: any, index: number): string => {
      const vendor: string = device.vendorId !== undefined ? `0x${Number(device.vendorId).toString(16)}` : '?';
      const id: string = device.deviceId !== undefined ? `0x${Number(device.deviceId).toString(16)}` : '?';
      return `#${index + 1} vendor=${vendor} device=${id} driver=${device.driverVersion || '?'} (${device.driverVendor || '?'})`;
    }).join('\n');
  } catch {
    return '未知';
  }
}


function describeDisplays(): string {
  try {
    const displays: any[] = screen.getAllDisplays();
    if (!displays.length) return '未知';
    return displays.map((display: any): string =>
      `${display.size.width}×${display.size.height} @ ${display.scaleFactor}x${display.internal ? ' (内置)' : ''}`
    ).join('\n');
  } catch {
    return '未知';
  }
}


async function buildReportText(record: CrashRecord, analysis: CrashAnalysis): Promise<string> {
  const gameDir: string = record.gameDir || GAME_DIR;
  let versionInfo: any = null;
  try { versionInfo = describeVersion(record.versionId); } catch {}
  const cpus: any[] = os.cpus();
  const gb = (bytes: number): string => (bytes / 1024 / 1024 / 1024).toFixed(1);
  const [javaInfo, gpu] = await Promise.all([collectJavaInfo(record.javaPath), collectGpuInfo()]);
  let settings: any = {};
  try { settings = loadSettings(); } catch {}
  const modsDir: string = path.join(gameDir, 'mods');
  const mods: any[] = listEntries(modsDir, (name: string) => /\.jar(\.disabled)?$/i.test(name));
  const resourcepacks: any[] = listEntries(path.join(gameDir, 'resourcepacks'));
  const shaderpacks: any[] = listEntries(path.join(gameDir, 'shaderpacks'));
  const loaders: string[] = versionInfo && Array.isArray(versionInfo.loaders) && versionInfo.loaders.length
    ? versionInfo.loaders.map((x: string) => x.charAt(0).toUpperCase() + x.slice(1))
    : ['原版'];
  const sections: string[] = [];

  sections.push('GoodPlanCraftLauncher 错误报告');
  sections.push(''.padEnd(46, '='));
  sections.push(`生成时间：${formatTime(Date.now())}`);
  sections.push(`启动器版本：${app.getVersion()}`);
  sections.push('报告内容：错误分析、运行环境、Java、启动参数、Mod 列表、游戏输出');
  sections.push('');

  sections.push('【一、可能的原因】');
  if (!analysis.causes.length) {
    sections.push('没有从日志里找到明确的原因。可以查看下面的「错误摘要」和「游戏输出」，或把整份报告发给帮助你的人。');
  } else {
    sections.push('GPCL 根据日志和崩溃报告找到以下线索：');
    sections.push('');
    analysis.causes.forEach((cause: CrashCause, index: number) => {
      sections.push(`${index + 1}. ${cause.title}${cause.confidence === 'suspect' ? '（推测）' : ''}`);
      for (const line of cause.detail.split('\n')) sections.push(`   ${line}`);
      if (cause.evidence) {
        const evidenceLines: string[] = cause.evidence.split('\n');
        evidenceLines.forEach((line: string, lineIndex: number) => {
          sections.push(`${lineIndex === 0 ? '   证据：' : '         '}${line}`);
        });
      }
      sections.push('');
    });
  }

  sections.push('【二、错误摘要】');
  sections.push(`退出码：${record.exitCode === null ? '未知' : record.exitCode}`);
  const reasonText: Record<string, string> = {
    'exit-code': '异常退出',
    'crash-report': '生成了崩溃报告',
    'exit-code-and-crash-report': '异常退出并生成了崩溃报告'
  };
  sections.push(`判定：${reasonText[record.reason] || record.reason || '未知'}`);
  sections.push(`版本 ID：${record.versionId}`);
  if (record.versionName) sections.push(`版本名称：${record.versionName}`);
  sections.push(`玩家名：${record.username || '未知'}`);
  sections.push(`开始时间：${formatTime(record.startedAt)}`);
  sections.push(`运行时长：${record.durationSec === null ? '未知' : `${record.durationSec} 秒`}`);
  sections.push(`崩溃报告：${record.crashReport ? path.basename(record.crashReport) : '无'}`);
  sections.push('');

  sections.push('【三、运行环境】');
  sections.push(`操作系统：${os.type()} ${os.release()} (${os.arch()})`);
  sections.push(`CPU：${cpus[0]?.model || '未知'} × ${cpus.length}`);
  sections.push(`内存：总计 ${gb(os.totalmem())} GB / 当前可用 ${gb(os.freemem())} GB`);
  sections.push('显卡：');
  sections.push(gpu.split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push('显示器：');
  sections.push(describeDisplays().split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push(`Electron ${process.versions.electron} / Chromium ${process.versions.chrome} / Node ${process.versions.node}`);
  sections.push('');

  sections.push('【四、Java】');
  sections.push(`路径：${javaInfo.path}`);
  sections.push(`文件存在：${javaInfo.exists ? '是' : '否'}（${javaInfo.size}，修改时间 ${javaInfo.mtime}）`);
  sections.push(`分配内存：${parseXmx(record.args)}`);
  sections.push('java -version：');
  sections.push(javaInfo.version.split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push('');

  sections.push('【五、游戏与版本】');
  sections.push(`版本 ID：${record.versionId}`);
  sections.push(`Minecraft：${versionInfo?.mcVersion || record.versionId}`);
  sections.push(`Mod 加载器：${loaders.join(' / ')}`);
  sections.push(`OptiFine：${versionInfo?.hasOptiFine ? '是' : '否'}`);
  sections.push(`版本隔离：${versionInfo?.isolated ? '是' : '否'}`);
  sections.push(`游戏目录：${gameDir}`);
  sections.push(`Mod 数量：${mods.filter((mod: any) => !mod.name.endsWith('.disabled')).length}（已禁用 ${mods.filter((mod: any) => mod.name.endsWith('.disabled')).length}）`);
  sections.push('');

  sections.push('【六、Mod 列表】');
  if (!mods.length) {
    sections.push('（没有检测到 Mod）');
  } else {
    for (const mod of mods) {
      sections.push(`- ${mod.name}  ${formatSize(mod.size)}  ${formatTime(mod.mtime)}`);
    }
  }
  sections.push('');

  sections.push('【七、资源包 / 光影】');
  if (!resourcepacks.length) sections.push('资源包：无');
  else {
    sections.push('资源包：');
    for (const item of resourcepacks) sections.push(`- ${item.name}${item.dir ? ' (文件夹)' : `  ${formatSize(item.size)}`}`);
  }
  if (!shaderpacks.length) sections.push('光影：无');
  else {
    sections.push('光影：');
    for (const item of shaderpacks) sections.push(`- ${item.name}${item.dir ? ' (文件夹)' : `  ${formatSize(item.size)}`}`);
  }
  sections.push('');

  const effectiveMemory: string = settings?.game?.memory === 'auto'
    ? `自动（本次实际 ${parseXmx(record.args)}）`
    : `${settings?.game?.memory || '未知'} GB`;
  sections.push('【八、启动器设置（相关项）】');
  sections.push(`内存分配：${effectiveMemory}`);
  sections.push(`Java 路径设置：${settings?.game?.javaPath || '自动选择'}`);
  sections.push(`JVM 参数：${settings?.game?.jvmArgs || '无'}`);
  sections.push(`GC 预设：${settings?.game?.gcPreset || 'default'}`);
  sections.push(`游戏目录设置：${settings?.download?.installDir || '默认'}`);
  sections.push(`文件源：${settings?.download?.fileSource || 'auto'}`);
  sections.push('');

  sections.push('【九、启动参数（accessToken 已打码）】');
  if (record.args.length) {
    record.args.forEach((arg: string) => sections.push(`  ${arg}`));
  } else {
    sections.push('（没有记录到启动参数）');
  }
  sections.push('');

  sections.push('【十、游戏输出（最后 200 行）】');
  const outputLines: string[] = (record.output || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line: string) => line.length > 0);
  if (!outputLines.length) {
    sections.push('（没有捕获到游戏输出）');
  } else {
    for (const line of outputLines.slice(-200)) sections.push(line);
  }
  sections.push('');

  sections.push('【十一、日志里的错误行（最后 20 条）】');
  if (!analysis.errorLines.length) {
    sections.push('（没有匹配到典型错误行）');
  } else {
    analysis.errorLines.forEach((line: string) => sections.push(`  ${line}`));
  }
  sections.push('');

  return sections.join('\r\n');
}


function readLogForExport(file: string, maxBytes: number): string {
  try {
    const stat: fs.Stats = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0) return '';
    if (stat.size <= maxBytes) return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return `（文件过大，以下为最后 ${formatSize(maxBytes)}）\n${readTail(file, maxBytes)}`;
  } catch {
    return '';
  }
}


export async function buildErrorReport(record: CrashRecord, targetPath: string): Promise<{ files: number; causes: number }> {
  const analysis: CrashAnalysis = analyzeCrash(record);
  const gameDir: string = record.gameDir || GAME_DIR;
  const attachments: { entry: string; content: string }[] = [];

  const addText = (entry: string, content: string): void => {
    if (!content) return;
    attachments.push({ entry, content: sanitizeReportText(content) });
  };
  const addDisk = (file: string, entry: string, maxBytes: number): void => {
    try {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
      const content: string = readLogForExport(file, maxBytes);
      if (content) addText(entry, content);
    } catch {}
  };

  const crashFiles: string[] = [];
  if (record.crashReport && fs.existsSync(record.crashReport)) crashFiles.push(record.crashReport);
  for (const file of listCrashArtifacts(gameDir)) {
    if (crashFiles.includes(file)) continue;
    if (/^hs_err_pid/.test(path.basename(file))) continue;
    try {
      if (!record.startedAt || fs.statSync(file).mtimeMs >= record.startedAt - 120000) crashFiles.push(file);
    } catch {}
  }
  for (const file of crashFiles.slice(0, 3)) {
    const bucket: string = /^hs_err_pid/.test(path.basename(file)) ? 'jvm-crash' : 'crash-reports';
    addDisk(file, `${bucket}/${path.basename(file)}`, CRASH_READ_LIMIT);
  }

  const hsFiles: string[] = Array.from(listCrashArtifacts(gameDir))
    .filter((file: string) => /^hs_err_pid/.test(path.basename(file)));
  const newestHs: string | null = newestFile(hsFiles, record.startedAt);
  if (newestHs && !crashFiles.includes(newestHs)) addDisk(newestHs, `jvm-crash/${path.basename(newestHs)}`, CRASH_READ_LIMIT);

  addDisk(path.join(gameDir, 'logs', 'latest.log'), 'logs/latest.log', 6 * 1024 * 1024);
  addDisk(path.join(gameDir, 'logs', 'debug.log'), 'logs/debug.log', 4 * 1024 * 1024);
  if (LOG_FILE) addDisk(LOG_FILE, 'launcher-log.txt', 2 * 1024 * 1024);
  addText('game-output.txt', record.output || '(没有捕获到游戏输出)');

  const logLines: string[] = [
    '',
    '【十二、压缩包内的日志】',
    ...attachments.map((attachment: any) => `- ${attachment.entry}`)
  ];
  const reportText: string = `${await buildReportText(record, analysis)}${logLines.join('\r\n')}`;

  const zip = new AdmZip();
  zip.addFile('error-report.txt', Buffer.from(sanitizeReportText(reportText), 'utf8'));
  for (const attachment of attachments) {
    zip.addFile(attachment.entry, Buffer.from(attachment.content, 'utf8'));
  }
  zip.writeZip(targetPath);
  return { files: attachments.length + 1, causes: analysis.causes.length };
}
