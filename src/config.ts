/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, app, ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getLocale, getLocaleMeta, getSystemLocale, initI18n, isSupportedLocale, translateText } from './i18n';
// __IMPORTS_END__

export function computeAutoMemoryMB(totalBytes: number = os.totalmem(), freeBytes: number = os.freemem()): number {
  const totalMB: number = Math.floor(totalBytes / (1024 * 1024));
  const freeMB: number = Math.floor(freeBytes / (1024 * 1024));
  const target: number = Math.min(8192, Math.max(2048, Math.floor((totalMB * 0.3) / 1024) * 1024));
  const headroom: number = Math.max(2048, freeMB - 1024);
  const capped: number = Math.floor(headroom / 512) * 512;
  return Math.min(target, capped);
}

// 窗口底色要和当前主题一致：页面切换 / 重载时会露出这一层，深色底色在浅色主题下就是一道黑闪
export function themeBackgroundColor(theme?: string): string {
  return theme === 'light' ? '#f4f8fd' : '#0d1425';
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

// 首次启动判断必须在任何 saveSettings 之前完成：用户一进欢迎页就可能改语言，
// 那一步会写出 setting.ini，之后再查文件就永远不是“首次”了。
let firstRun: boolean = false;


export const DEFAULT_SETTINGS = {
  general: {
    language: 'auto',
    welcomeSeen: false
  },
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
    optimizeBeforeLaunch: false,
    autoLanguage: true,
    language: 'zh_cn',
    versionIsolation: 'all'
  },
  appearance: {
    theme: 'light',
    style: 'advanced',
    scale: '110',
    skipSplash: false,
    tipFrequency: 'rare',
    enableMore: false,
    avatarSize: 50
  },
  download: {
    maxConcurrent: 64,
    javaMirror: 'tsinghua',
    customJavaMirror: '',
    fileSource: 'auto',
    versionSource: 'auto',
    speedLimit: 0,
    installDir: '',
    customFileMirror: '',
    curseForgeApiKey: '',
    modNameMapping: true,
    modNameProviders: 'mcmod,130wiki',
    modNameDictionaries: '',
    modSources: ''
  },
  advanced: {
    autoCheckUpdate: true,
    autoUpdate: true,
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
  firstRun = !fs.existsSync(path.join(CONFIG_DIR, 'setting.ini'));
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
}


export function getSystemLanguageTags(): string[] {
  try {
    if (typeof app.getPreferredSystemLanguages === 'function') {
      const tags: string[] = app.getPreferredSystemLanguages();
      if (tags && tags.length) return tags;
    }
  } catch (e) {}
  try {
    return [app.getLocale()];
  } catch (e) {
    return [];
  }
}


export function readLanguagePreference(): string {
  try {
    const configPath = path.join(BASE_DIR, 'gpcl', 'config', 'setting.ini');
    if (fs.existsSync(configPath)) {
      const parsed = parseIni(fs.readFileSync(configPath, 'utf8'));
      return String(parsed.general?.language || 'auto');
    }
  } catch (e) {}
  return 'auto';
}


export function applyLanguageFromSettings(settings: any): void {
  const preference: string = String(settings?.general?.language || 'auto');
  initI18n(preference, getSystemLanguageTags());
}


export function initLanguage(): void {
  initI18n(readLanguagePreference(), getSystemLanguageTags());
}


export function resolveGameDir(installDir?: string): string {
  const custom: string = String(installDir === undefined ? (currentSettings?.download?.installDir || '') : installDir).trim();
  return custom ? path.resolve(custom) : path.join(BASE_DIR, '.minecraft');
}


export type VersionIsolationMode = 'off' | 'modded' | 'nonRelease' | 'moddedAndNonRelease' | 'all';


export function getVersionIsolationChoice(versionId: string, root: string = GAME_DIR): boolean | null {
  const versionDir: string = path.join(root, 'versions', versionId);
  try {
    const configPath: string = path.join(versionDir, 'gpcl', 'config.json');
    if (fs.existsSync(configPath)) {
      const config: any = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (typeof config?.isolation === 'boolean') return config.isolation;
    }
  } catch (e) {}
  if (fs.existsSync(path.join(versionDir, 'gpcl', 'isolated'))) return true;
  return null;
}


export function setVersionIsolationChoice(root: string, versionId: string, isolated: boolean): void {
  try {
    const gpclDir: string = path.join(root, 'versions', versionId, 'gpcl');
    if (!fs.existsSync(gpclDir)) fs.mkdirSync(gpclDir, { recursive: true });
    const configPath: string = path.join(gpclDir, 'config.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}; } catch { config = {}; }
    }
    config.isolation = isolated;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    const markerPath: string = path.join(gpclDir, 'isolated');
    if (isolated) fs.writeFileSync(markerPath, '1', 'utf8');
    else if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
  } catch (e: any) {
    writeLog(`[版本隔离] 写入设置失败: ${e.message}`);
  }
}


export function markVersionIsolated(root: string, versionId: string): void {
  setVersionIsolationChoice(root, versionId, true);
}


function hasVersionContent(versionDir: string): boolean {
  try {
    const modsDir: string = path.join(versionDir, 'mods');
    if (fs.existsSync(modsDir) && fs.readdirSync(modsDir).length > 0) return true;
    const savesDir: string = path.join(versionDir, 'saves');
    if (fs.existsSync(savesDir) && fs.readdirSync(savesDir, { withFileTypes: true }).some((entry: fs.Dirent) => entry.isDirectory())) return true;
  } catch (e) {}
  return false;
}


export function isVersionIsolated(versionId: string, root: string = GAME_DIR): boolean {
  const choice: boolean | null = getVersionIsolationChoice(versionId, root);
  if (choice !== null) return choice;
  return hasVersionContent(path.join(root, 'versions', versionId));
}


export function shouldIsolateNewVersion(modable: boolean, versionType: string, mode?: string): boolean {
  const selected: string = String(mode ?? currentSettings?.game?.versionIsolation ?? 'all');
  const nonRelease: boolean = versionType !== 'release';
  switch (selected) {
    case 'off':
      return false;
    case 'modded':
      return modable;
    case 'nonRelease':
      return nonRelease;
    case 'moddedAndNonRelease':
      return modable || nonRelease;
    default:
      return true;
  }
}


export function applyInitialVersionIsolation(versionId: string, info: { modable?: boolean; versionType?: string }, root: string = GAME_DIR): boolean {
  const existing: boolean | null = getVersionIsolationChoice(versionId, root);
  if (existing !== null) return existing;
  const versionDir: string = path.join(root, 'versions', versionId);
  const isolated: boolean = hasVersionContent(versionDir) || shouldIsolateNewVersion(info.modable === true, String(info.versionType || 'release'));
  setVersionIsolationChoice(root, versionId, isolated);
  writeLog(`[版本隔离] ${versionId} 初始化为${isolated ? '独立' : '共用'}`);
  return isolated;
}


export function getVersionGameDir(versionId: string, root: string = GAME_DIR): string {
  return isVersionIsolated(versionId, root) ? path.join(root, 'versions', versionId) : root;
}


export function initGameDirFromSettings(): void {
  currentSettings = loadSettings();
  applyInstallDir();
}


export function applyInstallDir(): void {
  const next: string = resolveGameDir();
  try {
    if (!fs.existsSync(next)) fs.mkdirSync(next, { recursive: true });
  } catch (e: any) {
    writeLog(`游戏目录不可用，保持原目录: ${next} - ${e.message}`);
    return;
  }
  if (GAME_DIR !== next) {
    GAME_DIR = next;
    writeLog(`游戏目录已切换: ${GAME_DIR}`);
  }
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
  const localized: string = translateText(message);
  const logLine = `[${timestamp}] ${localized}\n`;
  try {
    if (LOG_FILE) {
      fs.appendFileSync(LOG_FILE, logLine, 'utf8');
    }
    console.log(`[${timestamp}] LOG:`, localized);
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


function syncWindowBackground(event: any): void {
  try {
    const win: any = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setBackgroundColor(themeBackgroundColor(currentSettings?.appearance?.theme));
  } catch (e) {}
}


ipcMain.handle('save-settings', (event: any, settings: any) => {
  currentSettings = mergeWithDefaults(settings);
  const success: boolean = saveSettings(currentSettings);
  applyInstallDir();
  applyLanguageFromSettings(currentSettings);
  syncWindowBackground(event);
  return { success, settings: currentSettings };
});


ipcMain.handle('reset-settings', (event: any) => {
  currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const success: boolean = saveSettings(currentSettings);
  applyInstallDir();
  applyLanguageFromSettings(currentSettings);
  syncWindowBackground(event);
  return { success, settings: currentSettings };
});


ipcMain.handle('set-language', (_: any, code: string) => {
  if (code !== 'auto' && !isSupportedLocale(code)) {
    return { success: false, locale: getLocale() };
  }
  if (!currentSettings) {
    currentSettings = loadSettings();
  }
  currentSettings.general = currentSettings.general || {};
  currentSettings.general.language = code;
  const success: boolean = saveSettings(currentSettings);
  applyLanguageFromSettings(currentSettings);
  return { success, locale: getLocale() };
});


ipcMain.handle('get-i18n-info', () => ({
  locale: getLocale(),
  systemLocale: getSystemLocale(),
  firstRun
}));

// 预加载脚本在页面脚本之前同步取一次，界面首帧就能用对语言和主题，不会先画一遍默认的英文深色界面
ipcMain.on('get-i18n-info-sync', (event: any) => {
  if (!currentSettings) {
    currentSettings = loadSettings();
  }
  event.returnValue = {
    locale: getLocale(),
    dir: getLocaleMeta(getLocale()).dir,
    systemLocale: getSystemLocale(),
    firstRun,
    theme: currentSettings.appearance?.theme || 'dark',
    style: currentSettings.appearance?.style || 'advanced',
    scale: currentSettings.appearance?.scale || '100',
    skipSplash: currentSettings.appearance?.skipSplash === true
  };
});

ipcMain.handle('complete-welcome', () => {
  if (!currentSettings) {
    currentSettings = loadSettings();
  }
  currentSettings.general = currentSettings.general || {};
  currentSettings.general.welcomeSeen = true;
  return { success: saveSettings(currentSettings) };
});

/** 跨模块写入用：BASE_DIR 归本模块所有，其它模块只能经此写入 */
export function setBaseDir(value: string): void { BASE_DIR = value; }
