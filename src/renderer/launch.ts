/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { t } from '../i18n';
import { beginDownloadDockCancel, finishDownloadDock, hideDownloadDock, scheduleDownloadDockHide, setDownloadDockClearHandler, setDownloadDockPanelCount, setDownloadDockQueue, setDownloadDockStage, showDownloadDock, updateDownloadDock } from './download-dock';
import { gameMonitor, gameMonitorMemory, gameMonitorPid, icon, launchBtn, setStatus, showDialog, showNamePrompt, showToast, usernameInput } from './dom';
import { crashReported, gameRunning, handleGameLog, hideGameMonitor, lastGameStatusAt, monitorStartedAt, refreshGameMonitor, setCrashReported, setLastGameStatusAt, setMonitorStartedAt, setMonitorState, setMonitorVersion, showCrashDialog, showGameMonitor } from './monitor';
import { showPage } from './nav';
import { playerHistory, setPlayerHistory } from './player';
import { authMode, initGameDir, msAuthData, setMsAuthData } from './session';
import { getMaxConcurrentFromSettings, loadSettings } from './settings';
import { getLoaderDisplayName, hideVersionDetail, isVersionInstalled, loadVersions, modLoaderState, recordVersionDownload, recordVersionLaunch, renderVersionSelectList, selectedVersionId, selectedVersionRoot } from './versions';
// __IMPORTS_END__

export async function launchGame(): Promise<void> {
  
  const launchBtnEl: HTMLElement | null = document.getElementById('launch-btn');
  const mode: string = (launchBtnEl as any)?.dataset.mode || 'launch';
  
  if (mode === 'download') {
    
    showPage('download');
    setStatus('请选择要下载的游戏版本');
    return;
  }

  if (authMode === 'microsoft' && !msAuthData) {
    showToast('ui.microsoft_sign_in', t('ui.sign_in_required'), 'warning');
    return;
  }

  setStatus('[动画] launchGame 函数被调用了');
  const username: string = (usernameInput?.value || '').trim() || 'GPCL_Player';

  const versionId: string | null = selectedVersionId;

  if (!versionId) {
    setStatus('请先选择已安装的版本', 'error');
    return;
  }

  // 正版登录的 accessToken 会过期；启动前校验一次，过期就先用 refresh_token 续上，
  // 续不上才让玩家重新登录。否则进服务器会被 sessionserver 403 挡回来。
  if (msAuthData && window.gpcl.validateMicrosoftAuth) {
    setStatus(t('ui.auth_checking'));
    try {
      const auth: any = await window.gpcl.validateMicrosoftAuth();
      if (auth?.valid) {
        if (auth.accessToken) {
          setMsAuthData({
            uuid: auth.uuid || msAuthData.uuid,
            username: auth.username || msAuthData.username,
            accessToken: auth.accessToken,
            expiresAt: Number(auth.expiresAt) || msAuthData.expiresAt
          });
        }
      } else if (auth?.relogin) {
        window.dispatchEvent(new CustomEvent('gpcl-auth-expired'));
        showToast('ui.auth_expired', t('ui.auth_login_required'), 'error', 'auth-expired');
        setStatus(t('ui.auth_expired'), 'error');
        return;
      }
    } catch {}
  }

  await recordVersionLaunch(versionId);

  if (window.gpcl && window.gpcl.savePlayerName) {
    const names: any = await window.gpcl.savePlayerName(username);
    if (names && Array.isArray(names.recent)) setPlayerHistory(names.recent);
  }

  if (launchBtnEl) (launchBtnEl as HTMLButtonElement).disabled = true;

  showLaunchAnimation(versionId);

  try {
    
    const gameDir: string | null = selectedVersionRoot || await initGameDir();
    setStatus('[动画] 开始启动游戏');

    const settings = await loadSettings();
    const windowMode: string = settings.game?.windowMode || 'windowed';

    setupGameWindowListener();
    
    const result = await window.gpcl.launch({
      versionId,
      username: msAuthData ? msAuthData.username : username,
      gameDir,
      windowMode,
      authUuid: msAuthData?.uuid,
      authAccessToken: msAuthData?.accessToken,
      authUserType: msAuthData ? 'msa' : undefined
    });

    if (result.success) {
      setStatus('[动画] 游戏启动成功，窗口已创建');
      
      showLaunchSuccess();
      
      setTimeout(() => {
        hideLaunchAnimation();
        void refreshGameMonitor();
      }, 800);
      
      setStatus(t('ui.game_launched_pid_pid', { pid: result.pid }), 'success');
      showToast('ui.game_launched', `Minecraft ${versionId} (${username})`, 'success', 'game-started');
    } else if (result.cancelled) {
      
      hideLaunchAnimation();
      setStatus('启动已取消', 'info');
      showToast('ui.launch_cancelled', '用户取消了游戏启动', 'info', 'launch-cancelled');
    } else {
      hideLaunchAnimation();
      setStatus(result.error, 'error');
      showToast('ui.launch_failed', result.error, 'error', 'game-launch-failed');
    }
  } catch (err: any) {
    hideLaunchAnimation();
    setStatus('启动出错', 'error');
    showToast('ui.launch_error', err.message, 'error', 'launch-error');
  } finally {
    if (launchBtnEl) (launchBtnEl as HTMLButtonElement).disabled = false;
  }
}


