/**
 * GPCL TypeScript 类型定义
 * 定义 IPC 通道、设置结构、游戏数据等核心类型
 */

// ========== IPC 通道类型 ==========

export interface GPCLApi {
  initialI18n: { locale: string; dir: string; systemLocale: string; firstRun: boolean; theme: string; style: string; scale: string; skipSplash: boolean; platform: string };
  getGameDir(): Promise<string>;
  getGameDirs(): Promise<{ success: boolean; dirs: GameDirEntry[]; installDir: string }>;
  addGameDir(dir: string): Promise<{ success: boolean; path: string; dirs: GameDirEntry[]; installDir: string }>;
  removeGameDir(dir: string): Promise<{ success: boolean; dirs: GameDirEntry[]; installDir: string }>;
  scanVersions(gameDir: string, silent?: boolean): Promise<any>;
  scanVersionEntries(gameDir?: string, silent?: boolean): Promise<VersionEntry[]>;
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
  openGameLog(gameDir?: string): Promise<any>;
  stopGame(): Promise<any>;
  exportErrorReport(info: CrashInfo | null): Promise<any>;
  analyzeCrash(info: CrashInfo | null): Promise<any>;
  onGameStatus(callback: (status: GameStatus) => void): void;
  onGameCrashed(callback: (info: CrashInfo) => void): void;
  showMessageDialog(options: DialogOptions): Promise<any>;
  confirmCloseDownload(): Promise<void>;
  cancelDownloadOnly(): Promise<void>;
  getJavaMirrorSettings(): Promise<any>;
  getJavaDownloadUrl(javaVersion: string): Promise<string>;
  cancelClose(): Promise<void>;
  checkJava(versionId: string): Promise<JavaCheckResult>;
  listJavaRuntimes(): Promise<JavaRuntimeInfo[]>;
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
  getWindowState(): Promise<{ maximized: boolean; fullScreen: boolean }>;
  onWindowState(callback: (state: { maximized: boolean; fullScreen: boolean }) => void): void;
  createVersionInstance(options: { baseVersionId: string; name: string; loaderType?: string; loaderVersion?: string }): Promise<any>;
  deleteVersion(versionId: string, root?: string): Promise<any>;
  getVersionSettings(versionId: string, root?: string): Promise<any>;
  saveVersionSettings(versionId: string, settings: any, root?: string): Promise<void>;
  selectDirectory(): Promise<string | null>;
  cancelLaunch(): Promise<void>;
  checkForUpdates(locale?: string): Promise<any>;
  getAppVersion(): Promise<string>;
  openExternal(url: string): Promise<void>;
  openFolder(folderPath: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  resetSettings(): Promise<void>;
  setLanguage(code: string): Promise<{ success: boolean; locale: string }>;
  getI18nInfo(): Promise<{ locale: string; systemLocale: string; firstRun: boolean }>;
  completeWelcome(): Promise<{ success: boolean }>;
  getAvatar(): Promise<{ success: boolean; path: string; url: string }>;
  chooseAvatar(): Promise<{ success: boolean; cancelled?: boolean; error?: string; url?: string; compressed?: boolean }>;
  resetAvatar(): Promise<{ success: boolean; error?: string }>;
  setDeveloperMode(enabled: boolean): Promise<void>;
  restartApp(): Promise<void>;
  readJsonFile(subPath: string, fileName: string): Promise<any>;
  writeJsonFile(subPath: string, fileName: string, data: any): Promise<void>;
  selectVersionFolder(): Promise<string | null>;
  selectVersionArchive(): Promise<string | null>;
  installLocalVersion(sourcePath: string): Promise<any>;
  getForgeVersions(mcVersion: string): Promise<any>;
  getFabricVersions(mcVersion: string): Promise<any>;
  getNeoForgeVersions(mcVersion: string): Promise<any>;
  getOptiFineVersions(mcVersion: string): Promise<any>;
  downloadWithModLoader(versionId: string, loaderType: string, loaderVersion: string, maxConcurrent: number, options?: { installFabricApi?: boolean }): Promise<any>;
  getVersionConfig(versionId: string, root?: string): Promise<any>;
  getVersionDisplayName(versionId: string, root?: string): Promise<string>;
  getLaunchDisplayName(versionId: string, root?: string): Promise<string>;

  modsSearch(options: ModSearchOptions): Promise<any>;
  getModSources(): Promise<any>;
  modsVersions(options: any): Promise<any>;
  modsProjectInfo(options: { source: string; ids: string[]; gameVersion: string; loader: string }): Promise<any>;
  modsInstall(options: ModInstallOptions): Promise<any>;
  modsInstallDirect(options: { url: string; fileName: string; targetVersionId?: string; versionRoot?: string; targetDir?: string; projectType?: ResourceProjectType }): Promise<any>;
  modpackInstall(options: { source: string; projectId: string; versionId?: string; gameVersion?: string; instanceName?: string; maxConcurrent?: number }): Promise<any>;
  curseforgeLookup(options: { slug: string; gameVersion: string; loader: string; preferGameVersion?: string }): Promise<any>;
  getModsDir(versionId?: string, root?: string): Promise<string>;
  getVersionInfo(versionId: string, root?: string): Promise<any>;
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
  cancelMicrosoftAuth(): Promise<void>;
  openMicrosoftAuthBrowser(): Promise<{ success: boolean; message?: string }>;
  getMicrosoftAuth(): Promise<MicrosoftAuthResult>;
  logoutMicrosoftAuth(): Promise<{ success: boolean }>;
  listMicrosoftAccounts(): Promise<{ current: string | null; accounts: { uuid: string; username: string; expiresAt?: number }[] }>;
  switchMicrosoftAccount(uuid: string): Promise<MicrosoftAuthResult>;
  removeMicrosoftAccount(uuid: string): Promise<{ success: boolean; current: string | null; accounts: { uuid: string; username: string; expiresAt?: number }[] }>;
  getMicrosoftAvatar(uuid: string, refresh?: boolean): Promise<{ dataUrl: string | null; width: number; height: number }>;
  refreshMicrosoftAuth(): Promise<MicrosoftAuthResult>;
  validateMicrosoftAuth(): Promise<{ valid: boolean; relogin?: boolean; unchecked?: boolean; uuid?: string; username?: string; accessToken?: string; expiresAt?: number; code?: string; message?: string }>;
  mcServerBind(code: string): Promise<{ success: boolean; code?: string; offlineName?: string; premiumName?: string; message?: string }>;
  onMicrosoftAuthResult(callback: (result: MicrosoftAuthResult) => void): void;
}

// ========== 设置类型 ==========

export interface GeneralSettings {
  /** 'auto' 跟随系统，其余为语言代码 */
  language: string;
  welcomeSeen?: boolean;
}

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
  /** 新安装版本的默认隔离方式：off / modded / nonRelease / moddedAndNonRelease / all */
  versionIsolation: string;
  /** CaelLabMinecraft 集成：显示绑定入口，启动正版游戏时向其报备以免密钥进服 */
  caellabIntegration: boolean;
}

