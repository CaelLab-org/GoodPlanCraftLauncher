/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, dialog, ipcMain, net } from 'electron';
import fs from 'fs';
import path from 'path';

import { APP_VERSION, CACHE_DIR, GAME_DIR, applyInitialVersionIsolation, formatTimestamp, loadSettings, setVersionIsolationChoice, writeLog } from './config';
import { t } from './i18n';
import { installVersionWithModLoader } from './modloader';
import { mainWindow } from './shell';
import { MAX_CONCURRENT, activeDownloads, abortModDownloads, completedDownloadFiles, currentDownloadPath, currentDownloadType, currentDownloadVersion, downloadQueue, isDownloading, isJavaDownloading, setActiveDownloads, setCompletedDownloadFiles, setCurrentDownloadPath, setCurrentDownloadType, setCurrentDownloadVersion, setDownloadQueue, setIsDownloading, setIsJavaDownloading, setMaxConcurrent, setShouldCancelDownload, setTotalDownloadFiles, shouldCancelDownload, totalDownloadFiles } from './state';
// __IMPORTS_END__

ipcMain.handle('confirm-close-download', async () => {
  if (isDownloading && currentDownloadVersion) {
setShouldCancelDownload(true);
    try {
      const versionDir = currentDownloadPath || path.join(GAME_DIR, 'versions', currentDownloadVersion);
      const cancelFilePath = path.join(versionDir, 'CancelDownload.txt');
      const cancelContent = t('GoodPlanCraftLauncher {version}\n取消时间：{time}\n\n正确的关闭\n您在下载完成前正确地关闭了 GPCL。', { version: APP_VERSION, time: formatTimestamp() });
      if (fs.existsSync(versionDir)) {
        fs.writeFileSync(cancelFilePath, cancelContent, 'utf8');
        const files = fs.readdirSync(versionDir);
        for (const file of files) {
          const filePath = path.join(versionDir, file);
          if (file !== 'CancelDownload.txt') {
            if (fs.statSync(filePath).isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
          }
        }
      }
      writeLog(`已清理游戏版本下载目录: ${versionDir}`);
    } catch (e: any) {
      console.error('清理下载失败:', e);
      writeLog(`清理下载失败: ${e.message}`);
    }
setIsDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
  }
  if (mainWindow) mainWindow.destroy();
  return { success: true };
});


ipcMain.handle('cancel-close', () => ({ success: true }));


ipcMain.handle('cancel-download-only', async () => {
  writeLog('[取消下载] 开始取消下载流程');

setShouldCancelDownload(true);
abortModDownloads();

  const pendingCount: number = downloadQueue.length;
setDownloadQueue([]);
  writeLog(`[取消下载] 已清空 ${pendingCount} 个待处理下载任务`);

  const waitStart: number = Date.now();
  while (activeDownloads > 0 && (Date.now() - waitStart) < 2000) {
    await new Promise<void>(r => setTimeout(r, 100));
  }
  writeLog(`[取消下载] 活跃下载数: ${activeDownloads}`);
  
  if ((isDownloading && currentDownloadVersion) || isJavaDownloading) {
    try {
      if (currentDownloadType === 'game' && currentDownloadPath) {
        
        const versionDir: string = currentDownloadPath;
        if (fs.existsSync(versionDir)) {
          const files: string[] = fs.readdirSync(versionDir);
          for (const file of files) {
            const filePath: string = path.join(versionDir, file);
            try {
              if (fs.statSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (e: any) {
              writeLog(`清理文件失败: ${filePath} - ${e.message}`);
            }
          }
        }
        writeLog(`[取消下载] 已清理游戏版本下载目录: ${versionDir}`);
      } else if (currentDownloadType === 'java' && currentDownloadPath) {
        
        const javaFile: string = currentDownloadPath;
        if (fs.existsSync(javaFile)) {
          try {
            fs.unlinkSync(javaFile);
            writeLog(`[取消下载] 已清理Java下载文件: ${javaFile}`);
          } catch (e: any) {
            writeLog(`清理Java文件失败: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      console.error('清理下载失败:', e);
      writeLog(`清理下载失败: ${e.message}`);
    }

setIsDownloading(false);
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
setActiveDownloads(0);
setTotalDownloadFiles(0);
setCompletedDownloadFiles(0);
  }

  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('download-cancelled');
  }
  
  writeLog('[取消下载] 取消下载流程完成');
  return { success: true };
});


export type DownloadSourcePolicy = 'auto' | 'mirror-first' | 'official-first' | 'official-only';

let fileSourcePolicy: DownloadSourcePolicy = 'auto';
let versionSourcePolicy: DownloadSourcePolicy = 'auto';
let speedLimitBytes: number = 0;
let speedTokens: number = 0;
let speedLastRefill: number = Date.now();
let customFileMirror: string = '';

function normalizeSourcePolicy(value: any): DownloadSourcePolicy {
  return value === 'mirror-first' || value === 'official-first' || value === 'official-only' ? value : 'auto';
}

export function loadDownloadSettings(): void {
  try {
    const settings: any = loadSettings();
    fileSourcePolicy = normalizeSourcePolicy(settings.download?.fileSource);
    versionSourcePolicy = normalizeSourcePolicy(settings.download?.versionSource);
    customFileMirror = String(settings.download?.customFileMirror || '').trim().replace(/\/+$/, '');
    setDownloadSpeedLimit(Number(settings.download?.speedLimit) || 0);
  } catch {}
}

export function setDownloadSpeedLimit(megabytesPerSecond: number): void {
  speedLimitBytes = Math.max(0, megabytesPerSecond) * 1024 * 1024;
  speedTokens = speedLimitBytes;
  speedLastRefill = Date.now();
}

async function consumeDownloadTokens(bytes: number): Promise<void> {
  if (speedLimitBytes <= 0) return;
  while (true) {
    const now: number = Date.now();
    speedTokens = Math.min(speedLimitBytes, speedTokens + ((now - speedLastRefill) / 1000) * speedLimitBytes);
    speedLastRefill = now;
    if (speedTokens >= bytes) {
      speedTokens -= bytes;
      return;
    }
    const waitMs: number = Math.ceil(((bytes - speedTokens) / speedLimitBytes) * 1000);
    await new Promise<void>((resolve) => setTimeout(resolve, Math.max(10, waitMs)));
  }
}

export function mirrorUrlFor(url: string, base: string = 'https://bmclapi2.bangbang93.com'): string | null {
  try {
    const parsed: URL = new URL(url);
    if (['piston-meta.mojang.com', 'launchermeta.mojang.com', 'launcher.mojang.com', 'piston-data.mojang.com'].includes(parsed.hostname)) {
      return `${base}${parsed.pathname}${parsed.search}`;
    }
    if (['libraries.minecraft.net', 'maven.minecraftforge.net', 'maven.fabricmc.net', 'maven.neoforged.net'].includes(parsed.hostname)) {
      return `${base}/maven${parsed.pathname}${parsed.search}`;
    }
    if (parsed.hostname === 'resources.download.minecraft.net') {
      return `${base}/assets${parsed.pathname}${parsed.search}`;
    }
  } catch {}
  return null;
}

function buildSourceUrls(url: string, policy: DownloadSourcePolicy, extraMirror?: string): string[] {
  const mirror: string | null = (customFileMirror ? mirrorUrlFor(url, customFileMirror) : null) || extraMirror || mirrorUrlFor(url);
  if (!mirror) return [url];
  if (policy === 'official-only') return [url];
  if (policy === 'mirror-first') return [mirror, url];
  return [url, mirror];
}

function sourceTimeout(policy: DownloadSourcePolicy, isOfficial: boolean, kind: 'text' | 'file'): number {
  if (policy === 'auto' && isOfficial) return kind === 'text' ? 8000 : 15000;
  return kind === 'text' ? 20000 : 60000;
}

function fetchTextOnce(url: string, timeoutMs: number, redirectsLeft: number = 3): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled: boolean = false;
    const done = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    const fallbackToHttps = (reason: any): void => {
      if (settled) return;
      try {
        const https = require('https');
        const req2 = https.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res2: any) => {
          const status: number = res2.statusCode || 0;
          if (status >= 300 && status < 400 && res2.headers.location && redirectsLeft > 0) {
            const nextUrl: string = new URL(res2.headers.location, url).toString();
            res2.resume();
            done(() => resolve(fetchTextOnce(nextUrl, timeoutMs, redirectsLeft - 1)));
            return;
          }
          if (status >= 400) {
            res2.resume();
            done(() => reject(new Error(`HTTP ${status}`)));
            return;
          }
          let body: string = '';
          res2.on('data', (d: any) => body += d);
          res2.on('end', () => done(() => resolve(body)));
          res2.on('error', (err2: any) => done(() => reject(err2)));
        });
        req2.on('timeout', () => { req2.destroy(); done(() => reject(reason || '超时')); });
        req2.on('error', (err2: any) => done(() => reject(err2)));
      } catch (e2: any) {
        done(() => reject(e2));
      }
    };

    try {
      const req = net.request(url);
      const timer: any = setTimeout(() => { try { req.abort(); } catch {} ; fallbackToHttps('超时'); }, timeoutMs);

      req.on('response', (res: any) => {
        clearTimeout(timer);
        const status: number = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
          const nextUrl: string = new URL(res.headers.location, url).toString();
          res.resume();
          done(() => resolve(fetchTextOnce(nextUrl, timeoutMs, redirectsLeft - 1)));
          return;
        }
        if (status >= 400) {
          res.resume();
          done(() => reject(new Error(`HTTP ${status}`)));
          return;
        }
        let body: string = '';
        res.on('data', (d: any) => body += d);
        res.on('end', () => done(() => resolve(body)));
        res.on('error', (err: any) => fallbackToHttps(err));
      });

      req.on('error', (err: any) => { clearTimeout(timer); fallbackToHttps(err); });
      req.end();
    } catch (e: any) {
      fallbackToHttps(e);
    }
  });
}

export async function fetchText(url: string, sources?: string[]): Promise<string> {
  const list: string[] = sources && sources.length > 0 ? sources : buildSourceUrls(url, versionSourcePolicy);
  let lastError: any = null;

  for (const candidate of list) {
    try {
      const isOfficial: boolean = candidate === url;
      return await fetchTextOnce(candidate, sourceTimeout(versionSourcePolicy, isOfficial, 'text'));
    } catch (error: any) {
      lastError = error;
      writeLog(`[下载] 文本源失败: ${candidate} - ${error.message}`);
    }
  }

  throw lastError || new Error('Request failed');
}


let overallProgressMode: boolean = false;

export function setOverallProgressMode(value: boolean): void {
  overallProgressMode = value;
}

/**
 * 下载进度统一在这里汇总：每个分片只更新内存里的计数，真正发 IPC 按 120ms 节流。
 * 以前每收到一块数据就给渲染层发一次（并发 20 时一秒几千条），进度条会被刷得看不清，
 * 而且渲染层用「单个文件的 loaded」算速度，一换文件就变成负数直接罢工。
 * 现在百分比按总字节数算、速度按总已完成字节算，跟具体下到哪个文件无关。
 */
interface ActiveTransfer {
  label: string;
  loaded: number;
  size: number;
}

const activeTransfers: Map<string, ActiveTransfer> = new Map();
let progressTotalBytes: number = 0;
let progressDoneBytes: number = 0;
let progressKnownFiles: number = 0;
let progressSessionActive: boolean = false;
let progressStageLabel: string = '';
let progressCurrentLabel: string = '';
let progressLabelAt: number = 0;
let progressLastSentAt: number = 0;
let progressSampleAt: number = 0;
let progressSampleBytes: number = 0;
let progressSpeed: number = 0;
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;

function clearProgressTimer(): void {
  if (progressFlushTimer) {
    clearTimeout(progressFlushTimer);
    progressFlushTimer = null;
  }
}

function ensureProgressSession(): void {
  if (progressSessionActive) return;
  progressSessionActive = true;
  progressTotalBytes = 0;
  progressDoneBytes = 0;
  progressKnownFiles = 0;
  progressSpeed = 0;
  progressSampleAt = Date.now();
  progressSampleBytes = 0;
}

export function beginProgressSession(totalBytes: number, totalFiles: number): void {
  clearProgressTimer();
  activeTransfers.clear();
  progressSessionActive = true;
  progressTotalBytes = Math.max(0, totalBytes);
  progressDoneBytes = 0;
  progressKnownFiles = Math.max(0, totalFiles);
  progressStageLabel = '';
  progressCurrentLabel = '';
  progressLabelAt = 0;
  progressLastSentAt = 0;
  progressSampleAt = Date.now();
  progressSampleBytes = 0;
  progressSpeed = 0;
  setTotalDownloadFiles(totalFiles);
  setCompletedDownloadFiles(0);
}

export function setProgressStage(label: string): void {
  ensureProgressSession();
  progressStageLabel = label;
  progressCurrentLabel = label;
  progressLabelAt = Date.now();
  progressLastSentAt = 0;
  flushProgress();
}

export function finishProgressSession(): void {
  if (!progressSessionActive) return;
  activeTransfers.clear();
  const total: number = progressTotalBytes;
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('download-progress', {
      label: '',
      percent: 100,
      bytesDownloaded: total,
      totalBytes: total,
      speed: 0,
      current: totalDownloadFiles,
      total: totalDownloadFiles
    });
  }
  resetProgressSession();
}

export function resetProgressSession(): void {
  clearProgressTimer();
  activeTransfers.clear();
  progressSessionActive = false;
  progressTotalBytes = 0;
  progressDoneBytes = 0;
  progressKnownFiles = 0;
  progressStageLabel = '';
  progressCurrentLabel = '';
  progressSpeed = 0;
}

function currentTransferLabel(now: number): string {
  let picked: ActiveTransfer | null = null;
  for (const transfer of activeTransfers.values()) {
    if (!picked || transfer.size > picked.size) picked = transfer;
  }
  if (picked && picked.label !== progressCurrentLabel && now - progressLabelAt > 700) {
    progressCurrentLabel = picked.label;
    progressLabelAt = now;
  } else if (!picked && progressCurrentLabel && now - progressLabelAt > 700) {
    progressCurrentLabel = '';
  }
  return progressCurrentLabel || progressStageLabel;
}

function flushProgress(): void {
  if (!progressSessionActive) return;

  const now: number = Date.now();
  let activeLoaded: number = 0;
  for (const transfer of activeTransfers.values()) activeLoaded += transfer.loaded;
  const done: number = progressDoneBytes + activeLoaded;

  let percent: number = 0;
  if (overallProgressMode && totalDownloadFiles > 0) {
    percent = (completedDownloadFiles / totalDownloadFiles) * 100;
  } else if (progressTotalBytes > 0) {
    percent = (done / progressTotalBytes) * 100;
  } else if (progressKnownFiles > 1) {
    percent = (completedDownloadFiles / progressKnownFiles) * 100;
  } else {
    for (const transfer of activeTransfers.values()) {
      if (transfer.size > 0) percent = Math.max(percent, (transfer.loaded / transfer.size) * 100);
    }
  }
  percent = Math.max(0, Math.min(100, Math.round(percent * 10) / 10));

  const sampleSeconds: number = (now - progressSampleAt) / 1000;
  if (sampleSeconds >= 0.25) {
    const instant: number = Math.max(0, (done - progressSampleBytes) / sampleSeconds);
    progressSpeed = progressSpeed > 0 ? progressSpeed * 0.6 + instant * 0.4 : instant;
    progressSampleAt = now;
    progressSampleBytes = done;
  }

  progressLastSentAt = now;
  const label: string = currentTransferLabel(now);
  const payload: any = {
    label,
    percent,
    bytesDownloaded: done,
    totalBytes: progressTotalBytes,
    speed: Math.round(progressSpeed),
    current: completedDownloadFiles,
    total: totalDownloadFiles
  };
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('download-progress', payload);
  }
}

function scheduleProgressFlush(): void {
  if (progressFlushTimer) return;
  const wait: number = Math.max(0, 120 - (Date.now() - progressLastSentAt));
  progressFlushTimer = setTimeout(() => {
    progressFlushTimer = null;
    flushProgress();
  }, wait);
}

function reportTransferProgress(dest: string, loaded: number, total: number, label: string): void {
  ensureProgressSession();
  if (progressStageLabel && loaded > 0) progressStageLabel = '';
  const entry: ActiveTransfer = activeTransfers.get(dest) || { label, loaded: 0, size: 0 };
  entry.loaded = loaded;
  if (label) entry.label = label;
  if (total > 0) entry.size = total;
  activeTransfers.set(dest, entry);
  scheduleProgressFlush();
}

function reportTransferDone(dest: string, loaded: number, label: string): void {
  ensureProgressSession();
  const entry: ActiveTransfer | undefined = activeTransfers.get(dest);
  activeTransfers.delete(dest);
  progressDoneBytes += Math.max(entry?.size || 0, loaded);
  if (label || entry?.label) {
    progressCurrentLabel = label || entry!.label;
    progressLabelAt = Date.now();
  }
  setCompletedDownloadFiles(completedDownloadFiles + 1);
  scheduleProgressFlush();
}

function reportTransferFailed(dest: string): void {
  activeTransfers.delete(dest);
  scheduleProgressFlush();
}


export async function downloadWithPool(sources: string[], dest: string, label: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    downloadQueue.push({ sources, dest, label, resolve, reject });
    processDownloadQueue();
  });
}


export async function processDownloadQueue(): Promise<void> {
  while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT && !shouldCancelDownload) {
    const task: any = downloadQueue.shift();
    setActiveDownloads(activeDownloads + 1);
    downloadFileInternal(task.sources, task.dest, task.label)
      .then(() => {
        task.resolve();
      })
      .catch((err: any) => {
        task.reject(err);
      })
      .finally(() => {
        setActiveDownloads(activeDownloads - 1);
        processDownloadQueue();
      });
  }

  if (shouldCancelDownload) {
    while (downloadQueue.length > 0) {
      const task: any = downloadQueue.shift();
      task.reject(new Error('Download cancelled'));
    }
    
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('download-cancelled');
    }
  }
}


export async function downloadFile(url: string, dest: string, label: string, sources?: string[]): Promise<void> {
  if (fs.existsSync(dest)) {
    const stat = fs.statSync(dest);
    if (stat.size > 1024) {
      reportTransferDone(dest, stat.size, label);
      return;
    }
  }
  const list: string[] = sources && sources.length > 0 ? sources : buildSourceUrls(url, fileSourcePolicy);
  await downloadWithPool(list, dest, label);
}


async function downloadFileOnce(url: string, dest: string, label: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const dir: string = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let file: any = fs.createWriteStream(dest, { encoding: undefined as any });
    let loaded: number = 0;
    let total: number = 0;
    let fallbackStarted: boolean = false;

    const resetFile = (): void => {
      try { file.destroy(); } catch {}
      file = fs.createWriteStream(dest, { encoding: undefined as any });
      loaded = 0;
    };

    const fallbackToHttps = (reason: any): void => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      writeLog(`[下载] ${label} HTTP请求失败: ${reason}，尝试HTTPS`);
      resetFile();
      try {
        const https = require('https');
        
        const options: any = {
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        };
        
        const req2 = https.get(url, options, (res2: any) => {
          
          if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
            writeLog(`[下载] ${label} 重定向到: ${res2.headers.location}`);
            file.end(() => {
              downloadFileOnce(new URL(res2.headers.location, url).toString(), dest, label, timeoutMs).then(resolve).catch(reject);
            });
            return;
          }

          if (res2.statusCode >= 400) {
            writeLog(`[下载] ${label} HTTP ${res2.statusCode}`);
            file.close();
            res2.resume();
            reject(new Error(`HTTP ${res2.statusCode}`));
            return;
          }
          
          total = parseInt(res2.headers['content-length'] || '0', 10);

          const contentType: string = res2.headers['content-type'] || '';
          if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
            writeLog(`[下载] ${label} 警告: 内容类型是 ${contentType}，可能不是ZIP文件`);
          }
          
          writeLog(`[下载] ${label} 开始下载，大小: ${total} bytes`);
          
          res2.on('data', (d: any) => {
            if (shouldCancelDownload) {
              req2.destroy();
              file.destroy();
              reject(new Error('Download cancelled'));
              return;
            }
            loaded += d.length;
            file.write(d);
            reportTransferProgress(dest, loaded, total, label);
            if (speedLimitBytes > 0) {
              res2.pause();
              void consumeDownloadTokens(d.length).then(() => {
                if (!shouldCancelDownload) res2.resume();
              });
            }
          });
          res2.on('end', () => {
            if (loaded === 0) {
              try { file.destroy(); } catch {}
              reject(new Error('The download was empty'));
              return;
            }
            if (total > 0 && loaded < total) {
              try { file.destroy(); } catch {}
              reject(new Error(`下载不完整 (${loaded}/${total} bytes)`));
              return;
            }
            file.end(() => {
              writeLog(`[下载] ${label} 下载完成，实际大小: ${loaded} bytes`);
              reportTransferDone(dest, loaded, label);
              resolve();
            });
          });
          res2.on('error', (err2: any) => {
            file.destroy();
            reject(err2);
          });
        });
        req2.on('timeout', () => { req2.destroy(); reject('ui.timed_out'); });
        req2.on('error', (err2: any) => {
          file.destroy();
          reject(err2);
        });
      } catch (e2: any) {
        file.destroy();
        reject(e2);
      }
    };

    try {
      const req = net.request(url);
      const to: any = setTimeout(() => { try { req.abort(); } catch {} ; fallbackToHttps('timeout'); }, timeoutMs);

      req.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      req.on('response', (res: any) => {
        clearTimeout(to);

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          writeLog(`[下载] ${label} 重定向到: ${res.headers.location}`);
          file.end(() => {
            downloadFileOnce(new URL(res.headers.location, url).toString(), dest, label, timeoutMs).then(resolve).catch(reject);
          });
          return;
        }

        if (res.statusCode >= 400) {
          writeLog(`[下载] ${label} HTTP ${res.statusCode}`);
          file.close();
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        total = parseInt(res.headers['content-length'] || '0', 10);

        const contentType: string = res.headers['content-type'] || '';
        if (!contentType.includes('zip') && !contentType.includes('octet-stream')) {
          writeLog(`[下载] ${label} 警告: 内容类型是 ${contentType}，可能不是ZIP文件`);
        }
        
        writeLog(`[下载] ${label} 开始下载，大小: ${total} bytes`);
        
        res.on('data', (d: any) => {
          if (shouldCancelDownload) {
            try { req.abort(); } catch {}
            file.destroy();
            reject(new Error('Download cancelled'));
            return;
          }
          loaded += d.length;
          file.write(d);
          reportTransferProgress(dest, loaded, total, label);
          if (speedLimitBytes > 0) {
            res.pause();
            void consumeDownloadTokens(d.length).then(() => {
              if (!shouldCancelDownload) res.resume();
            });
          }
        });
        res.on('end', () => {
          if (loaded === 0) {
            try { file.destroy(); } catch {}
            fallbackToHttps(new Error('The download was empty'));
            return;
          }
          if (total > 0 && loaded < total) {
            try { file.destroy(); } catch {}
            fallbackToHttps(new Error(`下载不完整 (${loaded}/${total} bytes)`));
            return;
          }
          file.end(() => {
            writeLog(`[下载] ${label} 下载完成，实际大小: ${loaded} bytes`);
            reportTransferDone(dest, loaded, label);
            resolve();
          });
        });
        res.on('error', (err: any) => {
          fallbackToHttps(err);
        });
      });

      req.on('error', (err: any) => {
        fallbackToHttps(err);
      });

      req.end();
    } catch (e: any) {
      file.destroy();
      fallbackToHttps(e);
    }
  });
}


export async function downloadFileInternal(sources: string[], dest: string, label: string): Promise<void> {
  let lastError: any = null;

  for (let i = 0; i < sources.length; i++) {
    const url: string = sources[i];
    try {
      await downloadFileOnce(url, dest, label, sourceTimeout(fileSourcePolicy, i === 0, 'file'));
      return;
    } catch (error: any) {
      lastError = error;
      reportTransferFailed(dest);
      writeLog(`[下载] 下载源失败: ${url} - ${error.message}`);
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      } catch {}
    }
  }

  throw lastError || new Error('Download failed');
}



export async function installVersion(versionId: string, maxConcurrent: number = 20, downloadPath: string | null = null): Promise<any> {
  loadDownloadSettings();
  const targetDir: string = downloadPath || path.join(GAME_DIR, 'versions', versionId);
  const versionDir: string = targetDir;
  const cancelFilePath: string = path.join(versionDir, 'CancelDownload.txt');
  if (fs.existsSync(cancelFilePath)) {
    try { fs.unlinkSync(cancelFilePath); } catch (e: any) {}
  }

setShouldCancelDownload(false);
setIsDownloading(true);
setCurrentDownloadVersion(versionId);
setCurrentDownloadType('game');
setCurrentDownloadPath(targetDir);
  writeLog(`开始下载：${versionId} 到 ${targetDir}`);

  try {
setMaxConcurrent(maxConcurrent);
setDownloadQueue([]);
setActiveDownloads(0);
setTotalDownloadFiles(0);
setCompletedDownloadFiles(0);
setProgressStage(t('ui.preparing_download'));

    const versionDir2: string = path.join(GAME_DIR, 'versions', versionId);
    const versionExisted: boolean = fs.existsSync(versionDir2);
    if (!versionExisted) fs.mkdirSync(versionDir2, { recursive: true });

    const versionJsonPath: string = path.join(versionDir2, versionId + '.json');
    const versionJarPath: string = path.join(versionDir2, versionId + '.jar');

    const manifestUrl: string = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
    const manifestSources: string[] = buildSourceUrls(manifestUrl, versionSourcePolicy, 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json');
    const manifest: any = JSON.parse(await fetchText(manifestUrl, manifestSources));
    const vInfo: any = manifest.versions.find((v: any) => v.id === versionId);
    if (!vInfo) throw new Error('版本不存在: ' + versionId);

    if (!fs.existsSync(versionJsonPath)) {
      const versionJsonSources: string[] = buildSourceUrls(vInfo.url, versionSourcePolicy, `https://bmclapi2.bangbang93.com/version/${versionId}/json`);
      const vData: string = await fetchText(vInfo.url, versionJsonSources);
      fs.writeFileSync(versionJsonPath, vData);
    }

    const versionData: any = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

    if (!fs.existsSync(versionJarPath)) {
      const clientSources: string[] = buildSourceUrls(versionData.downloads.client.url, fileSourcePolicy, `https://bmclapi2.bangbang93.com/version/${versionId}/client`);
      beginProgressSession(Number(versionData.downloads.client.size) || 0, 1);
      await downloadFile(versionData.downloads.client.url, versionJarPath, t('ui.client'), clientSources);
      finishProgressSession();
    }

    if (shouldCancelDownload) {
      writeLog(`下载取消：${versionId}`);
      throw new Error('Download cancelled');
    }

    const assetIndexPath: string = path.join(GAME_DIR, 'assets', 'indexes', versionData.assetIndex.id + '.json');
    if (!fs.existsSync(assetIndexPath)) {
      const assetIndexSources: string[] = buildSourceUrls(versionData.assetIndex.url, versionSourcePolicy);
      beginProgressSession(Number(versionData.assetIndex.size) || 0, 1);
      await downloadFile(versionData.assetIndex.url, assetIndexPath, t('ui.asset_index'), assetIndexSources);
      finishProgressSession();
    }

    if (shouldCancelDownload) {
      writeLog(`下载取消：${versionId}`);
      throw new Error('Download cancelled');
    }

    let assetIndexData: any;
    for (let i: number = 0; i < 10; i++) {
      try {
        assetIndexData = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
        break;
      } catch (e: any) {
        await new Promise<void>(r => setTimeout(r, 500));
      }
    }
    if (!assetIndexData) throw new Error(t('ui.could_not_read_the_asset_index'));

    setProgressStage(t('ui.preparing_files'));
    const toDownload: any[] = [];
    let totalBytes: number = 0;

    for (const [name, obj] of Object.entries(assetIndexData.objects) as [string, any][]) {
      const hash: string = obj.hash;
      const prefix: string = hash.substring(0, 2);
      const assetPath: string = path.join(GAME_DIR, 'assets', 'objects', prefix, hash);
      if (!fs.existsSync(assetPath)) {
        const assetUrl: string = `https://resources.download.minecraft.net/${prefix}/${hash}`;
        const size: number = Number(obj.size) || 0;
        totalBytes += size;
        toDownload.push({
          url: assetUrl,
          sources: buildSourceUrls(assetUrl, fileSourcePolicy),
          dest: assetPath,
          label: t('ui.asset_name', { name }),
          size
        });
      }
    }

    for (const lib of versionData.libraries) {
      if (lib.downloads?.artifact) {
        const libPath: string = path.join(GAME_DIR, 'libraries', lib.downloads.artifact.path);
        if (!fs.existsSync(libPath)) {
          const size: number = Number(lib.downloads.artifact.size) || 0;
          totalBytes += size;
          toDownload.push({
            url: lib.downloads.artifact.url,
            sources: buildSourceUrls(lib.downloads.artifact.url, fileSourcePolicy),
            dest: libPath,
            label: t('ui.library_name', { name: lib.name }),
            size
          });
        }
      }
      if (lib.downloads?.classifiers) {
        for (const [cls, info] of Object.entries(lib.downloads.classifiers) as [string, any][]) {
          if (cls.includes('natives-windows')) {
            const libPath: string = path.join(GAME_DIR, 'libraries', info.path);
            if (!fs.existsSync(libPath)) {
              const size: number = Number(info.size) || 0;
              totalBytes += size;
              toDownload.push({
                url: info.url,
                sources: buildSourceUrls(info.url, fileSourcePolicy),
                dest: libPath,
                label: t('ui.native_library_name', { name: lib.name }),
                size
              });
            }
          }
        }
      }
    }

    beginProgressSession(totalBytes, toDownload.length);

    const downloadPromises: Promise<void>[] = toDownload.map((item: any) => downloadFile(item.url, item.dest, item.label, item.sources));
    await Promise.all(downloadPromises);
    finishProgressSession();

    const nativesDir: string = path.join(GAME_DIR, 'versions', versionId, 'natives');
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true });

    for (const lib of versionData.libraries) {
      if (lib.downloads?.classifiers) {
        for (const [cls, info] of Object.entries(lib.downloads.classifiers) as [string, any][]) {
          if (cls.includes('natives-windows')) {
            const libPath: string = path.join(GAME_DIR, 'libraries', info.path);
            if (fs.existsSync(libPath)) {
              const AdmZip: any = require('adm-zip');
              const zip: any = new AdmZip(libPath);
              zip.extractAllTo(nativesDir, true);
            }
          }
        }
      }
    }

    if (shouldCancelDownload) {
      writeLog(`下载取消：${versionId}`);
      throw new Error('Download cancelled');
    }

    writeLog(`下载完成：${versionId}`);
    if (!versionExisted) applyInitialVersionIsolation(versionId, { modable: false, versionType: String(vInfo.type || 'release') });

    updateVersionLastPlayed(versionId, targetDir);
    
    return { success: true };
  } catch (e: any) {
    writeLog(`下载失败：${versionId} - ${e.message}`);
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
        writeLog(`已删除下载失败的文件夹：${targetDir}`);
      } catch (delErr: any) {
        writeLog(`删除文件夹失败：${delErr.message}`);
      }
    }
    return { success: false, error: e.message };
  } finally {
resetProgressSession();
setIsDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
setShouldCancelDownload(false);
setDownloadQueue([]);
setActiveDownloads(0);
setTotalDownloadFiles(0);
setCompletedDownloadFiles(0);
  }
}


export function updateVersionLastPlayed(versionId: string, targetDir?: string): void {
  try {
    const versionDir: string = targetDir || path.join(GAME_DIR, 'versions', versionId);
    const gpclDir: string = path.join(versionDir, 'gpcl');
    const configPath: string = path.join(gpclDir, 'config.json');
    
    let settings: any = {};

    if (fs.existsSync(configPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e: any) {
        settings = {};
      }
    }

    settings.lastPlayed = new Date().toISOString();

    if (!fs.existsSync(gpclDir)) {
      fs.mkdirSync(gpclDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf8');
    writeLog(`[版本] ${versionId} 最后启动时间已更新: ${settings.lastPlayed}`);
    
  } catch (e: any) {
    writeLog(`[版本] 更新 ${versionId} 最后启动时间失败: ${e.message}`);
  }
}


ipcMain.handle('scan-versions', async (_, gameDir?: string, silent: boolean = false) => {
  const targetDir: string = gameDir ? path.resolve(gameDir) : GAME_DIR;
  const versionsDir: string = path.join(targetDir, 'versions');
  if (!fs.existsSync(versionsDir)) {
    if (!silent) writeLog('扫描本地版本：未找到versions目录');
    return [];
  }
  const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
  const versions: string[] = [];
  const skippedVersions: string[] = [];
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const versionDir: string = path.join(versionsDir, entry.name);
      try {
        const files: string[] = fs.readdirSync(versionDir);

        if (files.length === 1 && files[0] === 'CancelDownload.txt') {
          skippedVersions.push(entry.name);
          if (!silent) writeLog(`扫描本地版本：跳过空目录 "${entry.name}"（仅包含 CancelDownload.txt）`);
          continue;
        }

        const jsonFiles: string[] = files.filter((f: string) => f.endsWith('.json'));

        if (jsonFiles.length === 0) {
          skippedVersions.push(entry.name);
          if (!silent) writeLog(`扫描本地版本：跳过 "${entry.name}"（无 .json 文件）`);
          continue;
        }


        
        const baseVersionId: string = entry.name; 
        const mcVersion: string = baseVersionId; 

        if (jsonFiles.includes(`${baseVersionId}.json`)) {
          versions.push(baseVersionId);
        }

        for (const jsonFile of jsonFiles) {
          const jsonVersionId: string = jsonFile.replace('.json', '');
          
          if (jsonVersionId !== baseVersionId && !versions.includes(jsonVersionId)) {
            versions.push(jsonVersionId);
          }
        }
        
      } catch (e: any) {
        writeLog(`扫描本地版本：读取目录 "${entry.name}" 失败 - ${e.message}`);
      }
    }
  }
  
  if (skippedVersions.length > 0 && !silent) {
    writeLog(`扫描本地版本：跳过 ${skippedVersions.length} 个无效目录 - [${skippedVersions.join(', ')}]`);
  }
  if (!silent) writeLog(`扫描本地版本：共 ${versions.length} 个版本 - [${versions.join(', ')}]`);
  return versions;
});


ipcMain.handle('get-version-manifest', async () => {
  try {
    loadDownloadSettings();
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile: string = path.join(CACHE_DIR, 'version_manifest.json');

    let data: string | undefined;
    let fromCache: boolean = false;
    if (fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile);
      const age: number = Date.now() - stat.mtimeMs;
      if (age < 10 * 60 * 1000) {
        data = fs.readFileSync(cacheFile, 'utf8');
        fromCache = true;
      }
    }

    if (!data) {
      try {
        const manifestUrl: string = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
        const manifestSources: string[] = buildSourceUrls(manifestUrl, versionSourcePolicy, 'https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json');
        data = await fetchText(manifestUrl, manifestSources);
        fs.writeFileSync(cacheFile, data);
        writeLog('远程拉取版本列表：成功');
      } catch (e: any) {
        writeLog(`远程拉取版本列表：失败 - ${e.message}`);
        return [];
      }
    } else {
      writeLog(`读取本地缓存版本列表：成功`);
    }

    const parsed: any = JSON.parse(data!);
    
    writeLog(`版本列表：共 ${parsed.versions.length} 个版本`);
    return parsed.versions;
  } catch (e: any) {
    writeLog(`版本列表解析失败：${e.message}`);
    return [];
  }
});


ipcMain.handle('download-version', (event: any, versionId: string, maxConcurrent: number, downloadPath: string) => installVersion(versionId, maxConcurrent, downloadPath));


ipcMain.handle('select-version-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { title: t('ui.choose_version_folder'), properties: ['openDirectory'] });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});


ipcMain.handle('select-version-archive', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: t('ui.choose_version_archive'),
    properties: ['openFile'],
    filters: [{ name: t('ui.archive'), extensions: ['zip', 'jar', 'mrpack'] }]
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});


function findVersionJson(dir: string): { file: string; data: any } | null {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  const candidates: string[] = entries
    .filter((e: fs.Dirent) => e.isFile() && e.name.endsWith('.json'))
    .map((e: fs.Dirent) => path.join(dir, e.name));
  const baseName: string = path.basename(dir);
  const ordered: string[] = candidates.sort((a: string, b: string) => {
    const aPreferred: number = path.basename(a) === `${baseName}.json` ? 0 : 1;
    const bPreferred: number = path.basename(b) === `${baseName}.json` ? 0 : 1;
    return aPreferred - bPreferred;
  });
  for (const file of ordered) {
    try {
      const data: any = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data === 'object' && (data.id || data.inheritsFrom || data.libraries || data.mainClass || data.arguments || data.minecraftArguments)) {
        if (data.id || data.mainClass || data.arguments || data.minecraftArguments || data.inheritsFrom) {
          return { file, data };
        }
      }
    } catch {}
  }
  return null;
}


function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'CancelDownload.txt') continue;
    const from: string = path.join(src, entry.name);
    const to: string = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}


