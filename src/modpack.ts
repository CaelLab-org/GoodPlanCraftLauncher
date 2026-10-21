/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, ipcMain } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { GAME_DIR, markVersionIsolated, writeLog } from './config';
import { downloadFile, downloadWithPool, installVersion, setOverallProgressMode } from './download';
import { installVersionWithModLoader } from './modloader';
import { curseForgeApi, resolveProjectFile } from './mods';
import { setCompletedDownloadFiles, setTotalDownloadFiles, shouldCancelDownload } from './state';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');

function tempDir(): string { return path.join(GAME_DIR, 'temp'); }

type PackFormat = 'modrinth' | 'curseforge';

interface PackInfo {
  format: PackFormat;
  name: string;
  version: string;
  mcVersion: string;
  loaderType: '' | 'forge' | 'neoforge' | 'fabric';
  loaderVersion: string;
  root: string;
}

interface PackFileJob {
  label: string;
  sources: string[];
  dest: string;
  sha1?: string;
}

function writeStage(message: string): void {
  writeLog(`[整合包] ${message}`);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('install-stage', { message });
  }
}


function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}


function manifestKind(root: string): PackFormat | null {
  if (fs.existsSync(path.join(root, 'modrinth.index.json'))) return 'modrinth';
  const manifestPath: string = path.join(root, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const data: any = readJson(manifestPath);
      if (data && data.minecraft) return 'curseforge';
    } catch {}
  }
  return null;
}


function findPackRoot(extractDir: string): { root: string; format: PackFormat } | null {
  const direct: PackFormat | null = manifestKind(extractDir);
  if (direct) return { root: extractDir, format: direct };

  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(extractDir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child: string = path.join(extractDir, entry.name);
    const kind: PackFormat | null = manifestKind(child);
    if (kind) return { root: child, format: kind };
  }
  return null;
}


function unsupportedFormatReason(extractDir: string): string {
  const markers: Record<string, string> = {
    'mcbbs.packmeta': 'MCBBS 整合包',
    'mmc-pack.json': 'MultiMC / Prism 整合包',
    'modpack.json': 'HMCL 整合包'
  };
  const check = (dir: string): string =>
    Object.keys(markers).find((file: string) => fs.existsSync(path.join(dir, file))) || '';
  const direct: string = check(extractDir);
  if (direct) return markers[direct];
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(extractDir, { withFileTypes: true }); } catch {}
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found: string = check(path.join(extractDir, entry.name));
    if (found) return markers[found];
  }
  return '';
}


function parsePack(extractDir: string): PackInfo {
  const found: { root: string; format: PackFormat } | null = findPackRoot(extractDir);
  if (!found) {
    const reason: string = unsupportedFormatReason(extractDir);
    if (reason) throw new Error(`暂不支持${reason}，目前只支持 Modrinth（.mrpack）和 CurseForge 整合包`);
    throw new Error('这个压缩包里没有整合包清单（modrinth.index.json 或 manifest.json）');
  }

  if (found.format === 'modrinth') {
    const index: any = readJson(path.join(found.root, 'modrinth.index.json'));
    const deps: any = index.dependencies || {};
    const mcVersion: string = String(deps.minecraft || '').trim();
    if (!mcVersion) throw new Error('整合包清单里没有写 Minecraft 版本');
    let loaderType: PackInfo['loaderType'] = '';
    let loaderVersion: string = '';
    if (deps['fabric-loader']) {
      loaderType = 'fabric';
      loaderVersion = String(deps['fabric-loader']);
    } else if (deps.forge) {
      loaderType = 'forge';
      loaderVersion = String(deps.forge);
    } else if (deps.neoforge || deps['neo-forge']) {
      loaderType = 'neoforge';
      loaderVersion = String(deps.neoforge || deps['neo-forge']);
    } else if (deps['quilt-loader']) {
      throw new Error('暂不支持 Quilt 整合包');
    }
    return {
      format: 'modrinth',
      name: String(index.name || '').trim(),
      version: String(index.versionId || '').trim(),
      mcVersion,
      loaderType,
      loaderVersion,
      root: found.root
    };
  }

  const manifest: any = readJson(path.join(found.root, 'manifest.json'));
  const mcVersion: string = String(manifest?.minecraft?.version || '').trim();
  if (!mcVersion) throw new Error('整合包清单里没有写 Minecraft 版本');
  const loaders: any[] = Array.isArray(manifest?.minecraft?.modLoaders) ? manifest.minecraft.modLoaders : [];
  const primary: any = loaders.find((l: any) => l?.primary) || loaders[0] || null;
  const loaderId: string = String(primary?.id || '').trim();
  let loaderType: PackInfo['loaderType'] = '';
  let loaderVersion: string = '';
  const match: RegExpMatchArray | null = loaderId.match(/^(forge|neoforge|fabric|quilt)-(.+)$/i);
  if (match) {
    const kind: string = match[1].toLowerCase();
    if (kind === 'quilt') throw new Error('暂不支持 Quilt 整合包');
    loaderType = kind as PackInfo['loaderType'];
    loaderVersion = match[2];
  }

  return {
    format: 'curseforge',
    name: String(manifest.name || '').trim(),
    version: String(manifest.version || '').trim(),
    mcVersion,
    loaderType,
    loaderVersion,
    root: found.root
  };
}


