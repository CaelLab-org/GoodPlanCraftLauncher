/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { paintSkinHead, showAccountSkin } from './avatar';
import { icon, showDialog, showToast, usernameHistoryBtn, usernameInput } from './dom';
import { closeUsernameHistory } from './player';
import { authMode, msAuthData, setAuthMode, setMsAuthData } from './session';
// __IMPORTS_END__

interface AccountInfo {
  uuid: string;
  username: string;
  expiresAt?: number;
}

interface SkinInfo {
  dataUrl: string;
  width: number;
  height: number;
}

const authMicrosoftBtn: HTMLElement | null = document.getElementById('auth-microsoft');
const authOfflineBtn: HTMLElement | null = document.getElementById('auth-offline');
const usernameGroup: HTMLElement | null = document.getElementById('username-input-group');
const panel: HTMLElement | null = document.getElementById('auth-ms-panel');
const signedOutState: HTMLElement | null = document.getElementById('auth-ms-signed-out');
const waitingState: HTMLElement | null = document.getElementById('auth-ms-waiting');
const signedInState: HTMLElement | null = document.getElementById('auth-ms-signed-in');
const errorBox: HTMLElement | null = document.getElementById('auth-ms-error');
const loginBtn: HTMLButtonElement | null = document.getElementById('auth-ms-login') as HTMLButtonElement | null;
const cancelBtn: HTMLButtonElement | null = document.getElementById('auth-ms-cancel') as HTMLButtonElement | null;
const reopenBtn: HTMLButtonElement | null = document.getElementById('auth-ms-reopen') as HTMLButtonElement | null;
const switchBtn: HTMLButtonElement | null = document.getElementById('auth-ms-switch') as HTMLButtonElement | null;
const logoutBtn: HTMLButtonElement | null = document.getElementById('auth-ms-logout') as HTMLButtonElement | null;
const accountList: HTMLElement | null = document.getElementById('auth-account-list');
const accountItems: HTMLElement | null = document.getElementById('auth-account-items');
const addAccountBtn: HTMLButtonElement | null = document.getElementById('auth-account-add') as HTMLButtonElement | null;
const skinRefreshBtn: HTMLButtonElement | null = document.getElementById('auth-skin-refresh') as HTMLButtonElement | null;
const mcBindBtn: HTMLButtonElement | null = document.getElementById('auth-mc-bind') as HTMLButtonElement | null;
const mcBindRow: HTMLElement | null = document.getElementById('auth-mc-bind-row');
const mcBindInput: HTMLInputElement | null = document.getElementById('auth-mc-bind-code') as HTMLInputElement | null;
const mcBindConfirmBtn: HTMLButtonElement | null = document.getElementById('auth-mc-bind-confirm') as HTMLButtonElement | null;
const mcBindCancelBtn: HTMLButtonElement | null = document.getElementById('auth-mc-bind-cancel') as HTMLButtonElement | null;

let signingIn: boolean = false;
let switchingUuid: string | null = null;
let accountListOpen: boolean = false;
let mcBindRowOpen: boolean = false;
let mcBinding: boolean = false;
let accounts: AccountInfo[] = [];
const headCache: Map<string, SkinInfo> = new Map();

