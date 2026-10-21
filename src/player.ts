/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
// __IMPORTS_END__

export const RECENT_PLAYER_LIMIT: number = 5;


export function playerFilePath(): string {
  return path.join(app.getPath('userData'), 'gpcl', 'player.json');
}


export function readPlayerFile(): { name: string; recent: string[] } {
  const fallback: { name: string; recent: string[] } = { name: 'GPCL_Player', recent: [] };
  try {
    const file: string = playerFilePath();
    if (!fs.existsSync(file)) return fallback;
    const data: any = JSON.parse(fs.readFileSync(file, 'utf8'));
    const name: string = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fallback.name;
    const recent: string[] = Array.isArray(data.recent)
      ? data.recent
        .filter((item: any) => typeof item === 'string' && item.trim())
        .map((item: string) => item.trim())
        .slice(0, RECENT_PLAYER_LIMIT)
      : [];
    return { name, recent };
  } catch (e: any) {
    console.error('读取玩家名失败:', e);
    return fallback;
  }
}


export function writePlayerFile(name: string, recent: string[]): boolean {
  try {
    const gpclDir: string = path.join(app.getPath('userData'), 'gpcl');
    if (!fs.existsSync(gpclDir)) fs.mkdirSync(gpclDir, { recursive: true });
    fs.writeFileSync(playerFilePath(), JSON.stringify({ name, recent }, null, 2));
    return true;
  } catch (e: any) {
    console.error('保存玩家名失败:', e);
    return false;
  }
}


export function pushRecentPlayer(recent: string[], name: string): string[] {
  const rest: string[] = recent.filter((item: string) => item.toLowerCase() !== name.toLowerCase());
  return [name, ...rest].slice(0, RECENT_PLAYER_LIMIT);
}


ipcMain.handle('get-player-name', () => {
  return readPlayerFile().name;
});


ipcMain.handle('get-player-names', () => {
  return readPlayerFile();
});


ipcMain.handle('save-player-name', (_: any, name: string) => {
  const current: { name: string; recent: string[] } = readPlayerFile();
  const clean: string = (name || '').trim() || 'GPCL_Player';
  const recent: string[] = pushRecentPlayer(current.recent, clean);
  writePlayerFile(clean, recent);
  return { name: clean, recent };
});


ipcMain.handle('delete-player-name', (_: any, name: string) => {
  const current: { name: string; recent: string[] } = readPlayerFile();
  const target: string = String(name || '').trim().toLowerCase();
  const recent: string[] = current.recent.filter((item: string) => item.toLowerCase() !== target);
  writePlayerFile(current.name, recent);
  return { name: current.name, recent };
});

