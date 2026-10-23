// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { ensureDockChart, resetDockChart, updateDockChart } from './dock-chart';
import { formatSpeed } from './speed';
// __IMPORTS_END__

const dock: HTMLElement | null = document.getElementById('download-dock');
const fill: HTMLElement | null = document.getElementById('download-dock-fill');
const titleEl: HTMLElement | null = document.getElementById('download-dock-title');
const currentEl: HTMLElement | null = document.getElementById('download-dock-current');
const percentEl: HTMLElement | null = document.getElementById('download-dock-percent');
const speedEl: HTMLElement | null = document.getElementById('download-dock-speed');
const countEl: HTMLElement | null = document.getElementById('download-dock-count');
const queuedEl: HTMLElement | null = document.getElementById('download-dock-queued');
const openBtn: HTMLElement | null = document.getElementById('download-dock-open');
const toggleBtn: HTMLElement | null = document.getElementById('download-dock-toggle');
const toggleLabel: HTMLElement | null = document.getElementById('download-dock-toggle-label');
const panel: HTMLElement | null = document.getElementById('download-dock-panel');
const panelCount: HTMLElement | null = document.getElementById('download-dock-panel-count');
const panelClear: HTMLElement | null = document.getElementById('download-dock-panel-clear');
const panelSubtitle: HTMLElement | null = document.getElementById('download-dock-panel-subtitle');
const panelCurrentSpeed: HTMLElement | null = document.getElementById('dock-current-speed');
const panelPeakSpeed: HTMLElement | null = document.getElementById('dock-peak-speed');
const panelPercent: HTMLElement | null = document.getElementById('dock-panel-percent');
const panelQueued: HTMLElement | null = document.getElementById('dock-panel-queued');
const panelRunning: HTMLElement | null = document.getElementById('dock-panel-running');

let clearHandler: (() => void) | null = null;

export function setDownloadDockClearHandler(handler: (() => void) | null): void {
  clearHandler = handler;
}

let cancelling: boolean = false;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let dockIdle: boolean = false;
let peakBytes: number = 0;
let lastSpeedBytes: number = 0;
let lastTitle: string = '';
let lastLabel: string = '';
let lastPercent: string = '';
let lastSpeed: string = '';
let lastCount: string = '';
let lastQueued: string = '';

