/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { icon, showDialog, showToast } from './dom';
import { startJavaInstall } from './launch';
import { loadSettings } from './settings';
// __IMPORTS_END__

export const JAVA_RUNTIME_NAME_MAP: Record<string, string> = {
  "8": "jre-legacy",
  "16": "java-runtime-beta",
  "17": "java-runtime-gamma",
  "21": "java-runtime-delta",
  "25": "java-runtime-epsilon"
};


export const JAVA_VERSION_DESC: Record<string, { mcVersions: string; desc: string }> = {
  "8": { mcVersions: "1.7.10 - 1.16.5", desc: "经典版本兼容" },
  "17": { mcVersions: "1.17 - 1.20.4", desc: "最稳定，推荐使用" },
  "21": { mcVersions: "1.20.5 - 1.21+", desc: "最新 LTS 版本" },
  "25": { mcVersions: "1.21+", desc: "最新尝鲜版" }
};


export function getJavaRuntimeName(javaVersion: string): string {
  return JAVA_RUNTIME_NAME_MAP[javaVersion] || `jre${javaVersion}`;
}


export async function initJavaVersionStatus(): Promise<void> {
  const javaVersions: string[] = ["8", "17", "21", "25"];

  for (const ver of javaVersions) {
    try {
      const result = await window.gpcl.checkJava(ver);
      const card: HTMLElement | null = document.querySelector(`.java-version-card[data-version="${ver}"]`) as HTMLElement | null;
      const badge: HTMLElement | null = document.getElementById(`java-${ver}-status`);
      const btn: HTMLElement | null = card?.querySelector('.java-install-btn') as HTMLElement | null;

      if (result.installed) {
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
    } catch (e: any) {
      console.error(`检查Java ${ver} 状态失败`, e);
    }
  }

  updateJavaInstallStatus();
}


export function updateJavaInstallStatus(): void {
  const statusEl: HTMLElement | null = document.getElementById('java-install-status');
  if (!statusEl) return;

  const javaVersions: string[] = ["8", "17", "21", "25"];
  const installed: string[] = [];
  const notInstalled: string[] = [];

  javaVersions.forEach((ver: string) => {
    const card: HTMLElement | null = document.querySelector(`.java-version-card[data-version="${ver}"]`) as HTMLElement | null;
    if (card?.classList.contains('installed')) {
      installed.push(ver);
    } else {
      notInstalled.push(ver);
    }
  });

  if (installed.length === javaVersions.length) {
    statusEl.innerHTML = icon('check-circle', 'icon-success') + ' ' + t('ui.all_java_versions_are_installed_any_minecraft_version_can_run');
    statusEl.style.background = 'rgba(76, 175, 80, 0.15)';
  } else {
    statusEl.textContent = t('ui.java_installed_installed_java_missing_missing', {
      installed: installed.join(', ') || t('ui.none'),
      missing: notInstalled.join(', ')
    });
    statusEl.style.background = 'rgba(79, 195, 247, 0.08)';
  }
}


export function bindJavaInstallButtons(): void {
  const buttons: NodeListOf<Element> = document.querySelectorAll('.java-install-btn');

  buttons.forEach((btn: Element) => {
    btn.addEventListener('click', async (): Promise<void> => {
      const version: string | undefined = (btn as HTMLElement).dataset.version;
      if (btn.classList.contains('installed')) {
        await uninstallJavaWithPanel(version!);
      } else {
        await installJavaWithPanel(version!);
      }
    });
  });
}


export async function installJavaWithPanel(javaVersion: string): Promise<void> {
  document.querySelectorAll('.java-install-btn').forEach((btn: Element) => {
    (btn as HTMLButtonElement).disabled = true;
  });

  try {
    const result: any = await startJavaInstall(javaVersion);
    // 失败提示由下载队列统一给出，这里只负责把卡片状态切过来
    if (!result || !result.success) return;

    const card: HTMLElement | null = document.querySelector(`.java-version-card[data-version="${javaVersion}"]`) as HTMLElement | null;
    const badge: HTMLElement | null = document.getElementById(`java-${javaVersion}-status`);
    const btn: HTMLElement | null = card?.querySelector('.java-install-btn') as HTMLElement | null;

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

    updateJavaInstallStatus();
  } catch (err: any) {
    showToast('ui.installation_failed', err.message || String(err), 'error', 'java-install-failed');
  } finally {
    document.querySelectorAll('.java-install-btn').forEach((btn: Element) => {
      if (!btn.classList.contains('installed')) {
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  }
}


export async function uninstallJavaWithPanel(javaVersion: string): Promise<void> {
  const confirmed: boolean = await showDialog({
    type: 'confirm',
    title: '确认卸载',
    message: t('ui.uninstall_java_version', { version: javaVersion })
  });

  if (!confirmed) return;

  showToast('ui.uninstalling', t('ui.uninstalling_java_version', { version: javaVersion }), 'info', 'java-uninstalling');

  try {
    const result = await window.gpcl.uninstallJava(javaVersion);

    if (result.success) {
      showToast('ui.uninstalled', t('ui.java_version_uninstalled', { version: javaVersion }), 'success', 'java-uninstall-success');

      const card: HTMLElement | null = document.querySelector(`.java-version-card[data-version="${javaVersion}"]`) as HTMLElement | null;
      const badge: HTMLElement | null = document.getElementById(`java-${javaVersion}-status`);
      const btn: HTMLElement | null = card?.querySelector('.java-install-btn') as HTMLElement | null;

      if (card) card.classList.remove('installed');
      if (badge) {
        badge.textContent = '';
        badge.className = 'java-version-badge';
      }
      if (btn) {
        btn.textContent = '安装';
        btn.classList.remove('installed');
        (btn as HTMLButtonElement).disabled = false;
      }

      updateJavaInstallStatus();
    } else {
      throw new Error(result.error || '卸载失败');
    }
  } catch (err: any) {
    showToast('ui.uninstall_failed', err.message || String(err), 'error', 'java-uninstall-failed');
  }
}


export function getRecommendedJavaVersionFromMC(mcVersion: string): { version: string; reason: string } {
  
  const parts: string[] = mcVersion.split('.');
  let major: number = parseInt(parts[0], 10);
  let minor: number = parseInt(parts[1], 10);
  let patch: number = parts.length > 2 ? parseInt(parts[2], 10) || 0 : 0;

  if (isNaN(major)) major = 1;



  
  if (isNaN(minor)) {
    
    if (major >= 26) {
      return { version: '25', reason: t('ui.java_25_is_recommended_for_minecraft_version', { version: mcVersion }) };
    }
    
    if (major >= 21) {
      return { version: '21', reason: t('ui.java_21_is_recommended_for_minecraft_version', { version: mcVersion }) };
    }
    return { version: '17', reason: '使用推荐的稳定版' };
  }

  if (major === 1) {
    if (minor <= 16) {
      return { version: '8', reason: t('ui.java_8_is_officially_recommended_for_minecraft_version', { version: mcVersion }) };
    } else if (minor <= 20 || (minor === 20 && patch <= 4)) {
      return { version: '17', reason: t('ui.java_17_is_officially_recommended_for_minecraft_version', { version: mcVersion }) };
    } else if (minor === 20 && patch >= 5) {
      return { version: '21', reason: t('ui.java_21_is_recommended_for_minecraft_version', { version: mcVersion }) };
    } else if (minor >= 21) {
      return { version: '21', reason: t('ui.java_21_is_recommended_for_minecraft_version', { version: mcVersion }) };
    }
  }

  if (major >= 2) {
    
    if (major >= 26) {
      return { version: '25', reason: t('ui.java_25_is_recommended_for_minecraft_version', { version: mcVersion }) };
    }
    return { version: '21', reason: t('ui.java_21_is_recommended_for_minecraft_version', { version: mcVersion }) };
  }

  return { version: '17', reason: '使用推荐的稳定版' };
}


if (window.gpcl && window.gpcl.onDownloadProgress) {
  window.gpcl.onDownloadProgress((data: any): void => {
    const downloadPanelEl: HTMLElement | null = document.getElementById('download-panel');
    const panelVisible: boolean = !!downloadPanelEl && !downloadPanelEl.classList.contains('hidden');
    const floatNotification: HTMLElement | null = document.getElementById('float-notification');
    const floatVisible: boolean = !!floatNotification && !floatNotification.classList.contains('hidden');
    // 游戏版本 / Java 下载走底部下载条，这里只服务启动器更新自己的下载面板
    if (!panelVisible && !floatVisible) return;

    const progressFill: HTMLElement | null = document.getElementById('progress-fill');
    const progressText: HTMLElement | null = document.getElementById('progress-text');
    const filenameEl: HTMLElement | null = document.getElementById('download-filename');
    const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');

    if (progressFill && progressText) {
      const percent: number = data.percent || 0;
      progressFill.style.width = percent + '%';
      progressText.textContent = percent.toFixed(1) + '%';
    }
    if (data.label && filenameEl) {
      filenameEl.textContent = data.label;
    }
    if (data.label && downloadStatusEl) {
      downloadStatusEl.textContent = t('ui.downloading_label_2', { label: data.label });
    }

    const floatProgressFill: HTMLElement | null = document.getElementById('float-progress-fill');
    const floatProgressText: HTMLElement | null = document.getElementById('float-progress-text');

    if (floatProgressFill && floatProgressText && floatVisible) {
      const percent: number = data.percent || 0;
      floatProgressFill.style.width = percent + '%';
      floatProgressText.textContent = percent.toFixed(1) + '%';
    }
  });
}


export async function saveJavaMirrorSettings(mirror: string, customUrl: string): Promise<void> {
  const settings = await loadSettings();
  settings.download.javaMirror = mirror;
  settings.download.customJavaMirror = customUrl;
  await gpcl.saveSettings(settings);
}
