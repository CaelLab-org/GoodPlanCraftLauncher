/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { ipcMain, shell } from 'electron';
import crypto from 'crypto';
import https from 'https';

import { writeLog } from './config';
import { mainWindow } from './shell';
// __IMPORTS_END__

export const AUTH_BASE = 'https://api.caellab.com/gamets/gpcl/auth';

export const AUTH_POLL_INTERVAL = 1000; // 1s

export const AUTH_TIMEOUT = 120000; // 2min


ipcMain.handle('start-microsoft-auth', async () => {
  try {
    const state: string = crypto.randomBytes(32).toString('hex');
    const startUrl: string = `${AUTH_BASE}/start.php?state=${state}`;
    const resultUrl: string = `${AUTH_BASE}/result.php?state=${state}`;

    writeLog(`[正版登录] 开始认证, state=${state}`);
    writeLog(`[正版登录] 启动 URL: ${startUrl}`);

    // 打开浏览器跳转到微软登录
    shell.openExternal(startUrl);

    // 轮询获取结果
    const startTime: number = Date.now();
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    return new Promise<void>((resolve) => {
      pollTimer = setInterval(async () => {
        try {
          // 超时检查
          if (Date.now() - startTime > AUTH_TIMEOUT) {
            writeLog('[正版登录] 超时');
            if (pollTimer) clearInterval(pollTimer);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('microsoft-auth-result', {
                status: 'timeout',
                message: '登录超时，请重试'
              });
            }
            resolve();
            return;
          }

          // 请求 result.php
          const result: any = await new Promise<any>((res, rej) => {
            const req = https.get(resultUrl, { timeout: 5000 }, (resp) => {
              let data = '';
              resp.on('data', (chunk: string) => data += chunk);
              resp.on('end', () => {
                try { res(JSON.parse(data)); }
                catch { rej(new Error('解析失败')); }
              });
            });
            req.on('error', rej);
            req.on('timeout', () => { req.destroy(); rej(new Error('请求超时')); });
          });

          if (result.status === 'success' || result.status === 'error') {
            writeLog(`[正版登录] 收到结果: status=${result.status}, username=${result.username || ''}`);
            if (pollTimer) clearInterval(pollTimer);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('microsoft-auth-result', result);
            }
            resolve();
          }
          // status === 'pending' 则继续轮询
        } catch (e: any) {
          writeLog(`[正版登录] 轮询请求失败: ${e.message}`);
          // 继续轮询，不中断
        }
      }, AUTH_POLL_INTERVAL);
    });
  } catch (e: any) {
    writeLog(`[正版登录] 启动失败: ${e.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('microsoft-auth-result', {
        status: 'error',
        message: `启动认证失败: ${e.message}`
      });
    }
  }
});

