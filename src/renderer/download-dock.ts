/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
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

let clearHandler: (() => void) | null = null;

export function setDownloadDockClearHandler(handler: (() => void) | null): void {
  clearHandler = handler;
}

let cancelling: boolean = false;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let dockIdle: boolean = false;
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

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return t('ui.speed_mbps', { speed: '0.0' });
  const megabytes: number = bytesPerSecond / (1024 * 1024);
  if (megabytes >= 1) return t('ui.speed_mbps', { speed: megabytes.toFixed(1) });
  return t('ui.speed_kbps', { speed: Math.max(1, Math.round(bytesPerSecond / 1024)).toString() });
}

export function showDownloadDock(name: string): void {
  if (!dock) return;
  cancelling = false;
  clearAutoHide();
  dockIdle = false;
  dock.classList.remove('hidden', 'is-done', 'is-error', 'is-stage');
  lastTitle = setText(titleEl, name, lastTitle);
  lastLabel = setText(currentEl, t('ui.preparing_download'), lastLabel);
  lastPercent = setText(percentEl, '0%', lastPercent);
  lastSpeed = setText(speedEl, formatSpeed(0), lastSpeed);
  lastCount = setText(countEl, '', lastCount);
  if (fill) fill.style.width = '0%';
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

  if (progress.label) {
    lastLabel = setText(currentEl, progress.label, lastLabel);
  } else if (!lastLabel) {
    lastLabel = setText(currentEl, t('ui.downloading'), lastLabel);
  }

  lastSpeed = setText(speedEl, formatSpeed(Number(progress.speed) || 0), lastSpeed);

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
  if (!queuedEl) return;
  if (count > 0) {
    queuedEl.classList.remove('hidden');
    lastQueued = setText(queuedEl, t('ui.queued_count_more', { count }), lastQueued);
  } else {
    queuedEl.classList.add('hidden');
  }
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
  }
  lastLabel = setText(currentEl, message, lastLabel);
  lastSpeed = setText(speedEl, '', lastSpeed);
  lastCount = setText(countEl, '', lastCount);
}

export function setDownloadDockPanelCount(count: number, hasCompleted: boolean): void {
  if (panelCount) panelCount.textContent = count > 0 ? t('ui.task_count', { count }) : '';
  if (panelClear) panelClear.classList.toggle('hidden', !hasCompleted);
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
  if (open) clearAutoHide();
  else if (dockIdle) scheduleDownloadDockHide();
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
