/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { closeBtn, downloadPage, launchPanel, menuDownload, menuLaunch, menuMore, menuSettings, minimizeBtn, morePage, settingsPage } from './dom';
// __IMPORTS_END__

export let currentPage: string = 'launch';

export function animatePageIn(page: HTMLElement | null): void {
  if (!page) return;
  page.classList.remove('page-enter');
  void page.offsetWidth;
  page.classList.add('page-enter');
}


export function showPage(name: string): void {
  currentPage = name;

  if (name === 'download') {
    if (downloadPage) downloadPage.classList.remove('hidden');
    if (launchPanel) launchPanel.classList.add('hidden');
    if (settingsPage) settingsPage.classList.add('hidden');
    if (morePage) morePage.classList.add('hidden');
    animatePageIn(downloadPage);
  } else if (name === 'launch') {
    if (downloadPage) downloadPage.classList.add('hidden');
    if (launchPanel) launchPanel.classList.remove('hidden');
    if (settingsPage) settingsPage.classList.add('hidden');
    if (morePage) morePage.classList.add('hidden');
    animatePageIn(launchPanel);
  } else if (name === 'settings') {
    if (downloadPage) downloadPage.classList.add('hidden');
    if (launchPanel) launchPanel.classList.add('hidden');
    if (settingsPage) settingsPage.classList.remove('hidden');
    if (morePage) morePage.classList.add('hidden');
    switchSettingsTab('game');
    animatePageIn(settingsPage);
  } else if (name === 'more') {
    if (downloadPage) downloadPage.classList.add('hidden');
    if (launchPanel) launchPanel.classList.add('hidden');
    if (settingsPage) settingsPage.classList.add('hidden');
    if (morePage) morePage.classList.remove('hidden');
    switchMoreTab('toolbox');
    animatePageIn(morePage);
  }

  if (menuDownload) menuDownload.classList.toggle('active', name === 'download');
  if (menuLaunch) menuLaunch.classList.toggle('active', name === 'launch');
  if (menuSettings) menuSettings.classList.toggle('active', name === 'settings');
  if (menuMore) menuMore.classList.toggle('active', name === 'more');
}


export function switchSettingsTab(tabName: string): void {
  const sidebarItems: NodeListOf<Element> = document.querySelectorAll('#settings-sidebar .settings-sidebar-item');
  const contentPanels: NodeListOf<Element> = document.querySelectorAll('#settings-page .settings-content-panel');

  sidebarItems.forEach((item: Element) => {
    item.classList.toggle('active', (item as HTMLElement).dataset.tab === tabName);
  });

  contentPanels.forEach((panel: Element) => {
    panel.classList.toggle('active', panel.id === `settings-content-${tabName}`);
    panel.classList.toggle('hidden', panel.id !== `settings-content-${tabName}`);
  });
}


export function updateMenuActive(pageName: string): void {
  if (menuDownload) menuDownload.classList.toggle('active', pageName === 'download');
  if (menuLaunch) menuLaunch.classList.toggle('active', pageName === 'launch');
  if (menuSettings) menuSettings.classList.toggle('active', pageName === 'settings');
  if (menuMore) menuMore.classList.toggle('active', pageName === 'more');
}


if (menuDownload) menuDownload.addEventListener('click', () => showPage('download'));

if (menuLaunch) menuLaunch.addEventListener('click', () => showPage('launch'));

if (menuSettings) menuSettings.addEventListener('click', () => showPage('settings'));

if (menuMore) menuMore.addEventListener('click', () => showPage('more'));


document.querySelectorAll('#more-sidebar .settings-sidebar-item').forEach((item: Element) => {
  item.addEventListener('click', () => {
    const tabName: string | undefined = (item as HTMLElement).dataset.tab;
    switchMoreTab(tabName!);
  });
});


export function switchMoreTab(tabName: string): void {
  const sidebarItems: NodeListOf<Element> = document.querySelectorAll('#more-sidebar .settings-sidebar-item');
  const contentPanels: NodeListOf<Element> = document.querySelectorAll('#more-page .settings-content-panel');
  const morePageEl: HTMLElement | null = document.getElementById('more-page');
  const forumIframe: HTMLIFrameElement | null = document.getElementById('forum-iframe') as HTMLIFrameElement | null;

  sidebarItems.forEach((item: Element) => {
    item.classList.toggle('active', (item as HTMLElement).dataset.tab === tabName);
  });

  contentPanels.forEach((panel: Element) => {
    const isForum: boolean = panel.id === `more-content-${tabName}` && tabName === 'forum';
    panel.classList.toggle('active', panel.id === `more-content-${tabName}`);
    panel.classList.toggle('hidden', panel.id !== `more-content-${tabName}`);
    
    if (isForum) {
      if (forumIframe && !forumIframe.src) {
        forumIframe.src = 'https://forum.xmuer.online/?sort=newest';
      }
      if (morePageEl) morePageEl.classList.add('forum-mode');
      updateForumIframeSize();
    } else {
      if (morePageEl) morePageEl.classList.remove('forum-mode');
    }
  });
}


export function updateForumIframeSize(): void {
  const forumIframe: HTMLIFrameElement | null = document.getElementById('forum-iframe') as HTMLIFrameElement | null;
  const morePageEl: HTMLElement | null = document.getElementById('more-page');
  
  if (forumIframe && morePageEl && morePageEl.classList.contains('forum-mode')) {
    forumIframe.style.width = '100%';
    forumIframe.style.height = '100%';
  }
}


window.addEventListener('resize', updateForumIframeSize);


if (minimizeBtn) minimizeBtn.addEventListener('click', () => { if (window.gpcl && window.gpcl.minimizeWindow) window.gpcl.minimizeWindow(); });

if (closeBtn) closeBtn.addEventListener('click', () => { 
  if (window.gpcl && typeof window.gpcl.closeWindow === 'function') {
    window.gpcl.closeWindow();
  } else {
    
    window.close();
  }
});

