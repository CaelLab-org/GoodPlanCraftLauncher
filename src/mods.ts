/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

import { GAME_DIR, getVersionGameDir, isVersionIsolated, loadSettings, markVersionIsolated, writeLog } from './config';
// __IMPORTS_END__

export type ModSource = 'modrinth' | 'curseforge';

const MODRINTH_BASE: string = 'https://api.modrinth.com/v2';
const CURSEFORGE_MIRROR: string = 'https://mod.mcimirror.top/curseforge/v1';
const CURSEFORGE_OFFICIAL: string = 'https://api.curseforge.com/v1';
const USER_AGENT: string = 'GoodPlanCraftLauncher (github.com/CaelLab-org/GoodPlanCraftLauncher)';

const CURSEFORGE_LOADERS: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6
};

let curseForgeBase: string | null = null;


export function describeVersion(versionId: string): any {
  const versionDir: string = path.join(GAME_DIR, 'versions', versionId);
  const gameDir: string = getVersionGameDir(versionId);
  let data: any = {};
  const jsonPath: string = path.join(versionDir, `${versionId}.json`);
  try {
    if (fs.existsSync(jsonPath)) data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    else {
      const jsonFile: string = fs.readdirSync(versionDir).find((f: string) => f.endsWith('.json')) || '';
      if (jsonFile) data = JSON.parse(fs.readFileSync(path.join(versionDir, jsonFile), 'utf8'));
    }
  } catch {}

  const libNames: string = (data.libraries || []).map((lib: any) => lib.name || '').join(' ');
  const haystack: string = `${versionId} ${data.mainClass || ''} ${libNames}`.toLowerCase();
  const hasFabric: boolean = haystack.includes('fabricmc') || haystack.includes('fabric-loader');
  const hasForge: boolean = haystack.includes('minecraftforge') || haystack.includes('-forge-') || versionId.includes('-forge-');
  const hasNeoForge: boolean = haystack.includes('neoforged') || versionId.toLowerCase().includes('neoforge');
  const hasQuilt: boolean = haystack.includes('quiltmc') || versionId.toLowerCase().includes('quilt');
  const hasOptiFine: boolean = haystack.includes('optifine');

  return {
    id: versionId,
    mcVersion: String(data.inheritsFrom || data.id || versionId),
    hasModLoader: hasFabric || hasForge || hasNeoForge || hasQuilt,
    hasOptiFine,
    loaders: [
      hasFabric ? 'fabric' : '',
      hasForge ? 'forge' : '',
      hasNeoForge ? 'neoforge' : '',
      hasQuilt ? 'quilt' : ''
    ].filter(Boolean),
    isolated: isVersionIsolated(versionId),
    versionDir,
    gameDir,
    modsDir: path.join(gameDir, 'mods'),
    shaderpacksDir: path.join(gameDir, 'shaderpacks')
  };
}


