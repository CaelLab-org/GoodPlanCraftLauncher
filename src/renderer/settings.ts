/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { enableMoreEl, icon, memoryOptimizeBtn, settingsBtnMinus, settingsBtnPlus, settingsBtnSave, settingsNumInput, showToast } from './dom';
import { allNewerVersions, updateAvailable } from './update';
// __IMPORTS_END__

export function getMaxConcurrentFromSettings(): number {
  return DEFAULT_MAX_THREADS;
}


if (memoryOptimizeBtn) {
  memoryOptimizeBtn.addEventListener('click', async (): Promise<void> => {
    const btnIcon: HTMLElement | null = memoryOptimizeBtn.querySelector('.btn-icon');
    const btnText: HTMLElement | null = memoryOptimizeBtn.querySelector('.btn-text');
    
    const originalIcon: string | null = btnIcon?.textContent || null;
    const originalText: string | null = btnText?.textContent || null;
    
    (memoryOptimizeBtn as HTMLButtonElement).disabled = true;
    if (btnIcon) btnIcon.innerHTML = icon('loader', 'spin');
    if (btnText) btnText.textContent = '优化中...';
    
    const beforeMemory: number = await window.gpcl.getMemoryUsage();
    
    await window.gpcl.optimizeMemory();
    
    const afterMemory: number = await window.gpcl.getMemoryUsage();
    
    const savedMemory: string = (beforeMemory - afterMemory).toFixed(2);
    const afterMemoryFormatted: string = afterMemory.toFixed(2);
    
    (memoryOptimizeBtn as HTMLButtonElement).disabled = false;
    if (btnIcon) btnIcon.textContent = originalIcon;
    if (btnText) btnText.textContent = originalText;
    
    showToast(`内存优化完成！\n当前内存占用: ${afterMemoryFormatted}GB\n比优化前减少了: ${savedMemory}GB`, 'success');
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
    await gpcl.saveSettings(settings);
    return true;
  } catch (e: any) { return false; }
}

if (settingsNumInput) {
  (async (): Promise<void> => {
    settingsNumInput.value = String(await loadSettingFromStorage());
  })();
  function clampSettingsInput(): void {
    let v: number = parseInt(settingsNumInput!.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > MAX_THREADS_LIMIT) v = MAX_THREADS_LIMIT;
    settingsNumInput!.value = String(v);
  }
  settingsNumInput.addEventListener('change', clampSettingsInput);
  settingsNumInput.addEventListener('blur', clampSettingsInput);
  if (settingsBtnMinus) {
    settingsBtnMinus.addEventListener('click', () => {
      let v: number = parseInt(settingsNumInput.value, 10) || 1;
      if (v > 1) { settingsNumInput.value = String(v - 1); clampSettingsInput(); }
    });
  }
  if (settingsBtnPlus) {
    settingsBtnPlus.addEventListener('click', () => {
      let v: number = parseInt(settingsNumInput.value, 10) || 1;
      if (v < MAX_THREADS_LIMIT) { settingsNumInput.value = String(v + 1); clampSettingsInput(); }
    });
  }
  if (settingsBtnSave) {
    settingsBtnSave.addEventListener('click', async (): Promise<void> => {
      clampSettingsInput();
      await saveSettingToStorage(parseInt(settingsNumInput.value, 10));
      const orig: string | null = settingsBtnSave.textContent;
      settingsBtnSave.textContent = '已保存!';
      setTimeout(() => { settingsBtnSave.textContent = orig; }, 1500);
    });
  }
}


export async function reloadAllSettingsToUI(): Promise<void> {
  const settings = await loadSettings();
  
  const settingsMemory: HTMLElement | null = document.getElementById('settings-memory');
  if (settingsMemory) {
    (settingsMemory as HTMLInputElement).value = settings.game?.memory || '4';
  }
  
  const settingsWindowMode: HTMLElement | null = document.getElementById('settings-window-mode');
  if (settingsWindowMode) {
    (settingsWindowMode as HTMLInputElement).value = settings.game?.windowMode || 'windowed';
  }
  
  const settingsTheme: HTMLElement | null = document.getElementById('settings-theme');
  if (settingsTheme) {
    (settingsTheme as HTMLInputElement).value = settings.appearance?.theme || 'dark';
    applyTheme(settings.appearance?.theme || 'dark');
  }
  
  const settingsScale: HTMLElement | null = document.getElementById('settings-scale');
  if (settingsScale) {
    (settingsScale as HTMLInputElement).value = settings.appearance?.scale || '100';
    applyScale(settings.appearance?.scale || '100');
  }
  
  const settingsNumInputEl: HTMLElement | null = document.getElementById('num-threads');
  if (settingsNumInputEl) {
    (settingsNumInputEl as HTMLInputElement).value = String(settings.download?.maxConcurrent || 64);
  }
  
  const javaMirrorSelect: HTMLElement | null = document.getElementById('java-mirror-select');
  const customMirrorContainer: HTMLElement | null = document.getElementById('custom-java-mirror-container');
  const customMirrorUrl: HTMLInputElement | null = document.getElementById('custom-java-mirror-url') as HTMLInputElement | null;
  if (javaMirrorSelect) {
    (javaMirrorSelect as HTMLInputElement).value = settings.download?.javaMirror || 'tsinghua';
    if (customMirrorContainer) {
      customMirrorContainer.classList.toggle('hidden', (javaMirrorSelect as HTMLInputElement).value !== 'custom');
    }
    if (customMirrorUrl) {
      customMirrorUrl.value = settings.download?.customJavaMirror || '';
    }
  }
  
  const autoCheckUpdate: HTMLInputElement | null = document.getElementById('auto-check-update') as HTMLInputElement | null;
  if (autoCheckUpdate) {
    autoCheckUpdate.checked = settings.advanced?.autoCheckUpdate !== false;
  }
  const preventMultipleLaunch: HTMLInputElement | null = document.getElementById('prevent-multiple-launch') as HTMLInputElement | null;
  if (preventMultipleLaunch) {
    preventMultipleLaunch.checked = settings.advanced?.preventMultipleLaunch !== false;
  }

  const autoClearLogs: HTMLInputElement | null = document.getElementById('auto-clear-logs') as HTMLInputElement | null;
  const logRetentionContainer: HTMLElement | null = document.getElementById('log-retention-container');
  const logRetentionValue: HTMLInputElement | null = document.getElementById('log-retention-value') as HTMLInputElement | null;
  const logRetentionUnit: HTMLElement | null = document.getElementById('log-retention-unit');
  
  if (autoClearLogs) {
    autoClearLogs.checked = settings.advanced?.autoClearLogs !== false;
  }
  
  if (logRetentionContainer) {
    logRetentionContainer.classList.toggle('hidden', settings.advanced?.autoClearLogs === false);
  }
  
  if (logRetentionValue) {
    logRetentionValue.value = String(settings.advanced?.logRetentionValue || 7);
  }
  
  if (logRetentionUnit) {
    (logRetentionUnit as HTMLInputElement).value = settings.advanced?.logRetentionUnit || 'day';
  }

  const playStartupAnimationEl: HTMLInputElement | null = document.getElementById('play-startup-animation') as HTMLInputElement | null;
  if (playStartupAnimationEl) {
    playStartupAnimationEl.checked = settings.appearance?.playStartupAnimation === true;
  }

  const skipSplashEl: HTMLInputElement | null = document.getElementById('skip-splash') as HTMLInputElement | null;
  if (skipSplashEl) {
    skipSplashEl.checked = settings.appearance?.skipSplash === true;
  }

  const enableMoreEl: HTMLInputElement | null = document.getElementById('enable-more') as HTMLInputElement | null;
  if (enableMoreEl) {
    enableMoreEl.checked = settings.appearance?.enableMore !== false;
    updateMoreMenuVisibility(settings.appearance?.enableMore !== false);
  }

  const developerModeEl: HTMLInputElement | null = document.getElementById('developer-mode') as HTMLInputElement | null;
  if (developerModeEl) {
    developerModeEl.checked = settings.advanced?.developerMode === true;
  }
}


export function updateMoreMenuVisibility(enabled: boolean): void {
  const menuMoreEl: HTMLElement | null = document.getElementById('menu-more');
  if (menuMoreEl) {
    menuMoreEl.style.display = enabled ? '' : 'none';
  }
}


if (enableMoreEl) {
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
      checkUpdateBtn.textContent = `发现 ${allNewerVersions.length} 个新版本`;
    }
  } else {
    
    if (checkUpdateBtn && !updateAvailable) {
      checkUpdateBtn.classList.remove('new-version');
      checkUpdateBtn.textContent = '检查更新';
    }
  }
}


