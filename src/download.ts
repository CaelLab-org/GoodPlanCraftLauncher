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

import { APP_VERSION, CACHE_DIR, GAME_DIR, formatTimestamp, loadSettings, markVersionIsolated, writeLog } from './config';
import { installVersionWithModLoader } from './modloader';
import { mainWindow } from './shell';
import { MAX_CONCURRENT, activeDownloads, completedDownloadFiles, currentDownloadPath, currentDownloadType, currentDownloadVersion, downloadQueue, isDownloading, isJavaDownloading, setActiveDownloads, setCompletedDownloadFiles, setCurrentDownloadPath, setCurrentDownloadType, setCurrentDownloadVersion, setDownloadQueue, setIsDownloading, setIsJavaDownloading, setMaxConcurrent, setShouldCancelDownload, setTotalDownloadFiles, shouldCancelDownload, totalDownloadFiles } from './state';
// __IMPORTS_END__

ipcMain.handle('confirm-close-download', async () => {
  if (isDownloading && currentDownloadVersion) {
setShouldCancelDownload(true);
    try {
      const versionDir = currentDownloadPath || path.join(GAME_DIR, 'versions', currentDownloadVersion);
      const cancelFilePath = path.join(versionDir, 'CancelDownload.txt');
      const cancelContent = `GoodPlanCraftLauncher ${APP_VERSION}\n取消时间：${formatTimestamp()}\n\n正确的关闭\n您在下载完成前正确地关闭了GPCL。`;
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

  throw lastError || new Error('请求失败');
}


let overallProgressMode: boolean = false;

export function setOverallProgressMode(value: boolean): void {
  overallProgressMode = value;
}

function progressPercent(filePercent: number): number {
  if (!overallProgressMode || totalDownloadFiles <= 1) return filePercent;
  return Math.min(100, Math.floor((completedDownloadFiles / totalDownloadFiles) * 100));
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
        setCompletedDownloadFiles(completedDownloadFiles + 1);
        processDownloadQueue();
      });
  }

  if (shouldCancelDownload) {
    while (downloadQueue.length > 0) {
      const task: any = downloadQueue.shift();
      task.reject(new Error('下载已取消'));
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
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send('download-progress', {
          label,
          percent: progressPercent(100),
          current: completedDownloadFiles,
          total: totalDownloadFiles
        });
      }
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
              reject(new Error('下载已取消'));
              return;
            }
            loaded += d.length;
            file.write(d);
            const p: number = total > 0 ? Math.floor((loaded / total) * 100) : 0;
            for (const w of BrowserWindow.getAllWindows()) {
              w.webContents.send('download-progress', {
                label,
                percent: progressPercent(p),
                bytesDownloaded: loaded,
                current: completedDownloadFiles,
                total: totalDownloadFiles
              });
            }
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
              reject(new Error('下载内容为空'));
              return;
            }
            if (total > 0 && loaded < total) {
              try { file.destroy(); } catch {}
              reject(new Error(`下载不完整 (${loaded}/${total} bytes)`));
              return;
            }
            file.end(() => {
              writeLog(`[下载] ${label} 下载完成，实际大小: ${loaded} bytes`);
              resolve();
            });
          });
          res2.on('error', (err2: any) => {
            file.destroy();
            reject(err2);
          });
        });
        req2.on('timeout', () => { req2.destroy(); reject('超时'); });
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
            reject(new Error('下载已取消'));
            return;
          }
          loaded += d.length;
          file.write(d);
          const p: number = total > 0 ? Math.floor((loaded / total) * 100) : 0;
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send('download-progress', {
              label,
              percent: progressPercent(p),
              bytesDownloaded: loaded,
              current: completedDownloadFiles,
              total: totalDownloadFiles
            });
          }
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
            fallbackToHttps(new Error('下载内容为空'));
            return;
          }
          if (total > 0 && loaded < total) {
            try { file.destroy(); } catch {}
            fallbackToHttps(new Error(`下载不完整 (${loaded}/${total} bytes)`));
            return;
          }
          file.end(() => {
            writeLog(`[下载] ${label} 下载完成，实际大小: ${loaded} bytes`);
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
      writeLog(`[下载] 下载源失败: ${url} - ${error.message}`);
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      } catch {}
    }
  }

  throw lastError || new Error('下载失败');
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
      await downloadFile(versionData.downloads.client.url, versionJarPath, '客户端', clientSources);
    }

    if (shouldCancelDownload) {
      writeLog(`下载取消：${versionId}`);
      throw new Error('下载已取消');
    }

    const assetIndexPath: string = path.join(GAME_DIR, 'assets', 'indexes', versionData.assetIndex.id + '.json');
    if (!fs.existsSync(assetIndexPath)) {
      const assetIndexSources: string[] = buildSourceUrls(versionData.assetIndex.url, versionSourcePolicy);
      await downloadFile(versionData.assetIndex.url, assetIndexPath, '资源索引', assetIndexSources);
    }

    if (shouldCancelDownload) {
      writeLog(`下载取消：${versionId}`);
      throw new Error('下载已取消');
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
    if (!assetIndexData) throw new Error('无法读取资源索引');

    const toDownload: any[] = [];

    for (const [name, obj] of Object.entries(assetIndexData.objects) as [string, any][]) {
      const hash: string = obj.hash;
      const prefix: string = hash.substring(0, 2);
      const assetPath: string = path.join(GAME_DIR, 'assets', 'objects', prefix, hash);
      if (!fs.existsSync(assetPath)) {
        const assetUrl: string = `https://resources.download.minecraft.net/${prefix}/${hash}`;
        toDownload.push({
          url: assetUrl,
          sources: buildSourceUrls(assetUrl, fileSourcePolicy),
          dest: assetPath,
          label: `资源: ${name}`
        });
      }
    }

    for (const lib of versionData.libraries) {
      if (lib.downloads?.artifact) {
        const libPath: string = path.join(GAME_DIR, 'libraries', lib.downloads.artifact.path);
        if (!fs.existsSync(libPath)) {
          toDownload.push({
            url: lib.downloads.artifact.url,
            sources: buildSourceUrls(lib.downloads.artifact.url, fileSourcePolicy),
            dest: libPath,
            label: `库: ${lib.name}`
          });
        }
      }
      if (lib.downloads?.classifiers) {
        for (const [cls, info] of Object.entries(lib.downloads.classifiers) as [string, any][]) {
          if (cls.includes('natives-windows')) {
            const libPath: string = path.join(GAME_DIR, 'libraries', info.path);
            if (!fs.existsSync(libPath)) {
              toDownload.push({
                url: info.url,
                sources: buildSourceUrls(info.url, fileSourcePolicy),
                dest: libPath,
                label: `原生库: ${lib.name}`
              });
            }
          }
        }
      }
    }

setTotalDownloadFiles(toDownload.length);
setCompletedDownloadFiles(0);

    const downloadPromises: Promise<void>[] = toDownload.map((item: any) => downloadFile(item.url, item.dest, item.label, item.sources));
    await Promise.all(downloadPromises);

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
      throw new Error('下载已取消');
    }

    writeLog(`下载完成：${versionId}`);
    if (!versionExisted) markVersionIsolated(GAME_DIR, versionId);

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
  const result = await dialog.showOpenDialog(mainWindow, { title: '选择版本文件夹', properties: ['openDirectory'] });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});