ipcMain.handle('get-version-info', (_, versionId: string) => {
  try {
    if (!versionId) return { success: false, error: '缺少版本名' };
    return { success: true, info: describeVersion(versionId) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});


ipcMain.handle('list-installed-versions', () => {
  try {
    const versionsDir: string = path.join(GAME_DIR, 'versions');
    if (!fs.existsSync(versionsDir)) return { success: true, versions: [] };
    const versions: any[] = [];
    for (const entry of fs.readdirSync(versionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir: string = path.join(versionsDir, entry.name);
      const hasJson: boolean = fs.existsSync(path.join(dir, `${entry.name}.json`))
        || fs.readdirSync(dir).some((f: string) => f.endsWith('.json'));
      if (!hasJson) continue;
      try {
        versions.push(describeVersion(entry.name));
      } catch {}
    }
    versions.sort((a: any, b: any) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    return { success: true, versions };
  } catch (e: any) {
    return { success: false, error: e.message, versions: [] };
  }
});

function getCurseForgeSettings(): { bases: string[]; apiKey: string } {
  let apiKey: string = '';
  try {
    apiKey = String(loadSettings().download?.curseForgeApiKey || '').trim();
  } catch {}
  const bases: string[] = [];
  if (curseForgeBase) bases.push(curseForgeBase);
  if (!bases.includes(CURSEFORGE_MIRROR)) bases.push(CURSEFORGE_MIRROR);
  if (apiKey && !bases.includes(CURSEFORGE_OFFICIAL)) bases.push(CURSEFORGE_OFFICIAL);
  return { bases, apiKey };
}


function requestJson(url: string, headers: Record<string, string> = {}, redirectsLeft: number = 3, timeoutMs: number = 20000): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const proto: any = url.startsWith('https') ? https : http;
    const req: any = proto.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', ...headers }
    }, (res: any) => {
      const status: number = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next: string = new URL(res.headers.location, url).toString();
        resolve(requestJson(next, headers, redirectsLeft - 1, timeoutMs));
        return;
      }
      let body: string = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => body += chunk);
      res.on('end', () => {
        if (status >= 400) {
          reject(new Error(`HTTP ${status}${body ? `: ${body.slice(0, 160)}` : ''}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`返回内容不是 JSON: ${body.slice(0, 120)}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', reject);
  });
}


async function curseForgeRequest(pathname: string): Promise<any> {
  const { bases, apiKey } = getCurseForgeSettings();
  let lastError: any = null;
  for (const base of bases) {
    try {
      const headers: Record<string, string> = base === CURSEFORGE_OFFICIAL ? { 'x-api-key': apiKey } : {};
      const data: any = await requestJson(`${base}${pathname}`, headers);
      curseForgeBase = base;
      return data;
    } catch (e: any) {
      lastError = e;
      writeLog(`[模组] CurseForge 源失败 ${base}: ${e.message}`);
    }
  }
  if (!apiKey) {
    throw new Error('CurseForge 镜像暂不可用。可在「设置 → 下载」里填写 CurseForge API Key，或改用 Modrinth');
  }
  throw lastError || new Error('CurseForge 请求失败');
}


const chineseQueryCache: Map<string, string | null> = new Map();

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}


function requestText(url: string, timeoutMs: number = 15000, redirectsLeft: number = 3): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const req: any = https.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    }, (res: any) => {
      const status: number = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(requestText(new URL(res.headers.location, url).toString(), timeoutMs, redirectsLeft - 1));
        return;
      }
      if (status >= 400) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      let body: string = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => body += chunk);
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', reject);
  });
}


async function chineseModNameToEnglish(query: string): Promise<string | null> {
  const cached: string | null | undefined = chineseQueryCache.get(query);
  if (cached !== undefined) return cached;

  try {
    let html: string;
    try {
      html = await requestText(`https://search.mcmod.cn/s?key=${encodeURIComponent(query)}&site=all&filter=0`);
    } catch {
      await new Promise<void>((r) => setTimeout(r, 400));
      html = await requestText(`https://search.mcmod.cn/s?key=${encodeURIComponent(query)}&site=all&filter=0`);
    }
    const titles: string[] = [];
    const pattern: RegExp = /<a[^>]+href="(?:https?:)?\/\/(?:www\.)?mcmod\.cn\/class\/\d+\.html"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const title: string = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '')).trim();
      if (title) titles.push(title);
    }

    for (const title of titles.slice(0, 5)) {
      const english: RegExpMatchArray | null = title.match(/\(([^)]*[A-Za-z][^)]*)\)/);
      if (english) {
        const name: string = english[1].trim();
        chineseQueryCache.set(query, name);
        writeLog(`[模组] 中文搜索: ${query} -> ${name}`);
        return name;
      }
    }

    const englishTitle: string | undefined = titles.find((t: string) => /[A-Za-z]{3,}/.test(t) && !/[一-鿿]/.test(t));
    if (englishTitle) {
      chineseQueryCache.set(query, englishTitle);
      writeLog(`[模组] 中文搜索: ${query} -> ${englishTitle}`);
      return englishTitle;
    }
  } catch (e: any) {
    writeLog(`[模组] 中文搜索转换失败: ${e.message}`);
  }

  return null;
}


function modrinthFacets(gameVersion: string, loader: string): string {
  const facets: string[][] = [['project_type:mod']];
  if (gameVersion) facets.push([`versions:${gameVersion}`]);
  if (loader) facets.push([`categories:${loader}`]);
  return encodeURIComponent(JSON.stringify(facets));
}


