/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { GAME_DIR, getVersionGameDir, markVersionIsolated, writeLog } from './config';
import { downloadFile, fetchText, installVersion, mirrorUrlFor, updateVersionLastPlayed } from './download';
import { ensureJavaRuntime, findJavaExecutable, getJavaRuntimeDir, getJavaVersionForMCVersion } from './java';
import { installModrinthProjectTo } from './mods';
import { shouldCancelDownload } from './state';
// __IMPORTS_END__

function writeStage(message: string): void {
  writeLog(`[安装] ${message}`);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('install-stage', { message });
  }
}

function javaMajorVersion(javaPath: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const { execFile } = require('child_process');
    execFile(javaPath, ['-version'], { timeout: 8000, windowsHide: true }, (error: any, stdout: string, stderr: string) => {
      const text: string = `${stdout || ''}
${stderr || ''}`;
      const match: RegExpMatchArray | null = text.match(/version "(?:1\.)?(\d+)/);
      resolve(match ? parseInt(match[1], 10) : 0);
    });
  });
}

ipcMain.handle('get-forge-versions', async (_, mcVersion: string) => {
  try {
    writeLog(`[Forge] 获取版本列表: ${mcVersion}`);
    const versions: any[] = await fetchForgeVersions(mcVersion);
    return { success: true, versions };
  } catch (e: any) {
    writeLog(`[Forge] 获取版本列表失败: ${e.message}`);
    return { success: false, error: e.message, versions: [] };
  }
});


ipcMain.handle('get-fabric-versions', async (_, mcVersion: string) => {
  try {
    const versions: any[] = await fetchFabricVersions(mcVersion);
    return { success: true, versions };
  } catch (e: any) {
    writeLog(`[Fabric] 获取版本列表失败: ${e.message}`);
    return { success: false, error: e.message, versions: [] };
  }
});


ipcMain.handle('get-optifine-versions', async (_, mcVersion: string) => {
  try {
    const versions: any[] = await fetchOptiFineVersions(mcVersion);
    return { success: true, versions };
  } catch (e: any) {
    writeLog(`[OptiFine] 获取版本列表失败: ${e.message}`);
    return { success: false, error: e.message, versions: [] };
  }
});



export async function fetchForgeVersions(mcVersion: string): Promise<any[]> {
  return new Promise<any[]>((resolve, reject) => {
    const https = require('https');
    const url: string = `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json`;
    
    https.get(url, { timeout: 10000 }, (res: any) => {
      let data: string = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const metadata: any = JSON.parse(data);
          const versions: any[] = [];

          const versionArray: any[] = metadata[mcVersion];
          if (versionArray && Array.isArray(versionArray)) {
            versionArray.forEach((fullVersion: string) => {
              const parts: string[] = fullVersion.split('-');
              const forgeVersion: string = parts.slice(1).join('-');
              versions.push({
                id: fullVersion,
                name: `Forge ${forgeVersion}`,
                version: forgeVersion,
                mcVersion: mcVersion
              });
            });
          }

          versions.sort((a: any, b: any) => compareVersions(b.version, a.version));

          const topVersions: any[] = versions.slice(0, 10);

          if (topVersions.length > 0) {
            topVersions[0].name += ' (推荐)';
          }
          
          writeLog(`[Forge] 找到 ${topVersions.length} 个版本`);
          resolve(topVersions);
        } catch (e: any) {
          writeLog(`[Forge] 解析错误: ${e.message}`);
          reject(new Error('解析 Forge 元数据失败'));
        }
      });
    }).on('error', (e: any) => {
      reject(new Error(`请求 Forge 元数据失败: ${e.message}`));
    }).on('timeout', () => {
      reject(new Error('请求 Forge 元数据超时'));
    });
  });
}


