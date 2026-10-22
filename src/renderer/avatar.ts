import { showToast } from './dom';
import { loadSettings } from './settings';

const AVATAR_SIZE_MIN: number = 32;
const AVATAR_SIZE_MAX: number = 160;
const AVATAR_SIZE_DEFAULT: number = 50;

const skinImage: HTMLImageElement | null = document.querySelector('.skin-image') as HTMLImageElement | null;
const skinWrapper: HTMLElement | null = document.getElementById('skin-wrapper');
const sizeSlider: HTMLInputElement | null = document.getElementById('settings-avatar-size') as HTMLInputElement | null;
const sizeLabel: HTMLElement | null = document.getElementById('settings-avatar-size-value');

function clampSize(value: number): number {
  if (!Number.isFinite(value)) return AVATAR_SIZE_DEFAULT;
  return Math.min(AVATAR_SIZE_MAX, Math.max(AVATAR_SIZE_MIN, Math.round(value)));
}

function applyAvatarSize(size: number): void {
  document.documentElement.style.setProperty('--avatar-size', `${size}px`);
}

async function loadAvatarSize(): Promise<number> {
  try {
    const settings: any = await loadSettings();
    const raw: number = Number(settings?.appearance?.avatarSize);
    return Number.isFinite(raw) ? clampSize(raw) : AVATAR_SIZE_DEFAULT;
  } catch {
    return AVATAR_SIZE_DEFAULT;
  }
}

async function saveAvatarSize(size: number): Promise<void> {
  try {
    const settings: any = await loadSettings();
    settings.appearance.avatarSize = size;
    await window.gpcl.saveSettings(settings);
  } catch {}
}

function setAvatarEditable(editable: boolean): void {
  if (!skinWrapper) return;
  skinWrapper.classList.toggle('has-custom-avatar', !editable);
  if (editable) {
    skinWrapper.setAttribute('role', 'button');
    skinWrapper.setAttribute('tabindex', '0');
    skinWrapper.setAttribute('title', '点击更换头像');
  } else {
    skinWrapper.removeAttribute('role');
    skinWrapper.removeAttribute('tabindex');
    skinWrapper.removeAttribute('title');
  }
}

async function refreshAvatar(): Promise<void> {
  if (!skinImage) return;
  try {
    const result: any = window.gpcl && window.gpcl.getAvatar ? await window.gpcl.getAvatar() : null;
    if (result?.url) {
      skinImage.src = result.url;
      skinImage.classList.add('custom-avatar');
      setAvatarEditable(false);
    } else {
      skinImage.src = 'skin/Alex.png';
      skinImage.classList.remove('custom-avatar');
      setAvatarEditable(true);
    }
  } catch {
    skinImage.src = 'skin/Alex.png';
    skinImage.classList.remove('custom-avatar');
    setAvatarEditable(true);
  }
}

async function pickAvatar(): Promise<void> {
  if (!window.gpcl || typeof window.gpcl.chooseAvatar !== 'function') return;
  try {
    const result: any = await window.gpcl.chooseAvatar();
    if (result?.cancelled) return;
    if (!result?.success) {
      showToast('ui.could_not_change_avatar', result?.error || '未知错误', 'error');
      return;
    }
    await refreshAvatar();
    showToast('ui.avatar_updated', result.compressed ? '图片较大，已压缩后保存' : '已保存到 users/avatar', 'success');
  } catch (e: any) {
    showToast('ui.could_not_change_avatar', e?.message || '未知错误', 'error');
  }
}

async function resetAvatar(): Promise<void> {
  if (!window.gpcl || typeof window.gpcl.resetAvatar !== 'function') return;
  try {
    const result: any = await window.gpcl.resetAvatar();
    if (!result?.success) {
      showToast('ui.could_not_reset_avatar', result?.error || '未知错误', 'error');
      return;
    }
    await refreshAvatar();
    showToast('ui.default_avatar_restored', '', 'success');
  } catch (e: any) {
    showToast('ui.could_not_reset_avatar', e?.message || '未知错误', 'error');
  }
}

async function initAvatar(): Promise<void> {
  const storedSize: number = await loadAvatarSize();
  applyAvatarSize(storedSize);
  if (sizeSlider) sizeSlider.value = String(storedSize);
  if (sizeLabel) sizeLabel.textContent = `${storedSize} px`;

  await refreshAvatar();

  if (sizeSlider) {
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    sizeSlider.addEventListener('input', () => {
      const size: number = clampSize(Number(sizeSlider.value));
      applyAvatarSize(size);
      if (sizeLabel) sizeLabel.textContent = `${size} px`;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { void saveAvatarSize(size); }, 400);
    });
  }

  const changeBtn: HTMLElement | null = document.getElementById('settings-change-avatar');
  if (changeBtn) changeBtn.addEventListener('click', () => void pickAvatar());

  const resetBtn: HTMLElement | null = document.getElementById('settings-reset-avatar');
  if (resetBtn) resetBtn.addEventListener('click', () => void resetAvatar());

  if (skinWrapper) {
    const canPickFromAvatar = (): boolean => !skinWrapper.classList.contains('has-custom-avatar');
    skinWrapper.addEventListener('click', () => {
      if (canPickFromAvatar()) void pickAvatar();
    });
    skinWrapper.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!canPickFromAvatar()) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void pickAvatar();
      }
    });
  }
}

void initAvatar();