function importVersionFolder(srcDir: string): any {
  const found = findVersionJson(srcDir);
  if (!found) {
    return { success: false, error: 'No version JSON was found in this folder; choose a folder containing <version>.json' };
  }

  const rawId: string = String(found.data.id || path.basename(srcDir));
  const versionId: string = rawId.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!versionId) return { success: false, error: 'Could not determine the version name' };

  const versionsDir: string = path.join(GAME_DIR, 'versions');
  const dest: string = path.join(versionsDir, versionId);
  if (fs.existsSync(dest)) {
    return { success: false, error: t('ui.version_version_already_exists_delete_it_before_importing', { version: versionId }) };
  }

  fs.mkdirSync(versionsDir, { recursive: true });
  copyDirectory(srcDir, dest);

  const jsonPath: string = path.join(dest, `${versionId}.json`);
  if (!fs.existsSync(jsonPath)) {
    const copied: string = path.join(dest, path.basename(found.file));
    if (fs.existsSync(copied) && copied !== jsonPath) fs.copyFileSync(copied, jsonPath);
  }

  for (const sub of ['libraries', 'assets']) {
    const from: string = path.join(srcDir, sub);
    if (fs.existsSync(from)) {
      copyDirectory(from, path.join(GAME_DIR, sub));
      writeLog(`[本地安装] 已合并 ${sub} 目录`);
    }
  }

  const haystack: string = `${found.data.mainClass || ''} ${JSON.stringify(found.data.libraries || [])}`.toLowerCase();
  const modable: boolean = /fabricmc|minecraftforge|neoforged|quiltmc|optifine/.test(haystack);
  applyInitialVersionIsolation(versionId, { modable, versionType: String(found.data.type || 'release') });

  writeLog(`[本地安装] 已导入版本 ${versionId} 到 ${dest}`);
  return { success: true, versionId };
}


