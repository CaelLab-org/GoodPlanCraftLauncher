/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { app, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

import { APP_VERSION, DEFAULT_SETTINGS, GAME_DIR, computeAutoMemoryMB, getVersionGameDir, loadSettings, writeLog } from './config';
import { CrashRecord, buildErrorReport, analyzeCrash, listCrashArtifacts } from './crash-report';
import { generateLaunchDisplayName } from './download';
import { t } from './i18n';
import { downloadAndInstallJava, ensureJavaRuntime, findJavaExecutableInDir, getJavaVersionFromVersionData } from './java';
import { mainWindow, trimWorkingSets } from './shell';
// __IMPORTS_END__

export let launchCancelFlag: boolean = false;

export let currentGameProcess: any = null;

export let currentGamePid: number | null = null;

/** 一次启动产生的游戏会话（玩家可以同时开多个，所以用 map 跟踪） */

export interface GameSession {
  pid: number;
  process: any;
  versionId: string;
  username: string;
  startedAt: number;
  rootDir: string;
  gameDir: string;
  javaPath: string | null;
  args: string[];
  titleContext: any;
  /** 这个会话自己的输出尾巴，崩溃时导出报告用（多个游戏并存时不能读全局的） */
  output: string;
}


export let gameSessions: Map<number, GameSession> = new Map();


function resolveJavaExecutable(value: string): string | null {
  const target: string = String(value || '').trim();
  if (!target) return null;
  try {
    if (!fs.existsSync(target)) return null;
    const stat: fs.Stats = fs.statSync(target);
    if (stat.isDirectory()) return findJavaExecutableInDir(target);
    if (stat.isFile() && /^(java|javaw)\.exe$/i.test(path.basename(target))) return target;
  } catch {}
  return null;
}


export let currentGameVersionId: string | null = null;

export let currentGameUsername: string | null = null;

export let currentGameStartedAt: number | null = null;

export let currentGameGameDir: string | null = null;

export let currentGameJavaPath: string | null = null;

export let currentGameArgs: string[] = [];

export let currentGameLog: string = '';

export let intentionalStop: boolean = false;

export let gameMonitorTimer: any = null;

export let preLaunchCrashArtifacts: Set<string> = new Set();


export let gameSessionActive: boolean = false;

export let gameTitlePowerShell: any = null;

export let gameTitleTemplate: string = '';

export let gameTitleContext: any = null;

export let gameTitleSent: string = '';

export let gameTitleKeepAlive: boolean = false;

export let gameTitleFoundAt: number | null = null;

export const GAME_TITLE_ENFORCE_MS: number = 20000;


export const GAME_LOG_KEEP_BYTES: number = 256 * 1024;


export function killGameProcessTree(pid: number): boolean {
  try {
    const result = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
    if (result.status === 0) { writeLog(`[启动] 已终止进程树 PID: ${pid}`); return true; }
    writeLog(`[启动] taskkill PID ${pid} 返回: ${result.status}, ${result.stderr?.toString().trim()}`);
  } catch (e: any) { writeLog(`[启动] taskkill 失败: ${e.message}`); }
  return false;
}


export function findAndKillMinecraftJavaProcesses(): boolean {
  try {
    const script = `
      $javaProcs = Get-Process -Name "java","javaw" -ErrorAction SilentlyContinue
      if ($javaProcs) {
        foreach ($p in $javaProcs) {
          try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and ($cmdLine -like '*net.minecraft*' -or $cmdLine -like '*minecraft*' -or $cmdLine -like '*forge*' -or $cmdLine -like '*fabric*' -or $cmdLine -like '*optifine*')) {
              Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
              Write-Output "KILLED:$($p.Id)"
            }
          } catch {}
        }
      }
    `;
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 8000, encoding: 'utf8' });
    const output = (result.stdout || '').toString().trim();
    if (output) {
      const pids = output.split('\n').filter(l => l.startsWith('KILLED:')).map(l => l.replace('KILLED:', ''));
      writeLog(`[启动] 通过命令行匹配杀死了 ${pids.length} 个Minecraft Java进程: ${pids.join(', ')}`);
      return pids.length > 0;
    }
  } catch (e: any) { writeLog(`[启动] 查找Minecraft进程失败: ${e.message}`); }
  return false;
}


export function pushGameLog(text: string): void {
  currentGameLog += text;
  if (currentGameLog.length > GAME_LOG_KEEP_BYTES) {
    currentGameLog = currentGameLog.slice(-GAME_LOG_KEEP_BYTES);
  }
}


export function gameStatusSnapshot(running: boolean, memoryMB: number | null, exitCode?: number | null): any {
  return {
    running,
    pid: running ? currentGamePid : null,
    versionId: currentGameVersionId,
    username: currentGameUsername,
    startedAt: currentGameStartedAt,
    memoryMB,
    exitCode: exitCode === undefined ? null : exitCode,
    runningCount: gameSessions.size
  };
}

/** 把某个会话镜像到 currentGame* 这几个字段上（面板/错误报告都读这几个） */

export function setActiveSession(session: GameSession | null): void {
  if (!session) {
    currentGameProcess = null;
    currentGamePid = null;
    currentGameVersionId = null;
    currentGameUsername = null;
    currentGameStartedAt = null;
    currentGameGameDir = null;
    currentGameJavaPath = null;
    currentGameArgs = [];
    gameTitleContext = null;
    return;
  }
  currentGameProcess = session.process;
  currentGamePid = session.pid;
  currentGameVersionId = session.versionId;
  currentGameUsername = session.username;
  currentGameStartedAt = session.startedAt;
  currentGameGameDir = session.gameDir;
  currentGameJavaPath = session.javaPath;
  currentGameArgs = session.args;
  gameTitleContext = session.titleContext;
}

/** 当前显示的那个游戏换了（新启动 / 原来那个退出了）就重挂标题进程 */

export function refreshActiveGameTitle(): void {
  if (currentGamePid && gameTitleTemplate) {
    startGameTitlePowerShell();
  } else {
    stopGameTitlePowerShell();
  }
}


export function resetGameState(): void {
  currentGameProcess = null;
  currentGamePid = null;
  gameSessions.clear();
  intentionalStop = false;
  // 版本目录、启动参数与游戏输出保留到下次启动时覆盖，导出错误报告还要用
}


