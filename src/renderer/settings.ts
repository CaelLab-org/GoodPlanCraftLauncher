/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { enableMoreEl, icon, initCustomSelect, memoryOptimizeBtn, setCustomSelectValue, settingsNumInput, showToast } from './dom';
import { allNewerVersions, updateAvailable } from './update';
// __IMPORTS_END__

let currentMaxConcurrent: number = 64;

export function getMaxConcurrentFromSettings(): number {
  return currentMaxConcurrent;
}


if (memoryOptimizeBtn) {
  memoryOptimizeBtn.addEventListener('click', async (): Promise<void> => {
    const btnIcon: HTMLElement | null = memoryOptimizeBtn.querySelector('.btn-icon');
    const btnText: HTMLElement | null = memoryOptimizeBtn.querySelector('.btn-text');
    
    const originalIcon: string | null = btnIcon?.textContent || null;
    const originalText: string | null = btnText?.textContent || null;
    
    (memoryOptimizeBtn as HTMLButtonElement).disabled = true;
    if (btnIcon) btnIcon.innerHTML = icon('loader', 'spin');
    if (btnText) btnText.textContent = t('ui.optimizing');
    
    const beforeMemory: number = await window.gpcl.getMemoryUsage();
    
    const result: any = await window.gpcl.optimizeMemory();
    const freedMB: number = result?.freedMB ?? Math.max(0, beforeMemory - (result?.afterMB ?? beforeMemory));
    const afterMB: number = result?.afterMB ?? await window.gpcl.getMemoryUsage();
    
    (memoryOptimizeBtn as HTMLButtonElement).disabled = false;
    if (btnIcon) btnIcon.textContent = originalIcon;
    if (btnText) btnText.textContent = originalText;
    
    showToast('ui.memory_optimization_complete', freedMB > 0
      ? t('ui.gpcl_is_now_using_mb_mb_freed_freed_mb', { mb: afterMB, freed: freedMB })
      : t('ui.gpcl_is_using_mb_mb_nothing_could_be_freed', { mb: afterMB }), 'success');
  });
}

export const DEFAULT_MAX_THREADS: number = 64;

export const MAX_THREADS_LIMIT: number = 128;


export async function loadSettingFromStorage(): Promise<number> {
  try {
    const settings = await loadSettings();
    return settings.download?.maxConcurrent || DEFAULT_MAX_THREADS;
  } catch (e: any) {
    return DEFAULT_MAX_THREADS;
  }
}

export async function saveSettingToStorage(maxConcurrent: number): Promise<boolean> {
  try {
    const settings = await loadSettings();
    settings.download.maxConcurrent = maxConcurrent;
    currentMaxConcurrent = maxConcurrent;
    await window.gpcl.saveSettings(settings);
    return true;
  } catch (e: any) { return false; }
}

if (settingsNumInput) {
  const threadValue: HTMLElement | null = document.getElementById('num-threads-value');

  const updateThreadLabel = (): void => {
    if (threadValue) threadValue.textContent = settingsNumInput!.value;
  };

  const clampSettingsInput = (): void => {
    let v: number = parseInt(settingsNumInput!.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > MAX_THREADS_LIMIT) v = MAX_THREADS_LIMIT;
    settingsNumInput!.value = String(v);
    updateThreadLabel();
  };

  (async (): Promise<void> => {
    const stored: number = await loadSettingFromStorage();
    currentMaxConcurrent = stored;
    settingsNumInput.value = String(stored);
    updateThreadLabel();
  })();

  settingsNumInput.addEventListener('input', updateThreadLabel);
  settingsNumInput.addEventListener('change', async (): Promise<void> => {
    clampSettingsInput();
    await saveSettingToStorage(parseInt(settingsNumInput!.value, 10));
  });
}


export function updateMoreMenuVisibility(enabled: boolean): void {
  const menuMoreEl: HTMLElement | null = document.getElementById('menu-more');
  if (menuMoreEl) {
    menuMoreEl.classList.toggle('hidden', !enabled);
  }
}