export async function showLaunchAnimation(versionId: string): Promise<void> {
  try {
    const overlay: HTMLElement | null = document.getElementById('launch-animation-overlay');
    const statusText: HTMLElement | null = document.getElementById('launch-status-text');
    const versionInfo: HTMLElement | null = document.getElementById('launch-version-info');
    const progressFill: HTMLElement | null = document.getElementById('launch-progress-fill');
    
    if (overlay) {
      overlay.classList.remove('hidden', 'fade-out', 'launch-success');
      overlay.style.display = 'flex';
      void overlay.offsetHeight;
      overlay.classList.add('show');
      setStatus('[动画] 启动动画层已显示');
    } else {
      setStatus('[动画] 未找到启动动画层元素', 'error');
      return;
    }
    
    if (statusText) {
      statusText.textContent = '正在启动游戏...';
    }

    let displayName: string = versionId;
    if (window.gpcl && typeof window.gpcl.getLaunchDisplayName === 'function') {
      try {
        displayName = await window.gpcl.getLaunchDisplayName(versionId);
      } catch (e: any) {
        console.warn(`获取启动显示名称失败: ${versionId}`, e);
      }
    }
    
    if (versionInfo) {
      versionInfo.textContent = t('ui.launching_name', { name: displayName });
    }
    
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    
    simulateLaunchProgress();
    showRandomTip();
  } catch (err: any) {
    setStatus('[动画] 显示启动动画失败: ' + err.message, 'error');
  }
}


export const launchTips: string[] = [
  'Minecraft was created by Markus "Notch" Persson in 2009; the first version took only six days.',
  'The Creeper was born by accident when Notch built a pig model with the wrong proportions.',
  'Endermen pick up blocks at random, a nod to the Slender Man urban legend.',
  'Nether fortresses are among the largest natural structures and can span hundreds of chunks.',
  'Diamond ore generates below Y=16, most often between Y=5 and Y=12.',
  'Bookshelves around an enchanting table raise its level, up to level 30.',
  'Redstone is Minecraft\'s "electricity" system, powering everything from simple doors to computers.',
  'A conduit grants water breathing and night vision to players underwater.',
  'Netherite gear starts as diamond gear and is upgraded at a smithing table.',
  'The Sniffer was chosen by players in the 2022 Minecraft Live mob vote.',
  'Swamp huts always spawn a witch, making them a steady source of redstone dust.',
  'You can craft wool from string, but you cannot turn wool back into string.',
  'Creative mode began as a development tool before becoming an official game mode.',
  'Boots with Frost Walker let you walk across water.',
  'Each chunk is 16×16 blocks, and the world loads them as you move.',
  'Elytra are found on end ships; combine them with firework rockets to fly.',
  'One block in the Nether equals eight in the Overworld.',
  'Pillager outposts contain ominous banners; the pillagers nearby do not attack on sight.',
  'Bees help crops grow faster after collecting pollen.',
  'Slimes spawn only in certain chunks; a seed calculator can find slime chunks.',
  'Jukebox music is by C418; the "13" and "cat" discs can be found in stronghold chests.',
  'The Warden is blind and relies on sound and vibrations to find players.',
  'Chorus fruit teleports you at random but costs some hunger.',
  'A raid is a multi-wave battle triggered by entering a village with Bad Omen.',
  'Nether portals can be as small as 4×5 and as large as 23×23.',
  'A turtle shell lets you stay underwater longer.',
  'Sweet berries grow in taiga biomes and can be farmed.',
  'Copper can be used for lightning rods, spyglasses and decorative blocks.',
  'Campfires cook food without consuming fuel like a furnace.',
  'Sculk generates in the Deep Dark — prepare before you dig.',
  'GPCL is built by Yunyun alone — there is no development team behind it.',
  'The first public version appeared in May 2009, when it was still called Cave Game.',
  'The Enderman was inspired by the Slender Man internet myth.',
  'The Creeper exists because a pig model was built wrong and kept that way.',
  'A diamond pickaxe needs 9.4 seconds to mine obsidian — bring one before heading to the Nether.',
  'One block in the Nether equals eight in the Overworld; portals beat boats for long trips.',
  'Place water under yourself before landing to cancel all fall damage.',
  'You can hit Ghast fireballs back — killing one with its own fireball earns an achievement.',
  'A mob renamed with a name tag will no longer despawn.',
  'Bookshelves around an enchanting table raise its level, up to 15 bookshelves.',
  'Beds explode in the Nether and the End — don\'t try to sleep there.',
  'Anvils wear out after a limited number of uses; keep spares.',
  'A conduit needs a full water block around it to activate, granting water breathing and night vision.',
  'A shulker box holds 27 stacks and keeps its contents when broken.',
  'Honey blocks slow your fall and are a common material for safe elevators.',
  'Shear sheep for wool instead of killing them — the wool grows back.',
  'Iron golems spawn based on the number of villagers; a villager farm automates iron.',
  'The Nether star dropped by the Wither is the only material for a beacon.',
  'Place a beacon on a mineral base; larger bases raise its level, up to four.',
  'An ender chest stores items per player and shows the same contents in every dimension.',
  'Block textures are only 16×16 pixels, which keeps the art style consistent.',
  'Redstone repeaters extend signals and keep them flowing one way.',
  'An observer emits a redstone signal when the block it faces changes.',
  'Fishing is faster in the rain and more likely to yield treasure.',
  'Snowballs put out fire, and a shovel gives you plenty on snow.',
  'Bringing a cat mining pays off — it scares away creepers and phantoms.',
  'Dolphins grant a speed boost and can lead you to nearby shipwrecks.',
  'In Java Edition, F3 opens the debug screen and F3+G shows chunk borders.',
  'Jungle temples and desert pyramids have traps; disarm the pressure plates before going in.',
  'The music disc \'11\' is the creepiest in the game, ending with a noise-like sound.',
  'The More menu in GPCL links to the community forum if you need help.',
  'When the game crashes, GPCL shows a dialog and lets you export an error report — far more useful than a screenshot.',
];


