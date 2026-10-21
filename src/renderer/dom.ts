/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
// __IMPORTS_END__

export const usernameInput: HTMLInputElement | null = document.getElementById('username') as HTMLInputElement | null;

export const versionSelect: HTMLSelectElement | null = document.getElementById('version') as HTMLSelectElement | null;

export const launchBtn: HTMLElement | null = document.getElementById('launch-btn');

export const statusDiv: HTMLElement | null = document.getElementById('status');


export const cancelDownloadBtn: HTMLElement | null = document.getElementById('cancel-download-btn');

export const downloadBtn: HTMLElement | null = document.getElementById('download-btn-page');

export const versionListContainer: HTMLElement | null = document.getElementById('version-list-container');

export const versionListSection: HTMLElement | null = document.getElementById('version-list-section');

export const versionDetailPage: HTMLElement | null = document.getElementById('version-detail-page');

export const detailBackBtn: HTMLElement | null = document.getElementById('detail-back-btn');

export const detailDownloadBtn: HTMLButtonElement | null = document.getElementById('detail-download-btn') as HTMLButtonElement | null;

export const versionCountLabel: HTMLElement | null = document.getElementById('version-count-label');


export const menuDownload: HTMLElement | null = document.getElementById('menu-download');

export const menuLaunch: HTMLElement | null = document.getElementById('menu-launch');

export const menuSettings: HTMLElement | null = document.getElementById('menu-settings');

export const menuMore: HTMLElement | null = document.getElementById('menu-more');

export const downloadPage: HTMLElement | null = document.getElementById('download-page');

export const launchPanel: HTMLElement | null = document.getElementById('launch-panel');

export const settingsPage: HTMLElement | null = document.getElementById('settings-page');

export const morePage: HTMLElement | null = document.getElementById('more-page');

export const mainContent: Element | null = document.querySelector('.main-content .container');


export const minimizeBtn: HTMLElement | null = document.getElementById('minimize-btn');

export const closeBtn: HTMLElement | null = document.getElementById('close-btn');


export const toastContainer: HTMLElement | null = document.getElementById('toast-container');

export const toastHistory: Map<string, number> = new Map();

export const TOAST_DEDUP_MS: number = 3000;


export const dialogOverlay: HTMLElement | null = document.getElementById('dialog-overlay');

export const dialogIcon: HTMLElement | null = document.getElementById('dialog-icon');

export const dialogTitle: HTMLElement | null = document.getElementById('dialog-title');

export const dialogMessage: HTMLElement | null = document.getElementById('dialog-message');

export const dialogFooterSingle: HTMLElement | null = document.getElementById('dialog-footer-single');

export const dialogFooterConfirm: HTMLElement | null = document.getElementById('dialog-footer-confirm');

export const dialogBtnOk: HTMLElement | null = document.getElementById('dialog-btn-ok');

export const dialogBtnYes: HTMLElement | null = document.getElementById('dialog-btn-yes');

export const dialogBtnCancel: HTMLElement | null = document.getElementById('dialog-btn-cancel');


export const usernameHistoryBtn: HTMLElement | null = document.getElementById('username-history-btn');

export const usernameHistory: HTMLElement | null = document.getElementById('username-history');


export const gameMonitor: HTMLElement | null = document.getElementById('game-monitor');

export const gameMonitorDot: HTMLElement | null = document.getElementById('game-monitor-dot');

export const gameMonitorState: HTMLElement | null = document.getElementById('game-monitor-state');

export const gameMonitorVersion: HTMLElement | null = document.getElementById('game-monitor-version');

export const gameMonitorPid: HTMLElement | null = document.getElementById('game-monitor-pid');

export const gameMonitorUptime: HTMLElement | null = document.getElementById('game-monitor-uptime');

export const gameMonitorMemory: HTMLElement | null = document.getElementById('game-monitor-memory');

export const gameMonitorLogBtn: HTMLElement | null = document.getElementById('game-monitor-log-btn');

export const gameMonitorStopBtn: HTMLElement | null = document.getElementById('game-monitor-stop-btn');


export const crashDialogOverlay: HTMLElement | null = document.getElementById('crash-dialog-overlay');

export const crashDialogAnalysis: HTMLElement | null = document.getElementById('crash-dialog-analysis');

export const crashDialogOk: HTMLElement | null = document.getElementById('crash-dialog-ok');

export const crashDialogLog: HTMLElement | null = document.getElementById('crash-dialog-log');

export const crashDialogExport: HTMLElement | null = document.getElementById('crash-dialog-export');

export const crashDialogDetail: HTMLElement | null = document.getElementById('crash-dialog-detail');

