/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { escapeHtml, setStatus, showToast } from './dom';
import { allVersions, loadVersions, renderVersionSelectList, selectedVersionId } from './versions';
// __IMPORTS_END__

const tabVersions: HTMLElement | null = document.getElementById('download-tab-versions');
const tabMods: HTMLElement | null = document.getElementById('download-tab-mods');
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

type TargetChoice = { kind: 'version'; id: string; label: string } | { kind: 'dir'; dir: string; label: string };

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
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
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

function showModTab(): void {
  tabVersions?.classList.remove('active');
  tabMods?.classList.add('active');
  modSection?.classList.remove('hidden');
  versionSection?.classList.add('hidden');
  versionDetail?.classList.add('hidden');
  javaSection?.classList.add('hidden');
  populateGameVersions();
  void loadInstalledVersions().then(() => void searchMods());
}

function showVersionTab(): void {
  tabMods?.classList.remove('active');
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
    loader: loaderSelect?.value || ''
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
    renderVersions(result.project, result.versions || []);
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

  const curseForgeSlug: string | null = parseCurseForgeSlug(query);
  if (curseForgeSlug) {
    if (searchBtn) (searchBtn as HTMLButtonElement).disabled = true;
    try {
      await lookupCurseForge(curseForgeSlug);
    } finally {
      if (searchBtn) (searchBtn as HTMLButtonElement).disabled = false;
    }
    return;
  }

  detailEl?.classList.add('hidden');
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = '<div class="mod-empty">正在搜索…</div>';
  setModStatus('正在搜索…');
  if (searchBtn) (searchBtn as HTMLButtonElement).disabled = true;

  try {
    const result: any = await window.gpcl.modsSearch({ source, query, ...filters, offset: 0, limit: 20 });
    if (!result || !result.success) {
      resultsEl.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || '搜索失败')}<br><span class="mod-link-hint">也可以把 CurseForge 项目链接粘贴到搜索框</span></div>`;
      setModStatus(result?.error || '搜索失败', 'error');
      return;
    }

    if (!result.items || result.items.length === 0) {
      resultsEl.innerHTML = '<div class="mod-empty">没有找到模组。换个关键词试试，或者把筛选改回「全部版本」。</div>';
    } else {
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
          <span>${escapeHtml(item.title)}</span>
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

function renderProjectHead(item: any): void {
  if (!detailHead) return;
  detailHead.innerHTML = `
    <img src="${escapeHtml(item.iconUrl || '')}" alt="" onerror="this.style.visibility='hidden'">
    <div class="mod-detail-info">
      <div class="mod-detail-title">${escapeHtml(item.title)} <span class="mod-source-tag">${item.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}</span></div>
      <div class="mod-detail-meta">${escapeHtml(item.author || '')} · ${formatCount(item.downloads)} 次下载</div>
      <div class="mod-detail-desc">${escapeHtml(item.description || '')}</div>
    </div>
  `;
}

async function openProject(item: any): Promise<void> {
  currentProject = item;
  if (!resultsEl || !detailEl || !detailVersions) return;
  await loadInstalledVersions();

  resultsEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
  renderProjectHead(item);
  detailVersions.innerHTML = '<div class="mod-empty">正在获取可用文件…</div>';
  setModStatus('正在获取可用文件…');

  try {
    const result: any = await window.gpcl.modsVersions({
      source: item.source,
      projectId: item.id,
      ...currentFilters(),
      preferGameVersion: preferredGameVersion()
    });
    if (!result || !result.success) {
      detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(result?.error || '获取文件失败')}</div>`;
      setModStatus(result?.error || '获取文件失败', 'error');
      return;
    }
    setModStatus('');
    renderVersions(item, result.versions || []);
  } catch (e: any) {
    detailVersions.innerHTML = `<div class="mod-empty">${escapeHtml(e.message || '获取文件失败')}</div>`;
    setModStatus(e.message || '获取文件失败', 'error');
  }
}