export let launchTipFrequency: string = 'rare';


export function tipShouldShow(): boolean {
  if (launchTipFrequency === 'off') return false;
  if (launchTipFrequency === 'always') return true;
  if (launchTipFrequency === 'half') return Math.random() < 0.5;
  return Math.random() < 1 / 3;
}


export function showRandomTip(): void {
  const tipText: HTMLElement | null = document.getElementById('launch-tip-text');
  const tipCard: HTMLElement | null = document.getElementById('launch-tip-card');
  if (!tipText) return;

  if (!tipShouldShow()) {
    if (tipCard) tipCard.classList.add('hidden');
    return;
  }

  if (tipCard) tipCard.classList.remove('hidden');
  const randomIndex: number = Math.floor(Math.random() * launchTips.length);
  tipText.textContent = t(launchTips[randomIndex]);
}


export function simulateLaunchProgress(): void {
  const progressFill: HTMLElement | null = document.getElementById('launch-progress-fill');
  const statusText: HTMLElement | null = document.getElementById('launch-status-text');
  
  let progress: number = 0;
  const statusMessages: string[] = [
    '正在检查游戏文件...',
    '正在准备Java运行时...',
    '正在初始化游戏环境...',
    '正在启动游戏窗口...'
  ];
  
  const interval: ReturnType<typeof setInterval> = setInterval(() => {
    
    progress += Math.random() * 15 + 5;
    
    if (progress >= 90) {
      progress = 90;
    }
    
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    const messageIndex: number = Math.floor(progress / 25);
    if (statusText && messageIndex < statusMessages.length) {
      statusText.textContent = statusMessages[messageIndex];
    }
  }, 200);

  window.launchProgressInterval = interval;
}


export let gameWindowResolve: (() => void) | null = null;

export let gameWindowTimeout: ReturnType<typeof setTimeout> | null = null;


export function setupGameWindowListener(): void {
  
  if (window.gpcl && window.gpcl.removeAllListeners) {
    window.gpcl.removeAllListeners();
  }

  if (window.gpcl && window.gpcl.onConfirmCloseWhileDownloading) {
    window.gpcl.onConfirmCloseWhileDownloading(async (): Promise<void> => {
      const result: boolean = await showDialog({
        type: 'confirm',
        title: t('ui.confirm_close'),
        message: t('ui.close_while_downloading_message')
      });

      if (result) {
        if (window.gpcl && window.gpcl.confirmCloseDownload) {
          await window.gpcl.confirmCloseDownload();
        }
      } else {
        if (window.gpcl && window.gpcl.cancelClose) {
          await window.gpcl.cancelClose();
        }
      }
    });
  }

  if (window.gpcl && window.gpcl.onGameWindowCreated) {
    window.gpcl.onGameWindowCreated((data: any): void => {
      setStatus('[动画] 收到游戏窗口创建事件');
      if (gameWindowResolve) {
        if (gameWindowTimeout) clearTimeout(gameWindowTimeout);
        gameWindowResolve();
        gameWindowResolve = null;
        gameWindowTimeout = null;
      }
    });
    setStatus('[动画] 游戏窗口监听器已设置');
  }
}


export function waitForGameWindow(): Promise<void> {
  return new Promise((resolve) => {
    gameWindowResolve = resolve;
    
    gameWindowTimeout = setTimeout(() => {
      setStatus('[动画] 窗口检测超时');
      gameWindowResolve = null;
      gameWindowTimeout = null;
      resolve();
    }, 10000); 
  });
}


export function showLaunchSuccess(): void {
  try {
    const overlay: HTMLElement | null = document.getElementById('launch-animation-overlay');
    const pickaxe: HTMLElement | null = document.getElementById('pickaxe');
    const block: HTMLElement | null = document.getElementById('block');
    
    if (overlay) {
      overlay.classList.add('launch-success');
      setStatus('[动画] 显示成功动画');
    }
    
    if (block) {
      block.classList.add('breaking');
    }

    createParticles();
  } catch (err: any) {
    setStatus('[动画] 显示成功动画失败: ' + err.message, 'error');
  }
}


