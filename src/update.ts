/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { app, ipcMain } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { spawn } from 'child_process';

import { UPDATA_DIR, loadSettings, writeLog } from './config';
import { mainWindow } from './shell';
// __IMPORTS_END__

export const UPDATE_BASE_URL = 'https://dl.caellab.com/file/games/gpcl';

export const UPDATE_SHA1_URL = 'https://dl.caellab.com/file/games/gpcl/GPCL.sha1';

const UPDATE_STATE_FILE = 'update-state.json';

type UpdateStage = 'downloading' | 'ready' | 'installing';

interface UpdateState {
  targetVersion: string;
  fromVersion: string;
  installerPath: string;
  stage: UpdateStage;
  manual: boolean;
  attempts: number;
  updatedAt: number;
}

let isUpdateDownloading = false;

let shouldCancelUpdateDownload = false;

let quitInstaller: { installerPath: string; relaunch: boolean } | null = null;

let pendingFailure: { targetVersion: string; installerPath: string; attempts: number } | null = null;

let justUpdatedTo: string | null = null;

let readyVersion: string | null = null;


function getStatePath(): string {
  return path.join(UPDATA_DIR, UPDATE_STATE_FILE);
}


function getInstallerPath(version: string): string {
  return path.join(UPDATA_DIR, `GPCL-${version}-Setup.exe`);
}


function removeFile(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
}


function compareVersions(a: string, b: string): number {
  const aParts: number[] = a.split('.').map(Number);
  const bParts: number[] = b.split('.').map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const av: number = aParts[i] || 0;
    const bv: number = bParts[i] || 0;
    if (bv > av) return 1;
    if (av > bv) return -1;
  }
  return 0;
}


function readUpdateState(): UpdateState | null {
  try {
    const statePath = getStatePath();
    if (!fs.existsSync(statePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!parsed || typeof parsed.targetVersion !== 'string') return null;
    return parsed as UpdateState;
  } catch (e: any) {
    writeLog(`[更新] 读取更新状态失败: ${e.message}`);
    return null;
  }
}


function writeUpdateState(state: UpdateState): void {
  try {
    if (!fs.existsSync(UPDATA_DIR)) fs.mkdirSync(UPDATA_DIR, { recursive: true });
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch (e: any) {
    writeLog(`[更新] 写入更新状态失败: ${e.message}`);
  }
}


function clearUpdateState(): void {
  removeFile(getStatePath());
}


function cleanupUpdateDir(keepInstaller: string | null): void {
  try {
    if (!fs.existsSync(UPDATA_DIR)) return;
    for (const file of fs.readdirSync(UPDATA_DIR)) {
      const fullPath = path.join(UPDATA_DIR, file);
      if (file.endsWith('.part') || file === 'update-install.ps1' || file === 'update-install.cmd') { removeFile(fullPath); continue; }
      if (file.startsWith('GPCL-') && file.endsWith('-Setup.exe') && fullPath !== keepInstaller) {
        removeFile(fullPath);
      }
    }
  } catch (e: any) {
    writeLog(`[更新] 清理更新目录失败: ${e.message}`);
  }
}


export function initUpdateState(): void {
  pendingFailure = null;
  justUpdatedTo = null;
  readyVersion = null;
  quitInstaller = null;

  const state = readUpdateState();
  if (!state) {
    cleanupUpdateDir(null);
    return;
  }

  const currentVersion: string = app.getVersion();

  if (compareVersions(currentVersion, state.targetVersion) <= 0) {
    writeLog(`[更新] 更新已完成: ${state.fromVersion || '?'} -> ${state.targetVersion}`);
    justUpdatedTo = state.targetVersion;
    clearUpdateState();
    cleanupUpdateDir(null);
    return;
  }

  if (!fs.existsSync(state.installerPath)) {
    writeLog('[更新] 记录中的安装包不存在，清除更新状态');
    clearUpdateState();
    cleanupUpdateDir(null);
    return;
  }

  if (state.stage === 'downloading') {
    writeLog('[更新] 上次下载未完成，清除后重新下载');
    clearUpdateState();
    cleanupUpdateDir(null);
    return;
  }

  if (state.stage === 'installing') {
    pendingFailure = {
      targetVersion: state.targetVersion,
      installerPath: state.installerPath,
      attempts: state.attempts || 0
    };
    writeLog(`[更新] 上次更新未完成（第 ${state.attempts || 0} 次尝试）`);
  }

  readyVersion = state.targetVersion;
  if (state.stage === 'ready' && loadSettings().advanced?.autoUpdate !== false) {
    quitInstaller = { installerPath: state.installerPath, relaunch: false };
    writeLog('[更新] 关闭启动器时将自动完成更新');
  }
  cleanupUpdateDir(state.installerPath);
}


ipcMain.handle('check-for-updates', async () => {
  return new Promise((resolve) => {
    const url = 'https://gamets.caellab.com/gpcl/data.json';
    writeLog('[更新] 开始检查更新...');
    const req = https.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        writeLog(`[更新] 检查更新返回 HTTP ${res.statusCode}`);
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          writeLog('[更新] 检查更新完成');
          resolve({ success: true, data: json });
        } catch (e: any) {
          writeLog('[更新] JSON解析失败: ' + e.message);
          resolve({ success: false, error: 'JSON解析失败: ' + e.message });
        }
      });
    });
    req.on('error', (e: any) => {
      writeLog('[更新] 请求失败: ' + e.message);
      resolve({ success: false, error: e.message });
    });
    req.setTimeout(15000, () => {
      req.destroy();
      writeLog('[更新] 检查更新超时');
      resolve({ success: false, error: '检查更新超时' });
    });
  });
});