function sanitizeInstanceName(raw: string, fallback: string): string {
  let name: string = String(raw || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[.\s]+$/, '').trim();
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = `${name}_pack`;
  if (name.length > 64) name = name.slice(0, 64).trim();

  const versionsDir: string = path.join(GAME_DIR, 'versions');
  let candidate: string = name;
  let index: number = 2;
  while (fs.existsSync(path.join(versionsDir, candidate))) {
    candidate = `${name} (${index})`;
    index += 1;
  }
  return candidate;
}


function isInside(parent: string, child: string): boolean {
  const relative: string = path.relative(parent, child);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}


function copyOverrides(packRoot: string, folder: string, destDir: string): void {
  const src: string = path.join(packRoot, folder);
  if (!folder || !fs.existsSync(src)) return;
  fs.cpSync(src, destDir, { recursive: true, force: true });
  writeLog(`[整合包] 已合并 ${folder}`);
}


function classifyCurseForgeFile(file: any): string {
  const modules: string[] = Array.isArray(file?.modules) ? file.modules.map(String) : [];
  const fileName: string = String(file?.fileName || '');
  if (modules.some((m: string) => /META-INF|mcmod\.info|fabric\.mod\.json/i.test(m)) || /\.jar$/i.test(fileName)) return 'mods';
  if (modules.includes('pack.mcmeta')) return 'resourcepacks';
  if (modules.some((m: string) => /^shaders/i.test(m))) return 'shaderpacks';
  return 'saves';
}


function curseForgeCdnUrl(fileId: any, fileName: string): string {
  const id: string = String(fileId || '');
  if (id.length < 4 || !fileName) return '';
  return `https://mediafilez.forgecdn.net/files/${id.slice(0, 4)}/${id.slice(4)}/${encodeURIComponent(fileName)}`;
}


async function collectModrinthFiles(packRoot: string, instanceDir: string): Promise<{ jobs: PackFileJob[]; skipped: number }> {
  const index: any = readJson(path.join(packRoot, 'modrinth.index.json'));
  const jobs: PackFileJob[] = [];
  let skipped: number = 0;

  for (const file of index.files || []) {
    if (file?.env?.client === 'unsupported') {
      skipped += 1;
      continue;
    }
    const relative: string = String(file?.path || '').replace(/^[/\\]+/, '');
    if (!relative) {
      skipped += 1;
      continue;
    }
    const dest: string = path.join(instanceDir, relative);
    if (!isInside(instanceDir, dest)) {
      throw new Error(`整合包里有非法的文件路径：${relative}`);
    }
    const sources: string[] = (file.downloads || []).filter(Boolean).map(String);
    if (sources.length === 0) {
      writeLog(`[整合包] 跳过没有下载地址的文件: ${relative}`);
      skipped += 1;
      continue;
    }
    jobs.push({ label: path.basename(relative), sources, dest, sha1: String(file?.hashes?.sha1 || '') });
  }

  return { jobs, skipped };
}


async function collectCurseForgeFiles(packRoot: string, instanceDir: string): Promise<{ jobs: PackFileJob[]; skipped: number }> {
  const manifest: any = readJson(path.join(packRoot, 'manifest.json'));
  const entries: any[] = (manifest.files || []).filter((f: any) => f && f.fileID);
  const required: any[] = entries.filter((f: any) => f.required !== false);
  const skipped: number = entries.length - required.length;
  if (required.length === 0) return { jobs: [], skipped };

  const ids: number[] = required.map((f: any) => Number(f.fileID)).filter((id: number) => Number.isFinite(id));
  let response: any;
  try {
    response = await curseForgeApi('/mods/files', { method: 'POST', body: { fileIds: ids } });
  } catch (e: any) {
    throw new Error(`读取 CurseForge 文件列表失败：${e.message}`);
  }
  const files: any[] = Array.isArray(response?.data) ? response.data : [];
  const byId: Map<string, any> = new Map(files.map((file: any) => [String(file.id), file]));

  const jobs: PackFileJob[] = [];
  const missing: string[] = [];
  let unresolved: number = 0;

  for (const entry of required) {
    const file: any = byId.get(String(entry.fileID));
    if (!file) {
      missing.push(String(entry.projectID));
      continue;
    }
    const fileName: string = String(file.fileName || '');
    if (!fileName) {
      unresolved += 1;
      continue;
    }
    const url: string = String(file.downloadUrl || curseForgeCdnUrl(file.id, fileName));
    if (!url) {
      unresolved += 1;
      continue;
    }
    const dest: string = path.join(instanceDir, classifyCurseForgeFile(file), path.basename(fileName));
    const hashes: any[] = Array.isArray(file.hashes) ? file.hashes : [];
    const sha1Hash: any = hashes.find((h: any) => Number(h?.algo) === 1);
    jobs.push({ label: fileName, sources: [url], dest, sha1: sha1Hash ? String(sha1Hash.value) : '' });
  }

  if (missing.length > 0 || unresolved > 0) {
    const reasons: string[] = [];
    if (missing.length > 0) {
      reasons.push(`${missing.length} 个文件在 CurseForge 上已不存在（项目 ID：${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}）`);
    }
    if (unresolved > 0) reasons.push(`${unresolved} 个文件拿不到下载地址`);
    throw new Error(`${reasons.join('，')}，这个整合包装不全。可以换一个版本再试`);
  }

  return { jobs, skipped };
}