export interface AppearanceSettings {
  theme: string;
  /** 界面风格：mc / advanced / minimal */
  style: string;
  scale: string;
  skipSplash: boolean;
  /** 启动小知识的出现频率：off / rare / half / always */
  tipFrequency: string;
  enableMore: boolean;
  avatarSize: number;
}

export interface DownloadSettings {
  maxConcurrent: number;
  javaMirror: string;
  customJavaMirror: string;
  fileSource: string;
  versionSource: string;
  speedLimit: number;
  /** 速度显示单位：mbps / mbs */
  speedUnit: string;
  /** 自定义游戏目录（新下载写到这里），留空使用启动器默认目录 */
  installDir: string;
  /** 额外添加的游戏目录（JSON 字符串数组），版本选择里可以按目录筛选 */
  gameDirs: string;
  /** 自定义下载镜像根地址，留空使用 BMCLAPI */
  customFileMirror: string;
  /** CurseForge 官方 API Key，镜像不可用时使用 */
  curseForgeApiKey: string;
  /** 是否启用中文模组名 → 英文名映射 */
  modNameMapping: boolean;
  /** 启用的映射来源，逗号分隔：mcmod,130wiki */
  modNameProviders: string;
  /** 自定义词表地址（JSON 字符串数组，支持 URL 和本地路径） */
  modNameDictionaries: string;
  /** 自定义模组源（JSON 字符串数组） */
  modSources: string;
}

export interface CustomModSource {
  id: string;
  name: string;
  kind: 'modrinth' | 'curseforge';
  baseUrl: string;
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
  general: GeneralSettings;
  game: GameSettings;
  appearance: AppearanceSettings;
  download: DownloadSettings;
  advanced: AdvancedSettings;
}

// ========== 游戏相关类型 ==========

export interface LaunchOptions {
  versionId: string;
  gameDir: string;
  playerName?: string;
  username?: string;
  memory?: string;
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
  expiresAt?: number;
  skins?: any[];
  capes?: any[];
  code?: string;
  relogin?: boolean;
  message?: string;
}

export interface GameDirEntry {
  path: string;
  name: string;
  isDefault: boolean;
  isInstall: boolean;
}

export interface VersionEntry {
  id: string;
  root: string;
  name: string;
  isDefault: boolean;
  isInstall: boolean;
}

export interface JavaRuntimeInfo {
  major: string;
  path: string;
  custom?: boolean;
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
  versionName?: string;
  username: string | null;
  startedAt: number | null;
  durationSec: number | null;
  crashReport: string | null;
  reason: string;
  /** 崩溃现场快照：导出报告时当前会话可能已经被清掉了 */
  gameDir?: string;
  javaPath?: string | null;
  args?: string[];
  output?: string;
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

export type ResourceProjectType = 'mod' | 'shader' | 'resourcepack' | 'modpack';

export interface ModSearchOptions {
  source: string;
  query: string;
  gameVersion: string;
  loader: string;
  projectType?: ResourceProjectType;
  offset?: number;
  limit?: number;
}

export interface ModInstallOptions {
  source: string;
  projectId: string;
  versionId?: string;
  targetVersionId?: string;
  versionRoot?: string;
  targetDir?: string;
  gameVersion: string;
  loader: string;
  projectType?: ResourceProjectType;
}

export interface ModLoaderState {
  forge: { versions: any[]; loading: boolean; error: boolean; expanded: boolean; selected: string | null };
  neoforge: { versions: any[]; loading: boolean; error: boolean; expanded: boolean; selected: string | null };
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
