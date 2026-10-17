/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/yunyun-3782/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { detailBackBtn, detailDownloadBtn, icon, setStatus, showToast, versionCountLabel, versionDetailPage, versionListContainer, versionListSection, versionSelect } from './dom';
import { startDownload } from './launch';
// __IMPORTS_END__

export async function loadVersions(silent: boolean = false): Promise<void> {
  try {
    let versions: string[] = [];

    if (window.gpcl && typeof window.gpcl.scanVersions === 'function') {
      try {
        versions = await window.gpcl.scanVersions(null, silent);
      } catch (e: any) {
        console.error('调用scanVersions失败:', e);
      }
    }

    if (!versions || versions.length === 0) {
      if (!silent) setStatus('没有本地版本，请先下载');
      
      updateLaunchButtonState(false);
    } else {
      if (!silent) setStatus(`发现 ${versions.length} 个已安装版本`);
      
      updateLaunchButtonState(true);
    }

    if (!versionSelect) {
      if (!silent) console.warn('versionSelect 元素不存在，跳过版本列表渲染');
      return;
    }

    versionSelect.innerHTML = '<option value="">请选择版本</option>';

    if (!versions || versions.length === 0) {
      const opt: HTMLOptionElement = document.createElement('option');
      opt.disabled = true;
      opt.textContent = '未发现已安装的版本';
      versionSelect.appendChild(opt);
      return;
    }

    versions.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));

    for (const v of versions) {
      let displayName: string = `Minecraft ${v}`;
      if (window.gpcl && typeof window.gpcl.getVersionDisplayName === 'function') {
        try {
          displayName = await window.gpcl.getVersionDisplayName(v);
        } catch (e: any) {
          console.warn(`获取版本显示名称失败: ${v}`, e);
        }
      }
      const opt: HTMLOptionElement = document.createElement('option');
      opt.value = v;
      opt.textContent = displayName;
      versionSelect.appendChild(opt);
    }
  } catch (err: any) {
    if (!silent) {
      setStatus('扫描本地版本失败', 'error');
      showToast('扫描失败', err.message || String(err), 'error');
    }
    
    updateLaunchButtonState(false);
  }
}


export function updateLaunchButtonState(hasGame: boolean): void {
  const launchBtnEl: HTMLElement | null = document.getElementById('launch-btn');
  const launchText: HTMLElement | null = launchBtnEl?.querySelector('.launch-text') as HTMLElement | null;

  if (launchBtnEl && launchText) {
    if (hasGame) {
      launchText.innerHTML = icon('play') + ' 开始游戏';
      launchBtnEl.dataset.mode = 'launch';
      
      launchBtnEl.classList.remove('no-game');
    } else {
      launchText.innerHTML = icon('download') + ' 前往下载';
      launchBtnEl.dataset.mode = 'download';
      
      launchBtnEl.classList.add('no-game');
    }
  }
}


export const VERSION_HISTORY_FILE: string = 'gpcl_version_history.json';

export const VERSION_HISTORY_PATH: string = 'users';


export async function getVersionHistory(): Promise<Record<string, any>> {
  try {
    if (window.gpcl && typeof window.gpcl.readJsonFile === 'function') {
      const history = await window.gpcl.readJsonFile(VERSION_HISTORY_PATH, VERSION_HISTORY_FILE);
      return history || {};
    }
  } catch (e: any) {
    console.error('从文件读取版本历史失败:', e);
  }
  return {};
}


export async function saveVersionHistory(history: Record<string, any>): Promise<void> {
  if (window.gpcl && typeof window.gpcl.writeJsonFile === 'function') {
    try {
      await window.gpcl.writeJsonFile(VERSION_HISTORY_PATH, VERSION_HISTORY_FILE, history);
    } catch (e: any) {
      console.error('写入版本历史到文件失败:', e);
    }
  }
}


export async function recordVersionLaunch(versionId: string): Promise<void> {
  try {
    const history = await getVersionHistory();
    if (!history[versionId]) {
      history[versionId] = {};
    }
    history[versionId].lastLaunch = Date.now();
    await saveVersionHistory(history);
  } catch (e: any) {
    console.error('记录版本启动时间失败:', e);
  }
}


export async function recordVersionDownload(versionId: string): Promise<void> {
  try {
    const history = await getVersionHistory();
    if (!history[versionId]) {
      history[versionId] = {};
    }
    history[versionId].downloadTime = Date.now();
    history[versionId].lastLaunch = Date.now(); 
    await saveVersionHistory(history);
  } catch (e: any) {
    console.error('记录版本下载时间失败:', e);
  }
}


