/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { crashDialogDetail, crashDialogExport, crashDialogHelpLink, crashDialogLog, crashDialogOk, crashDialogOverlay, gameMonitor, gameMonitorDot, gameMonitorLogBtn, gameMonitorMemory, gameMonitorPid, gameMonitorState, gameMonitorStopBtn, gameMonitorUptime, gameMonitorVersion, showDialog, showFloatNotification, showToast } from './dom';
// __IMPORTS_END__

export let gameRunning: boolean = false;

export let gameLogBuffer: string = '';

export let monitorStartedAt: number | null = null;

export let monitorElapsedTimer: any = null;

export let lastGameStatusAt: number = 0;

export let monitorVersionId: string = '';

export let monitorRunningCount: number = 0;

export let crashReported: boolean = false;

export let currentCrashInfo: any = null;


export function appendGameLog(text: string): void {
  if (!text) return;
  gameLogBuffer += text;
  if (gameLogBuffer.length > 40000) gameLogBuffer = gameLogBuffer.slice(-40000);
}


export function setMonitorState(state: string, runningCount?: number): void {
  const labels: Record<string, string> = { running: '运行中', stopped: '已退出' };
  if (typeof runningCount === 'number') monitorRunningCount = runningCount;
  let text: string = labels[state] || state;
  // 玩家可能同时开着好几个游戏，这里标一下总数
  if (state === 'running' && monitorRunningCount > 1) {
    text = `运行中 · ${monitorRunningCount} 个游戏`;
  }
  if (gameMonitorState) gameMonitorState.textContent = text;
  if (gameMonitorDot) gameMonitorDot.className = `game-monitor-dot ${state}`;
  // 已经退出了就别再让点“结束游戏”（主进程那边已经没有进程可结束）
  if (gameMonitorStopBtn) (gameMonitorStopBtn as HTMLButtonElement).disabled = state === 'stopped';
}


export function setMonitorVersion(versionId: string): void {
  if (!gameMonitorVersion) return;
  if (!versionId) { gameMonitorVersion.textContent = '-'; return; }
  if (versionId === monitorVersionId) return;
  monitorVersionId = versionId;
  gameMonitorVersion.textContent = versionId;
  if (window.gpcl && window.gpcl.getLaunchDisplayName) {
    window.gpcl.getLaunchDisplayName(versionId).then((name: string): void => {
      if (gameMonitorVersion && name && monitorVersionId === versionId) {
        gameMonitorVersion.textContent = name;
      }
    }).catch((): void => {});
  }
}


export function startMonitorClock(): void {
  if (monitorElapsedTimer) clearInterval(monitorElapsedTimer);
  const tick = (): void => {
    if (!monitorStartedAt || !gameMonitorUptime) return;
    const total: number = Math.max(0, Math.floor((Date.now() - monitorStartedAt) / 1000));
    const hours: number = Math.floor(total / 3600);
    const minutes: number = Math.floor((total % 3600) / 60);
    const seconds: number = total % 60;
    const mm: string = String(minutes).padStart(2, '0');
    const ss: string = String(seconds).padStart(2, '0');
    gameMonitorUptime.textContent = hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;

    // 主进程每 3 秒推一次状态。超过 12 秒没收到说明事件丢了，
    // 用 invoke 主动查一次兜底，免得面板一直卡在“运行中”。
    if (gameRunning && Date.now() - lastGameStatusAt > 12000) {
      lastGameStatusAt = Date.now();
      void refreshGameMonitor();
    }
  };
  tick();
  monitorElapsedTimer = setInterval(tick, 1000);
}


export function showGameMonitor(status: any): void {
  if (!gameMonitor) return;
  gameRunning = true;
  monitorStartedAt = (status && status.startedAt) || Date.now();

  if (gameMonitorPid) gameMonitorPid.textContent = status && status.pid ? String(status.pid) : '-';
  if (gameMonitorMemory) {
    gameMonitorMemory.textContent = status && status.memoryMB ? `${status.memoryMB} MB` : '-';
  }

  monitorVersionId = '';
  setMonitorVersion((status && status.versionId) || '');

  setMonitorState('running', status && status.runningCount);
  startMonitorClock();
  gameMonitor.classList.add('active');
}


export function hideGameMonitor(): void {
  gameRunning = false;
  monitorRunningCount = 0;
  monitorVersionId = '';
  if (monitorElapsedTimer) clearInterval(monitorElapsedTimer);
  monitorElapsedTimer = null;
  monitorStartedAt = null;
  if (gameMonitorMemory) gameMonitorMemory.textContent = '-';
  setMonitorState('stopped');

  setTimeout((): void => {
    if (!gameRunning && gameMonitor) gameMonitor.classList.remove('active');
  }, 2500);
}


export async function refreshGameMonitor(): Promise<void> {
  if (!window.gpcl || !window.gpcl.getGameStatus) return;
  try {
    const status: any = await window.gpcl.getGameStatus();
    if (status && status.running) {
      showGameMonitor(status);
    } else if (gameRunning) {
      hideGameMonitor();
    }
  } catch {}
}


