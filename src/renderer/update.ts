/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { getLocale, t } from '../i18n';
import { initChart, loadChartJs, resetChart, updateChart } from './chart';
import { formatSpeed } from './speed';
import { setStatus, showDialog, showToast } from './dom';
import { updateSettingsBadge } from './settings';
import { setUpdateBadgeAvailable, setUpdateBadgeDownloading, setUpdateBadgeFailed, setUpdateBadgeProgress, setUpdateBadgeReady, showUpdateBadge } from './update-badge';
// __IMPORTS_END__

export let isUpdateDownloadActive: boolean = false;


export let latestVersion: string | null = null;

export let latestVersionLog: string | null = null;

export let updateAvailable: boolean = false;

export let allNewerVersions: any[] = [];

let readyInstallerPath: string | null = null;

let readyVersionInMemory: string | null = null;


export async function getCurrentVersion(): Promise<string> {
  try {
    if (window.gpcl && window.gpcl.getAppVersion) {
      return await window.gpcl.getAppVersion();
    }
  } catch (e: any) {}
  return '1.0.0';
}


export function compareVersions(current: string, latest: string): number {
  const currentParts: number[] = current.split('.').map(Number);
  const latestParts: number[] = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c: number = currentParts[i] || 0;
    const l: number = latestParts[i] || 0;
    if (l > c) return 1;
    if (c > l) return -1;
  }
  return 0;
}


export function parseLauncherVersions(launcherData: any[]): { version: string; title: string; log: string }[] {
  const versions: { version: string; title: string; log: string; titleEn: string; logEn: string }[] = [];
  let current: { version: string; title: string; log: string; titleEn: string; logEn: string } | null = null;

  for (const item of launcherData) {
    if (item.name === 'version' && item.key) {
      if (current) versions.push(current);
      current = { version: item.key, title: '', log: '', titleEn: '', logEn: '' };
    } else if (current) {
      if (item.name === 'versionlog' && item.key) {
        current.log = item.key;
      } else if (item.name === 'versionlog_en' && item.key) {
        current.logEn = item.key;
      } else if (item.name === 'versiontitle' && item.key) {
        current.title = item.key;
      } else if (item.name === 'versiontitle_en' && item.key) {
        current.titleEn = item.key;
      } else if (!item.key && item.name && item.name !== 'versionlog' && item.name !== 'versiontitle') {
        current.title = item.name;
      }
    }
  }
  if (current) versions.push(current);

  const english: boolean = getLocale() === 'en-US';
  return versions.map((version) => ({
    version: version.version,
    title: english && version.titleEn ? version.titleEn : version.title,
    log: english && version.logEn ? version.logEn : version.log
  }));
}


export function renderUpdateVersionCards(newerVersions: any[]): string {
  if (!newerVersions || newerVersions.length === 0) return '';

  const cards: string = newerVersions.map((v: any, index: number) => {
    const isNewest: boolean = index === newerVersions.length - 1;
    const titleHtml: string = v.title ? `<div class="update-card-title">${v.title}</div>` : '';
    const logHtml: string = v.log ? `<div class="update-card-log">${v.log}</div>` : '';
    return `<div class="update-version-card ${isNewest ? 'newest' : ''}">` +
      `<div class="update-card-header"><span class="update-card-version">${v.version}</span>` +
      `${isNewest ? `<span class="update-card-badge">${t('ui.newest')}</span>` : ''}</div>` +
      `${titleHtml}${logHtml}</div>`;
  }).reverse().join('');

  return `<div class="update-versions-list">${cards}</div>`;
}


export async function checkForUpdates(silent: boolean = false): Promise<void> {
  setStatus(t('ui.update_check_checking_for_updates'));
  
  try {
    const result = await window.gpcl.checkForUpdates(getLocale());
    
    if (!result.success) {
      throw new Error(result.error || t('ui.could_not_check_for_updates'));
    }
    
    const data = result.data;
    const parsedVersions = Array.isArray(data.versions)
      ? data.versions.map((version: any) => ({
          version: String(version.version || ''),
          title: String(version.title || ''),
          log: Array.isArray(version.log) ? version.log.join('<br>') : String(version.log || '')
        }))
      : parseLauncherVersions(data.Launcher || []);
    
    if (parsedVersions.length === 0) throw new Error(t('ui.could_not_get_version_information'));
    
    latestVersion = parsedVersions[0].version;
    latestVersionLog = parsedVersions[0].log;
    
    const currentVersion: string = await getCurrentVersion();
    setStatus(t('ui.update_check_current_current_latest_latest', { current: currentVersion, latest: latestVersion }));
    
    allNewerVersions = parsedVersions
      .filter((v: any) => compareVersions(currentVersion, v.version) > 0)
      .sort((a: any, b: any) => compareVersions(b.version, a.version));
    
    updateAvailable = allNewerVersions.length > 0;
    
    setStatus(t('ui.update_check_update_available_available_newer_versions_count', { available: updateAvailable, count: allNewerVersions.length }));
    
    if (!silent) {
      if (updateAvailable) {
        setStatus(t('ui.count_new_version_s_available', { count: allNewerVersions.length }), 'warning');
      } else {
        setStatus('当前已是最新版本', 'success');
      }
    }
    
    if (updateAvailable) {
      const newest = allNewerVersions[allNewerVersions.length - 1];
      if (readyVersionInMemory && readyVersionInMemory !== newest.version) {
        readyVersionInMemory = null;
        readyInstallerPath = null;
        setUpdateBadgeAvailable();
      }
      showUpdateBadge(newest.version, newest.title, newest.log);
    }
    
    await updateSettingsBadge();
    
  } catch (e: any) {
    setStatus(t('ui.update_check_error_message', { message: e.message }), 'error');
    console.error('[版本检查] 详细错误:', e);
    if (!silent) {
      setStatus(t('ui.could_not_check_for_updates_message', { message: e.message }), 'error');
    }
    updateAvailable = false;
    allNewerVersions = [];
    await updateSettingsBadge();
  }
}