export function readGameProcessProbe(pid: number): Promise<{ ok: boolean; alive: boolean; memoryMB: number | null }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ ok: false, alive: false, memoryMB: null });
      return;
    }
    // 只取内存：窗口相关的事都交给常驻的标题进程（MainWindowHandle 对这个 java 进程不可靠）
    const script: string =
      `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; ` +
      `if ($p) { Write-Output ("ALIVE|" + [int]($p.WorkingSet64 / 1MB)) } else { Write-Output "GONE" }`;
    try {
      const probe = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      let output: string = '';
      let settled: boolean = false;
      const finish = (value: any): void => {
        if (!settled) { settled = true; resolve(value); }
      };
      probe.stdout?.on('data', (d: any) => { output += d.toString(); });
      probe.stderr?.on('data', () => {});
      probe.on('close', () => {
        const text: string = output.trim();
        if (text.startsWith('GONE')) {
          finish({ ok: true, alive: false, memoryMB: null });
          return;
        }
        const match: RegExpMatchArray | null = text.match(/ALIVE\|(\d+)/);
        if (match) {
          finish({ ok: true, alive: true, memoryMB: parseInt(match[1], 10) });
        } else {
          finish({ ok: false, alive: true, memoryMB: null });
        }
      });
      probe.on('error', () => finish({ ok: false, alive: true, memoryMB: null }));
    } catch {
      resolve({ ok: false, alive: true, memoryMB: null });
    }
  });
}


export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 渲染自定义窗口标题里的魔术字，未知的 {xxx} 原样保留 */

export function renderGameTitle(template: any, context: any): string {
  const source: string = typeof template === 'string' ? template : (template === null || template === undefined ? '' : String(template));
  if (!source) return '';
  const now: Date = new Date();
  const date: string = `${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}`;
  const time: string = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const values: Record<string, string> = {
    '{mc_version}': context?.mcVersion || '',
    '{mc_id}': context?.mcId || '',
    '{username}': context?.username || '',
    '{gpcl_version}': app.getVersion(),
    '{date}': date,
    '{time}': time,
    '{datetime}': `${date} ${time}`,
    '{java}': context?.java || '',
    '{memory}': context?.memory || ''
  };
  return source.replace(/\{[a-z_]+\}/g, (token: string) => (token in values ? values[token] : token)).trim();
}

/**
 * 常驻一个 PowerShell 进程负责改游戏窗口标题。
 * 自己在进程里用 EnumWindows 按 PID 找窗口 —— 不用 MainWindowHandle：
 * 实测它对 Minecraft 的 java 进程基本读成 0（窗口刚创建那一瞬才偶尔非零）。
 * 找不到窗口时不报错，等下一次收到标题再试；标题只在和当前不一致时才设置，避免闪烁。
 */

export function startGameTitlePowerShell(): void {
  stopGameTitlePowerShell();
  if (process.platform !== 'win32') return;
  if (!gameTitleTemplate) return;
  const pid: number | null = currentGamePid;
  if (!pid) return;
  gameTitleFoundAt = null;

  const typeDef: string = [
    'using System; using System.Text; using System.Runtime.InteropServices;',
    'namespace GPCL {',
    '  public static class Win {',
    '    delegate bool EnumProc(IntPtr h, IntPtr l);',
    '    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);',
    '    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
    '    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);',
    '    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
    '    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool SetWindowText(IntPtr h, string s);',
    '    public static IntPtr Find(uint target) {',
    '      IntPtr found = IntPtr.Zero;',
    '      EnumWindows(delegate(IntPtr h, IntPtr l) {',
    '        uint pid; GetWindowThreadProcessId(h, out pid);',
    '        if (pid == target && IsWindowVisible(h) && GetWindow(h, 4) == IntPtr.Zero) {',
    '          StringBuilder sb = new StringBuilder(256);',
    '          GetWindowText(h, sb, 256);',
    '          if (sb.Length > 0) { found = h; return false; }',
    '        }',
    '        return true;',
    '      }, IntPtr.Zero);',
    '      return found;',
    '    }',
    '    public static string Title(IntPtr h) { StringBuilder sb = new StringBuilder(256); GetWindowText(h, sb, 256); return sb.ToString(); }',
    '    public static void Set(IntPtr h, string t) { SetWindowText(h, t); }',
    '  }',
    '}'
  ].join('\n');

  const script: string = [
    `Add-Type -TypeDefinition @'`,
    typeDef,
    `'@`,
    `$h = [IntPtr]::Zero`,
    `while ($true) {`,
    `  $line = [Console]::In.ReadLine()`,
    `  if ($null -eq $line) { break }`,
    `  if (-not (Get-Process -Id ${pid} -ErrorAction SilentlyContinue)) { break }`,
    `  if ($h -eq [IntPtr]::Zero) {`,
    `    $h = [GPCL.Win]::Find(${pid})`,
    `    if ($h -ne [IntPtr]::Zero) { Write-Output ("FOUND|" + $h) }`,
    `  }`,
    `  if ($h -eq [IntPtr]::Zero) { continue }`,
    `  if ($line -ne '' -and ([GPCL.Win]::Title($h)) -ne $line) { [GPCL.Win]::Set($h, $line) }`,
    `}`
  ].join('\n');

  try {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    let output: string = '';
    ps.stdout?.on('data', (d: any) => {
      output += d.toString();
      let index: number = output.indexOf('\n');
      while (index >= 0) {
        const line: string = output.slice(0, index).trim();
        output = output.slice(index + 1);
        if (line.startsWith('FOUND|')) {
          gameTitleFoundAt = Date.now();
          writeLog(`[窗口标题] 已找到游戏窗口，句柄: ${line.slice(6)}`);
        }
        index = output.indexOf('\n');
      }
    });
    ps.stderr?.on('data', (d: any) => {
      const text: string = d.toString().trim();
      if (text) writeLog(`[窗口标题] ${text}`);
    });
    ps.on('error', (e: any) => writeLog(`[窗口标题] 设置进程启动失败: ${e.message}`));
    ps.on('exit', () => {
      if (gameTitlePowerShell === ps) gameTitlePowerShell = null;
    });
    gameTitlePowerShell = ps;
    writeLog(`[窗口标题] 已启动标题设置进程，目标 PID: ${pid}`);
  } catch (e: any) {
    writeLog(`[窗口标题] 启动失败: ${e.message}`);
  }
}

/** 每次监控 tick 都推一次：常驻进程据此重试找窗口，并按需更新标题（含 {time} 这类会变的） */

export function pushGameTitle(): void {
  if (!gameTitlePowerShell || !gameTitlePowerShell.stdin || gameTitlePowerShell.stdin.destroyed) return;
  if (!gameTitleKeepAlive && gameTitleFoundAt && Date.now() - gameTitleFoundAt >= GAME_TITLE_ENFORCE_MS) {
    writeLog('[窗口标题] 20 秒已到，停止持续校正');
    stopGameTitlePowerShell();
    return;
  }
  const title: string = renderGameTitle(gameTitleTemplate, gameTitleContext);
  try {
    gameTitlePowerShell.stdin.write(`${title}\n`);
    if (title !== gameTitleSent) gameTitleSent = title;
  } catch (e: any) {
    writeLog(`[窗口标题] 写入失败: ${e.message}`);
  }
}