if (enableMoreEl) {
  (async (): Promise<void> => {
    const settings = await loadSettings();
    const enabled: boolean = settings.appearance?.enableMore === true;
    enableMoreEl.checked = enabled;
    updateMoreMenuVisibility(enabled);
  })();

  enableMoreEl.addEventListener('change', async (e: Event): Promise<void> => {
    const enabled: boolean = (e.target as HTMLInputElement).checked;
    updateMoreMenuVisibility(enabled);
    
    const settings = await loadSettings();
    settings.appearance = settings.appearance || {} as any;
    (settings.appearance as any).enableMore = enabled;
    await window.gpcl.saveSettings(settings);
  });
}



export async function updateSettingsBadge(): Promise<void> {
  const settingsMenu: HTMLElement | null = document.getElementById('menu-settings');
  const aboutTab: HTMLElement | null = document.getElementById('settings-tab-about');
  const checkUpdateBtn: HTMLElement | null = document.getElementById('check-update-btn');

  const oldSettingsBadge: HTMLElement | null = settingsMenu?.querySelector('.update-badge') as HTMLElement | null;
  if (oldSettingsBadge) oldSettingsBadge.remove();

  const oldAboutBadge: HTMLElement | null = aboutTab?.querySelector('.update-badge') as HTMLElement | null;
  if (oldAboutBadge) oldAboutBadge.remove();

  const settings = await loadSettings();

  if (updateAvailable && settings.advanced?.autoCheckUpdate !== false) {
    
    if (settingsMenu) {
      const badge: HTMLSpanElement = document.createElement('span');
      badge.className = 'update-badge';
      badge.textContent = '';
      badge.style.cssText = 'position:absolute;top:2px;right:2px;width:8px;height:8px;background:#f44336;border-radius:50%;';
      settingsMenu.style.position = 'relative';
      settingsMenu.appendChild(badge);
    }

    if (aboutTab) {
      const badge: HTMLSpanElement = document.createElement('span');
      badge.className = 'update-badge';
      badge.textContent = '';
      badge.style.cssText = 'position:absolute;top:6px;right:8px;width:8px;height:8px;background:#f44336;border-radius:50%;';
      aboutTab.style.position = 'relative';
      aboutTab.appendChild(badge);
    }

    if (checkUpdateBtn) {
      checkUpdateBtn.classList.add('new-version');
      checkUpdateBtn.textContent = t('ui.count_new_version_s_available', { count: allNewerVersions.length });
    }
  } else {
    
    if (checkUpdateBtn && !updateAvailable) {
      checkUpdateBtn.classList.remove('new-version');
      checkUpdateBtn.textContent = t('ui.check_for_updates');
    }
  }
}


export async function loadSettings(): Promise<any> {
  try {
    return await gpcl.getSettings();
  } catch (e: any) {
    console.error('加载设置失败:', e);
    return {
      general: {
        language: 'auto'
      },
      game: {
        memory: 'auto',
        playerName: 'GPCL_Player',
        javaPath: '',
        jvmArgs: '',
        gcPreset: 'default',
        windowMode: 'windowed',
        windowTitle: 'Minecraft {mc_version} (GPCL)',
        keepWindowTitle: false,
        processPriority: 'normal',
        launcherVisibility: 'keep',
        windowSize: 'default',
        windowWidth: 854,
        windowHeight: 480,
        optimizeBeforeLaunch: false,
        autoLanguage: true,
        language: 'zh_cn'
      },
      appearance: {
        theme: 'light',
        style: 'advanced',
        scale: '100',
        playStartupAnimation: true,
        skipSplash: false,
        tipFrequency: 'rare',
        enableMore: false
      },
      download: {
        maxConcurrent: 64,
        javaMirror: 'tsinghua',
        customJavaMirror: '',
        fileSource: 'auto',
        versionSource: 'auto',
        speedLimit: 0,
        installDir: '',
        customFileMirror: '',
        curseForgeApiKey: ''
      },
      advanced: {
        autoCheckUpdate: true,
        autoUpdate: true,
        preventMultipleLaunch: true,
        autoClearLogs: true,
        logRetentionValue: 7,
        logRetentionUnit: 'day',
        developerMode: false
      }
    };
  }
}