export function createParticles(): void {
  const particlesContainer: HTMLElement | null = document.getElementById('particles');
  if (!particlesContainer) return;

  particlesContainer.innerHTML = '';

  for (let i = 0; i < 12; i++) {
    const particle: HTMLDivElement = document.createElement('div');
    particle.className = 'particle';

    const angle: number = (Math.PI * 2 * i) / 12;
    const distance: number = 50 + Math.random() * 50;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);

    particle.style.width = `${4 + Math.random() * 8}px`;
    particle.style.height = particle.style.width;
    particle.style.animationDelay = `${Math.random() * 0.2}s`;
    
    particlesContainer.appendChild(particle);
  }
}


export function hideLaunchAnimation(): void {
  try {
    const overlay: HTMLElement | null = document.getElementById('launch-animation-overlay');
    
    if (overlay) {
      overlay.classList.remove('show');
      overlay.classList.add('fade-out');
      
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('fade-out', 'launch-success');
        overlay.classList.add('hidden');
        setStatus('[动画] 启动动画层已隐藏');
      }, 400);
    }

    if (window.launchProgressInterval) {
      clearInterval(window.launchProgressInterval);
      window.launchProgressInterval = null;
    }
  } catch (err: any) {
    setStatus('[动画] 隐藏启动动画失败: ' + err.message, 'error');
  }
}


interface DownloadTask {
  id: string;
  versionId: string;
  loaderType: string;
  loaderVersion: string;
  loaderName: string;
  installFabricApi: boolean;
  displayName: string;
  instanceName?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  percent: number;
  message: string;
  finalVersionId?: string;
  error?: string;
  modpack?: { source: 'modrinth' | 'curseforge'; projectId: string; versionId: string; gameVersion: string; instanceName: string };
  modInstall?: { direct: boolean; payload: any };
  javaInstall?: { version: string };
}

const downloadTasks: DownloadTask[] = [];
const taskResolvers: Map<string, Array<(result: any) => void>> = new Map();
let activeDownloadTask: DownloadTask | null = null;
let queueRunning: boolean = false;
let queueTaskSeq: number = 0;

function addTaskResolver(taskId: string, resolve: (result: any) => void): void {
  const list: Array<(result: any) => void> = taskResolvers.get(taskId) || [];
  list.push(resolve);
  taskResolvers.set(taskId, list);
}

function resolveTaskResult(taskId: string, result: any): void {
  const list: Array<(result: any) => void> | undefined = taskResolvers.get(taskId);
  if (!list) return;
  taskResolvers.delete(taskId);
  for (const resolve of list) resolve(result);
}

export function hasQueuedDownloads(): boolean {
  return downloadTasks.some((t: DownloadTask) => t.status === 'queued');
}

function queuedCount(): number {
  return downloadTasks.filter((task: DownloadTask) => task.status === 'queued').length;
}

function taskListEl(): HTMLElement | null {
  return document.getElementById('download-task-list');
}

function taskStateText(task: DownloadTask): string {
  if (task.status === 'queued') return t('ui.queued');
  if (task.status === 'done') return t('ui.done');
  if (task.status === 'error') return task.error ? t('ui.failed_error', { error: task.error }) : t('ui.failed');
  return task.message || t('ui.downloading');
}

function normalizeDownloadError(message: string): string {
  return /cancel/i.test(message) ? t('ui.download_cancelled') : message;
}

function updateTaskRow(task: DownloadTask): void {
  const list = taskListEl();
  if (!list) return;
  const row: HTMLElement | null = list.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement | null;
  if (!row) return;
  row.dataset.status = task.status;
  const stateEl: HTMLElement | null = row.querySelector('.download-task-state') as HTMLElement | null;
  if (stateEl) stateEl.textContent = taskStateText(task);
  const fill: HTMLElement | null = row.querySelector('.download-task-fill') as HTMLElement | null;
  if (fill) fill.style.width = `${task.status === 'done' ? 100 : task.percent}%`;
}

function cancelActiveDownload(): void {
  const task: DownloadTask | null = activeDownloadTask;
  if (!task) return;
  task.message = t('ui.cancelling');
  updateTaskRow(task);
  const pageCancelBtn: HTMLElement | null = document.getElementById('cancel-download-btn');
  if (pageCancelBtn) {
    pageCancelBtn.textContent = t('ui.cancelling');
    (pageCancelBtn as HTMLButtonElement).disabled = true;
  }
  beginDownloadDockCancel();
}