export function stopGameTitlePowerShell(): void {
  gameTitleSent = '';
  gameTitleFoundAt = null;
  if (gameTitlePowerShell) {
    try { gameTitlePowerShell.stdin.end(); } catch {}
    try { gameTitlePowerShell.kill(); } catch {}
    gameTitlePowerShell = null;
  }
}


export function applyProcessPriority(pid: number, priority: string): void {
  if (process.platform !== 'win32') return;
  const priorityClass: string = priority === 'low' ? 'BelowNormal' : priority === 'high' ? 'High' : '';
  if (!priorityClass) return;

  const script: string = `try { (Get-Process -Id ${pid} -ErrorAction Stop).PriorityClass = '${priorityClass}'; Write-Output 'OK' } catch { Write-Output ('ERR|' + $_.Exception.Message) }`;
  try {
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    let output: string = '';
    ps.stdout?.on('data', (data: any) => { output += data.toString(); });
    ps.on('error', (error: any) => writeLog(`[启动] 设置进程优先级失败: ${error.message}`));
    ps.on('close', () => {
      if (output.includes('OK')) writeLog(`[启动] 进程优先级已设置为 ${priorityClass}`);
      else writeLog(`[启动] 设置进程优先级失败: ${output.trim()}`);
    });
  } catch (error: any) {
    writeLog(`[启动] 设置进程优先级失败: ${error.message}`);
  }
}


export function startGameMonitor(): void {
  stopGameMonitor();

  const tick = async (): Promise<void> => {
    const pid: number | null = currentGamePid;
    if (!gameSessionActive || !pid) { stopGameMonitor(); return; }

    const probe: any = await readGameProcessProbe(pid);
    if (!gameSessionActive) return;

    pushGameTitle();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-status', gameStatusSnapshot(true, probe.memoryMB));
    }
  };

  void tick();
  gameMonitorTimer = setInterval(() => { void tick(); }, 3000);
}


export function stopGameMonitor(): void {
  if (gameMonitorTimer) {
    clearInterval(gameMonitorTimer);
    gameMonitorTimer = null;
  }
}

/** 所有游戏都退出了：收尾（隐藏面板、恢复按钮、必要时弹崩溃窗） */

export function finishGameSession(exitCode: number | null, crashInfo: any): void {
  if (!gameSessionActive) return;
  gameSessionActive = false;
  stopGameMonitor();
  stopGameTitlePowerShell();
  setActiveSession(null);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('game-status', gameStatusSnapshot(false, null, exitCode));
    if (crashInfo) {
      mainWindow.webContents.send('game-crashed', crashInfo);
    }
    mainWindow.webContents.send('game-closed', exitCode === null ? 0 : exitCode);
  }

  resetGameState();
}


export function detectCrash(gameDir: string, exitCode: number | null): { crashReport: string | null; reason: string } | null {
  let newest: string | null = null;
  for (const file of listCrashArtifacts(gameDir)) {
    if (preLaunchCrashArtifacts.has(file)) continue;
    if (!newest || file > newest) newest = file;
  }

  const badExit: boolean = exitCode !== null && exitCode !== 0 && exitCode !== -1;
  if (badExit && newest) return { crashReport: newest, reason: 'exit-code-and-crash-report' };
  if (badExit) return { crashReport: null, reason: 'exit-code' };
  if (newest) return { crashReport: newest, reason: 'crash-report' };
  return null;
}


export function maskLaunchArgs(args: string[]): string[] {
  const masked: string[] = [];
  let maskNext: boolean = false;
  for (const arg of args) {
    if (maskNext) { masked.push('***'); maskNext = false; continue; }
    masked.push(arg);
    if (arg.toLowerCase() === '--accesstoken') maskNext = true;
  }
  return masked;
}


ipcMain.handle('cancel-launch', async () => {
  launchCancelFlag = true;
  writeLog('[启动] 用户取消启动');
  let killed = false;
  if (currentGameProcess) {
    try {
      const pid = currentGameProcess.pid;
      if (pid) { writeLog(`[启动] 尝试终止游戏进程 PID: ${pid}`); killed = killGameProcessTree(pid); try { currentGameProcess.kill(); } catch {} }
    } catch (e: any) { writeLog(`[启动] 终止游戏进程异常: ${e.message}`); }
  }
  if (!killed) { writeLog('[启动] 未找到已保存的游戏进程，尝试通过命令行匹配查找Minecraft Java进程'); findAndKillMinecraftJavaProcesses(); }
  // 收尾交给退出处理：可能还开着别的游戏，不能在这里直接把面板收掉
  return { success: true };
});


export function parseMCArguments(template: string, vars: any): string {
  let result: string = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value as string);
  }
  return result;
}


export function splitArgs(str: string): string[] {
  const args: string[] = [];
  let current: string = '';
  let inQuotes: boolean = false;
  for (let i: number = 0; i < str.length; i++) {
    const c: string = str[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ' ' && !inQuotes) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += c;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}


export function checkLibraryRules(rules: any[]): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed: boolean = false;
  for (const rule of rules) {
    let match: boolean = true;
    if (rule.os) {
      const platform: string = os.platform();
      if (rule.os.name === 'windows' && platform !== 'win32') match = false;
      if (rule.os.name === 'linux' && platform !== 'linux') match = false;
      if (rule.os.name === 'osx' && platform !== 'darwin') match = false;
    }
    if (match) {
      allowed = (rule.action === 'allow');
    }
  }
  return allowed;
}


export function resolveInheritsFrom(vd: any, gameDir: string): any {
  if (!vd.inheritsFrom) return vd;
  const parentJsonPath: string = path.join(gameDir, 'versions', vd.inheritsFrom, `${vd.inheritsFrom}.json`);
  if (!fs.existsSync(parentJsonPath)) {
    writeLog(`[启动] 警告: inheritsFrom 版本 ${vd.inheritsFrom} 不存在，忽略继承`);
    return vd;
  }
  const parent: any = JSON.parse(fs.readFileSync(parentJsonPath, 'utf8'));
  const resolvedParent: any = resolveInheritsFrom(parent, gameDir);
  
  const merged: any = { ...resolvedParent, ...vd };
  
  const parentLibs: any[] = resolvedParent.libraries || [];
  const childLibs: any[] = vd.libraries || [];
  const libMap: Map<string, any> = new Map();
  for (const lib of parentLibs) {
    libMap.set(lib.name, lib);
  }
  for (const lib of childLibs) {
    libMap.set(lib.name, lib);
  }
  merged.libraries = Array.from(libMap.values());
  
  if (resolvedParent.arguments || vd.arguments) {
    if (!merged.arguments) merged.arguments = {};
    for (const key of ['game', 'jvm']) {
      const parentArgs: any[] = resolvedParent.arguments?.[key] || [];
      const childArgs: any[] = vd.arguments?.[key] || [];
      if (parentArgs.length === 0 && childArgs.length === 0) continue;
      const childStrings: Set<string> = new Set(childArgs.filter((a: any) => typeof a === 'string'));
      merged.arguments[key] = parentArgs.filter((a: any) => typeof a !== 'string' || !childStrings.has(a)).concat(childArgs);
    }
  }
  
  writeLog(`[启动] 已解析 inheritsFrom: ${vd.inheritsFrom} -> 合并 ${merged.libraries?.length || 0} 个库`);
  return merged;
}