export function applyTheme(theme: string): void {
  const light: boolean = theme === 'light';
  // <html> 上这份是给重载首帧用的（index.html 的同步脚本会先加），两处要同步
  document.documentElement.classList.toggle('light-mode', light);
  document.body.classList.toggle('light-mode', light);
}


export function applyStyle(style: string): void {
  const value: string = ['mc', 'advanced', 'minimal'].includes(style) ? style : 'advanced';
  document.body.classList.remove('style-mc', 'style-advanced', 'style-minimal');
  document.body.classList.add(`style-${value}`);
}


export async function saveStyleSetting(style: string): Promise<void> {
  const settings = await loadSettings();
  settings.appearance.style = style;
  await gpcl.saveSettings(settings);
}


export async function saveThemeSetting(theme: string): Promise<void> {
  const settings = await loadSettings();
  settings.appearance.theme = theme;
  await gpcl.saveSettings(settings);
}


export async function initTheme(): Promise<void> {
  const settings = await loadSettings();
  const theme: string = settings.appearance?.theme || 'dark';
  const style: string = settings.appearance?.style || 'advanced';
  applyTheme(theme);
  applyStyle(style);

  const themeGroup: HTMLElement | null = document.getElementById('settings-theme');
  if (themeGroup) {
    const radios: NodeListOf<HTMLInputElement> = themeGroup.querySelectorAll<HTMLInputElement>('input[name="theme"]');
    radios.forEach((radio: HTMLInputElement) => {
      radio.checked = radio.value === theme;
      radio.addEventListener('change', async (): Promise<void> => {
        if (!radio.checked) return;
        applyTheme(radio.value);
        await saveThemeSetting(radio.value);
      });
    });
  }

  const styleGroup: HTMLElement | null = document.getElementById('settings-style');
  if (styleGroup) {
    const radios: NodeListOf<HTMLInputElement> = styleGroup.querySelectorAll<HTMLInputElement>('input[name="style"]');
    radios.forEach((radio: HTMLInputElement) => {
      radio.checked = radio.value === style;
      radio.addEventListener('change', async (): Promise<void> => {
        if (!radio.checked) return;
        applyStyle(radio.value);
        await saveStyleSetting(radio.value);
      });
    });
  }
}


export function applyScale(scale: string): void {
  const factor: number = parseInt(scale, 10) / 100;
  // zoom 不会折算 vh，所以把系数也写给 CSS，让那些 100vh 的容器自己除回来
  document.documentElement.style.setProperty('--app-zoom', String(factor || 1));
  (document.body.style as any).zoom = factor;
}


export async function saveScaleSetting(scale: string): Promise<void> {
  const settings = await loadSettings();
  settings.appearance.scale = scale;
  await gpcl.saveSettings(settings);
}


export async function initScale(): Promise<void> {
  const settings = await loadSettings();
  const scale: string = settings.appearance?.scale || '100';
  applyScale(scale);
  
  const scaleSelect: HTMLElement | null = document.getElementById('settings-scale');
  if (scaleSelect) {
    (scaleSelect as HTMLInputElement).value = scale;
    scaleSelect.addEventListener('change', async (): Promise<void> => {
      const newScale: string = (scaleSelect as HTMLInputElement).value;
      applyScale(newScale);
      await saveScaleSetting(newScale);
    });
  }
}


async function saveGameSetting(patch: Record<string, any>): Promise<void> {
  const settings = await loadSettings();
  settings.game = settings.game || {};
  Object.assign(settings.game, patch);
  await window.gpcl.saveSettings(settings);
}