async function searchModrinth(query: string, gameVersion: string, loader: string, offset: number, limit: number): Promise<{ items: any[]; total: number }> {
  const params: string[] = [
    `limit=${limit}`,
    `offset=${offset}`,
    `index=${query ? 'relevance' : 'downloads'}`,
    `facets=${modrinthFacets(gameVersion, loader)}`
  ];
  if (query) params.push(`query=${encodeURIComponent(query)}`);
  const data: any = await requestJson(`${MODRINTH_BASE}/search?${params.join('&')}`);

  const items: any[] = (data.hits || []).map((hit: any) => ({
    source: 'modrinth',
    id: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    description: hit.description,
    iconUrl: hit.icon_url || '',
    downloads: hit.downloads || 0,
    author: hit.author || '',
    categories: hit.display_categories || hit.categories || []
  }));
  return { items, total: Number(data.total_hits) || items.length };
}


async function searchCurseForge(query: string, gameVersion: string, loader: string, offset: number, limit: number): Promise<{ items: any[]; total: number }> {
  const params: string[] = [
    'gameId=432',
    'classId=6',
    'sortField=2',
    'sortOrder=desc',
    `pageSize=${limit}`,
    `index=${offset}`
  ];
  if (query) params.push(`searchFilter=${encodeURIComponent(query)}`);
  if (gameVersion) params.push(`gameVersion=${encodeURIComponent(gameVersion)}`);
  if (loader && CURSEFORGE_LOADERS[loader]) params.push(`modLoaderType=${CURSEFORGE_LOADERS[loader]}`);

  const data: any = await curseForgeRequest(`/mods/search?${params.join('&')}`);
  const items: any[] = (data.data || []).map((mod: any) => ({
    source: 'curseforge',
    id: String(mod.id),
    slug: mod.slug || '',
    title: mod.name,
    description: mod.summary || '',
    iconUrl: mod.logo?.thumbnailUrl || mod.logo?.url || '',
    downloads: mod.downloadCount || 0,
    author: mod.authors?.[0]?.name || '',
    categories: (mod.categories || []).map((c: any) => c.name)
  }));
  return { items, total: Number(data.pagination?.totalCount) || items.length };
}


ipcMain.handle('mods-search', async (_, options: any) => {
  const source: string = options?.source || 'modrinth';
  const rawQuery: string = String(options?.query || '').trim();
  let query: string = rawQuery;
  let translatedTo: string = '';
  if (/[一-鿿]/.test(rawQuery)) {
    const english: string | null = await chineseModNameToEnglish(rawQuery);
    if (english) {
      query = english;
      translatedTo = english;
    }
  }
  const gameVersion: string = String(options?.gameVersion || '').trim();
  const loader: string = String(options?.loader || '').trim().toLowerCase();
  const offset: number = Math.max(0, Number(options?.offset) || 0);
  const limit: number = Math.min(40, Math.max(1, Number(options?.limit) || 20));

  const errors: string[] = [];
  const results: any[] = [];
  let total: number = 0;

  if (source === 'modrinth' || source === 'both') {
    try {
      const result = await searchModrinth(query, gameVersion, loader, offset, limit);
      results.push(...result.items);
      total += result.total;
    } catch (e: any) {
      errors.push(`Modrinth: ${e.message}`);
      writeLog(`[模组] Modrinth 搜索失败: ${e.message}`);
    }
  }

  if (source === 'curseforge' || source === 'both') {
    try {
      const result = await searchCurseForge(query, gameVersion, loader, offset, limit);
      results.push(...result.items);
      total += result.total;
    } catch (e: any) {
      errors.push(`CurseForge: ${e.message}`);
      writeLog(`[模组] CurseForge 搜索失败: ${e.message}`);
    }
  }

  if (results.length === 0 && errors.length > 0) {
    return { success: false, error: errors.join('；'), items: [], total: 0 };
  }
  results.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
  return { success: true, items: results.slice(0, limit), total, errors, translatedFrom: translatedTo ? rawQuery : '', translatedTo };
});