export async function renderVersionSelectList(): Promise<void> {
  const container: HTMLElement | null = document.getElementById('launch-version-list');
  const countEl: HTMLElement | null = document.getElementById('version-count');
  
  if (!container) return;
  
  try {
    let versions: string[] = [];

    if (window.gpcl && typeof window.gpcl.scanVersions === 'function') {
      try {
        versions = await window.gpcl.scanVersions(null, true);
      } catch (e: any) {
        console.error('调用scanVersions失败:', e);
      }
    }
    
    const history = await getVersionHistory();
    
    if (!versions || versions.length === 0) {
      container.innerHTML = '<div class="version-list-empty">暂无已安装的版本</div>';
      if (countEl) countEl.textContent = '0 个版本';
      return;
    }

    versions.sort((a: string, b: string) => {
      const timeA: number = history[a]?.lastLaunch || history[a]?.downloadTime || 0;
      const timeB: number = history[b]?.lastLaunch || history[b]?.downloadTime || 0;
      return timeB - timeA;
    });
    
    container.innerHTML = '';
    
    versions.forEach((versionId: string, index: number) => {
      const item: HTMLDivElement = document.createElement('div');
      item.className = 'version-item';
      item.dataset.versionId = versionId;

      const itemIcon: string = index === 0 && (history[versionId]?.lastLaunch || history[versionId]?.downloadTime)
        ? icon('star')
        : icon('box');

      const lastTime: number = history[versionId]?.lastLaunch || history[versionId]?.downloadTime;
      let timeText: string = '';
      if (lastTime) {
        const date: Date = new Date(lastTime);
        const now: Date = new Date();
        const diff: number = now.getTime() - date.getTime();
        
        if (diff < 60000) {
          timeText = '刚刚';
        } else if (diff < 3600000) {
          timeText = `${Math.floor(diff / 60000)} 分钟前`;
        } else if (diff < 86400000) {
          timeText = `${Math.floor(diff / 3600000)} 小时前`;
        } else {
          timeText = `${date.getMonth() + 1}/${date.getDate()}`;
        }
      }
      
      item.innerHTML = `
        <span class="version-item-icon">${itemIcon}</span>
        <span class="version-item-id">${versionId}</span>
        <span class="version-item-time">${timeText}</span>
      `;
      
      item.addEventListener('click', () => {
        selectVersion(versionId);
      });
      
      container.appendChild(item);
    });
    
    if (countEl) countEl.textContent = `${versions.length} 个版本`;

    if (!selectedVersionId && versions.length > 0) {
      selectVersion(versions[0]);
    }
  } catch (err: any) {
    container.innerHTML = '<div class="version-list-empty">加载版本列表失败</div>';
    if (countEl) countEl.textContent = '加载失败';
  }
}


export function selectVersion(versionId: string): void {
  selectedVersionId = versionId;

  const items: NodeListOf<Element> = document.querySelectorAll('.version-item');
  items.forEach((item: Element) => {
    item.classList.toggle('selected', (item as HTMLElement).dataset.versionId === versionId);
  });

  const infoEl: HTMLElement | null = document.getElementById('selected-version-info');
  const nameEl: HTMLElement | null = document.getElementById('selected-version-name');

  if (infoEl && nameEl) {
    nameEl.textContent = `Minecraft ${versionId}`;
    infoEl.classList.remove('hidden');
  }

  const displayEl: HTMLElement | null = document.getElementById('selected-version-display');
  const textEl: HTMLElement | null = document.getElementById('selected-version-text');
  if (displayEl && textEl) {
    textEl.textContent = versionId;
    displayEl.classList.remove('hidden');
  }

  updateLaunchButtonState(true);
}


export async function isVersionInstalled(versionId: string): Promise<boolean> {
  try {
    const versions: string[] = await window.gpcl.scanVersions(null, true);
    return versions.includes(versionId);
  } catch {
    return false;
  }
}


export let allVersions: any[] = [];

export let selectedVersionId: string | null = null;


export let modLoaderState: any = {
  forge: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null },
  optifine: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null }
};


export const MOD_LOADER_COMPATIBILITY: Record<string, string[]> = {
  
  forge: ['fabric'],
  fabric: ['forge'],
  
  optifine: ['forge', 'fabric']
};


export async function checkForgeAvailability(mcVersion: string): Promise<{ available: boolean; versions: any[] }> {
  try {
    
    const parts: string[] = mcVersion.split('.');
    const major: number = parseInt(parts[0], 10) || 1;
    const minor: number = parseInt(parts[1], 10) || 0;

    if (major === 1 && minor < 1) {
      return { available: false, versions: [] };
    }

    const result = await window.gpcl.getForgeVersions(mcVersion);
    if (result.success) {
      return { available: result.versions.length > 0, versions: result.versions };
    }
    return { available: false, versions: [] };
  } catch (e: any) {
    console.error('检测 Forge 可用性失败:', e);
    return { available: false, versions: [] };
  }
}


