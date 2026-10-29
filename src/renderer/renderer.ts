/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


declare global {
  interface Window {
    Chart?: any;
    launchProgressInterval?: ReturnType<typeof setInterval> | null;
  }
}


// 各模块顶层都有「取 DOM 元素 + 挂事件」的接线代码，下面按副作用引入：
// 少一个模块，它那批界面交互就静默失效（编译和类型检查都不报错）。

// __IMPORTS_BEGIN__
import { applyI18n, docsUrl, observeI18n, setLocale, setSystemLocale, t } from '../i18n';
import { cancelDownloadBtn, detailDownloadBtn, downloadPanel, getCustomSelectValue, initCustomSelect, launchBtn, menuLaunch, setCustomSelectOptions, setCustomSelectValue, setStatus, showDialog, showToast, usernameInput } from './dom';
import { bindJavaInstallButtons, initJavaVersionStatus, saveJavaMirrorSettings, updateJavaInstallStatus } from './java-panel';
import { initBootSplash } from './boot-splash';
import { hasQueuedDownloads, hideLaunchAnimation, launchGame, launchTipFrequency, setLaunchTipFrequency } from './launch';
import { initLanguagePicker } from './language';
import { refreshGameMonitor } from './monitor';
import { currentPage, showPage, switchSettingsTab } from './nav';
import { playerHistory, setPlayerHistory } from './player';
import { applyScale, applyStyle, applyTheme, initScale, initTheme, loadSettings, updateSettingsBadge } from './settings';
import { allNewerVersions, autoDownloadUpdate, checkForUpdates, installReadyUpdate, isUpdateDownloadActive, renderUpdateVersionCards, showUpdateStartupNotice, startUpdateDownload, updateAvailable } from './update';
import { initUpdateBadge } from './update-badge';
import { bindModLoaderEvents, clearVersionSelection, loadRemoteVersions, loadVersions, renderVersionSelectList, selectedVersionId, selectedVersionRoot } from './versions';
import { initWelcome } from './welcome';

import './auth-panel';
import './chart';
import './dom';
import './java-panel';
import './launch';
import './mods';
import './monitor';
import './nav';
import './player';
import './session';
import './settings';
import './update';
import './versions';
import './avatar';
// __IMPORTS_END__

if (launchBtn) launchBtn.addEventListener('click', launchGame);

