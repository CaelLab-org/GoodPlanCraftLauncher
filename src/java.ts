/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { CACHE_DIR, GAME_DIR, writeLog } from './config';
import { fetchText } from './download';
import { mainWindow } from './shell';
import { completedDownloadFiles, isJavaDownloading, javaDownloadResolve, setCurrentDownloadPath, setCurrentDownloadType, setCurrentDownloadVersion, setIsJavaDownloading, setJavaDownloadReject, setJavaDownloadResolve, setShouldCancelDownload, shouldCancelDownload, totalDownloadFiles } from './state';
// __IMPORTS_END__

export const JAVA_RUNTIME_MAP: Record<string, string> = {
  "8": "jre-legacy", "16": "java-runtime-beta", "17": "java-runtime-gamma",
  "21": "java-runtime-delta", "25": "java-runtime-epsilon"
};


export const JAVA_DOWNLOAD_KEYS: Record<string, string> = {
  "8": "jre-legacy", "17": "java-runtime-gamma",
  "21": "java-runtime-delta", "25": "java-runtime-epsilon"
};


export const JAVA_VERSIONS_AVAILABLE: string[] = ["8", "17", "21", "25"];


export function getJavaRuntimeDir(javaVersion: string): string {
  const runtimeName = JAVA_RUNTIME_MAP[javaVersion] || `jre${javaVersion}`;
  return path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft', 'runtime', runtimeName);
}


export function findJavaExecutable(runtimeDir: string): string | null {
  const javaPath = path.join(runtimeDir, 'bin', 'java.exe');
  if (fs.existsSync(javaPath)) {
    try {
      fs.accessSync(javaPath, fs.constants.R_OK);
      return javaPath;
    } catch (e) { return null; }
  }
  return findJavaExecutableInDir(runtimeDir);
}


export async function checkJavaInstalled(javaVersion: string): Promise<{ installed: boolean; javaPath: string | null }> {
  const runtimeDir = getJavaRuntimeDir(javaVersion);
  if (fs.existsSync(runtimeDir)) {
    const exe = findJavaExecutable(runtimeDir);
    if (exe) return { installed: true, javaPath: exe };
  }
  return { installed: false, javaPath: null };
}


export function getJavaVersionForMCVersion(versionId: string): string {
  const parts = versionId.split('.');
  let major = parseInt(parts[0], 10);
  let minor = parseInt(parts[1], 10);
  if (isNaN(major)) major = 1;
  if (isNaN(minor)) {
    if (major >= 26) return '25';
    if (major >= 21) return '21';
    return '17';
  }
  if (major === 1) {
    if (minor < 17) return '8';
    if (minor === 17) return '16';
    if (minor <= 20) return '17';
    return '21';
  }
  if (major >= 26) return '25';
  if (major >= 21) return '21';
  return '17';
}


export function getJavaVersionFromVersionData(versionData: any): string {
  if (versionData?.javaVersion?.majorVersion) return String(versionData.javaVersion.majorVersion);
  if (versionData?.javaVersion?.component) {
    const m = versionData.javaVersion.component.match(/\d+/);
    if (m) return m[0];
  }
  return getJavaVersionForMCVersion(versionData.id);
}


export async function ensureJavaRuntime(version: string): Promise<string | null> {
  const javaVersion = typeof version === 'string' ? version : String(version);
  const runtimeDir = getJavaRuntimeDir(javaVersion);
  writeLog(`[Java] 查找 Java ${javaVersion} 运行时: ${runtimeDir}`);
  if (fs.existsSync(runtimeDir)) {
    const exe = findJavaExecutable(runtimeDir);
    if (exe) { writeLog(`[Java] 找到 Java ${javaVersion}: ${exe}`); return exe; }
  }
  writeLog(`[Java] 未找到 Java ${javaVersion} 运行时`);
  return null;
}


export async function ensureJavaRuntimeWithInstall(version: string, mainWindow: BrowserWindow): Promise<any> {
  const javaVersion = typeof version === 'string' ? version : String(version);
  const installed = await checkJavaInstalled(javaVersion);
  if (installed.installed && installed.javaPath) {
    writeLog(`[Java] Java ${javaVersion} 已安装: ${installed.javaPath}`);
    return { success: true, javaPath: installed.javaPath };
  }
  writeLog(`[Java] Java ${javaVersion} 未安装，开始下载流程`);
  return null;
}