function clearAutoHide(): void {
  if (autoHideTimer !== null) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

function setText(el: HTMLElement | null, value: string, previous: string): string {
  if (el && value !== previous) el.textContent = value;
  return value;
}

function setSpeedText(bytesPerSecond: number): void {
  lastSpeedBytes = Math.max(0, Number(bytesPerSecond) || 0);
  const text: string = formatSpeed(lastSpeedBytes);
  lastSpeed = setText(speedEl, text, lastSpeed);
  setText(panelCurrentSpeed, text, panelCurrentSpeed?.textContent || '');
}

function updatePeak(bytesPerSecond: number): void {
  if (Number(bytesPerSecond) > peakBytes) {
    peakBytes = Math.max(0, Number(bytesPerSecond) || 0);
    setText(panelPeakSpeed, formatSpeed(peakBytes), panelPeakSpeed?.textContent || '');
  }
}

export function showDownloadDock(name: string): void {
  if (!dock) return;
  cancelling = false;
  peakBytes = 0;
  lastSpeedBytes = 0;
  clearAutoHide();
  dockIdle = false;
  dock.classList.remove('hidden', 'is-done', 'is-error', 'is-stage');
  lastTitle = setText(titleEl, name, lastTitle);
  lastLabel = setText(currentEl, t('ui.preparing_download'), lastLabel);
  lastPercent = setText(percentEl, '0%', lastPercent);
  lastSpeed = setText(speedEl, formatSpeed(0), lastSpeed);
  lastCount = setText(countEl, '', lastCount);
  if (fill) fill.style.width = '0%';
  setText(panelPeakSpeed, formatSpeed(0), panelPeakSpeed?.textContent || '');
  setText(panelCurrentSpeed, formatSpeed(0), panelCurrentSpeed?.textContent || '');
  setText(panelPercent, '0%', panelPercent?.textContent || '');
  resetDockChart();
  void ensureDockChart();
  document.body.classList.add('download-dock-open');
  void dock.offsetHeight;
  dock.classList.add('show');
}

export function updateDownloadDock(progress: {
  percent: number;
  label?: string;
  speed?: number;
  current?: number;
  total?: number;
}): void {
  if (!dock || !dock.classList.contains('show') || cancelling) return;
  dock.classList.remove('is-stage', 'is-done', 'is-error');

  const percent: number = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  const percentText: string = `${Math.floor(percent)}%`;
  if (fill) fill.style.width = `${percent}%`;
  lastPercent = setText(percentEl, percentText, lastPercent);
  setText(panelPercent, percentText, panelPercent?.textContent || '');

  if (progress.label) {
    lastLabel = setText(currentEl, progress.label, lastLabel);
  } else if (!lastLabel) {
    lastLabel = setText(currentEl, t('ui.downloading'), lastLabel);
  }

  const speedBytes: number = Math.max(0, Number(progress.speed) || 0);
  setSpeedText(speedBytes);
  updatePeak(speedBytes);
  updateDockChart(speedBytes);

  const total: number = Number(progress.total) || 0;
  const done: number = Math.min(Number(progress.current) || 0, total || Number.MAX_SAFE_INTEGER);
  lastCount = setText(countEl, total > 0 ? t('ui.files_done_total', { done, total }) : '', lastCount);
}

export function setDownloadDockStage(message: string): void {
  if (!dock || !dock.classList.contains('show')) return;
  dock.classList.add('is-stage');
  lastLabel = setText(currentEl, message, lastLabel);
  lastPercent = setText(percentEl, '—', lastPercent);
  lastSpeed = setText(speedEl, '', lastSpeed);
  lastCount = setText(countEl, '', lastCount);
}

export function setDownloadDockQueue(count: number): void {
  if (queuedEl) {
    if (count > 0) {
      queuedEl.classList.remove('hidden');
      lastQueued = setText(queuedEl, t('ui.queued_count_more', { count }), lastQueued);
    } else {
      queuedEl.classList.add('hidden');
    }
  }
  setText(panelQueued, String(Math.max(0, count)), panelQueued?.textContent || '');
}

export function finishDownloadDock(message: string, kind: 'done' | 'error' = 'done'): void {
  if (!dock) return;
  cancelling = false;
  dock.classList.remove('is-stage');
  dock.classList.toggle('is-done', kind === 'done');
  dock.classList.toggle('is-error', kind === 'error');
  if (kind === 'done') {
    if (fill) fill.style.width = '100%';
    lastPercent = setText(percentEl, '100%', lastPercent);
    setText(panelPercent, '100%', panelPercent?.textContent || '');
  }
  lastLabel = setText(currentEl, message, lastLabel);
  lastSpeed = setText(speedEl, '', lastSpeed);
  lastCount = setText(countEl, '', lastCount);
  lastSpeedBytes = 0;
  setText(panelCurrentSpeed, formatSpeed(0), panelCurrentSpeed?.textContent || '');
}

export function setDownloadDockPanelCount(count: number, hasCompleted: boolean, runningCount: number = 0): void {
  if (panelCount) panelCount.textContent = count > 0 ? t('ui.task_count', { count }) : '';
  if (panelClear) panelClear.classList.toggle('hidden', !hasCompleted);
  if (panelSubtitle) {
    panelSubtitle.textContent = runningCount > 0
      ? t('ui.dock_running_and_queued', { running: runningCount, queued: Math.max(0, count - runningCount) })
      : count > 0 ? t('ui.dock_finished_count', { count }) : t('ui.dock_no_active_task');
  }
  if (panelRunning) {
    panelRunning.textContent = runningCount > 0 ? t('ui.dock_running_count', { count: runningCount }) : '';
  }
}

/** 队列跑完后调用：隔一会儿把底栏收下去；用户正展开任务面板时等他关掉再收 */
export function scheduleDownloadDockHide(kind: 'done' | 'error' = 'done'): void {
  if (!dock || !dock.classList.contains('show')) return;
  dockIdle = true;
  clearAutoHide();
  const delay: number = kind === 'error' ? 8000 : 3000;
  autoHideTimer = setTimeout(() => {
    autoHideTimer = null;
    if (!dock.classList.contains('show') || isDownloadDockPanelOpen()) return;
    hideDownloadDock();
  }, delay);
}

export function isDownloadDockPanelOpen(): boolean {
  return !!panel && !panel.classList.contains('hidden');
}

export function setDownloadDockPanelOpen(open: boolean): void {
  if (!dock || !panel) return;
  panel.classList.toggle('hidden', !open);
  dock.classList.toggle('expanded', open);
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (toggleLabel) {
    const label: string = open ? t('ui.collapse_panel') : t('ui.expand_panel');
    if (toggleLabel.textContent !== label) toggleLabel.textContent = label;
  }
  if (open) {
    clearAutoHide();
    void ensureDockChart();
  } else if (dockIdle) {
    scheduleDownloadDockHide();
  }
}

/** 取消当前任务：由下载进程面板里“运行中”任务行的取消按钮调用 */
export function beginDownloadDockCancel(): void {
  if (!dock || !dock.classList.contains('show')) return;
  cancelling = true;
  setDownloadDockStage(t('ui.cancelling'));
  if (window.gpcl && window.gpcl.cancelDownloadOnly) void window.gpcl.cancelDownloadOnly();
}

export function hideDownloadDock(): void {
  if (!dock) return;
  setDownloadDockPanelOpen(false);
  clearAutoHide();
  dockIdle = false;
  dock.classList.remove('show');
  document.body.classList.remove('download-dock-open');
  setTimeout(() => {
    if (!dock.classList.contains('show')) {
      dock.classList.add('hidden');
      dock.classList.remove('is-done', 'is-error', 'is-stage');
      lastTitle = '';
      lastLabel = '';
      lastPercent = '';
      lastSpeed = '';
      lastCount = '';
    }
  }, 320);
}

window.addEventListener('gpcl-speed-unit-changed', (): void => {
  lastSpeed = '';
  setSpeedText(lastSpeedBytes);
  setText(panelPeakSpeed, formatSpeed(peakBytes), panelPeakSpeed?.textContent || '');
});

if (openBtn) {
  openBtn.addEventListener('click', () => setDownloadDockPanelOpen(!isDownloadDockPanelOpen()));
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => setDownloadDockPanelOpen(!isDownloadDockPanelOpen()));
}

if (panelClear) {
  panelClear.addEventListener('click', () => {
    if (clearHandler) clearHandler();
  });
}

document.addEventListener('click', (event: Event) => {
  if (!isDownloadDockPanelOpen()) return;
  if (dock && event.target instanceof Node && dock.contains(event.target)) return;
  setDownloadDockPanelOpen(false);
});

function applyWindowState(state: any): void {
  const maximized: boolean = Boolean(state && (state.maximized || state.fullScreen));
  document.documentElement.classList.toggle('window-maximized', maximized);
}

if (window.gpcl) {
  if (window.gpcl.onWindowState) window.gpcl.onWindowState(applyWindowState);
  if (window.gpcl.getWindowState) {
    window.gpcl.getWindowState().then(applyWindowState).catch(() => {});
  }
}