export function compareVersions(v1: string, v2: string): number {
  const parts1: number[] = v1.split(/[.-]/).map((p: string) => parseInt(p, 10) || 0);
  const parts2: number[] = v2.split(/[.-]/).map((p: string) => parseInt(p, 10) || 0);
  
  for (let i: number = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a: number = parts1[i] || 0;
    const b: number = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}


export async function fetchFabricVersions(mcVersion: string): Promise<any[]> {
  const url: string = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersion)}`;
  const mirror: string = `https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/${encodeURIComponent(mcVersion)}`;
  const raw: string = await fetchText(url, [mirror, url]);
  const list: any[] = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error('Fabric 版本列表格式异常');

  const versions: any[] = list
    .filter((item: any) => item && item.loader && item.loader.version)
    .map((item: any) => ({
      id: item.loader.version,
      name: `Fabric ${item.loader.version}${item.loader.stable === false ? ' (测试)' : ''}`,
      version: item.loader.version,
      mcVersion
    }));

  const top: any[] = versions.slice(0, 20);
  const firstStable: any = top.find((v: any) => !v.name.includes('(测试)'));
  if (firstStable) firstStable.name += ' (推荐)';
  writeLog(`[Fabric] 找到 ${versions.length} 个版本 for MC ${mcVersion}，显示前 ${top.length} 个`);
  return top;
}


function mavenPath(name: string): string | null {
  const parts: string[] = String(name || '').split(':');
  if (parts.length < 3) return null;
  const [group, artifact, version] = parts;
  const classifier: string = parts[3] ? `-${parts[3]}` : '';
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}${classifier}.jar`;
}


