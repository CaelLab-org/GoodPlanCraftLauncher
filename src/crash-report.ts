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
import { t } from './i18n';
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
    title: 'ui.crash_rule_oom_title',
    detail: 'ui.crash_rule_oom_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /OutOfMemoryError|Java heap space|insufficient memory for the Java Runtime Environment|an out of memory error/i)
  },
  {
    title: 'ui.crash_rule_heap_reserve_title',
    detail: 'ui.crash_rule_heap_reserve_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Could not reserve enough space for object heap|Invalid maximum heap size|Error occurred during initialization of VM/i)
  },
  {
    title: 'ui.crash_rule_java_too_new_title',
    detail: 'ui.crash_rule_java_too_new_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /because module java\.base does not export|NoSuchFieldException: ucp|NashornScriptEngineFactory|java\.lang\.invoke\.LambdaMetafactory|NoSuchMethodError: sun\.security\.util\.ManifestEntryVerifier/i)
  },
  {
    title: 'ui.crash_rule_java_too_old_title',
    detail: 'ui.crash_rule_java_too_old_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime|Unsupported class file major version/i)
  },
  {
    title: 'ui.crash_rule_unsupported_java_title',
    detail: 'ui.crash_rule_unsupported_java_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /OpenJ9 is not supported|J9VMInternals|java\.lang\.ClassCastException: java\.base\/jdk|java\.lang\.ClassCastException: class jdk\./i)
  },
  {
    title: 'ui.crash_rule_extracted_mods_title',
    detail: 'ui.crash_rule_extracted_mods_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Extracted mod jars found|appear to be extracted jar files/i)
  },
  {
    title: 'ui.crash_rule_missing_mixinbootstrap_title',
    detail: 'ui.crash_rule_missing_mixinbootstrap_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /ClassNotFoundException: org\.spongepowered\.asm\.launch\.MixinTweaker/i)
  },
  {
    title: 'ui.crash_rule_opengl_title',
    detail: 'ui.crash_rule_opengl_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /The driver does not appear to support OpenGL|Failed to create (?:GLFW )?window|Couldn't set pixel format|GLFW error/i)
  },
  {
    title: 'ui.crash_rule_gpu_driver_crash_title',
    detail: 'ui.crash_rule_gpu_driver_crash_detail',
    confidence: 'high',
    test: (c) => {
      if (!/EXCEPTION_ACCESS_VIOLATION/i.test(c.all)) return null;
      if (!/(nvoglv|atio6|ig\d+icd|igdumd|opengl32|lwjgl)/i.test(c.all)) return null;
      return firstLine(c.all, /EXCEPTION_ACCESS_VIOLATION/i);
    }
  },
  {
    title: 'ui.crash_rule_shader_opengl_error_title',
    detail: 'ui.crash_rule_shader_opengl_error_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /1282: Invalid operation/i)
  },
  {
    title: 'ui.crash_rule_resourcepack_resolution_title',
    detail: 'ui.crash_rule_resourcepack_resolution_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Maybe try a lower resolution resourcepack/i)
  },
  {
    title: 'ui.crash_rule_shadersmod_optifine_title',
    detail: 'ui.crash_rule_shadersmod_optifine_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Shaders Mod detected\. Please remove it/i)
  },
  {
    title: 'ui.crash_rule_optifine_forge_mismatch_title',
    detail: 'ui.crash_rule_optifine_forge_mismatch_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.texture\.SpriteContents\.<init>|RenderSystem\.getBackendDescription|NoSuchMethodError: 'void net\.minecraft\.client\.renderer\.block\.model\.BakedQuad\.<init>|ForgeGui\.renderSelectedItemName|DistanceManager|Font\.ellipsize/i)
  },
  {
    title: 'ui.crash_rule_duplicate_mods_title',
    detail: 'ui.crash_rule_duplicate_mods_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Duplicate mods|Found duplicate mods|duplicate mod id|Duplicate mod id/i)
  },
  {
    title: 'ui.crash_rule_missing_dependencies_title',
    detail: 'ui.crash_rule_missing_dependencies_detail',
    confidence: 'high',
    test: (c) => {
      const hits: string[] = matchingLines(c.all, /(?:requires|Requires)[^\n]{0,140}(?:which is missing|is missing)|Missing or unsupported mandatory dependencies|Incompatible mods found|Incompatible mod set|Mod .{1,80} is missing|requires any version of/i, 4);
      return hits.length ? hits.join('\n') : null;
    }
  },
  {
    title: 'ui.crash_rule_block_entity_crash_title',
    detail: 'ui.crash_rule_block_entity_crash_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Exception ticking (?:world|entity)|Ticking (?:block|entity)|Block being ticked|Entity being ticked/i)
  },
  {
    title: 'ui.crash_rule_forge_incomplete_title',
    detail: 'ui.crash_rule_forge_incomplete_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Cannot find launch target fmlclient|Invalid paths argument, contained no existing paths/i)
  },
  {
    title: 'ui.crash_rule_signature_mismatch_title',
    detail: 'ui.crash_rule_signature_mismatch_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /signer information does not match/i)
  },
  {
    title: 'ui.crash_rule_night_config_title',
    detail: 'ui.crash_rule_night_config_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /com\.electronwill\.nightconfig\.core\.io\.ParsingException/i)
  },
  {
    title: 'ui.crash_rule_mod_config_corrupt_title',
    detail: 'ui.crash_rule_mod_config_corrupt_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Failed loading config file .+ for modid/i)
  },
  {
    title: 'ui.crash_rule_mod_needs_java_title',
    detail: 'ui.crash_rule_mod_needs_java_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /requires Java (?:version )?\d+|Java \d+ or (?:later|higher) is required|requires at least Java \d+/i)
  },
  {
    title: 'ui.crash_rule_invalid_jvm_args_title',
    detail: 'ui.crash_rule_invalid_jvm_args_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Unrecognized (?:VM )?option/i)
  },
  {
    title: 'ui.crash_rule_incomplete_version_title',
    detail: 'ui.crash_rule_incomplete_version_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Could not find or load main class|Error: Could not find or load main class/i)
  },
  {
    title: 'ui.crash_rule_java_not_found_title',
    detail: 'ui.crash_rule_java_not_found_detail',
    confidence: 'high',
    test: (c) => firstLine(c.launcher, /The system cannot find the file specified|CreateProcess failed|spawn .* ENOENT/i)
  },
  {
    title: 'ui.crash_rule_manual_debug_crash_title',
    detail: 'ui.crash_rule_manual_debug_crash_detail',
    confidence: 'high',
    test: (c) => firstLine(c.all, /Manually triggered debug crash/i)
  },
  {
    title: 'ui.crash_rule_loader_failure_title',
    detail: 'ui.crash_rule_loader_failure_detail',
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
    causes.push({ title: t(rule.title), detail: t(rule.detail), evidence: evidence || undefined, confidence: 'high' });
    if (causes.length >= 5) break;
  }

  const hasAnyLog: boolean = Boolean(ctx.crash || ctx.latest || ctx.hs || ctx.output.trim());
  if (!causes.length) {
    for (const rule of RULES) {
      if (rule.confidence !== 'suspect') continue;
      const evidence: string | null = rule.test(ctx);
      if (evidence === null) continue;
      causes.push({ title: t(rule.title), detail: t(rule.detail), evidence: evidence || undefined, confidence: 'suspect' });
      break;
    }
  }

  if (!causes.length) {
    const suspects: string[] = findSuspectMods(record.gameDir || GAME_DIR, [ctx.crash, ctx.latest, ctx.hs, ctx.output].filter(Boolean).join('\n'));
    if (suspects.length) {
      causes.push({
        title: t('ui.possibly_caused_by_these_mods'),
        detail: t('ui.these_mods_appear_in_the_crash_stack_try_disabling_them_one_by_one_start_2981a7'),
        evidence: suspects.join('\n'),
        confidence: 'suspect'
      });
    }
  }

  if (!causes.length && ctx.output.trim().length > 0 && ctx.output.trim().length < 300) {
    causes.push({
      title: t('ui.the_game_exited_with_almost_no_output'),
      detail: t('ui.this_usually_points_to_jvm_arguments_the_java_version_or_version_files_r_551d14'),
      evidence: clip(ctx.output.trim(), 300),
      confidence: 'suspect'
    });
  }

  if (!causes.length && !hasAnyLog) {
    causes.push({
      title: t('ui.no_logs_to_analyze'),
      detail: t('ui.this_exit_left_no_game_log_or_crash_report_open_the_log_or_launch_the_ga_429c46'),
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
  if (!ms) return t('ui.unknown');
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
  return hit ? hit.replace('-Xmx', '') : t('ui.not_specified');
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
      child.on('error', (e: any) => { clearTimeout(timer); finish(`${output}${t('ui.could_not_run_error', { error: e.message })}`); });
      child.on('close', () => { clearTimeout(timer); finish(output); });
    } catch (e: any) {
      finish(t('ui.could_not_run_error', { error: e.message }));
    }
  });
}


