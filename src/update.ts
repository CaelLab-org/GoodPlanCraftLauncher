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

import { UPDATA_DIR, writeLog } from './config';
import { mainWindow } from './shell';
// __IMPORTS_END__

ipcMain.handle('check-for-updates', async () => {
  return new Promise((resolve) => {
    const url = 'https://gamets.caellab.com/gpcl/data.json';
    writeLog('[更新] 开始检查更新...');
    https.get(url, (res: any) => {
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
    }).on('error', (e: any) => {
      writeLog('[更新] 请求失败: ' + e.message);
      resolve({ success: false, error: e.message });
    });
  });
});


export let updateShutdownHook: string | null = null;

export let isUpdateDownloading: boolean = false;

export let shouldCancelUpdateDownload: boolean = false;

export const UPDATE_BASE_URL = 'https://dl.caellab.com/file/games/gpcl';

export const UPDATE_SHA1_URL = 'https://dl.caellab.com/file/games/gpcl/GPCL.sha1';


export function getUpdateInstallerPath(version: string): string {
  return path.join(UPDATA_DIR, `GPCL-${version}-Setup.exe`);
}


export function computeFileSHA1(filePath: string): Promise<string> {
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


ipcMain.handle('get-update-installer-path', (_: any, version: string) => getUpdateInstallerPath(version));


ipcMain.handle('download-update', async (event: any, version: string) => {
  if (isUpdateDownloading) return { success: false, error: '已有更新下载进行中' };
  const downloadUrl = `${UPDATE_BASE_URL}/GPCL-${version}-Setup.exe`;
  const destPath = getUpdateInstallerPath(version);
  writeLog(`[更新] 开始下载更新: ${version}`);
  writeLog(`[更新] 下载URL: ${downloadUrl}`);
  writeLog(`[更新] 保存路径: ${destPath}`);
  if (!fs.existsSync(UPDATA_DIR)) fs.mkdirSync(UPDATA_DIR, { recursive: true });
  isUpdateDownloading = true;
  shouldCancelUpdateDownload = false;
  return new Promise((resolve) => {
    let finished = false;
    const doDownload = (url: string) => {
      const protocol = url.startsWith('https') ? https : http;
      const options = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } };
      const req = protocol.get(url, options, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          writeLog(`[更新] 重定向到: ${res.headers.location}`);
          doDownload(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) { finished = true; isUpdateDownloading = false; resolve({ success: false, error: `HTTP ${res.statusCode}` }); return; }
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const file = fs.createWriteStream(destPath);
        res.on('data', (chunk: Buffer) => {
          if (shouldCancelUpdateDownload) { req.destroy(); file.destroy(); if (!finished) { finished = true; isUpdateDownloading = false; try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) {} resolve({ success: false, cancelled: true }); } return; }
          downloaded += chunk.length;
          file.write(chunk);
          const percent = totalBytes > 0 ? Math.floor((downloaded / totalBytes) * 100) : 0;
          if (mainWindow) mainWindow.webContents.send('update-download-progress', { percent, bytesDownloaded: downloaded, totalBytes });
        });
        res.on('end', () => { file.end(() => { if (!finished) { finished = true; isUpdateDownloading = false; writeLog(`[更新] 下载完成: ${downloaded} bytes`); resolve({ success: true, filePath: destPath, size: downloaded }); } }); });
        res.on('error', (err: any) => { file.destroy(); if (!finished) { finished = true; isUpdateDownloading = false; try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) {} resolve({ success: false, error: err.message }); } });
        file.on('error', (err: any) => { if (!finished) { finished = true; isUpdateDownloading = false; resolve({ success: false, error: err.message }); } });
      });
      req.on('error', (err: any) => { if (!finished) { finished = true; isUpdateDownloading = false; try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) {} resolve({ success: false, error: err.message }); } });
      req.setTimeout(600000, () => { req.destroy(); if (!finished) { finished = true; isUpdateDownloading = false; try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) {} resolve({ success: false, error: '下载超时' }); } });
    };
    doDownload(downloadUrl);
  });
});


ipcMain.handle('cancel-update-download', () => { shouldCancelUpdateDownload = true; writeLog('[更新] 用户取消更新下载'); return { success: true }; });


ipcMain.handle('verify-update-sha1', async (_: any, filePath: string) => {
  try {
    writeLog(`[更新] 开始SHA1校验: ${filePath}`);
    if (!fs.existsSync(filePath)) { writeLog('[更新] 文件不存在，跳过校验'); return { success: false, error: '文件不存在' }; }
    let expectedSHA1: string | null = null;
    try {
      const sha1Content = await new Promise<string>((resolve, reject) => {
        const req = https.get(UPDATE_SHA1_URL, { timeout: 15000 }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => resolve(data.trim()));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
      });
      expectedSHA1 = sha1Content.split(/\s+/)[0].toLowerCase();
      writeLog(`[更新] 期望SHA1: ${expectedSHA1}`);
    } catch (e: any) { writeLog(`[更新] 获取SHA1校验文件失败: ${e.message}，跳过校验`); return { success: true, skipped: true }; }
    if (!expectedSHA1 || expectedSHA1.length !== 40) { writeLog(`[更新] SHA1格式无效 (${expectedSHA1})，跳过校验`); return { success: true, skipped: true }; }
    const actualSHA1 = await computeFileSHA1(filePath);
    writeLog(`[更新] 实际SHA1: ${actualSHA1}`);
    if (actualSHA1 === expectedSHA1) { writeLog('[更新] SHA1校验通过'); return { success: true, verified: true }; }
    else { writeLog('[更新] SHA1校验失败'); return { success: false, error: 'SHA1校验失败', expected: expectedSHA1, actual: actualSHA1 }; }
  } catch (e: any) { writeLog(`[更新] SHA1校验异常: ${e.message}，跳过校验`); return { success: true, skipped: true }; }
});


ipcMain.handle('execute-update-installer', (_: any, installerPath: string) => {
  try {
    writeLog(`[更新] 执行安装程序: ${installerPath}`);
    if (!fs.existsSync(installerPath)) return { success: false, error: '安装程序不存在' };
    spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { success: true };
  } catch (e: any) { writeLog(`[更新] 执行安装程序失败: ${e.message}`); return { success: false, error: e.message }; }
});


ipcMain.handle('set-update-shutdown-hook', (_: any, installerPath: string) => { updateShutdownHook = installerPath; writeLog(`[更新] 已设置关闭钩子: ${installerPath}`); return { success: true }; });


app.on('before-quit', () => {
  if (updateShutdownHook) {
    try { writeLog(`[更新] 触发关闭钩子，执行安装程序: ${updateShutdownHook}`); spawn(updateShutdownHook, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref(); } catch (e: any) { writeLog(`[更新] 关闭钩子执行失败: ${e.message}`); }
    updateShutdownHook = null;
  }
});

