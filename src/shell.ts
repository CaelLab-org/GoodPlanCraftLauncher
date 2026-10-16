/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, Menu, app, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

import { BASE_DIR, writeLog } from './config';
import { isDeveloperMode, isDownloading, isJavaDownloading } from './state';
// __IMPORTS_END__

export let mainWindow: BrowserWindow | null;

export function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 1920,
    maxHeight: 1080,
    frame: false,
    title: 'GoodPlanCraftLauncher',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#0d0d15',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      shell.openExternal(details.url);
      writeLog(`[外部链接] 通过 window.open 拦截并打开: ${details.url}`);
    } catch (e: any) {
      writeLog(`[外部链接] 打开失败: ${e.message}`);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('new-window', (event: any, url: string) => {
    event.preventDefault();
    try {
      shell.openExternal(url);
      writeLog(`[外部链接] 通过 new-window 拦截并打开: ${url}`);
    } catch (e: any) {
      writeLog(`[外部链接] 打开失败: ${e.message}`);
    }
  });

  try { Menu.setApplicationMenu(null); } catch (e) {}
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));

  mainWindow.on('close', (event: any) => {
    if (isDownloading || isJavaDownloading) {
      event.preventDefault();
      mainWindow!.webContents.send('confirm-close-while-downloading');
    }
  });

  mainWindow.webContents.on('before-input-event', (event: any, input: any) => {
    if (isDeveloperMode) return;
    const key = input.key && input.key.toLowerCase();
    const ctrlOrCmd = input.control || input.meta;
    if ((ctrlOrCmd && key === 'r') || input.key === 'F5') event.preventDefault();
    if ((input.control && input.shift && key === 'i') || input.key === 'F12' || (input.meta && input.alt && key === 'i')) event.preventDefault();
  });

  mainWindow.webContents.on('context-menu', (e: any) => {
    if (!isDeveloperMode) e.preventDefault();
  });
}


export function createGPCLShortcut(): void {
  try {
    const startMenuDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const shortcutPath = path.join(startMenuDir, 'GPCL.lnk');
    
    if (fs.existsSync(shortcutPath)) {
      return;
    }
    
    if (app.isPackaged) {
      const exePath = process.execPath;
      shell.writeShortcutLink(shortcutPath, 'create', {
        target: exePath,
        description: 'GoodPlanCraftLauncher - Minecraft 启动器',
        icon: exePath,
        iconIndex: 0
      });
      writeLog('[快捷方式] 已创建 GPCL 快捷方式');
    }
  } catch (e: any) {
    writeLog(`[快捷方式] 创建 GPCL 快捷方式失败: ${e.message}`);
  }
}


ipcMain.handle('show-message-dialog', async (_: any, options: any) => {
  if (!mainWindow) return { success: false };
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'info',
    title: options.title || '提示',
    message: options.message || '',
    detail: options.detail || '',
    buttons: options.buttons || ['确定'],
    defaultId: options.defaultId || 0,
    cancelId: options.cancelId || 0,
    noLink: true
  });
  return { success: true, response: result.response };
});


ipcMain.handle('open-external', (_: any, url: string) => { try { shell.openExternal(url); return { success: true }; } catch (e: any) { writeLog('[外部链接] 打开失败: ' + e.message); return { success: false, error: e.message }; } });


ipcMain.handle('open-folder', async (_: any, folderPath: string) => { try { if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true }); await shell.openPath(folderPath); return { success: true }; } catch (e: any) { writeLog('[文件夹] 打开失败: ' + e.message); return { success: false, error: e.message }; } });

// ========== Microsoft 正版登录 ==========

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
  return { success: true };
});


ipcMain.handle('window-focus', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
  return { success: true };
});


ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
  return { success: true };
});


ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});


