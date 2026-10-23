/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


// __IMPORTS_BEGIN__
import { getLocale, t } from '../i18n';
import { escapeHtml, getCustomSelectValue, initCustomSelect, setCustomSelectOptions, setStatus, showToast } from './dom';
import { startModInstall, startModpackInstall } from './launch';
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
const gameVersionFilter: HTMLElement | null = document.querySelector('.custom-select[data-select-id="mod-game-version"]');
const loaderFilter: HTMLElement | null = document.querySelector('.custom-select[data-select-id="mod-loader"]');
const sourceFilter: HTMLElement | null = document.querySelector('.custom-select[data-select-id="mod-source"]');
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
    label: 'Mods',
    folder: 'mods',
    placeholder: 'Search mods, or paste a CurseForge project link',
    empty: 'No mods found. Try another keyword, or set the version filter back to All versions.'
  },
  shader: {
    label: 'Shaders',
    folder: 'shaderpacks',
    placeholder: 'Search shaders, e.g. Complementary, BSL, Photon',
    empty: 'No shaders found. Try another keyword, or set the version filter back to All versions.'
  },
  resourcepack: {
    label: 'Resource packs',
    folder: 'resourcepacks',
    placeholder: 'Search resource packs, e.g. Faithful, Stay True, Xray',
    empty: 'No resource packs found. Try another keyword, or set the version filter back to All versions.'
  },
  modpack: {
    label: 'Modpacks',
    folder: 'versions',
    placeholder: 'Search modpacks, e.g. Create, RLCraft, Better MC',
    empty: 'No modpacks found. Try another keyword, or set the version filter back to All versions.'
  }
};

let currentProjectType: ResourceProjectType = 'mod';

function resetDownloadScroll(): void {
  const page: HTMLElement | null = document.getElementById('download-page');
  if (page) page.scrollTop = 0;
}

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
  try {
    return new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  } catch (e) {
    return String(count);
  }
}

function relativeTime(dateText: string): string {
  if (!dateText) return '';
  const time: number = new Date(dateText).getTime();
  if (isNaN(time)) return '';
  const days: number = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  if (days < 1) return t('ui.today');
  if (days < 30) return t('ui.days_days_ago', { days });
  if (days < 365) return t('ui.months_months_ago', { months: Math.floor(days / 30) });
  return t('ui.years_years_ago', { years: Math.floor(days / 365) });
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
  if (!gameVersionFilter) return;
  const current: string = getCustomSelectValue('mod-game-version') || '';
  const releases: string[] = (allVersions || [])
    .filter((v: any) => v.type === 'release')
    .map((v: any) => v.id);

  const options: Array<{ value: string; label: string }> = [
    { value: '', label: t('ui.all_versions') },
    ...releases.map((id: string) => ({ value: id, label: `Minecraft ${id}` }))
  ];
  setCustomSelectOptions('mod-game-version', options, current && releases.includes(current) ? current : '');
}


async function refreshModSources(): Promise<void> {
  let sources: any[] = [];
  try {
    const result: any = await window.gpcl.getModSources();
    sources = result?.success ? (result.sources || []) : [];
  } catch {
    sources = [];
  }

  const current: string = getCustomSelectValue('mod-source') || 'both';
  const options: Array<{ value: string; label: string }> = [
    { value: 'both', label: t('ui.all_sources') },
    ...sources.map((source: any) => ({ value: String(source.id), label: String(source.label) }))
  ];
  setCustomSelectOptions('mod-source', options, options.some((opt) => opt.value === current) ? current : 'both');
}

function showResourceTab(projectType: ResourceProjectType): void {
  currentProjectType = projectType;
  const config: ResourceTypeConfig = RESOURCE_TYPES[projectType];
  resetDownloadScroll();

  tabVersions?.classList.remove('active');
  tabMods?.classList.toggle('active', projectType === 'mod');
  tabShaders?.classList.toggle('active', projectType === 'shader');
  tabResourcepacks?.classList.toggle('active', projectType === 'resourcepack');
  tabModpacks?.classList.toggle('active', projectType === 'modpack');
  modSection?.classList.remove('hidden');
  versionSection?.classList.add('hidden');
  versionDetail?.classList.add('hidden');
  javaSection?.classList.add('hidden');

  if (searchInput) searchInput.placeholder = t(config.placeholder);
  loaderFilter?.classList.toggle('hidden', projectType !== 'mod');

  projectStack = [];
  currentDetail = null;
  detailEl?.classList.add('hidden');
  resultsEl?.classList.remove('hidden');
  populateGameVersions();
  void (async (): Promise<void> => {
    await loadInstalledVersions();
    await refreshModSources();
    await searchMods();
  })();
}