async function collectJavaInfo(javaPath: string | null): Promise<{ path: string; exists: boolean; size: string; mtime: string; version: string }> {
  if (!javaPath) {
    return { path: t('ui.not_recorded'), exists: false, size: t('ui.unknown'), mtime: t('ui.unknown'), version: t('ui.unknown') };
  }
  let exists: boolean = false;
  let size: string = t('ui.unknown');
  let mtime: string = t('ui.unknown');
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
    : t('ui.file_does_not_exist');
  return { path: javaPath, exists, size, mtime, version: version || t('ui.unknown') };
}


async function collectGpuInfo(): Promise<string> {
  try {
    const info: any = await Promise.race([
      app.getGPUInfo('basic'),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ]);
    if (!info) return t('ui.unknown');
    const devices: any[] = Array.isArray(info.gpuDevice) ? info.gpuDevice : [];
    if (!devices.length) return JSON.stringify(info).slice(0, 600);
    return devices.map((device: any, index: number): string => {
      const vendor: string = device.vendorId !== undefined ? `0x${Number(device.vendorId).toString(16)}` : '?';
      const id: string = device.deviceId !== undefined ? `0x${Number(device.deviceId).toString(16)}` : '?';
      return `#${index + 1} vendor=${vendor} device=${id} driver=${device.driverVersion || '?'} (${device.driverVendor || '?'})`;
    }).join('\n');
  } catch {
    return t('ui.unknown');
  }
}