export const crashDialogHelpLink: HTMLElement | null = document.getElementById('crash-dialog-help-link');


export let dialogResolve: ((value: boolean) => void) | null = null;


export function showDialog(options: { type?: string; title?: string; message?: string; confirmText?: string; cancelText?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    dialogResolve = resolve;

    const icons: Record<string, string> = {
      info: 'info',
      warning: 'alert',
      error: 'x-circle',
      question: 'question'
    };

    if (dialogIcon) dialogIcon.innerHTML = icon(icons[options.type || ''] || icons.info);
    if (dialogTitle) dialogTitle.textContent = options.title || '提示';
    if (dialogMessage) dialogMessage.textContent = options.message || '';

    if (options.type === 'confirm' || options.type) {
      if (dialogFooterSingle) dialogFooterSingle.classList.add('hidden');
      if (dialogFooterConfirm) dialogFooterConfirm.classList.remove('hidden');
      if (dialogBtnYes && options.confirmText) dialogBtnYes.textContent = options.confirmText;
      else if (dialogBtnYes) dialogBtnYes.textContent = '是';
      if (dialogBtnCancel && options.cancelText) dialogBtnCancel.textContent = options.cancelText;
      else if (dialogBtnCancel) dialogBtnCancel.textContent = '否';
    } else {
      if (dialogFooterSingle) dialogFooterSingle.classList.remove('hidden');
      if (dialogFooterConfirm) dialogFooterConfirm.classList.add('hidden');
    }

    if (dialogOverlay) dialogOverlay.classList.remove('hidden');
  });
}


export function hideDialog(): void {
  if (dialogOverlay) dialogOverlay.classList.add('hidden');
  dialogResolve = null;
}


if (dialogBtnOk) {
  dialogBtnOk.addEventListener('click', () => {
    if (dialogResolve) dialogResolve(true);
    hideDialog();
  });
}


if (dialogBtnYes) {
  dialogBtnYes.addEventListener('click', () => {
    if (dialogResolve) dialogResolve(true);
    hideDialog();
  });
}


if (dialogBtnCancel) {
  dialogBtnCancel.addEventListener('click', () => {
    if (dialogResolve) dialogResolve(false);
    hideDialog();
  });
}
/**
 * 图标一律用 renderer/icons/*.svg 里的独立文件，靠 CSS mask 跟随 currentColor
 * （跟站群那套一致，不在代码里硬写 svg 路径）。
 */

export function icon(name: string, extraClass?: string): string {
  return `<span class="icon icon-${name}${extraClass ? ' ' + extraClass : ''}"></span>`;
}


export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 下拉面板方向修正：默认向下展开，下面空间不够就翻到上面。
 * 这些面板都是 absolute 定位在各种 overflow 容器里，不翻的话会被直接裁掉。
 */

export function placeDropdown(dropdown: HTMLElement, anchor: HTMLElement): void {
  dropdown.classList.remove('open-up');
  const anchorRect: DOMRect = anchor.getBoundingClientRect();
  const dropHeight: number = dropdown.offsetHeight || dropdown.scrollHeight;
  const spaceBelow: number = window.innerHeight - anchorRect.bottom;
  const spaceAbove: number = anchorRect.top;
  if (spaceBelow < dropHeight + 16 && spaceAbove > spaceBelow) {
    dropdown.classList.add('open-up');
  }
}


if (window.gpcl && window.gpcl.onConfirmCloseWhileDownloading) {
  window.gpcl.onConfirmCloseWhileDownloading(async (): Promise<void> => {
    const result: boolean = await showDialog({
      type: 'confirm',
      title: '确认关闭',
      message: '当前正在下载中，关闭会停止下载并清理已下载的文件。确定要关闭吗？'
    });

    if (result) {
      
      if (window.gpcl && window.gpcl.confirmCloseDownload) {
        await window.gpcl.confirmCloseDownload();
      }
    } else {
      
      if (window.gpcl && window.gpcl.cancelClose) {
        await window.gpcl.cancelClose();
      }
    }
  });
}


export function showToast(title: string, message?: string, type: string = 'info', key?: string | null): void {
  if (!toastContainer) return;
  if (key) {
    const last: number | undefined = toastHistory.get(key);
    if (last && Date.now() - last < TOAST_DEDUP_MS) return;
    toastHistory.set(key, Date.now());
  }
  const icons: Record<string, string> = { success: 'check-circle', error: 'x-circle', warning: 'alert', info: 'info' };
  const toast: HTMLDivElement = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icon(icons[type] || icons.info)}</span>
    <div style="flex:1">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="关闭">${icon('close')}</button>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}


export const downloadPanel: HTMLElement | null = document.getElementById('download-panel');