export async function installFabric(mcVersion: string, loaderVersion: string): Promise<string> {
  const profileUrl: string = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const mirrorUrl: string = `https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const raw: string = await fetchText(profileUrl, [mirrorUrl, profileUrl]);
  const profile: any = JSON.parse(raw);

  const versionId: string = String(profile.id || `fabric-loader-${loaderVersion}-${mcVersion}`);
  const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
  if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

  for (const lib of profile.libraries || []) {
    if (!lib.name || lib.downloads?.artifact?.path) continue;
    const libPath: string = mavenPath(lib.name) || '';
    if (!libPath) continue;
    const base: string = String(lib.url || 'https://maven.fabricmc.net/').replace(/\/?$/, '/');
    lib.downloads = lib.downloads || {};
    lib.downloads.artifact = { path: libPath, url: base + libPath, size: lib.size || 0 };
  }

  fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(profile, null, 2), 'utf8');

  for (const lib of profile.libraries || []) {
    const artifact: any = lib.downloads?.artifact;
    if (!artifact?.path) continue;
    const dest: string = path.join(GAME_DIR, 'libraries', artifact.path);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    const fullUrl: string = artifact.url;
    const sources: string[] = [];
    const mirrored: string | null = mirrorUrlFor(fullUrl);
    if (mirrored) sources.push(mirrored);
    sources.push(fullUrl);
    await downloadFile(fullUrl, dest, `库: ${lib.name}`, sources);
  }

  writeLog(`[Fabric] 安装完成: ${versionId}`);
  return versionId;
}


export async function fetchOptiFineVersions(mcVersion: string): Promise<any[]> {
  return new Promise<any[]>((resolve, reject) => {
    const https = require('https');
    const url: string = 'https://bmclapi2.bangbang93.com/optifine/versionList';
    
    writeLog(`[OptiFine] 获取版本列表: ${mcVersion}`);
    
    https.get(url, { timeout: 15000 }, (res: any) => {
      let data: string = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        try {
          const allVersions: any[] = JSON.parse(data);
          const filtered: any[] = allVersions
            .filter((v: any) => v.mcversion === mcVersion)
            .map((v: any) => {
              const isPreview: boolean = v.filename.startsWith('preview_');
              return {
                id: v.filename,
                name: `OptiFine ${v.type}_${v.patch}${isPreview ? ' (预览)' : ''}`,
                version: `${v.type}_${v.patch}`,
                filename: v.filename,
                type: v.type,
                patch: v.patch,
                mcVersion: v.mcversion,
                isPreview
              };
            });
          
          filtered.sort((a: any, b: any) => {
            if (a.isPreview !== b.isPreview) return a.isPreview ? 1 : -1;
            return b.name.localeCompare(a.name);
          });
          
          const firstStable: any = filtered.find((v: any) => !v.isPreview);
          if (firstStable) firstStable.name += ' (推荐)';
          
          writeLog(`[OptiFine] 找到 ${filtered.length} 个版本 for MC ${mcVersion}`);
          resolve(filtered);
        } catch (e: any) {
          writeLog(`[OptiFine] 解析错误: ${e.message}`);
          reject(new Error('解析 OptiFine 版本列表失败'));
        }
      });
    }).on('error', (e: any) => {
      writeLog(`[OptiFine] 请求失败: ${e.message}`);
      reject(new Error(`请求 OptiFine 版本列表失败: ${e.message}`));
    }).on('timeout', () => {
      reject(new Error('请求 OptiFine 版本列表超时'));
    });
  });
}


export async function installVersionWithModLoader(versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number, options?: { installFabricApi?: boolean }): Promise<any> {
  try {
    writeLog(`[模组加载器] 开始下载: ${loaderType} ${loaderVersion} for MC ${versionId}`);

    writeLog(`[模组加载器] 下载原版 MC ${versionId}`);
    await installVersion(versionId, maxConcurrent);
    
    if (shouldCancelDownload) {
      return { success: false, error: '下载已取消' };
    }

    let finalVersionId: string;
    if (loaderType === 'forge') {
      finalVersionId = await installForge(versionId, loaderVersion);
    } else if (loaderType === 'fabric') {
      finalVersionId = await installFabric(versionId, loaderVersion);
    } else if (loaderType === 'optifine') {
      finalVersionId = await installOptiFine(versionId, loaderVersion);
    } else {
      return { success: false, error: `不支持的模组加载器: ${loaderType}` };
    }
    
    writeLog(`[模组加载器] 安装完成: ${finalVersionId}`);
    markVersionIsolated(GAME_DIR, finalVersionId);

    updateVersionLastPlayed(finalVersionId);

    if (loaderType === 'fabric' && options?.installFabricApi !== false) {
      const modsDir: string = path.join(getVersionGameDir(finalVersionId), 'mods');
      try {
        const apiResult: any = await installModrinthProjectTo('P7dR8mSH', versionId, 'fabric', modsDir);
        writeLog(`[Fabric] Fabric API 已安装: ${(apiResult.files || []).join(', ') || '已存在'}`);
        return { success: true, finalVersionId, fabricApiFiles: apiResult.files, modsDir };
      } catch (e: any) {
        writeLog(`[Fabric] Fabric API 自动安装失败: ${e.message}`);
        return { success: true, finalVersionId, fabricApiError: e.message, modsDir };
      }
    }

    return { success: true, finalVersionId };
    
  } catch (e: any) {
    writeLog(`[模组加载器] 安装失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}


export function downloadFileHttps(url: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const dir: string = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(dest)) fs.unlinkSync(dest);

    const doRequest = (reqUrl: string): void => {
      const proto: any = reqUrl.startsWith('https') ? https : http;
      const parsed: any = new (require('url').URL)(reqUrl);
      proto.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      }, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(new URL(res.headers.location, reqUrl).toString());
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', (e: any) => { try { fs.unlinkSync(dest); } catch(_){} reject(e); });
      }).on('error', reject).on('timeout', () => { reject(new Error('下载超时')); });
    };
    doRequest(url);
  });
}