ipcMain.handle('uninstall-java', async (_: any, javaVersion: string) => {
  try {
    const runtimeDir = getJavaRuntimeDir(javaVersion);
    writeLog(`[Java] 开始卸载 Java ${javaVersion}，目录: ${runtimeDir}`);
    if (!fs.existsSync(runtimeDir)) return { success: false, error: `Java ${javaVersion} 未安装` };
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    writeLog(`[Java] Java ${javaVersion} 已卸载，目录已删除: ${runtimeDir}`);
    if (mainWindow) mainWindow.webContents.send('java-uninstalled', { javaVersion });
    return { success: true };
  } catch (e: any) { writeLog(`[Java] 卸载 Java ${javaVersion} 失败: ${e.message}`); return { success: false, error: e.message }; }
});


ipcMain.handle('get-java-mirror-settings', () => {
  try {
    const settingsPath = path.join(GAME_DIR, 'settings', 'java_mirror.json');
    if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return { mirror: 'tsinghua', customUrl: '' };
  } catch (e) { return { mirror: 'tsinghua', customUrl: '' }; }
});


ipcMain.handle('get-java-download-url', async (_: any, javaVersion: string) => {
  try {
    const settingsPath = path.join(GAME_DIR, 'settings', 'java_mirror.json');
    let settings: any = { mirror: 'tsinghua', customUrl: '' };
    if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const url = await getJavaDownloadUrl(javaVersion, settings.mirror, settings.customUrl);
    writeLog(`[Java] 获取下载URL: Java ${javaVersion} - ${url}`);
    if (!url) return { success: false, error: '没有可用的下载源' };
    return { success: true, url };
  } catch (e: any) { writeLog(`[Java] 获取下载URL失败: ${e.message}`); return { success: false, error: e.message }; }
});


