/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { docsUrl, t } from '../i18n';
import { crashDialogAnalysis, crashDialogDetail, crashDialogExport, crashDialogHelpLink, crashDialogLog, crashDialogOk, crashDialogOverlay, gameMonitor, gameMonitorDot, gameMonitorLogBtn, gameMonitorMemory, gameMonitorPid, gameMonitorState, gameMonitorStopBtn, gameMonitorUptime, gameMonitorVersion, showDialog, showFloatNotification, showToast } from './dom';
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
  const labels: Record<string, string> = { running: t('ui.running'), stopped: t('ui.exited') };
  if (typeof runningCount === 'number') monitorRunningCount = runningCount;
  let text: string = labels[state] || state;
  // 玩家可能同时开着好几个游戏，这里标一下总数
  if (state === 'running' && monitorRunningCount > 1) {
    text = t('ui.running_count_games', { count: monitorRunningCount });
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
  if (source.versionId) lines.push(t('ui.version_version', { version: source.versionId }));
  if (source.username) lines.push(t('ui.player_name', { name: source.username }));
  lines.push(t('ui.exit_code_code', { code: source.exitCode === null || source.exitCode === undefined ? t('ui.unknown') : source.exitCode }));
  if (source.durationSec !== null && source.durationSec !== undefined) {
    lines.push(t('ui.uptime_seconds_s', { seconds: source.durationSec }));
  }
  const reasons: Record<string, string> = {
    'exit-code': t('ui.the_game_process_exited_unexpectedly'),
    'crash-report': t('ui.a_crash_report_was_generated'),
    'exit-code-and-crash-report': t('ui.exited_unexpectedly_and_generated_a_crash_report')
  };
  lines.push(t('ui.cause_reason', { reason: reasons[source.reason] || t('ui.unknown') }));
  if (source.crashReport) {
    lines.push(t('ui.crash_report_file', { file: String(source.crashReport).split(/[\\/]/).pop() }));
  }
  return lines.join('\n');
}


let currentCrashAnalysis: any = null;

let crashAnalysisToken: number = 0;

let crashAnalysisReady: boolean = false;


function renderCrashAnalysisLoading(): void {
  if (!crashDialogAnalysis) return;
  crashDialogAnalysis.textContent = '';
  const loading: HTMLDivElement = document.createElement('div');
  loading.className = 'crash-analysis-loading';
  loading.textContent = t('ui.analyzing_logs');
  crashDialogAnalysis.appendChild(loading);
}


function renderCrashAnalysis(analysis: any): void {
  if (!crashDialogAnalysis) return;
  crashDialogAnalysis.textContent = '';
  const causes: any[] = analysis && Array.isArray(analysis.causes) ? analysis.causes : [];

  if (!causes.length) {
    const note: HTMLDivElement = document.createElement('div');
    note.className = 'crash-analysis-note';
    note.textContent = t('ui.no_clear_cause_was_found_in_the_logs_open_the_log_yourself_or_export_an_1c9e0d');
    crashDialogAnalysis.appendChild(note);
    return;
  }

  const heading: HTMLDivElement = document.createElement('div');
  heading.className = 'crash-analysis-heading';
  heading.textContent = t('ui.clues_found_in_the_logs');
  crashDialogAnalysis.appendChild(heading);

  const list: HTMLDivElement = document.createElement('div');
  list.className = 'crash-analysis-list';
  for (const cause of causes.slice(0, 2)) {
    const card: HTMLDivElement = document.createElement('div');
    card.className = 'crash-cause';
    const title: HTMLDivElement = document.createElement('div');
    title.className = 'crash-cause-title';
    title.textContent = `${cause.title || t('ui.unknown_cause')}${cause.confidence === 'suspect' ? t('ui.inferred') : ''}`;
    const detail: HTMLDivElement = document.createElement('div');
    detail.className = 'crash-cause-detail';
    detail.textContent = String(cause.detail || '');
    card.appendChild(title);
    card.appendChild(detail);
    list.appendChild(card);
  }
  crashDialogAnalysis.appendChild(list);

  if (causes.length > 2) {
    const more: HTMLDivElement = document.createElement('div');
    more.className = 'crash-analysis-note';
    more.textContent = t('ui.count_more_clue_s_open_view_details', { count: causes.length - 2 });
    crashDialogAnalysis.appendChild(more);
  }
}


function formatCrashDetail(analysis: any): string {
  const lines: string[] = [];
  const causes: any[] = analysis && Array.isArray(analysis.causes) ? analysis.causes : [];
  if (causes.length) {
    lines.push(t('ui.analysis'));
    causes.forEach((cause: any, index: number): void => {
      lines.push(`${index + 1}. ${cause.title || t('ui.unknown_cause')}${cause.confidence === 'suspect' ? t('ui.inferred') : ''}`);
      for (const line of String(cause.detail || '').split('\n')) lines.push(`   ${line}`);
      if (cause.evidence) {
        for (const line of String(cause.evidence).split('\n')) lines.push(`   ${t('ui.evidence_line', { line })}`);
      }
      lines.push('');
    });
  } else {
    lines.push(t('ui.no_clear_cause_was_found_in_the_logs'));
    lines.push('');
  }
  lines.push(formatCrashMeta(currentCrashInfo));
  if (analysis && Array.isArray(analysis.errorLines) && analysis.errorLines.length) {
    lines.push('');
    lines.push(t('ui.error_lines_in_the_log'));
    for (const line of analysis.errorLines.slice(-8)) lines.push(`  ${line}`);
  }
  if (analysis && Array.isArray(analysis.analyzedFiles) && analysis.analyzedFiles.length) {
    lines.push('');
    lines.push(t('ui.logs_analyzed'));
    for (const file of analysis.analyzedFiles) {
      lines.push(`  ${String(file).split(/[\\/]/).pop()}`);
    }
  }
  return lines.join('\n');
}