function renderVersions(item: any, versions: any[]): void {
  if (!detailVersions) return;
  if (versions.length === 0) {
    detailVersions.innerHTML = '<div class="mod-empty">没有可用文件。把筛选改回「全部版本」或「全部加载器」再试。</div>';
    return;
  }

  detailVersions.innerHTML = '<div class="mod-version-heading">选择要安装的文件</div><div class="mod-version-hint">安装 Modrinth 文件时会自动带上必需前置；CurseForge 链接模式不会。</div>';
  const list: HTMLDivElement = document.createElement('div');
  list.className = 'mod-version-list';

  for (const version of versions.slice(0, 50)) {
    const row: HTMLDivElement = document.createElement('div');
    row.className = 'mod-version-row';
    const gameVersions: string = (version.gameVersions || []).slice(0, 3).join(', ') || '通用';
    const loaders: string = (version.loaders || []).join(' / ');
    row.innerHTML = `
      <div class="mod-version-info">
        <div class="mod-version-name" title="${escapeHtml(version.fileName || version.name)}">${escapeHtml(version.name || version.fileName)}</div>
        <div class="mod-version-meta">${escapeHtml(gameVersions)}${loaders ? ` · ${escapeHtml(loaders)}` : ''}${version.fileSize ? ` · ${(version.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}</div>
      </div>
      <button class="mod-install-btn" type="button">安装</button>
    `;
    const btn: HTMLButtonElement | null = row.querySelector('.mod-install-btn') as HTMLButtonElement | null;
    if (btn) btn.addEventListener('click', () => void installMod(item, version, btn));
    list.appendChild(row);
  }

  detailVersions.appendChild(list);
}

function versionMatches(version: any, target: any): { game: boolean; loader: boolean } {
  const gameVersions: string[] = version.gameVersions || [];
  const loaders: string[] = version.loaders || [];
  const game: boolean = gameVersions.length === 0 || gameVersions.includes(target.mcVersion);
  const loader: boolean = loaders.length === 0 || loaders.some((l: string) => (target.loaders || []).includes(l));
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

async function openTargetPicker(fileLabel: string, version: any): Promise<TargetChoice | null> {
  if (!targetOverlay || !targetList || !targetFile) return null;

  await loadInstalledVersions();
  targetFile.textContent = fileLabel;
  targetList.innerHTML = '';
  targetChoice = null;
  if (targetConfirm) targetConfirm.disabled = true;

  const candidates: any[] = installedVersions.filter((v: any) => v.hasModLoader || v.hasOptiFine);
  candidates.sort((a: any, b: any) => {
    const ca = versionMatches(version, a);
    const cb = versionMatches(version, b);
    const score = (v: any, c: any): number =>
      (v.id === selectedVersionId ? 8 : 0) + (c.game ? 4 : 0) + (c.loader ? 2 : 0);
    return score(b, cb) - score(a, ca) || b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  if (candidates.length === 0) {
    targetList.innerHTML = '<div class="mod-empty">还没有带 Mod 加载器的版本。先去下载页装一个 Fabric / Forge 版本，或者直接选择文件夹。</div>';
  }

  for (const target of candidates) {
    const compat = versionMatches(version, target);
    const loaderLabel: string = (target.loaders || []).length ? target.loaders.join(' / ') : (target.hasOptiFine ? 'OptiFine' : '原版');
    const notes: string[] = [];
    if (target.id === selectedVersionId) notes.push('当前启动');
    if (!compat.game) notes.push('游戏版本不匹配');
    if (!compat.loader) notes.push('加载器不匹配');
    if (!target.isolated) notes.push('首次安装会启用版本隔离');

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
    || candidates.find((v: any) => { const c = versionMatches(version, v); return c.game && c.loader; })
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

async function installMod(item: any, version: any, btn: HTMLButtonElement): Promise<void> {
  const fileLabel: string = version.fileName || version.name || '模组文件';
  const choice: TargetChoice | null = await openTargetPicker(fileLabel, version);
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
      ? await window.gpcl.modsInstallDirect({ url: version.downloadUrl, fileName: version.fileName, targetVersionId, targetDir })
      : await window.gpcl.modsInstall({
          source: item.source,
          projectId: item.id,
          versionId: version.id,
          targetVersionId,
          targetDir,
          gameVersion: depGameVersion,
          loader: depLoader
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
});
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