function renderDownloadTasks(): void {
  const list = taskListEl();
  if (!list) return;
  const hasCompleted: boolean = downloadTasks.some((task: DownloadTask) => task.status === 'done' || task.status === 'error');
  const runningCount: number = downloadTasks.filter((task: DownloadTask) => task.status === 'running').length;
  setDownloadDockPanelCount(downloadTasks.length, hasCompleted, runningCount);
  if (downloadTasks.length === 0) {
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  list.classList.remove('hidden');
  list.innerHTML = '';

  const statusOrder: Record<string, number> = { running: 0, queued: 1, done: 2, error: 3 };
  const ordered: DownloadTask[] = downloadTasks
    .map((task: DownloadTask, index: number) => ({ task, index }))
    .sort((a: any, b: any) => (statusOrder[a.task.status] - statusOrder[b.task.status]) || (a.index - b.index))
    .map((entry: any) => entry.task);

  for (const task of ordered) {
    const row: HTMLDivElement = document.createElement('div');
    row.className = 'download-task';
    row.dataset.taskId = task.id;
    row.dataset.status = task.status;

    const head: HTMLDivElement = document.createElement('div');
    head.className = 'download-task-head';

    const taskIcon: HTMLSpanElement = document.createElement('span');
    taskIcon.className = 'download-task-icon';
    taskIcon.innerHTML = icon(task.status === 'done' ? 'check' : task.status === 'error' ? 'x-circle' : task.status === 'queued' ? 'loader' : 'download');

    const name: HTMLSpanElement = document.createElement('span');
    name.className = 'download-task-name';
    name.textContent = task.displayName;

    const state: HTMLSpanElement = document.createElement('span');
    state.className = 'download-task-state';
    state.textContent = taskStateText(task);

    head.appendChild(taskIcon);
    head.appendChild(name);
    head.appendChild(state);

    if (task.status === 'queued') {
      const remove: HTMLButtonElement = document.createElement('button');
      remove.className = 'download-task-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = t('ui.remove_from_queue');
      remove.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const index: number = downloadTasks.findIndex((t: DownloadTask) => t.id === task.id);
        if (index >= 0 && downloadTasks[index].status === 'queued') {
          const removed: DownloadTask = downloadTasks.splice(index, 1)[0];
          resolveTaskResult(removed.id, { success: false, error: t('ui.cancelled') });
          renderDownloadTasks();
          setDownloadDockQueue(queuedCount());
        }
      });
      head.appendChild(remove);
    } else if (task.status === 'running') {
      const cancel: HTMLButtonElement = document.createElement('button');
      cancel.className = 'download-task-cancel';
      cancel.type = 'button';
      cancel.textContent = t('ui.cancel');
      cancel.title = t('ui.cancel_current_download');
      cancel.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        cancel.disabled = true;
        cancelActiveDownload();
      });
      head.appendChild(cancel);
    }

    const bar: HTMLDivElement = document.createElement('div');
    bar.className = 'download-task-bar';
    const fill: HTMLDivElement = document.createElement('div');
    fill.className = 'download-task-fill';
    fill.style.width = `${task.status === 'done' ? 100 : task.percent}%`;
    bar.appendChild(fill);

    row.appendChild(head);
    row.appendChild(bar);
    list.appendChild(row);
  }
}