export async function installForge(mcVersion: string, forgeVersion: string): Promise<any> {
  writeLog(`[Forge] 安装: MC ${mcVersion}, Forge ${forgeVersion}`);
  
  const versionDir: string = path.join(GAME_DIR, 'versions', mcVersion);
  if (!fs.existsSync(versionDir)) {
    throw new Error(`原版版本 ${mcVersion} 不存在`);
  }

  const versionsDir: string = path.join(GAME_DIR, 'versions');
  const preExistingVersions: Set<string> = new Set(fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : []);

  const fullForgeVersionId: string = forgeVersion.includes('-') ? forgeVersion : `${mcVersion}-${forgeVersion}`;
  writeLog(`[Forge] 完整版本ID: ${fullForgeVersionId}`);

  const installerUrl: string = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeVersionId}/forge-${fullForgeVersionId}-installer.jar`;
  const installerPath: string = path.join(GAME_DIR, 'temp', `forge-${fullForgeVersionId}-installer.jar`);
  
  if (!fs.existsSync(path.dirname(installerPath))) {
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });
  }
  
  writeLog(`[Forge] 下载安装器: ${installerUrl}`);
  writeStage('正在下载 Forge 安装器…');
  if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
  const installerMirror: string | null = mirrorUrlFor(installerUrl);
  await downloadFile(installerUrl, installerPath, 'Forge 安装器', installerMirror ? [installerMirror, installerUrl] : [installerUrl]);
  
  if (shouldCancelDownload) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error('下载已取消');
  }
  
  writeLog(`[Forge] 运行安装器`);
  
  const javaVersion: string = getJavaVersionForMCVersion(mcVersion);
  writeLog(`[Forge] MC ${mcVersion} 需要 Java ${javaVersion}`);
  
  let javaPath: string | null = null;
  
  const runtimeDir: string = getJavaRuntimeDir(javaVersion);
  if (fs.existsSync(runtimeDir)) {
    javaPath = findJavaExecutable(runtimeDir);
  }
  
  if (!javaPath) {
    const ensuredPath: string | null = await ensureJavaRuntime(javaVersion);
    if (ensuredPath) {
      javaPath = ensuredPath;
    }
  }
  
  if (!javaPath) {
    javaPath = findJava();
  }
  
  if (!javaPath) {
    fs.unlinkSync(installerPath);
    throw new Error('未找到 Java 运行时，请安装 Java 8 或更高版本');
  }
  
  writeLog(`[Forge] 使用 Java: ${javaPath}`);
  
  const installerStat = fs.statSync(installerPath);
  writeLog(`[Forge] 安装器文件大小: ${installerStat.size} bytes`);
  
  if (installerStat.size < 100000) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error(`Forge 安装器文件过小 (${installerStat.size} bytes)，可能下载失败`);
  }
  
  const jarMagic: Buffer = fs.readFileSync(installerPath).slice(0, 4);
  writeLog(`[Forge] 安装器文件头: ${jarMagic.toString('hex')}`);
  if (jarMagic[0] !== 0x50 || jarMagic[1] !== 0x4B) {
    writeLog(`[Forge] 警告: 文件不是有效的 ZIP/JAR 格式`);
    const firstBytes: string = fs.readFileSync(installerPath, { encoding: 'utf8' }).slice(0, 200);
    writeLog(`[Forge] 文件内容开头: ${firstBytes}`);
  }
  
  const requiredJava: number = parseInt(getJavaVersionForMCVersion(mcVersion), 10) || 8;
  const actualJava: number = await javaMajorVersion(javaPath);
  writeLog(`[Forge] Java 版本: ${actualJava}，需要 ${requiredJava}`);
  if (actualJava > 0 && actualJava < requiredJava) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error(`这个 Forge 版本需要 Java ${requiredJava}，当前找到的是 Java ${actualJava}。请先在下载页安装 Java ${requiredJava} 再试`);
  }

  const profilesPath: string = path.join(GAME_DIR, 'launcher_profiles.json');
  let profilesBackup: string | null = null;
  if (fs.existsSync(profilesPath)) {
    try { profilesBackup = fs.readFileSync(profilesPath, 'utf8'); } catch {}
  } else {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
  }

  const restoreProfiles = (): void => {
    try {
      if (profilesBackup !== null) {
        fs.writeFileSync(profilesPath, profilesBackup, 'utf8');
      } else if (fs.existsSync(profilesPath)) {
        fs.unlinkSync(profilesPath);
      }
    } catch {}
  };

  writeStage('正在安装 Forge，下载依赖库可能需要几分钟…');
  let output: string = '';
  let success: boolean = false;
  let lastStageAt: number = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const { spawn } = require('child_process');
      const child = spawn(javaPath!, [
        '-Djava.awt.headless=true',
        '-jar', installerPath,
        '--installClient'
      ], {
        cwd: GAME_DIR,
        windowsHide: true,
        env: { ...process.env }
      });

      const timer: any = setTimeout(() => {
        try { child.kill(); } catch {}
        reject(new Error('Forge 安装超时（15 分钟）'));
      }, 15 * 60 * 1000);

      const watch: any = setInterval(() => {
        if (shouldCancelDownload) {
          try { child.kill(); } catch {}
        }
      }, 1000);

      const collect = (chunk: any): void => {
        const text: string = chunk.toString();
        output += text;
        if (output.length > 1024 * 1024) output = output.slice(-1024 * 1024);
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) writeLog(`[Forge] ${line}`);
        }
      };

      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      child.on('error', (err: any) => {
        clearTimeout(timer);
        clearInterval(watch);
        reject(new Error(`Java 进程启动失败: ${err.message}`));
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        clearInterval(watch);
        if (shouldCancelDownload) {
          reject(new Error('下载已取消'));
        } else if (code === 0) {
          success = true;
          resolve();
        } else {
          reject(new Error(`Forge 安装器退出码 ${code}: ${output.slice(-400) || '没有输出'}`));
        }
      });
    });
  } finally {
    restoreProfiles();
  }

  restoreProfiles();

  if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
  
  if (success) {
    const newVersions: string[] = (fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [])
      .filter((name: string) => !preExistingVersions.has(name));
    const installed: string | undefined = newVersions.find((name: string) => name.toLowerCase().includes('forge')) || newVersions[0];
    writeLog(`[Forge] 安装完成${installed ? `: ${installed}` : ''}`);
    return installed || fullForgeVersionId;
  }
  
  throw new Error('Forge 安装器执行失败: 所有参数格式都失败');
}


export function resolveOptiFineDownloadUrl(adloadxUrl: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const https = require('https');
    const parsed: any = new (require('url').URL)(adloadxUrl);
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    }, (res: any) => {
      let data: string = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        const m: RegExpMatchArray | null = data.match(/href='(downloadx\?f=[^']+)'/);
        if (m) {
          resolve(`https://optifine.net/${m[1]}`);
        } else {
          reject(new Error('无法解析 OptiFine 下载链接'));
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('解析下载链接超时')));
  });
}