ipcMain.handle('select-version-archive', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择版本压缩包',
    properties: ['openFile'],
    filters: [{ name: '压缩包', extensions: ['zip', 'jar', 'mrpack'] }]
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
    return { success: false, error: '这个文件夹里没有找到版本 JSON，请选择包含 <版本名>.json 的版本文件夹' };
  }

  const rawId: string = String(found.data.id || path.basename(srcDir));
  const versionId: string = rawId.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  if (!versionId) return { success: false, error: '无法确定版本名' };

  const versionsDir: string = path.join(GAME_DIR, 'versions');
  const dest: string = path.join(versionsDir, versionId);
  if (fs.existsSync(dest)) {
    return { success: false, error: `版本 ${versionId} 已存在，请先删除后再导入` };
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

  writeLog(`[本地安装] 已导入版本 ${versionId} 到 ${dest}`);
  return { success: true, versionId };
}


ipcMain.handle('install-local-version', async (_, sourcePath: string) => {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, error: '路径不存在' };
    }
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      return importVersionFolder(sourcePath);
    }

    const ext: string = path.extname(sourcePath).toLowerCase();
    if (ext !== '.zip' && ext !== '.jar' && ext !== '.mrpack') {
      return { success: false, error: '只支持版本文件夹或 .zip / .jar / .mrpack 压缩包' };
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
      if (!versionDir) return { success: false, error: '压缩包里没有找到版本文件夹（需要包含 <版本名>.json）' };
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
      return { success: false, error: '版本不存在' };
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

