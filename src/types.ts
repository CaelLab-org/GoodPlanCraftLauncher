/**
 * GPCL TypeScript 类型定义
 * 定义 IPC 通道、设置结构、游戏数据等核心类型
 */

// ========== IPC 通道类型 ==========

export interface GPCLApi {
  getGameDir(): Promise<string>;
  scanVersions(gameDir: string, silent?: boolean): Promise<any>;
  launch(options: LaunchOptions): Promise<any>;
  getVersionManifest(): Promise<any>;
  downloadVersion(versionId: string, maxConcurrent: number): Promise<any>;
  onGameLog(callback: (text: string) => void): void;
  onGameClosed(callback: (code: number) => void): void;
  onGameError(callback: (message: string) => void): void;
  onDownloadProgress(callback: (data: DownloadProgress) => void): void;
  onConfirmCloseWhileDownloading(callback: () => void): void;
  getPlayerName(): Promise<string>;
  savePlayerName(name: string): Promise<PlayerNames>;
  getPlayerNames(): Promise<PlayerNames>;
  deletePlayerName(name: string): Promise<PlayerNames>;
  getGameStatus(): Promise<GameStatus>;
  getGameLogTail(): Promise<string>;
  openGameLog(): Promise<any>;
  stopGame(): Promise<any>;
  exportErrorReport(info: CrashInfo | null): Promise<any>;
  onGameStatus(callback: (status: GameStatus) => void): void;
  onGameCrashed(callback: (info: CrashInfo) => void): void;
  showMessageDialog(options: DialogOptions): Promise<any>;
  confirmCloseDownload(): Promise<void>;
  cancelDownloadOnly(): Promise<void>;
  getJavaMirrorSettings(): Promise<any>;
  getJavaDownloadUrl(javaVersion: string): Promise<string>;
  cancelClose(): Promise<void>;
  checkJava(versionId: string): Promise<JavaCheckResult>;
  showJavaInstallDialog(callback: (data: any) => void): void;
  selectJavaVersion(data: any): Promise<any>;
  installJava(javaVersion: string): Promise<any>;
  uninstallJava(javaVersion: string): Promise<any>;
  onJavaInstallDialog(callback: (data: any) => void): void;
  onJavaDownloadCompleted(callback: (data: any) => void): void;
  onJavaDownloadFailed(callback: (data: any) => void): void;
  onGameWindowCreated(callback: (data: any) => void): void;
  minimizeWindow(): Promise<void>;
  focusWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  deleteVersion(versionId: string): Promise<any>;
  getVersionSettings(versionId: string): Promise<any>;
  saveVersionSettings(versionId: string, settings: any): Promise<void>;
  selectDirectory(): Promise<string | null>;
  cancelLaunch(): Promise<void>;
  checkForUpdates(): Promise<any>;
  getAppVersion(): Promise<string>;
  openExternal(url: string): Promise<void>;
  openFolder(folderPath: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  resetSettings(): Promise<void>;
  playStartupAnimation(): Promise<void>;
  dismissStartupAnimation(): Promise<void>;
  setDeveloperMode(enabled: boolean): Promise<void>;
  restartApp(): Promise<void>;
  readJsonFile(subPath: string, fileName: string): Promise<any>;
  writeJsonFile(subPath: string, fileName: string, data: any): Promise<void>;
  selectVersionFolder(): Promise<string | null>;
  selectVersionArchive(): Promise<string | null>;
  installLocalVersion(sourcePath: string): Promise<any>;
  getForgeVersions(mcVersion: string): Promise<any>;
  getFabricVersions(mcVersion: string): Promise<any>;
  getOptiFineVersions(mcVersion: string): Promise<any>;
  downloadWithModLoader(versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number, options?: { installFabricApi?: boolean }): Promise<any>;
  getVersionConfig(versionId: string): Promise<any>;
  getVersionDisplayName(versionId: string): Promise<string>;
  getLaunchDisplayName(versionId: string): Promise<string>;

  modsSearch(options: ModSearchOptions): Promise<any>;
  modsVersions(options: any): Promise<any>;
  modsInstall(options: ModInstallOptions): Promise<any>;
  modsInstallDirect(options: { url: string; fileName: string; targetVersionId?: string; targetDir?: string }): Promise<any>;
  curseforgeLookup(options: { slug: string; gameVersion: string; loader: string; preferGameVersion?: string }): Promise<any>;
  getModsDir(versionId?: string): Promise<string>;
  getVersionInfo(versionId: string): Promise<any>;
  listInstalledVersions(): Promise<any>;
  onModDownloadProgress(callback: (data: any) => void): void;
  onInstallStage(callback: (data: any) => void): void;
  getMemoryUsage(): Promise<number>;
  optimizeMemory(): Promise<{ beforeMB: number; afterMB: number; freedMB: number }>;
  getSystemMemory(): Promise<{ totalMB: number; freeMB: number; autoMemoryMB: number }>;
  getLicenseText(): Promise<string>;
  getRuntimeInfo(): Promise<{ appVersion: string; electron: string; chrome: string; node: string; platform: string }>;
  downloadUpdate(version: string, manual?: boolean): Promise<any>;
  cancelUpdateDownload(): Promise<void>;
  installUpdate(installerPath: string, relaunch: boolean): Promise<any>;
  setUpdateShutdownHook(installerPath: string, relaunch?: boolean): Promise<any>;
  getUpdateState(): Promise<any>;
  onUpdateDownloadProgress(callback: (data: any) => void): void;
  removeAllListeners(): void;

  // Microsoft 正版登录
  startMicrosoftAuth(): Promise<void>;
  onMicrosoftAuthResult(callback: (result: MicrosoftAuthResult) => void): void;
}

// ========== 设置类型 ==========

export interface GameSettings {
  memory: string;
  playerName: string;
  javaPath: string;
  jvmArgs: string;
  gcPreset: string;
  windowMode: string;
  /** 自定义游戏窗口标题，支持 {mc_version} 等魔术字 */
  windowTitle: string;
  keepWindowTitle: boolean;
  processPriority: string;
  launcherVisibility: string;
  windowSize: string;
  windowWidth: number;
  windowHeight: number;
  optimizeBeforeLaunch: boolean;
  /** 启动前把游戏语言改成 language 指定的值 */
  autoLanguage: boolean;
  /** Minecraft 语言代码，如 zh_cn */
  language: string;
}

export interface AppearanceSettings {
  theme: string;
  scale: string;
  playStartupAnimation: boolean;
  skipSplash: boolean;
  /** 启动小知识的出现频率：off / rare / half / always */
  tipFrequency: string;
  enableMore: boolean;
}

export interface DownloadSettings {
  maxConcurrent: number;
  javaMirror: string;
  customJavaMirror: string;
  fileSource: string;
  versionSource: string;
  speedLimit: number;
  /** 自定义游戏目录，留空使用启动器默认目录 */
  installDir: string;
  /** 自定义下载镜像根地址，留空使用 BMCLAPI */
  customFileMirror: string;
  /** CurseForge 官方 API Key，镜像不可用时使用 */
  curseForgeApiKey: string;
}

export interface AdvancedSettings {
  autoCheckUpdate: boolean;
  autoUpdate: boolean;
  preventMultipleLaunch: boolean;
  autoClearLogs: boolean;
  logRetentionValue: number;
  logRetentionUnit: string;
  developerMode: boolean;
}

export interface AppSettings {
  game: GameSettings;
  appearance: AppearanceSettings;
  download: DownloadSettings;
  advanced: AdvancedSettings;
}

// ========== 游戏相关类型 ==========

export interface LaunchOptions {
  versionId: string;
  gameDir: string;
  playerName: string;
  memory: string;
  javaPath?: string;
  jvmArgs?: string;
  windowMode?: string;
  serverIp?: string;
  /** Microsoft 正版认证信息 */
  authUuid?: string;
  authAccessToken?: string;
  authUserType?: string;
}

/** Microsoft 登录结果 */
export interface MicrosoftAuthResult {
  status: 'success' | 'error' | 'pending' | 'timeout';
  uuid?: string;
  username?: string;
  accessToken?: string;
  refreshToken?: string;
  skins?: any[];
  capes?: any[];
  message?: string;
}

export interface DownloadProgress {
  percent: number;
  label?: string;
  transferred?: number;
  total?: number;
}

export interface JavaCheckResult {
  installed: boolean;
  path?: string;
  version?: string;
}

/** 游戏进程运行状态，主进程在游戏存活期间每 2 秒推一次 */
export interface GameStatus {
  running: boolean;
  pid: number | null;
  versionId: string | null;
  username: string | null;
  startedAt: number | null;
  memoryMB: number | null;
  exitCode?: number | null;
}

/** 崩溃判定结果，非零退出码或新出现的崩溃报告都算 */
export interface CrashInfo {
  exitCode: number | null;
  versionId: string | null;
  username: string | null;
  startedAt: number | null;
  durationSec: number | null;
  crashReport: string | null;
  reason: string;
}

/** 玩家名与最近使用过的名字 */
export interface PlayerNames {
  name: string;
  recent: string[];
}

export interface DialogOptions {
  type?: string;
  title?: string;
  message?: string;
  detail?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
  confirmText?: string;
  cancelText?: string;
}

export interface VersionInfo {
  id: string;
  type: string;
  time: string;
}

export interface ModSearchOptions {
  source: 'modrinth' | 'curseforge' | 'both';
  query: string;
  gameVersion: string;
  loader: string;
  offset?: number;
  limit?: number;
}

export interface ModInstallOptions {
  source: 'modrinth' | 'curseforge';
  projectId: string;
  versionId?: string;
  targetVersionId?: string;
  targetDir?: string;
  gameVersion: string;
  loader: string;
}

export interface ModLoaderState {
  forge: { versions: any[]; loading: boolean; error: boolean; expanded: boolean; selected: string | null };
  optifine: { versions: any[]; loading: boolean; error: boolean; expanded: boolean; selected: string | null };
  fabric: { versions: any[]; loading: boolean; error: boolean; expanded: boolean; selected: string | null };
}

// ========== 全局声明 ==========

declare global {
  interface Window {
    gpcl: GPCLApi;
    Chart?: any;
  }
}

export {};
