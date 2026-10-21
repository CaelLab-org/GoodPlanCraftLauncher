/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { escapeHtml, setStatus, showToast } from './dom';
import { startModpackInstall } from './launch';
import { allVersions, loadVersions, renderVersionSelectList, selectedVersionId } from './versions';
// __IMPORTS_END__

const tabVersions: HTMLElement | null = document.getElementById('download-tab-versions');
const tabMods: HTMLElement | null = document.getElementById('download-tab-mods');
const tabShaders: HTMLElement | null = document.getElementById('download-tab-shaders');
const tabResourcepacks: HTMLElement | null = document.getElementById('download-tab-resourcepacks');
const tabModpacks: HTMLElement | null = document.getElementById('download-tab-modpacks');
const modSection: HTMLElement | null = document.getElementById('mod-download-section');
const versionSection: HTMLElement | null = document.getElementById('version-list-section');
const versionDetail: HTMLElement | null = document.getElementById('version-detail-page');
const javaSection: HTMLElement | null = document.getElementById('java-download-section');
const searchInput: HTMLInputElement | null = document.getElementById('mod-search-input') as HTMLInputElement | null;
const searchBtn: HTMLElement | null = document.getElementById('mod-search-btn');
const gameVersionSelect: HTMLSelectElement | null = document.getElementById('mod-game-version') as HTMLSelectElement | null;
const loaderSelect: HTMLSelectElement | null = document.getElementById('mod-loader') as HTMLSelectElement | null;
const sourceSelect: HTMLSelectElement | null = document.getElementById('mod-source') as HTMLSelectElement | null;
const modStatus: HTMLElement | null = document.getElementById('mod-status');
const resultsEl: HTMLElement | null = document.getElementById('mod-results');
const detailEl: HTMLElement | null = document.getElementById('mod-detail');
const detailHead: HTMLElement | null = document.getElementById('mod-detail-head');
const detailVersions: HTMLElement | null = document.getElementById('mod-detail-versions');
const detailBack: HTMLElement | null = document.getElementById('mod-detail-back');

const targetOverlay: HTMLElement | null = document.getElementById('mod-target-overlay');
const targetFile: HTMLElement | null = document.getElementById('mod-target-file');
const targetList: HTMLElement | null = document.getElementById('mod-target-list');
const targetBrowse: HTMLElement | null = document.getElementById('mod-target-browse');
const targetCancel: HTMLElement | null = document.getElementById('mod-target-cancel');
const targetConfirm: HTMLButtonElement | null = document.getElementById('mod-target-confirm') as HTMLButtonElement | null;
const targetClose: HTMLElement | null = document.getElementById('mod-target-close');

const packOverlay: HTMLElement | null = document.getElementById('modpack-name-overlay');
const packFile: HTMLElement | null = document.getElementById('modpack-name-file');
const packNameInput: HTMLInputElement | null = document.getElementById('modpack-name-input') as HTMLInputElement | null;
const packConfirm: HTMLButtonElement | null = document.getElementById('modpack-name-confirm') as HTMLButtonElement | null;
const packCancel: HTMLElement | null = document.getElementById('modpack-name-cancel');
const packClose: HTMLElement | null = document.getElementById('modpack-name-close');

type TargetChoice = { kind: 'version'; id: string; label: string } | { kind: 'dir'; dir: string; label: string };
type ResourceProjectType = 'mod' | 'shader' | 'resourcepack' | 'modpack';

interface ResourceTypeConfig {
  label: string;
  folder: string;
  placeholder: string;
  empty: string;
}

const RESOURCE_TYPES: Record<ResourceProjectType, ResourceTypeConfig> = {
  mod: {
    label: '模组',
    folder: 'mods',
    placeholder: '搜索模组；也可以粘贴 CurseForge 项目链接',
    empty: '没有找到模组。换个关键词试试，或者把筛选改回「全部版本」。'
  },
  shader: {
    label: '光影',
    folder: 'shaderpacks',
    placeholder: '搜索光影，例如 Complementary、BSL、Photon',
    empty: '没有找到光影。换个关键词试试，或者把筛选改回「全部版本」。'
  },
  resourcepack: {
    label: '资源包',
    folder: 'resourcepacks',
    placeholder: '搜索资源包，例如 Faithful、Stay True、Xray',
    empty: '没有找到资源包。换个关键词试试，或者把筛选改回「全部版本」。'
  },
  modpack: {
    label: '整合包',
    folder: 'versions',
    placeholder: '搜索整合包，例如 Create、RLCraft、Better MC',
    empty: '没有找到整合包。换个关键词试试，或者把筛选改回「全部版本」。'
  }
};

let currentProjectType: ResourceProjectType = 'mod';

let currentProject: any = null;
let installedVersions: any[] = [];
let targetChoice: TargetChoice | null = null;
let targetResolve: ((choice: TargetChoice | null) => void) | null = null;

function setModStatus(text: string, type: string = 'muted'): void {
  if (!modStatus) return;
  modStatus.textContent = text;
  modStatus.dataset.type = type;
}

function formatCount(count: number): string {
  if (!count) return '0';
  if (count >= 100000000) return `${(count / 100000000).toFixed(2).replace(/\.0+$/, '')} 亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')} 万`;
  return String(count);
}