async function runDownloadTask(task: DownloadTask): Promise<void> {
  activeDownloadTask = task;
  task.status = 'running';
  task.percent = 0;
  task.message = t('ui.preparing_download');
  renderDownloadTasks();
  showDownloadDock(task.displayName);
  setDownloadDockQueue(queuedCount());

  const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
  const cancelBtn: HTMLElement | null = document.getElementById('cancel-download-btn');
  if (cancelBtn) {
    cancelBtn.textContent = t('ui.cancel_current_download');
    cancelBtn.classList.remove('complete');
    (cancelBtn as HTMLButtonElement).disabled = false;
  }
  if (downloadStatusEl) downloadStatusEl.textContent = t('ui.downloading_name', { name: task.displayName });
  setStatus(t('ui.downloading_name', { name: task.displayName }));

  try {
    const maxConcurrent: number = getMaxConcurrentFromSettings();
    const result: any = task.javaInstall
      ? await window.gpcl.installJava(task.javaInstall.version)
      : task.modInstall
      ? await (task.modInstall.direct
          ? window.gpcl.modsInstallDirect(task.modInstall.payload)
          : window.gpcl.modsInstall(task.modInstall.payload))
      : task.modpack
        ? await window.gpcl.modpackInstall({ ...task.modpack, maxConcurrent })
        : task.loaderType
          ? await window.gpcl.downloadWithModLoader(task.versionId, task.loaderType, task.loaderVersion, maxConcurrent, { installFabricApi: task.installFabricApi })
          : await window.gpcl.downloadVersion(task.versionId, maxConcurrent);

    if (task.javaInstall) {
      if (result && result.success) {
        task.status = 'done';
        task.percent = 100;
        task.message = t('ui.done');
        updateTaskRow(task);
        const readyText: string = t('ui.java_version_is_ready', { version: task.javaInstall.version });
        showToast('ui.installation_complete_2', readyText, 'success', 'java-install-success');
        setStatus(readyText, 'success');
        finishDownloadDock(readyText, 'done');
      } else {
        task.status = 'error';
        task.error = normalizeDownloadError(result?.error || t('ui.unknown_error'));
        updateTaskRow(task);
        showToast('ui.installation_failed', task.error, 'error', 'java-install-failed');
        setStatus(t('ui.download_failed_error_2', { error: task.error }), 'error');
        finishDownloadDock(t('ui.download_failed_error_2', { error: task.error }), 'error');
      }
      resolveTaskResult(task.id, result && result.success ? result : { success: false, error: task.error });
      return;
    }

    if (task.modInstall) {
      if (result && result.success) {
        task.status = 'done';
        task.percent = 100;
        task.message = t('ui.done');
        updateTaskRow(task);
        if (downloadStatusEl) downloadStatusEl.textContent = t('ui.installation_complete');
        setStatus(t('ui.installation_complete'), 'success');
        finishDownloadDock(t('ui.installation_complete'), 'done');
      } else {
        task.status = 'error';
        task.error = normalizeDownloadError(result?.error || t('ui.unknown_error'));
        updateTaskRow(task);
        if (downloadStatusEl) downloadStatusEl.textContent = t('ui.download_failed_error_2', { error: task.error });
        setStatus(t('ui.download_failed_error_2', { error: task.error }), 'error');
        finishDownloadDock(t('ui.download_failed_error_2', { error: task.error }), 'error');
      }
      resolveTaskResult(task.id, result && result.success ? result : { success: false, error: task.error });
      return;
    }

    if (result && result.success) {
      task.status = 'done';
      task.percent = 100;
      let finalVersionId: string = result.finalVersionId || result.instanceName || task.versionId;

      if (task.instanceName && task.instanceName !== finalVersionId) {
        const created: any = await window.gpcl.createVersionInstance({
          baseVersionId: finalVersionId,
          name: task.instanceName,
          loaderType: task.loaderType,
          loaderVersion: task.loaderVersion
        });
        if (created?.success && created.versionId) {
          finalVersionId = created.versionId;
        } else if (created?.error) {
          showToast(t('ui.instance_create_failed', { error: created.error }), '', 'warning', 'instance-create-failed');
        }
      }

      task.finalVersionId = finalVersionId;
      task.message = t('ui.done');
      updateTaskRow(task);

      await recordVersionDownload(finalVersionId);
      showToast('ui.download_complete', t('ui.name_is_ready', { name: finalVersionId }), 'success', 'download-complete');
      if (result.fabricApiError) {
        showToast('ui.fabric_api_was_not_installed', result.fabricApiError, 'warning', 'fabric-api-failed');
      } else if (Array.isArray(result.fabricApiFiles) && result.fabricApiFiles.length > 0) {
        task.message = '完成 · 已带 Fabric API';
      }
      if (task.modpack && Number(result.skipped) > 0) {
        showToast('ui.some_files_were_skipped', t('ui.count_optional_or_server_side_files_were_not_downloaded', { count: result.skipped }), 'info', 'modpack-skipped');
      }
      await loadVersions();
      renderVersionSelectList();
      if (downloadStatusEl) downloadStatusEl.textContent = t('ui.download_complete_name', { name: finalVersionId });
      setStatus(t('ui.download_complete_name', { name: finalVersionId }), 'success');
      finishDownloadDock(t('ui.download_complete_name', { name: finalVersionId }), 'done');
    } else {
      task.status = 'error';
      task.error = normalizeDownloadError(result?.error || t('ui.unknown_error'));
      updateTaskRow(task);
      showToast('ui.download_failed', t('ui.name_error', { name: task.displayName, error: task.error }), 'error', 'download-error');
      if (downloadStatusEl) downloadStatusEl.textContent = t('ui.download_failed_error_2', { error: task.error });
      setStatus(t('ui.download_failed_error_2', { error: task.error }), 'error');
      finishDownloadDock(t('ui.download_failed_error_2', { error: task.error }), 'error');
    }
  } catch (e: any) {
    task.status = 'error';
    task.error = normalizeDownloadError(e.message || String(e));
    updateTaskRow(task);
    if (task.modInstall || task.javaInstall) {
      finishDownloadDock(t('ui.download_failed_error_2', { error: task.error }), 'error');
      resolveTaskResult(task.id, { success: false, error: task.error });
      return;
    }
    showToast('ui.download_error', task.error, 'error', 'download-error');
    if (downloadStatusEl) downloadStatusEl.textContent = t('ui.download_error_error', { error: task.error });
    setStatus(t('ui.download_error_error', { error: task.error }), 'error');
    finishDownloadDock(t('ui.download_error_error', { error: task.error }), 'error');
  } finally {
    activeDownloadTask = null;
    renderDownloadTasks();
    setDownloadDockQueue(queuedCount());
    if (cancelBtn) {
      const hasMore: boolean = downloadTasks.some((t: DownloadTask) => t.status === 'queued');
      if (!hasMore) {
        const cancelled: boolean = task.status === 'error' && /取消|cancel/i.test(task.error || '');
        cancelBtn.textContent = cancelled ? t('ui.download_cancelled') : t('ui.download_complete');
        cancelBtn.classList.add('complete');
        (cancelBtn as HTMLButtonElement).disabled = true;
      } else {
        cancelBtn.textContent = t('ui.cancel_current_download');
        (cancelBtn as HTMLButtonElement).disabled = false;
      }
    }
  }
}