ipcMain.handle('install-local-version', async (_, sourcePath: string) => {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: 'Path does not exist' };
    }
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      return importVersionFolder(sourcePath);
    }

    const ext: string = path.extname(sourcePath).toLowerCase();
    if (ext !== '.zip' && ext !== '.jar' && ext !== '.mrpack') {
      return { success: false, error: 'Only version folders or .zip / .jar / .mrpack archives are supported' };
    }

    const packPeek: any = require('adm-zip');
    let packEntries: string[] = [];
    try { packEntries = new packPeek(sourcePath).getEntries().map((entry: any) => String(entry.entryName)); } catch {}
    const packEntry: string | undefined = packEntries.find((name: string) => {
      const depth: number = name.split('/').filter(Boolean).length;
      return depth <= 2 && /(^|\/)(modrinth\.index\.json|manifest\.json)$/i.test(name);
    });
    if (packEntry) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { installModpack } = require('./modpack');
      return installModpack({ archivePath: sourcePath });
    }

    const tempDir: string = path.join(GAME_DIR, 'temp', `import-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
      const AdmZip: any = require('adm-zip');
      new AdmZip(sourcePath).extractAllTo(tempDir, true);

      const findVersionFolder = (root: string, depth: number): string | null => {
        const found = findVersionJson(root);
        if (found && path.basename(found.file) === `${path.basename(root)}.json`) return root;
        if (depth <= 0) return null;
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return null; }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const child: string = path.join(root, entry.name);
          const hit: string | null = findVersionFolder(child, depth - 1);
          if (hit) return hit;
        }
        return null;
      };

      let versionDir: string | null = findVersionFolder(tempDir, 3);
      if (!versionDir && findVersionJson(tempDir)) versionDir = tempDir;
      if (!versionDir) return { success: false, error: 'No version folder was found in the archive (it must contain <version>.json)' };
      return importVersionFolder(versionDir);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  } catch (e: any) {
    writeLog(`[本地安装] 失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('download-with-modloader', (event: any, versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number, options?: any) => 
  installVersionWithModLoader(versionId, loaderType, loaderVersion, maxConcurrent, options));


ipcMain.handle('get-version-config', (event: any, versionId: string) => readVersionConfig(versionId));

ipcMain.handle('get-version-display-name', (event: any, versionId: string) => generateVersionDisplayName(versionId));

ipcMain.handle('get-launch-display-name', (event: any, versionId: string) => generateLaunchDisplayName(versionId));


ipcMain.handle('delete-version', async (_, versionId: string) => {
  try {
    const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
    
    if (!fs.existsSync(versionDir)) {
      return { success: false, error: 'Version does not exist' };
    }
    
    writeLog(`[删除版本] 开始删除版本: ${versionId}`);
    
    fs.rmSync(versionDir, { recursive: true, force: true });
    
    writeLog(`[删除版本] 版本 ${versionId} 删除成功`);
    
    return { success: true };
  } catch (e: any) {
    writeLog(`[删除版本] 删除版本失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('get-version-settings', async (_, versionId: string) => {
  try {
    const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
    const gpclDir: string = path.join(versionDir, 'gpcl');
    const configPath: string = path.join(gpclDir, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      return { success: true, settings: null };
    }
    
    const content: string = fs.readFileSync(configPath, 'utf8');
    const settings: any = JSON.parse(content);
    
    return { success: true, settings };
  } catch (e: any) {
    writeLog(`[版本设置] 读取版本 ${versionId} 设置失败: ${e.message}`);
    return { success: false, error: e.message, settings: null };
  }
});


ipcMain.handle('save-version-settings', async (_, versionId: string, settings: any) => {
  try {
    const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
    const gpclDir: string = path.join(versionDir, 'gpcl');
    
    if (!fs.existsSync(gpclDir)) {
      fs.mkdirSync(gpclDir, { recursive: true });
    }
    
    const configPath: string = path.join(gpclDir, 'config.json');

    fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf8');
    if (typeof settings?.isolation === 'boolean') {
      setVersionIsolationChoice(GAME_DIR, versionId, settings.isolation);
    }
    
    writeLog(`[版本设置] 版本 ${versionId} 设置已保存`);
    
    return { success: true };
  } catch (e: any) {
    writeLog(`[版本设置] 保存版本 ${versionId} 设置失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});


export function readVersionConfig(versionId: string): any {
  const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
  const configPath: string = path.join(versionDir, 'gpcl', 'config.ini');
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const content: string = fs.readFileSync(configPath, 'utf8');
    const config: any = {
      Minecraft: '',
      Forge: ''
    };
    
    const lines: string[] = content.split('\n');
    let inVersionSection: boolean = false;
    
    for (const line of lines) {
      const trimmed: string = line.trim();
      
      if (trimmed === '[Version]') {
        inVersionSection = true;
        continue;
      }
      
      if (!inVersionSection) continue;
      
      const parts: string[] = trimmed.split('=');
      if (parts.length === 2) {
        const key: string = parts[0].trim();
        const value: string = parts[1].trim();
        if (config.hasOwnProperty(key)) {
          config[key] = value;
        }
      }
    }
    
    return config;
  } catch (e: any) {
    writeLog(`[Config] 读取配置失败: ${e.message}`);
    return null;
  }
}


export function generateVersionDisplayName(versionId: string): string {
  const config: any = readVersionConfig(versionId);
  
  if (!config) {
    return versionId;
  }
  
  const parts: string[] = [];
  parts.push(config.Minecraft || versionId);
  
  if (config.Forge) {
    parts.push(`Forge${config.Forge}`);
  }
  
  return parts.join(' ');
}


export function generateLaunchDisplayName(versionId: string): string {
  const config: any = readVersionConfig(versionId);
  
  if (!config) {
    return versionId;
  }
  
  const parts: string[] = [];
  parts.push(config.Minecraft || versionId);
  
  if (config.Forge) {
    parts.push(`Forge${config.Forge}`);
  }
  
  return parts.join(' ');
}