export async function initMemorySettings(): Promise<void> {
  const modeGroup: HTMLElement | null = document.getElementById('settings-memory-mode');
  const slider: HTMLInputElement | null = document.getElementById('settings-memory-slider') as HTMLInputElement | null;
  const customRow: HTMLElement | null = document.getElementById('memory-custom-row');
  const valueLabel: HTMLElement | null = document.getElementById('settings-memory-value');
  const allocLabel: HTMLElement | null = document.getElementById('memory-alloc-label');
  const freeLabel: HTMLElement | null = document.getElementById('memory-free-label');
  const usageLabel: HTMLElement | null = document.getElementById('memory-usage-label');
  const usageBar: HTMLElement | null = document.getElementById('memory-usage-used');
  const warning: HTMLElement | null = document.getElementById('memory-warning');
  const optimizeToggle: HTMLInputElement | null = document.getElementById('optimize-before-launch') as HTMLInputElement | null;
  if (!modeGroup && !slider) return;

  let systemInfo: any = { totalMB: 0, freeMB: 0, autoMemoryMB: 0 };

  const updateLabels = (auto: boolean): void => {
    const customGB: number = slider ? (parseInt(slider.value, 10) || 1) : 4;
    const allocMB: number = auto ? (systemInfo.autoMemoryMB || 1024) : customGB * 1024;
    if (valueLabel) valueLabel.textContent = `${customGB} GB`;
    if (allocLabel) allocLabel.textContent = `${(allocMB / 1024).toFixed(1)} GB${auto ? t('ui.automatic') : ''}`;
    if (freeLabel) freeLabel.textContent = systemInfo.freeMB > 0 ? `${(systemInfo.freeMB / 1024).toFixed(1)} GB` : '--';
    if (usageLabel) {
      const totalGB: number = systemInfo.totalMB / 1024;
      const usedGB: number = (systemInfo.totalMB - systemInfo.freeMB) / 1024;
      usageLabel.textContent = totalGB > 0 ? `${usedGB.toFixed(1)} GB / ${totalGB.toFixed(1)} GB` : '-- / --';
      if (usageBar) usageBar.style.width = `${totalGB > 0 ? Math.min(100, (usedGB / totalGB) * 100) : 0}%`;
    }
    if (warning) {
      const lowFree: boolean = systemInfo.freeMB > 0 && systemInfo.freeMB < 4096;
      warning.classList.toggle('hidden', !lowFree);
      warning.textContent = auto
        ? t('ui.available_memory_is_low_so_the_automatic_value_was_reduced_consider_clos_3a1baa')
        : t('ui.available_memory_is_low_the_custom_value_may_exceed_it_consider_closing_b560f5');
    }
  };

  const setMode = (auto: boolean): void => {
    if (modeGroup) {
      modeGroup.querySelectorAll<HTMLInputElement>('input[name="memory-mode"]').forEach((radio: HTMLInputElement) => {
        radio.checked = radio.value === (auto ? 'auto' : 'custom');
      });
    }
    if (slider) slider.disabled = auto;
    customRow?.classList.toggle('hidden', auto);
    updateLabels(auto);
  };

  const refresh = async (): Promise<void> => {
    const settings = await loadSettings();
    const stored: string = String(settings.game?.memory ?? 'auto');
    const auto: boolean = stored === 'auto';
    try { systemInfo = await window.gpcl.getSystemMemory(); } catch {}

    if (slider) {
      const maxGB: number = systemInfo.totalMB > 0 ? Math.max(2, Math.floor(systemInfo.totalMB / 1024) - 1) : 16;
      slider.max = String(maxGB);
      const customGB: number = parseInt(stored, 10);
      const fallbackGB: number = Math.round((systemInfo.autoMemoryMB || 4096) / 1024);
      slider.value = String(Math.min(maxGB, Math.max(1, isNaN(customGB) ? fallbackGB : Math.round(customGB))));
    }

    setMode(auto);
    if (optimizeToggle) optimizeToggle.checked = settings.game?.optimizeBeforeLaunch === true;
  };

  if (modeGroup) {
    modeGroup.addEventListener('change', async (): Promise<void> => {
      const selected: HTMLInputElement | null = modeGroup.querySelector<HTMLInputElement>('input[name="memory-mode"]:checked');
      const auto: boolean = selected?.value === 'auto';
      await saveGameSetting({ memory: auto ? 'auto' : String(slider?.value || 4) });
      setMode(auto);
    });
  }

  if (slider) {
    slider.addEventListener('input', () => updateLabels(false));
    slider.addEventListener('change', async (): Promise<void> => {
      await saveGameSetting({ memory: String(slider.value) });
      updateLabels(false);
    });
  }

  if (optimizeToggle) {
    optimizeToggle.addEventListener('change', async (): Promise<void> => {
      await saveGameSetting({ optimizeBeforeLaunch: optimizeToggle.checked });
    });
  }

  await refresh();
}