export async function checkAllModLoaders(mcVersion: string): Promise<void> {
  
  modLoaderState = {
    forge: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null },
    optifine: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null }
  };

  const forgeResult = await checkForgeAvailability(mcVersion);
  modLoaderState.forge = { ...modLoaderState.forge, ...forgeResult };

  const optifineResult = await checkOptiFineAvailability(mcVersion);
  modLoaderState.optifine = { ...modLoaderState.optifine, ...optifineResult };

  updateModLoaderUI();
}


export async function checkOptiFineAvailability(mcVersion: string): Promise<{ available: boolean; versions: any[] }> {
  try {
    const result = await window.gpcl.getOptiFineVersions(mcVersion);
    if (result.success) {
      return { available: result.versions.length > 0, versions: result.versions };
    }
    return { available: false, versions: [] };
  } catch (e: any) {
    console.error('检测 OptiFine 可用性失败:', e);
    return { available: false, versions: [] };
  }
}


export function updateModLoaderUI(): void {
  for (const [loader, state] of Object.entries(modLoaderState) as [string, any][]) {
    const card: HTMLElement | null = document.getElementById(`${loader}-option`);
    const badge: HTMLElement | null = document.getElementById(`${loader}-badge`);
    const content: HTMLElement | null = document.getElementById(`${loader}-content`);
    const loading: HTMLElement | null = document.getElementById(`${loader}-loading`);
    const versionsContainer: HTMLElement | null = document.getElementById(`${loader}-versions`);
    const error: HTMLElement | null = document.getElementById(`${loader}-error`);
    
    if (!card || !badge) continue;

    if (state.available) {
      badge.textContent = '可用';
      badge.className = 'detail-option-badge available';
      card.classList.remove('not-available');
    } else {
      badge.textContent = '不可用';
      badge.className = 'detail-option-badge unavailable';
      card.classList.add('not-available');
    }

    if (state.expanded && state.available) {
      if (content) content.classList.remove('hidden');
      if (loading) loading.classList.add('hidden');
      if (error) error.classList.add('hidden');
      if (versionsContainer) versionsContainer.classList.remove('hidden');
      renderModLoaderVersionList(loader, state.versions);
    } else if (state.expanded && !state.available) {
      if (content) content.classList.remove('hidden');
      if (loading) loading.classList.add('hidden');
      if (versionsContainer) versionsContainer.classList.add('hidden');
      if (error) error.classList.remove('hidden');
    } else {
      if (content) content.classList.add('hidden');
    }
  }
}


export function renderModLoaderVersionList(loader: string, versions: any[]): void {
  const container: HTMLElement | null = document.getElementById(`${loader}-versions`);
  if (!container) return;
  
  container.innerHTML = '';
  
  versions.forEach((version: any, index: number) => {
    const item: HTMLDivElement = document.createElement('div');
    item.className = 'detail-option-version-item';
    item.dataset.versionId = version.id;
    item.dataset.version = version.version;

    if (modLoaderState[loader].selectedVersionId === version.id) {
      item.classList.add('selected');
    }
    
    item.innerHTML = `
      <span class="detail-option-version-name">${version.name}</span>
      <span class="detail-option-version-check">${icon('check')}</span>
    `;
    
    item.addEventListener('click', () => selectModLoaderVersion(loader, version.version, version.id));
    
    container.appendChild(item);
  });
}


export function selectModLoaderVersion(loader: string, version: string, versionId: string): void {
  const state = modLoaderState[loader];

  if (state.selectedVersionId === versionId) {
    state.selectedVersionId = null;
    state.selected = null;
  } else {
    state.selectedVersionId = versionId;
    state.selected = version;
  }

  const container: HTMLElement | null = document.getElementById(`${loader}-versions`);
  if (container) {
    const items: NodeListOf<Element> = container.querySelectorAll('.detail-option-version-item');
    items.forEach((item: Element) => {
      item.classList.toggle('selected', (item as HTMLElement).dataset.versionId === state.selectedVersionId);
    });
  }
}


export function updateIncompatibilityUI(): void {
  
}


export function getLoaderDisplayName(loader: string): string {
  const names: Record<string, string> = {
    forge: 'Forge',
    fabric: 'Fabric',
    optifine: 'OptiFine'
  };
  return names[loader] || loader;
}


