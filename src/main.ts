/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

// __IMPORTS_BEGIN__
import { app, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

import { APP_VERSION, BASE_DIR, GAME_DIR, LOG_FILE, cleanupExpiredLogs, initGameDirFromSettings, initLanguage, initPaths, parseIni, setBaseDir, writeLog } from './config';
import { createGPCLShortcut, createWindow, mainWindow } from './shell';
import { initUpdateState, installPendingUpdateOnRestart } from './update';
import { isDeveloperMode, setIsDeveloperMode } from './state';

import './auth';
import './download';
import './game';
import './instance';
import './java';
import './modloader';
import './modpack';
import './mods';
import './player';
// __IMPORTS_END__

process.stdout.setDefaultEncoding('utf8');
process.stderr.setDefaultEncoding('utf8');

app.commandLine.appendSwitch('js-flags', '--compile-hints-always');
app.commandLine.appendSwitch('disk-cache-size', '134217728');

app.on('web-contents-created', (event: any, contents: any) => {
  try {
    contents.on('context-menu', (e: any) => {
      if (!isDeveloperMode) e.preventDefault();
    });
    contents.on('before-input-event', (event: any, input: any) => {
      if (isDeveloperMode) return;
      const key = input.key && input.key.toLowerCase();
      const ctrlOrCmd = input.control || input.meta;
      if ((ctrlOrCmd && key === 'r') || input.key === 'F5') event.preventDefault();
      if ((input.control && input.shift && key === 'i') || input.key === 'F12' || (input.meta && input.alt && key === 'i')) event.preventDefault();
    });

    contents.setWindowOpenHandler((details: any) => {
      try {
        shell.openExternal(details.url);
        writeLog(`[外部链接] 通过 window.open 拦截并打开: ${details.url}`);
      } catch (e: any) {
        writeLog(`[外部链接] 打开失败: ${e.message}`);
      }
      return { action: 'deny' };
    });

    contents.on('new-window', (event: any, url: string) => {
      event.preventDefault();
      try {
        shell.openExternal(url);
        writeLog(`[外部链接] 通过 new-window 拦截并打开: ${url}`);
      } catch (e: any) {
        writeLog(`[外部链接] 打开失败: ${e.message}`);
      }
    });
  } catch (e) {}
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  const isTesting = process.argv.includes('--squirrel-install') || 
                    process.argv.includes('--squirrel-obsolete') ||
                    process.argv.includes('--squirrel-updated') ||
                    process.argv.includes('--testing');
  
  if (isTesting) {
    console.log('[启动] 检测到构建测试模式，跳过窗口创建');
    app.quit();
    return;
  }

setBaseDir(app.getPath('userData'));

  let preventMultipleLaunch = true;
  try {
    const configPath = path.join(BASE_DIR, 'gpcl', 'config', 'setting.ini');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = parseIni(content);
      if (parsed.advanced) {
        if (parsed.advanced.preventMultipleLaunch === false || parsed.advanced.preventmultiplelaunch === false) {
          preventMultipleLaunch = false;
        }
      }
    }
  } catch (e) {}

  if (preventMultipleLaunch) {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      writeLog('检测到已有实例运行，退出');
      app.quit();
      return;
    }
  }

  initPaths();
  initLanguage();
  initGameDirFromSettings();
  initUpdateState();
  cleanupExpiredLogs();
  
  try {
    const devConfigPath = path.join(BASE_DIR, 'gpcl', 'config', 'setting.ini');
    if (fs.existsSync(devConfigPath)) {
      const devContent = fs.readFileSync(devConfigPath, 'utf8');
      const devParsed = parseIni(devContent);
      if (devParsed.advanced && devParsed.advanced.developerMode === true) {
setIsDeveloperMode(true);
        writeLog('[开发者模式] 启动时已启用');
      }
    }
  } catch (e) {}
  
  createGPCLShortcut();
  
  writeLog(`GPCL v${APP_VERSION} 启动`);
  console.log('日志文件路径:', LOG_FILE);
  try {
    createWindow();
  } catch (e: any) {
    writeLog(`[致命错误] 创建窗口失败: ${e.message}`);
    console.error('创建窗口失败:', e);
  }
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('get-app-version', () => APP_VERSION || app.getVersion() || '1.0.0');

ipcMain.handle('get-game-dir', () => {
  return GAME_DIR;
});

ipcMain.handle('restart-app', () => {
  writeLog('[重启] 正在重启应用...');
  if (installPendingUpdateOnRestart()) {
    app.quit();
    return;
  }
  app.relaunch();
  app.exit();
});

ipcMain.handle('set-developer-mode', (_: any, enabled: boolean) => {
setIsDeveloperMode(!!enabled);
  writeLog('[开发者模式] ' + (isDeveloperMode ? '已启用' : '已禁用'));
  return { success: true };
});

