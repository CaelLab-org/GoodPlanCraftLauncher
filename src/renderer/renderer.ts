/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
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
import { cancelDownloadBtn, detailDownloadBtn, downloadPanel, getCustomSelectValue, initCustomSelect, launchBtn, menuLaunch, setCustomSelectValue, setStatus, showDialog, showToast, usernameHistoryBtn, usernameInput } from './dom';
import { bindJavaInstallButtons, initJavaVersionStatus, saveJavaMirrorSettings, updateJavaInstallStatus } from './java-panel';
import { hideLaunchAnimation, launchGame, launchTipFrequency, setLaunchTipFrequency } from './launch';
import { refreshGameMonitor } from './monitor';
import { currentPage, showPage, switchSettingsTab } from './nav';
import { closeUsernameHistory, playerHistory, setPlayerHistory } from './player';
import { msAuthData, setMsAuthData } from './session';
import { applyScale, initScale, initTheme, loadSettings, updateSettingsBadge } from './settings';
import { allNewerVersions, checkForUpdates, isUpdateDownloadActive, renderUpdateVersionCards, startUpdateDownload, updateAvailable } from './update';
import { bindModLoaderEvents, loadRemoteVersions, loadVersions, renderVersionSelectList, selectedVersionId } from './versions';

import './chart';
import './dom';
import './java-panel';
import './launch';
import './monitor';
import './nav';
import './player';
import './session';
import './settings';
import './update';
import './versions';
// __IMPORTS_END__

if (launchBtn) launchBtn.addEventListener('click', launchGame);