ipcMain.handle('read-json-file', async (_, subPath: string, fileName: string) => {
  try {
    const dir: string = path.join(BASE_DIR, 'gpcl', subPath);
    const filePath: string = path.join(dir, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content: string = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e: any) {
    writeLog(`读取文件失败: ${e.message}`);
    return null;
  }
});


ipcMain.handle('write-json-file', async (_, subPath: string, fileName: string, data: any) => {
  try {
    const dir: string = path.join(BASE_DIR, 'gpcl', subPath);
    const filePath: string = path.join(dir, fileName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e: any) {
    writeLog(`写入文件失败: ${e.message}`);
    return false;
  }
});


ipcMain.handle('get-memory-usage', () => {
  return new Promise<number>((resolve) => {
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      const wmic = spawn('wmic', ['process', 'where', `processid=${process.pid}`, 'get', 'WorkingSetSize', '/value']);
      
      let output: string = '';
      wmic.stdout.on('data', (data: any) => {
        output += data.toString();
      });
      
      wmic.on('close', (code: number | null) => {
        try {
          const match: RegExpMatchArray | null = output.match(/WorkingSetSize=(\d+)/);
          if (match) {
            const memBytes: number = parseInt(match[1]);
            const memGB: number = memBytes / (1024 * 1024 * 1024);
            writeLog(`[内存获取] WMIC成功: ${memGB.toFixed(2)}GB`);
            resolve(parseFloat(memGB.toFixed(2)));
          } else {
            writeLog(`[内存获取] WMIC匹配失败，输出: "${output.trim()}"`);
            const memUsage = process.memoryUsage();
            const memGB: number = memUsage.heapUsed / (1024 * 1024 * 1024);
            resolve(parseFloat(memGB.toFixed(2)));
          }
        } catch (e: any) {
          writeLog(`[内存获取] WMIC解析失败: ${e.message}`);
          const memUsage = process.memoryUsage();
          const memGB: number = memUsage.heapUsed / (1024 * 1024 * 1024);
          resolve(parseFloat(memGB.toFixed(2)));
        }
      });
      
      wmic.on('error', (e: any) => {
        writeLog(`[内存获取] WMIC调用失败: ${e.message}`);
        const memUsage = process.memoryUsage();
        const memGB: number = memUsage.heapUsed / (1024 * 1024 * 1024);
        resolve(parseFloat(memGB.toFixed(2)));
      });
    } else {
      const memUsage = process.memoryUsage();
      const memGB: number = memUsage.heapUsed / (1024 * 1024 * 1024);
      resolve(parseFloat(memGB.toFixed(2)));
    }
  });
});


ipcMain.handle('optimize-memory', async () => {
  writeLog('[内存优化] 开始执行内存优化...');
  
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    
    return new Promise<boolean>((resolve) => {
      exec('rundll32.exe advapi32.dll,ProcessIdleTasks', { timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          writeLog(`[内存优化] ProcessIdleTasks执行失败: ${error.message}`);
        }
        
        setTimeout(() => {
          if (global.gc) {
            writeLog('[内存优化] 执行V8垃圾回收...');
            global.gc();
          }
          
          if (mainWindow) {
            writeLog('[内存优化] 清理渲染进程缓存...');
            mainWindow.webContents.session.clearCache().catch((e: any) => writeLog(`[内存优化] 清理缓存失败: ${e.message}`));
            mainWindow.webContents.session.clearStorageData().catch((e: any) => writeLog(`[内存优化] 清理存储失败: ${e.message}`));
          }
          
          setTimeout(() => {
            writeLog('[内存优化] 内存优化完成');
            resolve(true);
          }, 2000);
        }, 3000);
      });
    });
  } else {
    if (global.gc) {
      writeLog('[内存优化] 执行V8垃圾回收...');
      global.gc();
    }
    
    if (mainWindow) {
      writeLog('[内存优化] 清理渲染进程缓存...');
      await mainWindow.webContents.session.clearCache();
      await mainWindow.webContents.session.clearStorageData();
    }
    
    writeLog('[内存优化] 内存优化完成');
    return true;
  }
});