export async function initLaunchSettings(): Promise<void> {
  const customRow: HTMLElement | null = document.getElementById('window-size-custom-row');
  const widthInput: HTMLInputElement | null = document.getElementById('settings-window-width') as HTMLInputElement | null;
  const heightInput: HTMLInputElement | null = document.getElementById('settings-window-height') as HTMLInputElement | null;
  const visibilityGroup: HTMLElement | null = document.getElementById('settings-launcher-visibility');
  const keepTitle: HTMLInputElement | null = document.getElementById('settings-keep-window-title') as HTMLInputElement | null;
  const autoLanguage: HTMLInputElement | null = document.getElementById('settings-auto-language') as HTMLInputElement | null;
  const languageRow: HTMLElement | null = document.getElementById('game-language-row');
  const jvmArgs: HTMLTextAreaElement | null = document.getElementById('settings-jvm-args') as HTMLTextAreaElement | null;

  const toggleCustomRow = (value: string): void => {
    customRow?.classList.toggle('hidden', value !== 'custom');
  };

  initCustomSelect('settings-window-size', async (value: string): Promise<void> => {
    toggleCustomRow(value);
    await saveGameSetting({ windowSize: value });
  });

  initCustomSelect('settings-process-priority', async (value: string): Promise<void> => {
    await saveGameSetting({ processPriority: value });
  });

  initCustomSelect('settings-game-language', async (value: string): Promise<void> => {
    await saveGameSetting({ language: value });
  });

  initCustomSelect('settings-gc-preset', async (value: string): Promise<void> => {
    await saveGameSetting({ gcPreset: value });
  });

  const settings = await loadSettings();
  const windowSize: string = settings.game?.windowSize || 'default';
  setCustomSelectValue('settings-window-size', windowSize);
  toggleCustomRow(windowSize);
  if (widthInput) widthInput.value = String(settings.game?.windowWidth || 854);
  if (heightInput) heightInput.value = String(settings.game?.windowHeight || 480);
  setCustomSelectValue('settings-process-priority', settings.game?.processPriority || 'normal');
  setCustomSelectValue('settings-gc-preset', settings.game?.gcPreset || 'default');
  setCustomSelectValue('settings-game-language', settings.game?.language || 'zh_cn');
  if (jvmArgs) jvmArgs.value = settings.game?.jvmArgs || '';
  if (keepTitle) keepTitle.checked = settings.game?.keepWindowTitle === true;

  if (autoLanguage) {
    const syncLanguageRow = (enabled: boolean): void => {
      languageRow?.classList.toggle('hidden', !enabled);
    };
    autoLanguage.checked = settings.game?.autoLanguage !== false;
    syncLanguageRow(autoLanguage.checked);
    autoLanguage.addEventListener('change', async (): Promise<void> => {
      syncLanguageRow(autoLanguage.checked);
      await saveGameSetting({ autoLanguage: autoLanguage.checked });
    });
  }

  if (visibilityGroup) {
    const stored: string = settings.game?.launcherVisibility || 'keep';
    visibilityGroup.querySelectorAll<HTMLInputElement>('input[name="launcher-visibility"]').forEach((radio: HTMLInputElement) => {
      radio.checked = radio.value === stored;
      radio.addEventListener('change', async (): Promise<void> => {
        if (!radio.checked) return;
        await saveGameSetting({ launcherVisibility: radio.value });
      });
    });
  }

  if (keepTitle) {
    keepTitle.addEventListener('change', async (): Promise<void> => {
      await saveGameSetting({ keepWindowTitle: keepTitle.checked });
    });
  }

  const saveWindowSize = async (): Promise<void> => {
    let width: number = parseInt(widthInput?.value || '', 10);
    let height: number = parseInt(heightInput?.value || '', 10);
    if (isNaN(width)) width = 854;
    if (isNaN(height)) height = 480;
    width = Math.min(7680, Math.max(320, width));
    height = Math.min(4320, Math.max(240, height));
    if (widthInput) widthInput.value = String(width);
    if (heightInput) heightInput.value = String(height);
    await saveGameSetting({ windowWidth: width, windowHeight: height });
  };

  if (widthInput) widthInput.addEventListener('change', saveWindowSize);
  if (heightInput) heightInput.addEventListener('change', saveWindowSize);

  if (jvmArgs) {
    jvmArgs.addEventListener('change', async (): Promise<void> => {
      await saveGameSetting({ jvmArgs: jvmArgs.value.trim() });
    });
  }
}


