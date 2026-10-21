/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { GPCLApi } from './types';

const gpclApi: GPCLApi = {
  getGameDir: () => ipcRenderer.invoke('get-game-dir'),
  scanVersions: (gameDir: string, silent?: boolean) => ipcRenderer.invoke('scan-versions', gameDir, silent),
  launch: (options) => ipcRenderer.invoke('launch-minecraft', options),
  getVersionManifest: () => ipcRenderer.invoke('get-version-manifest'),
  downloadVersion: (versionId: string, maxConcurrent: number) => ipcRenderer.invoke('download-version', versionId, maxConcurrent),

  onGameLog: (callback) => {
    ipcRenderer.on('game-log', (_event, text) => callback(text));
  },
  onGameClosed: (callback) => {
    ipcRenderer.on('game-closed', (_event, code) => callback(code));
  },
  onGameError: (callback) => {
    ipcRenderer.on('game-error', (_event, message) => callback(message));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  },
  onConfirmCloseWhileDownloading: (callback) => {
    ipcRenderer.on('confirm-close-while-downloading', () => callback());
  },

  getPlayerName: () => ipcRenderer.invoke('get-player-name'),
  savePlayerName: (name: string) => ipcRenderer.invoke('save-player-name', name),
  getPlayerNames: () => ipcRenderer.invoke('get-player-names'),
  deletePlayerName: (name: string) => ipcRenderer.invoke('delete-player-name', name),

  getGameStatus: () => ipcRenderer.invoke('get-game-status'),
  getGameLogTail: () => ipcRenderer.invoke('get-game-log-tail'),
  openGameLog: (gameDir?: string) => ipcRenderer.invoke('open-game-log', gameDir),
  stopGame: () => ipcRenderer.invoke('stop-game'),
  exportErrorReport: (info) => ipcRenderer.invoke('export-error-report', info),
  analyzeCrash: (info) => ipcRenderer.invoke('analyze-crash', info),
  onGameStatus: (callback) => {
    ipcRenderer.on('game-status', (_event, status) => callback(status));
  },
  onGameCrashed: (callback) => {
    ipcRenderer.on('game-crashed', (_event, info) => callback(info));
  },
  showMessageDialog: (options) => ipcRenderer.invoke('show-message-dialog', options),
  confirmCloseDownload: () => ipcRenderer.invoke('confirm-close-download'),
  cancelDownloadOnly: () => ipcRenderer.invoke('cancel-download-only'),
  getJavaMirrorSettings: () => ipcRenderer.invoke('get-java-mirror-settings'),
  getJavaDownloadUrl: (javaVersion: string) => ipcRenderer.invoke('get-java-download-url', javaVersion),
  cancelClose: () => ipcRenderer.invoke('cancel-close'),
  checkJava: (versionId: string) => ipcRenderer.invoke('check-java', versionId),

  showJavaInstallDialog: (callback) => {
    ipcRenderer.on('show-java-install-dialog', (_event, data) => callback(data));
  },
  selectJavaVersion: (data) => ipcRenderer.invoke('select-java-version', data),
  installJava: (javaVersion: string) => ipcRenderer.invoke('install-java', javaVersion),
  uninstallJava: (javaVersion: string) => ipcRenderer.invoke('uninstall-java', javaVersion),

  onJavaInstallDialog: (callback) => {
    ipcRenderer.on('show-java-install-dialog', (_event, data) => callback(data));
  },
  onJavaDownloadCompleted: (callback) => {
    ipcRenderer.on('java-download-completed', (_event, data) => callback(data));
  },
  onJavaDownloadFailed: (callback) => {
    ipcRenderer.on('java-download-failed', (_event, data) => callback(data));
  },
  onGameWindowCreated: (callback) => {
    ipcRenderer.on('game-window-created', (_event, data) => callback(data));
  },

  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  focusWindow: () => ipcRenderer.invoke('window-focus'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  deleteVersion: (versionId: string) => ipcRenderer.invoke('delete-version', versionId),
  getVersionSettings: (versionId: string) => ipcRenderer.invoke('get-version-settings', versionId),
  saveVersionSettings: (versionId: string, settings: any) => ipcRenderer.invoke('save-version-settings', versionId, settings),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  cancelLaunch: () => ipcRenderer.invoke('cancel-launch'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  playStartupAnimation: () => ipcRenderer.invoke('play-startup-animation'),
  dismissStartupAnimation: () => ipcRenderer.invoke('dismiss-startup-animation'),
  setDeveloperMode: (enabled: boolean) => ipcRenderer.invoke('set-developer-mode', enabled),
  restartApp: () => ipcRenderer.invoke('restart-app'),

  readJsonFile: (subPath: string, fileName: string) => ipcRenderer.invoke('read-json-file', subPath, fileName),
  writeJsonFile: (subPath: string, fileName: string, data: any) => ipcRenderer.invoke('write-json-file', subPath, fileName, data),

  selectVersionFolder: () => ipcRenderer.invoke('select-version-folder'),
  selectVersionArchive: () => ipcRenderer.invoke('select-version-archive'),
  installLocalVersion: (sourcePath: string) => ipcRenderer.invoke('install-local-version', sourcePath),
  getForgeVersions: (mcVersion: string) => ipcRenderer.invoke('get-forge-versions', mcVersion),
  getFabricVersions: (mcVersion: string) => ipcRenderer.invoke('get-fabric-versions', mcVersion),
  getNeoForgeVersions: (mcVersion: string) => ipcRenderer.invoke('get-neoforge-versions', mcVersion),
  getOptiFineVersions: (mcVersion: string) => ipcRenderer.invoke('get-optifine-versions', mcVersion),
  downloadWithModLoader: (versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number, options?: any) =>
    ipcRenderer.invoke('download-with-modloader', versionId, loaderType, loaderVersion, maxConcurrent, options),

  getVersionConfig: (versionId: string) => ipcRenderer.invoke('get-version-config', versionId),
  getVersionDisplayName: (versionId: string) => ipcRenderer.invoke('get-version-display-name', versionId),
  getLaunchDisplayName: (versionId: string) => ipcRenderer.invoke('get-launch-display-name', versionId),

  modsSearch: (options) => ipcRenderer.invoke('mods-search', options),
  modsVersions: (options) => ipcRenderer.invoke('mods-versions', options),
  modsProjectInfo: (options) => ipcRenderer.invoke('mods-project-info', options),
  modsInstall: (options) => ipcRenderer.invoke('mods-install', options),
  modsInstallDirect: (options) => ipcRenderer.invoke('mods-install-direct', options),
  modpackInstall: (options) => ipcRenderer.invoke('modpack-install', options),
  curseforgeLookup: (options) => ipcRenderer.invoke('mods-curseforge-lookup', options),
  getModsDir: (versionId?: string) => ipcRenderer.invoke('get-mods-dir', versionId),
  getVersionInfo: (versionId: string) => ipcRenderer.invoke('get-version-info', versionId),
  listInstalledVersions: () => ipcRenderer.invoke('list-installed-versions'),
  onModDownloadProgress: (callback) => {
    ipcRenderer.on('mod-download-progress', (_event, data) => callback(data));
  },
  onInstallStage: (callback) => {
    ipcRenderer.on('install-stage', (_event, data) => callback(data));
  },

  getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),
  optimizeMemory: () => ipcRenderer.invoke('optimize-memory'),
  getSystemMemory: () => ipcRenderer.invoke('get-system-memory'),
  getLicenseText: () => ipcRenderer.invoke('get-license-text'),
  getRuntimeInfo: () => ipcRenderer.invoke('get-runtime-info'),

  downloadUpdate: (version: string, manual?: boolean) => ipcRenderer.invoke('download-update', version, !!manual),
  cancelUpdateDownload: () => ipcRenderer.invoke('cancel-update-download'),
  installUpdate: (installerPath: string, relaunch: boolean) => ipcRenderer.invoke('install-update', installerPath, relaunch),
  setUpdateShutdownHook: (installerPath: string, relaunch?: boolean) => ipcRenderer.invoke('set-update-shutdown-hook', installerPath, !!relaunch),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),

  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, data) => callback(data));
  },

  /**
   * 只清「每次启动 / 下载时都会重新注册」的这几个通道（它们的注册点在函数里，会越挂越多）。
   * 其余通道（game-log / game-closed / game-status / game-crashed / java-download-* /
   * microsoft-auth-result 等）在渲染层是模块加载时注册一次的，被清掉就再也没人补回来 ——
   * 表现是关掉游戏后面板一直显示「运行中」、启动过一次之后再登录正版没有反应。别加进来。
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('confirm-close-while-downloading');
    ipcRenderer.removeAllListeners('game-window-created');
    ipcRenderer.removeAllListeners('update-download-progress');
    // download-progress 在 launch / java-panel 里只在启动时注册一次，清掉就没人补回来
  },

  startMicrosoftAuth: () => ipcRenderer.invoke('start-microsoft-auth'),
  onMicrosoftAuthResult: (callback) => {
    ipcRenderer.on('microsoft-auth-result', (_event, result) => callback(result));
  },
};

contextBridge.exposeInMainWorld('gpcl', gpclApi);

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const key = (e.key || '').toLowerCase();
  if (
    key === 'f12' ||
    (e.ctrlKey && e.shiftKey && key === 'i') ||
    (e.metaKey && e.altKey && key === 'i')
  ) {
    e.preventDefault();
  }
}, { capture: true });

window.addEventListener('contextmenu', (e: Event) => {
  e.preventDefault();
}, { capture: true });