export function formatCrashMeta(info: any): string {
  const source: any = info || {};
  const lines: string[] = [];
  if (source.versionId) lines.push(`版本: ${source.versionId}`);
  if (source.username) lines.push(`玩家: ${source.username}`);
  lines.push(`退出码: ${source.exitCode === null || source.exitCode === undefined ? '未知' : source.exitCode}`);
  if (source.durationSec !== null && source.durationSec !== undefined) {
    lines.push(`运行时长: ${source.durationSec} 秒`);
  }
  const reasons: Record<string, string> = {
    'exit-code': '游戏进程异常退出',
    'crash-report': '生成了崩溃报告',
    'exit-code-and-crash-report': '异常退出并生成了崩溃报告'
  };
  lines.push(`原因: ${reasons[source.reason] || '未知'}`);
  if (source.crashReport) {
    lines.push(`崩溃报告: ${String(source.crashReport).split(/[\\/]/).pop()}`);
  }
  return lines.join('\n');
}


export function showCrashDialog(info: any): void {
  currentCrashInfo = info || {};
  if (crashDialogOverlay) crashDialogOverlay.classList.remove('hidden');
}


export function hideCrashDialog(): void {
  if (crashDialogOverlay) crashDialogOverlay.classList.add('hidden');
}

// 「查看日志」= 打开日志文件本身（游戏目录 logs/latest.log），不做应用内查看器

export async function openGameLogFile(): Promise<void> {
  if (!window.gpcl || !window.gpcl.openGameLog) return;
  const result: any = await window.gpcl.openGameLog();
  if (result && result.success) {
    showToast('已打开日志', (result.opened || '').split(/[\\/]/).pop() || 'logs', 'info', 'log-opened');
  } else {
    showToast('打开日志失败', (result && result.error) || '找不到日志文件', 'error');
  }
}


if (gameMonitorLogBtn) {
  gameMonitorLogBtn.addEventListener('click', (): void => { void openGameLogFile(); });
}


if (gameMonitorStopBtn) {
  gameMonitorStopBtn.addEventListener('click', async (): Promise<void> => {
    const countNote: string = monitorRunningCount > 1 ? `当前有 ${monitorRunningCount} 个游戏在运行，会一起结束。` : '';
    const confirmed: boolean = await showDialog({
      type: 'confirm',
      title: '结束游戏',
      message: `确定要结束当前运行的游戏吗？未保存的进度会丢失。${countNote}`,
      confirmText: '结束游戏',
      cancelText: '取消'
    });
    if (!confirmed) return;
    if (window.gpcl && window.gpcl.stopGame) {
      const result: any = await window.gpcl.stopGame();
      if (result && result.success) {
        showToast('正在结束游戏', '已请求关闭 Minecraft 进程', 'info', 'game-stopping');
      } else {
        showToast('结束失败', (result && result.error) || '没有找到运行中的游戏', 'error');
      }
    }
  });
}


if (crashDialogOk) {
  crashDialogOk.addEventListener('click', hideCrashDialog);
}


if (crashDialogDetail) {
  crashDialogDetail.addEventListener('click', (e: Event): void => {
    e.preventDefault();
    void showDialog({ type: 'info', title: '错误详情', message: formatCrashMeta(currentCrashInfo) });
  });
}


if (crashDialogLog) {
  crashDialogLog.addEventListener('click', (): void => { void openGameLogFile(); });
}


if (crashDialogExport) {
  crashDialogExport.addEventListener('click', async (): Promise<void> => {
    if (!window.gpcl || !window.gpcl.exportErrorReport) return;
    const button: HTMLButtonElement = crashDialogExport as HTMLButtonElement;
    button.disabled = true;
    button.textContent = '正在导出...';
    try {
      const result: any = await window.gpcl.exportErrorReport(currentCrashInfo);
      if (result && result.success) {
        showToast('错误报告已导出', '请把整个压缩包发给帮助你的人', 'success', 'report-exported');
      } else if (result && result.cancelled) {
        showToast('已取消导出', '', 'info', 'report-export-cancelled');
      } else {
        showToast('导出失败', (result && result.error) || '未知错误', 'error');
      }
    } catch (e: any) {
      showToast('导出失败', e.message || '未知错误', 'error');
    } finally {
      button.disabled = false;
      button.textContent = '导出错误报告';
    }
  });
}


if (crashDialogHelpLink) {
  crashDialogHelpLink.addEventListener('click', (e: Event): void => {
    e.preventDefault();
    if (window.gpcl && window.gpcl.openExternal) {
      window.gpcl.openExternal('https://gamets.caellab.com/gpcl/help/mc-game/');
    }
  });
}


export function handleGameLog(text: string): void {
  appendGameLog(text);

  if (text.includes('Java') && text.includes('未安装') && text.includes('自动开始下载')) {
    const match: RegExpMatchArray | null = text.match(/Java\s+(\d+)/);
    if (match) {
      showFloatNotification(
        `正在下载 Java ${match[1]}`,
        `检测到您没有 Java ${match[1]}，正在自动下载`
      );
    }
  }
}

/** 跨模块写入用：crashReported 归本模块所有，其它模块只能经此写入 */
export function setCrashReported(value: boolean): void { crashReported = value; }

/** 跨模块写入用：lastGameStatusAt 归本模块所有，其它模块只能经此写入 */
export function setLastGameStatusAt(value: number): void { lastGameStatusAt = value; }

/** 跨模块写入用：monitorStartedAt 归本模块所有，其它模块只能经此写入 */
export function setMonitorStartedAt(value: number | null): void { monitorStartedAt = value; }