(async function init(): Promise<void> {
  setStatus('正在加载...');
  initTheme();
  initScale();
  if (menuLaunch) menuLaunch.classList.add('active');

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
      if (window.gpcl && window.gpcl.cancelDownloadOnly) {
        await window.gpcl.cancelDownloadOnly();
        if (downloadPanel) downloadPanel.classList.add('hidden');
        if (detailDownloadBtn) detailDownloadBtn.disabled = false;
        showToast('已取消', '下载已取消，文件已清理', 'info');
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

  checkForUpdates(true);

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
        checkUpdateBtn.textContent = `发现 ${allNewerVersions.length} 个新版本`;
        checkUpdateBtn.classList.add('new-version');
        
        if (updateStatus) {
          updateStatus.innerHTML = `<div class="update-log-title">发现 ${allNewerVersions.length} 个新版本！</div>${renderUpdateVersionCards(allNewerVersions)}`;
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
        checkUpdateBtn.textContent = '已是最新版本';
        checkUpdateBtn.classList.remove('new-version');
        
        if (updateStatus) {
          updateStatus.innerHTML = '当前已是最新版本';
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
        showToast('已保存', '新的窗口标题会在下次启动游戏时生效', 'success', 'window-title-saved');
      } else {
        showToast('已关闭自定义标题', '留空表示不修改游戏窗口标题', 'info', 'window-title-off');
      }
    });
  }

  const windowTitleHelp: HTMLElement | null = document.getElementById('window-title-help');
  if (windowTitleHelp) {
    windowTitleHelp.addEventListener('click', (e: Event): void => {
      e.preventDefault();
      if (window.gpcl && window.gpcl.openExternal) {
        window.gpcl.openExternal('https://gamets.caellab.com/gpcl/help/magic-words/');
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

  const playStartupAnimation: HTMLInputElement | null = document.getElementById('play-startup-animation') as HTMLInputElement | null;
  if (playStartupAnimation) {
    (async (): Promise<void> => {
      const settings = await loadSettings();
      playStartupAnimation.checked = settings.appearance?.playStartupAnimation === true;
    })();

    playStartupAnimation.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      if (!settings.appearance) settings.appearance = {} as any;
      settings.appearance.playStartupAnimation = playStartupAnimation.checked;
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
            showToast('重启失败', '无法自动重启，请手动重启应用', 'error');
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

    const playStartupAnimSync: HTMLInputElement | null = document.getElementById('play-startup-animation') as HTMLInputElement | null;
    if (playStartupAnimSync) {
      playStartupAnimSync.checked = settings.appearance?.playStartupAnimation === true;
    }

    const skipSplashSync: HTMLInputElement | null = document.getElementById('skip-splash') as HTMLInputElement | null;
    if (skipSplashSync) {
      skipSplashSync.checked = settings.appearance?.skipSplash === true;
    }

    const javaMirror: string = settings.download?.javaMirror || 'tsinghua';
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
  
  const versionSettingsBtn: HTMLElement | null = document.getElementById('version-settings');
  const versionSettingsPanel: HTMLElement | null = document.getElementById('version-settings-panel');
  const versionSettingsBackBtn: HTMLElement | null = document.getElementById('version-settings-back-btn');
  const versionSettingsTitle: HTMLElement | null = document.getElementById('version-settings-title');
  const versionDeleteEnable: HTMLInputElement | null = document.getElementById('version-delete-enable') as HTMLInputElement | null;
  const versionServerIpContainer: HTMLElement | null = document.getElementById('version-server-ip-container');
  const versionServerIpInput: HTMLInputElement | null = document.getElementById('version-server-ip') as HTMLInputElement | null;
  const versionSelectPanel: HTMLElement | null = document.getElementById('version-select-panel');
  const statusElement: HTMLElement | null = document.getElementById('status');
  
  async function getVersionSettings(versionId: string): Promise<any> {
    try {
      if (window.gpcl && window.gpcl.getVersionSettings) {
        const result = await window.gpcl.getVersionSettings(versionId);
        if (result.success && result.settings) {
          return result.settings;
        }
      }
    } catch (e: any) {
      console.error('获取版本设置失败:', e);
    }
    return {};
  }
  
  async function saveVersionSettings(versionId: string, settings: any): Promise<boolean> {
    try {
      if (window.gpcl && window.gpcl.saveVersionSettings) {
        const result = await window.gpcl.saveVersionSettings(versionId, settings);
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
    const settings = await getVersionSettings(versionId);
    
    if (versionDeleteEnable) versionDeleteEnable.checked = false;
    setCustomSelectValue('version-memory', settings.memory || 'global');
    setCustomSelectValue('version-window-mode', settings.windowMode || 'global');
    setCustomSelectValue('version-startup-mode', settings.startupMode || 'default');
    if (versionServerIpInput) versionServerIpInput.value = settings.serverIp || '';
    
    updateServerIpVisibility();
  }
  
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  function saveCurrentVersionSettings(): void {
    if (!currentVersionForSettings) return;
    
    const settings = {
      memory: getCustomSelectValue('version-memory') || 'global',
      windowMode: getCustomSelectValue('version-window-mode') || 'global',
      startupMode: getCustomSelectValue('version-startup-mode') || 'default',
      serverIp: versionServerIpInput?.value || ''
    };
    
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async (): Promise<void> => {
      const success: boolean = await saveVersionSettings(currentVersionForSettings!, settings);
      if (success) {
        showToast('保存成功', `版本 ${currentVersionForSettings} 的设置已保存`, 'success');
      } else {
        showToast('保存失败', '无法保存版本设置', 'error');
      }
    }, 300);
  }
  
  async function showVersionSettingsPanel(versionId: string): Promise<void> {
    if (!versionSettingsPanel) return;
    
    currentVersionForSettings = versionId;
    if (versionSettingsTitle) versionSettingsTitle.textContent = `版本设置 - ${versionId}`;
    
    if (versionSelectPanel) versionSelectPanel.classList.add('hidden');
    if (statusElement) statusElement.style.display = 'none';
    
    versionSettingsPanel.classList.remove('hidden');
    versionSettingsPanel.classList.remove('slide-out');
    
    await loadVersionSettingsToUI(versionId);
  }
  
  async function hideVersionSettingsPanel(): Promise<void> {
    if (!versionSettingsPanel) return;

    if (saveTimeout) clearTimeout(saveTimeout);
    if (currentVersionForSettings) {
      const settings = {
        memory: getCustomSelectValue('version-memory') || 'global',
        windowMode: getCustomSelectValue('version-window-mode') || 'global',
        startupMode: getCustomSelectValue('version-startup-mode') || 'default',
        serverIp: versionServerIpInput?.value || ''
      };
      await saveVersionSettings(currentVersionForSettings, settings);
    }
    
    versionSettingsPanel.classList.add('slide-out');
    
    setTimeout(() => {
      if (versionSettingsPanel) {
        versionSettingsPanel.classList.add('hidden');
        versionSettingsPanel.classList.remove('slide-out');
      }
      if (statusElement) statusElement.style.display = '';
      currentVersionForSettings = null;
    }, 300);
  }
  
  if (versionSettingsBtn) {
    versionSettingsBtn.addEventListener('click', async (): Promise<void> => {
      if (selectedVersionId) {
        
        if (versionSelectPanel && !versionSelectPanel.classList.contains('hidden')) {
          versionSelectPanel.classList.add('hidden');
        }
        await showVersionSettingsPanel(selectedVersionId);
      } else {
        showToast('未选择版本', '请先选择一个版本', 'warning');
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
        const confirmed: boolean = await showDialog({
          type: 'confirm',
          title: '确认删除',
          message: `确定要删除版本 "${currentVersionForSettings}" 吗？此操作不可恢复！`
        });
        
        if (confirmed) {
          if (window.gpcl && window.gpcl.deleteVersion) {
            try {
              const result = await window.gpcl.deleteVersion(currentVersionForSettings);
              if (result.success) {
                showToast('删除成功', `版本 ${currentVersionForSettings} 已删除`, 'success');
                
                await hideVersionSettingsPanel();
                loadVersions(true);
                renderVersionSelectList();
              } else {
                showToast('删除失败', result.error || '无法删除版本', 'error');
                this.checked = false;
              }
            } catch (e: any) {
              showToast('删除失败', e.message, 'error');
              this.checked = false;
            }
          }
        } else {
          this.checked = false;
        }
      }
    });
  }

  const versionOpenModsBtn: HTMLElement | null = document.getElementById('version-open-mods-btn');
  if (versionOpenModsBtn) {
    versionOpenModsBtn.addEventListener('click', async (): Promise<void> => {
      if (currentVersionForSettings && window.gpcl && window.gpcl.getGameDir) {
        const gameDir: string = await window.gpcl.getGameDir();
        if (gameDir) {
          const modsPath: string = gameDir + '\\versions\\' + currentVersionForSettings + '\\mods';
          window.gpcl.openFolder(modsPath);
        }
      }
    });
  }

  initCustomSelect('version-memory', () => {
    saveCurrentVersionSettings();
  });
  
  initCustomSelect('version-window-mode', () => {
    saveCurrentVersionSettings();
  });
  
  initCustomSelect('version-startup-mode', () => {
    updateServerIpVisibility();
    saveCurrentVersionSettings();
  });

  if (versionServerIpInput) {
    versionServerIpInput.addEventListener('input', () => {
      saveCurrentVersionSettings();
    });
  }

  const versionSelectBtn: HTMLElement | null = document.getElementById('version-select');
  const versionPanel: HTMLElement | null = document.getElementById('version-select-panel');
  if (versionSelectBtn && versionPanel) {
    versionSelectBtn.addEventListener('click', () => {
      
      if (versionSettingsPanel && !versionSettingsPanel.classList.contains('hidden')) {
        return;
      }

      if (versionPanel.classList.contains('hidden')) {
        versionPanel.classList.remove('hidden');
        renderVersionSelectList();
      } else {
        versionPanel.classList.add('hidden');
      }
    });
  }

  const authMicrosoftBtn: HTMLElement | null = document.getElementById('auth-microsoft');
  const authOfflineBtn: HTMLElement | null = document.getElementById('auth-offline');

  // 全局监听微软认证结果（只注册一次）
  if (window.gpcl && window.gpcl.onMicrosoftAuthResult) {
    window.gpcl.onMicrosoftAuthResult((result: any) => {
      if (result.status === 'success') {
        setMsAuthData({
          uuid: result.uuid,
          username: result.username,
          accessToken: result.accessToken
        });
        authMicrosoftBtn?.classList.add('auth-tab-active');
        authOfflineBtn?.classList.remove('auth-tab-active');
        if (usernameInput) {
          usernameInput.value = result.username;
          usernameInput.disabled = true;
        }
        /* 正版登录时名字由账号决定，收起离线名字列表 */
        closeUsernameHistory();
        if (usernameHistoryBtn) usernameHistoryBtn.classList.add('hidden');
        showToast('登录成功', `欢迎回来，${result.username}！`, 'success');
      } else if (result.status === 'timeout') {
        showToast('登录超时', '登录超时，请重试', 'error');
      } else if (result.status === 'error') {
        showToast('登录失败', result.message || '微软登录失败', 'error');
      }
    });
  }

  if (authMicrosoftBtn) {
    // 启用正版按钮
    authMicrosoftBtn.removeAttribute('disabled');
    authMicrosoftBtn.classList.remove('auth-tab-disabled');

    authMicrosoftBtn.addEventListener('click', async () => {
      if (msAuthData) {
        // 已登录 -> 登出
        setMsAuthData(null);
        authMicrosoftBtn.classList.remove('auth-tab-active');
        authOfflineBtn?.classList.add('auth-tab-active');
        if (usernameInput) {
          const savedName: string = await window.gpcl.getPlayerName();
          usernameInput.value = savedName || 'GPCL_Player';
          usernameInput.disabled = false;
        }
        if (usernameHistoryBtn) usernameHistoryBtn.classList.remove('hidden');
        showToast('已登出', '已切换到离线模式', 'info');
        return;
      }

      showToast('正版登录', '正在打开浏览器进行微软登录...', 'info');

      // 启动认证
      if (window.gpcl && window.gpcl.startMicrosoftAuth) {
        await window.gpcl.startMicrosoftAuth();
      }
    });
  }

  if (authOfflineBtn) {
    authOfflineBtn.addEventListener('click', () => {
      if (msAuthData) {
        showToast('提示', '请先点击正版按钮登出', 'warning');
        return;
      }
      authOfflineBtn.classList.add('auth-tab-active');
      authMicrosoftBtn?.classList.remove('auth-tab-active');
      if (usernameInput) {
        usernameInput.disabled = false;
        window.gpcl.getPlayerName().then((name: string) => {
          usernameInput.value = name || 'GPCL_Player';
        });
      }
    });
  }

})();

