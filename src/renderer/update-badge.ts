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

type BadgeMode = 'available' | 'downloading' | 'ready' | 'failed';

export interface UpdateBadgeHandlers {
  onDownload: (version: string) => void;
  onInstall: () => void;
}

let handlers: UpdateBadgeHandlers = { onDownload: () => {}, onInstall: () => {} };
let mode: BadgeMode = 'available';
let currentVersion: string = '';
// 非 Windows 平台没有应用内更新：按钮变成「打开下载页」
let manualMode: boolean = false;


export function setUpdateBadgeManualMode(value: boolean): void {
  manualMode = value;
}

const widget: HTMLElement | null = document.getElementById('update-widget');
const widgetBtn: HTMLElement | null = document.getElementById('update-widget-btn');
const widgetIcon: HTMLElement | null = document.getElementById('update-widget-icon');
const popover: HTMLElement | null = document.getElementById('update-popover');
const popoverClose: HTMLElement | null = document.getElementById('update-popover-close');
const popoverHeading: HTMLElement | null = document.getElementById('update-popover-heading-text');
const popoverVersion: HTMLElement | null = document.getElementById('update-popover-version');
const popoverTitle: HTMLElement | null = document.getElementById('update-popover-title');
const popoverLog: HTMLElement | null = document.getElementById('update-popover-log');
const progress: HTMLElement | null = document.getElementById('update-progress');
const progressFill: HTMLElement | null = document.getElementById('update-progress-fill');
const statusText: HTMLElement | null = document.getElementById('update-status-text');
const installBtn: HTMLButtonElement | null = document.getElementById('update-install-btn') as HTMLButtonElement | null;


function applyMode(next: BadgeMode): void {
  mode = next;
  if (widget) {
    widget.classList.remove('hidden');
    widget.classList.toggle('downloading', next === 'downloading');
    widget.classList.toggle('ready', next === 'ready');
    widget.classList.toggle('failed', next === 'failed');
  }
  if (widgetIcon) {
    const iconName: string = next === 'ready' ? 'check' : next === 'failed' ? 'alert' : 'download';
    widgetIcon.className = `icon icon-${iconName}`;
  }
  if (popoverHeading) {
    popoverHeading.textContent = next === 'ready' ? t('ui.update_ready') : next === 'downloading' ? t('ui.downloading_update') : t('ui.new_version_available');
  }
  if (progress) progress.classList.toggle('hidden', next !== 'downloading');
  if (next === 'available') {
    setProgress(0);
    if (statusText) statusText.textContent = t('ui.a_new_version_is_available_to_download');
  }
  if (installBtn) {
    installBtn.disabled = next === 'downloading';
    installBtn.textContent = next === 'downloading'
      ? t('ui.downloading_2')
      : next === 'ready'
        ? t('ui.restart_to_update')
        : next === 'failed'
          ? t('ui.retry_download')
          : manualMode
            ? t('ui.open_download_page')
            : t('ui.download_now');
  }
}


function setProgress(percent: number): void {
  const value: number = Math.max(0, Math.min(100, percent || 0));
  if (widget) widget.style.setProperty('--update-progress', String(value));
  if (progressFill) progressFill.style.width = value + '%';
}


export function initUpdateBadge(options: UpdateBadgeHandlers): void {
  handlers = options;

  if (widgetBtn) {
    widgetBtn.addEventListener('click', (e: MouseEvent): void => {
      e.stopPropagation();
      if (popover) popover.classList.toggle('hidden');
    });
  }

  if (popoverClose) {
    popoverClose.addEventListener('click', (e: MouseEvent): void => {
      e.stopPropagation();
      if (popover) popover.classList.add('hidden');
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', (): void => {
      if (mode === 'ready') {
        handlers.onInstall();
        return;
      }
      if (currentVersion) handlers.onDownload(currentVersion);
    });
  }

  document.addEventListener('click', (e: MouseEvent): void => {
    if (!widget || widget.classList.contains('hidden')) return;
    if (!widget.contains(e.target as Node) && popover) popover.classList.add('hidden');
  });
}


export function showUpdateBadge(version: string, title: string, logHtml: string): void {
  currentVersion = version;
  if (widget) widget.classList.remove('hidden');
  if (popoverVersion) popoverVersion.textContent = version || '';
  if (popoverTitle) {
    popoverTitle.innerHTML = title || '';
    popoverTitle.classList.toggle('hidden', !title);
  }
  if (popoverLog) {
    popoverLog.innerHTML = logHtml || '';
    popoverLog.classList.toggle('hidden', !logHtml);
  }
  if (mode !== 'downloading' && mode !== 'ready') applyMode('available');
}


export function setUpdateBadgeDownloading(percent: number = 0): void {
  applyMode('downloading');
  setProgress(percent);
  if (statusText) statusText.textContent = t('ui.downloading_in_the_background_percent', { percent: Math.round(percent) });
}


export function setUpdateBadgeProgress(percent: number): void {
  if (mode !== 'downloading') return;
  setProgress(percent);
  if (statusText) statusText.textContent = t('ui.downloading_in_the_background_percent', { percent: Math.round(percent || 0) });
}


export function setUpdateBadgeReady(): void {
  applyMode('ready');
  setProgress(100);
  if (statusText) statusText.textContent = t('ui.the_update_is_ready_and_will_install_when_the_launcher_exits_you_can_als_14bfac');
}


export function setUpdateBadgeFailed(message: string): void {
  applyMode('failed');
  if (statusText) statusText.textContent = message ? t('ui.download_failed_message_2', { message }) : t('ui.download_failed');
}


export function setUpdateBadgeAvailable(): void {
  applyMode('available');
}