export function showCrashDialog(info: any): void {
  currentCrashInfo = info || {};
  currentCrashAnalysis = null;
  crashAnalysisReady = false;
  renderCrashAnalysisLoading();
  if (crashDialogOverlay) crashDialogOverlay.classList.remove('hidden');

  const token: number = ++crashAnalysisToken;
  if (!window.gpcl || !window.gpcl.analyzeCrash) {
    crashAnalysisReady = true;
    renderCrashAnalysis(null);
    return;
  }
  window.gpcl.analyzeCrash(currentCrashInfo).then((result: any): void => {
    if (token !== crashAnalysisToken) return;
    currentCrashAnalysis = result && result.success ? result.analysis : null;
    crashAnalysisReady = true;
    renderCrashAnalysis(currentCrashAnalysis);
  }).catch((): void => {
    if (token !== crashAnalysisToken) return;
    crashAnalysisReady = true;
    renderCrashAnalysis(null);
  });
}


export function hideCrashDialog(): void {
  if (crashDialogOverlay) crashDialogOverlay.classList.add('hidden');
}

// 「查看日志」= 打开日志文件本身（游戏目录 logs/latest.log），不做应用内查看器

export async function openGameLogFile(gameDir?: string): Promise<void> {
  if (!window.gpcl || !window.gpcl.openGameLog) return;
  const result: any = await window.gpcl.openGameLog(gameDir);
  if (result && result.success) {
    showToast('ui.log_opened', (result.opened || '').split(/[\\/]/).pop() || 'logs', 'info', 'log-opened');
  } else {
    showToast('ui.could_not_open_the_log', (result && result.error) || t('ui.log_file_not_found'), 'error');
  }
}


if (gameMonitorLogBtn) {
  gameMonitorLogBtn.addEventListener('click', (): void => { void openGameLogFile(); });
}


if (gameMonitorStopBtn) {
  gameMonitorStopBtn.addEventListener('click', async (): Promise<void> => {
    const countNote: string = monitorRunningCount > 1 ? t('ui.count_games_are_running_and_will_be_closed_together', { count: monitorRunningCount }) : '';
    const confirmed: boolean = await showDialog({
      type: 'confirm',
      title: t('ui.end_game'),
      message: t('ui.end_the_running_game_unsaved_progress_will_be_lost_note', { note: countNote }),
      confirmText: t('ui.end_game'),
      cancelText: t('ui.cancel')
    });
    if (!confirmed) return;
    if (window.gpcl && window.gpcl.stopGame) {
      const result: any = await window.gpcl.stopGame();
      if (result && result.success) {
        showToast('ui.ending_the_game', t('ui.game_stop_requested'), 'info', 'game-stopping');
      } else {
        showToast('ui.could_not_end_the_game', (result && result.error) || t('ui.no_running_game_found'), 'error');
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
    const message: string = crashAnalysisReady ? formatCrashDetail(currentCrashAnalysis) : t('ui.crash_analysis_wait');
    void showDialog({ type: 'info', title: t('ui.error_details'), message });
  });
}


if (crashDialogLog) {
  crashDialogLog.addEventListener('click', (): void => {
    void openGameLogFile(currentCrashInfo && currentCrashInfo.gameDir);
  });
}


if (crashDialogExport) {
  crashDialogExport.addEventListener('click', async (): Promise<void> => {
    if (!window.gpcl || !window.gpcl.exportErrorReport) return;
    const button: HTMLButtonElement = crashDialogExport as HTMLButtonElement;
    button.disabled = true;
    button.textContent = t('ui.exporting_report');
    try {
      const result: any = await window.gpcl.exportErrorReport(currentCrashInfo);
      if (result && result.success) {
        showToast('ui.error_report_exported', t('ui.report_export_hint'), 'success', 'report-exported');
      } else if (result && result.cancelled) {
        showToast('ui.export_cancelled', '', 'info', 'report-export-cancelled');
      } else {
        showToast('ui.export_failed', (result && result.error) || t('ui.unknown_error'), 'error');
      }
    } catch (e: any) {
      showToast('ui.export_failed', e.message || t('ui.unknown_error'), 'error');
    } finally {
      button.disabled = false;
      button.textContent = t('ui.export_error_report');
    }
  });
}


if (crashDialogHelpLink) {
  crashDialogHelpLink.addEventListener('click', (e: Event): void => {
    e.preventDefault();
    if (window.gpcl && window.gpcl.openExternal) {
      window.gpcl.openExternal(docsUrl('mc-game/'));
    }
  });
}


export function handleGameLog(text: string): void {
  appendGameLog(text);

  if (text.includes('Java') && text.includes('未安装') && text.includes('自动开始下载')) {
    const match: RegExpMatchArray | null = text.match(/Java\s+(\d+)/);
    if (match) {
      showFloatNotification(
        t('ui.downloading_java_version', { version: match[1] }),
        t('ui.java_version_was_not_found_downloading_it_automatically', { version: match[1] })
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