async function processDownloadQueue(): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  let lastStatus: 'done' | 'error' = 'done';
  try {
    while (true) {
      const task: DownloadTask | undefined = downloadTasks.find((t: DownloadTask) => t.status === 'queued');
      if (!task) break;
      await runDownloadTask(task);
      lastStatus = task.status === 'error' ? 'error' : 'done';
    }
  } finally {
    queueRunning = false;
    renderDownloadTasks();
    setDownloadDockQueue(queuedCount());
    scheduleDownloadDockHide(lastStatus);
  }
}

export function startModpackInstall(options: { source: 'modrinth' | 'curseforge'; projectId: string; versionId: string; gameVersion: string; instanceName: string }): void {
  downloadTasks.push({
    id: `task-${++queueTaskSeq}`,
    versionId: options.instanceName,
    loaderType: '',
    loaderVersion: '',
    loaderName: '整合包',
    installFabricApi: false,
    displayName: t('ui.modpack_name', { name: options.instanceName }),
    status: 'queued',
    percent: 0,
    message: t('ui.queued'),
    modpack: options
  });

  renderDownloadTasks();
  if (!queueRunning) void processDownloadQueue();
}


export function startModInstall(options: { direct: boolean; payload: any; displayName: string }): Promise<any> {
  return new Promise((resolve) => {
    const task: DownloadTask = {
      id: `task-${++queueTaskSeq}`,
      versionId: '',
      loaderType: '',
      loaderVersion: '',
      loaderName: '',
      installFabricApi: false,
      displayName: options.displayName,
      status: 'queued',
      percent: 0,
      message: t('ui.queued'),
      modInstall: { direct: options.direct, payload: options.payload }
    };
    addTaskResolver(task.id, resolve);
    downloadTasks.push(task);
    renderDownloadTasks();
    setDownloadDockQueue(queuedCount());
    if (!queueRunning) void processDownloadQueue();
  });
}


export function startJavaInstall(javaVersion: string): Promise<any> {
  return new Promise((resolve) => {
    const displayName: string = t('ui.installing_java_version', { version: javaVersion });
    const existing: DownloadTask | undefined = downloadTasks.find((task: DownloadTask) =>
      (task.status === 'queued' || task.status === 'running') &&
      task.javaInstall?.version === javaVersion);
    if (existing) {
      addTaskResolver(existing.id, resolve);
      showToast('ui.already_in_the_queue', displayName, 'info', 'java-install-duplicate');
      return;
    }

    const task: DownloadTask = {
      id: `task-${++queueTaskSeq}`,
      versionId: '',
      loaderType: '',
      loaderVersion: '',
      loaderName: '',
      installFabricApi: false,
      displayName,
      status: 'queued',
      percent: 0,
      message: t('ui.queued'),
      javaInstall: { version: javaVersion }
    };
    addTaskResolver(task.id, resolve);
    downloadTasks.push(task);
    renderDownloadTasks();
    setDownloadDockQueue(queuedCount());
    if (!queueRunning) void processDownloadQueue();
  });
}


function currentLoaderSelection(): { type: string; version: string; name: string } {
  for (const [loader, state] of Object.entries(modLoaderState) as [string, any][]) {
    if (state.selectedVersionId) {
      return { type: loader, version: state.selectedVersionId, name: getLoaderDisplayName(loader) };
    }
  }
  return { type: '', version: '', name: '' };
}


export async function beginVersionDownload(versionId: string): Promise<void> {
  if (!versionId) return;
  const loader = currentLoaderSelection();
  const autoName: string = loader.type ? `${loader.name} ${versionId}` : `Minecraft ${versionId}`;
  const name: string | null = await showNamePrompt({
    title: t('ui.download'),
    file: autoName,
    value: autoName,
    note: t('ui.version_name_note', { version: versionId })
  });
  if (name === null) return;
  await startDownload(versionId, name);
}


export async function startDownload(versionId: string, requestedName?: string): Promise<void> {
  if (!versionId) {
    setStatus('请先选择要下载的版本', 'error');
    return;
  }

  const loader = currentLoaderSelection();
  const loaderType: string = loader.type;
  const loaderVersion: string = loader.version;
  const loaderName: string = loader.name;

  const fabricApiAuto: HTMLInputElement | null = document.getElementById('fabric-api-auto') as HTMLInputElement | null;
  const autoName: string = loaderType ? `${loaderName} ${versionId}` : `Minecraft ${versionId}`;
  const customName: string = String(requestedName || '').trim();
  const displayName: string = customName || autoName;
  const duplicate: boolean = downloadTasks.some((t: DownloadTask) =>
    (t.status === 'queued' || t.status === 'running') &&
    t.versionId === versionId &&
    t.loaderType === loaderType &&
    (!customName || t.displayName === customName));
  if (duplicate) {
    showToast('ui.already_in_the_queue', displayName, 'info', 'download-duplicate');
    return;
  }
  downloadTasks.push({
    id: `task-${++queueTaskSeq}`,
    versionId,
    loaderType,
    loaderVersion,
    loaderName,
    installFabricApi: fabricApiAuto ? fabricApiAuto.checked : true,
    displayName,
    instanceName: customName && customName !== autoName ? customName : undefined,
    status: 'queued',
    percent: 0,
    message: t('ui.queued')
  });

  renderDownloadTasks();
  hideVersionDetail();

  if (!queueRunning) void processDownloadQueue();
}