function relativeTime(dateText: string): string {
  if (!dateText) return '';
  const time: number = new Date(dateText).getTime();
  if (isNaN(time)) return '';
  const days: number = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  if (days < 1) return '今天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

async function loadInstalledVersions(): Promise<void> {
  try {
    const result: any = await window.gpcl.listInstalledVersions();
    installedVersions = result?.success ? (result.versions || []) : [];
  } catch {
    installedVersions = [];
  }
}

function populateGameVersions(): void {
  if (!gameVersionSelect) return;
  const current: string = gameVersionSelect.value;
  gameVersionSelect.innerHTML = '';

  const all: HTMLOptionElement = document.createElement('option');
  all.value = '';
  all.textContent = '全部版本';
  gameVersionSelect.appendChild(all);

  const releases: string[] = (allVersions || [])
    .filter((v: any) => v.type === 'release')
    .map((v: any) => v.id);

  for (const id of releases) {
    const opt: HTMLOptionElement = document.createElement('option');
    opt.value = id;
    opt.textContent = `Minecraft ${id}`;
    gameVersionSelect.appendChild(opt);
  }

  gameVersionSelect.value = current && releases.includes(current) ? current : '';
}

function showResourceTab(projectType: ResourceProjectType): void {
  currentProjectType = projectType;
  const config: ResourceTypeConfig = RESOURCE_TYPES[projectType];

  tabVersions?.classList.remove('active');
  tabMods?.classList.toggle('active', projectType === 'mod');
  tabShaders?.classList.toggle('active', projectType === 'shader');
  tabResourcepacks?.classList.toggle('active', projectType === 'resourcepack');
  tabModpacks?.classList.toggle('active', projectType === 'modpack');
  modSection?.classList.remove('hidden');
  versionSection?.classList.add('hidden');
  versionDetail?.classList.add('hidden');
  javaSection?.classList.add('hidden');

  if (searchInput) searchInput.placeholder = config.placeholder;
  loaderSelect?.classList.toggle('hidden', projectType !== 'mod');

  projectStack = [];
  currentDetail = null;
  detailEl?.classList.add('hidden');
  resultsEl?.classList.remove('hidden');
  populateGameVersions();
  void loadInstalledVersions().then(() => void searchMods());
}


function showModTab(): void {
  showResourceTab('mod');
}


function showVersionTab(): void {
  tabMods?.classList.remove('active');
  tabShaders?.classList.remove('active');
  tabResourcepacks?.classList.remove('active');
  tabModpacks?.classList.remove('active');
  tabVersions?.classList.add('active');
  modSection?.classList.add('hidden');
  versionSection?.classList.remove('hidden');
  javaSection?.classList.remove('hidden');
  detailEl?.classList.add('hidden');
  resultsEl?.classList.remove('hidden');
}

export function resetToVersionTab(): void {
  showVersionTab();
}

function parseCurseForgeSlug(input: string): string | null {
  const text: string = input.trim();
  const inline: RegExpMatchArray | null = text.match(/^cf:(.+)$/i);
  if (inline) return inline[1].trim();
  const url: RegExpMatchArray | null = text.match(/curseforge\.com\/minecraft\/mc-mods\/([^/?#\s]+)/i);
  if (url) return url[1];
  return null;
}

function currentFilters(): { gameVersion: string; loader: string } {
  return {
    gameVersion: gameVersionSelect?.value || '',
    loader: currentProjectType === 'mod' ? (loaderSelect?.value || '') : ''
  };
}

function preferredGameVersion(): string {
  const current: any = installedVersions.find((v: any) => v.id === selectedVersionId);
  return current?.mcVersion || '';
}

async function lookupCurseForge(slug: string): Promise<void> {
  if (!resultsEl || !detailEl || !detailHead || !detailVersions) return;
  resultsEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
  detailHead.innerHTML = '<div class="mod-detail-title">正在读取 CurseForge 项目…</div>';
  detailVersions.innerHTML = '';
  setModStatus('正在读取 CurseForge 项目…');

  try {
    const filters = currentFilters();
    const result: any = await window.gpcl.curseforgeLookup({ slug, ...filters, preferGameVersion: preferredGameVersion() });
    if (!result || !result.success) {
      detailHead.innerHTML = `<div class="mod-detail-title">CurseForge</div><div class="mod-detail-desc">${escapeHtml(result?.error || '读取失败')}</div>`;
      detailVersions.innerHTML = '<div class="mod-empty">检查一下链接里的项目短名，或者改用搜索</div>';
      setModStatus(result?.error || '读取失败', 'error');
      return;
    }

    projectStack = [result.project];
    currentProject = result.project;
    detailHead.innerHTML = `
      <img src="${escapeHtml(result.project.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
      <div class="mod-detail-info">
        <div class="mod-detail-title">${escapeHtml(result.project.title)} <span class="mod-source-tag">CurseForge</span></div>
        <div class="mod-detail-meta">${escapeHtml(result.project.author || '')}${result.project.downloads ? ` · ${formatCount(result.project.downloads)} 次下载` : ''}</div>
        <div class="mod-detail-desc">${escapeHtml(result.project.description || '')}</div>
      </div>
    `;
    resultsEl.innerHTML = '<div class="mod-empty">链接模式：返回后可以继续搜索</div>';
    renderDetail(result.project, result.versions || []);
    setModStatus(`共 ${result.total || 0} 个可用文件 · 链接模式不自动安装依赖`, 'muted');
  } catch (e: any) {
    detailHead.innerHTML = `<div class="mod-detail-title">CurseForge</div><div class="mod-detail-desc">${escapeHtml(e.message || '读取失败')}</div>`;
    setModStatus(e.message || '读取失败', 'error');
  }
}

async function searchMods(): Promise<void> {
  if (!resultsEl) return;
  const query: string = (searchInput?.value || '').trim();
  const filters = currentFilters();
  const source: 'modrinth' | 'curseforge' | 'both' = ((sourceSelect?.value as any) || 'both') as 'modrinth' | 'curseforge' | 'both';

  const curseForgeSlug: string | null = currentProjectType === 'mod' ? parseCurseForgeSlug(query) : null;
  if (curseForgeSlug) {
    if (searchBtn) (searchBtn as HTMLButtonElement).disabled = true;
    try {
      await lookupCurseForge(curseForgeSlug);
    } finally {
      if (searchBtn) (searchBtn as HTMLButtonElement).disabled = false;
    }
    return;
  }

  projectStack = [];
  detailEl?.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = '<div class="mod-empty">正在搜索…</div>';
  setModStatus('正在搜索…');
  if (searchBtn) (searchBtn as HTMLButtonElement).disabled = true;

  try {
    const result: any = await window.gpcl.modsSearch({ source, query, ...filters, projectType: currentProjectType, offset: 0, limit: 20 });
    if (!result || !result.success) {
      const hint: string = currentProjectType === 'mod' ? '<br><span class="mod-link-hint">也可以把 CurseForge 项目链接粘贴到搜索框</span>' : '';
      resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || '搜索失败')}${hint}</div>`;
      setModStatus(result?.error || '搜索失败', 'error');
      return;
    }

    if (!result.items || result.items.length === 0) {
      resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(RESOURCE_TYPES[currentProjectType].empty)}</div>`;
    } else {
      if (result.translatedTo && result.translatedFrom) {
        const english: string = String(result.translatedTo).toLowerCase();
        for (const item of result.items) {
          const title: string = String(item.title || '').toLowerCase();
          if (title.includes(english) || english.includes(title)) item.chineseName = result.translatedFrom;
        }
      }
      renderResults(result.items);
    }

    const notes: string[] = [];
    if (result.translatedTo) notes.push(`已按「${result.translatedTo}」搜索`);
    const errors: string[] = Array.isArray(result.errors) ? result.errors : [];
    if (errors.length > 0) notes.push('CurseForge 暂时不可用');
    const total: number = result.total || result.items.length;
    notes.push(total > result.items.length ? `找到 ${total} 个结果，先显示前 ${result.items.length} 个` : `找到 ${total} 个结果`);
    setModStatus(notes.join(' · '), 'muted');
  } catch (e: any) {
    resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(e.message || '搜索失败')}</div>`;
    setModStatus(e.message || '搜索失败', 'error');
  } finally {
    if (searchBtn) (searchBtn as HTMLButtonElement).disabled = false;
  }
}

function renderResults(items: any[]): void {
  if (!resultsEl) return;
  resultsEl.innerHTML = '';

  for (const item of items) {
    const card: HTMLDivElement = document.createElement('div');
    card.className = 'mod-card';
    card.innerHTML = `
      <img class="mod-card-icon" src="${escapeHtml(item.iconUrl || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="mod-card-body">
        <div class="mod-card-title">
          <span>${escapeHtml(item.chineseName || item.title)}</span>
          ${item.chineseName ? `<span class="mod-card-en">${escapeHtml(item.title)}</span>` : ''}
          <span class="mod-source-tag">${item.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}</span>
        </div>
        <div class="mod-card-desc">${escapeHtml(item.description || '')}</div>
        <div class="mod-card-meta">${escapeHtml(item.author || '')} · ${formatCount(item.downloads)} 次下载${item.categories?.length ? ` · ${escapeHtml(item.categories.slice(0, 3).join(' / '))}` : ''}</div>
      </div>
    `;
    card.addEventListener('click', () => void openProject(item));
    resultsEl.appendChild(card);
  }
}

const CATEGORY_NAMES: Record<string, string> = {
  adventure: '冒险',
  decoration: '装饰',
  equipment: '装备',
  food: '食物',
  magic: '魔法',
  optimization: '优化',
  technology: '科技',
  worldgen: '世界生成',
  utility: '实用',
  library: '支持库',
  mobs: '生物',
  storage: '存储',
  transportation: '交通',
  combat: '战斗',
  mobs_and_creatures: '生物',
  game_mechanics: '游戏机制'
};

let currentDetail: { item: any; versions: any[]; groups: Map<string, any[]>; depCache: Map<string, any[]> } | null = null;
let activeMcTab: string = '全部';
const IMPLICIT_FABRIC_API: string = 'P7dR8mSH';

function categoryLabel(list: string[]): string {
  return (list || []).slice(0, 4).map((c: string) => CATEGORY_NAMES[String(c).toLowerCase()] || c).join(' · ');
}

function compareMcVersion(a: string, b: string): number {
  const pa: number[] = a.split(/[.-]/).map((x: string) => parseInt(x, 10) || 0);
  const pb: number[] = b.split(/[.-]/).map((x: string) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d: number = (pb[i] || 0) - (pa[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function copyToClipboard(text: string): void {
  const done = (): void => showToast('已复制名称', text, 'success', 'mod-name-copied');
  try {
    void navigator.clipboard.writeText(text).then(done).catch(() => {
      const area: HTMLTextAreaElement = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      done();
    });
  } catch {
    done();
  }
}

function projectWebUrl(item: any): string {
  const projectType: ResourceProjectType = item.projectType || currentProjectType;
  if (item.source === 'curseforge') {
    const section: string = projectType === 'shader' ? 'shaders'
      : projectType === 'resourcepack' ? 'texture-packs'
      : projectType === 'modpack' ? 'modpacks'
      : 'mc-mods';
    return item.slug ? `https://www.curseforge.com/minecraft/${section}/${item.slug}` : '';
  }
  return `https://modrinth.com/${projectType}/${item.slug || item.id}`;
}

function renderProjectHeader(item: any, versions: any[]): void {
  if (!detailHead) return;
  const chinese: string = String(item.chineseName || '');
  const title: string = String(item.title || '');
  const display: string = chinese || title;
  const alternate: string = chinese && title ? ` | ${title}` : '';
  const versionsList: string[] = Array.from(new Set(
    (versions || []).flatMap((v: any) => v.gameVersions || [])
  )).filter(Boolean).sort(compareMcVersion);
  const versionSummary: string = versionsList.slice(0, 4).join(', ') + (versionsList.length > 4 ? ' …' : '');
  const loadersList: string[] = Array.from(new Set(
    (versions || []).flatMap((v: any) => v.loaders || [])
  )).filter(Boolean);
  const loaderSummary: string = loadersList.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)).join(' / ');
  const webUrl: string = projectWebUrl(item);
  const mcmodUrl: string = `https://www.mcmod.cn/s?key=${encodeURIComponent(display)}`;

  detailHead.innerHTML = `
    <img src="${escapeHtml(item.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
    <div class="mod-detail-info">
      <div class="mod-detail-title">
        <span class="mod-detail-cn">${escapeHtml(display)}</span>
        ${alternate ? `<span class="mod-detail-en">${escapeHtml(alternate)}</span>` : ''}
      </div>
      <div class="mod-detail-meta">
        ${categoryLabel(item.categories || []) ? `${escapeHtml(categoryLabel(item.categories || []))} · ` : ''}
        ${loaderSummary ? `${escapeHtml(loaderSummary)} ` : ''}${versionSummary ? `${escapeHtml(versionSummary)} · ` : ''}
        ${formatCount(item.downloads || 0)} 次下载
        <span class="mod-source-tag">${item.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}</span>
      </div>
      <div class="mod-detail-desc">${escapeHtml(item.description || '')}</div>
      <div class="mod-detail-actions">
        ${webUrl ? `<button class="mod-detail-action" data-act="web" type="button">转到 ${item.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}</button>` : ''}
        ${(item.projectType || currentProjectType) === 'mod' ? '<button class="mod-detail-action" data-act="mcmod" type="button">转到 MC 百科</button>' : ''}
        <button class="mod-detail-action" data-act="copy" type="button">复制名称</button>
      </div>
    </div>
  `;

  const webBtn: HTMLButtonElement | null = detailHead.querySelector('[data-act="web"]') as HTMLButtonElement | null;
  if (webBtn && webUrl) webBtn.addEventListener('click', () => void window.gpcl.openExternal(webUrl));
  const mcmodBtn: HTMLButtonElement | null = detailHead.querySelector('[data-act="mcmod"]') as HTMLButtonElement | null;
  if (mcmodBtn) mcmodBtn.addEventListener('click', () => void window.gpcl.openExternal(mcmodUrl));
  const copyBtn: HTMLButtonElement | null = detailHead.querySelector('[data-act="copy"]') as HTMLButtonElement | null;
  if (copyBtn) copyBtn.addEventListener('click', () => copyToClipboard(display));
}