export const G1GC_ARGS: string[] = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1'
];


// 1.20 起客户端移除了 --server / --port，改用 quickPlay。
// 只能用 inheritsFrom / id 里的游戏版本判断：加载器 JSON 的 releaseTime 是安装时间，
// 拿它判断会把今天装好的 1.12.2 Forge 也当成新版。快照名匹配不上时再退回 releaseTime。
function supportsQuickPlay(vd: any): boolean {
  const raw: string = String(vd?.inheritsFrom || vd?.id || '');
  const match: RegExpMatchArray | null = raw.match(/^(\d+)\.(\d+)/);
  if (match) {
    return parseInt(match[1], 10) > 1 || parseInt(match[2], 10) >= 20;
  }
  const releaseTime: number = Date.parse(String(vd?.releaseTime || ''));
  return !Number.isNaN(releaseTime) && releaseTime > Date.parse('2023-05-04T00:00:00Z');
}


export function buildLaunchArgs(vd: any, rootDir: string, gameDir: string, versionId: string, username: string, windowMode: string, memoryMB: number | null, serverIp: string | null, authInfo?: { uuid: string; accessToken: string; userType: string }, launchOptions?: { jvmArgsRaw?: string; gcPreset?: string; windowSize?: string; windowWidth?: number; windowHeight?: number }): any {
  const cp: string[] = [];
  
  const ownJar: string = path.join(rootDir, 'versions', versionId, `${versionId}.jar`);
  const parentJar: string = vd.inheritsFrom
    ? path.join(rootDir, 'versions', vd.inheritsFrom, `${vd.inheritsFrom}.jar`)
    : '';
  const clientJar: string = fs.existsSync(ownJar) ? ownJar : (parentJar && fs.existsSync(parentJar) ? parentJar : ownJar);
  if (fs.existsSync(clientJar)) {
    cp.push(clientJar);
  }
  
  let missingLibs: number = 0;
  for (const lib of vd.libraries || []) {
    if (!checkLibraryRules(lib.rules)) continue;
    
    if (lib.downloads?.artifact?.path) {
      const libPath: string = path.join(rootDir, 'libraries', lib.downloads.artifact.path);
      if (fs.existsSync(libPath)) {
        cp.push(libPath);
      } else {
        missingLibs++;
        writeLog(`[启动] 库文件缺失: ${lib.downloads.artifact.path}`);
      }
    }
    
    if (lib.downloads?.classifiers?.['natives-windows']?.path) {
      const nativePath: string = path.join(rootDir, 'libraries', lib.downloads.classifiers['natives-windows'].path);
      if (fs.existsSync(nativePath)) {
        cp.push(nativePath);
      } else {
        missingLibs++;
        writeLog(`[启动] Native库缺失: ${lib.downloads.classifiers['natives-windows'].path}`);
      }
    }
  }
  if (missingLibs > 0) {
    writeLog(`[启动] 警告: ${missingLibs} 个库文件缺失`);
  }

  const ownNatives: string = path.join(rootDir, 'versions', versionId, 'natives');
  const parentNatives: string = vd.inheritsFrom ? path.join(rootDir, 'versions', vd.inheritsFrom, 'natives') : '';
  const nativesDir: string = fs.existsSync(ownNatives) || !parentNatives || !fs.existsSync(parentNatives)
    ? ownNatives
    : parentNatives;
  const assetsDir: string = path.join(rootDir, 'assets');

  const jvmArgs: string[] = [];

  if (memoryMB) {
    jvmArgs.push(`-Xmx${memoryMB}M`);
    writeLog(`[启动] 已设置最大内存: ${memoryMB}M`);
  } else {
    writeLog(`[启动] 未设置内存限制`);
  }

  if (launchOptions?.gcPreset === 'g1gc') {
    jvmArgs.push(...G1GC_ARGS);
    writeLog('[启动] 已启用 G1GC 调优参数');
  }

  jvmArgs.push(`-Djava.library.path=${nativesDir}`, '-cp', cp.join(';'));

  const extraJvmArgs: string[] = splitArgs(launchOptions?.jvmArgsRaw || '');
  if (extraJvmArgs.length > 0) {
    jvmArgs.push(...extraJvmArgs);
    writeLog(`[启动] 已追加自定义 JVM 参数: ${extraJvmArgs.length} 项`);
  }

  const vars: any = {
    auth_player_name: username,
    version_name: versionId,
    game_directory: gameDir,
    assets_root: assetsDir,
    assets_index_name: vd.assetIndex?.id || vd.assets || versionId,
    auth_uuid: authInfo?.uuid || '00000000000000000000000000000000',
    auth_access_token: authInfo?.accessToken || 'offline',
    auth_session: authInfo?.accessToken || 'offline',
    user_type: authInfo?.userType || 'legacy',
    user_properties: '{}',
    version_type: 'GPCL',
    classpath_separator: ';',
    library_directory: path.join(rootDir, 'libraries'),
    natives_directory: nativesDir,
    launcher_name: 'GPCL',
    launcher_version: APP_VERSION
  };

  if (Array.isArray(vd.arguments?.jvm)) {
    let skipNext: boolean = false;
    for (const raw of vd.arguments.jvm) {
      let value: any = raw;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (!checkLibraryRules(raw.rules)) continue;
        value = raw.value;
      }
      const values: any[] = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item !== 'string') continue;
        if (skipNext) { skipNext = false; continue; }
        if (item === '-cp' || item === '-classpath') { skipNext = true; continue; }
        if (item.startsWith('-cp=') || item.startsWith('-Djava.library.path=')) continue;
        jvmArgs.push(parseMCArguments(item, vars));
      }
    }
    writeLog(`[启动] 已合并版本 JVM 参数: ${vd.arguments.jvm.length} 项`);
  }

  let gameArgs: string[] = [];

  if (vd.arguments?.game) {
    for (const arg of vd.arguments.game) {
      if (typeof arg === 'string') {
        gameArgs.push(parseMCArguments(arg, vars));
      }
      
    }
  }
  
  else if (vd.minecraftArguments) {
    const parsed: string = parseMCArguments(vd.minecraftArguments, vars);
    gameArgs = splitArgs(parsed);
  }
  
  else {
    gameArgs = [
      '--username', username,
      '--version', versionId,
      '--gameDir', gameDir,
      '--assetsDir', assetsDir,
      '--assetIndex', vd.assetIndex?.id || vd.assets || versionId,
      '--accessToken', authInfo?.accessToken || 'offline',
      '--userType', authInfo?.userType || 'legacy',
      '--uuid', authInfo?.uuid || '00000000000000000000000000000000'
    ];
  }

  let targetWidth: number = 0;
  let targetHeight: number = 0;
  const sizePreset: string = launchOptions?.windowSize || 'default';
  if (sizePreset === 'custom') {
    targetWidth = Math.max(0, Number(launchOptions?.windowWidth) || 0);
    targetHeight = Math.max(0, Number(launchOptions?.windowHeight) || 0);
  } else if (sizePreset !== 'default') {
    const parts: string[] = sizePreset.split('x');
    targetWidth = Math.max(0, parseInt(parts[0], 10) || 0);
    targetHeight = Math.max(0, parseInt(parts[1], 10) || 0);
  }

  if (windowMode === 'fullscreen') {
    gameArgs.push('--fullscreen');
    writeLog(`[启动] 已添加全屏参数: --fullscreen`);
  } else if (windowMode === 'borderless') {
    const borderlessWidth: number = targetWidth || 1920;
    const borderlessHeight: number = targetHeight || 1080;
    gameArgs.push('--fullscreen');
    gameArgs.push('--width');
    gameArgs.push(String(borderlessWidth));
    gameArgs.push('--height');
    gameArgs.push(String(borderlessHeight));
    writeLog(`[启动] 已添加无边框窗口参数: --fullscreen --width ${borderlessWidth} --height ${borderlessHeight}`);
  } else if (windowMode === 'minimized') {
    
    writeLog(`[启动] 已设置最小化模式`);
  } else if (targetWidth > 0 && targetHeight > 0) {
    gameArgs.push('--width');
    gameArgs.push(String(targetWidth));
    gameArgs.push('--height');
    gameArgs.push(String(targetHeight));
    writeLog(`[启动] 已添加窗口大小参数: ${targetWidth}x${targetHeight}`);
  }

  if (serverIp && serverIp.trim()) {
    const address: string = serverIp.trim();

    if (supportsQuickPlay(vd)) {
      gameArgs.push('--quickPlayMultiplayer');
      gameArgs.push(address);
      writeLog(`[启动] 已添加快速进入服务器参数: --quickPlayMultiplayer ${address}`);
    } else {
      const ipParts: string[] = address.split(':');
      const serverAddress: string = ipParts[0];
      const serverPort: string = ipParts[1] || '25565';

      gameArgs.push('--server');
      gameArgs.push(serverAddress);
      gameArgs.push('--port');
      gameArgs.push(serverPort);
      writeLog(`[启动] 已添加服务器连接参数: --server ${serverAddress} --port ${serverPort}`);
    }
  }

  return { jvmArgs, gameArgs, mainClass: vd.mainClass };
}