async function installNow(installerPath: string): Promise<void> {
  const result = await window.gpcl.installUpdate(installerPath, true);
  if (result && result.success) {
    showToast('ui.updating', '启动器即将关闭并安装新版本...', 'info');
    setTimeout((): void => {
      if (window.gpcl.closeWindow) window.gpcl.closeWindow();
    }, 800);
  } else {
    showToast('ui.failed_2', (result && result.error) || '无法启动安装程序', 'error');
  }
}


export async function installReadyUpdate(): Promise<void> {
  if (!readyInstallerPath) {
    try {
      const state: any = await window.gpcl.getUpdateState();
      readyInstallerPath = (state && state.readyInstallerPath) || null;
    } catch (e: any) {}
  }
  if (readyInstallerPath) await installNow(readyInstallerPath);
}


export async function showUpdateStartupNotice(): Promise<void> {
  try {
    if (!window.gpcl || !window.gpcl.getUpdateState) return;
    const state: any = await window.gpcl.getUpdateState();
    if (!state || !state.success) return;

    if (state.justUpdatedTo) {
      showToast('ui.update_complete', t('ui.goodplancraftlauncher_updated_to_version', { version: state.justUpdatedTo }), 'success');
    }

    if (state.readyInstallerPath && state.readyVersion) {
      readyInstallerPath = state.readyInstallerPath;
      readyVersionInMemory = state.readyVersion;
      showUpdateBadge(state.readyVersion, '', '');
      setUpdateBadgeReady();
    }

    const failure: any = state.pendingFailure;
    if (!failure || !failure.installerPath) return;

    const attempts: number = failure.attempts || 0;
    if (attempts >= 3) {
      const openSite: boolean = await showDialog({
        type: 'warning',
        title: '更新未完成',
        message: t('更新已经尝试 {attempts} 次仍未完成，当前版本仍是 {version}。\n建议到官网重新下载安装包。', { attempts, version: state.currentVersion }),
        confirmText: '打开官网',
        cancelText: '稍后'
      });
      if (openSite && window.gpcl.openExternal) {
        window.gpcl.openExternal('https://gamets.caellab.com/gpcl/');
      }
      return;
    }

    const retry: boolean = await showDialog({
      type: 'warning',
      title: '上次更新未完成',
      message: t('上次更新没有完成，当前仍是 {version}。\n可以直接重试安装，游戏和设置不会受影响。', { version: state.currentVersion }),
      confirmText: '重试安装',
      cancelText: '稍后'
    });
    if (retry) await installNow(failure.installerPath);
  } catch (e: any) {
    console.error('[更新] 读取更新状态失败:', e);
  }
}