function groupVersionsByMc(versions: any[]): Map<string, any[]> {
  const groups: Map<string, any[]> = new Map();
  for (const version of versions) {
    const supported: string[] = (version.gameVersions || []).filter(Boolean);
    for (const mc of (supported.length > 0 ? supported : ['通用'])) {
      if (!groups.has(mc)) groups.set(mc, []);
      groups.get(mc)!.push(version);
    }
  }
  return groups;
}

function versionRow(item: any, version: any): HTMLDivElement {
  const row: HTMLDivElement = document.createElement('div');
  row.className = 'mod-version-row';
  const gameVersions: string = (version.gameVersions || []).slice(0, 3).join(', ') || '通用';
  const loaders: string = (version.loaders || []).join(' / ');
  const isFabricFile: boolean = (version.loaders || []).includes('fabric');
  const isMod: boolean = (item.projectType || currentProjectType) === 'mod';
  const depCount: number = isMod ? (version.dependencies || []).filter((d: any) =>
    d.type === 'required' && !(isFabricFile && String(d.projectId) === IMPLICIT_FABRIC_API)).length : 0;
  row.innerHTML = `
    <div class="mod-version-info">
      <div class="mod-version-name" title="${escapeHtml(version.fileName || version.name)}">${escapeHtml(version.name || version.fileName)}</div>
      <div class="mod-version-meta">${escapeHtml(gameVersions)}${loaders ? ` · ${escapeHtml(loaders)}` : ''}${version.fileSize ? ` · ${(version.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}${depCount ? ` · ${depCount} 项前置` : ''}${version.date ? ` · 更新于 ${relativeTime(version.date)}` : ''}</div>
    </div>
    <button class="mod-install-btn" type="button">安装</button>
  `;
  const btn: HTMLButtonElement | null = row.querySelector('.mod-install-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.addEventListener('click', () => {
      if ((item.projectType || currentProjectType) === 'modpack') installModpack(item, version, btn);
      else void installMod(item, version, btn);
    });
  }
  return row;
}

async function loadDependencies(section: HTMLElement, mcVersion: string, files: any[], item: any): Promise<void> {
  const container: HTMLElement | null = section.querySelector('.mod-deps-list') as HTMLElement | null;
  if (!container) return;
  if (container.dataset.loaded === '1') return;

  const fabricGroup: boolean = files.some((v: any) => (v.loaders || []).includes('fabric'));
  const ids: string[] = Array.from(new Set(
    files.flatMap((v: any) => (v.dependencies || [])
      .filter((d: any) => d.type === 'required' && d.projectId && !(fabricGroup && String(d.projectId) === IMPLICIT_FABRIC_API))
      .map((d: any) => String(d.projectId)))
  ));
  if (ids.length === 0) {
    container.dataset.loaded = '1';
    container.innerHTML = '<div class="mod-deps-empty">没有必需的前置</div>';
    return;
  }

  container.innerHTML = '<div class="mod-deps-empty">正在读取前置…</div>';
  const loader: string = (files[0]?.loaders || [])[0] || '';

  try {
    const result: any = await window.gpcl.modsProjectInfo({
      source: item.source,
      ids,
      gameVersion: mcVersion,
      loader
    });
    const projects: any[] = result?.success ? (result.projects || []) : [];
    container.dataset.loaded = '1';
    if (projects.length === 0) {
      container.innerHTML = '<div class="mod-deps-empty">没有读取到前置信息</div>';
      return;
    }

    container.innerHTML = '';
    for (const dep of projects) {
      const card: HTMLDivElement = document.createElement('div');
      card.className = 'mod-dep-card';
      card.innerHTML = `
        <img src="${escapeHtml(dep.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
        <div class="mod-dep-info">
          <div class="mod-dep-name">${escapeHtml(dep.title)}${(dep.categories || []).some((c: string) => String(c).toLowerCase() === 'library') ? ' <span class="mod-dep-tag">支持库</span>' : ''}</div>
          <div class="mod-dep-desc">${escapeHtml(dep.description || '')}</div>
          <div class="mod-dep-meta">${formatCount(dep.downloads || 0)} 次下载${dep.updatedAt ? ` · 更新于 ${relativeTime(dep.updatedAt)}` : ''} · ${dep.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}</div>
        </div>
      `;
      card.addEventListener('click', () => void openProject({
        source: dep.source,
        id: dep.id,
        slug: dep.slug,
        title: dep.title,
        description: dep.description,
        iconUrl: dep.iconUrl,
        downloads: dep.downloads,
        categories: dep.categories
      }));
      container.appendChild(card);
    }
  } catch (e: any) {
    container.dataset.loaded = '1';
    container.innerHTML = `<div class="mod-deps-empty">前置信息读取失败：${escapeHtml(e.message || '未知错误')}</div>`;
  }
}

function renderMcSection(mcVersion: string, files: any[], item: any, expanded: boolean): HTMLElement {
  const section: HTMLElement = document.createElement('div');
  section.className = 'mod-mc-section';
  section.dataset.mc = mcVersion;
  const isMod: boolean = (item.projectType || currentProjectType) === 'mod';

  const head: HTMLButtonElement = document.createElement('button');
  head.className = 'mod-mc-section-head';
  head.type = 'button';
  head.innerHTML = `<span>${escapeHtml(mcVersion)}</span><span class="icon icon-chevron mod-mc-chevron${expanded ? ' expanded' : ''}"></span>`;

  const body: HTMLDivElement = document.createElement('div');
  body.className = `mod-mc-section-body${expanded ? '' : ' hidden'}`;
  body.innerHTML = `
    ${isMod ? '<div class="mod-deps-block"><div class="mod-deps-title">前置资源</div><div class="mod-deps-list"></div></div>' : ''}
    <div class="mod-version-heading">版本列表</div>
  `;

  const list: HTMLDivElement = document.createElement('div');
  list.className = 'mod-version-list';
  for (const version of files) list.appendChild(versionRow(item, version));
  body.appendChild(list);

  head.addEventListener('click', () => {
    const isHidden: boolean = body.classList.toggle('hidden');
    head.querySelector('.mod-mc-chevron')?.classList.toggle('expanded', !isHidden);
    if (!isHidden && isMod) void loadDependencies(section, mcVersion, files, item);
  });

  section.appendChild(head);
  section.appendChild(body);
  if (expanded && isMod) void loadDependencies(section, mcVersion, files, item);
  return section;
}

function renderDetailBody(): void {
  if (!detailVersions || !currentDetail) return;
  detailVersions.innerHTML = '';
  const groups: Map<string, any[]> = currentDetail.groups;
  const mcVersions: string[] = Array.from(groups.keys()).filter((v: string) => v !== '通用').sort(compareMcVersion);
  const tabs: string[] = ['全部', ...mcVersions];

  const tabBar: HTMLDivElement = document.createElement('div');
  tabBar.className = 'mod-mc-tabs';
  for (const tab of tabs) {
    const btn: HTMLButtonElement = document.createElement('button');
    btn.className = `mod-mc-tab${tab === activeMcTab ? ' active' : ''}`;
    btn.type = 'button';
    btn.textContent = tab;
    btn.addEventListener('click', () => {
      activeMcTab = tab;
      renderDetailBody();
    });
    tabBar.appendChild(btn);
  }
  detailVersions.appendChild(tabBar);

  if (activeMcTab === '全部') {
    for (const mc of mcVersions) {
      detailVersions.appendChild(renderMcSection(mc, groups.get(mc) || [], currentDetail.item, false));
    }
    if (groups.has('通用')) {
      detailVersions.appendChild(renderMcSection('通用', groups.get('通用') || [], currentDetail.item, false));
    }
  } else {
    detailVersions.appendChild(renderMcSection(activeMcTab, groups.get(activeMcTab) || [], currentDetail.item, true));
  }
}

function renderDetail(item: any, versions: any[]): void {
  currentDetail = {
    item,
    versions,
    groups: groupVersionsByMc(versions),
    depCache: new Map()
  };
  activeMcTab = '全部';
  renderProjectHeader(item, versions);
  renderDetailBody();
}

let projectStack: any[] = [];

async function openProject(item: any, keepStack: boolean = false): Promise<void> {
  currentProject = item;
  if (!item.projectType) item.projectType = currentProjectType;
  if (!resultsEl || !detailEl || !detailHead || !detailVersions) return;
  if (!keepStack) projectStack.push(item);
  await loadInstalledVersions();

  resultsEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
  renderProjectHeader(item, []);
  detailVersions.innerHTML = '<div class="mod-empty">正在获取可用文件…</div>';
  setModStatus('正在获取可用文件…');

  try {
    const result: any = await window.gpcl.modsVersions({
      source: item.source,
      projectId: item.id,
      projectType: item.projectType || currentProjectType,
      ...currentFilters(),
      preferGameVersion: preferredGameVersion()
    });
    if (!result || !result.success) {
      detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || '获取文件失败')}</div>`;
      setModStatus(result?.error || '获取文件失败', 'error');
      return;
    }
    setModStatus('');
    renderDetail(item, result.versions || []);
  } catch (e: any) {
    detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(e.message || '获取文件失败')}</div>`;
    setModStatus(e.message || '获取文件失败', 'error');
  }
}

function versionMatches(version: any, target: any, projectType: ResourceProjectType = 'mod'): { game: boolean; loader: boolean } {
  const gameVersions: string[] = version.gameVersions || [];
  const loaders: string[] = version.loaders || [];
  const game: boolean = gameVersions.length === 0 || gameVersions.includes(target.mcVersion);
  const loader: boolean = projectType !== 'mod'
    || loaders.length === 0
    || loaders.some((l: string) => (target.loaders || []).includes(l));
  return { game, loader };
}

function closeTargetPicker(choice: TargetChoice | null): void {
  targetOverlay?.classList.add('hidden');
  const resolve = targetResolve;
  targetResolve = null;
  targetChoice = null;
  if (resolve) resolve(choice);
}

function selectTarget(choice: TargetChoice): void {
  targetChoice = choice;
  targetList?.querySelectorAll('.mod-target-item').forEach((el: Element) => {
    el.classList.toggle('selected', (el as HTMLElement).dataset.key === `${choice.kind}:${choice.kind === 'version' ? choice.id : choice.dir}`);
  });
  if (targetConfirm) targetConfirm.disabled = false;
}

function renderCustomDir(dir: string): void {
  if (!targetList) return;
  let row: HTMLElement | null = targetList.querySelector('.mod-target-custom') as HTMLElement | null;
  if (!row) {
    row = document.createElement('div');
    row.className = 'mod-target-item mod-target-custom';
    targetList.prepend(row);
  }
  row.dataset.key = `dir:${dir}`;
  row.innerHTML = `
    <div class="mod-target-name">自定义目录</div>
    <div class="mod-target-meta">${escapeHtml(dir)}</div>
  `;
  row.onclick = () => selectTarget({ kind: 'dir', dir, label: dir });
  selectTarget({ kind: 'dir', dir, label: dir });
}

async function openTargetPicker(fileLabel: string, version: any, projectType: ResourceProjectType): Promise<TargetChoice | null> {
  if (!targetOverlay || !targetList || !targetFile) return null;

  await loadInstalledVersions();
  targetFile.textContent = fileLabel;
  targetList.innerHTML = '';
  targetChoice = null;
  if (targetConfirm) targetConfirm.disabled = true;

  const candidates: any[] = projectType === 'mod'
    ? installedVersions.filter((v: any) => v.hasModLoader || v.hasOptiFine)
    : installedVersions;
  candidates.sort((a: any, b: any) => {
    const ca = versionMatches(version, a, projectType);
    const cb = versionMatches(version, b, projectType);
    const score = (v: any, c: any): number =>
      (v.id === selectedVersionId ? 8 : 0) + (c.game ? 4 : 0) + (c.loader ? 2 : 0);
    return score(b, cb) - score(a, ca) || b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  if (candidates.length === 0) {
    const message: string = projectType === 'mod'
      ? '还没有带 Mod 加载器的版本。先去下载页装一个 Fabric / Forge / NeoForge 版本，或者直接选择文件夹。'
      : `还没有安装任何游戏版本。先装一个版本，或者直接选择文件夹。${RESOURCE_TYPES[projectType].label}会放进它的 ${RESOURCE_TYPES[projectType].folder} 文件夹。`;
    targetList.innerHTML = `<div class="mod-empty">${message}</div>`;
  }

  for (const target of candidates) {
    const compat = versionMatches(version, target, projectType);
    const loaderLabel: string = (target.loaders || []).length ? target.loaders.join(' / ') : (target.hasOptiFine ? 'OptiFine' : '原版');
    const notes: string[] = [];
    if (target.id === selectedVersionId) notes.push('当前启动');
    if (!compat.game) notes.push('游戏版本不匹配');
    if (!compat.loader) notes.push('加载器不匹配');
    if (projectType === 'mod' && !target.isolated) notes.push('首次安装会启用版本隔离');

    const row: HTMLDivElement = document.createElement('div');
    row.className = 'mod-target-item';
    row.dataset.key = `version:${target.id}`;
    row.innerHTML = `
      <div class="mod-target-name">${escapeHtml(target.id)}</div>
      <div class="mod-target-meta">Minecraft ${escapeHtml(target.mcVersion)} · ${escapeHtml(loaderLabel)}</div>
      ${notes.length ? `<div class="mod-target-notes">${notes.map((n: string) => `<span>${escapeHtml(n)}</span>`).join('')}</div>` : ''}
    `;
    row.addEventListener('click', () => selectTarget({ kind: 'version', id: target.id, label: target.id }));
    row.addEventListener('dblclick', () => {
      selectTarget({ kind: 'version', id: target.id, label: target.id });
      void confirmTarget();
    });
    targetList.appendChild(row);
  }

  const preferred: any = candidates.find((v: any) => v.id === selectedVersionId)
    || candidates.find((v: any) => { const c = versionMatches(version, v, projectType); return c.game && c.loader; })
    || candidates[0];
  if (preferred) selectTarget({ kind: 'version', id: preferred.id, label: preferred.id });

  targetOverlay.classList.remove('hidden');

  return new Promise<TargetChoice | null>((resolve) => {
    targetResolve = resolve;
  });
}

async function confirmTarget(): Promise<void> {
  if (!targetChoice) return;
  closeTargetPicker(targetChoice);
}

let packResolve: ((name: string | null) => void) | null = null;

function closePackPrompt(name: string | null): void {
  packOverlay?.classList.add('hidden');
  const resolve = packResolve;
  packResolve = null;
  if (resolve) resolve(name);
}

function confirmPackPrompt(): void {
  const value: string = (packNameInput?.value || '').trim();
  if (!value) {
    packNameInput?.focus();
    return;
  }
  closePackPrompt(value);
}

async function promptModpackName(item: any, version: any): Promise<string | null> {
  if (!packOverlay || !packNameInput) return null;
  const base: string = String(item.title || item.slug || '整合包');
  const versionNumber: string = String(version?.versionNumber || '');
  if (packFile) packFile.textContent = version?.fileName || item.title || '';
  packNameInput.value = (versionNumber ? `${base} ${versionNumber}` : base).slice(0, 64);
  packOverlay.classList.remove('hidden');
  packNameInput.focus();
  packNameInput.select();
  return new Promise<string | null>((resolve) => {
    packResolve = resolve;
  });
}

function installModpack(item: any, version: any, btn: HTMLButtonElement): void {
  void (async (): Promise<void> => {
    const instanceName: string | null = await promptModpackName(item, version);
    if (!instanceName) return;

    startModpackInstall({
      source: item.source,
      projectId: String(item.id),
      versionId: String(version.id || ''),
      gameVersion: (version.gameVersions || [])[0] || currentFilters().gameVersion,
      instanceName
    });
    showToast('已加入下载队列', `整合包：${instanceName}`, 'success', 'modpack-queued');
    setModStatus(`整合包「${instanceName}」已加入下载队列`, 'success');
    if (btn) btn.textContent = '已加入队列';
  })();
}

async function installMod(item: any, version: any, btn: HTMLButtonElement): Promise<void> {
  const projectType: ResourceProjectType = item.projectType || currentProjectType;
  const fileLabel: string = version.fileName || version.name || `${RESOURCE_TYPES[projectType].label}文件`;
  const choice: TargetChoice | null = await openTargetPicker(fileLabel, version, projectType);
  if (!choice) return;

  const originalText: string = btn.textContent || '安装';
  btn.disabled = true;
  btn.textContent = '安装中…';
  setModStatus(`正在下载 ${fileLabel}…`);

  try {
    const targetVersionId: string = choice.kind === 'version' ? choice.id : '';
    const targetDir: string = choice.kind === 'dir' ? choice.dir : '';

    const depGameVersion: string = (version.gameVersions || [])[0] || currentFilters().gameVersion;
    const depLoader: string = (version.loaders || [])[0] || currentFilters().loader;
    const result: any = item.direct
      ? await window.gpcl.modsInstallDirect({ url: version.downloadUrl, fileName: version.fileName, targetVersionId, targetDir, projectType })
      : await window.gpcl.modsInstall({
          source: item.source,
          projectId: item.id,
          versionId: version.id,
          targetVersionId,
          targetDir,
          gameVersion: depGameVersion,
          loader: depLoader,
          projectType
        });

    if (result && result.success) {
      const count: number = (result.files || []).length;
      const skipped: number = (result.skipped || []).length;
      const detail: string = count > 1 ? `已安装 ${count} 个文件（含前置）${skipped ? `，${skipped} 个已存在` : ''}` : count === 1 ? '已安装 1 个文件' : '文件已存在';
      showToast('安装完成', `${fileLabel} → ${choice.label}`, 'success', 'mod-install-done');
      setModStatus(`${detail} · ${choice.label}`, 'success');
      btn.textContent = '已安装';
    } else {
      showToast('安装失败', result?.error || '未知错误', 'error', 'mod-install-failed');
      setModStatus(`安装失败：${result?.error || '未知错误'}`, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (e: any) {
    showToast('安装失败', e.message || String(e), 'error', 'mod-install-failed');
    setModStatus(`安装失败：${e.message || e}`, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

if (tabMods) tabMods.addEventListener('click', showModTab);
if (tabShaders) tabShaders.addEventListener('click', () => showResourceTab('shader'));
if (tabResourcepacks) tabResourcepacks.addEventListener('click', () => showResourceTab('resourcepack'));
if (tabModpacks) tabModpacks.addEventListener('click', () => showResourceTab('modpack'));
if (tabVersions) tabVersions.addEventListener('click', showVersionTab);

if (searchBtn) searchBtn.addEventListener('click', () => void searchMods());
if (searchInput) {
  searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') void searchMods();
  });
}
if (gameVersionSelect) gameVersionSelect.addEventListener('change', () => void searchMods());
if (loaderSelect) loaderSelect.addEventListener('change', () => void searchMods());
if (sourceSelect) sourceSelect.addEventListener('change', () => void searchMods());

if (detailBack) {
  detailBack.addEventListener('click', () => {
    if (projectStack.length > 1) {
      projectStack.pop();
      void openProject(projectStack[projectStack.length - 1], true);
      return;
    }
    projectStack = [];
    detailEl?.classList.add('hidden');
    resultsEl?.classList.remove('hidden');
    setModStatus('');
  });
}

if (targetCancel) targetCancel.addEventListener('click', () => closeTargetPicker(null));
if (targetClose) targetClose.addEventListener('click', () => closeTargetPicker(null));
if (targetConfirm) targetConfirm.addEventListener('click', () => void confirmTarget());
if (targetOverlay) {
  targetOverlay.addEventListener('click', (e: Event) => {
    if (e.target === targetOverlay) closeTargetPicker(null);
  });
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && targetOverlay && !targetOverlay.classList.contains('hidden')) {
    closeTargetPicker(null);
  }
  if (e.key === 'Escape' && packOverlay && !packOverlay.classList.contains('hidden')) {
    closePackPrompt(null);
  }
});

if (packConfirm) packConfirm.addEventListener('click', () => confirmPackPrompt());
if (packCancel) packCancel.addEventListener('click', () => closePackPrompt(null));
if (packClose) packClose.addEventListener('click', () => closePackPrompt(null));
if (packOverlay) {
  packOverlay.addEventListener('click', (e: Event) => {
    if (e.target === packOverlay) closePackPrompt(null);
  });
}
if (packNameInput) {
  packNameInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmPackPrompt();
    }
  });
}
if (targetBrowse) {
  targetBrowse.addEventListener('click', async (): Promise<void> => {
    const dir: string | null = await window.gpcl.selectDirectory();
    if (dir) renderCustomDir(dir);
  });
}

if (window.gpcl && window.gpcl.onModDownloadProgress) {
  window.gpcl.onModDownloadProgress((data: any) => {
    if (!data) return;
    const percent: number = Number(data.percent) || 0;
    setModStatus(`正在下载 ${data.label || '模组'}：${percent}%`);
  });
}


if (window.gpcl && window.gpcl.selectVersionFolder) {
  const localBtn: HTMLElement | null = document.getElementById('local-install-btn');
  if (localBtn) {
    localBtn.addEventListener('click', async (): Promise<void> => {
      const dialog: any = await window.gpcl.showMessageDialog({
        type: 'question',
        title: '导入本地版本',
        message: '要导入版本文件夹还是压缩包？',
        detail: '版本文件夹需要包含 <版本名>.json；压缩包支持 zip / jar。',
        buttons: ['版本文件夹', '压缩包', '取消'],
        defaultId: 0,
        cancelId: 2
      });
      const response: number = dialog?.response ?? 2;
      if (response === 2) return;

      const sourcePath: string | null = response === 0
        ? await window.gpcl.selectVersionFolder()
        : await window.gpcl.selectVersionArchive();
      if (!sourcePath) return;

      setStatus('正在导入版本…');
      const result: any = await window.gpcl.installLocalVersion(sourcePath);
      if (result && result.success) {
        showToast('导入完成', `已导入 ${result.versionId}`, 'success', 'local-install-done');
        setStatus(`已导入 ${result.versionId}`, 'success');
        await loadVersions();
        renderVersionSelectList();
      } else {
        showToast('导入失败', result?.error || '未知错误', 'error', 'local-install-failed');
        setStatus(`导入失败：${result?.error || '未知错误'}`, 'error');
      }
    });
  }
}
