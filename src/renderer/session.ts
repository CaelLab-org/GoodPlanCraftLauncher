/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
// __IMPORTS_END__

export let GAME_DIR: string | null = null;

export let msAuthData: { uuid: string; username: string; accessToken: string } | null = null;


export async function initGameDir(): Promise<string | null> {
  if (!GAME_DIR) {
    GAME_DIR = await window.gpcl.getGameDir();
  }
  return GAME_DIR;
}

/** 跨模块写入用：msAuthData 归本模块所有，其它模块只能经此写入 */
export function setMsAuthData(value: { uuid: string; username: string; accessToken: string } | null): void { msAuthData = value; }