function keyOf(uuid: string): string {
  return String(uuid || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
}

function sameAccount(a: string, b: string): boolean {
  return Boolean(keyOf(a)) && keyOf(a) === keyOf(b);
}

function authErrorMessage(result: any): string {
  const code: string = String(result?.code || '');
  if (code) {
    const key: string = `ui.auth_error_${code}`;
    const translated: string = t(key);
    if (translated !== key) return translated;
  }
  return String(result?.message || t('ui.sign_in_failed'));
}

function setError(message: string): void {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.toggle('hidden', !message);
}

function applyHeadToRows(uuid: string, skin: SkinInfo): void {
  if (!accountItems) return;
  const rows: HTMLElement[] = Array.from(accountItems.querySelectorAll('.auth-account-row')) as HTMLElement[];
  for (const row of rows) {
    if (!sameAccount(row.dataset.uuid || '', uuid)) continue;
    const head: HTMLElement | null = row.querySelector('.auth-account-head') as HTMLElement | null;
    if (head) paintSkinHead(head, skin.dataUrl, skin.width, skin.height);
  }
}

function renderAccountItems(visible: boolean): void {
  if (!visible || !accountItems) return;
  accountItems.textContent = '';

  for (const account of accounts) {
    const row: HTMLElement = document.createElement('div');
    row.className = 'auth-account-row';
    row.dataset.uuid = account.uuid;

    const current: boolean = Boolean(msAuthData && sameAccount(msAuthData.uuid, account.uuid));
    if (current) row.classList.add('is-current');
    if (switchingUuid && sameAccount(switchingUuid, account.uuid)) row.classList.add('is-busy');

    if (!current) {
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.addEventListener('click', () => void switchAccount(account));
      row.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void switchAccount(account);
        }
      });
    }

    const head: HTMLElement = document.createElement('div');
    head.className = 'skin-head auth-account-head';
    head.style.setProperty('--head-size', '24px');
    const cached: SkinInfo | undefined = headCache.get(keyOf(account.uuid));
    if (cached) paintSkinHead(head, cached.dataUrl, cached.width, cached.height);
    row.appendChild(head);

    const name: HTMLElement = document.createElement('span');
    name.className = 'auth-account-name';
    name.textContent = account.username;
    row.appendChild(name);

    if (current) {
      const tag: HTMLElement = document.createElement('span');
      tag.className = 'auth-account-tag';
      tag.textContent = t('ui.current_account');
      row.appendChild(tag);
    }

    const remove: HTMLButtonElement = document.createElement('button');
    remove.type = 'button';
    remove.className = 'auth-account-remove';
    remove.innerHTML = icon('close');
    remove.title = t('ui.remove_account');
    remove.setAttribute('aria-label', t('ui.remove_account'));
    remove.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      void removeAccount(account);
    });
    row.appendChild(remove);

    accountItems.appendChild(row);
  }
}

function render(): void {
  const signedIn: boolean = Boolean(msAuthData);
  const microsoft: boolean = authMode === 'microsoft';

  authMicrosoftBtn?.classList.toggle('auth-tab-active', microsoft);
  authOfflineBtn?.classList.toggle('auth-tab-active', !microsoft);

  if (!microsoft) {
    panel?.classList.add('hidden');
    usernameGroup?.classList.remove('hidden');
    if (usernameInput) usernameInput.disabled = false;
    usernameHistoryBtn?.classList.remove('hidden');
    return;
  }

  panel?.classList.remove('hidden');
  usernameGroup?.classList.toggle('hidden', !signedIn || signingIn);
  if (usernameInput) {
    usernameInput.disabled = signedIn;
    if (signedIn && msAuthData) usernameInput.value = msAuthData.username;
  }
  usernameHistoryBtn?.classList.toggle('hidden', signedIn || signingIn);

  signedOutState?.classList.toggle('hidden', signedIn || signingIn);
  waitingState?.classList.toggle('hidden', !signingIn);
  signedInState?.classList.toggle('hidden', !signedIn || signingIn);

  const listVisible: boolean = !signingIn && (signedIn ? accountListOpen : accounts.length > 0);
  accountList?.classList.toggle('hidden', !listVisible);
  addAccountBtn?.classList.toggle('hidden', !signedIn);
  skinRefreshBtn?.classList.toggle('hidden', !signedIn);
  mcBindBtn?.classList.toggle('hidden', !signedIn);
  mcBindRow?.classList.toggle('hidden', !(listVisible && mcBindRowOpen));
  if (!listVisible) mcBindRowOpen = false;
  renderAccountItems(listVisible);
}

async function loadAccountHead(account: AccountInfo): Promise<void> {
  const key: string = keyOf(account.uuid);
  if (!key || headCache.has(key)) return;
  try {
    const result: any = await window.gpcl.getMicrosoftAvatar(account.uuid, false);
    if (!result?.dataUrl) return;
    const skin: SkinInfo = {
      dataUrl: String(result.dataUrl),
      width: Number(result.width) || 64,
      height: Number(result.height) || 64
    };
    headCache.set(key, skin);
    applyHeadToRows(account.uuid, skin);
  } catch {}
}

async function loadAccounts(): Promise<void> {
  try {
    const result: any = await window.gpcl.listMicrosoftAccounts();
    accounts = Array.isArray(result?.accounts) ? result.accounts : [];
  } catch {
    accounts = [];
  }
  render();
  for (const account of accounts) void loadAccountHead(account);
}

async function applyCurrentSkin(refresh: boolean): Promise<boolean> {
  if (!msAuthData) {
    showAccountSkin(null);
    return false;
  }
  const uuid: string = msAuthData.uuid;
  try {
    const result: any = await window.gpcl.getMicrosoftAvatar(uuid, refresh);
    if (!msAuthData || !sameAccount(msAuthData.uuid, uuid)) return false;
    if (result?.dataUrl) {
      const skin: SkinInfo = {
        dataUrl: String(result.dataUrl),
        width: Number(result.width) || 64,
        height: Number(result.height) || 64
      };
      headCache.set(keyOf(uuid), skin);
      showAccountSkin(skin.dataUrl, skin.width, skin.height);
      return true;
    }
    showAccountSkin(null);
    return false;
  } catch {
    if (msAuthData && sameAccount(msAuthData.uuid, uuid)) showAccountSkin(null);
    return false;
  }
}

