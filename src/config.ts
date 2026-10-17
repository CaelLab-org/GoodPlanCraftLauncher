/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { app, ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
// __IMPORTS_END__

export function computeAutoMemoryMB(totalBytes: number = os.totalmem(), freeBytes: number = os.freemem()): number {
  const totalMB: number = Math.floor(totalBytes / (1024 * 1024));
  const freeMB: number = Math.floor(freeBytes / (1024 * 1024));
  const target: number = Math.floor((totalMB * 0.3) / 1024) * 1024;
  const available: number = Math.max(0, freeMB - 2048);
  const capped: number = Math.floor(available / 512) * 512;
  return Math.max(1024, Math.min(8192, target, capped));
}

export function getSystemMemoryInfo(): { totalMB: number; freeMB: number; autoMemoryMB: number } {
  const totalMB: number = Math.floor(os.totalmem() / (1024 * 1024));
  const freeMB: number = Math.floor(os.freemem() / (1024 * 1024));
  return { totalMB, freeMB, autoMemoryMB: computeAutoMemoryMB() };
}

export function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}


export function checkDebuggerAttached(): boolean {
  try {
    if (process.execArgv.some(arg => arg.includes('--inspect') || arg.includes('--debug-brk'))) {
      return true;
    }
    if (process.env.ELECTRON_ENABLE_STACK_DUMPING) {
      return true;
    }
  } catch (e) {}
  return false;
}


export let BASE_DIR: string;

export let GAME_DIR: string;

export let CACHE_DIR: string;

export let LOG_DIR: string;

export let LOG_FILE: string;

export let APP_VERSION: string;

export let CONFIG_DIR: string;

export let UPDATA_DIR: string;


export const DEFAULT_SETTINGS = {
  game: {
    memory: 'auto',
    playerName: 'GPCL_Player',
    javaPath: '',
    jvmArgs: '',
    gcPreset: 'default',
    windowMode: 'windowed',
    windowTitle: 'Minecraft {mc_version} (GPCL)',
    keepWindowTitle: false,
    processPriority: 'normal',
    launcherVisibility: 'keep',
    windowSize: 'default',
    windowWidth: 854,
    windowHeight: 480,
    optimizeBeforeLaunch: false
  },
  appearance: {
    theme: 'light',
    scale: '110',
    playStartupAnimation: true,
    skipSplash: false,
    tipFrequency: 'rare',
    enableMore: true
  },
  download: {
    maxConcurrent: 64,
    javaMirror: 'tsinghua',
    customJavaMirror: '',
    fileSource: 'auto',
    versionSource: 'auto',
    speedLimit: 0
  },
  advanced: {
    autoCheckUpdate: true,
    preventMultipleLaunch: true,
    autoClearLogs: true,
    logRetentionValue: 7,
    logRetentionUnit: 'day',
    developerMode: false
  }
};


export function parseIni(text: string): any {
  const result: any = {};
  let currentSection: string | null = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
      continue;
    }
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }
    const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch && currentSection) {
      const key = keyValueMatch[1].trim();
      let value: any = keyValueMatch[2].trim();
      if (value.toLowerCase() === 'true') {
        value = true;
      } else if (value.toLowerCase() === 'false') {
        value = false;
      } else {
        const num = Number(value);
        if (!isNaN(num)) {
          value = num;
        }
      }
      result[currentSection][key] = value;
    }
  }
  return result;
}


export function stringifyIni(obj: any): string {
  let result = '';
  for (const [section, sectionData] of Object.entries(obj)) {
    result += `[${section}]\n`;
    for (const [key, value] of Object.entries(sectionData as Record<string, any>)) {
      result += `${key}=${value}\n`;
    }
    result += '\n';
  }
  return result.trim();
}


export function mergeWithDefaults(settings: any): any {
  const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const [section, sectionData] of Object.entries(settings)) {
    if (merged[section]) {
      for (const [key, value] of Object.entries(sectionData as Record<string, any>)) {
        if (key in merged[section]) {
          merged[section][key] = value;
        }
      }
    }
  }
  return merged;
}


export function loadSettings(): any {
  try {
    const configPath = path.join(BASE_DIR, 'gpcl', 'config', 'setting.ini');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = parseIni(content);
      const merged = mergeWithDefaults(parsed);
      writeLog('配置已加载');
      return merged;
    }
  } catch (e: any) {
    writeLog(`加载配置失败: ${e.message}`);
  }
  writeLog('使用默认配置');
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}


