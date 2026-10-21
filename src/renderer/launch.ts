/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { initChart, loadChartJs, peakSpeed, resetChart, setPeakSpeed, updateChart } from './chart';
import { detailDownloadBtn, downloadPanel, gameMonitor, gameMonitorMemory, gameMonitorPid, launchBtn, menuDownload, setStatus, showDialog, showToast, usernameInput } from './dom';
import { crashReported, gameRunning, handleGameLog, hideGameMonitor, lastGameStatusAt, monitorStartedAt, refreshGameMonitor, setCrashReported, setLastGameStatusAt, setMonitorStartedAt, setMonitorState, setMonitorVersion, showCrashDialog, showGameMonitor } from './monitor';
import { showPage } from './nav';
import { playerHistory, setPlayerHistory } from './player';
import { initGameDir, msAuthData } from './session';
import { getMaxConcurrentFromSettings, loadSettings } from './settings';
import { getLoaderDisplayName, hideVersionDetail, isVersionInstalled, loadVersions, modLoaderState, recordVersionDownload, recordVersionLaunch, renderVersionSelectList, selectedVersionId } from './versions';
// __IMPORTS_END__

export async function launchGame(): Promise<void> {
  
  const launchBtnEl: HTMLElement | null = document.getElementById('launch-btn');
  const mode: string = (launchBtnEl as any)?.dataset.mode || 'launch';
  
  if (mode === 'download') {
    
    showPage('download');
    setStatus('请选择要下载的游戏版本');
    return;
  }

  setStatus('[动画] launchGame 函数被调用了');
  const username: string = (usernameInput?.value || '').trim() || 'GPCL_Player';

  const versionId: string | null = selectedVersionId;

  if (!versionId) {
    setStatus('请先选择已安装的版本', 'error');
    return;
  }

  await recordVersionLaunch(versionId);

  if (window.gpcl && window.gpcl.savePlayerName) {
    const names: any = await window.gpcl.savePlayerName(username);
    if (names && Array.isArray(names.recent)) setPlayerHistory(names.recent);
  }

  if (launchBtnEl) (launchBtnEl as HTMLButtonElement).disabled = true;

  showLaunchAnimation(versionId);

  try {
    
    const gameDir = await initGameDir();
    setStatus('[动画] 开始启动游戏');

    const settings = await loadSettings();
    let windowMode: string = settings.game?.windowMode || 'windowed';
    let welcomeAnimPlaying: boolean = false;
    
    if (settings.appearance?.playStartupAnimation && window.gpcl && window.gpcl.playStartupAnimation) {
      setStatus('[启动动画] 正在播放欢迎动画...');
      welcomeAnimPlaying = true;
      windowMode = 'fullscreen';
      
      settings.appearance.playStartupAnimation = false;
      await gpcl.saveSettings(settings);
      const playStartupEl: HTMLInputElement | null = document.getElementById('play-startup-animation') as HTMLInputElement | null;
      if (playStartupEl) playStartupEl.checked = false;
      
      await window.gpcl.playStartupAnimation();
      setStatus('[启动动画] 动画播放完毕，正在启动游戏...');
    }

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
      
      if (welcomeAnimPlaying && window.gpcl && window.gpcl.dismissStartupAnimation) {
        window.gpcl.dismissStartupAnimation();
      }

      showLaunchSuccess();
      
      setTimeout(() => {
        hideLaunchAnimation();
        void refreshGameMonitor();
      }, 800);
      
      setStatus(`游戏已启动！PID: ${result.pid}`, 'success');
      showToast('游戏已启动', `Minecraft ${versionId} (${username})`, 'success', 'game-started');
    } else if (result.cancelled) {
      
      if (welcomeAnimPlaying && window.gpcl && window.gpcl.dismissStartupAnimation) {
        window.gpcl.dismissStartupAnimation();
      }
      hideLaunchAnimation();
      setStatus('启动已取消', 'info');
      showToast('启动已取消', '用户取消了游戏启动', 'info', 'launch-cancelled');
    } else {
      if (welcomeAnimPlaying && window.gpcl && window.gpcl.dismissStartupAnimation) {
        window.gpcl.dismissStartupAnimation();
      }
      hideLaunchAnimation();
      setStatus(result.error, 'error');
      showToast('启动失败', result.error, 'error', 'game-launch-failed');
    }
  } catch (err: any) {
    if (welcomeAnimPlaying && window.gpcl && window.gpcl.dismissStartupAnimation) {
      window.gpcl.dismissStartupAnimation();
    }
    hideLaunchAnimation();
    setStatus('启动出错', 'error');
    showToast('启动出错', err.message, 'error', 'launch-error');
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
      versionInfo.textContent = `将启动: ${displayName}`;
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
  'Minecraft 最初由 Markus "Notch" Persson 于 2009 年独立开发，最初版本仅用 6 天完成。',
  'Minecraft 的苦力怕（Creeper）是 Notch 在尝试制作猪模型时，因搞错长宽比而意外诞生的。',
  '末影人（Enderman）会随机搬运一些方块，这是参考了现实中的都市传说 Slender Man。',
  'Minecraft 中最大的自然结构是下界要塞（Nether Fortress），可绵延数百个区块。',
  'Minecraft 中钻石矿石只在 Y 坐标 16 以下生成，最集中的区域是 Y=5 到 Y=12 之间。',
  'Minecraft 的附魔台周围的图书馆架数量会影响附魔等级，最高可达到 30 级。',
  '红石（Redstone）是 Minecraft 中的"电力"系统，可以构建从简单门到计算机的各种电路。',
  'Minecraft 中潮涌核心（Conduit）可以为水下玩家提供无限呼吸和夜视效果。',
  'Minecraft 的下界合金（Netherite）装备需要先制作品铁装备再锻造升级。',
  'Minecraft 中的嗅探兽（Sniffer）是 2022 年 Minecraft Live 由玩家投票选出的生物。',
  'Minecraft 中沼泽小屋（Swamp Hut）必定会生成女巫，是获取红石粉的稳定来源。',
  'Minecraft 中你可以用线制作羊毛，但不能用羊毛反合成线。',
  'Minecraft 的创造模式最初是为开发调试而加入的，后来才成为正式游戏模式。',
  'Minecraft 中装备了冰霜行者（Frost Walker）附魔的靴子可以在水上行走。',
  'Minecraft 中每个区块（Chunk）是 16×16 方块大小，游戏世界是通过区块流式加载的。',
  'Minecraft 中鞘翅（Elytra）可以在末地船中找到，配合烟花火箭可以实现飞行。',
  'Minecraft 中下界对应主世界的比例为 1:8，在下界走 1 格相当于主世界 8 格。',
  'Minecraft 中掠夺者前哨站（Pillager Outpost）会生成灾厄旗帜，周围的灾厄村民不会攻击。',
  'Minecraft 中蜜蜂（Bee）在采蜜后会帮助作物加速生长。',
  'Minecraft 中史莱姆（Slime）只在特定区块生成，可以使用种子计算器定位史莱姆区块。',
  'Minecraft 的唱片机播放的是 C418 创作的音乐，13 和 cat 两张唱片可在要塞的箱子中找到。',
  'Minecraft 中深海监守者（Warden）是盲人，依靠声音和振动感知玩家。',
  'Minecraft 的紫颂果（Chorus Fruit）食用后会随机传送，但会失去一些饥饿值。',
  'Minecraft 中袭击（Raid）是不祥之兆效果进入村庄时触发的多波战斗事件。',
  'Minecraft 中下界传送门（Nether Portal）的大小最小为 4×5，最大为 23×23。',
  'Minecraft 中海龟壳帽（Turtle Shell）可以让玩家在水下呼吸更长时间。',
  'Minecraft 中甜浆果（Sweet Berries）可以在针叶林生物群系中找到，也可种植。',
  'Minecraft 中你已经可以用铜（Copper）制作避雷针、望远镜和装饰方块。',
  'Minecraft 中营火（Campfire）可以烹饪食物，而且不会像熔炉那样消耗燃料。',
  'Minecraft 中幽匿块（Sculk）会在深暗之域生成，挖掉之前最好先准备好。',
  'GPCL 是云云一个人开发的启动器，并没有什么所谓的开发团队。',
  'Minecraft 最早的公开版本发布于 2009 年 5 月，当时还叫 Cave Game。',
  '末影人的设计灵感来自网络怪谈里的“瘦长鬼影”。',
  '苦力怕的来源是建模时把猪的模型做歪了，于是干脆留下了它。',
  '钻石镐挖一块黑曜石需要 9.4 秒，去下界之前记得带上。',
  '在下界走 1 格等于主世界 8 格，长途赶路走传送门比坐船快得多。',
  '落地之前对着脚下倒一桶水，可以抵消所有坠落伤害。',
  '恶魂的火球能被打回去，用反弹的火球击杀恶魂还有个成就。',
  '给生物用命名牌改过名之后，它就不会被刷掉了。',
  '附魔台周围摆书架能提高附魔等级，最多需要 15 个书架。',
  '床在下界和末地会爆炸，别想着在那边睡觉。',
  '铁砧有使用次数上限，用久了会碎，记得多备几个。',
  '潮涌核心需要用完整的水体包住才能激活，能给你水下呼吸和夜视。',
  '潜影盒能装 27 组物品，被破坏后里面的东西也还在。',
  '蜂蜜块能减缓下落速度，是做无伤电梯的常见材料。',
  '羊毛可以用剪刀剪，羊会重新长出来，没必要杀掉它们。',
  '村庄里的铁傀儡是由村民数量触发的，建个村民农场就能自动刷铁。',
  '击败凋灵掉落的下界之星，是制作信标的唯一材料。',
  '信标放在基座方块上方，基座越大等级越高，最高 4 级。',
  '末影箱的内容和玩家绑定，在任何维度打开都是同一份物品。',
  'Minecraft 的方块贴图只有 16×16 像素，所以画风才能这么统一。',
  '红石中继器既能延长信号，也能让线路只朝一个方向走。',
  '观察者方块会在它面对的方向发生变化时输出红石信号。',
  '下雨天钓鱼更快，也更容易钓到宝藏。',
  '雪球能熄灭火焰，在雪地上用锹就能铲出一堆。',
  '带一只猫下矿是划算的，它会赶走苦力怕和幻翼。',
  '海豚会给你加速效果，还会带你去附近找沉船。',
  'Java 版按 F3 打开调试信息，F3+G 显示区块边界。',
  '丛林神庙和沙漠神殿里都有陷阱，下去之前先拆掉压力板。',
  '唱片“11”是游戏里气氛最诡异的一张，结尾有一段类似杂音的声响。',
  'GPCL 的“更多”菜单里有社区论坛入口，遇到问题可以去问问。',
  '游戏崩溃时 GPCL 会弹窗并让你导出错误报告，那比截图有用得多。',
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
  tipText.textContent = launchTips[randomIndex];
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
        title: '确认关闭',
        message: '当前正在下载中，关闭会停止下载并清理已下载的文件。确定要关闭吗？如有不完整的"libraries"需自行清理。'
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
  status: 'queued' | 'running' | 'done' | 'error';
  percent: number;
  message: string;
  finalVersionId?: string;
  error?: string;
  modpack?: { source: 'modrinth' | 'curseforge'; projectId: string; versionId: string; gameVersion: string; instanceName: string };
}