(async function init(): Promise<void> {
  let firstRun: boolean = false;
  const initial: any = (window.gpcl as any).initialI18n;
  const reloading: boolean = document.documentElement.classList.contains('gpcl-reloading');
  if (initial) {
    setSystemLocale(initial.systemLocale);
    setLocale(initial.locale);
    applyTheme(initial.theme);
    applyStyle(initial.style);
    applyScale(initial.scale);
    firstRun = Boolean(initial.firstRun);
  }
  applyI18n(document.body);
  observeI18n();
  initBootSplash(Boolean((initial && initial.skipSplash) || reloading));
  const licensePlaceholder: HTMLElement | null = document.getElementById('license-text');
  if (licensePlaceholder && licensePlaceholder.dataset.loaded !== '1') {
    licensePlaceholder.textContent = t('ui.loading_license');
  }
  const aboutHelpLink: HTMLElement | null = document.getElementById('about-help-link');
  if (aboutHelpLink) aboutHelpLink.setAttribute('href', docsUrl(''));
  const crashHelpLink: HTMLElement | null = document.getElementById('crash-dialog-help-link');
  if (crashHelpLink) {
    crashHelpLink.setAttribute('href', docsUrl('mc-game/'));
    crashHelpLink.textContent = docsUrl('mc-game/').replace(/^https:\/\//, '');
  }
  initLanguagePicker();

  setStatus(t('ui.loading_2'));
  initTheme();
  initScale();
  initWelcome(firstRun);
  if (menuLaunch) menuLaunch.classList.add('active');

  try {
    const restore: any = JSON.parse(sessionStorage.getItem('gpcl:restore') || 'null');
    sessionStorage.removeItem('gpcl:restore');
    if (restore && restore.page === 'settings') {
      showPage('settings', false);
      switchSettingsTab(restore.tab || 'game');
    }
  } catch (e) {}

  // <head> 里那套首帧规则只负责绘制前的状态，接管后交给正常逻辑
  document.documentElement.classList.remove('gpcl-boot-settings', 'gpcl-reloading', 'gpcl-skip-splash');

  if (usernameInput && window.gpcl && window.gpcl.getPlayerNames) {
    const names: any = await window.gpcl.getPlayerNames();
    if (names && names.name) usernameInput.value = names.name;
    if (names && Array.isArray(names.recent)) setPlayerHistory(names.recent);
  } else if (usernameInput && window.gpcl && window.gpcl.getPlayerName) {
    const savedName: string = await window.gpcl.getPlayerName();
    if (savedName) usernameInput.value = savedName;
  }

  await refreshGameMonitor();

  await loadVersions();
  await loadRemoteVersions();

  await renderVersionSelectList();

  await initJavaVersionStatus();
  bindJavaInstallButtons();

  bindModLoaderEvents();

  setInterval(async (): Promise<void> => {
    
    if (currentPage === 'launch') {
      await loadVersions(true);
      await renderVersionSelectList();
    }

    if (currentPage === 'download') {
      await refreshJavaStatus();
    }
  }, 2000);

  async function refreshJavaStatus(): Promise<void> {
    const javaVersions: string[] = ["8", "17", "21", "25"];
    
    for (const ver of javaVersions) {
      try {
        const result = await window.gpcl.checkJava(ver);
        const card: HTMLElement | null = document.querySelector(`.java-version-card[data-version="${ver}"]`) as HTMLElement | null;
        const badge: HTMLElement | null = document.getElementById(`java-${ver}-status`);
        const btn: HTMLElement | null = card?.querySelector('.java-install-btn') as HTMLElement | null;
        
        if (result.installed) {
          if (!card?.classList.contains('installed')) {
            if (card) card.classList.add('installed');
            if (badge) {
              badge.textContent = '已安装';
              badge.className = 'java-version-badge installed';
            }
            if (btn) {
              btn.textContent = '卸载';
              btn.classList.add('installed');
              (btn as HTMLButtonElement).disabled = false;
            }
          }
        } else {
          if (card?.classList.contains('installed')) {
            card.classList.remove('installed');
            if (badge) {
              badge.textContent = '';
              badge.className = 'java-version-badge';
            }
            if (btn) {
              btn.textContent = '安装';
              btn.classList.remove('installed');
              (btn as HTMLButtonElement).disabled = false;
            }
          }
        }
      } catch (e: any) {
        console.error(`检查Java ${ver} 状态失败`, e);
      }
    }
    
    updateJavaInstallStatus();
  }

  const refreshBtn: HTMLElement | null = document.getElementById('refresh-btn-page');
  if (refreshBtn) refreshBtn.addEventListener('click', async (): Promise<void> => {
    setStatus('重试加载远程版本...');
    await loadRemoteVersions();
    
    await refreshJavaStatus();
    setStatus('准备就绪');
  });

  if (cancelDownloadBtn) cancelDownloadBtn.addEventListener('click', async (): Promise<void> => {
    if (isUpdateDownloadActive) return;

    const result: boolean = await showDialog({
      type: 'confirm',
      title: '确认取消',
      message: '确定要取消当前下载吗？已下载的文件将被清理。'
    });

    if (result) {
      setStatus(t('ui.cancelling'));
      if (window.gpcl && window.gpcl.cancelDownloadOnly) {
        await window.gpcl.cancelDownloadOnly();
        if (!hasQueuedDownloads()) {
          if (downloadPanel) downloadPanel.classList.add('hidden');
          if (detailDownloadBtn) detailDownloadBtn.disabled = false;
          showToast('ui.cancelled', '下载已取消，文件已清理', 'info');
        } else {
          showToast('ui.current_task_cancelled', '队列里的任务会继续下载', 'info');
        }
      }
    }
  });

  setStatus('准备就绪');

  if (window.gpcl && window.gpcl.focusWindow) {
    setTimeout(() => {
      window.gpcl.focusWindow();
    }, 100);
  }

  const launchCancelBtn: HTMLElement | null = document.getElementById('launch-cancel-btn');
  if (launchCancelBtn) {
    launchCancelBtn.addEventListener('click', () => {
      setStatus('[动画] 用户取消启动');
      if (window.gpcl && window.gpcl.cancelLaunch) {
        window.gpcl.cancelLaunch();
      }
      hideLaunchAnimation();
    });
  }

  initUpdateBadge({
    onDownload: async (version: string): Promise<void> => {
      showPage('download');
      await startUpdateDownload(version);
    },
    onInstall: (): void => { installReadyUpdate(); }
  });

  (async (): Promise<void> => {
    await showUpdateStartupNotice();
    const settings = await loadSettings();
    if (settings.advanced?.autoCheckUpdate === false) return;
    await checkForUpdates(true);
    if (updateAvailable && allNewerVersions.length > 0 && settings.advanced?.autoUpdate !== false) {
      const newest = allNewerVersions[allNewerVersions.length - 1];
      await autoDownloadUpdate(newest.version);
    }
  })();

  const checkUpdateBtn: HTMLElement | null = document.getElementById('check-update-btn');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async (): Promise<void> => {
      checkUpdateBtn.disabled = true;
      checkUpdateBtn.textContent = '检查中...';
      
      await checkForUpdates(false);
      
      const updateStatus: HTMLElement | null = document.getElementById('update-status');
      const goDownloadBtnEl: HTMLElement | null = document.getElementById('go-download-btn');
      
      if (updateAvailable) {
        const newest = allNewerVersions[allNewerVersions.length - 1];
        checkUpdateBtn.textContent = t('ui.count_new_version_s_available', { count: allNewerVersions.length });
        checkUpdateBtn.classList.add('new-version');
        
        if (updateStatus) {
          updateStatus.innerHTML = `<div class="update-log-title">${t('ui.count_new_version_s_available_2', { count: allNewerVersions.length })}</div>${renderUpdateVersionCards(allNewerVersions)}`;
          updateStatus.classList.add('show', 'has-update');
        }
        
        if (goDownloadBtnEl) {
          goDownloadBtnEl.classList.remove('hidden');
        }
        const openWebsiteBtn: HTMLElement | null = document.getElementById('open-website-btn');
        if (openWebsiteBtn) {
          openWebsiteBtn.classList.remove('hidden');
        }
      } else {
        checkUpdateBtn.textContent = t('ui.up_to_date');
        checkUpdateBtn.classList.remove('new-version');
        
        if (updateStatus) {
          updateStatus.innerHTML = t('ui.you_re_on_the_latest_version');
          updateStatus.classList.add('show');
          updateStatus.classList.remove('has-update');
        }
        
        if (goDownloadBtnEl) {
          goDownloadBtnEl.classList.add('hidden');
        }
        const openWebsiteBtn2: HTMLElement | null = document.getElementById('open-website-btn');
        if (openWebsiteBtn2) {
          openWebsiteBtn2.classList.add('hidden');
        }
      }
      
      checkUpdateBtn.disabled = false;
    });
  }

  const goDownloadBtn: HTMLElement | null = document.getElementById('go-download-btn');

  const autoCheckUpdateEl: HTMLInputElement | null = document.getElementById('auto-check-update') as HTMLInputElement | null;
  const autoUpdateEl: HTMLInputElement | null = document.getElementById('auto-update') as HTMLInputElement | null;

  const preventMultipleLaunchEl: HTMLInputElement | null = document.getElementById('prevent-multiple-launch') as HTMLInputElement | null;

  const autoClearLogsEl: HTMLInputElement | null = document.getElementById('auto-clear-logs') as HTMLInputElement | null;
  const logRetentionContainerEl: HTMLElement | null = document.getElementById('log-retention-container');
  const logRetentionValueEl: HTMLInputElement | null = document.getElementById('log-retention-value') as HTMLInputElement | null;
  const logRetentionUnitEl: HTMLElement | null = document.getElementById('log-retention-unit');

  const customMirrorContainerEl: HTMLElement | null = document.getElementById('custom-java-mirror-container');
  const customMirrorUrlEl: HTMLInputElement | null = document.getElementById('custom-java-mirror-url') as HTMLInputElement | null;

  initCustomSelect('settings-window-mode', async (value: string): Promise<void> => {
    const settings = await loadSettings();
    if (!settings.game) settings.game = {} as any;
    settings.game.windowMode = value;
    await gpcl.saveSettings(settings);
  });

  initCustomSelect('settings-tip-frequency', async (value: string): Promise<void> => {
    setLaunchTipFrequency(value);
    const settings = await loadSettings();
    if (!settings.appearance) settings.appearance = {} as any;
    settings.appearance.tipFrequency = value;
    await gpcl.saveSettings(settings);
  });

  const windowTitleInput: HTMLInputElement | null = document.getElementById('settings-window-title') as HTMLInputElement | null;
  if (windowTitleInput) {
    windowTitleInput.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      if (!settings.game) settings.game = {} as any;
      const nextTitle: string = windowTitleInput.value.trim();
      settings.game.windowTitle = nextTitle;
      windowTitleInput.value = nextTitle;
      await gpcl.saveSettings(settings);
      if (nextTitle) {
        showToast('ui.saved', '新的窗口标题会在下次启动游戏时生效', 'success', 'window-title-saved');
      } else {
        showToast('ui.custom_title_disabled', '留空表示不修改游戏窗口标题', 'info', 'window-title-off');
      }
    });
  }

  const windowTitleHelp: HTMLElement | null = document.getElementById('window-title-help');
  if (windowTitleHelp) {
    windowTitleHelp.addEventListener('click', (e: Event): void => {
      e.preventDefault();
      if (window.gpcl && window.gpcl.openExternal) {
        window.gpcl.openExternal(docsUrl('magic-words/'));
      }
    });
  }

  initCustomSelect('settings-scale', async (value: string): Promise<void> => {
    const settings = await loadSettings();
    if (!settings.appearance) settings.appearance = {} as any;
    settings.appearance.scale = value;
    await gpcl.saveSettings(settings);
    applyScale(value);
  });

  initCustomSelect('java-mirror-select', async (value: string): Promise<void> => {
    if (customMirrorContainerEl) {
      customMirrorContainerEl.classList.toggle('hidden', value !== 'custom');
    }
    await saveJavaMirrorSettings(value, customMirrorUrlEl?.value || '');
  });

  initCustomSelect('log-retention-unit', async (unit: string): Promise<void> => {
    
    const maxValues: Record<string, number> = {
      hour: 23,
      day: 30,
      month: 11,
      year: 10
    };
    
    if (logRetentionValueEl) {
      let value: number = parseInt(logRetentionValueEl.value, 10);
      if (isNaN(value) || value < 1) value = 1;
      if (value > maxValues[unit]) {
        value = maxValues[unit];
        logRetentionValueEl.value = String(value);
      }
    }
    
    const settings = await loadSettings();
    settings.advanced.logRetentionUnit = unit;
    if (logRetentionValueEl) {
      settings.advanced.logRetentionValue = parseInt(logRetentionValueEl.value, 10);
    }
    await gpcl.saveSettings(settings);
  });

  if (goDownloadBtn) {
    goDownloadBtn.addEventListener('click', async (): Promise<void> => {
      if (updateAvailable && allNewerVersions.length > 0) {
        showPage('download');
        const newest = allNewerVersions[allNewerVersions.length - 1];
        await startUpdateDownload(newest.version);
      }
    });
  }

  const openWebsiteBtnEl: HTMLElement | null = document.getElementById('open-website-btn');
  if (openWebsiteBtnEl) {
    openWebsiteBtnEl.addEventListener('click', () => {
      if (window.gpcl && window.gpcl.openExternal) {
        window.gpcl.openExternal('https://gamets.caellab.com/gpcl/');
      }
    });
  }

  if (autoCheckUpdateEl) {
    
    (async (): Promise<void> => {
      const settings = await loadSettings();
      autoCheckUpdateEl.checked = settings.advanced?.autoCheckUpdate !== false;
    })();
    
    autoCheckUpdateEl.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      settings.advanced.autoCheckUpdate = autoCheckUpdateEl.checked;
      await gpcl.saveSettings(settings);
      updateSettingsBadge();
    });
  }

  if (autoUpdateEl) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      autoUpdateEl.checked = settings.advanced?.autoUpdate !== false;
    })();

    autoUpdateEl.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      settings.advanced.autoUpdate = autoUpdateEl.checked;
      await gpcl.saveSettings(settings);
    });
  }

  if (preventMultipleLaunchEl) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      preventMultipleLaunchEl.checked = settings.advanced?.preventMultipleLaunch !== false;
    })();

    preventMultipleLaunchEl.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      settings.advanced.preventMultipleLaunch = preventMultipleLaunchEl.checked;
      await gpcl.saveSettings(settings);
    });
  }

  const skipSplash: HTMLInputElement | null = document.getElementById('skip-splash') as HTMLInputElement | null;
  if (skipSplash) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      skipSplash.checked = settings.appearance?.skipSplash === true;
    })();

    skipSplash.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      if (!settings.appearance) settings.appearance = {} as any;
      settings.appearance.skipSplash = skipSplash.checked;
      await gpcl.saveSettings(settings);
    });
  }

  const developerMode: HTMLInputElement | null = document.getElementById('developer-mode') as HTMLInputElement | null;
  if (developerMode) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      developerMode.checked = settings.advanced?.developerMode === true;
    })();

    developerMode.addEventListener('change', async (): Promise<void> => {
      if (developerMode.checked) {
        const confirmed: boolean = await showDialog({
          type: 'confirm',
          title: '确认开启开发者模式',
          message: '确认要开启吗？开启后需要重启 GPCL 才能生效。开启开发者模式后将允许打开 DevTools、右键菜单及刷新页面。'
        });
        
        if (confirmed) {
          const settings = await loadSettings();
          settings.advanced.developerMode = true;
          await gpcl.saveSettings(settings);
          
          if (window.gpcl && window.gpcl.restartApp) {
            await window.gpcl.restartApp();
          } else {
            showToast('ui.restart_failed', '无法自动重启，请手动重启应用', 'error');
            developerMode.checked = false;
          }
        } else {
          developerMode.checked = false;
        }
      } else {
        const settings = await loadSettings();
        settings.advanced.developerMode = false;
        await gpcl.saveSettings(settings);
        if (window.gpcl && window.gpcl.setDeveloperMode) {
          await window.gpcl.setDeveloperMode(false);
        }
      }
    });
  }

  if (autoClearLogsEl) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      autoClearLogsEl.checked = settings.advanced?.autoClearLogs !== false;
    })();

    autoClearLogsEl.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      settings.advanced.autoClearLogs = autoClearLogsEl.checked;
      await gpcl.saveSettings(settings);
      
      if (logRetentionContainerEl) {
        logRetentionContainerEl.classList.toggle('hidden', !autoClearLogsEl.checked);
      }
    });
  }

  if (logRetentionValueEl) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      logRetentionValueEl.value = String(settings.advanced?.logRetentionValue || 7);
    })();

    logRetentionValueEl.addEventListener('change', async (): Promise<void> => {
      let value: number = parseInt(logRetentionValueEl.value, 10);
      const unit: string = getCustomSelectValue('log-retention-unit') || 'day';

      const maxValues: Record<string, number> = {
        hour: 23,
        day: 30,
        month: 11,
        year: 10
      };
      
      if (isNaN(value) || value < 1) {
        value = 1;
      } else if (value > maxValues[unit]) {
        value = maxValues[unit];
      }
      
      logRetentionValueEl.value = String(value);
      
      const settings = await loadSettings();
      settings.advanced.logRetentionValue = value;
      await gpcl.saveSettings(settings);
    });
  }

  if (customMirrorUrlEl) {
    customMirrorUrlEl.addEventListener('input', async (): Promise<void> => {
      await saveJavaMirrorSettings(getCustomSelectValue('java-mirror-select') || 'tsinghua', customMirrorUrlEl.value);
    });
  }

  (async (): Promise<void> => {
    const settings = await loadSettings();

    setCustomSelectValue('settings-window-mode', settings.game?.windowMode || 'windowed');

    const windowTitleSync: HTMLInputElement | null = document.getElementById('settings-window-title') as HTMLInputElement | null;
    if (windowTitleSync) {
      windowTitleSync.value = typeof settings.game?.windowTitle === 'string'
        ? settings.game.windowTitle
        : 'Minecraft {mc_version} (GPCL)';
    }

    setLaunchTipFrequency(settings.appearance?.tipFrequency || 'rare');
    setCustomSelectValue('settings-tip-frequency', launchTipFrequency);

    const scale: string = settings.appearance?.scale || '100';
    setCustomSelectValue('settings-scale', scale);
    applyScale(scale);

    const skipSplashSync: HTMLInputElement | null = document.getElementById('skip-splash') as HTMLInputElement | null;
    if (skipSplashSync) {
      skipSplashSync.checked = settings.appearance?.skipSplash === true;
    }

    // 华为云镜像的目录页已经改成 SPA，文件路径全 404，选项已去掉；老配置回落到清华
    const savedMirror: string = settings.download?.javaMirror || 'tsinghua';
    const javaMirror: string = savedMirror === 'nju' || savedMirror === 'custom' ? savedMirror : 'tsinghua';
    setCustomSelectValue('java-mirror-select', javaMirror);
    if (customMirrorContainerEl) {
      customMirrorContainerEl.classList.toggle('hidden', javaMirror !== 'custom');
    }
    if (customMirrorUrlEl && settings.download?.customJavaMirror) {
      customMirrorUrlEl.value = settings.download.customJavaMirror;
    }

    setCustomSelectValue('log-retention-unit', settings.advanced?.logRetentionUnit || 'day');
  })();

  (async (): Promise<void> => {
    const resetDefaultToggle: HTMLInputElement | null = document.getElementById('settings-reset-default') as HTMLInputElement | null;
    
    if (resetDefaultToggle) {
      resetDefaultToggle.checked = false; 
      
      resetDefaultToggle.addEventListener('change', async function(this: HTMLInputElement): Promise<void> {
        if (this.checked) {
          
          const confirmed: boolean = await showDialog({
            type: 'confirm',
            title: '恢复默认设置',
            message: '确定要将所有设置恢复为默认值吗？\n\n此操作会重启启动器。'
          });
          
          if (confirmed) {
            
            if (window.gpcl && window.gpcl.resetSettings) {
              const result = await window.gpcl.resetSettings();
              if (result.success) {
                
                if (window.gpcl && window.gpcl.restartApp) {
                  await window.gpcl.restartApp();
                }
              }
            }
          } else {
            
            this.checked = false;
          }
        }
      });
    }
  })();

  const settingsSidebarItems: NodeListOf<Element> = document.querySelectorAll('.settings-sidebar-item');
  settingsSidebarItems.forEach((item: Element) => {
    item.addEventListener('click', () => {
      const tabName: string | undefined = (item as HTMLElement).dataset.tab;
      if (tabName) {
        switchSettingsTab(tabName);
      }
    });
  });

  let currentVersionForSettings: string | null = null;
  let currentVersionRoot: string | null = null;
  let currentVersionInfo: any = null;
  let versionListWasOpen: boolean = false;
  
  const versionSettingsBtn: HTMLElement | null = document.getElementById('version-settings');
  const versionSelectBtn: HTMLElement | null = document.getElementById('version-select');
  const versionSettingsPanel: HTMLElement | null = document.getElementById('version-settings-panel');
  const versionSettingsBackBtn: HTMLElement | null = document.getElementById('version-settings-back-btn');
  const versionSettingsTitle: HTMLElement | null = document.getElementById('version-settings-title');
  const versionDeleteEnable: HTMLInputElement | null = document.getElementById('version-delete-enable') as HTMLInputElement | null;
  const versionServerIpContainer: HTMLElement | null = document.getElementById('version-server-ip-container');
  const versionServerIpInput: HTMLInputElement | null = document.getElementById('version-server-ip') as HTMLInputElement | null;
  const versionSelectPanel: HTMLElement | null = document.getElementById('version-select-panel');
  const statusElement: HTMLElement | null = document.getElementById('status');
  
  async function getVersionSettings(versionId: string, root?: string | null): Promise<any> {
    try {
      if (window.gpcl && window.gpcl.getVersionSettings) {
        const result = await window.gpcl.getVersionSettings(versionId, root || undefined);
        if (result.success && result.settings) {
          return result.settings;
        }
      }
    } catch (e: any) {
      console.error('获取版本设置失败:', e);
    }
    return {};
  }
  
  async function saveVersionSettings(versionId: string, settings: any, root?: string | null): Promise<boolean> {
    try {
      if (window.gpcl && window.gpcl.saveVersionSettings) {
        const result = await window.gpcl.saveVersionSettings(versionId, settings, root || undefined);
        return result.success;
      }
    } catch (e: any) {
      console.error('保存版本设置失败:', e);
    }
    return false;
  }

  function updateServerIpVisibility(): void {
    const startupMode: string | null = getCustomSelectValue('version-startup-mode');
    if (startupMode === 'join') {
      if (versionServerIpContainer) versionServerIpContainer.classList.add('visible');
    } else {
      if (versionServerIpContainer) versionServerIpContainer.classList.remove('visible');
    }
  }
  
  async function loadVersionSettingsToUI(versionId: string): Promise<void> {
    const settings = await getVersionSettings(versionId, currentVersionRoot);
    
    if (versionDeleteEnable) versionDeleteEnable.checked = false;
    setCustomSelectValue('version-memory', settings.memory || 'global');
    setCustomSelectValue('version-window-mode', settings.windowMode || 'global');
    setCustomSelectValue('version-startup-mode', settings.startupMode || 'default');
    const isolated: boolean = typeof settings.isolation === 'boolean'
      ? settings.isolation
      : currentVersionInfo?.isolated !== false;
    setCustomSelectValue('version-isolation', isolated ? 'on' : 'off');
    if (versionServerIpInput) versionServerIpInput.value = settings.serverIp || '';

    const runtimes: any[] = await window.gpcl.listJavaRuntimes().catch(() => []);
    const options: Array<{ value: string; label: string }> = [
      { value: 'auto', label: t('ui.java_auto') },
      ...runtimes.map((runtime: any) => ({
        value: String(runtime.major),
        label: runtime.custom
          ? t('ui.java_custom_option')
          : t('ui.java_version_option', { version: runtime.major })
      }))
    ];
    const selectedJava: string = String(settings.javaVersion || (settings.javaPath ? 'custom' : 'auto'));
    setCustomSelectOptions('version-java', options, options.some((option) => option.value === selectedJava) ? selectedJava : 'auto');
    if (settings.javaPath && selectedJava === 'auto') {
      setCustomSelectOptions('version-java', [...options, { value: 'custom', label: t('ui.java_custom_option') }], 'custom');
    }
    
    updateServerIpVisibility();
  }

  function collectVersionSettings(): any {
    return {
      memory: getCustomSelectValue('version-memory') || 'global',
      windowMode: getCustomSelectValue('version-window-mode') || 'global',
      startupMode: getCustomSelectValue('version-startup-mode') || 'default',
      serverIp: versionServerIpInput?.value || '',
      isolation: getCustomSelectValue('version-isolation') !== 'off',
      javaVersion: getCustomSelectValue('version-java') || 'auto'
    };
  }

  async function saveVersionSettingsNow(): Promise<boolean> {
    if (!currentVersionForSettings) return false;
    return saveVersionSettings(currentVersionForSettings, collectVersionSettings(), currentVersionRoot);
  }
  
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  function saveCurrentVersionSettings(): void {
    if (!currentVersionForSettings) return;
    
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async (): Promise<void> => {
      const success: boolean = await saveVersionSettingsNow();
      if (!success) {
        showToast('ui.save_failed', '无法保存版本设置', 'error');
      }
    }, 300);
  }
  
  async function refreshCurrentVersionInfo(): Promise<void> {
    if (!currentVersionForSettings) return;
    try {
      const infoResult: any = await window.gpcl.getVersionInfo(currentVersionForSettings, currentVersionRoot || undefined);
      if (infoResult?.success) currentVersionInfo = infoResult.info;
    } catch {}
    const modFolderItem: HTMLElement | null = document.getElementById('version-mod-folder-item');
    const shaderFolderItem: HTMLElement | null = document.getElementById('version-shader-folder-item');
    modFolderItem?.classList.toggle('hidden', !currentVersionInfo?.hasModLoader);
    shaderFolderItem?.classList.toggle('hidden', !currentVersionInfo?.hasOptiFine);
  }

  function setVersionListOpen(open: boolean): void {
    if (versionSelectPanel) versionSelectPanel.classList.toggle('hidden', !open);
  }
  
  async function showVersionSettingsPanel(versionId: string): Promise<void> {
    if (!versionSettingsPanel) return;
    
    currentVersionForSettings = versionId;
    currentVersionRoot = selectedVersionRoot;
    currentVersionInfo = null;
    if (versionSettingsTitle) versionSettingsTitle.textContent = t('ui.version_settings_version', { version: versionId });

    await refreshCurrentVersionInfo();
    
    versionListWasOpen = !!versionSelectPanel && !versionSelectPanel.classList.contains('hidden');
    if (versionSelectPanel) versionSelectPanel.classList.add('hidden');
    if (statusElement) statusElement.style.display = 'none';
    
    versionSettingsPanel.classList.remove('hidden');
    versionSettingsPanel.classList.remove('slide-out');
    
    await loadVersionSettingsToUI(versionId);
  }
  
  async function hideVersionSettingsPanel(options?: { save?: boolean; showVersionList?: boolean }): Promise<void> {
    if (!versionSettingsPanel) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    if (options?.save !== false) await saveVersionSettingsNow();
    
    versionSettingsPanel.classList.add('slide-out');
    
    setTimeout(() => {
      if (versionSettingsPanel) {
        versionSettingsPanel.classList.add('hidden');
        versionSettingsPanel.classList.remove('slide-out');
      }
      setVersionListOpen(options?.showVersionList ?? versionListWasOpen);
      if (statusElement) statusElement.style.display = '';
      currentVersionForSettings = null;
      currentVersionRoot = null;
      currentVersionInfo = null;
    }, 300);
  }
  
  if (versionSettingsBtn) {
    versionSettingsBtn.addEventListener('click', async (): Promise<void> => {
      if (selectedVersionId) {
        await showVersionSettingsPanel(selectedVersionId);
      } else {
        showToast('ui.no_version_selected', '请先选择一个版本', 'warning');
      }
    });
  }
  
  if (versionSettingsBackBtn) {
    versionSettingsBackBtn.addEventListener('click', async (): Promise<void> => {
      await hideVersionSettingsPanel();
    });
  }
  
  if (versionDeleteEnable) {
    versionDeleteEnable.addEventListener('change', async function(this: HTMLInputElement): Promise<void> {
      if (this.checked) {
        const deletedVersion: string | null = currentVersionForSettings;
        if (!deletedVersion) {
          this.checked = false;
          return;
        }

        const confirmed: boolean = await showDialog({
          type: 'confirm',
          title: '确认删除',
          message: t('ui.delete_version_name_this_cannot_be_undone', { name: deletedVersion })
        });
        
        if (confirmed) {
          if (window.gpcl && window.gpcl.deleteVersion) {
            try {
              const result = await window.gpcl.deleteVersion(deletedVersion, currentVersionRoot || undefined);
              if (result.success) {
                showToast('ui.deleted', t('ui.version_name_deleted', { name: deletedVersion }), 'success');

                // 已删除的版本不能再留在主界面，直接回到版本选择
                await hideVersionSettingsPanel({ save: false, showVersionList: true });
                if (selectedVersionId === deletedVersion) clearVersionSelection();
                await loadVersions(true);
                await renderVersionSelectList();
              } else {
                showToast('ui.delete_failed', result.error || '无法删除版本', 'error');
                this.checked = false;
              }
            } catch (e: any) {
              showToast('ui.delete_failed', e.message, 'error');
              this.checked = false;
            }
          }
        } else {
          this.checked = false;
        }
      }
    });
  }

  const openVersionFolder = async (kind: 'version' | 'mods' | 'shaders'): Promise<void> => {
    if (!currentVersionInfo) return;
    const target: string = kind === 'version'
      ? currentVersionInfo.versionDir
      : kind === 'mods'
        ? currentVersionInfo.modsDir
        : currentVersionInfo.shaderpacksDir;
    if (target) await window.gpcl.openFolder(target);
  };

  const versionOpenFolderBtn: HTMLElement | null = document.getElementById('version-open-folder-btn');
  if (versionOpenFolderBtn) versionOpenFolderBtn.addEventListener('click', () => void openVersionFolder('version'));

  const versionOpenModsBtn: HTMLElement | null = document.getElementById('version-open-mods-btn');
  if (versionOpenModsBtn) versionOpenModsBtn.addEventListener('click', () => void openVersionFolder('mods'));

  const versionOpenShadersBtn: HTMLElement | null = document.getElementById('version-open-shaders-btn');
  if (versionOpenShadersBtn) versionOpenShadersBtn.addEventListener('click', () => void openVersionFolder('shaders'));

  initCustomSelect('version-memory', () => {
    saveCurrentVersionSettings();
  });
  
  initCustomSelect('version-window-mode', () => {
    saveCurrentVersionSettings();
  });

  initCustomSelect('version-java', () => {
    saveCurrentVersionSettings();
  });
  
  initCustomSelect('version-startup-mode', () => {
    const joinMode: boolean = getCustomSelectValue('version-startup-mode') === 'join';
    updateServerIpVisibility();
    if (joinMode && versionServerIpContainer) {
      versionServerIpContainer.scrollIntoView({ block: 'nearest' });
    }
    saveCurrentVersionSettings();
  });

  initCustomSelect('version-isolation', async (): Promise<void> => {
    const success: boolean = await saveVersionSettingsNow();
    if (!success) {
      showToast('ui.save_failed', '无法保存版本设置', 'error');
      return;
    }
    await refreshCurrentVersionInfo();
  });

  if (versionServerIpInput) {
    versionServerIpInput.addEventListener('input', () => {
      saveCurrentVersionSettings();
    });
  }

  if (versionSelectBtn) {
    versionSelectBtn.addEventListener('click', () => {
      if (versionSettingsPanel && !versionSettingsPanel.classList.contains('hidden')) return;
      const willOpen: boolean = !versionSelectPanel || versionSelectPanel.classList.contains('hidden');
      setVersionListOpen(willOpen);
      if (willOpen) void renderVersionSelectList();
    });
  }

})();