export function saveSettings(settings: any): boolean {
  try {
    const configDir = path.join(BASE_DIR, 'gpcl', 'config');
    const configPath = path.join(configDir, 'setting.ini');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const content = stringifyIni(settings);
    fs.writeFileSync(configPath, content, 'utf8');
    writeLog('配置已保存');
    return true;
  } catch (e: any) {
    writeLog(`保存配置失败: ${e.message}`);
    return false;
  }
}


export function initPaths(): void {
  BASE_DIR = app.getPath('userData');
  GAME_DIR = path.join(BASE_DIR, '.minecraft');
  CACHE_DIR = path.join(BASE_DIR, 'gpcl', 'cache');
  LOG_DIR = path.join(BASE_DIR, 'gpcl', 'log');
  CONFIG_DIR = path.join(BASE_DIR, 'gpcl', 'config');
  UPDATA_DIR = path.join(BASE_DIR, 'gpcl', 'updata');
  const startupTime = new Date().toISOString().replace(/:/g, '-').replace('.', '_');
  LOG_FILE = path.join(LOG_DIR, `${startupTime}.log`);

  const requiredDirs = [
    path.join(BASE_DIR, 'gpcl', 'config'),
    path.join(BASE_DIR, 'gpcl', 'users'),
    LOG_DIR,
    CACHE_DIR,
    UPDATA_DIR
  ];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  fs.writeFileSync(LOG_FILE, '\uFEFF', 'utf8');

  // 启动时清理上次下载的更新安装包
  try {
    if (fs.existsSync(UPDATA_DIR)) {
      const files = fs.readdirSync(UPDATA_DIR);
      for (const file of files) {
        if (file.startsWith('GPCL-') && file.endsWith('-Setup.exe')) {
          fs.unlinkSync(path.join(UPDATA_DIR, file));
        }
      }
    }
  } catch (e) {}
}


export function cleanupExpiredLogs(): void {
  try {
    const settings = loadSettings();
    const autoClearLogs = settings.advanced?.autoClearLogs;
    
    if (!autoClearLogs) {
      writeLog('[日志清理] 自动清理日志已禁用');
      return;
    }

    const retentionValue = settings.advanced?.logRetentionValue || 7;
    const retentionUnit = settings.advanced?.logRetentionUnit || 'day';

    const now = Date.now();
    let expireTime: number;
    
    switch (retentionUnit) {
      case 'hour':
        expireTime = now - retentionValue * 60 * 60 * 1000;
        break;
      case 'day':
        expireTime = now - retentionValue * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        expireTime = now - retentionValue * 30 * 24 * 60 * 60 * 1000;
        break;
      case 'year':
        expireTime = now - retentionValue * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        expireTime = now - retentionValue * 24 * 60 * 60 * 1000;
    }

    if (!fs.existsSync(LOG_DIR)) {
      writeLog('[日志清理] 日志目录不存在');
      return;
    }

    const files = fs.readdirSync(LOG_DIR);
    let cleanedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
      const filePath = path.join(LOG_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtime.getTime() < expireTime) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      } catch (e: any) {
        writeLog(`[日志清理] 清理文件失败: ${file} - ${e.message}`);
      }
    }

    if (cleanedCount > 0) {
      writeLog(`[日志清理] 已清理 ${cleanedCount} 个过期日志文件`);
    } else {
      writeLog('[日志清理] 没有需要清理的过期日志');
    }
  } catch (e: any) {
    writeLog(`[日志清理] 清理过程出错: ${e.message}`);
  }
}


APP_VERSION = require('./package.json').version;


export function writeLog(message: string): void {
  const timestamp = formatTimestamp();
  const logLine = `[${timestamp}] ${message}\n`;
  try {
    if (LOG_FILE) {
      fs.appendFileSync(LOG_FILE, logLine, 'utf8');
    }
    console.log(`[${timestamp}] LOG:`, message);
  } catch (e) {
    console.error(`[${formatTimestamp()}] 写入日志失败:`, e);
  }
}


export let currentSettings: any = null;


ipcMain.handle('get-settings', () => {
  if (!currentSettings) {
    currentSettings = loadSettings();
  }
  return currentSettings;
});


ipcMain.handle('save-settings', (_: any, settings: any) => {
  currentSettings = mergeWithDefaults(settings);
  const success: boolean = saveSettings(currentSettings);
  return { success, settings: currentSettings };
});


ipcMain.handle('reset-settings', () => {
  currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const success: boolean = saveSettings(currentSettings);
  return { success, settings: currentSettings };
});

/** 跨模块写入用：BASE_DIR 归本模块所有，其它模块只能经此写入 */
export function setBaseDir(value: string): void { BASE_DIR = value; }
