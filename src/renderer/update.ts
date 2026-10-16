/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { initChart, loadChartJs, resetChart, updateChart } from './chart';
import { setStatus, showDialog, showToast } from './dom';
import { updateSettingsBadge } from './settings';
// __IMPORTS_END__

export let isUpdateDownloadActive: boolean = false;


export let latestVersion: string | null = null;

export let latestVersionLog: string | null = null;

export let updateAvailable: boolean = false;

export let allNewerVersions: any[] = [];


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
  const versions: { version: string; title: string; log: string }[] = [];
  let current: { version: string; title: string; log: string } | null = null;

  for (const item of launcherData) {
    if (item.name === 'version' && item.key) {
      if (current) versions.push(current);
      current = { version: item.key, title: '', log: '' };
    } else if (current) {
      if (item.name === 'versionlog' && item.key) {
        current.log = item.key;
      } else if (item.name === 'versiontitle' && item.key) {
        current.title = item.key;
      } else if (!item.key && item.name && item.name !== 'versionlog' && item.name !== 'versiontitle') {
        current.title = item.name;
      }
    }
  }
  if (current) versions.push(current);
  return versions;
}


export function renderUpdateVersionCards(newerVersions: any[]): string {
  if (!newerVersions || newerVersions.length === 0) return '';

  const cards: string = newerVersions.map((v: any, index: number) => {
    const isNewest: boolean = index === newerVersions.length - 1;
    const titleHtml: string = v.title ? `<div class="update-card-title">${v.title}</div>` : '';
    const logHtml: string = v.log ? `<div class="update-card-log">${v.log}</div>` : '';
    return `<div class="update-version-card ${isNewest ? 'newest' : ''}">` +
      `<div class="update-card-header"><span class="update-card-version">${v.version}</span>` +
      `${isNewest ? '<span class="update-card-badge">最新</span>' : ''}</div>` +
      `${titleHtml}${logHtml}</div>`;
  }).reverse().join('');

  return `<div class="update-versions-list">${cards}</div>`;
}


export async function checkForUpdates(silent: boolean = false): Promise<void> {
  setStatus('[版本检查] 开始检查更新...');
  
  try {
    const result = await window.gpcl.checkForUpdates();
    
    if (!result.success) {
      throw new Error(result.error || '检查更新失败');
    }
    
    const data = result.data;
    const launcherData = data.Launcher || [];
    
    const parsedVersions = parseLauncherVersions(launcherData);
    
    if (parsedVersions.length === 0) throw new Error('无法获取版本信息');
    
    latestVersion = parsedVersions[0].version;
    latestVersionLog = parsedVersions[0].log;
    
    const currentVersion: string = await getCurrentVersion();
    setStatus(`[版本检查] 当前版本: ${currentVersion}, 最新版本: ${latestVersion}`);
    
    allNewerVersions = parsedVersions
      .filter((v: any) => compareVersions(currentVersion, v.version) > 0)
      .sort((a: any, b: any) => compareVersions(b.version, a.version));
    
    updateAvailable = allNewerVersions.length > 0;
    
    setStatus(`[版本检查] 有更新: ${updateAvailable}, 新版本数: ${allNewerVersions.length}`);
    
    if (!silent) {
      if (updateAvailable) {
        setStatus(`发现 ${allNewerVersions.length} 个新版本`, 'warning');
      } else {
        setStatus('当前已是最新版本', 'success');
      }
    }
    
    if (updateAvailable && silent) {
      const newest = allNewerVersions[allNewerVersions.length - 1];
      const titlePart: string = newest.title ? ` "${newest.title}"` : '';
      showToast('发现新版本', `GPCL ${newest.version}${titlePart} 已发布`, 'warning', 'update-available');
    }
    
    await updateSettingsBadge();
    
  } catch (e: any) {
    setStatus(`[版本检查] 错误: ${e.message}`, 'error');
    console.error('[版本检查] 详细错误:', e);
    if (!silent) {
      setStatus('检查更新失败: ' + e.message, 'error');
    }
    updateAvailable = false;
    allNewerVersions = [];
    await updateSettingsBadge();
  }
}

// ===== 应用内更新下载 =====


