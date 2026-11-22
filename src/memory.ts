/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

import { loadSettings, writeLog } from './config';
import { getLauncherWorkingSetMB, trimWorkingSets } from './shell';
import { isDownloading, isJavaDownloading } from './state';

// 自动内存管理（自动调度）：GPCL 开着不动时工作集会慢慢涨到 100~200MB，
// 定期回收能压回 35~70MB。每 30 秒看一次，超过 80MB 且距上次回收满 3 分钟才动手，
// 避免频繁拉起 PowerShell。下载期间跳过，别和正在活跃的读写抢页面。
const CHECK_INTERVAL_MS: number = 30_000;
const TRIGGER_MB: number = 80;
const MIN_TRIM_INTERVAL_MS: number = 180_000;

let timer: NodeJS.Timeout | null = null;
let trimming: boolean = false;
let lastTrimAt: number = 0;

function autoMemoryEnabled(): boolean {
  try {
    return loadSettings().game?.autoMemoryManage !== false;
  } catch {
    return true;
  }
}

async function tick(): Promise<void> {
  if (trimming || !autoMemoryEnabled()) return;
  if (isDownloading || isJavaDownloading) return;
  if (getLauncherWorkingSetMB() < TRIGGER_MB) return;

  const now: number = Date.now();
  if (now - lastTrimAt < MIN_TRIM_INTERVAL_MS) return;

  trimming = true;
  lastTrimAt = now;
  try {
    const result = await trimWorkingSets();
    writeLog(`[内存自动管理] 工作集 ${result.beforeMB}MB -> ${result.afterMB}MB，回收 ${result.freedMB}MB`);
  } catch (e: any) {
    writeLog(`[内存自动管理] 回收失败: ${e.message}`);
  } finally {
    trimming = false;
  }
}

export function startAutoMemoryManager(): void {
  if (process.platform !== 'win32') return;
  if (timer) return;
  writeLog(`[内存自动管理] 已启动（每 ${CHECK_INTERVAL_MS / 1000} 秒检查，超过 ${TRIGGER_MB}MB 且空闲时回收）`);
  timer = setInterval(() => { void tick(); }, CHECK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}