export async function installOptiFine(mcVersion: string, optifineFilename: string): Promise<string> {
  writeLog(`[OptiFine] 安装: MC ${mcVersion}, 文件 ${optifineFilename}`);

  const versionDir: string = path.join(GAME_DIR, 'versions', mcVersion);
  if (!fs.existsSync(versionDir)) {
    throw new Error(`原版版本 ${mcVersion} 不存在`);
  }

  let type: string = '';
  let patch: string = '';
  try {
    const list: any[] = await fetchOptiFineVersions(mcVersion);
    const hit: any = list.find((v: any) => v.id === optifineFilename);
    if (hit?.type && hit?.patch) {
      type = hit.type;
      patch = hit.patch;
    }
  } catch (e: any) {
    writeLog(`[OptiFine] 版本列表读取失败，改用文件名解析: ${e.message}`);
  }
  if (!type || !patch) {
    const clean: string = optifineFilename.replace(/\.jar$/i, '').replace(/^preview_/i, '');
    const parts: string[] = clean.split('_');
    const mcIndex: number = parts.findIndex((p: string) => /^\d+\.\d+/.test(p));
    const rest: string[] = mcIndex >= 0 ? parts.slice(mcIndex + 1) : parts;
    patch = rest.length ? rest[rest.length - 1] : '';
    type = rest.length > 1 ? rest.slice(0, -1).join('_') : '';
  }

  const installerPath: string = path.join(GAME_DIR, 'temp', optifineFilename);
  if (!fs.existsSync(path.dirname(installerPath))) {
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });
  }

  let downloaded: boolean = false;
  if (type && patch) {
    const mirrorUrl: string = `https://bmclapi2.bangbang93.com/optifine/${encodeURIComponent(mcVersion)}/${encodeURIComponent(type)}/${encodeURIComponent(patch)}`;
    try {
      writeLog(`[OptiFine] 从 BMCLAPI 下载: ${mirrorUrl}`);
      await downloadFileHttps(mirrorUrl, installerPath);
      downloaded = true;
    } catch (e: any) {
      writeLog(`[OptiFine] BMCLAPI 下载失败: ${e.message}`);
    }
  }

  if (!downloaded) {
    const adloadxUrl: string = `https://optifine.net/adloadx?f=${encodeURIComponent(optifineFilename)}`;
    writeLog(`[OptiFine] 解析官方下载链接: ${adloadxUrl}`);
    const realUrl: string = await resolveOptiFineDownloadUrl(adloadxUrl);
    writeLog(`[OptiFine] 下载安装器: ${realUrl}`);
    await downloadFileHttps(realUrl, installerPath);
  }

  if (shouldCancelDownload) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error('下载已取消');
  }

  const fileMagic: Buffer = fs.readFileSync(installerPath).slice(0, 4);
  writeLog(`[OptiFine] 文件头: ${fileMagic.toString('hex')}`);
  if (fileMagic[0] !== 0x50 || fileMagic[1] !== 0x4B) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error('下载的文件不是有效的 JAR 文件，可能镜像源异常');
  }

  const javaVersion: string = getJavaVersionForMCVersion(mcVersion);
  let javaPath: string | null = null;
  const runtimeDir: string = getJavaRuntimeDir(javaVersion);
  if (fs.existsSync(runtimeDir)) javaPath = findJavaExecutable(runtimeDir);
  if (!javaPath) {
    const ensuredPath: string | null = await ensureJavaRuntime(javaVersion);
    if (ensuredPath) javaPath = ensuredPath;
  }
  if (!javaPath) javaPath = findJava();
  if (!javaPath) {
    if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
    throw new Error('未找到 Java 运行时，请先安装 Java');
  }
  writeLog(`[OptiFine] 使用 Java: ${javaPath}`);

  const srcJar: string = path.join(versionDir, `${mcVersion}.jar`);
  const clientJar: string = path.join(versionDir, 'client.jar');
  if (fs.existsSync(srcJar) && !fs.existsSync(clientJar)) {
    fs.copyFileSync(srcJar, clientJar);
  }

  const versionsDir: string = path.join(GAME_DIR, 'versions');
  const preExistingVersions: Set<string> = new Set(fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : []);

  const homeDir: string = path.join(GAME_DIR, 'temp', `optifine-home-${Date.now()}`);
  const homeMcDir: string = path.join(homeDir, '.minecraft');
  const profilesPath: string = path.join(GAME_DIR, 'launcher_profiles.json');
  let profilesBackup: string | null = null;
  let linked: boolean = false;

  try {
    fs.mkdirSync(homeDir, { recursive: true });
    try {
      fs.symlinkSync(GAME_DIR, homeMcDir, 'junction');
      linked = true;
    } catch (e: any) {
      writeLog(`[OptiFine] 无法创建目录链接，改用临时复制: ${e.message}`);
    }

    if (fs.existsSync(profilesPath)) {
      try { profilesBackup = fs.readFileSync(profilesPath, 'utf8'); } catch {}
    } else {
      fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
    }

    const { execFile } = require('child_process');
    await new Promise<void>((resolve, reject) => {
      const child = execFile(javaPath!, [
        '-Duser.home=' + homeDir,
        '-Djava.awt.headless=true',
        '-cp', installerPath,
        'optifine.Installer'
      ], {
        cwd: homeDir,
        timeout: 180000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, APPDATA: homeDir }
      }, (error: any, stdout: string, stderr: string) => {
        if (stdout) writeLog(`[OptiFine] stdout: ${stdout}`);
        if (stderr) writeLog(`[OptiFine] stderr: ${stderr}`);
        if (error) {
          reject(new Error(`OptiFine 安装器执行失败: ${stderr || stdout || error.message}`));
        } else {
          writeLog(`[OptiFine] 安装器执行成功`);
          resolve();
        }
      });
      child.on('error', (err: any) => reject(new Error(`Java 进程启动失败: ${err.message}`)));
    });
  } finally {
    if (profilesBackup !== null) {
      try { fs.writeFileSync(profilesPath, profilesBackup, 'utf8'); } catch {}
    } else if (fs.existsSync(profilesPath)) {
      try { fs.unlinkSync(profilesPath); } catch {}
    }
    if (linked) {
      try { fs.unlinkSync(homeMcDir); } catch {
        try { fs.rmdirSync(homeMcDir); } catch {}
      }
    }
    try { fs.rmSync(homeDir, { recursive: true, force: true }); } catch {}
    if (fs.existsSync(installerPath)) {
      try { fs.unlinkSync(installerPath); } catch {}
    }
  }

  const newVersions: string[] = (fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir) : [])
    .filter((name: string) => !preExistingVersions.has(name));
  const installed: string | undefined = newVersions.find((name: string) => name.toLowerCase().includes('optifine')) || newVersions[0];
  if (installed) {
    writeLog(`[OptiFine] 安装完成: ${installed}`);
    return installed;
  }

  const fallbackId: string = `${mcVersion}-OptiFine_${type}${patch ? `_${patch}` : ''}`.replace(/_+$/, '');
  writeLog(`[OptiFine] 安装完成(fallback): ${fallbackId}`);
  return fallbackId;
}