function describeDisplays(): string {
  try {
    const displays: any[] = screen.getAllDisplays();
    if (!displays.length) return t('ui.unknown');
    return displays.map((display: any): string =>
      `${display.size.width}×${display.size.height} @ ${display.scaleFactor}x${display.internal ? t('ui.built_in') : ''}`
    ).join('\n');
  } catch {
    return t('ui.unknown');
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
    : [t('ui.vanilla')];
  const sections: string[] = [];

  sections.push(t('ui.goodplancraftlauncher_error_report'));
  sections.push(''.padEnd(46, '='));
  sections.push(t('ui.generated_time', { time: formatTime(Date.now()) }));
  sections.push(t('ui.launcher_version_version', { version: app.getVersion() }));
  sections.push(t('ui.contents_error_analysis_environment_java_launch_arguments_mod_list_game_output'));
  sections.push('');

  sections.push(t('ui.1_possible_causes'));
  if (!analysis.causes.length) {
    sections.push(t('ui.no_clear_cause_was_found_in_the_logs_check_the_error_summary_and_game_ou_08b3e6'));
  } else {
    sections.push(t('ui.gpcl_found_these_clues_in_the_log_and_crash_report'));
    sections.push('');
    analysis.causes.forEach((cause: CrashCause, index: number) => {
      sections.push(`${index + 1}. ${cause.title}${cause.confidence === 'suspect' ? t('ui.crash_inferred_suffix') : ''}`);
      for (const line of cause.detail.split('\n')) sections.push(`   ${line}`);
      if (cause.evidence) {
        const evidenceLines: string[] = cause.evidence.split('\n');
        evidenceLines.forEach((line: string, lineIndex: number) => {
          sections.push(`${lineIndex === 0 ? '   ' + t('ui.crash_evidence_label') : '         '}${line}`);
        });
      }
      sections.push('');
    });
  }

  sections.push(t('ui.2_error_summary'));
  sections.push(t('ui.exit_code_code_2', { code: record.exitCode === null ? t('ui.unknown') : record.exitCode }));
  const reasonText: Record<string, string> = {
    'exit-code': t('ui.exited_unexpectedly'),
    'crash-report': t('ui.a_crash_report_was_generated'),
    'exit-code-and-crash-report': t('ui.exited_unexpectedly_and_generated_a_crash_report')
  };
  sections.push(t('ui.reason_reason', { reason: reasonText[record.reason] || record.reason || t('ui.unknown') }));
  sections.push(t('ui.version_id_id', { id: record.versionId }));
  if (record.versionName) sections.push(t('ui.version_name_name', { name: record.versionName }));
  sections.push(t('ui.player_name_2', { name: record.username || t('ui.unknown') }));
  sections.push(t('ui.started_time', { time: formatTime(record.startedAt) }));
  sections.push(t('ui.duration_duration', { duration: record.durationSec === null ? t('ui.unknown') : t('ui.seconds_s', { seconds: record.durationSec }) }));
  sections.push(t('ui.crash_report_file_2', { file: record.crashReport ? path.basename(record.crashReport) : t('ui.none') }));
  sections.push('');

  const timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone || t('ui.unknown');
  const offsetMinutes: number = -new Date().getTimezoneOffset();
  const offsetSign: string = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours: string = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const offsetMins: string = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  const utcOffset: string = `UTC${offsetSign}${offsetHours}:${offsetMins}`;

  sections.push(t('ui.3_environment'));
  sections.push(t('ui.os_os', { os: `${os.type()} ${os.release()} (${os.arch()})` }));
  sections.push(t('ui.time_zone_zone', { zone: timeZone }));
  sections.push(t('ui.utc_offset_offset', { offset: utcOffset }));
  sections.push(t('ui.local_time_time', { time: formatTime(Date.now()) }));
  sections.push(t('ui.cpu_model_count', { model: cpus[0]?.model || t('ui.unknown'), count: cpus.length }));
  sections.push(t('ui.memory_total_gb_total_free_gb_available', { total: gb(os.totalmem()), free: gb(os.freemem()) }));
  sections.push(t('ui.gpu'));
  sections.push(gpu.split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push(t('ui.displays'));
  sections.push(describeDisplays().split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push(`Electron ${process.versions.electron} / Chromium ${process.versions.chrome} / Node ${process.versions.node}`);
  sections.push('');

  sections.push(t('ui.4_java'));
  sections.push(t('ui.path_path', { path: javaInfo.path }));
  sections.push(t('ui.exists_exists_size_modified_mtime', { exists: javaInfo.exists ? t('ui.yes') : t('ui.no'), size: javaInfo.size, mtime: javaInfo.mtime }));
  sections.push(t('ui.allocated_memory_memory', { memory: parseXmx(record.args) }));
  sections.push(t('ui.java_version_label'));
  sections.push(javaInfo.version.split('\n').map((line: string) => `  ${line}`).join('\n'));
  sections.push('');

  sections.push(t('ui.5_game_and_version'));
  sections.push(t('ui.version_id_id', { id: record.versionId }));
  sections.push(t('ui.minecraft_version', { version: versionInfo?.mcVersion || record.versionId }));
  sections.push(t('ui.mod_loaders_loaders', { loaders: loaders.join(' / ') }));
  sections.push(t('ui.optifine_value', { value: versionInfo?.hasOptiFine ? t('ui.yes') : t('ui.no') }));
  sections.push(t('ui.version_isolation_value', { value: versionInfo?.isolated ? t('ui.yes') : t('ui.no') }));
  sections.push(t('ui.game_directory_dir', { dir: gameDir }));
  sections.push(t('ui.mods_enabled_disabled_disabled', {
    enabled: mods.filter((mod: any) => !mod.name.endsWith('.disabled')).length,
    disabled: mods.filter((mod: any) => mod.name.endsWith('.disabled')).length
  }));
  sections.push('');

  sections.push(t('ui.6_mod_list'));
  if (!mods.length) {
    sections.push(t('ui.no_mods_detected'));
  } else {
    for (const mod of mods) {
      sections.push(`- ${mod.name}  ${formatSize(mod.size)}  ${formatTime(mod.mtime)}`);
    }
  }
  sections.push('');

  sections.push(t('ui.7_resource_packs_shaders'));
  if (!resourcepacks.length) sections.push(t('ui.resource_packs_none'));
  else {
    sections.push(t('ui.resource_packs_2'));
    for (const item of resourcepacks) sections.push(`- ${item.name}${item.dir ? t('ui.folder') : `  ${formatSize(item.size)}`}`);
  }
  if (!shaderpacks.length) sections.push(t('ui.shaders_none'));
  else {
    sections.push(t('ui.shaders_2'));
    for (const item of shaderpacks) sections.push(`- ${item.name}${item.dir ? t('ui.folder') : `  ${formatSize(item.size)}`}`);
  }
  sections.push('');

  const effectiveMemory: string = settings?.game?.memory === 'auto'
    ? t('ui.automatic_memory_used_this_session', { memory: parseXmx(record.args) })
    : `${settings?.game?.memory || t('ui.unknown')} GB`;
  sections.push(t('ui.8_launcher_settings_relevant'));
  sections.push(t('ui.memory_allocation_memory', { memory: effectiveMemory }));
  sections.push(t('ui.java_path_path', { path: settings?.game?.javaPath || t('ui.automatic_3') }));
  sections.push(t('ui.jvm_arguments_args', { args: settings?.game?.jvmArgs || t('ui.none') }));
  sections.push(t('ui.gc_preset_preset', { preset: settings?.game?.gcPreset || 'default' }));
  sections.push(t('ui.game_directory_setting_dir', { dir: settings?.download?.installDir || t('ui.default') }));
  sections.push(t('ui.file_source_source', { source: settings?.download?.fileSource || 'auto' }));
  sections.push('');

  sections.push(t('ui.9_launch_arguments_accesstoken_redacted'));
  if (record.args.length) {
    record.args.forEach((arg: string) => sections.push(`  ${arg}`));
  } else {
    sections.push(t('ui.no_launch_arguments_recorded'));
  }
  sections.push('');

  sections.push(t('ui.10_game_output_last_200_lines'));
  const outputLines: string[] = (record.output || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line: string) => line.length > 0);
  if (!outputLines.length) {
    sections.push(t('ui.no_game_output_captured'));
  } else {
    for (const line of outputLines.slice(-200)) sections.push(line);
  }
  sections.push('');

  sections.push(t('ui.11_error_lines_in_the_log_last_20'));
  if (!analysis.errorLines.length) {
    sections.push(t('ui.no_typical_error_lines_found'));
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
    return t('ui.file_too_large_showing_the_last_size', { size: formatSize(maxBytes) }) + `\n${readTail(file, maxBytes)}`;
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