const downloadTasks: DownloadTask[] = [];
let activeDownloadTask: DownloadTask | null = null;
let queueRunning: boolean = false;
let queueTaskSeq: number = 0;
let lastProgressAt: number = Date.now();
let lastProgressBytes: number = 0;
let lastProgressLabel: string = '';
let chartReady: boolean = false;

export function hasQueuedDownloads(): boolean {
  return downloadTasks.some((t: DownloadTask) => t.status === 'queued');
}

function taskListEl(): HTMLElement | null {
  return document.getElementById('download-task-list');
}

function taskStateText(task: DownloadTask): string {
  if (task.status === 'queued') return '等待中';
  if (task.status === 'done') return '完成';
  if (task.status === 'error') return task.error ? `失败：${task.error}` : '失败';
  return task.message || '下载中…';
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

function renderDownloadTasks(): void {
  const list = taskListEl();
  if (!list) return;
  if (downloadTasks.length === 0) {
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  list.classList.remove('hidden');
  list.innerHTML = '';

  for (const task of downloadTasks) {
    const row: HTMLDivElement = document.createElement('div');
    row.className = 'download-task';
    row.dataset.taskId = task.id;
    row.dataset.status = task.status;

    const head: HTMLDivElement = document.createElement('div');
    head.className = 'download-task-head';

    const name: HTMLSpanElement = document.createElement('span');
    name.className = 'download-task-name';
    name.textContent = task.displayName;

    const state: HTMLSpanElement = document.createElement('span');
    state.className = 'download-task-state';
    state.textContent = taskStateText(task);

    head.appendChild(name);
    head.appendChild(state);

    if (task.status === 'queued') {
      const remove: HTMLButtonElement = document.createElement('button');
      remove.className = 'download-task-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = '移出队列';
      remove.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const index: number = downloadTasks.findIndex((t: DownloadTask) => t.id === task.id);
        if (index >= 0 && downloadTasks[index].status === 'queued') {
          downloadTasks.splice(index, 1);
          renderDownloadTasks();
        }
      });
      head.appendChild(remove);
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

function prepareDownloadPanel(): void {
  void loadChartJs().then(() => {
    if (!chartReady) {
      initChart();
      chartReady = true;
    }
    resetChart();
  });
  if (downloadPanel) downloadPanel.classList.remove('hidden');
}

async function runDownloadTask(task: DownloadTask): Promise<void> {
  activeDownloadTask = task;
  task.status = 'running';
  task.percent = 0;
  task.message = '准备下载…';
  lastProgressAt = Date.now();
  lastProgressBytes = 0;
  lastProgressLabel = '';
  renderDownloadTasks();

  prepareDownloadPanel();

  const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
  const cancelBtn: HTMLElement | null = document.getElementById('cancel-download-btn');
  if (cancelBtn) {
    cancelBtn.textContent = '取消当前下载';
    cancelBtn.classList.remove('complete');
    (cancelBtn as HTMLButtonElement).disabled = false;
  }
  if (downloadStatusEl) downloadStatusEl.textContent = `开始下载 ${task.displayName}…`;
  setStatus(`开始下载 ${task.displayName}…`);

  try {
    const maxConcurrent: number = getMaxConcurrentFromSettings();
    const result: any = task.modpack
      ? await window.gpcl.modpackInstall({ ...task.modpack, maxConcurrent })
      : task.loaderType
        ? await window.gpcl.downloadWithModLoader(task.versionId, task.loaderType, task.loaderVersion, maxConcurrent, { installFabricApi: task.installFabricApi })
        : await window.gpcl.downloadVersion(task.versionId, maxConcurrent);

    if (result && result.success) {
      task.status = 'done';
      task.percent = 100;
      task.finalVersionId = result.finalVersionId || result.instanceName || task.versionId;
      task.message = '完成';
      updateTaskRow(task);

      await recordVersionDownload(task.finalVersionId);
      showToast('下载完成', `${task.displayName} 已准备就绪`, 'success', 'download-complete');
      if (result.fabricApiError) {
        showToast('Fabric API 未装上', result.fabricApiError, 'warning', 'fabric-api-failed');
      } else if (Array.isArray(result.fabricApiFiles) && result.fabricApiFiles.length > 0) {
        task.message = '完成 · 已带 Fabric API';
      }
      if (task.modpack && Number(result.skipped) > 0) {
        showToast('部分文件已跳过', `${result.skipped} 个可选文件或服务器端文件没有下载`, 'info', 'modpack-skipped');
      }
      await loadVersions();
      renderVersionSelectList();
      if (downloadStatusEl) downloadStatusEl.textContent = `下载完成：${task.displayName}`;
      setStatus(`下载完成：${task.displayName}`, 'success');
      setTimeout(() => {
        const index: number = downloadTasks.findIndex((t: DownloadTask) => t.id === task.id);
        if (index >= 0 && downloadTasks[index].status === 'done') {
          downloadTasks.splice(index, 1);
          renderDownloadTasks();
        }
      }, 8000);
    } else {
      task.status = 'error';
      task.error = result?.error || '未知错误';
      updateTaskRow(task);
      showToast('下载失败', `${task.displayName}：${task.error}`, 'error', 'download-error');
      if (downloadStatusEl) downloadStatusEl.textContent = `下载失败：${task.error}`;
      setStatus(`下载失败：${task.error}`, 'error');
    }
  } catch (e: any) {
    task.status = 'error';
    task.error = e.message || String(e);
    updateTaskRow(task);
    showToast('下载出错', task.error, 'error', 'download-error');
    if (downloadStatusEl) downloadStatusEl.textContent = `下载出错：${task.error}`;
    setStatus('下载出错', 'error');
  } finally {
    activeDownloadTask = null;
    updateTaskRow(task);
    if (cancelBtn) {
      const hasMore: boolean = downloadTasks.some((t: DownloadTask) => t.status === 'queued');
      if (!hasMore) {
        const cancelled: boolean = task.status === 'error' && /取消/.test(task.error || '');
        cancelBtn.textContent = cancelled ? '已取消' : '下载完成';
        cancelBtn.classList.add('complete');
        (cancelBtn as HTMLButtonElement).disabled = true;
      } else {
        cancelBtn.textContent = '取消当前下载';
        (cancelBtn as HTMLButtonElement).disabled = false;
      }
    }
  }
}

async function processDownloadQueue(): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (true) {
      const task: DownloadTask | undefined = downloadTasks.find((t: DownloadTask) => t.status === 'queued');
      if (!task) break;
      await runDownloadTask(task);
    }
  } finally {
    queueRunning = false;
    renderDownloadTasks();
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
    displayName: `整合包：${options.instanceName}`,
    status: 'queued',
    percent: 0,
    message: '等待中',
    modpack: options
  });

  renderDownloadTasks();
  showPage('download');
  const scrollContainer: HTMLElement | null = document.querySelector('.main-content') as HTMLElement | null;
  if (scrollContainer) scrollContainer.scrollTop = 0;

  if (!queueRunning) void processDownloadQueue();
}


