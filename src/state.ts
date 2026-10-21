/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__

// __IMPORTS_END__

export let isDeveloperMode: boolean = false;


export let isDownloading: boolean = false;

export let currentDownloadVersion: string | null = null;

export let shouldCancelDownload: boolean = false;

export let currentDownloadType: string | null = null;

export let currentDownloadPath: string | null = null;

export let javaDownloadResolve: ((value: any) => void) | null = null;

export let javaDownloadReject: ((reason: any) => void) | null = null;

export let isJavaDownloading: boolean = false;


export let MAX_CONCURRENT: number = 128;

export let downloadQueue: any[] = [];

export let activeDownloads: number = 0;

export let totalDownloadFiles: number = 0;

export let completedDownloadFiles: number = 0;

export let currentDownloadSpeed: number = 0;

/** 跨模块写入用：isDeveloperMode 归本模块所有，其它模块只能经此写入 */
export function setIsDeveloperMode(value: boolean): void { isDeveloperMode = value; }

/** 跨模块写入用：isDownloading 归本模块所有，其它模块只能经此写入 */
export function setIsDownloading(value: boolean): void { isDownloading = value; }

/** 跨模块写入用：currentDownloadVersion 归本模块所有，其它模块只能经此写入 */
export function setCurrentDownloadVersion(value: string | null): void { currentDownloadVersion = value; }

/** 跨模块写入用：shouldCancelDownload 归本模块所有，其它模块只能经此写入 */
export function setShouldCancelDownload(value: boolean): void { shouldCancelDownload = value; }

/** 跨模块写入用：currentDownloadType 归本模块所有，其它模块只能经此写入 */
export function setCurrentDownloadType(value: string | null): void { currentDownloadType = value; }

/** 跨模块写入用：currentDownloadPath 归本模块所有，其它模块只能经此写入 */
export function setCurrentDownloadPath(value: string | null): void { currentDownloadPath = value; }

/** 跨模块写入用：javaDownloadResolve 归本模块所有，其它模块只能经此写入 */
export function setJavaDownloadResolve(value: ((value: any) => void) | null): void { javaDownloadResolve = value; }

/** 跨模块写入用：javaDownloadReject 归本模块所有，其它模块只能经此写入 */
export function setJavaDownloadReject(value: ((reason: any) => void) | null): void { javaDownloadReject = value; }

/** 跨模块写入用：isJavaDownloading 归本模块所有，其它模块只能经此写入 */
export function setIsJavaDownloading(value: boolean): void { isJavaDownloading = value; }

/** 跨模块写入用：MAX_CONCURRENT 归本模块所有，其它模块只能经此写入 */
export function setMaxConcurrent(value: number): void { MAX_CONCURRENT = value; }

/** 跨模块写入用：downloadQueue 归本模块所有，其它模块只能经此写入 */
export function setDownloadQueue(value: any[]): void { downloadQueue = value; }

/** 跨模块写入用：activeDownloads 归本模块所有，其它模块只能经此写入 */
export function setActiveDownloads(value: number): void { activeDownloads = value; }

/** 跨模块写入用：totalDownloadFiles 归本模块所有，其它模块只能经此写入 */
export function setTotalDownloadFiles(value: number): void { totalDownloadFiles = value; }

/** 跨模块写入用：completedDownloadFiles 归本模块所有，其它模块只能经此写入 */
export function setCompletedDownloadFiles(value: number): void { completedDownloadFiles = value; }

/** 跨模块写入用：currentDownloadSpeed 归本模块所有，其它模块只能经此写入 */
export function setCurrentDownloadSpeed(value: number): void { currentDownloadSpeed = value; }
