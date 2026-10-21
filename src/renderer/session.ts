/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
// __IMPORTS_END__

export let GAME_DIR: string | null = null;

export let msAuthData: { uuid: string; username: string; accessToken: string } | null = null;


export async function initGameDir(): Promise<string | null> {
  GAME_DIR = await window.gpcl.getGameDir();
  return GAME_DIR;
}

/** 跨模块写入用：msAuthData 归本模块所有，其它模块只能经此写入 */
export function setMsAuthData(value: { uuid: string; username: string; accessToken: string } | null): void { msAuthData = value; }