export async function startDownload(versionId: string): Promise<void> {
  if (!versionId) {
    setStatus('请先选择要下载的版本', 'error');
    return;
  }

  let loaderType: string = '';
  let loaderVersion: string = '';
  let loaderName: string = '';
  for (const [loader, state] of Object.entries(modLoaderState) as [string, any][]) {
    if (state.selectedVersionId) {
      loaderType = loader;
      loaderVersion = state.selectedVersionId;
      loaderName = getLoaderDisplayName(loader);
      break;
    }
  }

  const duplicate: boolean = downloadTasks.some((t: DownloadTask) =>
    (t.status === 'queued' || t.status === 'running') && t.versionId === versionId && t.loaderType === loaderType);
  if (duplicate) {
    showToast('已经在队列里了', `${loaderName || 'Minecraft'} ${versionId}`, 'info', 'download-duplicate');
    return;
  }

  const fabricApiAuto: HTMLInputElement | null = document.getElementById('fabric-api-auto') as HTMLInputElement | null;
  const displayName: string = loaderType ? `${loaderName} ${versionId}` : `Minecraft ${versionId}`;
  downloadTasks.push({
    id: `task-${++queueTaskSeq}`,
    versionId,
    loaderType,
    loaderVersion,
    loaderName,
    installFabricApi: fabricApiAuto ? fabricApiAuto.checked : true,
    displayName,
    status: 'queued',
    percent: 0,
    message: '等待中'
  });

  renderDownloadTasks();
  hideVersionDetail();
  showPage('download');
  const versionTab: HTMLButtonElement | null = document.getElementById('download-tab-versions') as HTMLButtonElement | null;
  if (versionTab) versionTab.click();
  const scrollContainer: HTMLElement | null = document.querySelector('.main-content') as HTMLElement | null;
  if (scrollContainer) scrollContainer.scrollTop = 0;

  if (!queueRunning) void processDownloadQueue();
}