function showModTab(): void {
  showResourceTab('mod');
}


function showVersionTab(): void {
  resetDownloadScroll();
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
    gameVersion: getCustomSelectValue('mod-game-version') || '',
    loader: currentProjectType === 'mod' ? (getCustomSelectValue('mod-loader') || '') : ''
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
  detailHead.innerHTML = `<div class="mod-detail-title">${t('ui.reading_curseforge_project')}</div>`;
  detailVersions.innerHTML = '';
  setModStatus(t('ui.reading_curseforge_project'));

  try {
    const filters = currentFilters();
    const result: any = await window.gpcl.curseforgeLookup({ slug, ...filters, preferGameVersion: preferredGameVersion() });
    if (!result || !result.success) {
      detailHead.innerHTML = `<div class="mod-detail-title">CurseForge</div><div class="mod-detail-desc">${escapeHtml(result?.error || t('ui.failed_to_load'))}</div>`;
      detailVersions.innerHTML = `<div class="mod-empty">${t('ui.check_the_project_slug_in_the_link_or_use_search_instead')}</div>`;
      setModStatus(result?.error || t('ui.failed_to_load'), 'error');
      return;
    }

    projectStack = [result.project];
    currentProject = result.project;
    detailHead.innerHTML = `
      <img src="${escapeHtml(result.project.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
      <div class="mod-detail-info">
        <div class="mod-detail-title">${escapeHtml(result.project.title)} <span class="mod-source-tag">CurseForge</span></div>
        <div class="mod-detail-meta">${escapeHtml(result.project.author || '')}${result.project.downloads ? ` · ${t('ui.count_downloads', { count: formatCount(result.project.downloads) })}` : ''}</div>
        <div class="mod-detail-desc">${escapeHtml(result.project.description || '')}</div>
      </div>
    `;
    resultsEl.innerHTML = `<div class="mod-empty">${t('ui.link_mode_go_back_to_continue_searching')}</div>`;
    renderDetail(result.project, result.versions || []);
    setModStatus(t('ui.total_files_available_link_mode_does_not_install_dependencies', { total: result.total || 0 }), 'muted');
  } catch (e: any) {
    detailHead.innerHTML = `<div class="mod-detail-title">CurseForge</div><div class="mod-detail-desc">${escapeHtml(e.message || t('ui.failed_to_load'))}</div>`;
    setModStatus(e.message || t('ui.failed_to_load'), 'error');
  }
}

async function searchMods(): Promise<void> {
  if (!resultsEl) return;
  const query: string = (searchInput?.value || '').trim();
  const filters = currentFilters();
  const source: string = getCustomSelectValue('mod-source') || 'both';

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
  resultsEl.innerHTML = `<div class="mod-empty mod-empty-loading">${t('ui.searching')}</div>`;
  setModStatus('');
  if (searchBtn) (searchBtn as HTMLButtonElement).disabled = true;

  try {
    const result: any = await window.gpcl.modsSearch({ source, query, ...filters, projectType: currentProjectType, offset: 0, limit: 20 });
    if (!result || !result.success) {
      const hint: string = currentProjectType === 'mod' ? `<br><span class="mod-link-hint">${t('ui.you_can_also_paste_a_curseforge_project_link_into_the_search_box')}</span>` : '';
      resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || t('ui.search_failed'))}${hint}</div>`;
      setModStatus(result?.error || t('ui.search_failed'), 'error');
      return;
    }

    if (!result.items || result.items.length === 0) {
      resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(t(RESOURCE_TYPES[currentProjectType].empty))}</div>`;
    } else {
      const nameProviders: any[] = Array.isArray(result.nameProviders) ? result.nameProviders : [];
      for (const item of result.items) item.nameProviders = nameProviders;
      renderResults(result.items);
    }

    const notes: string[] = [];
    const sourcesInResults: Set<string> = new Set((result.items || []).map((item: any) => String(item.source)));
    if (sourcesInResults.size > 1) notes.push(t('ui.combined_ranking'));
    if (result.translatedTo) notes.push(t('ui.searched_for_query', { query: result.translatedTo }));
    const errors: string[] = Array.isArray(result.errors) ? result.errors : [];
    if (errors.length > 0) notes.push(t('ui.curseforge_is_unavailable_right_now'));
    const total: number = result.total || result.items.length;
    notes.push(total > result.items.length
      ? t('ui.found_total_results_showing_the_first_shown', { total, shown: result.items.length })
      : t('ui.found_total_results', { total }));
    setModStatus(notes.join(' · '), 'muted');
  } catch (e: any) {
    resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(e.message || t('ui.search_failed'))}</div>`;
    setModStatus(e.message || t('ui.search_failed'), 'error');
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
          <span class="mod-source-tag">${escapeHtml(item.sourceLabel || (item.sourceKind === 'curseforge' ? 'CurseForge' : 'Modrinth'))}</span>
        </div>
        <div class="mod-card-desc">${escapeHtml(item.description || '')}</div>
        <div class="mod-card-meta">${escapeHtml(item.author || '')} · ${t('ui.count_downloads', { count: formatCount(item.downloads) })}${item.categories?.length ? ` · ${escapeHtml(item.categories.slice(0, 3).map((c: string) => t(CATEGORY_NAMES[String(c).toLowerCase()] || c)).join(' / '))}` : ''}</div>
      </div>
    `;
    card.addEventListener('click', () => void openProject(item));
    resultsEl.appendChild(card);
  }
}