export function findJava(): string | null {
  const paths: (string | null)[] = [
    process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe') : null,
    'C:\\Program Files\\Java\\jdk1.8.0_351\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
    'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
    'C:\\Program Files (x86)\\Java\\jdk1.8.0_351\\bin\\java.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.8.101-hotspot\\bin\\java.exe',
    'C:\\Program Files (x86)\\Eclipse Adoptium\\jdk-17.0.8.101-hotspot\\bin\\java.exe',
    'C:\\Program Files\\Amazon Corretto\\jdk17.0.8_7\\bin\\java.exe',
    'C:\\Program Files\\Microsoft\\jdk-17.0.8.101-hotspot\\bin\\java.exe'
  ];
  
  for (const javaPath of paths) {
    if (javaPath && fs.existsSync(javaPath)) {
      writeLog(`[Forge] 找到 Java: ${javaPath}`);
      return javaPath;
    }
  }
  
  try {
    const { execSync } = require('child_process');
    const whichOutput: string = execSync('where java', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (whichOutput) {
      const javaPaths: string[] = whichOutput.split('\n').map((p: string) => p.trim()).filter((p: string) => p);
      for (const javaPath of javaPaths) {
        if (fs.existsSync(javaPath)) {
          writeLog(`[Forge] 通过 where 找到 Java: ${javaPath}`);
          return javaPath;
        }
      }
    }
  } catch (e: any) {
    writeLog(`[Forge] where java 执行失败: ${e.message}`);
  }
  
  return null;
}