export async function fetchJavaDownloadUrlFromAPI(javaVersion: string): Promise<string | null> {
  try {
    writeLog(`[Java] 通过 Adoptium API 获取 Java ${javaVersion} 下载地址...`);
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${javaVersion}/hotspot?image_type=jre&architecture=x64&os=windows`;
    const data = await fetchText(apiUrl);
    const json = JSON.parse(data);
    if (json && json.length > 0 && json[0].binary?.package?.link) {
      const url = json[0].binary.package.link;
      writeLog(`[Java] Adoptium API 返回 URL: ${url}`);
      return url;
    }
    writeLog(`[Java] Adoptium API 未返回有效下载链接`);
    return null;
  } catch (e: any) {
    writeLog(`[Java] Adoptium API 请求失败: ${e.message}`);
    return null;
  }
}


export const javaSourceCache: Record<string, { filename: string; origin: string }> = {};


export function javaVersionToken(filename: string): string | null {
  const m = filename.match(/hotspot_([^/\\]+?)\.zip$/i);
  return m ? m[1] : null;
}

// 国内镜像站，布局一致：adoptium/<大版本>/jre/x64/windows/<文件名>

export const JAVA_MIRRORS: { id: string; name: string; build: (v: string, fn: string) => string }[] = [
  { id: 'tsinghua', name: '清华大学镜像', build: (v, fn) => `https://mirrors.tuna.tsinghua.edu.cn/Adoptium/${v}/jre/x64/windows/${fn}` },
  { id: 'nju', name: '南京大学镜像', build: (v, fn) => `https://mirror.nju.edu.cn/adoptium/${v}/jre/x64/windows/${fn}` },
  { id: 'huawei', name: '华为云镜像', build: (v, fn) => `https://mirrors.huaweicloud.com/adoptium/${v}/jre/x64/windows/${fn}` }
];


export const JAVA_OFFICIAL_SOURCE = 'adoptium';

// 从 Adoptium API 拿当前文件名；文件名是唯一的版本真相来源，
// 不再写死具体版本号（写死的会在镜像同步后集体 404）。

export async function resolveJavaSources(javaVersion: string): Promise<{ filename: string; origin: string } | null> {
  if (javaSourceCache[javaVersion]) return javaSourceCache[javaVersion];

  const origin: string | null = await fetchJavaDownloadUrlFromAPI(javaVersion);
  if (!origin) {
    writeLog(`[Java] 未能获取 Java ${javaVersion} 的下载文件名，无可用下载源`);
    return null;
  }

  const filename: string = decodeURIComponent(origin.split('/').pop() || '');
  if (!filename) return null;

  const sources: { filename: string; origin: string } = { filename, origin };
  javaSourceCache[javaVersion] = sources;
  writeLog(`[Java] Java ${javaVersion} 文件名: ${filename}`);
  return sources;
}

// 按「首选源 → 其余国内镜像 → Adoptium 官方」排出候选地址，下载时逐个尝试

export async function buildJavaSourceList(javaVersion: string, mirror: string, customUrl: string): Promise<{ id: string; name: string; url: string }[]> {
  const sources: { filename: string; origin: string } | null = await resolveJavaSources(javaVersion);
  if (!sources) return [];

  const list: { id: string; name: string; url: string }[] = [];

  if (mirror === 'custom' && customUrl) {
    const token: string | null = javaVersionToken(sources.filename);
    list.push({
      id: 'custom',
      name: '自定义镜像源',
      url: customUrl
        .replace(/\{v\}/gi, javaVersion)
        .replace(/\{version\}/gi, token || javaVersion)
    });
  }

  const preferred = JAVA_MIRRORS.find(m => m.id === mirror);
  const ordered = preferred ? [preferred, ...JAVA_MIRRORS.filter(m => m.id !== mirror)] : JAVA_MIRRORS;
  for (const m of ordered) {
    list.push({ id: m.id, name: m.name, url: m.build(javaVersion, sources.filename) });
  }

  list.push({ id: JAVA_OFFICIAL_SOURCE, name: 'Adoptium 官方', url: sources.origin });

  return list;
}


export async function getJavaDownloadUrl(javaVersion: string, mirror: string, customUrl: string): Promise<string> {
  const list = await buildJavaSourceList(javaVersion, mirror, customUrl);
  return list.length > 0 ? list[0].url : '';
}


export function saveJavaMirrorSettings(mirror: string, customUrl: string): boolean {
  try {
    const settingsDir = path.join(GAME_DIR, 'settings');
    if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
    const settingsPath = path.join(settingsDir, 'java_mirror.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ mirror, customUrl }, null, 2));
    writeLog(`[Java] 镜像源设置已保存: ${mirror}`);
    return true;
  } catch (e: any) { writeLog(`[Java] 保存镜像源设置失败: ${e.message}`); return false; }
}



ipcMain.handle('show-java-install-dialog', async (_, options: any) => {
  try {
    const { mcVersion, recommendedJava } = options;

    const versionPriority: any = {
      [recommendedJava]: 0,
      "17": 1,
      "21": 2,
      "25": 3,
      "8": 4
    };
    
    const sortedVersions: string[] = [...JAVA_VERSIONS_AVAILABLE].sort((a: string, b: string) => {
      return (versionPriority[a] || 99) - (versionPriority[b] || 99);
    });
    
    const result = await new Promise<any>((resolve, reject) => {
setJavaDownloadResolve(resolve);
setJavaDownloadReject(reject);

      if (mainWindow) {
        mainWindow.webContents.send('show-java-install-dialog', {
          mcVersion,
          recommendedJava,
          availableVersions: sortedVersions
        });
      } else {
        reject(new Error('窗口未初始化'));
      }
    });
    
    return result;
  } catch (e: any) {
    writeLog(`Java安装对话框错误: ${e.message}`);
    return { success: false, cancelled: true };
  }
});


ipcMain.handle('select-java-version', async (_, data: any) => {
  const { selectedVersion, cancelled } = data;
  
  if (cancelled) {
    if (javaDownloadResolve) {
      javaDownloadResolve({ success: false, cancelled: true });
setJavaDownloadResolve(null);
setJavaDownloadReject(null);
    }
    return { success: false, cancelled: true };
  }
  
  if (selectedVersion && javaDownloadResolve) {
    javaDownloadResolve({ success: true, selectedVersion });
setJavaDownloadResolve(null);
setJavaDownloadReject(null);
    return { success: true, selectedVersion };
  }
  
  return { success: false, cancelled: true };
});


export async function downloadAndInstallJava(javaVersion: string): Promise<any> {
  const runtimeDir: string = getJavaRuntimeDir(javaVersion);
  
  writeLog(`[Java] 开始安装 Java ${javaVersion} 运行时`);
  
  try {
    
    if (fs.existsSync(runtimeDir)) {
      const exe: string | null = findJavaExecutable(runtimeDir);
      if (exe) {
        writeLog(`[Java] Java ${javaVersion} 已存在，无需下载`);
        return { success: true, javaPath: exe };
      }
    }

    const settingsPath: string = path.join(GAME_DIR, 'settings', 'java_mirror.json');
    let settings: any = { mirror: 'tsinghua', customUrl: '' };
    
    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (e: any) {}

    let sources: { id: string; name: string; url: string }[] = [];
    try {
      sources = await buildJavaSourceList(javaVersion, settings.mirror, settings.customUrl);
    } catch (e: any) {
      writeLog(`[Java] 获取下载源列表失败: ${e.message}`);
    }

    if (sources.length === 0) {
      return { success: false, error: '没有可用的下载源' };
    }
    writeLog(`[Java] 候选下载源: ${sources.map(s => s.name).join(' → ')}`);

    let result: any = { success: false, error: '没有可用的下载源' };
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      writeLog(`[Java] 尝试下载源 ${i + 1}/${sources.length}：${src.name} - ${src.url}`);
      result = await downloadJavaWithWebContents(javaVersion, src.url);
      if (result.success) break;
      if (result.error && result.error.includes('取消')) {
        writeLog(`[Java] 用户取消下载，停止切换下载源`);
        break;
      }
      writeLog(`[Java] 下载源「${src.name}」失败: ${result.error}`);
    }

    return result;
    
  } catch (e: any) {
    writeLog(`[Java] Java ${javaVersion} 安装失败: ${e.message}`);

    if (fs.existsSync(runtimeDir)) {
      try {
        fs.rmSync(runtimeDir, { recursive: true, force: true });
      } catch (e2: any) {}
    }
    
    return { success: false, error: e.message };
  }
}


export async function downloadJavaWithWebContents(javaVersion: string, downloadUrl: string): Promise<any> {
  const runtimeName: string = JAVA_RUNTIME_MAP[javaVersion];
  const runtimeDir: string = getJavaRuntimeDir(javaVersion);
  const tempDir: string = path.join(CACHE_DIR, 'java_temp');
  const tempFile: string = path.join(tempDir, `java-${javaVersion}.zip`);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  writeLog(`[Java] 使用Electron下载 Java ${javaVersion}: ${downloadUrl}`);

setCurrentDownloadVersion(`java-${javaVersion}`);
setCurrentDownloadType('java');
setCurrentDownloadPath(tempFile);
setShouldCancelDownload(false);
setIsJavaDownloading(true);

  return new Promise<any>((resolve, reject) => {
    const win: any = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) {
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
      reject(new Error('没有可用的窗口'));
      return;
    }

    win.webContents.downloadURL(downloadUrl, true);

    win.webContents.session.once('will-download', (event: any, item: any) => {
      
      item.setSavePath(tempFile);
      
      const totalBytes: number = item.getTotalBytes();
      writeLog(`[Java] 开始下载，总大小: ${totalBytes} bytes`);

      item.on('updated', (event: any, state: string) => {
        if (state === 'progressing') {
          const received: number = item.getReceivedBytes();
          const percent: number = totalBytes > 0 ? Math.floor((received / totalBytes) * 100) : 0;
          
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send('download-progress', {
              label: `Java ${javaVersion}`,
              percent: percent,
              bytesDownloaded: received,
              current: completedDownloadFiles,
              total: totalDownloadFiles
            });
          }

          if (shouldCancelDownload) {
            item.cancel();
            writeLog(`[Java] 下载已取消`);
          }
        }
      });

      item.on('done', (event: any, state: string) => {
        if (state === 'cancelled') {
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
          reject(new Error('下载已取消'));
          return;
        }

        if (state === 'interrupted') {
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
          reject(new Error('网络连接中断，请检查网络后重试'));
          return;
        }

        if (state === 'completed') {
          writeLog(`[Java] 下载完成，开始验证...`);

          const fileStats = fs.statSync(tempFile);
          const fileSize: number = fileStats.size;
          writeLog(`[Java] 下载文件大小: ${fileSize} bytes`);
          
          if (fileSize < 1024) {
            // 可能下载到了拦截页面，尝试读取内容判断
            let hint = '';
            try {
              const content = fs.readFileSync(tempFile, 'utf8').slice(0, 200);
              if (content.includes('<html') || content.includes('<!DOCTYPE')) {
                hint = '（下载到了网页而非ZIP文件，镜像源可能不可用）';
              }
            } catch (e) {}
            reject(new Error(`下载失败：文件太小 (${fileSize} bytes)${hint}`));
            return;
          }

          const header: Buffer = Buffer.alloc(4);
          const fd: number = fs.openSync(tempFile, 'r');
          fs.readSync(fd, header, 0, 4, 0);
          fs.closeSync(fd);
          
          if (header.toString('hex') !== '504b0304') {
            let hint = '';
            try {
              const content = fs.readFileSync(tempFile, 'utf8').slice(0, 500);
              if (content.includes('<html') || content.includes('<!DOCTYPE')) {
                hint = '（文件内容是HTML页面，镜像源返回了拦截页面）';
              } else {
                hint = `（文件头: ${header.toString('hex')}，内容: ${content.slice(0, 100)}）`;
              }
            } catch (e) {}
            reject(new Error(`下载失败：文件不是有效的ZIP格式${hint}`));
            return;
          }
          
          writeLog(`[Java] 文件验证通过，大小: ${fileSize} bytes`);

          const parentDir: string = path.dirname(runtimeDir);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          
          if (fs.existsSync(runtimeDir)) {
            fs.rmSync(runtimeDir, { recursive: true, force: true });
          }
          
          try {
            const AdmZip: any = require('adm-zip');
            const zip: any = new AdmZip(tempFile);
            zip.extractAllTo(parentDir, false);
            writeLog(`[Java] 解压完成`);
          } catch (zipError: any) {
            reject(new Error(`解压失败: ${zipError.message}`));
            return;
          }

          const entries: string[] = fs.readdirSync(parentDir);
          let extractedDir: string | null = null;
          for (const entry of entries) {
            const entryPath: string = path.join(parentDir, entry);
            if (fs.statSync(entryPath).isDirectory()) {
              if (entry.includes('jdk') || entry.includes('jre')) {
                const binPath: string = path.join(entryPath, 'bin', 'java.exe');
                if (fs.existsSync(binPath)) {
                  extractedDir = entryPath;
                  writeLog(`[Java] 找到目录: ${entry}`);
                  break;
                }
              }
            }
          }
          
          if (extractedDir && extractedDir !== runtimeDir) {
            if (fs.existsSync(runtimeDir)) {
              fs.rmSync(runtimeDir, { recursive: true, force: true });
            }
            fs.renameSync(extractedDir, runtimeDir);
            writeLog(`[Java] 已重命名为: ${runtimeName}`);
          }

          try {
            fs.unlinkSync(tempFile);
          } catch (e: any) {}

          const javaPath: string | null = findJavaExecutable(runtimeDir);
          if (!javaPath) {
            reject(new Error('Java运行时安装失败，未找到java.exe'));
            return;
          }
          
          writeLog(`[Java] Java ${javaVersion} 安装成功: ${javaPath}`);
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
          resolve({ success: true, javaPath });
        } else {
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
          reject(new Error(`下载失败: ${state}`));
        }
      });
    });

    setTimeout(() => {
      if (isJavaDownloading) {
        writeLog(`[Java] 下载超时`);
setIsJavaDownloading(false);
setCurrentDownloadVersion(null);
setCurrentDownloadType(null);
setCurrentDownloadPath(null);
        reject(new Error('下载超时'));
      }
    }, 600000);
  }).catch((e: any) => {
    writeLog(`[Java] Java ${javaVersion} 安装失败: ${e.message}`);
    if (fs.existsSync(runtimeDir)) {
      try {
        fs.rmSync(runtimeDir, { recursive: true, force: true });
      } catch (e2: any) {}
    }
    return { success: false, error: e.message };
  });
}