const CATEGORY_NAMES: Record<string, string> = {
  adventure: 'Adventure',
  decoration: 'Decoration',
  equipment: 'Equipment',
  food: 'Food',
  magic: 'Magic',
  optimization: 'Optimization',
  technology: 'Technology',
  worldgen: 'World generation',
  utility: 'Utility',
  library: 'Library',
  mobs: 'Mobs',
  storage: 'Storage',
  transportation: 'Transportation',
  combat: 'Combat',
  mobs_and_creatures: 'Mobs',
  game_mechanics: 'Game mechanics'
};

let currentDetail: { item: any; versions: any[]; groups: Map<string, any[]>; depCache: Map<string, any[]> } | null = null;
let activeMcTab: string = '全部';
const IMPLICIT_FABRIC_API: string = 'P7dR8mSH';

function categoryLabel(list: string[]): string {
  return (list || []).slice(0, 4).map((c: string) => t(CATEGORY_NAMES[String(c).toLowerCase()] || c)).join(' · ');
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
  const done = (): void => showToast('ui.name_copied', text, 'success', 'mod-name-copied');
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
  if (item.source === 'modrinth') {
    return `https://modrinth.com/${projectType}/${item.slug || item.id}`;
  }
  return '';
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
  const sourceLabel: string = String(item.sourceLabel || (item.sourceKind === 'curseforge' ? 'CurseForge' : 'Modrinth'));
  const nameProviders: any[] = Array.isArray(item.nameProviders) ? item.nameProviders : [];
  const providerButtons: string = nameProviders.map((provider: any) => {
    const label: string = provider.id === 'mcmod' ? t('ui.open_on_mcmod') : t('ui.open_on_130wiki');
    return `<button class="mod-detail-action" data-act="name-provider" data-url="${escapeHtml(String(provider.url || ''))}" type="button">${escapeHtml(label)}</button>`;
  }).join('');

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
        ${t('ui.count_downloads', { count: formatCount(item.downloads || 0) })}
        <span class="mod-source-tag">${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="mod-detail-desc">${escapeHtml(item.description || '')}</div>
      <div class="mod-detail-actions">
        ${webUrl ? `<button class="mod-detail-action" data-act="web" type="button">${t('ui.open_on_source', { source: sourceLabel })}</button>` : ''}
        ${providerButtons}
        <button class="mod-detail-action" data-act="copy" type="button">${t('ui.copy_name')}</button>
      </div>
    </div>
  `;

  const webBtn: HTMLButtonElement | null = detailHead.querySelector('[data-act="web"]') as HTMLButtonElement | null;
  if (webBtn && webUrl) webBtn.addEventListener('click', () => void window.gpcl.openExternal(webUrl));
  detailHead.querySelectorAll('[data-act="name-provider"]').forEach((btn: Element) => {
    btn.addEventListener('click', () => {
      const url: string = (btn as HTMLElement).dataset.url || '';
      if (url) void window.gpcl.openExternal(url);
    });
  });
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
  const gameVersions: string = (version.gameVersions || []).slice(0, 3).join(', ') || t('ui.general');
  const loaders: string = (version.loaders || []).join(' / ');
  const isFabricFile: boolean = (version.loaders || []).includes('fabric');
  const isMod: boolean = (item.projectType || currentProjectType) === 'mod';
  const depCount: number = isMod ? (version.dependencies || []).filter((d: any) =>
    d.type === 'required' && !(isFabricFile && String(d.projectId) === IMPLICIT_FABRIC_API)).length : 0;
  row.innerHTML = `
    <div class="mod-version-info">
      <div class="mod-version-name" title="${escapeHtml(version.fileName || version.name)}">${escapeHtml(version.name || version.fileName)}</div>
      <div class="mod-version-meta">${escapeHtml(gameVersions)}${loaders ? ` · ${escapeHtml(loaders)}` : ''}${version.fileSize ? ` · ${(version.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}${depCount ? ` · ${t('ui.count_dependencies', { count: depCount })}` : ''}${version.date ? ` · ${t('ui.updated_time', { time: relativeTime(version.date) })}` : ''}</div>
    </div>
    <button class="mod-install-btn" type="button">${t('ui.install')}</button>
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
    container.innerHTML = `<div class="mod-deps-empty">${t('ui.no_required_dependencies')}</div>`;
    return;
  }

  container.innerHTML = `<div class="mod-deps-empty">${t('ui.loading_dependencies')}</div>`;
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
      container.innerHTML = `<div class="mod-deps-empty">${t('ui.no_dependency_information_available')}</div>`;
      return;
    }

    container.innerHTML = '';
    for (const dep of projects) {
      const card: HTMLDivElement = document.createElement('div');
      card.className = 'mod-dep-card';
      card.innerHTML = `
        <img src="${escapeHtml(dep.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
        <div class="mod-dep-info">
          <div class="mod-dep-name">${escapeHtml(dep.title)}${(dep.categories || []).some((c: string) => String(c).toLowerCase() === 'library') ? ` <span class="mod-dep-tag">${t('ui.library')}</span>` : ''}</div>
          <div class="mod-dep-desc">${escapeHtml(dep.description || '')}</div>
          <div class="mod-dep-meta">${t('ui.count_downloads', { count: formatCount(dep.downloads || 0) })}${dep.updatedAt ? ` · ${t('ui.updated_time', { time: relativeTime(dep.updatedAt) })}` : ''} · ${escapeHtml(dep.sourceLabel || (dep.sourceKind === 'curseforge' ? 'CurseForge' : 'Modrinth'))}</div>
        </div>
      `;
      card.addEventListener('click', () => void openProject({
        source: dep.source,
        sourceLabel: dep.sourceLabel,
        sourceKind: dep.sourceKind,
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
    container.innerHTML = `<div class="mod-deps-empty">${t('ui.could_not_load_dependency_information_error', { error: escapeHtml(e.message || t('ui.unknown_error')) })}</div>`;
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
  head.innerHTML = `<span>${escapeHtml(mcVersion === '通用' ? t('ui.general') : mcVersion)}</span><span class="icon icon-chevron mod-mc-chevron${expanded ? ' expanded' : ''}"></span>`;

  const body: HTMLDivElement = document.createElement('div');
  body.className = `mod-mc-section-body${expanded ? '' : ' hidden'}`;
  body.innerHTML = `
    ${isMod ? `<div class="mod-deps-block"><div class="mod-deps-title">${t('ui.dependencies')}</div><div class="mod-deps-list"></div></div>` : ''}
    <div class="mod-version-heading">${t('ui.versions')}</div>
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
    btn.textContent = tab === '全部' ? t('ui.all') : tab;
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
      detailVersions.appendChild(renderMcSection('通用', groups.get('ui.general') || [], currentDetail.item, false));
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
  resetDownloadScroll();
  if (!keepStack) projectStack.push(item);
  await loadInstalledVersions();

  resultsEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
  renderProjectHeader(item, []);
  detailVersions.innerHTML = `<div class="mod-empty mod-empty-loading">${t('ui.loading_available_files')}</div>`;
  setModStatus('');

  try {
    const result: any = await window.gpcl.modsVersions({
      source: item.source,
      projectId: item.id,
      projectType: item.projectType || currentProjectType,
      ...currentFilters(),
      preferGameVersion: preferredGameVersion()
    });
    if (!result || !result.success) {
      detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || t('ui.failed_to_load_files'))}</div>`;
      setModStatus(result?.error || t('ui.failed_to_load_files'), 'error');
      return;
    }
    setModStatus('');
    renderDetail(item, result.versions || []);
  } catch (e: any) {
    detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(e.message || t('ui.failed_to_load_files'))}</div>`;
    setModStatus(e.message || t('ui.failed_to_load_files'), 'error');
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
  if (targetConfirm) {
    targetConfirm.disabled = false;
    const name: string = choice.kind === 'dir' ? t('ui.custom_folder') : choice.label;
    targetConfirm.textContent = t('ui.install_to_name', { name });
  }
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
    <div class="mod-target-name">${t('ui.custom_folder')}</div>
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
  if (targetConfirm) {
    targetConfirm.disabled = true;
    targetConfirm.textContent = t('ui.install');
  }

  const candidates: any[] = projectType === 'mod'
    ? installedVersions.filter((v: any) => v.hasModLoader || v.hasOptiFine)
    : installedVersions;
  const isBlocked = (target: any): boolean => {
    if (projectType !== 'mod') return false;
    const compat = versionMatches(version, target, projectType);
    return !compat.game || !compat.loader;
  };
  candidates.sort((a: any, b: any) => {
    const ca = versionMatches(version, a, projectType);
    const cb = versionMatches(version, b, projectType);
    const score = (v: any, c: any): number =>
      (isBlocked(v) ? 0 : 8) + (v.id === selectedVersionId ? 8 : 0) + (c.game ? 4 : 0) + (c.loader ? 2 : 0);
    return score(b, cb) - score(a, ca) || b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  if (candidates.length === 0) {
    const message: string = projectType === 'mod'
      ? t('ui.no_mod_loader_version_installed_yet_install_a_fabric_forge_neoforge_vers_3dcbed')
      : t('ui.no_game_versions_installed_yet_install_one_first_or_choose_a_folder_dire_aacfc6', {
          label: t(RESOURCE_TYPES[projectType].label),
          folder: RESOURCE_TYPES[projectType].folder
        });
    targetList.innerHTML = `<div class="mod-empty">${escapeHtml(message)}</div>`;
  }

  for (const target of candidates) {
    const compat = versionMatches(version, target, projectType);
    const blocked: boolean = isBlocked(target);
    const loaderLabel: string = (target.loaders || []).length ? target.loaders.join(' / ') : (target.hasOptiFine ? 'OptiFine' : t('ui.vanilla'));
    const notes: string[] = [];
    if (target.id === selectedVersionId) notes.push(t('ui.currently_launching'));
    if (!blocked && !compat.game) notes.push(t('ui.game_version_mismatch'));
    if (!blocked && !compat.loader) notes.push(t('ui.loader_mismatch'));
    if (projectType === 'mod' && !blocked && !target.isolated) notes.push(t('ui.first_install_will_enable_version_isolation'));

    const reasons: string[] = [];
    if (blocked && !compat.game) reasons.push(t('ui.game_version_mismatch'));
    if (blocked && !compat.loader) reasons.push(t('ui.loader_mismatch'));

    const row: HTMLDivElement = document.createElement('div');
    row.className = blocked ? 'mod-target-item incompatible' : 'mod-target-item';
    row.dataset.key = `version:${target.id}`;
    row.innerHTML = `
      <div class="mod-target-name">
        <span>${escapeHtml(target.id)}</span>
        ${reasons.length ? `<span class="mod-target-badge">${escapeHtml(reasons.join(' · '))}</span>` : ''}
      </div>
      <div class="mod-target-meta">Minecraft ${escapeHtml(target.mcVersion)} · ${escapeHtml(loaderLabel)}</div>
      ${notes.length ? `<div class="mod-target-notes">${notes.map((n: string) => `<span>${escapeHtml(n)}</span>`).join('')}</div>` : ''}
    `;
    if (!blocked) {
      row.addEventListener('click', () => selectTarget({ kind: 'version', id: target.id, label: target.id }));
      row.addEventListener('dblclick', () => {
        selectTarget({ kind: 'version', id: target.id, label: target.id });
        void confirmTarget();
      });
    }
    targetList.appendChild(row);
  }

  const preferred: any = candidates.find((v: any) => v.id === selectedVersionId && !isBlocked(v))
    || candidates.find((v: any) => { const c = versionMatches(version, v, projectType); return c.game && c.loader; })
    || candidates.find((v: any) => !isBlocked(v));
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
  const base: string = String(item.title || item.slug || t('ui.modpacks'));
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
    showToast('ui.added_to_download_queue', t('ui.modpack_name', { name: instanceName }), 'success', 'modpack-queued');
    setModStatus(t('ui.modpack_name_added_to_the_download_queue', { name: instanceName }), 'success');
    if (btn) btn.textContent = t('ui.added_to_queue');
  })();
}

async function installMod(item: any, version: any, btn: HTMLButtonElement): Promise<void> {
  const projectType: ResourceProjectType = item.projectType || currentProjectType;
  const fileLabel: string = version.fileName || version.name || t('ui.label_file', { label: t(RESOURCE_TYPES[projectType].label) });
  const choice: TargetChoice | null = await openTargetPicker(fileLabel, version, projectType);
  if (!choice) return;

  const originalText: string = btn.textContent || t('ui.install');
  btn.disabled = true;
  btn.textContent = t('ui.installing');
  setModStatus(t('ui.downloading_file', { file: fileLabel }));

  try {
    const targetVersionId: string = choice.kind === 'version' ? choice.id : '';
    const targetDir: string = choice.kind === 'dir' ? choice.dir : '';

    const depGameVersion: string = (version.gameVersions || [])[0] || currentFilters().gameVersion;
    const depLoader: string = (version.loaders || [])[0] || currentFilters().loader;
    const targetLabel: string = choice.kind === 'dir' ? t('ui.custom_folder') : choice.label;
    const displayName: string = `${item.title || fileLabel} → ${targetLabel}`;
    const result: any = item.direct
      ? await startModInstall({
          direct: true,
          displayName,
          payload: { url: version.downloadUrl, fileName: version.fileName, targetVersionId, targetDir, projectType }
        })
      : await startModInstall({
          direct: false,
          displayName,
          payload: {
            source: item.source,
            projectId: item.id,
            versionId: version.id,
            targetVersionId,
            targetDir,
            gameVersion: depGameVersion,
            loader: depLoader,
            projectType
          }
        });

    if (result && result.success) {
      const count: number = (result.files || []).length;
      const skipped: number = (result.skipped || []).length;
      const detail: string = count > 1
        ? t('ui.installed_count_files_including_dependencies', { count }) + (skipped ? t('ui.count_already_existed', { count: skipped }) : '')
        : count === 1 ? t('ui.installed_1_file') : t('ui.file_already_exists');
      showToast('ui.installation_complete', `${fileLabel} → ${choice.label}`, 'success', 'mod-install-done');
      setModStatus(`${detail} · ${choice.label}`, 'success');
      btn.textContent = t('ui.installed');
    } else {
      showToast('ui.installation_failed', result?.error || t('ui.unknown_error'), 'error', 'mod-install-failed');
      setModStatus(t('ui.installation_failed_error_2', { error: result?.error || t('ui.unknown_error') }), 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (e: any) {
    showToast('ui.installation_failed', e.message || String(e), 'error', 'mod-install-failed');
    setModStatus(t('ui.installation_failed_error_2', { error: e.message || e }), 'error');
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
initCustomSelect('mod-game-version', () => void searchMods());
initCustomSelect('mod-loader', () => void searchMods());
initCustomSelect('mod-source', () => void searchMods());
window.addEventListener('gpcl-mod-sources-changed', () => void refreshModSources());

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
    resetDownloadScroll();
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
    setModStatus(t('ui.downloading_name_percent', { name: data.label || t('ui.mods'), percent }));
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
        showToast('ui.import_complete', t('ui.imported_name', { name: result.versionId }), 'success', 'local-install-done');
        setStatus(t('ui.imported_name', { name: result.versionId }), 'success');
        await loadVersions();
        renderVersionSelectList();
      } else {
        showToast('ui.import_failed', result?.error || t('ui.unknown_error'), 'error', 'local-install-failed');
        setStatus(t('ui.import_failed_error', { error: result?.error || t('ui.unknown_error') }), 'error');
      }
    });
  }
}
