/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { GAME_DIR, writeLog } from './config';
import { installVersion, updateVersionLastPlayed } from './download';
import { ensureJavaRuntime, findJavaExecutable, getJavaRuntimeDir, getJavaVersionForMCVersion } from './java';
import { shouldCancelDownload } from './state';
// __IMPORTS_END__

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


export async function installVersionWithModLoader(versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number): Promise<any> {
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
    } else if (loaderType === 'optifine') {
      finalVersionId = await installOptiFine(versionId, loaderVersion);
    } else {
      return { success: false, error: `不支持的模组加载器: ${loaderType}` };
    }
    
    writeLog(`[模组加载器] 安装完成: ${finalVersionId}`);

    updateVersionLastPlayed(finalVersionId);
    
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
          doRequest(res.headers.location);
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


export function downloadInstaller(url: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const { execFile } = require('child_process');
    const dir: string = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    
    writeLog(`[Forge] 使用 PowerShell 下载安装器`);
    
    const psScript: string = `
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $ProgressPreference = 'SilentlyContinue'
      Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing
      if (Test-Path '${dest}') {
        $size = (Get-Item '${dest}').Length
        Write-Output "OK:$size"
      } else {
        Write-Error "Download failed"
        exit 1
      }
    `;
    
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      timeout: 120000,
      encoding: 'utf8'
    }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        writeLog(`[Forge] PowerShell 下载失败: ${error.message}`);
        if (stderr) writeLog(`[Forge] stderr: ${stderr}`);
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error(`下载失败: ${stderr || error.message}`));
        return;
      }
      
      const output: string = (stdout || '').trim();
      if (output.startsWith('OK:')) {
        const size: number = parseInt(output.substring(3), 10);
        writeLog(`[Forge] 安装器下载完成: ${size} bytes`);
        resolve();
      } else {
        writeLog(`[Forge] 下载输出: ${output}`);
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error('下载失败'));
      }
    });
  });
}