export function toggleModLoader(loader: string): void {
  const state = modLoaderState[loader];
  const card: HTMLElement | null = document.getElementById(`${loader}-option`);
  const content: HTMLElement | null = document.getElementById(`${loader}-content`);
  const arrow: HTMLElement | null = card?.querySelector('.detail-option-arrow') as HTMLElement | null;
  
  if (!content) return;

  if (!state.available) return;
  
  state.expanded = !state.expanded;
  
  if (state.expanded) {
    if (arrow) arrow.classList.add('expanded');
  } else {
    if (arrow) arrow.classList.remove('expanded');
  }

  updateModLoaderUI();
}


export function bindModLoaderEvents(): void {
  for (const loader of Object.keys(modLoaderState)) {
    const card: HTMLElement | null = document.getElementById(`${loader}-option`);
    if (!card) continue;
    
    const header: HTMLElement | null = card.querySelector('.detail-option-header');
    if (header) {
      header.addEventListener('click', () => toggleModLoader(loader));
    }
  }
}


export function resetModLoaderState(): void {
  modLoaderState = {
    forge: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null },
    optifine: { available: false, versions: [], selected: null, expanded: false, selectedVersionId: null }
  };

  for (const loader of Object.keys(modLoaderState)) {
    const card: HTMLElement | null = document.getElementById(`${loader}-option`);
    const badge: HTMLElement | null = document.getElementById(`${loader}-badge`);
    const content: HTMLElement | null = document.getElementById(`${loader}-content`);
    const loading: HTMLElement | null = document.getElementById(`${loader}-loading`);
    const versions: HTMLElement | null = document.getElementById(`${loader}-versions`);
    const error: HTMLElement | null = document.getElementById(`${loader}-error`);
    const arrow: HTMLElement | null = card?.querySelector('.detail-option-arrow') as HTMLElement | null;
    
    if (card) {
      card.classList.remove('not-available', 'incompatible');
    }
    if (badge) {
      badge.textContent = '检测中...';
      badge.className = 'detail-option-badge';
    }
    if (content) content.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');
    if (versions) versions.classList.add('hidden');
    if (error) error.classList.add('hidden');
    if (arrow) arrow.classList.remove('expanded');
  }
}


export function getCategoryLabel(type: string): string {
  const map: Record<string, string> = { release: '正式版', snapshot: '快照版', old_beta: '老版本 Beta', old_alpha: '老版本 Alpha' };
  return map[type] || type;
}


export function getCategoryIcon(type: string): string {
  const map: Record<string, string> = { release: 'cat-release', snapshot: 'cat-snapshot', old_beta: 'cat-old_beta', old_alpha: 'cat-old_alpha' };
  return `<span class="icon icon-dot ${map[type] || 'cat-other'}"></span>`;
}


export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d: Date = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}


export function renderVersionList(versionMap: Record<string, any[]>): void {
  if (!versionListContainer) return;
  versionListContainer.innerHTML = '';

  const categoryOrder: string[] = ['release', 'snapshot', 'old_beta', 'old_alpha'];
  let totalCount: number = 0;

  categoryOrder.forEach((type: string) => {
    const items = versionMap[type];
    if (!items || items.length === 0) return;
    totalCount += items.length;

    const categoryEl: HTMLDivElement = document.createElement('div');
    categoryEl.className = 'version-category';
    categoryEl.dataset.category = type;

    const isRelease: boolean = type === 'release';
    const header: HTMLDivElement = document.createElement('div');
    header.className = 'version-category-header';
    header.innerHTML = `
      <span class="version-category-arrow ${isRelease ? '' : 'collapsed'}">${icon('chevron')}</span>
      <span class="version-category-icon">${getCategoryIcon(type)}</span>
      <span class="version-category-name">${getCategoryLabel(type)}</span>
      <span class="version-category-count">${items.length} 个版本</span>
    `;

    const body: HTMLDivElement = document.createElement('div');
    body.className = `version-category-items ${isRelease ? '' : 'collapsed'}`;

    items.forEach((v: any) => {
      const item: HTMLDivElement = document.createElement('div');
      item.className = 'version-item';
      item.dataset.versionId = v.id;
      
      const displayName: string = v.displayName || v.id;
      item.innerHTML = `
        <span class="version-item-id">${displayName}</span>
        <span class="version-item-time">${formatDate(v.releaseTime)}</span>
      `;
      item.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        showVersionDetail(v);
      });
      body.appendChild(item);
    });

    header.addEventListener('click', () => {
      const arrow: HTMLElement | null = header.querySelector('.version-category-arrow');
      const isCollapsed: boolean = body.classList.toggle('collapsed');
      if (arrow) arrow.classList.toggle('collapsed', isCollapsed);
    });

    categoryEl.appendChild(header);
    categoryEl.appendChild(body);
    versionListContainer.appendChild(categoryEl);
  });

  if (versionCountLabel) {
    versionCountLabel.textContent = `共 ${totalCount} 个版本`;
  }
}