function modrinthFile(version: any): any {
  const file: any = (version.files || []).find((f: any) => f.primary) || (version.files || [])[0];
  if (!file) return null;
  return {
    url: file.url,
    fileName: file.filename,
    size: file.size || 0
  };
}


async function modrinthVersions(projectId: string, gameVersion: string, loader: string): Promise<any[]> {
  const params: string[] = [];
  if (gameVersion) params.push(`game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}`);
  if (loader) params.push(`loaders=${encodeURIComponent(JSON.stringify([loader]))}`);
  const url: string = `${MODRINTH_BASE}/project/${encodeURIComponent(projectId)}/version${params.length ? `?${params.join('&')}` : ''}`;
  const data: any = await requestJson(url);
  if (!Array.isArray(data)) throw new Error('Modrinth 版本列表格式异常');

  return data.map((version: any) => {
    const file: any = modrinthFile(version);
    return {
      source: 'modrinth',
      id: version.id,
      name: version.name || version.version_number,
      versionNumber: version.version_number,
      gameVersions: version.game_versions || [],
      loaders: version.loaders || [],
      releaseType: version.version_type || 'release',
      date: version.date_published || '',
      fileName: file?.fileName || '',
      downloadUrl: file?.url || '',
      fileSize: file?.size || 0,
      dependencies: (version.dependencies || []).map((dep: any) => ({
        projectId: dep.project_id || '',
        versionId: dep.version_id || '',
        type: dep.dependency_type || 'optional'
      }))
    };
  });
}


async function curseForgeFiles(projectId: string, gameVersion: string, loader: string): Promise<any[]> {
  const params: string[] = ['pageSize=50'];
  if (gameVersion) params.push(`gameVersion=${encodeURIComponent(gameVersion)}`);
  if (loader && CURSEFORGE_LOADERS[loader]) params.push(`modLoaderType=${CURSEFORGE_LOADERS[loader]}`);
  const data: any = await curseForgeRequest(`/mods/${encodeURIComponent(projectId)}/files?${params.join('&')}`);
  if (!Array.isArray(data?.data)) throw new Error('CurseForge 文件列表格式异常');

  return data.data.map((file: any) => ({
    source: 'curseforge',
    id: String(file.id),
    name: file.displayName || file.fileName,
    versionNumber: file.displayName || file.fileName,
    gameVersions: file.gameVersions || [],
    loaders: [],
    releaseType: file.releaseType === 3 ? 'alpha' : file.releaseType === 2 ? 'beta' : 'release',
    date: file.fileDate || '',
    fileName: file.fileName,
    downloadUrl: file.downloadUrl || curseForgeCdnUrl(file),
    fileSize: file.fileLength || 0,
    dependencies: (file.dependencies || [])
      .filter((dep: any) => dep.relationType === 3)
      .map((dep: any) => ({ projectId: String(dep.modId), versionId: '', type: 'required' }))
  }));
}


function curseForgeCdnUrl(file: any): string {
  const id: string = String(file.id || '');
  if (id.length < 4 || !file.fileName) return '';
  return `https://edge.forgecdn.net/files/${id.slice(0, 4)}/${id.slice(4)}/${encodeURIComponent(file.fileName)}`;
}


function sortForVersion(versions: any[], preferGameVersion: string): any[] {
  if (!preferGameVersion) return versions.slice(0, 120);
  return versions.slice().sort((a: any, b: any) => {
    const am: number = (a.gameVersions || []).includes(preferGameVersion) ? 0 : 1;
    const bm: number = (b.gameVersions || []).includes(preferGameVersion) ? 0 : 1;
    return am - bm;
  }).slice(0, 120);
}


ipcMain.handle('mods-versions', async (_, options: any) => {
  const source: string = options?.source === 'curseforge' ? 'curseforge' : 'modrinth';
  const projectId: string = String(options?.projectId || '').trim();
  const gameVersion: string = String(options?.gameVersion || '').trim();
  const loader: string = String(options?.loader || '').trim().toLowerCase();
  const preferGameVersion: string = String(options?.preferGameVersion || '').trim();
  if (!projectId) return { success: false, error: '缺少项目 ID', versions: [] };

  try {
    const versions: any[] = source === 'curseforge'
      ? await curseForgeFiles(projectId, gameVersion, loader)
      : await modrinthVersions(projectId, gameVersion, loader);
    return { success: true, versions: sortForVersion(versions, preferGameVersion) };
  } catch (e: any) {
    writeLog(`[模组] 获取版本失败 (${source}/${projectId}): ${e.message}`);
    return { success: false, error: e.message, versions: [] };
  }
});