function computeFileSHA1(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data: any) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    } catch (e) { reject(e); }
  });
}


function fetchExpectedSHA1(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(UPDATE_SHA1_URL, { timeout: 15000 }, (res: any) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data.trim().split(/\s+/)[0].toLowerCase()));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}


async function verifyInstaller(filePath: string): Promise<{ ok: boolean; error?: string }> {
  let expectedSHA1: string;
  try {
    expectedSHA1 = await fetchExpectedSHA1();
  } catch (e: any) {
    writeLog(`[更新] 获取SHA1校验文件失败: ${e.message}`);
    return { ok: false, error: '无法获取校验信息' };
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSHA1)) {
    writeLog(`[更新] SHA1格式无效 (${expectedSHA1})`);
    return { ok: false, error: '校验信息无效' };
  }
  const actualSHA1 = await computeFileSHA1(filePath);
  if (actualSHA1 === expectedSHA1) {
    writeLog('[更新] SHA1校验通过');
    return { ok: true };
  }
  writeLog(`[更新] SHA1校验失败: 期望 ${expectedSHA1}, 实际 ${actualSHA1}`);
  return { ok: false, error: '安装包校验失败' };
}


ipcMain.handle('download-update', async (_: any, version: string, manual: boolean = false) => {
  if (isUpdateDownloading) return { success: false, error: '已有更新下载进行中' };
  if (typeof version !== 'string' || !/^\d+(\.\d+)*$/.test(version)) {
    return { success: false, error: '版本号无效' };
  }

  const downloadUrl = `${UPDATE_BASE_URL}/GPCL-${version}-Setup.exe`;
  const destPath = getInstallerPath(version);
  const partPath = `${destPath}.part`;

  writeLog(`[更新] 开始下载更新: ${version} (${manual ? '手动' : '自动'})`);
  writeLog(`[更新] 下载URL: ${downloadUrl}`);
  writeLog(`[更新] 保存路径: ${destPath}`);

  if (!fs.existsSync(UPDATA_DIR)) fs.mkdirSync(UPDATA_DIR, { recursive: true });

  const state: UpdateState = {
    targetVersion: version,
    fromVersion: app.getVersion(),
    installerPath: destPath,
    stage: 'downloading',
    manual: !!manual,
    attempts: 0,
    updatedAt: Date.now()
  };
  writeUpdateState(state);
  readyVersion = null;
  isUpdateDownloading = true;
  shouldCancelUpdateDownload = false;

  const downloadResult = await new Promise<any>((resolve) => {
    let finished = false;

    const fail = (error: string, cancelled: boolean = false): void => {
      if (finished) return;
      finished = true;
      isUpdateDownloading = false;
      removeFile(partPath);
      const current = readUpdateState();
      if (current && current.targetVersion === version) clearUpdateState();
      resolve({ success: false, error, cancelled });
    };

    const doDownload = (url: string): void => {
      const protocol = url.startsWith('https') ? https : http;
      const options = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } };
      const req = protocol.get(url, options, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          writeLog(`[更新] 重定向到: ${res.headers.location}`);
          doDownload(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) { fail(`HTTP ${res.statusCode}`); return; }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(partPath);

        res.on('data', (chunk: Buffer) => {
          if (shouldCancelUpdateDownload) {
            req.destroy();
            file.destroy();
            fail('已取消', true);
            return;
          }
          downloaded += chunk.length;
          file.write(chunk);
          const percent = totalBytes > 0 ? Math.floor((downloaded / totalBytes) * 100) : 0;
          if (mainWindow) mainWindow.webContents.send('update-download-progress', { percent, bytesDownloaded: downloaded, totalBytes });
        });

        res.on('end', () => {
          file.end(() => {
            if (finished) return;
            finished = true;
            isUpdateDownloading = false;
            writeLog(`[更新] 下载完成: ${downloaded} bytes`);
            resolve({ success: true, size: downloaded });
          });
        });

        res.on('error', (err: any) => { file.destroy(); fail(err.message); });
        file.on('error', (err: any) => { fail(err.message); });
      });
      req.on('error', (err: any) => fail(err.message));
      req.setTimeout(600000, () => { req.destroy(); fail('下载超时'); });
    };

    doDownload(downloadUrl);
  });

  if (!downloadResult.success) return downloadResult;

  try {
    removeFile(destPath);
    fs.renameSync(partPath, destPath);
  } catch (e: any) {
    removeFile(partPath);
    clearUpdateState();
    return { success: false, error: `保存安装包失败: ${e.message}` };
  }

  const verified = await verifyInstaller(destPath);
  if (!verified.ok) {
    removeFile(destPath);
    clearUpdateState();
    return { success: false, error: verified.error || '安装包校验失败' };
  }

  writeUpdateState({ ...state, stage: 'ready', updatedAt: Date.now() });
  readyVersion = version;
  writeLog(`[更新] 安装包已就绪: ${version}`);
  return { success: true, filePath: destPath, size: downloadResult.size, verified: true };
});