export function showVersionDetail(version: any): void {
  selectedVersionId = version.id;
  if (versionListSection) versionListSection.classList.add('hidden');
  if (versionDetailPage) versionDetailPage.classList.remove('hidden');

  if (detailDownloadBtn) detailDownloadBtn.disabled = false;

  const idEl: HTMLElement | null = document.getElementById('detail-version-id');
  const typeEl: HTMLElement | null = document.getElementById('detail-version-type');
  const typeLabelEl: HTMLElement | null = document.getElementById('detail-type-label');
  const timeEl: HTMLElement | null = document.getElementById('detail-release-time');

  if (idEl) idEl.textContent = `Minecraft ${version.id}`;
  if (typeEl) typeEl.textContent = getCategoryLabel(version.type);
  if (typeLabelEl) {
    typeLabelEl.innerHTML = getCategoryIcon(version.type);
    typeLabelEl.append(' ' + getCategoryLabel(version.type));
  }
  if (timeEl) timeEl.textContent = formatDate(version.releaseTime) || '未知';

  resetModLoaderState();
  checkAllModLoaders(version.id);
}


export function hideVersionDetail(): void {
  selectedVersionId = null;
  if (versionDetailPage) versionDetailPage.classList.add('hidden');
  if (versionListSection) versionListSection.classList.remove('hidden');
}


export async function loadRemoteVersions(): Promise<void> {
  const refreshBtn: HTMLElement | null = document.getElementById('refresh-btn-page');
  try {
    if (refreshBtn) refreshBtn.classList.add('hidden');
    if (versionListContainer) {
      versionListContainer.innerHTML = '<div class="version-list-loading">正在加载版本列表...</div>';
    }
    
    let versions: any[] = [];

    if (window.gpcl && typeof window.gpcl.getVersionManifest === 'function') {
      try {
        versions = await window.gpcl.getVersionManifest();
      } catch (e: any) {
        console.error('调用getVersionManifest失败:', e);
      }
    }

    if (!versions || versions.length === 0) {
      try {
        if (window.gpcl && typeof window.gpcl.readJsonFile === 'function') {
          const cached = await window.gpcl.readJsonFile('cache', 'remote_versions.json');
          if (cached) {
            versions = cached;
          }
        }
      } catch (e: any) {
        console.error('从文件缓存获取远程版本列表失败:', e);
      }
    }

    if (!versions || versions.length === 0) {
      setStatus('无法获取远程版本列表', 'error');
      if (versionListContainer) {
        versionListContainer.innerHTML = '<div class="version-list-error">无法获取版本列表<br><button class="refresh-btn" style="margin-top:12px;" onclick="loadRemoteVersions()">重试</button></div>';
      }
      if (refreshBtn) refreshBtn.classList.remove('hidden');
      return;
    }

    const versionMap: Record<string, any[]> = {};
    versions.forEach((v: any) => {
      if (!versionMap[v.type]) versionMap[v.type] = [];
      versionMap[v.type].push(v);
    });

    try {
      if (window.gpcl && typeof window.gpcl.writeJsonFile === 'function') {
        await window.gpcl.writeJsonFile('cache', 'remote_versions.json', versions);
      }
    } catch (e: any) {
      console.error('保存远程版本列表到缓存失败:', e);
    }

    allVersions = versions;
    renderVersionList(versionMap);
    setStatus('远程版本列表已加载');
  } catch (err: any) {
    setStatus('无法获取远程版本列表，请检查网络', 'error');
    showToast('版本列表加载失败', err.message || '请检查网络连接', 'error', 'remote-versions-error');
    if (versionListContainer) {
      versionListContainer.innerHTML = '<div class="version-list-error">加载失败，请检查网络连接<br><button class="refresh-btn" style="margin-top:12px;" onclick="loadRemoteVersions()">重试</button></div>';
    }
    if (refreshBtn) refreshBtn.classList.remove('hidden');
  }
}


if (detailBackBtn) {
  detailBackBtn.addEventListener('click', hideVersionDetail);
}


if (detailDownloadBtn) {
  detailDownloadBtn.addEventListener('click', () => {
    if (selectedVersionId) {
      startDownload(selectedVersionId);
    }
  });
}