function applyAccount(result: any, refreshSkin: boolean): void {
  if (!result || result.status !== 'success' || !result.uuid || !result.username || !result.accessToken) return;
  setMsAuthData({
    uuid: String(result.uuid),
    username: String(result.username),
    accessToken: String(result.accessToken),
    expiresAt: Number(result.expiresAt) || undefined
  });
  setAuthMode('microsoft');
  setError('');
  render();
  void applyCurrentSkin(refreshSkin);
}

async function restoreOfflineName(): Promise<void> {
  if (!usernameInput) return;
  try {
    const name: string = await window.gpcl.getPlayerName();
    if (authMode === 'offline' && !msAuthData) usernameInput.value = name || 'GPCL_Player';
  } catch {}
}

function signOut(notify: boolean): void {
  setMsAuthData(null);
  signingIn = false;
  mcBindRowOpen = false;
  setError('');
  showAccountSkin(null);
  closeUsernameHistory();
  render();
  if (window.gpcl && window.gpcl.logoutMicrosoftAuth) void window.gpcl.logoutMicrosoftAuth();
  if (notify) showToast('ui.signed_out', '', 'info');
  void restoreOfflineName();
}

async function startSignIn(): Promise<void> {
  if (signingIn) return;
  signingIn = true;
  accountListOpen = false;
  setError('');
  render();
  try {
    await window.gpcl.startMicrosoftAuth();
  } catch (e: any) {
    signingIn = false;
    setError(e?.message || t('ui.sign_in_failed'));
    render();
  }
}

function cancelSignIn(): void {
  if (window.gpcl && window.gpcl.cancelMicrosoftAuth) void window.gpcl.cancelMicrosoftAuth();
}

async function switchAccount(account: AccountInfo): Promise<void> {
  if (msAuthData && sameAccount(msAuthData.uuid, account.uuid)) {
    accountListOpen = false;
    render();
    return;
  }
  if (signingIn || switchingUuid) return;

  switchingUuid = account.uuid;
  setError('');
  render();

  try {
    const result: any = await window.gpcl.switchMicrosoftAccount(account.uuid);
    if (result?.status === 'success') {
      accountListOpen = false;
      applyAccount(result, true);
      showToast('ui.signed_in', t('ui.signed_in_as', { name: result.username }), 'success');
      void loadAccounts();
    } else {
      const message: string = authErrorMessage(result);
      setError(message);
      showToast('ui.switch_account_failed', message, 'error');
    }
  } catch (e: any) {
    const message: string = e?.message || t('ui.switch_account_failed');
    setError(message);
    showToast('ui.switch_account_failed', message, 'error');
  } finally {
    switchingUuid = null;
    render();
  }
}

async function removeAccount(account: AccountInfo): Promise<void> {
  const confirmed: boolean = await showDialog({
    type: 'confirm',
    title: t('ui.remove_account'),
    message: t('ui.remove_account_locally', { name: account.username }),
    confirmText: t('ui.remove'),
    cancelText: t('ui.cancel')
  });
  if (!confirmed) return;

  try {
    const result: any = await window.gpcl.removeMicrosoftAccount(account.uuid);
    accounts = Array.isArray(result?.accounts)
      ? result.accounts
      : accounts.filter((item: AccountInfo) => !sameAccount(item.uuid, account.uuid));
    headCache.delete(keyOf(account.uuid));
    if (msAuthData && sameAccount(msAuthData.uuid, account.uuid)) {
      setMsAuthData(null);
      showAccountSkin(null);
      void restoreOfflineName();
    }
    render();
    showToast('ui.account_removed', account.username, 'info');
  } catch (e: any) {
    showToast('ui.remove_account', e?.message || '', 'error');
  }
}

async function refreshSkin(): Promise<void> {
  if (!msAuthData || !skinRefreshBtn) return;
  skinRefreshBtn.disabled = true;
  const ok: boolean = await applyCurrentSkin(true);
  skinRefreshBtn.disabled = false;
  if (ok) showToast('ui.skin_refreshed', '', 'success');
  else showToast('ui.skin_unavailable', '', 'warning');
}