function sha1Of(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash: any = crypto.createHash('sha1');
    const stream: fs.ReadStream = fs.createReadStream(filePath);
    stream.on('data', (chunk: any) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}


async function downloadPackFiles(jobs: PackFileJob[]): Promise<{ downloaded: number; existing: number }> {
  let downloaded: number = 0;
  let existing: number = 0;
  const pendingJobs: PackFileJob[] = [];

  for (const job of jobs) {
    if (shouldCancelDownload) break;
    if (fs.existsSync(job.dest) && fs.statSync(job.dest).size > 0) {
      existing += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    pendingJobs.push(job);
  }

  setTotalDownloadFiles(jobs.length);
  setCompletedDownloadFiles(existing);

  const results: PromiseSettledResult<void>[] = await Promise.allSettled(pendingJobs.map(async (job: PackFileJob) => {
    await downloadWithPool(job.sources, job.dest, job.label);
    if (job.sha1 && await sha1Of(job.dest) !== job.sha1.toLowerCase()) {
      writeLog(`[整合包] 校验失败，重新下载: ${job.label}`);
      try { fs.unlinkSync(job.dest); } catch {}
      await downloadWithPool(job.sources, job.dest, job.label);
      if (await sha1Of(job.dest) !== job.sha1.toLowerCase()) {
        throw new Error(`${job.label} 下载后校验不通过，文件可能不完整`);
      }
    }
    downloaded += 1;
  }));
  if (shouldCancelDownload) throw new Error('下载已取消');

  const failed: any[] = results.filter((item: PromiseSettledResult<void>) => item.status === 'rejected');
  if (failed.length > 0) {
    const first: any = (failed[0] as PromiseRejectedResult).reason;
    throw new Error(`${failed.length} 个文件下载失败：${first?.message || first}`);
  }

  setCompletedDownloadFiles(jobs.length);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('download-progress', { label: '整合包文件', percent: 100, current: jobs.length, total: jobs.length });
  }

  return { downloaded, existing };
}


function writeInstanceJson(instanceName: string, mcVersion: string, loaderVersionId: string): void {
  const versionsDir: string = path.join(GAME_DIR, 'versions');
  const instanceDir: string = path.join(versionsDir, instanceName);

  let data: any = null;
  if (loaderVersionId && loaderVersionId !== mcVersion) {
    const loaderJsonPath: string = path.join(versionsDir, loaderVersionId, `${loaderVersionId}.json`);
    if (fs.existsSync(loaderJsonPath)) {
      try { data = readJson(loaderJsonPath); } catch {}
    }
  }

  const json: any = data
    ? { ...data, id: instanceName }
    : { id: instanceName, inheritsFrom: mcVersion, type: 'release' };
  if (!json.inheritsFrom) json.inheritsFrom = mcVersion;

  fs.writeFileSync(path.join(instanceDir, `${instanceName}.json`), JSON.stringify(json, null, 2), 'utf8');
  markVersionIsolated(GAME_DIR, instanceName);
}


export async function installModpack(options: { archivePath: string; instanceName?: string; maxConcurrent?: number }): Promise<any> {
  const archivePath: string = options.archivePath;
  const workDir: string = path.join(tempDir(), `modpack-${Date.now()}`);
  const maxConcurrent: number = options.maxConcurrent && options.maxConcurrent > 0 ? options.maxConcurrent : 20;
  let instanceDir: string = '';

  try {
    fs.mkdirSync(workDir, { recursive: true });
    writeStage('正在解压整合包…');
    new AdmZip(archivePath).extractAllTo(workDir, true);

    const info: PackInfo = parsePack(workDir);
    const fallbackName: string = `${info.name || path.basename(archivePath, path.extname(archivePath))}${info.version ? ` ${info.version}` : ''}`;
    const instanceName: string = sanitizeInstanceName(options.instanceName || fallbackName, '整合包');
    writeLog(`[整合包] ${info.format}：${instanceName}（MC ${info.mcVersion}${info.loaderVersion ? ` / ${info.loaderType} ${info.loaderVersion}` : ''}）`);

    instanceDir = path.join(GAME_DIR, 'versions', instanceName);
    fs.mkdirSync(instanceDir, { recursive: true });

    let loaderVersionId: string = info.mcVersion;
    if (info.loaderType) {
      writeStage(`正在安装 Minecraft ${info.mcVersion} + ${info.loaderType} ${info.loaderVersion}…`);
      const loaderResult: any = await installVersionWithModLoader(
        info.mcVersion,
        info.loaderType,
        info.loaderVersion,
        maxConcurrent,
        { installFabricApi: false }
      );
      if (!loaderResult?.success) {
        throw new Error(loaderResult?.error || '游戏版本或模组加载器安装失败');
      }
      if (shouldCancelDownload) throw new Error('下载已取消');
      loaderVersionId = String(loaderResult.finalVersionId || info.mcVersion);
    } else {
      writeStage(`正在安装 Minecraft ${info.mcVersion}…`);
      await installVersion(info.mcVersion, maxConcurrent);
      if (shouldCancelDownload) throw new Error('下载已取消');
    }

    writeStage('正在整理整合包文件…');
    const collected: { jobs: PackFileJob[]; skipped: number } = info.format === 'curseforge'
      ? await collectCurseForgeFiles(info.root, instanceDir)
      : await collectModrinthFiles(info.root, instanceDir);

    writeStage(`正在下载整合包文件（共 ${collected.jobs.length} 个）…`);
    setOverallProgressMode(true);
    let downloaded: number = 0;
    let existing: number = 0;
    try {
      const result: { downloaded: number; existing: number } = await downloadPackFiles(collected.jobs);
      downloaded = result.downloaded;
      existing = result.existing;
    } finally {
      setOverallProgressMode(false);
    }

    writeStage('正在合并整合包配置…');
    if (info.format === 'modrinth') {
      copyOverrides(info.root, 'overrides', instanceDir);
      copyOverrides(info.root, 'client-overrides', instanceDir);
    } else {
      copyOverrides(info.root, String(readJson(path.join(info.root, 'manifest.json'))?.overrides || 'overrides'), instanceDir);
    }

    writeInstanceJson(instanceName, info.mcVersion, loaderVersionId);

    writeLog(`[整合包] 安装完成: ${instanceName}（新下载 ${downloaded} 个，已存在 ${existing} 个）`);
    return {
      success: true,
      instanceName,
      versionId: instanceName,
      mcVersion: info.mcVersion,
      loaderType: info.loaderType,
      loaderVersion: info.loaderVersion,
      downloaded,
      existing,
      skipped: collected.skipped
    };
  } catch (e: any) {
    writeLog(`[整合包] 安装失败: ${e.message}`);
    if (instanceDir) {
      try { fs.rmSync(instanceDir, { recursive: true, force: true }); } catch {}
    }
    return { success: false, error: e.message };
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
    try {
      if (archivePath.startsWith(tempDir()) && fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    } catch {}
  }
}


ipcMain.handle('modpack-install', async (_, options: any) => {
  const source: string = options?.source === 'curseforge' ? 'curseforge' : 'modrinth';
  const projectId: string = String(options?.projectId || '').trim();
  const versionId: string = String(options?.versionId || '').trim();
  const gameVersion: string = String(options?.gameVersion || '').trim();
  if (!projectId) return { success: false, error: '缺少项目 ID' };

  const archivePath: string = path.join(tempDir(), `pack-${Date.now()}.mrpack`);
  try {
    fs.mkdirSync(tempDir(), { recursive: true });
    const file: { fileName: string; downloadUrl: string } = await resolveProjectFile(source, projectId, versionId, gameVersion, '');
    writeStage(`正在下载整合包：${file.fileName}`);
    await downloadFile(file.downloadUrl, archivePath, `整合包：${file.fileName}`, [file.downloadUrl]);
    if (shouldCancelDownload) throw new Error('下载已取消');
    return await installModpack({
      archivePath,
      instanceName: String(options?.instanceName || ''),
      maxConcurrent: Number(options?.maxConcurrent) || 0
    });
  } catch (e: any) {
    try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch {}
    writeLog(`[整合包] 下载失败: ${e.message}`);
    return { success: false, error: e.message };
  }
});