export async function startUpdateDownload(version: string): Promise<void> {
  if (!window.gpcl || !window.gpcl.downloadUpdate) {
    showToast('更新失败', '更新功能不可用', 'error');
    return;
  }

  isUpdateDownloadActive = true;

  await loadChartJs();
  initChart();
  resetChart();

  const downloadPanelEl: HTMLElement | null = document.getElementById('download-panel');
  const filenameEl: HTMLElement | null = document.getElementById('download-filename');
  const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
  const progressFill: HTMLElement | null = document.getElementById('progress-fill');
  const progressText: HTMLElement | null = document.getElementById('progress-text');
  const cancelBtn: HTMLElement | null = document.getElementById('cancel-download-btn');

  if (downloadPanelEl) downloadPanelEl.classList.remove('hidden');
  if (filenameEl) filenameEl.textContent = `正在下载: GPCL ${version} 安装程序`;
  if (downloadStatusEl) downloadStatusEl.textContent = `正在下载 GPCL ${version} ...`;
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
      if (progressFill) progressFill.style.width = percent + '%';
      if (progressText) progressText.textContent = percent.toFixed(1) + '%';
      if (downloadStatusEl) downloadStatusEl.textContent = `正在下载 GPCL ${version}: ${percent.toFixed(1)}%`;

      const currentSpeedEl: HTMLElement | null = document.getElementById('current-speed');
      const peakSpeedEl: HTMLElement | null = document.getElementById('peak-speed');
      if (data.bytesDownloaded && data.totalBytes) {
        const now: number = Date.now();
        if (lastTime > 0 && now > lastTime) {
          const timeDiff: number = (now - lastTime) / 1000;
          if (timeDiff >= 0.5) {
            const bytesDiff: number = data.bytesDownloaded - lastBytes;
            if (bytesDiff >= 0) {
              const speedBps: number = Math.max(0, (bytesDiff * 8) / timeDiff / 1000000);
              if (currentSpeedEl) currentSpeedEl.textContent = speedBps.toFixed(2) + ' Mbps';
              if (speedBps > peakSpeedInner) {
                peakSpeedInner = speedBps;
                if (peakSpeedEl) peakSpeedEl.textContent = peakSpeedInner.toFixed(2) + ' Mbps';
              }
              updateChart(speedBps);
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
    if (downloadStatusEl) downloadStatusEl.textContent = '下载已取消';
    showToast('已取消', '更新下载已取消', 'info');
    if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
  };
  if (cancelBtn) {
    cancelBtn.onclick = handleCancel as any;
  }

  try {
    const result = await window.gpcl.downloadUpdate(version);

    if (result.success) {
      if (downloadStatusEl) downloadStatusEl.textContent = '下载完成，正在校验...';
      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = '100%';

      const verifyResult = await window.gpcl.verifyUpdateSHA1(result.filePath);
      let sha1Ok: boolean = verifyResult.success;
      let sha1Message: string = '下载完成';

      if (!sha1Ok) {
        const proceed: boolean = await showDialog({
          type: 'warning',
          title: '文件校验异常',
          message: `SHA1校验未通过：${verifyResult.error || '无法获取校验信息'}\n\n文件可能不完整或已损坏，是否仍要继续安装？`,
          confirmText: '继续安装',
          cancelText: '取消'
        });
        if (!proceed) {
          if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
          showToast('已取消', '更新安装已取消', 'info');
          return;
        }
        sha1Message = '校验异常，已跳过';
      } else {
        sha1Message = '下载完成，校验通过';
      }

      if (downloadStatusEl) downloadStatusEl.textContent = sha1Message + '，准备安装...';
      if (cancelBtn) {
        cancelBtn.textContent = '下载完成';
        cancelBtn.classList.add('complete');
        (cancelBtn as HTMLButtonElement).disabled = true;
        cancelBtn.onclick = null;
      }

      const userConfirmed: boolean = await showDialog({
        type: 'confirm',
        title: '更新就绪',
        message: 'GoodPlanCraftLauncher 已经准备好全新的开始，接下来需要重新启动，是否继续？',
        confirmText: '继续更新',
        cancelText: '稍后'
      });

      if (userConfirmed) {
        if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
        const execResult = await window.gpcl.executeUpdateInstaller(result.filePath);
        if (execResult.success) {
          showToast('正在更新', '启动器即将关闭并开始安装...', 'info');
          setTimeout(() => {
            if (window.gpcl.closeWindow) window.gpcl.closeWindow();
          }, 1000);
        } else {
          showToast('执行失败', execResult.error || '无法启动安装程序', 'error');
        }
      } else {
        await window.gpcl.setUpdateShutdownHook(result.filePath);
        if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
        showToast('已记住', '关闭启动器时将自动执行更新', 'info');
      }
    } else if (result.cancelled) {
      if (downloadPanelEl) downloadPanelEl.classList.add('hidden');
      if (downloadStatusEl) downloadStatusEl.textContent = '下载已取消';
    } else {
      throw new Error(result.error || '下载失败');
    }
  } catch (err: any) {
    if (downloadStatusEl) downloadStatusEl.textContent = `下载失败: ${err.message}`;
    showToast('更新下载失败', err.message, 'error');
    if (cancelBtn) {
      (cancelBtn as HTMLButtonElement).disabled = true;
      cancelBtn.onclick = null;
    }
  } finally {
    isUpdateDownloadActive = false;
  }
}


// ===== 应用内更新下载结束 =====