function registerDownloadListeners(): void {
  if (!window.gpcl) return;

  window.gpcl.onDownloadProgress((data: any): void => {
    const task: DownloadTask | null = activeDownloadTask;
    if (!task) return;

    const currentTime: number = Date.now();
    const timeDiff: number = (currentTime - lastProgressAt) / 1000;

    if (data.label && data.label !== lastProgressLabel) {
      lastProgressLabel = data.label;
      lastProgressBytes = 0;
      lastProgressAt = currentTime;
    }

    if (timeDiff >= 0.5 && data.bytesDownloaded !== undefined) {
      const bytesDiff: number = data.bytesDownloaded - lastProgressBytes;
      if (bytesDiff >= 0) {
        const speedBps: number = Math.max(0, (bytesDiff * 8) / timeDiff / 1000000);
        const currentSpeedEl: HTMLElement | null = document.getElementById('current-speed');
        const peakSpeedEl: HTMLElement | null = document.getElementById('peak-speed');
        if (currentSpeedEl) currentSpeedEl.textContent = speedBps.toFixed(2) + ' Mbps';
        if (speedBps > peakSpeed) {
          setPeakSpeed(speedBps);
          if (peakSpeedEl) peakSpeedEl.textContent = peakSpeed.toFixed(2) + ' Mbps';
        }
        updateChart(speedBps);
        lastProgressAt = currentTime;
        lastProgressBytes = data.bytesDownloaded;
      }
    }

    task.percent = Number(data.percent) || 0;
    task.message = data.label ? `下载 ${data.label}` : '下载中…';
    updateTaskRow(task);
  });

  if (window.gpcl.onInstallStage) {
    window.gpcl.onInstallStage((data: any): void => {
      if (!activeDownloadTask || !data?.message) return;
      activeDownloadTask.message = data.message;
      updateTaskRow(activeDownloadTask);
      const downloadStatusEl: HTMLElement | null = document.getElementById('download-status');
      if (downloadStatusEl) downloadStatusEl.textContent = data.message;
      setStatus(data.message);
    });
  }
}

registerDownloadListeners();


export function handleGameClosed(code: number): void {
  setStatus('游戏已退出');
  if (launchBtn) (launchBtn as HTMLButtonElement).disabled = false;
  if (crashReported) {
    setCrashReported(false);
    return;
  }
  showToast('游戏已退出', `退出码: ${code}`, 'info', 'game-closed');
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
  setStatus(`启动出错: ${message}`, 'error');
  showToast('游戏错误', message, 'error', 'game-error');
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