export async function initDownloadSettings(): Promise<void> {
  const speedSlider: HTMLInputElement | null = document.getElementById('settings-speed-limit') as HTMLInputElement | null;
  const speedLabel: HTMLElement | null = document.getElementById('settings-speed-limit-value');
  const mirrorInput: HTMLInputElement | null = document.getElementById('settings-custom-file-mirror') as HTMLInputElement | null;
  const curseForgeKey: HTMLInputElement | null = document.getElementById('settings-curseforge-key') as HTMLInputElement | null;
  const installDirLabel: HTMLElement | null = document.getElementById('settings-install-dir-label');
  const installDirChange: HTMLElement | null = document.getElementById('settings-install-dir-change');
  const installDirReset: HTMLElement | null = document.getElementById('settings-install-dir-reset');

  const refreshInstallDirLabel = (custom: string): void => {
    if (!installDirLabel) return;
    installDirLabel.textContent = custom ? custom : t('ui.default_folder_minecraft_in_the_launcher_data_folder');
  };

  const saveDownloadField = async (patch: Record<string, any>): Promise<void> => {
    const settings = await loadSettings();
    settings.download = settings.download || {} as any;
    Object.assign(settings.download, patch);
    await window.gpcl.saveSettings(settings);
  };

  const updateSpeedLabel = (): void => {
    if (!speedSlider || !speedLabel) return;
    const value: number = parseInt(speedSlider.value, 10) || 0;
    speedLabel.textContent = value > 0 ? `${value} MB/s` : t('ui.unlimited');
  };

  initCustomSelect('settings-file-source', async (value: string): Promise<void> => {
    const settings = await loadSettings();
    settings.download = settings.download || {} as any;
    settings.download.fileSource = value;
    await window.gpcl.saveSettings(settings);
  });

  initCustomSelect('settings-version-source', async (value: string): Promise<void> => {
    const settings = await loadSettings();
    settings.download = settings.download || {} as any;
    settings.download.versionSource = value;
    await window.gpcl.saveSettings(settings);
  });

  const settings = await loadSettings();
  setCustomSelectValue('settings-file-source', settings.download?.fileSource || 'auto');
  setCustomSelectValue('settings-version-source', settings.download?.versionSource || 'auto');

  if (mirrorInput) {
    mirrorInput.value = settings.download?.customFileMirror || '';
    mirrorInput.addEventListener('change', async (): Promise<void> => {
      await saveDownloadField({ customFileMirror: mirrorInput.value.trim() });
      showToast('ui.download_mirror_saved', mirrorInput.value.trim() || '已恢复默认镜像', 'success', 'mirror-saved');
    });
  }

  if (curseForgeKey) {
    curseForgeKey.value = settings.download?.curseForgeApiKey || '';
    curseForgeKey.addEventListener('change', async (): Promise<void> => {
      await saveDownloadField({ curseForgeApiKey: curseForgeKey.value.trim() });
      showToast('ui.curseforge_key_saved', curseForgeKey.value.trim() ? '搜索时会优先使用官方接口' : '已清空', 'success', 'cf-key-saved');
    });
  }

  refreshInstallDirLabel(settings.download?.installDir || '');

  if (installDirChange) {
    installDirChange.addEventListener('click', async (): Promise<void> => {
      const dir: string | null = await window.gpcl.selectDirectory();
      if (!dir) return;

      const confirmResult: any = await window.gpcl.showMessageDialog({
        type: 'warning',
        title: '切换游戏目录',
        message: t('ui.switch_the_game_directory_to_dir', { dir }),
        detail: '新下载的版本、库、资源和模组都会放在这里。已有文件不会自动搬迁，旧目录里的版本切换后不会显示。',
        buttons: ['切换', '取消'],
        defaultId: 0,
        cancelId: 1
      });
      if ((confirmResult?.response ?? 1) !== 0) return;

      await saveDownloadField({ installDir: dir });
      refreshInstallDirLabel(dir);
      showToast('ui.game_directory_switched', dir, 'success', 'install-dir-changed');
    });
  }

  if (installDirReset) {
    installDirReset.addEventListener('click', async (): Promise<void> => {
      await saveDownloadField({ installDir: '' });
      refreshInstallDirLabel('');
      showToast('ui.default_directory_restored', '新下载会放回启动器数据目录', 'info', 'install-dir-reset');
    });
  }

  if (speedSlider) {
    speedSlider.value = String(settings.download?.speedLimit || 0);
    updateSpeedLabel();
    speedSlider.addEventListener('input', updateSpeedLabel);
    speedSlider.addEventListener('change', async (): Promise<void> => {
      const settings = await loadSettings();
      settings.download = settings.download || {} as any;
      settings.download.speedLimit = parseInt(speedSlider.value, 10) || 0;
      await window.gpcl.saveSettings(settings);
      updateSpeedLabel();
    });
  }
}