export const memoryOptimizeBtn: HTMLElement | null = document.getElementById('memory-optimize-btn');

export const customSelectHandlers: Map<string, { setValue: (value: string, label?: string) => void; getValue: () => string | null }> = new Map();


export function initCustomSelect(selectId: string, onChangeCallback?: (value: string) => void): void {
  const selectContainer: HTMLElement | null = document.querySelector(`.custom-select[data-select-id="${selectId}"]`) as HTMLElement | null;
  if (!selectContainer) return;

  const trigger: HTMLElement | null = selectContainer.querySelector('.custom-select-trigger');
  const dropdown: HTMLElement | null = selectContainer.querySelector('.custom-select-dropdown');
  const valueSpan: HTMLElement | null = selectContainer.querySelector('.custom-select-value');
  const options: NodeListOf<Element> = selectContainer.querySelectorAll('.custom-select-option');

  let currentValue: string | null = null;
  options.forEach((option: Element) => {
    if (option.classList.contains('selected')) {
      currentValue = (option as HTMLElement).dataset.value || null;
    }
  });

  trigger?.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (!dropdown) return;
    const isOpen: boolean = dropdown.classList.contains('open');
    closeAllCustomSelects();
    if (!isOpen) {
      dropdown.classList.add('open');
      trigger.classList.add('active');
      placeDropdown(dropdown, trigger);
    }
  });

  options.forEach((option: Element) => {
    option.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      if (option.classList.contains('disabled')) return;

      const value: string | undefined = (option as HTMLElement).dataset.value;
      const label: string | null = option.textContent;

      options.forEach((opt: Element) => opt.classList.remove('selected'));
      option.classList.add('selected');
      if (valueSpan) valueSpan.textContent = label;
      currentValue = value || null;

      closeAllCustomSelects();

      if (onChangeCallback && value) {
        onChangeCallback(value);
      }
    });
  });

  customSelectHandlers.set(selectId, {
    setValue: (value: string, label?: string) => {
      options.forEach((opt: Element) => opt.classList.remove('selected'));
      const targetOpt: Element | null = selectContainer.querySelector(`.custom-select-option[data-value="${value}"]`);
      if (targetOpt) {
        targetOpt.classList.add('selected');
        if (valueSpan) valueSpan.textContent = targetOpt.textContent;
        currentValue = value;
      } else if (label) {
        if (valueSpan) valueSpan.textContent = label;
        currentValue = value;
      }
    },
    getValue: () => currentValue
  });
}


export function closeAllCustomSelects(): void {
  document.querySelectorAll('.custom-select-dropdown').forEach((d: Element) => d.classList.remove('open'));
  document.querySelectorAll('.custom-select-trigger').forEach((t: Element) => t.classList.remove('active'));
}


document.addEventListener('click', closeAllCustomSelects);


export function setCustomSelectValue(selectId: string, value: string, label?: string): void {
  const handler = customSelectHandlers.get(selectId);
  if (handler) {
    handler.setValue(value, label);
  }
}


export function getCustomSelectValue(selectId: string): string | null {
  const handler = customSelectHandlers.get(selectId);
  return handler ? handler.getValue() : null;
}


export function showFloatNotification(title: string, text: string): void {
  const notification: HTMLElement | null = document.getElementById('float-notification');
  const titleEl: HTMLElement | null = document.getElementById('float-notification-title');
  const textEl: HTMLElement | null = document.getElementById('float-notification-text');
  
  if (notification && titleEl && textEl) {
    titleEl.textContent = title;
    textEl.textContent = text;

    const progressFill: HTMLElement | null = document.getElementById('float-progress-fill');
    const progressText: HTMLElement | null = document.getElementById('float-progress-text');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    
    notification.classList.remove('hidden');
  }
}


export function hideFloatNotification(): void {
  const notification: HTMLElement | null = document.getElementById('float-notification');
  if (notification) {
    notification.classList.add('hidden');
  }
}


export const floatCloseBtn: HTMLElement | null = document.getElementById('float-notification-close');

if (floatCloseBtn) {
  floatCloseBtn.addEventListener('click', hideFloatNotification);
}


export const settingsNumInput: HTMLInputElement | null = document.getElementById('num-threads') as HTMLInputElement | null;

export const enableMoreEl: HTMLInputElement | null = document.getElementById('enable-more') as HTMLInputElement | null;

export function setStatus(text: string, type: string = 'info'): void {
  if (statusDiv) statusDiv.textContent = text;
  if (statusDiv) statusDiv.style.color =
    type === 'error' ? '#ef5350' :
    type === 'success' ? '#66bb6a' :
    '#e0e0e0';
}