async function runUpdateDownload(version: string, manual: boolean): Promise<void> {
  if (!window.gpcl || !window.gpcl.downloadUpdate) {
    showToast('ui.update_failed', '更新功能不可用', 'error');
    return;
  }

  if (readyInstallerPath && readyVersionInMemory === version) {
    setUpdateBadgeReady();
    if (manual) await installNow(readyInstallerPath);
    return;
  }

  isUpdateDownloadActive = manual;
  setUpdateBadgeDownloading(0);

  const downloadPanelEl: HTMLElement | null = document.getElementById('download-panel');
  const filenameEl: HTMLElement | null = document.getElementById('download-filename');
  const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
  const progressFill: HTMLElement | null = document.getElementById('progress-fill');
  const progressText: HTMLElement | null = document.getElementById('progress-text');
  const cancelBtn: HTMLElement | null = document.getElementById('cancel-download-btn');

  if (manual) {
    await loadChartJs();
    initChart();
    resetChart();

    if (downloadPanelEl) downloadPanelEl.classList.remove('hidden');
    if (filenameEl) filenameEl.textContent = t('ui.downloading_the_gpcl_version_installer', { version });
    if (downloadStatusEl) downloadStatusEl.textContent = t('ui.downloading_gpcl_version', { version });
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    if (cancelBtn) {
      cancelBtn.textContent = '取消下载';
      cancelBtn.classList.remove('complete');
      (cancelBtn as HTMLButtonElement).disabled = false;
    }

    if (window.gpcl.onUpdateDownloadProgress) {
      let lastTime: number = 0;
      let lastBytes: number = 0;
      let peakSpeedInner: number = 0;

      window.gpcl.onUpdateDownloadProgress((data: any): void => {
        const percent: number = data.percent || 0;
        setUpdateBadgeProgress(percent);
        if (progressFill) progressFill.style.width = percent + '%';
        if (progressText) progressText.textContent = percent.toFixed(1) + '%';
        if (downloadStatusEl) {
          downloadStatusEl.textContent = percent >= 100
            ? t('ui.download_complete_verifying_the_installer')
            : t('ui.downloading_gpcl_version_percent', { version, percent: percent.toFixed(1) });
        }

        const currentSpeedEl: HTMLElement | null = document.getElementById('current-speed');
        const peakSpeedEl: HTMLElement | null = document.getElementById('peak-speed');
        if (data.bytesDownloaded && data.totalBytes) {
          const now: number = Date.now();
          if (lastTime > 0 && now > lastTime) {
            const timeDiff: number = (now - lastTime) / 1000;
            if (timeDiff >= 0.5) {
              const bytesDiff: number = data.bytesDownloaded - lastBytes;
              if (bytesDiff >= 0) {
                const speedBytes: number = Math.max(0, bytesDiff / timeDiff);
                if (currentSpeedEl) currentSpeedEl.textContent = formatSpeed(speedBytes);
                if (speedBytes > peakSpeedInner) {
                  peakSpeedInner = speedBytes;
                  if (peakSpeedEl) peakSpeedEl.textContent = formatSpeed(peakSpeedInner);
                }
                updateChart(speedBytes);
              }
              lastTime = now;
              lastBytes = data.bytesDownloaded;
            }
          } else {
            lastTime = now;
            lastBytes = data.bytesDownloaded;
          }
        }
      });
    }

    const handleCancel = async (): Promise<void> => {
      if (window.gpcl.cancelUpdateDownload) {
        await window.gpcl.cancelUpdateDownload();
      }
      if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
      if (downloadStatusEl) downloadStatusEl.textContent = t('ui.download_cancelled');
      showToast('ui.cancelled', '更新下载已取消', 'info');
      if (cancelBtn) cancelBtn.onclick = null;
    };
    if (cancelBtn) {
      cancelBtn.onclick = handleCancel as any;
    }
  } else if (window.gpcl.onUpdateDownloadProgress) {
    window.gpcl.onUpdateDownloadProgress((data: any): void => {
      setUpdateBadgeProgress(data.percent || 0);
    });
  }

  try {
    const result: any = await window.gpcl.downloadUpdate(version, manual);

    if (result.success) {
      if (manual) {
        if (downloadStatusEl) downloadStatusEl.textContent = '校验通过，正在安装...';
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        if (cancelBtn) {
          cancelBtn.textContent = '下载完成';
          cancelBtn.classList.add('complete');
          (cancelBtn as HTMLButtonElement).disabled = true;
          cancelBtn.onclick = null;
        }
        if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
        readyInstallerPath = result.filePath;
        readyVersionInMemory = version;
        setUpdateBadgeReady();
        await installNow(result.filePath);
      } else {
        const hookResult: any = await window.gpcl.setUpdateShutdownHook(result.filePath, false);
        if (hookResult && hookResult.success) {
          readyInstallerPath = result.filePath;
          readyVersionInMemory = version;
          setUpdateBadgeReady();
        } else {
          console.error('[更新] 设置关闭安装失败:', hookResult && hookResult.error);
          setUpdateBadgeFailed((hookResult && hookResult.error) || '无法准备安装');
        }
      }
    } else if (result.cancelled) {
      setUpdateBadgeAvailable();
      if (manual) {
        if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
        if (downloadStatusEl) downloadStatusEl.textContent = '下载已取消';
      }
    } else {
      throw new Error(result.error || t('ui.download_failed'));
    }
  } catch (err: any) {
    setUpdateBadgeFailed(err.message);
    if (manual && downloadStatusEl) downloadStatusEl.textContent = t('ui.download_failed_message', { message: err.message });
    if (manual) {
      if (cancelBtn) {
        (cancelBtn as HTMLButtonElement).disabled = true;
        cancelBtn.onclick = null;
      }
      if (/校验|verif/i.test(err.message)) {
        const retry: boolean = await showDialog({
          type: 'warning',
          title: '更新包校验失败',
          message: '下载的安装包校验未通过，可能没有下载完整，是否重新下载？',
          confirmText: '重新下载',
          cancelText: '取消'
        });
        if (retry) {
          isUpdateDownloadActive = false;
          await runUpdateDownload(version, true);
          return;
        }
      }
      showToast('ui.update_download_failed', err.message, 'error');
    } else {
      console.error('[更新] 后台下载失败:', err.message);
    }
  } finally {
    isUpdateDownloadActive = false;
  }
}


export async function startUpdateDownload(version: string): Promise<void> {
  await runUpdateDownload(version, true);
}


export async function autoDownloadUpdate(version: string): Promise<void> {
  await runUpdateDownload(version, false);
}