export async function initAboutPage(): Promise<void> {
  const versionEl: HTMLElement | null = document.getElementById('about-version');
  if (versionEl) {
    try {
      const version: string = await window.gpcl.getAppVersion();
      versionEl.textContent = t('ui.version_version', { version });
    } catch {}
  }

  try {
    const info: any = await window.gpcl.getRuntimeInfo();
    const fields: Record<string, any> = {
      'runtime-app': info.appVersion,
      'runtime-electron': info.electron,
      'runtime-chrome': info.chrome,
      'runtime-node': info.node,
      'runtime-platform': info.platform
    };
    for (const [id, value] of Object.entries(fields)) {
      const el: HTMLElement | null = document.getElementById(id);
      if (el) el.textContent = value || '-';
    }
  } catch {}

  document.querySelectorAll<HTMLAnchorElement>('.about-link').forEach((link: HTMLAnchorElement) => {
    link.addEventListener('click', (event: Event): void => {
      event.preventDefault();
      const url: string | null = link.getAttribute('href');
      if (url && window.gpcl && window.gpcl.openExternal) window.gpcl.openExternal(url);
    });
  });

  const details: HTMLDetailsElement | null = document.getElementById('license-details') as HTMLDetailsElement | null;
  const licenseText: HTMLElement | null = document.getElementById('license-text');
  if (details && licenseText) {
    details.addEventListener('toggle', async (): Promise<void> => {
      if (!details.open || details.dataset.loaded === '1') return;
      details.dataset.loaded = '1';
      try {
        const text: string = await window.gpcl.getLicenseText();
        licenseText.textContent = text || t('ui.could_not_read_the_license');
      } catch {
        licenseText.textContent = t('ui.could_not_read_the_license');
        details.dataset.loaded = '0';
      }
    });
  }
}


void initMemorySettings();
void initLaunchSettings();
void initDownloadSettings();
void initAboutPage();