export async function getJavaRuntimeDownloadInfo(javaVersion: string): Promise<any> {
  try {
    const runtimeKey: string = JAVA_DOWNLOAD_KEYS[javaVersion];
    if (!runtimeKey) {
      writeLog(`[Java] 不支持的Java版本: ${javaVersion}`);
      return null;
    }
    
    writeLog(`[Java] 正在查找 Java ${javaVersion} (${runtimeKey}) 的下载信息...`);

    const sources = await buildJavaSourceList(javaVersion, 'tsinghua', '');
    if (sources.length > 0) {
      writeLog(`[Java] ✓ ${sources[0].name}: ${sources[0].url}`);
      return { url: sources[0].url, name: runtimeKey, sha1: null, size: null };
    }

    writeLog(`[Java] ✗ 无法找到 Java ${javaVersion} 的下载信息`);
    return null;
    
  } catch (e: any) {
    writeLog(`[Java] 获取Java运行时下载信息失败: ${e.message}`);
    return null;
  }
}


export function getRecommendedJavaVersion(mcVersion: string): string {

  const parts: string[] = mcVersion.split('.');
  let major: number = parseInt(parts[0], 10);
  let minor: number = parseInt(parts[1], 10);
  let patch: number = parts.length > 2 ? parseInt(parts[2], 10) : 0;

  if (isNaN(major)) major = 1;

  if (isNaN(minor)) {
    
    if (major >= 26) return '25';
    
    if (major >= 21) return '21';
    return '17';
  }

  if (major === 1) {
    if (minor < 17) return '8';
    if (minor === 17) return '17';
    if (minor <= 20) return '17';
    if (minor === 21 && patch <= 4) return '21';
    if (minor === 21 && patch > 4) return '21';
    if (minor >= 22) return '21';
    return '17';
  }

  if (major >= 26) return '25';
  
  if (major >= 21) return '21';
  return '17';
}


