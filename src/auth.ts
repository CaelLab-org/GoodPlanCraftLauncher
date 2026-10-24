// __IMPORTS_BEGIN__
import { ipcMain, safeStorage, shell } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

import { BASE_DIR, writeLog } from './config';
import { t } from './i18n';
import { mainWindow } from './shell';
// __IMPORTS_END__

export const AUTH_BASE = 'https://api.caellab.com/gamets/gpcl/auth';

export const AUTH_POLL_INTERVAL = 1000;

export const AUTH_TIMEOUT = 300000;

interface StoredMicrosoftAuth {
  uuid: string;
  username: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface AuthStore {
  version: 2;
  current: string | null;
  accounts: StoredMicrosoftAuth[];
}

let activePollTimer: ReturnType<typeof setInterval> | null = null;
let activeAuthResolve: (() => void) | null = null;
let activeAuthStartUrl: string | null = null;
let authSettled: boolean = false;

interface SkinResult {
  dataUrl: string | null;
  width: number;
  height: number;
}

const skinMemoryCache: Map<string, SkinResult> = new Map();

function authStorePath(): string {
  return path.join(BASE_DIR, 'gpcl', 'users', 'msa.json');
}

function normalizeUuid(uuid: string): string {
  return String(uuid || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
}

function sanitizeAccount(entry: any): StoredMicrosoftAuth | null {
  if (!entry?.uuid || !entry?.username || !entry?.accessToken) return null;
  return {
    uuid: String(entry.uuid),
    username: String(entry.username),
    accessToken: String(entry.accessToken),
    refreshToken: entry.refreshToken ? String(entry.refreshToken) : undefined,
    expiresAt: Number(entry.expiresAt) || undefined
  };
}

function writeAuthStore(store: AuthStore): void {
  try {
    const file: string = authStorePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text: string = JSON.stringify(store);
    let payload: any;
    if (safeStorage.isEncryptionAvailable()) {
      payload = { version: 2, encrypted: true, data: safeStorage.encryptString(text).toString('base64') };
    } else {
      payload = { version: 2, encrypted: false, data: text };
    }
    fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  } catch (e: any) {
    writeLog(`[正版登录] 保存登录信息失败: ${e.message}`);
  }
}

function readAuthStore(): AuthStore {
  const empty: AuthStore = { version: 2, current: null, accounts: [] };
  try {
    const file: string = authStorePath();
    if (!fs.existsSync(file)) return empty;
    const payload: any = JSON.parse(fs.readFileSync(file, 'utf8'));
    let text: string = '';
    if (payload?.encrypted === true) {
      if (!safeStorage.isEncryptionAvailable()) return empty;
      text = safeStorage.decryptString(Buffer.from(String(payload.data || ''), 'base64'));
    } else {
      text = String(payload?.data || '');
    }
    const parsed: any = JSON.parse(text);

    // 1.x 只存一个账号；读到旧格式就顺手升成多账号结构，别让玩家重登。
    if (parsed && !Array.isArray(parsed.accounts)) {
      const legacy: StoredMicrosoftAuth | null = sanitizeAccount(parsed);
      if (!legacy) return empty;
      const migrated: AuthStore = { version: 2, current: legacy.uuid, accounts: [legacy] };
      writeAuthStore(migrated);
      return migrated;
    }

    const accounts: StoredMicrosoftAuth[] = Array.isArray(parsed?.accounts)
      ? parsed.accounts.map(sanitizeAccount).filter(Boolean) as StoredMicrosoftAuth[]
      : [];
    const current: string = String(parsed?.current || '');
    const currentAccount: StoredMicrosoftAuth | undefined = accounts.find(
      (item) => normalizeUuid(item.uuid) === normalizeUuid(current)
    );
    return { version: 2, current: currentAccount ? currentAccount.uuid : null, accounts };
  } catch (e: any) {
    writeLog(`[正版登录] 读取登录信息失败: ${e.message}`);
    return empty;
  }
}

function writeStoredAuth(auth: StoredMicrosoftAuth): void {
  const store: AuthStore = readAuthStore();
  const key: string = normalizeUuid(auth.uuid);
  const rest: StoredMicrosoftAuth[] = store.accounts.filter((item) => normalizeUuid(item.uuid) !== key);
  store.accounts = [auth, ...rest];
  store.current = auth.uuid;
  writeAuthStore(store);
}

function readStoredAuth(): StoredMicrosoftAuth | null {
  const store: AuthStore = readAuthStore();
  if (!store.current) return null;
  return store.accounts.find((item) => normalizeUuid(item.uuid) === normalizeUuid(store.current)) || null;
}

function clearStoredAuth(): void {
  const store: AuthStore = readAuthStore();
  if (!store.current) return;
  store.current = null;
  writeAuthStore(store);
}

function removeStoredAccount(uuid: string): void {
  const store: AuthStore = readAuthStore();
  const key: string = normalizeUuid(uuid);
  store.accounts = store.accounts.filter((item) => normalizeUuid(item.uuid) !== key);
  if (store.current && normalizeUuid(store.current) === key) store.current = null;
  writeAuthStore(store);
}

function listStoredAccounts(): any {
  const store: AuthStore = readAuthStore();
  return {
    current: store.current,
    accounts: store.accounts.map((item) => ({
      uuid: item.uuid,
      username: item.username,
      expiresAt: item.expiresAt
    }))
  };
}

function requestJson(url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
} = {}): Promise<{ status: number; json: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers,
      timeout: options.timeout || 15000
    }, (resp) => {
      let raw: string = '';
      resp.on('data', (chunk: Buffer) => raw += chunk.toString('utf8'));
      resp.on('end', () => {
        let json: any = null;
        try { json = raw ? JSON.parse(raw) : null; } catch {}
        resolve({ status: resp.statusCode || 0, json, raw });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function stopAuthPolling(): void {
  if (activePollTimer) {
    clearInterval(activePollTimer);
    activePollTimer = null;
  }
  if (activeAuthResolve) {
    const resolve = activeAuthResolve;
    activeAuthResolve = null;
    resolve();
  }
  activeAuthStartUrl = null;
}

function sendAuthResult(result: any): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const payload: any = { ...result };
  delete payload.refreshToken;
  mainWindow.webContents.send('microsoft-auth-result', payload);
}

function settleAuth(result: any): void {
  if (authSettled) return;
  authSettled = true;
  sendAuthResult(result);
  stopAuthPolling();
}

async function refreshAccount(stored: StoredMicrosoftAuth): Promise<any> {
  if (!stored.refreshToken) {
    return { status: 'error', code: 'relogin_required', message: t('ui.auth_login_required') };
  }

  try {
    const response = await requestJson(`${AUTH_BASE}/refresh.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
      timeout: 30000
    });
    const result: any = response.json;
    if (result?.status === 'success' && result.accessToken) {
      return {
        status: 'success',
        uuid: String(result.uuid || stored.uuid),
        username: String(result.username || stored.username),
        accessToken: String(result.accessToken),
        refreshToken: result.refreshToken ? String(result.refreshToken) : stored.refreshToken,
        expiresAt: Number(result.expiresAt) || Date.now() + 24 * 60 * 60 * 1000
      };
    }
    const code: string = String(result?.code || 'refresh_failed');
    writeLog(`[正版登录] 刷新失败: ${code} ${result?.message || response.status}`);
    return {
      status: 'error',
      code,
      relogin: code === 'relogin_required' || response.status === 401,
      message: String(result?.message || t('ui.auth_refresh_failed'))
    };
  } catch (e: any) {
    writeLog(`[正版登录] 刷新请求失败: ${e.message}`);
    return { status: 'error', code: 'network', message: t('ui.auth_refresh_network') };
  }
}

async function refreshMicrosoftSession(): Promise<any> {
  const stored: StoredMicrosoftAuth | null = readStoredAuth();
  if (!stored) {
    return { status: 'error', code: 'not_signed_in', message: t('ui.auth_no_account') };
  }

  const result: any = await refreshAccount(stored);
  if (result.status === 'success') {
    writeStoredAuth({
      uuid: result.uuid,
      username: result.username,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt
    });
    writeLog('[正版登录] 登录凭据已刷新');
  }
  return result;
}

async function validateMicrosoftSession(): Promise<any> {
  let stored: StoredMicrosoftAuth | null = readStoredAuth();
  if (!stored) {
    return { valid: false, code: 'not_signed_in', message: t('ui.auth_no_account') };
  }

  // 快过期就先续期，别等玩家点进服务器才被 sessionserver 403 挡回来。
  if (stored.expiresAt && stored.expiresAt - Date.now() < 10 * 60 * 1000) {
    const early: any = await refreshMicrosoftSession();
    if (early.status === 'success') {
      stored = {
        uuid: String(early.uuid || stored.uuid),
        username: String(early.username || stored.username),
        accessToken: String(early.accessToken),
        refreshToken: early.refreshToken ? String(early.refreshToken) : stored.refreshToken,
        expiresAt: Number(early.expiresAt) || stored.expiresAt
      };
    } else if (!stored.expiresAt || stored.expiresAt <= Date.now() + 60 * 1000) {
      return { valid: false, relogin: early.relogin !== false, code: early.code, message: early.message };
    }
  }

  if (stored.expiresAt && stored.expiresAt - Date.now() > 10 * 60 * 1000) {
    return {
      valid: true,
      uuid: stored.uuid,
      username: stored.username,
      accessToken: stored.accessToken,
      expiresAt: stored.expiresAt
    };
  }

  const checkProfile = async (accessToken: string): Promise<{ status: number; json: any }> => {
    const response = await requestJson('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 12000
    });
    return { status: response.status, json: response.json };
  };

  try {
    const profile = await checkProfile(stored.accessToken);
    if (profile.status === 200 && profile.json?.id) {
      return {
        valid: true,
        uuid: String(profile.json.id).replace(/-/g, ''),
        username: String(profile.json.name || stored.username),
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt
      };
    }
    if (profile.status !== 401 && profile.status !== 403) {
      return { valid: true, unchecked: true, accessToken: stored.accessToken, uuid: stored.uuid, username: stored.username };
    }
  } catch (e: any) {
    // 网络不好时不要直接把玩家踢回离线模式，照旧启动，失败由游戏自己报
    writeLog(`[正版登录] 校验请求失败: ${e.message}`);
    return { valid: true, unchecked: true, accessToken: stored.accessToken, uuid: stored.uuid, username: stored.username };
  }

  const refreshed: any = await refreshMicrosoftSession();
  if (refreshed.status !== 'success') {
    return {
      valid: false,
      relogin: refreshed.relogin !== false,
      code: refreshed.code,
      message: refreshed.message
    };
  }

  try {
    const profile = await checkProfile(refreshed.accessToken);
    if (profile.status === 200 && profile.json?.id) {
      return {
        valid: true,
        uuid: String(profile.json.id).replace(/-/g, ''),
        username: String(profile.json.name || refreshed.username),
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt
      };
    }
  } catch (e: any) {
    writeLog(`[正版登录] 刷新后校验失败: ${e.message}`);
    return { valid: true, unchecked: true, accessToken: refreshed.accessToken, uuid: refreshed.uuid, username: refreshed.username };
  }

  return { valid: false, relogin: true, code: 'profile_failed', message: t('ui.auth_session_invalid') };
}

function downloadBinary(url: string, redirects: number = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (resp) => {
      const status: number = resp.statusCode || 0;
      if (status >= 300 && status < 400 && resp.headers.location && redirects > 0) {
        resp.resume();
        const next: string = new URL(String(resp.headers.location), url).toString().replace(/^http:/, 'https:');
        resolve(downloadBinary(next, redirects - 1));
        return;
      }
      if (status !== 200) {
        resp.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      const chunks: Buffer[] = [];
      resp.on('data', (chunk: Buffer) => chunks.push(chunk));
      resp.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
  });
}

function skinFilePath(uuid: string): string {
  return path.join(BASE_DIR, 'gpcl', 'users', 'skins', `${normalizeUuid(uuid)}.png`);
}

function skinResult(buffer: Buffer): SkinResult {
  const width: number = buffer.length >= 24 ? buffer.readUInt32BE(16) : 64;
  const height: number = buffer.length >= 24 ? buffer.readUInt32BE(20) : 64;
  return {
    dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    width,
    height
  };
}

/**
 * 取账号的真实皮肤头像。Mojang 的会话服务器不需要登录凭据，按 UUID 就能拿到皮肤地址；
 * 下载后缓存在本地，换皮肤时用 refresh 强制重下。
 */
async function fetchAccountSkin(uuid: string, refresh: boolean = false): Promise<SkinResult> {
  const missing: SkinResult = { dataUrl: null, width: 64, height: 64 };
  const key: string = normalizeUuid(uuid);
  if (!key) return missing;
  if (!refresh && skinMemoryCache.has(key)) return skinMemoryCache.get(key) || missing;

  const file: string = skinFilePath(key);
  if (!refresh && fs.existsSync(file)) {
    try {
      const cached: SkinResult = skinResult(fs.readFileSync(file));
      skinMemoryCache.set(key, cached);
      return cached;
    } catch {}
  }

  try {
    const profile = await requestJson(`https://sessionserver.mojang.com/session/minecraft/profile/${key}`, { timeout: 12000 });
    const textures: any = Array.isArray(profile.json?.properties)
      ? profile.json.properties.find((item: any) => item?.name === 'textures')
      : null;
    if (!textures?.value) {
      skinMemoryCache.set(key, missing);
      return missing;
    }
    const decoded: any = JSON.parse(Buffer.from(String(textures.value), 'base64').toString('utf8'));
    const rawUrl: string = String(decoded?.textures?.SKIN?.url || '');
    if (!rawUrl) {
      skinMemoryCache.set(key, missing);
      return missing;
    }
    const skinUrl: string = rawUrl.replace(/^http:/, 'https:');
    const buffer: Buffer = await downloadBinary(skinUrl);
    if (buffer.length < 24 || buffer[0] !== 0x89 || buffer.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error('not a png');
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    const result: SkinResult = skinResult(buffer);
    skinMemoryCache.set(key, result);
    return result;
  } catch (e: any) {
    writeLog(`[正版登录] 获取皮肤失败: ${e.message}`);
    skinMemoryCache.set(key, missing);
    return missing;
  }
}

ipcMain.handle('start-microsoft-auth', async () => {
  stopAuthPolling();
  authSettled = false;
  try {
    const state: string = crypto.randomBytes(32).toString('hex');
    const startUrl: string = `${AUTH_BASE}/start.php?state=${state}`;
    const resultUrl: string = `${AUTH_BASE}/result.php?state=${state}`;

    writeLog(`[正版登录] 开始认证, state=${state}`);
    activeAuthStartUrl = startUrl;
    await shell.openExternal(startUrl);

    const startedAt: number = Date.now();
    return await new Promise<void>((resolve) => {
      activeAuthResolve = resolve;
      activePollTimer = setInterval(async (): Promise<void> => {
        if (Date.now() - startedAt > AUTH_TIMEOUT) {
          writeLog('[正版登录] 超时');
          settleAuth({ status: 'timeout', message: t('ui.sign_in_timed_out') });
          return;
        }

        try {
          const response = await requestJson(resultUrl, { timeout: 8000 });
          const result: any = response.json;
          if (!result || result.status === 'pending') return;

          if (result.status === 'success' && result.accessToken && result.uuid && result.username) {
            writeStoredAuth({
              uuid: String(result.uuid),
              username: String(result.username),
              accessToken: String(result.accessToken),
              refreshToken: result.refreshToken ? String(result.refreshToken) : undefined,
              expiresAt: Number(result.expiresAt) || Date.now() + 24 * 60 * 60 * 1000
            });
            writeLog(`[正版登录] 登录成功: ${result.username}`);
            settleAuth(result);
            return;
          }

          if (result.status === 'error') {
            writeLog(`[正版登录] 登录失败: ${result.code || ''} ${result.message || ''}`);
            settleAuth(result);
            return;
          }
        } catch (e: any) {
          writeLog(`[正版登录] 轮询请求失败: ${e.message}`);
        }
      }, AUTH_POLL_INTERVAL);
    });
  } catch (e: any) {
    writeLog(`[正版登录] 启动失败: ${e.message}`);
    activeAuthStartUrl = null;
    sendAuthResult({ status: 'error', code: 'start_failed', message: t('ui.auth_start_failed', { error: e.message }) });
  }
});

ipcMain.handle('cancel-microsoft-auth', () => {
  settleAuth({ status: 'error', code: 'cancelled', message: t('ui.sign_in_cancelled') });
});

ipcMain.handle('open-microsoft-auth-browser', async () => {
  if (!activeAuthStartUrl) return { success: false };
  try {
    await shell.openExternal(activeAuthStartUrl);
    return { success: true };
  } catch (e: any) {
    writeLog(`[正版登录] 重新打开浏览器失败: ${e.message}`);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-microsoft-auth', () => {
  const stored: StoredMicrosoftAuth | null = readStoredAuth();
  if (!stored) return { status: 'none' };
  return {
    status: 'success',
    uuid: stored.uuid,
    username: stored.username,
    accessToken: stored.accessToken,
    expiresAt: stored.expiresAt
  };
});

ipcMain.handle('logout-microsoft-auth', () => {
  stopAuthPolling();
  clearStoredAuth();
  return { success: true };
});

ipcMain.handle('list-microsoft-accounts', () => listStoredAccounts());

ipcMain.handle('switch-microsoft-account', async (_event, uuid: string) => {
  const store: AuthStore = readAuthStore();
  const key: string = normalizeUuid(String(uuid || ''));
  const target: StoredMicrosoftAuth | undefined = store.accounts.find(
    (item) => normalizeUuid(item.uuid) === key
  );
  if (!target) {
    return { status: 'error', code: 'not_signed_in', message: t('ui.auth_no_account') };
  }

  const result: any = await refreshAccount(target);
  if (result.status !== 'success') return result;

  const account: StoredMicrosoftAuth = {
    uuid: result.uuid,
    username: result.username,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt
  };
  writeStoredAuth(account);
  writeLog(`[正版登录] 已切换账号: ${account.username}`);
  return {
    status: 'success',
    uuid: account.uuid,
    username: account.username,
    accessToken: account.accessToken,
    expiresAt: account.expiresAt
  };
});

ipcMain.handle('remove-microsoft-account', (_event, uuid: string) => {
  removeStoredAccount(String(uuid || ''));
  return { success: true, ...listStoredAccounts() };
});

ipcMain.handle('get-microsoft-avatar', async (_event, uuid: string, refresh: boolean = false) => {
  const target: string = String(uuid || readStoredAuth()?.uuid || '');
  if (!target) return { dataUrl: null, width: 64, height: 64 };
  return fetchAccountSkin(target, Boolean(refresh));
});

ipcMain.handle('refresh-microsoft-auth', async () => refreshMicrosoftSession());

ipcMain.handle('validate-microsoft-auth', async () => validateMicrosoftSession());

/**
 * 把当前登录的正版账号绑定到 CaelLabMinecraft 网站账号：
 * 网站先生成 6 位绑定码，这里拿验证过的 MC 访问令牌 + 绑定码去换绑定。
 */
ipcMain.handle('mc-server-bind', async (_event, code: string) => {
  const bindCode: string = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(bindCode)) {
    return { success: false, code: 'invalid_code', message: t('ui.mc_bind_error_invalid_code') };
  }

  const session: any = await validateMicrosoftSession();
  if (!session?.valid || !session.accessToken) {
    return { success: false, code: 'relogin_required', message: session?.message || t('ui.auth_login_required') };
  }

  try {
    const response = await requestJson('https://minecraft.caellab.com/api/auth.php?action=premium-bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `code=${encodeURIComponent(bindCode)}&token=${encodeURIComponent(session.accessToken)}`,
      timeout: 20000
    });
    const result: any = response.json;
    if (result?.success) {
      writeLog(`[MC绑定] ${session.username} 已绑定到 ${result.offline_name}`);
      return { success: true, offlineName: result.offline_name, premiumName: result.premium_name };
    }
    const codeKey: string = String(result?.code || 'failed');
    writeLog(`[MC绑定] 失败: ${codeKey} ${result?.message || response.status}`);
    return { success: false, code: codeKey, message: String(result?.message || t('ui.mc_bind_error_failed')) };
  } catch (e: any) {
    writeLog(`[MC绑定] 请求失败: ${e.message}`);
    return { success: false, code: 'network', message: t('ui.mc_bind_error_network') };
  }
});