function curseForgeCdnUrlFromId(fileId: number, fileName: string): string {
  const id: string = String(fileId);
  return `https://mediafilez.forgecdn.net/files/${id.slice(0, 4)}/${id.slice(4)}/${encodeURIComponent(fileName)}`;
}


async function lookupCurseForge(slug: string, gameVersion: string, loader: string, preferGameVersion: string = ''): Promise<any> {
  const data: any = await requestJson(`https://api.cfwidget.com/minecraft/mc-mods/${encodeURIComponent(slug)}`, {}, 3, 45000);
  if (!data || !data.id) throw new Error('CurseForge 项目不存在或无法读取');

  let files: any[] = Array.isArray(data.files) ? data.files : [];
  if (gameVersion) {
    files = files.filter((f: any) => f.version === gameVersion || (f.versions || []).includes(gameVersion));
  }
  if (loader) {
    files = files.filter((f: any) => (f.versions || []).map((v: any) => String(v).toLowerCase()).includes(loader));
  }
  files.sort((a: any, b: any) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime());

  const sortedFiles: any[] = preferGameVersion
    ? files.slice().sort((a: any, b: any) => {
        const am: number = a.version === preferGameVersion ? 0 : 1;
        const bm: number = b.version === preferGameVersion ? 0 : 1;
        return am - bm;
      })
    : files;
  const versions: any[] = sortedFiles.slice(0, 80).map((file: any) => {
    const tags: string[] = (file.versions || []).map((v: any) => String(v).toLowerCase());
    return {
      source: 'curseforge',
      id: String(file.id),
      name: file.display || file.name,
      versionNumber: file.display || file.name,
      gameVersions: [file.version].filter(Boolean),
      loaders: ['fabric', 'forge', 'neoforge', 'quilt'].filter((l: string) => tags.includes(l)),
      releaseType: file.type || 'release',
      date: file.uploaded_at || '',
      fileName: file.name || '',
      downloadUrl: file.name ? curseForgeCdnUrlFromId(file.id, file.name) : '',
      fileSize: file.filesize || 0,
      dependencies: []
    };
  });

  return {
    success: true,
    project: {
      source: 'curseforge',
      id: String(data.id),
      slug,
      title: data.title || slug,
      description: data.summary || '',
      iconUrl: data.thumbnail || '',
      downloads: data.downloads || 0,
      author: data.members?.[0]?.username || '',
      categories: (data.categories || []).map((c: any) => (typeof c === 'string' ? c : c.name)).filter(Boolean),
      direct: true
    },
    versions,
    total: files.length
  };
}