export function findJavaExecutableInDir(rootDir: string): string | null {
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const current: string = stack.pop()!;
    if (!fs.existsSync(current)) continue;
    const javaw: string = path.join(current, 'bin', 'javaw.exe');
    const java: string = path.join(current, 'bin', 'java.exe');
    if (fs.existsSync(javaw)) return javaw;
    if (fs.existsSync(java)) return java;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) stack.push(path.join(current, e.name));
      }
    } catch (e: any) {}
  }
  return null;
}


ipcMain.handle('check-java', async (_, versionOrJavaVersion: string) => {
  try {
    
    const isMcVersion: boolean = versionOrJavaVersion && versionOrJavaVersion.match(/^\d+\.\d+/) as any;
    
    if (isMcVersion) {
      
      const versionId: string = versionOrJavaVersion;
      const jsonPath: string = path.join(GAME_DIR, 'versions', versionId, versionId + '.json');
      if (!fs.existsSync(jsonPath)) {
        return { success: false, error: '版本未下载' };
      }
      
      const versionData: any = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const javaVersion: string = getJavaVersionFromVersionData(versionData);
      const result: any = await checkJavaInstalled(javaVersion);
      
      return {
        success: true,
        installed: result.installed,
        javaVersion: javaVersion,
        javaPath: result.javaPath
      };
    } else {
      
      const javaVersion: string = versionOrJavaVersion;
      const result: any = await checkJavaInstalled(javaVersion);
      
      return {
        success: true,
        installed: result.installed,
        javaVersion: javaVersion,
        javaPath: result.javaPath
      };
    }
  } catch (e: any) {
    writeLog(`检查Java失败：${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('install-java', async (_, javaVersion: string) => {
  try {
    writeLog(`[Java] 开始安装 Java ${javaVersion}`);

    if (mainWindow) {
      mainWindow.webContents.send('java-download-started', { javaVersion });
    }
    
    const result: any = await downloadAndInstallJava(javaVersion);
    
    if (result.success) {
      writeLog(`[Java] Java ${javaVersion} 安装成功: ${result.javaPath}`);
      if (mainWindow) {
        mainWindow.webContents.send('java-download-completed', {
          javaVersion,
          javaPath: result.javaPath
        });
      }
      return result;
    } else {
      writeLog(`[Java] Java ${javaVersion} 安装失败: ${result.error}`);
      if (mainWindow) {
        mainWindow.webContents.send('java-download-failed', {
          javaVersion,
          error: result.error
        });
      }
      return result;
    }
  } catch (e: any) {
    writeLog(`[Java] 安装Java异常: ${e.message}`);
    if (mainWindow) {
      mainWindow.webContents.send('java-download-failed', {
        javaVersion,
        error: e.message
      });
    }
    return { success: false, error: e.message };
  }
});

