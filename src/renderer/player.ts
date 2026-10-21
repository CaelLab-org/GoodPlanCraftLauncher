/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { icon, placeDropdown, usernameHistory, usernameHistoryBtn, usernameInput } from './dom';
// __IMPORTS_END__

export let playerHistory: string[] = [];


export function renderUsernameHistory(): void {
  if (!usernameHistory) return;
  usernameHistory.innerHTML = '';

  if (!playerHistory.length) {
    const empty: HTMLDivElement = document.createElement('div');
    empty.className = 'username-history-empty';
    empty.textContent = '还没有用过的名字';
    usernameHistory.appendChild(empty);
    return;
  }

  playerHistory.forEach((name: string): void => {
    const item: HTMLDivElement = document.createElement('div');
    item.className = 'username-history-item';

    const label: HTMLSpanElement = document.createElement('span');
    label.className = 'username-history-name';
    label.textContent = name;

    const remove: HTMLButtonElement = document.createElement('button');
    remove.className = 'username-history-remove';
    remove.type = 'button';
    remove.title = '从列表删除';
    remove.innerHTML = icon('close');

    item.appendChild(label);
    item.appendChild(remove);
    item.addEventListener('click', (): void => {
      if (usernameInput) usernameInput.value = name;
      closeUsernameHistory();
    });
    remove.addEventListener('click', async (e: Event): Promise<void> => {
      e.stopPropagation();
      if (!window.gpcl || !window.gpcl.deletePlayerName) return;
      const result: any = await window.gpcl.deletePlayerName(name);
      if (result && Array.isArray(result.recent)) {
        playerHistory = result.recent;
        renderUsernameHistory();
      }
    });

    usernameHistory.appendChild(item);
  });
}


export function openUsernameHistory(): void {
  if (!usernameHistory) return;
  renderUsernameHistory();
  usernameHistory.classList.remove('hidden');
  placeDropdown(usernameHistory, usernameHistoryBtn || usernameHistory);
  if (usernameHistoryBtn) usernameHistoryBtn.classList.add('open');
}


export function closeUsernameHistory(): void {
  if (usernameHistory) usernameHistory.classList.add('hidden');
  if (usernameHistoryBtn) usernameHistoryBtn.classList.remove('open');
}


if (usernameHistoryBtn) {
  usernameHistoryBtn.addEventListener('click', (e: Event): void => {
    e.stopPropagation();
    if (usernameHistory && usernameHistory.classList.contains('hidden')) openUsernameHistory();
    else closeUsernameHistory();
  });
}


document.addEventListener('click', (e: Event): void => {
  if (usernameHistory && !usernameHistory.classList.contains('hidden')) {
    const target: Node = e.target as Node;
    if (usernameHistoryBtn && usernameHistoryBtn.contains(target)) return;
    if (usernameHistory.contains(target)) return;
    closeUsernameHistory();
  }
});

/** 跨模块写入用：playerHistory 归本模块所有，其它模块只能经此写入 */
export function setPlayerHistory(value: string[]): void { playerHistory = value; }