ipcMain.handle('mods-curseforge-lookup', async (_, options: any) => {
  const slug: string = String(options?.slug || '').trim();
  const gameVersion: string = String(options?.gameVersion || '').trim();
  const loader: string = String(options?.loader || '').trim().toLowerCase();
  const preferGameVersion: string = String(options?.preferGameVersion || '').trim();
  if (!slug) return { success: false, error: '缺少 CurseForge 项目名' };
  try {
    return await lookupCurseForge(slug, gameVersion, loader, preferGameVersion);
  } catch (e: any) {
    writeLog(`[模组] CurseForge 链接查询失败 (${slug}): ${e.message}`);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('mods-install-direct', async (_, options: any) => {
  const targetVersionId: string = String(options?.targetVersionId || '').trim();
  const targetDir: string = String(options?.targetDir || '').trim();
  const url: string = String(options?.url || '');
  const fileName: string = path.basename(String(options?.fileName || ''));
  if (!targetVersionId && !targetDir) return { success: false, error: '请选择安装到哪个版本或目录' };
  if (!fileName || !fileName.toLowerCase().endsWith('.jar')) return { success: false, error: '文件类型不正确' };

  let host: string = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  if (!host.endsWith('forgecdn.net') && host !== 'cdn.modrinth.com') {
    return { success: false, error: '不支持这个下载地址' };
  }

  let modsDir: string;
  if (targetDir) {
    modsDir = path.join(path.resolve(targetDir), 'mods');
  } else {
    if (!isVersionIsolated(targetVersionId)) {
      markVersionIsolated(GAME_DIR, targetVersionId);
      writeLog(`[模组] 已为目标版本 ${targetVersionId} 启用版本隔离`);
    }
    modsDir = path.join(getVersionGameDir(targetVersionId), 'mods');
  }
  const dest: string = path.join(modsDir, fileName);

  try {
    if (fs.existsSync(dest)) {
      return { success: true, files: [], skipped: [fileName], modsDir, targetVersionId, targetDir };
    }
    await downloadToFile(url, dest, fileName);
    writeLog(`[模组] 链接安装完成: ${fileName} -> ${modsDir}`);
    return { success: true, files: [fileName], skipped: [], modsDir, targetVersionId, targetDir, direct: true };
  } catch (e: any) {
    writeLog(`[模组] 链接安装失败: ${e.message}`);
    return { success: false, error: e.message, modsDir, targetVersionId, targetDir };
  }
});


function emitProgress(payload: any): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mod-download-progress', payload);
  }
}


function downloadToFile(url: string, dest: string, label: string, redirectsLeft: number = 4): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      resolve();
      return;
    }
    const dir: string = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const partPath: string = `${dest}.part`;
    const proto: any = url.startsWith('https') ? https : http;
    const req: any = proto.get(url, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT }
    }, (res: any) => {
      const status: number = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(downloadToFile(new URL(res.headers.location, url).toString(), dest, label, redirectsLeft - 1));
        return;
      }
      if (status >= 400) {
        res.resume();
        reject(new Error(`${label} HTTP ${status}`));
        return;
      }

      const total: number = parseInt(res.headers['content-length'] || '0', 10);
      let loaded: number = 0;
      const file: any = fs.createWriteStream(partPath);
      res.on('data', (chunk: any) => {
        loaded += chunk.length;
        file.write(chunk);
        emitProgress({
          label,
          percent: total > 0 ? Math.floor((loaded / total) * 100) : 0,
          bytesDownloaded: loaded,
          bytesTotal: total
        });
      });
      res.on('end', () => {
        file.end(() => {
          try {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            fs.renameSync(partPath, dest);
            resolve();
          } catch (e: any) {
            reject(e);
          }
        });
      });
      res.on('error', (e: any) => {
        file.destroy();
        try { fs.unlinkSync(partPath); } catch {}
        reject(e);
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`${label} 下载超时`)); });
    req.on('error', (e: any) => {
      try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch {}
      reject(e);
    });
  });
}


async function resolveModrinthVersion(projectId: string, gameVersion: string, loader: string, versionId?: string): Promise<any> {
  if (versionId) {
    const data: any = await requestJson(`${MODRINTH_BASE}/version/${encodeURIComponent(versionId)}`);
    const file: any = modrinthFile(data);
    return {
      id: data.id,
      fileName: file?.fileName || '',
      downloadUrl: file?.url || '',
      dependencies: (data.dependencies || []).map((dep: any) => ({
        projectId: dep.project_id || '',
        versionId: dep.version_id || '',
        type: dep.dependency_type || 'optional'
      }))
    };
  }
  const list: any[] = await modrinthVersions(projectId, gameVersion, loader);
  if (list.length === 0) throw new Error('这个项目没有匹配当前版本和加载器的文件');
  return list[0];
}


