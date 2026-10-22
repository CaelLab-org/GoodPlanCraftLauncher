/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, Menu, app, dialog, ipcMain, nativeImage, shell } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

import { APP_VERSION, BASE_DIR, CONFIG_DIR, getSystemMemoryInfo, loadSettings, themeBackgroundColor, writeLog } from './config';
import { t, translateText } from './i18n';
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
    backgroundColor: themeBackgroundColor(loadSettings().appearance?.theme),
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

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
  const buttons: string[] = Array.isArray(options.buttons)
    ? options.buttons.map((button: string) => translateText(button))
    : [t('ui.ok')];
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'info',
    title: translateText(options.title || t('ui.notice')),
    message: translateText(options.message || ''),
    detail: translateText(options.detail || ''),
    buttons,
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


// ========== 自定义头像 ==========

export const AVATAR_DIR_NAME: string = path.join('gpcl', 'users', 'avatar');

function avatarConfigPath(): string {
  return path.join(CONFIG_DIR, 'avatar.json');
}

function readAvatarConfig(): any {
  try {
    const file: string = avatarConfigPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function resolveStoredAvatar(): string {
  const stored: string = String(readAvatarConfig().path || '').trim();
  if (!stored) return '';
  const absolute: string = path.isAbsolute(stored) ? stored : path.join(BASE_DIR, stored);
  return fs.existsSync(absolute) ? absolute : '';
}

function compressAvatar(source: Buffer): Buffer | null {
  try {
    const image = nativeImage.createFromBuffer(source);
    if (image.isEmpty()) return null;
    const size = image.getSize();
    const longest: number = Math.max(size.width, size.height);
    const scaled = longest > 1024
      ? image.resize({
        width: Math.round((size.width * 1024) / longest),
        height: Math.round((size.height * 1024) / longest),
        quality: 'best'
      })
      : image;

    let quality: number = 88;
    let output: Buffer = scaled.toJPEG(quality);
    while (output.length > 1024 * 1024 && quality > 30) {
      quality -= 8;
      output = scaled.toJPEG(quality);
    }
    return output.length <= 4 * 1024 * 1024 ? output : null;
  } catch (e: any) {
    writeLog(`[头像] 压缩失败: ${e.message}`);
    return null;
  }
}

ipcMain.handle('get-avatar', () => {
  const absolute: string = resolveStoredAvatar();
  return { success: true, path: absolute, url: absolute ? pathToFileURL(absolute).href : '' };
});

ipcMain.handle('reset-avatar', () => {
  try {
    const file: string = avatarConfigPath();
    if (fs.existsSync(file)) fs.unlinkSync(file);
    writeLog('[头像] 已恢复默认头像');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('choose-avatar', async () => {
  if (!mainWindow) return { success: false, error: t('ui.window_is_not_ready') };

  const picked = await dialog.showOpenDialog(mainWindow, {
    title: t('ui.choose_avatar'),
    properties: ['openFile'],
    filters: [{ name: t('ui.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  });
  if (picked.canceled || !picked.filePaths[0]) return { success: false, cancelled: true };

  const source: string = picked.filePaths[0];
  try {
    const stat = fs.statSync(source);
    const MB: number = 1024 * 1024;
    if (stat.size > 32 * MB) {
      return { success: false, error: t('ui.the_image_is_over_32_mb_compress_it_first') };
    }

    let data: Buffer = fs.readFileSync(source);
    let ext: string = (path.extname(source).slice(1) || 'png').toLowerCase();
    let compressed: boolean = false;

    if (data.length > MB) {
      let shouldCompress: boolean = data.length > 4 * MB;
      if (!shouldCompress) {
        const answer = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: t('ui.large_avatar_file'),
          message: t('ui.the_image_is_size_mb_compress_it_before_use', { size: (data.length / MB).toFixed(1) }),
          detail: t('ui.the_image_will_be_saved_as_jpeg_with_a_slight_quality_loss_you_can_keep_02fdbb'),
          buttons: [t('ui.compress_and_use'), t('ui.keep_original')],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        shouldCompress = answer.response === 0;
      }

      if (shouldCompress) {
        const small: Buffer | null = compressAvatar(data);
        if (small) {
          data = small;
          ext = 'jpg';
          compressed = true;
        } else if (stat.size > 4 * MB) {
          return { success: false, error: t('ui.the_image_is_over_4_mb_and_this_format_cannot_be_compressed_choose_another_image') };
        }
      }
    }

    if (data.length > 4 * MB) {
      return { success: false, error: t('ui.avatars_can_be_at_most_4_mb') };
    }

    const dir: string = path.join(BASE_DIR, AVATAR_DIR_NAME);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const hash: string = crypto.createHash('sha1').update(data).digest('hex').slice(0, 8);
    const fileName: string = `${Date.now()}-${hash}.${ext}`;
    const dest: string = path.join(dir, fileName);
    fs.writeFileSync(dest, data);

    const relative: string = path.relative(BASE_DIR, dest).split(path.sep).join('/');
    fs.writeFileSync(avatarConfigPath(), JSON.stringify({ path: relative, updatedAt: Date.now() }, null, 2), 'utf8');
    writeLog(`[头像] 已保存 ${dest}${compressed ? '（已压缩）' : ''}`);

    return { success: true, path: dest, url: pathToFileURL(dest).href, compressed, size: data.length };
  } catch (e: any) {
    writeLog(`[头像] 保存失败: ${e.message}`);
    return { success: false, error: e.message };
  }
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


function getLauncherWorkingSetMB(): number {
  try {
    const totalKB: number = app.getAppMetrics().reduce((sum: number, metric: any) => {
      return sum + (metric.memory?.workingSetSize || 0);
    }, 0);
    return Math.round(totalKB / 1024);
  } catch {
    return 0;
  }
}


export function trimWorkingSets(): Promise<{ beforeMB: number; afterMB: number; freedMB: number }> {
  const beforeMB: number = getLauncherWorkingSetMB();

  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ beforeMB, afterMB: beforeMB, freedMB: 0 });
      return;
    }

    const typeDef: string = [
      'using System;',
      'using System.Runtime.InteropServices;',
      'public static class GpclMem {',
      '  [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h);',
      '  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int access, bool inherit, int pid);',
      '  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);',
      '}'
    ].join('\n');

    const script: string = [
      `Add-Type -TypeDefinition @'`,
      typeDef,
      `'@`,
      `$root = ${process.pid}`,
      `$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId`,
      `$queue = New-Object System.Collections.Queue`,
      `$seen = @{}`,
      `$queue.Enqueue([int]$root)`,
      `$count = 0`,
      `while ($queue.Count -gt 0) {`,
      `  $procId = [int]$queue.Dequeue()`,
      `  if ($seen.ContainsKey($procId)) { continue }`,
      `  $seen[$procId] = $true`,
      `  $h = [GpclMem]::OpenProcess(0x0500, $false, $procId)`,
      `  if ($h -ne [IntPtr]::Zero) {`,
      `    if ([GpclMem]::EmptyWorkingSet($h)) { $count++ }`,
      `    [GpclMem]::CloseHandle($h) | Out-Null`,
      `  }`,
      `  foreach ($child in $all) {`,
      `    if ([int]$child.ParentProcessId -eq $procId) { $queue.Enqueue([int]$child.ProcessId) }`,
      `  }`,
      `}`,
      `Write-Output ("TRIMMED|" + $count)`
    ].join('\n');

    const { spawn } = require('child_process');
    const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    let output: string = '';
    let settled: boolean = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      const afterMB: number = getLauncherWorkingSetMB();
      writeLog(`[内存优化] 工作集: ${beforeMB}MB -> ${afterMB}MB，共处理 ${output.match(/TRIMMED\|(\d+)/)?.[1] || '0'} 个进程`);
      resolve({ beforeMB, afterMB, freedMB: Math.max(0, beforeMB - afterMB) });
    };

    ps.stdout?.on('data', (data: any) => { output += data.toString(); });
    ps.stderr?.on('data', (data: any) => {
      const text: string = data.toString().trim();
      if (text) writeLog(`[内存优化] ${text}`);
    });
    ps.on('error', (error: any) => {
      writeLog(`[内存优化] 执行失败: ${error.message}`);
      finish();
    });
    ps.on('exit', () => finish());
    setTimeout(() => {
      if (!settled) {
        try { ps.kill(); } catch {}
        writeLog('[内存优化] 执行超时');
        finish();
      }
    }, 15000);
  });
}


ipcMain.handle('get-memory-usage', () => getLauncherWorkingSetMB());


ipcMain.handle('get-system-memory', () => getSystemMemoryInfo());


ipcMain.handle('optimize-memory', () => trimWorkingSets());


ipcMain.handle('get-license-text', () => {
  try {
    const localPath: string = path.join(__dirname, 'LICENSE.txt');
    const sourcePath: string = path.join(__dirname, '..', 'LICENSE');
    return fs.readFileSync(fs.existsSync(localPath) ? localPath : sourcePath, 'utf8');
  } catch (error: any) {
    writeLog(`[关于] 读取许可证失败: ${error.message}`);
    return '';
  }
});


ipcMain.handle('get-runtime-info', () => ({
  appVersion: APP_VERSION || app.getVersion(),
  electron: process.versions.electron || '',
  chrome: process.versions.chrome || '',
  node: process.versions.node || '',
  platform: `${os.type()} ${os.release()} (${os.arch()})`
}));