export function applyGameLanguage(gameDir: string, langCode: string): void {
  const file: string = path.join(gameDir, 'options.txt');
  try {
    const text: string = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const newline: string = text.includes('\r\n') ? '\r\n' : '\n';
    const lines: string[] = text ? text.split(/\r?\n/) : [];
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    const entry: string = `lang:${langCode}`;
    const index: number = lines.findIndex((line: string) => line.startsWith('lang:'));
    if (index >= 0) {
      if (lines[index] === entry) return;
      lines[index] = entry;
    } else {
      lines.push(entry);
    }

    fs.writeFileSync(file, lines.join(newline) + newline, 'utf8');
    writeLog(`[游戏语言] 已设置 ${entry}`);
  } catch (e: any) {
    writeLog(`[游戏语言] 设置失败: ${e.message}`);
  }
}


ipcMain.handle('launch-minecraft', async (_, opt: any) => {
  try {
    
    launchCancelFlag = false;
    
    const { versionId, username, gameDir: rawGameDir, windowMode } = opt;
    
    const rootDir: string = rawGameDir ? path.resolve(rawGameDir) : GAME_DIR;
    const gameDir: string = getVersionGameDir(versionId, rootDir);
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
    
    const mode: string = windowMode || 'windowed';
    writeLog(`启动游戏：玩家 ${username}，版本 ${versionId}，目录: ${gameDir}，窗口模式: ${mode}`);

    if (launchCancelFlag) {
      writeLog('[启动] 用户已取消启动');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }
    
    const jsonPath: string = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(jsonPath)) {
      writeLog(`启动游戏失败：版本 ${versionId} 未下载`);
      return { success: false, error: 'Download the game first' };
    }

    const vd_raw: any = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const vd: any = resolveInheritsFrom(vd_raw, rootDir);
    const javaVersion: string = getJavaVersionFromVersionData(vd);

    if (launchCancelFlag) {
      writeLog('[启动] 用户已取消启动');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    const settings: any = loadSettings();
    let memoryMB: number | null = null;
    let actualWindowMode: string = mode;
    let serverIp: string | null = null;
    let versionJavaChoice: string = 'auto';
    let versionJavaPath: string = '';

    try {
      const versionConfigPath: string = path.join(rootDir, 'versions', versionId, 'gpcl', 'config.json');
      if (fs.existsSync(versionConfigPath)) {
        const versionSettings: any = JSON.parse(fs.readFileSync(versionConfigPath, 'utf8'));

        if (versionSettings.memory && versionSettings.memory !== 'global') {
          const memoryVal: number = parseFloat(versionSettings.memory);
          if (!isNaN(memoryVal)) {
            if (versionSettings.memory === '0.5') {
              memoryMB = 512; 
            } else {
              memoryMB = Math.floor(memoryVal * 1024);
            }
            writeLog(`[启动] 使用版本内存设置: ${memoryMB}M`);
          }
        }

        if (versionSettings.windowMode && versionSettings.windowMode !== 'global') {
          actualWindowMode = versionSettings.windowMode;
          writeLog(`[启动] 使用版本窗口模式: ${actualWindowMode}`);
        }

        if (versionSettings.javaVersion) {
          versionJavaChoice = String(versionSettings.javaVersion);
        }
        if (versionSettings.javaPath) {
          versionJavaPath = String(versionSettings.javaPath);
        }

        if (versionSettings.startupMode === 'join') {
          const savedServer: string = String(versionSettings.serverIp || '').trim();
          if (!savedServer) {
            writeLog('[启动] 选择了加入服务器，但没有填写服务器地址');
            return { success: false, error: 'Fill in the server address under version settings first' };
          }
          serverIp = savedServer;
          writeLog(`[启动] 使用版本启动模式: 加入服务器 ${serverIp}`);
        }
      }
    } catch (e: any) {
      writeLog(`[启动] 读取版本设置失败: ${e.message}`);
    }

    if (memoryMB === null) {
      if (settings.game?.memory === 'auto') {
        memoryMB = computeAutoMemoryMB();
        writeLog(`[启动] 使用自动内存设置: ${memoryMB}M`);
      } else if (settings.game?.memory) {
        const globalMemory: number = parseFloat(settings.game.memory);
        if (!isNaN(globalMemory)) {
          memoryMB = Math.floor(globalMemory * 1024);
          writeLog(`[启动] 使用全局内存设置: ${memoryMB}M`);
        }
      }
    }

    if (launchCancelFlag) {
      writeLog('[启动] 用户已取消启动');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    let java: string | null = null;
    let javaVersionToUse: string = javaVersion;

    // 版本设置里明确选了 Java 就用它；否则有全局自定义路径就先用自定义路径，
    // 最后才回到“按游戏版本自动选择”的推荐 Java。
    if (versionJavaPath) {
      const resolved: string | null = resolveJavaExecutable(versionJavaPath);
      if (resolved) {
        java = resolved;
        writeLog(`[启动] 使用版本自定义 Java: ${java}`);
      } else {
        writeLog(`[启动] 版本自定义 Java 路径无效: ${versionJavaPath}`);
      }
    } else if (versionJavaChoice && versionJavaChoice !== 'auto' && versionJavaChoice !== 'custom') {
      javaVersionToUse = versionJavaChoice;
      java = await ensureJavaRuntime(javaVersionToUse);
    } else if (versionJavaChoice === 'custom') {
      const resolved: string | null = resolveJavaExecutable(String(settings.game?.javaPath || ''));
      if (resolved) {
        java = resolved;
        writeLog(`[启动] 使用全局自定义 Java: ${java}`);
      }
    } else if (settings.game?.javaPath) {
      const resolved: string | null = resolveJavaExecutable(String(settings.game.javaPath));
      if (resolved) {
        java = resolved;
        writeLog(`[启动] 使用全局 Java 路径: ${java}`);
      }
    } else {
      java = await ensureJavaRuntime(javaVersionToUse);
    }

    if (launchCancelFlag) {
      writeLog('[启动] 用户已取消启动');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    if (!java) {
      writeLog(`[Java] Java ${javaVersionToUse} 未安装，自动开始下载`);

      if (mainWindow) {
        mainWindow.webContents.send('java-auto-download-start', {
          javaVersion: javaVersionToUse,
          mcVersion: versionId
        });
      }

      const installResult: any = await downloadAndInstallJava(javaVersionToUse);

      if (launchCancelFlag) {
        writeLog('[启动] 用户已取消启动（Java下载完成后）');
        return { success: false, error: 'Launch cancelled', cancelled: true };
      }
      
      if (installResult.success) {
        java = installResult.javaPath;
        writeLog(`[Java] Java ${javaVersionToUse} 安装成功: ${java}`);

        if (mainWindow) {
          mainWindow.webContents.send('java-auto-download-complete', {
            javaVersion: javaVersionToUse,
            javaPath: java
          });
        }
      } else {
        writeLog(`[Java] Java ${javaVersionToUse} 安装失败: ${installResult.error}`);
        return {
          success: false,
          error: t('ui.java_version_installation_failed_error', { version: javaVersionToUse, error: installResult.error })
        };
      }
    }

    if (launchCancelFlag) {
      writeLog('[启动] 用户已取消启动（即将启动游戏前）');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    const authInfo: any = opt.authUuid && opt.authAccessToken
      ? { uuid: opt.authUuid, accessToken: opt.authAccessToken, userType: opt.authUserType || 'msa' }
      : undefined;
    const { jvmArgs, gameArgs, mainClass } = buildLaunchArgs(vd, rootDir, gameDir, versionId, username, actualWindowMode, memoryMB, serverIp, authInfo, {
      jvmArgsRaw: settings.game?.jvmArgs,
      gcPreset: settings.game?.gcPreset,
      windowSize: settings.game?.windowSize,
      windowWidth: settings.game?.windowWidth,
      windowHeight: settings.game?.windowHeight
    });
    const args: string[] = [...jvmArgs, mainClass, ...gameArgs];

    gameTitleTemplate = settings.game && typeof settings.game.windowTitle === 'string'
      ? settings.game.windowTitle
      : DEFAULT_SETTINGS.game.windowTitle;
    gameTitleKeepAlive = settings.game?.keepWindowTitle === true;
    // 标题由外部 SetWindowText 设置：客户端会把 --title 当未识别参数直接忽略
    // （实测 1.21.11 日志：Completely ignored arguments: [--title, ...]）
    {
      const previewContext: any = {
        mcVersion: generateLaunchDisplayName(versionId, rootDir),
        mcId: versionId,
        username: username,
        java: java ? path.basename(path.dirname(java)) : '',
        memory: memoryMB ? `${memoryMB}MB` : ''
      };
      const renderedTitle: string = renderGameTitle(gameTitleTemplate, previewContext);
      if (renderedTitle) writeLog(`[窗口标题] ${renderedTitle}`);
    }

    writeLog(`[启动] Java: ${java}`);
    writeLog(`[启动] 主类: ${mainClass}`);
    writeLog(`[启动] 窗口模式: ${actualWindowMode}`);
    writeLog(`[启动] 参数数: ${args.length}`);
    writeLog(`[启动] JVM参数: ${JSON.stringify(jvmArgs)}`);
    writeLog(`[启动] 游戏参数: ${JSON.stringify(gameArgs.slice(0, 10))}...`);

    if (settings.game?.optimizeBeforeLaunch) {
      writeLog('[启动] 启动前执行内存优化...');
      await trimWorkingSets();
    }

    if (settings.game?.autoLanguage === true) {
      const langCode: string = String(settings.game.language || 'zh_cn').trim();
      if (/^[a-z]{2,3}(_[a-z]{2,4})?$/.test(langCode)) {
        applyGameLanguage(gameDir, langCode);
      } else {
        writeLog(`[游戏语言] 语言代码无效，跳过: ${langCode}`);
      }
    }

    let proc: any;
    for (let i: number = 0; i < 3; i++) {
      try {
        // 独立进程：关掉启动器不会连带把游戏一起带走
        proc = spawn(java!, args, { cwd: gameDir, detached: true, windowsHide: false });
        writeLog(`启动游戏成功：PID ${proc.pid}`);
        break;
      } catch (e: any) {
        if (e.code === 'EBUSY' && i < 2) {
          await new Promise<void>(r => setTimeout(r, 1500));
          continue;
        }
        writeLog(`启动游戏失败：${e.message}`);
        return { success: false, error: e.message };
      }
    }

    if (proc && settings.game?.processPriority && settings.game.processPriority !== 'normal') {
      applyProcessPriority(proc.pid, settings.game.processPriority);
    }

    // 没有在跑的游戏时，以“这次启动前”为崩溃报告的基准
    if (gameSessions.size === 0) {
      preLaunchCrashArtifacts = listCrashArtifacts(gameDir);
    }

    const session: GameSession = {
      pid: proc.pid,
      process: proc,
      versionId: versionId,
      username: username,
      startedAt: Date.now(),
      rootDir: rootDir,
      gameDir: gameDir,
      javaPath: java,
      args: maskLaunchArgs(args),
      output: '',
      titleContext: {
        mcVersion: generateLaunchDisplayName(versionId, rootDir),
        mcId: versionId,
        username: username,
        java: java ? path.basename(path.dirname(java)) : '',
        memory: memoryMB ? `${memoryMB}MB` : ''
      }
    };
    gameSessions.set(session.pid, session);
    setActiveSession(session);
    gameSessionActive = true;
    currentGameLog = '';
    gameTitleSent = '';
    intentionalStop = false;
    startGameMonitor();
    startGameTitlePowerShell();

    let stdoutData: string = '';
    let stderrData: string = '';
    const captureOutput = (text: string): void => {
      pushGameLog(text);
      const session: GameSession | undefined = gameSessions.get(proc.pid);
      if (!session) return;
      session.output += text;
      if (session.output.length > GAME_LOG_KEEP_BYTES) session.output = session.output.slice(-GAME_LOG_KEEP_BYTES);
    };
    proc.stdout?.on('data', (d: any) => {
      const text: string = d.toString();
      stdoutData += text;
      captureOutput(text);
      if (mainWindow) {
        mainWindow.webContents.send('game-log', text);
      }

      if (text.includes('LWJGL Version') || text.includes('OpenGL version') || text.includes('Window')) {
        writeLog(`[启动] 检测到窗口初始化日志`);
        if (mainWindow) {
          mainWindow.webContents.send('game-window-created', { pid: proc.pid });
        }
      }
    });
    proc.stderr?.on('data', (d: any) => {
      const text: string = d.toString();
      stderrData += text;
      captureOutput(text);
      if (mainWindow) {
        mainWindow.webContents.send('game-log', text);
      }

      if (text.includes('LWJGL Version') || text.includes('OpenGL version') || text.includes('Window')) {
        writeLog(`[启动] 检测到窗口初始化日志`);
        if (mainWindow) {
          mainWindow.webContents.send('game-window-created', { pid: proc.pid });
        }
      }
    });
    proc.on('error', (err: any) => {
      writeLog(`[启动] 进程错误: ${err.message}`);
    });
    proc.on('exit', (code: number | null) => {
      const wasIntentional: boolean = launchCancelFlag || intentionalStop;
      const others: number = Math.max(0, gameSessions.size - 1);
      writeLog(`[启动] 进程退出，代码: ${code}${wasIntentional ? '（主动终止）' : ''}${others ? `（还有 ${others} 个游戏在运行）` : ''}`);
      if (code !== 0 && stderrData) {
        writeLog(`[启动] 错误输出: ${stderrData.slice(0, 1000)}`);
      }

      const session: GameSession | undefined = gameSessions.get(proc.pid);
      if (!session) {
        writeLog('[启动] 该进程已不归本次启动跟踪，跳过退出处理');
        return;
      }

      // 崩溃判定用这个进程自己的信息（面板可能已经切到另一个游戏了）
      const crash: { crashReport: string | null; reason: string } | null =
        wasIntentional ? null : detectCrash(session.gameDir, code);
      const crashInfo: any = crash ? {
        exitCode: code,
        versionId: session.versionId,
        versionName: generateLaunchDisplayName(session.versionId, session.rootDir),
        username: session.username,
        startedAt: session.startedAt,
        durationSec: Math.round((Date.now() - session.startedAt) / 1000),
        crashReport: crash.crashReport,
        reason: crash.reason,
        gameDir: session.gameDir,
        javaPath: session.javaPath,
        args: session.args,
        output: session.output
      } : null;
      if (crash) {
        writeLog(`[崩溃] 判定为崩溃，原因: ${crash.reason}，报告: ${crash.crashReport || '无'}`);
      }

      gameSessions.delete(proc.pid);

      if (gameSessions.size > 0) {
        // 还有别的游戏在跑：只是把面板切到剩下那个，不收尾
        if (currentGamePid === proc.pid) {
          const remaining: GameSession[] = Array.from(gameSessions.values());
          setActiveSession(remaining[remaining.length - 1]);
          refreshActiveGameTitle();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-status', gameStatusSnapshot(true, null));
          // 这个进程崩了还是要弹窗，只是整体会话没结束
          if (crashInfo) mainWindow.webContents.send('game-crashed', crashInfo);
        }
        return;
      }

      finishGameSession(code, crashInfo);
    });

    if (launchCancelFlag) {
      writeLog('[启动] 进程已启动但取消标志已设置，立即终止');
      killGameProcessTree(proc.pid);
      try { proc.kill(); } catch {}
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    await detectGameWindow(proc.pid);

    if (launchCancelFlag) {
      writeLog('[启动] 窗口检测结束后检测到取消标志');
      return { success: false, error: 'Launch cancelled', cancelled: true };
    }

    if (settings.game?.launcherVisibility === 'minimize' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
      writeLog('[启动] 已最小化启动器');
    }

    return { success: true, pid: proc.pid };
  } catch (e: any) {
    writeLog(`启动游戏异常：${e.message}`);
    return { success: false, error: e.message };
  }
});


export async function detectGameWindow(pid: number): Promise<void> {
  writeLog(`[启动] 开始检测游戏窗口，PID: ${pid}`);

  return new Promise<void>((resolve) => {
    let resolved: boolean = false;
    const done = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    const cancelCheck: any = setInterval(() => {
      if (launchCancelFlag) {
        writeLog(`[启动] 窗口检测期间检测到取消标志，立即终止游戏进程并退出`);
        clearInterval(cancelCheck);
        try { detector.kill(); } catch {}
        killGameProcessTree(pid);
        try {
          if (currentGameProcess) { currentGameProcess.kill(); }
        } catch {}
        currentGameProcess = null;
        currentGamePid = null;
        done();
      }
    }, 100);

    const timeout: any = setTimeout(() => {
      writeLog(`[启动] 游戏窗口检测超时（8秒），继续启动流程`);
      clearInterval(cancelCheck);
      try { detector.kill(); } catch {}
      if (mainWindow && !launchCancelFlag) {
        mainWindow.webContents.send('game-window-created', { pid, timeout: true });
      }
      done();
    }, 8000);

    const script: string = `
      $deadline = (Get-Date).AddSeconds(7)
      while ((Get-Date) -lt $deadline) {
        try {
          $p = Get-Process -Id ${pid} -ErrorAction Stop
          if ($p.MainWindowHandle -ne 0) { Write-Output "FOUND"; exit 0 }
        } catch { Write-Output "GONE"; exit 1 }
        Start-Sleep -Milliseconds 150
      }
      Write-Output "TIMEOUT"; exit 2
    `;
    const detector = spawn('powershell', ['-NoProfile', '-Command', script], { windowsHide: true });
    let output: string = '';

    detector.stdout.on('data', (d: any) => { output += d.toString(); });
    detector.stderr.on('data', (d: any) => { output += d.toString(); });

    detector.on('close', (code: number | null) => {
      clearInterval(cancelCheck);
      clearTimeout(timeout);

      if (launchCancelFlag) { done(); return; }

      if (output.includes('FOUND')) {
        writeLog(`[启动] 检测到游戏窗口（MainWindowHandle != 0）`);
      } else if (output.includes('GONE')) {
        writeLog(`[启动] 进程已退出`);
      } else {
        writeLog(`[启动] 窗口检测结束，code=${code}，output=${output.trim()}`);
      }

      if (mainWindow) {
        mainWindow.webContents.send('game-window-created', { pid, windowDetected: output.includes('FOUND') });
      }
      done();
    });

    detector.on('error', (err: any) => {
      clearInterval(cancelCheck);
      clearTimeout(timeout);
      writeLog(`[启动] 窗口检测器启动失败: ${err.message}`);
      if (mainWindow && !launchCancelFlag) {
        mainWindow.webContents.send('game-window-created', { pid, error: true });
      }
      done();
    });
  });
}


ipcMain.handle('get-game-status', async () => {
  if (!currentGamePid || !gameSessionActive) return gameStatusSnapshot(false, null, null);
  const probe: any = await readGameProcessProbe(currentGamePid);
  return gameStatusSnapshot(true, probe.memoryMB);
});


ipcMain.handle('get-game-log-tail', () => {
  return currentGameLog;
});

// 「查看日志」直接打开日志文件（游戏自己的 logs/latest.log），不是自制的查看窗口

ipcMain.handle('open-game-log', async (_: any, targetDir?: string) => {
  try {
    const gameDir: string = targetDir || currentGameGameDir || GAME_DIR;
    const logFile: string = path.join(gameDir, 'logs', 'latest.log');
    if (fs.existsSync(logFile)) {
      const err: string = await shell.openPath(logFile);
      if (!err) { writeLog(`[日志] 已打开 ${logFile}`); return { success: true, opened: logFile }; }
      writeLog(`[日志] 打开失败: ${err}`);
    }
    const logDir: string = path.join(gameDir, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    await shell.openPath(logDir);
    return { success: true, opened: logDir };
  } catch (e: any) {
    writeLog(`[日志] 打开异常: ${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('stop-game', async () => {
  const pids: number[] = Array.from(gameSessions.keys());
  if (!pids.length) {
    writeLog('[启动] 结束游戏：当前没有运行中的进程');
    return { success: false, error: 'No game is running' };
  }
  intentionalStop = true;
  writeLog(`[启动] 用户结束游戏，终止 ${pids.length} 个进程: ${pids.join(', ')}`);
  let killed: number = 0;
  for (const pid of pids) {
    if (killGameProcessTree(pid)) { killed++; continue; }
    const session: GameSession | undefined = gameSessions.get(pid);
    if (session) {
      try { session.process.kill(); killed++; } catch (e: any) { writeLog(`[启动] 结束游戏失败: ${e.message}`); }
    }
  }
  if (!killed) { findAndKillMinecraftJavaProcesses(); }
  return { success: true, killed };
});


function crashRecordFromInfo(info: any): CrashRecord {
  return {
    exitCode: info && info.exitCode !== undefined ? info.exitCode : null,
    versionId: (info && info.versionId) || currentGameVersionId || 'unknown',
    versionName: (info && info.versionName) || '',
    username: (info && info.username) || currentGameUsername || '',
    startedAt: (info && info.startedAt) || currentGameStartedAt || 0,
    durationSec: info && info.durationSec !== undefined ? info.durationSec : null,
    crashReport: (info && info.crashReport) || null,
    reason: (info && info.reason) || 'unknown',
    gameDir: (info && info.gameDir) || currentGameGameDir || GAME_DIR,
    javaPath: (info && info.javaPath) || currentGameJavaPath || null,
    args: (info && Array.isArray(info.args)) ? info.args : currentGameArgs,
    output: (info && typeof info.output === 'string') ? info.output : currentGameLog
  };
}


ipcMain.handle('analyze-crash', (_: any, info: any) => {
  try {
    return { success: true, analysis: analyzeCrash(crashRecordFromInfo(info)) };
  } catch (e: any) {
    writeLog(`[错误报告] 分析失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('export-error-report', async (_: any, info: any) => {
  try {
    if (!mainWindow) return { success: false, error: 'Window is not available' };

    const record: CrashRecord = crashRecordFromInfo(info);
    const stamp: string = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName: string = `GPCL-错误报告-${record.versionId}-${stamp}.zip`.replace(/[\\/:*?"<>|]/g, '_');

    let defaultDir: string = app.getPath('downloads');
    try { if (!fs.existsSync(defaultDir)) defaultDir = app.getPath('documents'); } catch {}

    const target: any = await dialog.showSaveDialog(mainWindow, {
      title: '导出错误报告',
      defaultPath: path.join(defaultDir, fileName),
      filters: [{ name: 'Zip 压缩包', extensions: ['zip'] }]
    });
    if (target.canceled || !target.filePath) return { success: false, cancelled: true };

    const result: any = await buildErrorReport(record, target.filePath);
    writeLog(`[错误报告] 已导出到 ${target.filePath}，包含 ${result.files} 个文件，${result.causes} 条分析结果`);

    try { shell.showItemInFolder(target.filePath); } catch {}
    return { success: true, filePath: target.filePath, files: result.files, causes: result.causes };
  } catch (e: any) {
    writeLog(`[错误报告] 导出失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});

