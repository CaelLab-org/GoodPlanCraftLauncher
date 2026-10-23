/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

import { GAME_DIR, getVersionGameDir, markVersionIsolated, writeLog } from './config';
// __IMPORTS_END__

interface InstanceModEntry {
  file: string;
  name?: string;
  projectId?: string;
  source?: string;
}

function sanitizeInstanceName(raw: string, fallback: string): string {
  let name: string = String(raw || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[.\s]+$/, '').trim();
  if (!name) name = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = `${name}_instance`;
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


function readVersionJson(versionId: string): any | null {
  const dir: string = path.join(GAME_DIR, 'versions', versionId);
  const direct: string = path.join(dir, `${versionId}.json`);
  try {
    if (fs.existsSync(direct)) return JSON.parse(fs.readFileSync(direct, 'utf8'));
    const file: string | undefined = fs.readdirSync(dir).find((name: string) => name.endsWith('.json'));
    if (file) return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch {}
  return null;
}


function detectLoader(versionId: string, data: any): { type: string; version: string } | null {
  const libNames: string = (data?.libraries || []).map((lib: any) => lib.name || '').join(' ');
  const haystack: string = `${versionId} ${data?.mainClass || ''} ${libNames}`.toLowerCase();
  if (haystack.includes('fabricmc') || haystack.includes('fabric-loader')) return { type: 'fabric', version: '' };
  if (haystack.includes('neoforged') || versionId.toLowerCase().includes('neoforge')) return { type: 'neoforge', version: '' };
  if (haystack.includes('minecraftforge') || versionId.includes('-forge-')) return { type: 'forge', version: '' };
  if (haystack.includes('optifine')) return { type: 'optifine', version: '' };
  return null;
}


function copyBaseMods(baseVersionId: string, instanceDir: string): InstanceModEntry[] {
  const entries: InstanceModEntry[] = [];
  const baseGameDir: string = getVersionGameDir(baseVersionId);
  if (baseGameDir === GAME_DIR) return entries;

  const source: string = path.join(baseGameDir, 'mods');
  if (!fs.existsSync(source)) return entries;
  const target: string = path.join(instanceDir, 'mods');
  fs.mkdirSync(target, { recursive: true });

  for (const file of fs.readdirSync(source)) {
    if (!file.toLowerCase().endsWith('.jar')) continue;
    const from: string = path.join(source, file);
    try {
      if (!fs.statSync(from).isFile()) continue;
      fs.copyFileSync(from, path.join(target, file));
      entries.push({ file });
    } catch {}
  }
  return entries;
}


export function createVersionInstance(options: {
  baseVersionId?: string;
  name?: string;
  loaderType?: string;
  loaderVersion?: string;
}): any {
  const baseVersionId: string = String(options?.baseVersionId || '').trim();
  const requested: string = String(options?.name || '').trim();
  if (!baseVersionId) return { success: false, error: 'Missing base version' };

  const baseData: any | null = readVersionJson(baseVersionId);
  if (!baseData) return { success: false, error: `Base version not found: ${baseVersionId}` };
  if (!requested || requested === baseVersionId) {
    return { success: true, versionId: baseVersionId, created: false };
  }

  const instanceName: string = sanitizeInstanceName(requested, baseVersionId);
  if (instanceName === baseVersionId) return { success: true, versionId: baseVersionId, created: false };

  try {
    const instanceDir: string = path.join(GAME_DIR, 'versions', instanceName);
    fs.mkdirSync(instanceDir, { recursive: true });

    const json: any = { ...baseData, id: instanceName };
    if (!json.inheritsFrom) json.inheritsFrom = baseVersionId;
    fs.writeFileSync(path.join(instanceDir, `${instanceName}.json`), JSON.stringify(json, null, 2), 'utf8');

    markVersionIsolated(GAME_DIR, instanceName);
    const mods: InstanceModEntry[] = copyBaseMods(baseVersionId, instanceDir);

    const detected: { type: string; version: string } | null = detectLoader(baseVersionId, baseData);
    const loaderType: string = String(options?.loaderType || detected?.type || '');
    const loaderVersion: string = String(options?.loaderVersion || detected?.version || '');
    const meta: any = {
      name: instanceName,
      baseVersion: baseVersionId,
      mcVersion: String(baseData.inheritsFrom || baseData.id || baseVersionId),
      loader: loaderType ? { type: loaderType, version: loaderVersion } : null,
      createdAt: new Date().toISOString(),
      mods
    };
    fs.writeFileSync(path.join(instanceDir, 'gpcl', 'instance.json'), JSON.stringify(meta, null, 2), 'utf8');

    writeLog(`[实例] 已创建 ${instanceName}（基础版本 ${baseVersionId}，模组 ${mods.length} 个）`);
    return { success: true, versionId: instanceName, created: true };
  } catch (e: any) {
    writeLog(`[实例] 创建 ${requested} 失败: ${e.message}`);
    try { fs.rmSync(path.join(GAME_DIR, 'versions', instanceName), { recursive: true, force: true }); } catch {}
    return { success: false, error: e.message };
  }
}


export function recordInstanceMods(versionId: string, entries: InstanceModEntry[]): void {
  if (!versionId || !entries || entries.length === 0) return;
  const metaPath: string = path.join(GAME_DIR, 'versions', versionId, 'gpcl', 'instance.json');
  if (!fs.existsSync(metaPath)) return;
  try {
    const meta: any = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const mods: InstanceModEntry[] = Array.isArray(meta.mods) ? meta.mods : [];
    for (const entry of entries) {
      if (!entry?.file) continue;
      const existing: InstanceModEntry | undefined = mods.find((mod: InstanceModEntry) => mod.file === entry.file);
      if (existing) Object.assign(existing, entry);
      else mods.push(entry);
    }
    meta.mods = mods;
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  } catch (e: any) {
    writeLog(`[实例] 记录 ${versionId} 的模组失败: ${e.message}`);
  }
}


ipcMain.handle('create-version-instance', (_, options: any) => createVersionInstance(options));