function registerDownloadListeners(): void {
  if (!window.gpcl) return;

  window.gpcl.onDownloadProgress((data: any): void => {
    const task: DownloadTask | null = activeDownloadTask;
    if (!task || task.modInstall) return;

    const percent: number = Number(data?.percent) || 0;
    task.percent = percent;
    task.message = data?.label ? t('ui.downloading_label', { label: data.label }) : t('ui.downloading');
    updateTaskRow(task);
    updateDownloadDock({
      percent,
      label: String(data?.label || ''),
      speed: Number(data?.speed) || 0,
      current: Number(data?.current) || 0,
      total: Number(data?.total) || 0
    });
  });

  if (window.gpcl.onInstallStage) {
    window.gpcl.onInstallStage((data: any): void => {
      if (!activeDownloadTask || activeDownloadTask.modInstall || !data?.message) return;
      activeDownloadTask.message = data.message;
      updateTaskRow(activeDownloadTask);
      const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
      if (downloadStatusEl) downloadStatusEl.textContent = data.message;
      setStatus(data.message);
      setDownloadDockStage(data.message);
    });
  }

  if (window.gpcl.onModDownloadProgress) {
    window.gpcl.onModDownloadProgress((data: any): void => {
      const task: DownloadTask | null = activeDownloadTask;
      if (!task || !task.modInstall || !data) return;
      const percent: number = Number(data.percent) || 0;
      task.percent = percent;
      task.message = data.label ? t('ui.downloading_label', { label: data.label }) : t('ui.downloading');
      updateTaskRow(task);
      updateDownloadDock({
        percent,
        label: String(data.label || ''),
        speed: Number(data.speed) || 0
      });
    });
  }
}

registerDownloadListeners();

setDownloadDockClearHandler(() => {
  for (let index: number = downloadTasks.length - 1; index >= 0; index--) {
    const status: string = downloadTasks[index].status;
    if (status === 'done' || status === 'error') downloadTasks.splice(index, 1);
  }
  renderDownloadTasks();
  setDownloadDockQueue(queuedCount());
  if (downloadTasks.length === 0) hideDownloadDock();
});


export function handleGameClosed(code: number): void {
  setStatus('游戏已退出');
  if (launchBtn) (launchBtn as HTMLButtonElement).disabled = false;
  if (crashReported) {
    setCrashReported(false);
    return;
  }
  showToast('ui.game_exited', t('ui.exit_code_code', { code }), 'info', 'game-closed');
}


export function handleGameCrashed(info: any): void {
  setCrashReported(true);
  setStatus('游戏崩溃了', 'error');
  showCrashDialog(info);
}


export function handleGameStatus(status: any): void {
  setLastGameStatusAt(Date.now());

  if (!status || !status.running) {
    if (gameRunning) hideGameMonitor();
    return;
  }
  if (gameMonitor && !gameMonitor.classList.contains('active')) {
    showGameMonitor(status);
    return;
  }
  if (status.startedAt) setMonitorStartedAt(status.startedAt);
  if (status.pid && gameMonitorPid) gameMonitorPid.textContent = String(status.pid);
  setMonitorVersion(status.versionId || '');
  if (gameMonitorMemory) {
    gameMonitorMemory.textContent = status.memoryMB ? `${status.memoryMB} MB` : '-';
  }
  setMonitorState('running', status.runningCount);
}


export function handleGameError(message: string): void {
  setStatus(t('ui.launch_error_message', { message }), 'error');
  showToast('ui.game_error', message, 'error', 'game-error');
  if (launchBtn) (launchBtn as HTMLButtonElement).disabled = false;
}

/**
 * 游戏生命周期监听统一在这里注册（模块加载时注册一次）。
 * preload 的 removeAllListeners() 只清那几个会被重复注册的通道，
 * 这几个必须留在外面 —— 被清掉就没人补回来，表现是关掉游戏后面板一直显示运行中。
 */

export function registerGameEventListeners(): void {
  if (!window.gpcl) return;
  if (window.gpcl.onGameLog) window.gpcl.onGameLog(handleGameLog);
  if (window.gpcl.onGameClosed) window.gpcl.onGameClosed(handleGameClosed);
  if (window.gpcl.onGameCrashed) window.gpcl.onGameCrashed(handleGameCrashed);
  if (window.gpcl.onGameStatus) window.gpcl.onGameStatus(handleGameStatus);
  if (window.gpcl.onGameError) window.gpcl.onGameError(handleGameError);
}


registerGameEventListeners();

/** 跨模块写入用：launchTipFrequency 归本模块所有，其它模块只能经此写入 */
export function setLaunchTipFrequency(value: string): void { launchTipFrequency = value; }