async function resolveCurseForgeVersion(projectId: string, gameVersion: string, loader: string, versionId?: string): Promise<any> {
  if (versionId) {
    const data: any = await curseForgeRequest(`/mods/${encodeURIComponent(projectId)}/files/${encodeURIComponent(versionId)}`);
    const file: any = data?.data;
    if (!file) throw new Error('找不到指定的 CurseForge 文件');
    return {
      id: String(file.id),
      fileName: file.fileName,
      downloadUrl: file.downloadUrl || curseForgeCdnUrl(file),
      dependencies: (file.dependencies || [])
        .filter((dep: any) => dep.relationType === 3)
        .map((dep: any) => ({ projectId: String(dep.modId), versionId: '', type: 'required' }))
    };
  }
  const list: any[] = await curseForgeFiles(projectId, gameVersion, loader);
  if (list.length === 0) throw new Error('这个项目没有匹配当前版本和加载器的文件');
  return list[0];
}


async function installProjectTo(source: string, projectId: string, versionId: string, gameVersion: string, loader: string, modsDir: string): Promise<any> {
  const files: string[] = [];
  const skipped: string[] = [];
  const visited: Set<string> = new Set();

  const walk = async (pid: string, vid: string, depth: number): Promise<void> => {
    if (depth > 3) return;
    const key: string = `${source}:${pid}:${vid}`;
    if (visited.has(key)) return;
    visited.add(key);

    const resolved: any = source === 'curseforge'
      ? await resolveCurseForgeVersion(pid, gameVersion, loader, vid || undefined)
      : await resolveModrinthVersion(pid, gameVersion, loader, vid || undefined);
    if (!resolved?.downloadUrl || !resolved?.fileName) {
      throw new Error('文件没有可用的下载地址（作者可能关闭了第三方下载）');
    }

    const dest: string = path.join(modsDir, path.basename(resolved.fileName));
    if (fs.existsSync(dest)) {
      skipped.push(resolved.fileName);
    } else {
      writeLog(`[模组] 下载 ${resolved.fileName} -> ${modsDir}`);
      await downloadToFile(resolved.downloadUrl, dest, resolved.fileName);
      files.push(resolved.fileName);
    }

    for (const dep of resolved.dependencies || []) {
      if (dep.type !== 'required') continue;
      if (dep.projectId) {
        await walk(dep.projectId, dep.versionId || '', depth + 1);
      }
    }
  };

  await walk(projectId, versionId, 0);
  return { files, skipped };
}


export async function installModrinthProjectTo(projectId: string, gameVersion: string, loader: string, modsDir: string): Promise<any> {
  if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir, { recursive: true });
  return installProjectTo('modrinth', projectId, '', gameVersion, loader, modsDir);
}


ipcMain.handle('mods-install', async (_, options: any) => {
  const source: string = options?.source === 'curseforge' ? 'curseforge' : 'modrinth';
  const projectId: string = String(options?.projectId || '').trim();
  const versionId: string = String(options?.versionId || '').trim();
  const targetVersionId: string = String(options?.targetVersionId || '').trim();
  const targetDir: string = String(options?.targetDir || '').trim();
  const gameVersion: string = String(options?.gameVersion || '').trim();
  const loader: string = String(options?.loader || '').trim().toLowerCase();
  if (!projectId) return { success: false, error: '缺少项目 ID' };
  if (!targetVersionId && !targetDir) return { success: false, error: '请选择安装到哪个版本或目录' };

  let modsDir: string;
  if (targetDir) {
    modsDir = path.join(path.resolve(targetDir), 'mods');
  } else {
    if (!isVersionIsolated(targetVersionId)) {
      markVersionIsolated(GAME_DIR, targetVersionId);
      writeLog(`[模组] 已为目标版本 ${targetVersionId} 启用版本隔离`);
    }
    modsDir = path.join(getVersionGameDir(targetVersionId), 'mods');
  }

  try {
    const result: any = await installProjectTo(source, projectId, versionId, gameVersion, loader, modsDir);
    writeLog(`[模组] 安装完成: ${result.files.join(', ') || '全部已存在'} -> ${modsDir}`);
    return { success: true, files: result.files, skipped: result.skipped, modsDir, targetVersionId, targetDir };
  } catch (e: any) {
    writeLog(`[模组] 安装失败: ${e.message}`);
    return { success: false, error: e.message, modsDir, targetVersionId, targetDir };
  }
});


ipcMain.handle('get-mods-dir', (_, versionId?: string) => versionId ? path.join(getVersionGameDir(versionId), 'mods') : path.join(GAME_DIR, 'mods'));