function mcBindErrorMessage(result: any): string {
  const code: string = String(result?.code || '');
  if (code === 'relogin_required') return t('ui.auth_login_required');
  if (code) {
    const key: string = `ui.mc_bind_error_${code}`;
    const translated: string = t(key);
    if (translated !== key) return translated;
  }
  return String(result?.message || t('ui.mc_bind_error_failed'));
}

function openMcBindRow(): void {
  mcBindRowOpen = true;
  render();
  if (mcBindInput) {
    mcBindInput.value = '';
    mcBindInput.focus();
  }
}

function closeMcBindRow(): void {
  mcBindRowOpen = false;
  render();
}

async function submitMcBind(): Promise<void> {
  if (mcBinding || !msAuthData) return;
  const code: string = (mcBindInput?.value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    showToast('ui.mc_bind_error_invalid_code', '', 'warning');
    return;
  }
  mcBinding = true;
  if (mcBindConfirmBtn) mcBindConfirmBtn.disabled = true;
  try {
    const result: any = await window.gpcl.mcServerBind(code);
    if (result?.success) {
      mcBindRowOpen = false;
      showToast('ui.mc_bind_ok', t('ui.mc_bind_ok_message', { name: String(result.offlineName || '') }), 'success');
      render();
    } else {
      showToast('ui.mc_bind_failed', mcBindErrorMessage(result), 'error');
    }
  } catch (e: any) {
    showToast('ui.mc_bind_failed', e?.message || t('ui.mc_bind_error_network'), 'error');
  } finally {
    mcBinding = false;
    if (mcBindConfirmBtn) mcBindConfirmBtn.disabled = false;
  }
}

function goOffline(): void {
  if (signingIn) {
    signingIn = false;
    cancelSignIn();
  }
  const wasSignedIn: boolean = Boolean(msAuthData);
  if (wasSignedIn) signOut(false);
  setAuthMode('offline');
  render();
  if (wasSignedIn) {
    showToast('ui.signed_out', t('ui.switched_to_offline_mode'), 'info');
    void restoreOfflineName();
  }
}

if (authMicrosoftBtn) {
  authMicrosoftBtn.addEventListener('click', () => {
    if (authMode === 'microsoft') return;
    setAuthMode('microsoft');
    setError('');
    render();
  });
}

if (authOfflineBtn) {
  authOfflineBtn.addEventListener('click', goOffline);
}

loginBtn?.addEventListener('click', () => void startSignIn());
cancelBtn?.addEventListener('click', cancelSignIn);
reopenBtn?.addEventListener('click', () => {
  if (window.gpcl && window.gpcl.openMicrosoftAuthBrowser) void window.gpcl.openMicrosoftAuthBrowser();
});
switchBtn?.addEventListener('click', () => {
  accountListOpen = !accountListOpen;
  render();
});
logoutBtn?.addEventListener('click', () => signOut(true));
addAccountBtn?.addEventListener('click', () => void startSignIn());
skinRefreshBtn?.addEventListener('click', () => void refreshSkin());
mcBindBtn?.addEventListener('click', openMcBindRow);
mcBindCancelBtn?.addEventListener('click', closeMcBindRow);
mcBindConfirmBtn?.addEventListener('click', () => void submitMcBind());
mcBindInput?.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void submitMcBind();
  }
});

// 启动前校验发现 refresh_token 也失效了：回到未登录卡片，别继续显示「已登录」
window.addEventListener('gpcl-auth-expired', () => {
  if (!msAuthData) return;
  signOut(false);
  setError(t('ui.auth_login_required'));
  render();
});

// 这个监听只在模块加载时注册一次；preload 的 removeAllListeners 别清它
if (window.gpcl && window.gpcl.onMicrosoftAuthResult) {
  window.gpcl.onMicrosoftAuthResult((result: any) => {
    signingIn = false;
    if (result?.status === 'success') {
      applyAccount(result, true);
      void loadAccounts();
      showToast('ui.signed_in', t('ui.signed_in_as', { name: result.username }), 'success');
      return;
    }
    if (result?.status === 'timeout') {
      const message: string = t('ui.sign_in_timed_out_please_try_again');
      setError(message);
      render();
      showToast('ui.sign_in_timed_out', message, 'error');
      return;
    }
    if (result?.status === 'error') {
      if (result.code === 'cancelled') {
        setError('');
        render();
        return;
      }
      const message: string = authErrorMessage(result);
      setError(message);
      render();
      showToast('ui.sign_in_failed', message, 'error');
    }
  });
}

(async function initAuthPanel(): Promise<void> {
  render();
  try {
    const stored: any = await window.gpcl.getMicrosoftAuth();
    if (stored && stored.status === 'success') applyAccount(stored, false);
  } catch {}
  void loadAccounts();
})();