export async function installForge(mcVersion: string, forgeVersion: string): Promise<any> {
  writeLog(`[Forge] 安装: MC ${mcVersion}, Forge ${forgeVersion}`);
  
  const versionDir: string = path.join(GAME_DIR, 'versions', mcVersion);
  if (!fs.existsSync(versionDir)) {
    throw new Error(`原版版本 ${mcVersion} 不存在`);
  }

  const fullForgeVersionId: string = forgeVersion.includes('-') ? forgeVersion : `${mcVersion}-${forgeVersion}`;
  writeLog(`[Forge] 完整版本ID: ${fullForgeVersionId}`);

  const installerUrl: string = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeVersionId}/forge-${fullForgeVersionId}-installer.jar`;
  const installerPath: string = path.join(GAME_DIR, 'temp', `forge-${fullForgeVersionId}-installer.jar`);
  
  if (!fs.existsSync(path.dirname(installerPath))) {
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });
  }
  
  writeLog(`[Forge] 下载安装器: ${installerUrl}`);
  await downloadInstaller(installerUrl, installerPath);
  
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
  
  const { execFile } = require('child_process');
  
  writeLog(`[Forge] 查看安装器帮助信息...`);
  const helpResult: any = await new Promise<any>((resolve) => {
    const child = execFile(javaPath!, [
      '-jar', installerPath,
      '--help'
    ], {
      timeout: 10000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }, (error: any, stdout: string, stderr: string) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error });
    });
  });
  
  if (helpResult.stdout) writeLog(`[Forge] 帮助输出:\n${helpResult.stdout}`);
  if (helpResult.stderr) writeLog(`[Forge] 帮助错误:\n${helpResult.stderr}`);
  
  const argFormats: string[][] = [
    ['--installClient'],
    ['--installServer'],
    ['-installClient'],
    ['-installServer'],
    ['--install', 'client'],
    ['client']
  ];
  
  let success: boolean = false;
  for (const args of argFormats) {
    writeLog(`[Forge] 尝试参数: ${args.join(' ')}`);
    
    try {
      await new Promise<void>((resolve, reject) => {
        const child = execFile(javaPath!, [
          '-jar', installerPath,
          ...args
        ], {
          cwd: GAME_DIR,
          timeout: 300000,
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024
        }, (error: any, stdout: string, stderr: string) => {
          if (stdout) writeLog(`[Forge] stdout: ${stdout}`);
          if (stderr) writeLog(`[Forge] stderr: ${stderr}`);
          
          if (error) {
            reject(new Error(`Forge 安装器执行失败: ${stderr || stdout || error.message}`));
          } else {
            writeLog(`[Forge] 安装器执行成功`);
            resolve();
          }
        });
        
        child.on('error', (err: any) => {
          reject(new Error(`Java 进程启动失败: ${err.message}`));
        });
      });
      
      success = true;
      break;
    } catch (e: any) {
      writeLog(`[Forge] 参数 ${args.join(' ')} 失败: ${e.message}`);
    }
  }
  
  if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
  
  if (success) {
    writeLog(`[Forge] 安装完成`);
    return;
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
  
  const adloadxUrl: string = `https://optifine.net/adloadx?f=${optifineFilename}`;
  const installerPath: string = path.join(GAME_DIR, 'temp', optifineFilename);
  
  if (!fs.existsSync(path.dirname(installerPath))) {
    fs.mkdirSync(path.dirname(installerPath), { recursive: true });
  }
  
  writeLog(`[OptiFine] 解析下载链接: ${adloadxUrl}`);
  const realUrl: string = await resolveOptiFineDownloadUrl(adloadxUrl);
  writeLog(`[OptiFine] 下载安装器: ${realUrl}`);
  await downloadFileHttps(realUrl, installerPath);
  
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
  
  writeLog(`[OptiFine] 运行安装器（静默模式）`);
  
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
  
  const defaultMinecraftDir: string = path.join(app.getPath('appData'), '.minecraft');
  const launcherProfilesPath: string = path.join(defaultMinecraftDir, 'launcher_profiles.json');
  const defaultVersionsDir: string = path.join(defaultMinecraftDir, 'versions');
  const defaultLibsDir: string = path.join(defaultMinecraftDir, 'libraries');
  let backupProfiles: string | null = null;
  let createdProfiles: boolean = false;
  let tempVanillaDir: string | null = null;
  let preExistingVersions: Set<string> = new Set();
  let preExistingLibs: Set<string> = new Set();
  let optifineVersionId: string | null = null;
  
  try {
    if (!fs.existsSync(defaultMinecraftDir)) {
      fs.mkdirSync(defaultMinecraftDir, { recursive: true });
    }
    
    if (fs.existsSync(defaultVersionsDir)) {
      preExistingVersions = new Set(fs.readdirSync(defaultVersionsDir));
    }
    if (fs.existsSync(defaultLibsDir)) {
      const collectLibs = (dir: string): void => {
        for (const item of fs.readdirSync(dir)) {
          const p: string = path.join(dir, item);
          if (fs.statSync(p).isDirectory()) collectLibs(p);
          else preExistingLibs.add(p);
        }
      };
      collectLibs(defaultLibsDir);
    }
    
    if (fs.existsSync(launcherProfilesPath)) {
      backupProfiles = fs.readFileSync(launcherProfilesPath, 'utf8');
    }
    
    const profiles: any = {
      profiles: {
        GPCL: {
          type: 'custom',
          gameDir: GAME_DIR,
          lastVersionId: mcVersion
        }
      }
    };
    fs.writeFileSync(launcherProfilesPath, JSON.stringify(profiles, null, 2), 'utf8');
    createdProfiles = true;
    writeLog(`[OptiFine] 已创建 launcher_profiles.json（临时）`);
    
    const srcVersionDir: string = path.join(GAME_DIR, 'versions', mcVersion);
    tempVanillaDir = path.join(defaultMinecraftDir, 'versions', mcVersion);
    if (!fs.existsSync(tempVanillaDir)) {
      fs.mkdirSync(tempVanillaDir, { recursive: true });
    }
    const srcJar: string = path.join(srcVersionDir, `${mcVersion}.jar`);
    const dstJar: string = path.join(tempVanillaDir, `${mcVersion}.jar`);
    if (fs.existsSync(srcJar) && !fs.existsSync(dstJar)) {
      fs.copyFileSync(srcJar, dstJar);
      writeLog(`[OptiFine] 临时复制: ${mcVersion}.jar`);
    }
    const dstClientJar: string = path.join(tempVanillaDir, 'client.jar');
    if (fs.existsSync(srcJar) && !fs.existsSync(dstClientJar)) {
      fs.copyFileSync(srcJar, dstClientJar);
      writeLog(`[OptiFine] 临时复制: client.jar`);
    }
    const srcJson: string = path.join(srcVersionDir, `${mcVersion}.json`);
    const dstJson: string = path.join(tempVanillaDir, `${mcVersion}.json`);
    if (fs.existsSync(srcJson) && !fs.existsSync(dstJson)) {
      fs.copyFileSync(srcJson, dstJson);
      writeLog(`[OptiFine] 临时复制: ${mcVersion}.json`);
    }
    writeLog(`[OptiFine] 已将原版 ${mcVersion} 文件临时复制到默认目录`);
    
    const { execFile } = require('child_process');
    
    await new Promise<void>((resolve, reject) => {
      const child = execFile(javaPath!, ['-jar', installerPath, '-install'], {
        cwd: defaultMinecraftDir,
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
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
    if (createdProfiles) {
      if (backupProfiles !== null) {
        fs.writeFileSync(launcherProfilesPath, backupProfiles, 'utf8');
      } else if (fs.existsSync(launcherProfilesPath)) {
        fs.unlinkSync(launcherProfilesPath);
      }
      writeLog(`[OptiFine] 已清理 launcher_profiles.json`);
    }
    
    try {
      if (fs.existsSync(defaultVersionsDir)) {
        const postVersions: string[] = fs.readdirSync(defaultVersionsDir);
        const newVersions: string[] = postVersions.filter((v: string) => !preExistingVersions.has(v));
        
        if (newVersions.length > 0) {
          const ofVersion: string = newVersions.find((v: string) => v.toLowerCase().includes('optifine')) || newVersions[0];
          optifineVersionId = ofVersion;
          
          const srcDir: string = path.join(defaultVersionsDir, ofVersion);
          const dstDir: string = path.join(GAME_DIR, 'versions', ofVersion);
          
          if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
          
          for (const item of fs.readdirSync(srcDir)) {
            const srcPath: string = path.join(srcDir, item);
            const dstPath: string = path.join(dstDir, item);
            if (fs.statSync(srcPath).isDirectory()) {
              const copySubDir = (s: string, d: string): void => {
                if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
                for (const sub of fs.readdirSync(s)) {
                  const sp: string = path.join(s, sub);
                  const dp: string = path.join(d, sub);
                  if (fs.statSync(sp).isDirectory()) copySubDir(sp, dp);
                  else if (!fs.existsSync(dp)) fs.copyFileSync(sp, dp);
                }
              };
              copySubDir(srcPath, dstPath);
            } else if (!fs.existsSync(dstPath)) {
              fs.copyFileSync(srcPath, dstPath);
            }
          }
          writeLog(`[OptiFine] 已将版本 ${ofVersion} 复制到 GPCL 目录`);
          
          const ofJsonPath: string = path.join(dstDir, `${ofVersion}.json`);
          if (fs.existsSync(ofJsonPath)) {
            const ofVd: any = JSON.parse(fs.readFileSync(ofJsonPath, 'utf8'));
            for (const lib of ofVd.libraries || []) {
              if (lib.name && !lib.downloads?.artifact?.path) {
                const parts: string[] = lib.name.split(':');
                if (parts.length >= 3) {
                  const libPath: string = parts[0].replace(/\./g, '/') + '/' + parts[1] + '/' + parts[2] + '/' + parts[1] + '-' + parts[2] + '.jar';
                  const srcLib: string = path.join(defaultLibsDir, libPath);
                  const dstLib: string = path.join(GAME_DIR, 'libraries', libPath);
                  if (fs.existsSync(srcLib) && !fs.existsSync(dstLib)) {
                    fs.mkdirSync(path.dirname(dstLib), { recursive: true });
                    fs.copyFileSync(srcLib, dstLib);
                    writeLog(`[OptiFine] 复制库: ${libPath}`);
                  }
                  if (!lib.downloads) lib.downloads = {};
                  if (!lib.downloads.artifact) {
                    lib.downloads.artifact = { path: libPath, url: '', size: 0 };
                  }
                }
              }
            }
            fs.writeFileSync(ofJsonPath, JSON.stringify(ofVd, null, 2), 'utf8');
          }
        }
      }
      
      if (tempVanillaDir && fs.existsSync(tempVanillaDir)) {
        const rmDir = (dir: string): void => {
          if (!fs.existsSync(dir)) return;
          for (const item of fs.readdirSync(dir)) {
            const p: string = path.join(dir, item);
            if (fs.statSync(p).isDirectory()) rmDir(p);
            else fs.unlinkSync(p);
          }
          fs.rmdirSync(dir);
        };
        rmDir(tempVanillaDir);
      }
      
      if (optifineVersionId) {
        const ofInstalledDir: string = path.join(defaultVersionsDir, optifineVersionId);
        if (fs.existsSync(ofInstalledDir)) {
          const rmDir = (dir: string): void => {
            if (!fs.existsSync(dir)) return;
            for (const item of fs.readdirSync(dir)) {
              const p: string = path.join(dir, item);
              if (fs.statSync(p).isDirectory()) rmDir(p);
              else fs.unlinkSync(p);
            }
            fs.rmdirSync(dir);
          };
          rmDir(ofInstalledDir);
        }
      }
      
      writeLog(`[OptiFine] 已清理临时文件`);
    } catch (e: any) {
      writeLog(`[OptiFine] 后处理出错: ${e.message}`);
    }
  }
  
  if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
  
  if (optifineVersionId) {
    writeLog(`[OptiFine] 安装完成: ${optifineVersionId}`);
    return optifineVersionId;
  }
  
  const optifineFilenameBase: string = optifineFilename.replace('.jar', '');
  const fallbackId: string = `${mcVersion}-${optifineFilenameBase.split('_').slice(1).join('_')}`;
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