export async function loadSettings(): Promise<any> {
  try {
    return await gpcl.getSettings();
  } catch (e: any) {
    console.error('加载设置失败:', e);
    return {
      game: {
        memory: '2',
        playerName: 'GPCL_Player',
        javaPath: '',
        jvmArgs: '',
        windowMode: 'windowed'
      },
      appearance: {
        theme: 'light',
        scale: '100',
        playStartupAnimation: true,
        skipSplash: false
      },
      download: {
        maxConcurrent: 64,
        javaMirror: 'tsinghua',
        customJavaMirror: ''
      },
      advanced: {
        autoCheckUpdate: true,
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
  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}


export async function saveThemeSetting(theme: string): Promise<void> {
  const settings = await loadSettings();
  settings.appearance.theme = theme;
  await gpcl.saveSettings(settings);
}


export async function initTheme(): Promise<void> {
  const settings = await loadSettings();
  const theme: string = settings.appearance?.theme || 'dark';
  applyTheme(theme);
  
  const themeSelect: HTMLElement | null = document.getElementById('settings-theme');
  if (themeSelect) {
    (themeSelect as HTMLInputElement).value = theme;
    themeSelect.addEventListener('change', async (): Promise<void> => {
      const newTheme: string = (themeSelect as HTMLInputElement).value;
      applyTheme(newTheme);
      await saveThemeSetting(newTheme);
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