ipcMain.handle('cancel-update-download', () => { shouldCancelUpdateDownload = true; writeLog('[更新] 用户取消更新下载'); return { success: true }; });


function installerArgs(relaunch: boolean): string[] {
  return [
    '/VERYSILENT',
    '/SUPPRESSMSGBOXES',
    '/NORESTART',
    '/SP-',
    '/CLOSEAPPLICATIONS',
    '/LOG=update-install.log',
    `/RELAUNCH=${relaunch ? '1' : '0'}`,
    `/WAITPID=${process.pid}`
  ];
}


function launchInstaller(installerPath: string, relaunch: boolean): { success: boolean; error?: string } {
  if (!fs.existsSync(installerPath)) {
    writeLog(`[更新] 安装程序不存在: ${installerPath}`);
    return { success: false, error: '安装程序不存在' };
  }

  const previous = readUpdateState();
  const versionMatch = installerPath.match(/GPCL-(.+)-Setup\.exe$/);
  const targetVersion = previous?.targetVersion || (versionMatch ? versionMatch[1] : '');
  if (!targetVersion) return { success: false, error: '无法确定更新版本' };

  const nextState: UpdateState = {
    targetVersion,
    fromVersion: previous?.fromVersion || app.getVersion(),
    installerPath,
    stage: 'installing',
    manual: relaunch,
    attempts: (previous?.attempts || 0) + 1,
    updatedAt: Date.now()
  };
  writeUpdateState(nextState);

  try {
    writeLog(`[更新] 启动静默安装: ${installerPath} (重启=${relaunch}, 等待PID=${process.pid})`);
    const child = spawn(installerPath, installerArgs(relaunch), { cwd: UPDATA_DIR, detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', (err: any) => {
      writeLog(`[更新] 启动安装程序失败: ${err.message}`);
    });
    child.unref();
    return { success: true };
  } catch (e: any) {
    writeLog(`[更新] 启动安装程序失败: ${e.message}`);
    writeUpdateState({ ...nextState, stage: 'ready', attempts: previous?.attempts || 0 });
    return { success: false, error: e.message };
  }
}


ipcMain.handle('install-update', (_: any, installerPath: string, relaunch: boolean = true) => launchInstaller(installerPath, !!relaunch));


ipcMain.handle('set-update-shutdown-hook', (_: any, installerPath: string, relaunch: boolean = false) => {
  if (!fs.existsSync(installerPath)) return { success: false, error: '安装程序不存在' };
  quitInstaller = { installerPath, relaunch: !!relaunch };
  writeLog(`[更新] 已设置关闭钩子: ${installerPath} (重启=${relaunch})`);
  return { success: true };
});


ipcMain.handle('get-update-state', async () => {
  const currentVersion: string = app.getVersion();
  const state = readUpdateState();
  const readyInstallerPath: string | null = state && state.stage === 'ready' && fs.existsSync(state.installerPath)
    ? state.installerPath
    : null;
  const result = {
    success: true,
    currentVersion,
    justUpdatedTo,
    pendingFailure,
    readyVersion,
    readyInstallerPath
  };
  justUpdatedTo = null;
  return result;
});


export function installPendingUpdateOnRestart(): boolean {
  const state = readUpdateState();
  if (!state || state.stage === 'downloading') return false;
  if (!fs.existsSync(state.installerPath)) return false;
  const result = launchInstaller(state.installerPath, true);
  if (result.success) {
    quitInstaller = null;
    readyVersion = null;
  }
  return result.success;
}


app.on('before-quit', () => {
  if (!quitInstaller) return;
  const target = quitInstaller;
  quitInstaller = null;
  launchInstaller(target.installerPath, target.relaunch);
});
