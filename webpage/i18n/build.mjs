import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, '..');
const versionsRoot = path.join(siteRoot, 'gpclversion');

const LOCALES = [
  { slug: 'en-us', code: 'en-US', name: 'English', dir: 'ltr' },
  { slug: 'zh-cn', code: 'zh-CN', name: '简体中文', dir: 'ltr' },
  { slug: 'zh-tw', code: 'zh-TW', name: '繁體中文', dir: 'ltr' },
  { slug: 'ar', code: 'ar', name: 'العربية', dir: 'rtl' },
  { slug: 'bn', code: 'bn', name: 'বাংলা', dir: 'ltr' },
  { slug: 'de', code: 'de', name: 'Deutsch', dir: 'ltr' },
  { slug: 'el', code: 'el', name: 'Ελληνικά', dir: 'ltr' },
  { slug: 'es', code: 'es', name: 'Español', dir: 'ltr' },
  { slug: 'fa', code: 'fa', name: 'فارسی', dir: 'rtl' },
  { slug: 'fr', code: 'fr', name: 'Français', dir: 'ltr' },
  { slug: 'he', code: 'he', name: 'עברית', dir: 'rtl' },
  { slug: 'hi', code: 'hi', name: 'हिन्दी', dir: 'ltr' },
  { slug: 'id', code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
  { slug: 'it', code: 'it', name: 'Italiano', dir: 'ltr' },
  { slug: 'ja', code: 'ja', name: '日本語', dir: 'ltr' },
  { slug: 'ko', code: 'ko', name: '한국어', dir: 'ltr' },
  { slug: 'ms', code: 'ms', name: 'Bahasa Melayu', dir: 'ltr' },
  { slug: 'nl', code: 'nl', name: 'Nederlands', dir: 'ltr' },
  { slug: 'pl', code: 'pl', name: 'Polski', dir: 'ltr' },
  { slug: 'pt', code: 'pt', name: 'Português', dir: 'ltr' },
  { slug: 'ru', code: 'ru', name: 'Русский', dir: 'ltr' },
  { slug: 'th', code: 'th', name: 'ไทย', dir: 'ltr' },
  { slug: 'tr', code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { slug: 'uk', code: 'uk', name: 'Українська', dir: 'ltr' },
  { slug: 'vi', code: 'vi', name: 'Tiếng Việt', dir: 'ltr' }
];

const DOCS_LOCALE = {
  'zh-cn': 'zh-Hans/',
  'en-us': 'en/',
  'zh-tw': 'zh-Hant/'
};

const FEATURE_ICONS = [
  '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.8 12.2 8.7-8.7"/><path d="m16 5 3 3"/><path d="m19 8 2-2-3-3-2 2"/>',
  '<path d="M12 13v8"/><path d="m8 17 4 4 4-4"/><path d="M20 16.7A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.2"/>',
  '<path d="m12 2 9 4.9-9 4.9-9-4.9Z"/><path d="m3 12 9 4.9 9-4.9"/><path d="m3 17 9 4.9 9-4.9"/>',
  '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20Z"/>',
  '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
  '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2"/><path d="M10 2v2"/><path d="M14 2v2"/>',
  '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  '<path d="m10.29 3.86-8.47 14.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'
];

const OPENSOURCE_ICONS = [
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m10 13-2 2 2 2"/><path d="m14 13 2 2-2 2"/>',
  '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9l2.1 2.1"/><path d="M17 17l2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.9 19.1 7 17"/><path d="M17 7l2.1-2.1"/>'
];

const SHOT_VERSION = 'q9v3m7k2';

const SHOTS = [
  ['launch.png', 'launch'],
  ['download.png', 'download'],
  ['settings.png', 'settings'],
  ['appearance.png', 'appearance']
];

const ARROW_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>';
const BIG_ARROW_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>';

function e(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function shapeOf(value) {
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, shapeOf(value[key])]));
  }
  return typeof value;
}

function compareShape(a, b, at = '') {
  const problems = [];
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return [`${at}: expected array`];
    if (a.length !== b.length) problems.push(`${at}: length ${b.length} != ${a.length}`);
    a.forEach((item, i) => problems.push(...compareShape(item, b[i], `${at}[${i}]`)));
    return problems;
  }
  if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') return [`${at}: expected object`];
    for (const key of Object.keys(a)) {
      if (!(key in b)) problems.push(`${at}.${key}: missing`);
      else problems.push(...compareShape(a[key], b[key], `${at}.${key}`));
    }
    for (const key of Object.keys(b)) {
      if (!(key in a)) problems.push(`${at}.${key}: unexpected`);
    }
    return problems;
  }
  if (typeof a !== typeof b) problems.push(`${at}: type ${typeof b} != ${typeof a}`);
  return problems;
}

function docsUrl(locale) {
  const prefix = DOCS_LOCALE[locale.slug];
  return prefix === undefined ? `/gpcl/docs/${locale.code}/` : `/gpcl/docs/${prefix}`;
}

function fakeDemoLang(locale) {
  return locale.slug;
}

function renderTags(tags) {
  return tags.map(tag => `                <span class="hero-tag"><span class="dot"></span>${e(tag)}</span>`).join('\n');
}

function renderFeatureGrid(site) {
  return site.features.items.map((item, i) => {
    return `                <div class="feature-card reveal">
                    <span class="feature-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FEATURE_ICONS[i]}</svg>
                    </span>
                    <h3>${e(item.title)}</h3>
                    <p>${e(item.desc)}</p>
                </div>`;
  }).join('\n');
}

function renderShotGallery(site) {
  return site.shots.items.map((item, i) => {
    return `                <figure class="shot reveal">
                    <img src="./screenshots/${SHOTS[i][0]}?v=${SHOT_VERSION}" alt="${e(item.alt)}" loading="lazy">
                    <figcaption>${e(item.caption)}</figcaption>
                </figure>`;
  }).join('\n');
}

function renderDownloadInfo(site, versionData) {
  return `                    <span>${e(site.download.updatedLabel)} <b>${e(versionData.updated)}</b></span>
                    <span>${e(site.download.platformLabel)} <b>${e(site.download.platform)}</b></span>
                    <span>${e(site.download.licenseLabel)} <b>${e(site.download.license)}</b></span>`;
}

function renderHeroMeta(site, versionData) {
  return `                <span>${e(site.hero.versionLabel)} <b>v${e(versionData.latest)}</b></span>
                <span class="sep">/</span>
                <span>${e(site.hero.updatedLabel)} <b>${e(versionData.updated)}</b></span>
                <span class="sep">/</span>
                <span>${e(site.hero.platformLabel)} <b>${e(site.hero.platform)}</b></span>`;
}

function renderReqGrid(site) {
  return site.requirements.items.map(item => `                <div class="req-card reveal">
                    <div class="req-label">${e(item.label)}</div>
                    <p>${e(item.text)}</p>
                </div>`).join('\n');
}

function renderOpenSourceGrid(site) {
  return site.openSource.items.map((item, i) => `                <div class="opensource-card reveal">
                    <span class="opensource-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${OPENSOURCE_ICONS[i]}</svg>
                    </span>
                    <h3>${e(item.title)}</h3>
                    <p>${item.desc}</p>
                    <a href="${i === 0 ? 'https://www.caellab.com/license/cbs-v3' : 'https://github.com/CaelLab-org/GoodPlanCraftLauncher'}"${i === 1 ? ' target="_blank" rel="noopener"' : ' target="_blank"'}>${e(item.action)}</a>
                </div>`).join('\n');
}

function renderLangSelect(locale, site) {
  const options = LOCALES.map(item => {
    const selected = item.slug === locale.slug ? ' selected' : '';
    return `<option value="./index.${item.slug}"${selected}>${e(item.name)}</option>`;
  }).join('');
  return `<select aria-label="${e(site.nav.language)}" onchange="if(this.value)location.href=this.value">${options}</select>`;
}

function renderMobilePanel(locale, site) {
  const options = LOCALES.map(item => {
    const selected = item.slug === locale.slug ? ' selected' : '';
    return `<option value="./index.${item.slug}"${selected}>${e(item.name)}</option>`;
  }).join('');
  return `        <a href="https://github.com/CaelLab-org/GoodPlanCraftLauncher" target="_blank" rel="noopener">${e(site.nav.mobileGitHub)}</a>
        <select aria-label="${e(site.nav.language)}" onchange="if(this.value)location.href=this.value" style="width:100%;margin-top:8px;padding:10px;background:var(--surface);border:1px solid var(--line);border-radius:8px;color:var(--text-2);font:inherit;font-size:0.95rem;">${options}</select>`;
}

function renderHreflang(locale, isHistory) {
  const base = `https://gamets.caellab.com/gpcl/${isHistory ? 'history/' : ''}`;
  const lines = LOCALES.map(item => `    <link rel="alternate" hreflang="${item.code}" href="${base}index.${item.slug}">`);
  lines.push(`    <link rel="alternate" hreflang="x-default" href="${base}index.en-us">`);
  return lines.join('\n');
}

function renderFooter(locale, site, isHistory) {
  const homeHref = isHistory ? `../index.${locale.slug}` : `./index.${locale.slug}`;
  const historyHref = isHistory ? `./index.${locale.slug}` : `./history/index.${locale.slug}`;
  return `<footer>
        <div class="footer-content">
            <div class="footer-brand">
                <a href="https://gamets.caellab.com" class="logo">
                    <img src="/logo.png" alt="GameTS">
                </a>
                <p>${e(site.footer.brand)}</p>
            </div>
            <div class="footer-links">
                <h4>${e(site.footer.projects)}</h4>
                <ul>
                    <li><a href="${homeHref}">GoodPlanCraftLauncher</a></li>
                    <li><a href="${docsUrl(locale)}">${e(site.footer.help)}</a></li>
                    <li><a href="${historyHref}">${e(site.footer.changelog)}</a></li>
                    <li><a href="/areyouok/">Are You OK?</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>${e(site.footer.community)}</h4>
                <ul>
                    <li><a href="https://forum.xmuer.online" target="_blank" rel="noopener">${e(site.footer.forum)}</a></li>
                    <li><a href="mailto:gamets@caellab.com">gamets@caellab.com</a></li>
                </ul>
            </div>
            <div class="footer-links">
                <h4>${e(site.footer.openSource)}</h4>
                <ul>
                    <li><a href="https://github.com/CaelLab-org/GoodPlanCraftLauncher" target="_blank" rel="noopener">GitHub</a></li>
                    <li><a href="https://www.caellab.com/license/cbs-v3" target="_blank">${e(site.footer.license)}</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>${site.footer.copyright}</p>
            <p>${site.footer.disclaimer}</p>
            <p>${site.footer.licenseLine}</p>
        </div>
    </footer>`;
}

function renderChangelog(version, site) {
  return version.log.map(line => `                        <li>${e(line)}</li>`).join('\n');
}

function renderHomeItem(version, isLatest, site) {
  const title = version.title ? `\n                        <span class="version-title">${e(version.title)}</span>` : '';
  const chip = isLatest ? `\n                        <span class="latest-chip">${e(site.history.page.latest)}</span>` : '';
  return `                <div class="timeline-item reveal">
                    <span class="timeline-dot"></span>
                    <div class="version-info">
                        <span class="version-number">v${e(version.version)}</span>${title}${chip}
                        <span class="version-date">${e(version.date)}</span>
                    </div>
                    <ul class="changelog">
${renderChangelog(version, site)}
                    </ul>
                </div>`;
}

function renderHistoryArticle(version, index, site) {
  const title = version.title ? `\n                        <span class="version-title">${e(version.title)}</span>` : '';
  const chip = index === 0 ? `\n                        <span class="latest-chip">${e(site.history.page.latest)}</span>` : '';
  let download;
  if (version.download) {
    const note = site.history.page.fileNote
      .replace(/\{file\}/g, e(version.download.file))
      .replace(/\{size\}/g, e(version.download.size)) + (version.download.github ? ` · ${e(site.labels.github)}` : '');
    const label = site.history.page.download.replace(/\{version\}/g, e(version.version));
    download = `                    <div class="cl-download">
                        <a class="cl-dl-btn" href="${version.download.url}">
                            ${ARROW_SVG}
                            ${e(label)}
                        </a>
                        <span class="cl-file">${note}</span>
                    </div>`;
  } else {
    download = `                    <div class="cl-download">
                        <span class="cl-unavailable">${e(site.history.page.unavailable)}</span>
                    </div>`;
  }
  return `                <article class="timeline-item" id="${e(version.anchor)}">
                    <span class="timeline-dot"></span>
                    <div class="version-info">
                        <span class="version-number">v${e(version.version)}</span>${title}${chip}
                        <span class="version-date">${e(version.date)}</span>
                    </div>
                    <ul class="changelog">
${renderChangelog(version, site)}
                    </ul>
${download}
                </article>`;
}

function renderHomeTimeline(versionData, site, locale) {
  const versions = versionData.versions;
  const visible = versions.slice(0, 8);
  const older = versions.slice(8);
  const parts = visible.map((version, i) => renderHomeItem(version, i === 0, site));
  if (older.length) {
    parts.push(`                <details class="older-versions">
                    <summary>${e(site.history.older.replace(/\{n\}/g, String(older.length)))}</summary>
${older.map(version => renderHomeItem(version, false, site)).join('\n')}
                </details>`);
  }
  const more = site.history.more.replace(/\{total\}/g, String(versions.length));
  parts.push(`                <div class="history-more">
                    <a href="./history/index.${locale.slug}">${e(more)}</a>
                </div>`);
  return parts.join('\n');
}

function renderHistoryIndex(versionData) {
  return versionData.versions.map(version => `                <a href="#${e(version.anchor)}">${e(version.version)}</a>`).join('\n');
}

function fill(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`Missing placeholder ${key}`);
    return values[key];
  });
}

function buildLocale(locale, templateHome, templateHistory) {
  const siteFile = path.join(here, 'locales', `${locale.slug}.json`);
  const versionFile = path.join(versionsRoot, `${locale.slug}.json`);
  if (!fs.existsSync(siteFile)) throw new Error(`Missing ${siteFile}`);
  if (!fs.existsSync(versionFile)) throw new Error(`Missing ${versionFile}`);
  const site = readJson(siteFile);
  const versionData = readJson(versionFile);

  const latest = versionData.versions[0];
  const installerFile = latest.download ? latest.download.file : `GPCL-${versionData.latest}-Setup.exe`;

  const common = {
    SLUG: locale.slug,
    HTML_LANG: locale.code,
    HTML_DIR: locale.dir,
    HREFLANG_HOME: renderHreflang(locale, false),
    HREFLANG_HISTORY: renderHreflang(locale, true),
    NAV_SOURCE: e(site.nav.source),
    NAV_OPEN_MENU: e(site.nav.openMenu),
    NAV_DOWNLOAD: e(site.nav.download.replace(/\{version\}/g, versionData.latest)),
    LANG_SELECT: renderLangSelect(locale, site),
    MOBILE_PANEL: renderMobilePanel(locale, site),
    FOOTER_HOME: renderFooter(locale, site, false),
    FOOTER_HISTORY: renderFooter(locale, site, true)
  };

  const homeValues = {
    ...common,
    HREFLANG: common.HREFLANG_HOME,
    META_TITLE: e(site.meta.title),
    META_DESC: e(site.meta.description),
    META_KEYWORDS: e(site.meta.keywords),
    OG_TITLE: e(site.meta.ogTitle),
    OG_DESC: e(site.meta.ogDescription),
    OG_URL: 'https://gamets.caellab.com/gpcl/',
    HOME_ANCHOR: '#',
    HERO_TAGS: renderTags(site.hero.tags),
    HERO_SUBTITLE: e(site.hero.subtitle),
    HERO_DESC: e(site.hero.desc),
    HERO_DOWNLOAD: e(site.hero.download),
    HERO_META: renderHeroMeta(site, versionData),
    HERO_ICON_ALT: e(site.hero.iconAlt),
    HERO_IFRAME_TITLE: e(site.hero.iframeTitle),
    HERO_WINDOW_NOTE: site.hero.windowNote,
    DEMO_LANG: fakeDemoLang(locale),
    FEATURES_TAG: e(site.features.tag),
    FEATURES_TITLE: e(site.features.title),
    FEATURES_DESC: e(site.features.desc),
    FEATURES_GRID: renderFeatureGrid(site),
    SHOTS_TAG: e(site.shots.tag),
    SHOTS_TITLE: e(site.shots.title),
    SHOTS_DESC: e(site.shots.desc),
    SHOT_GALLERY: renderShotGallery(site),
    DOWNLOAD_TAG: e(site.download.tag),
    DOWNLOAD_TITLE: e(site.download.title),
    DOWNLOAD_DESC: e(site.download.desc),
    INSTALLER_FILE: e(installerFile),
    DOWNLOAD_BUTTON: e(site.download.button),
    DOWNLOAD_INFO: renderDownloadInfo(site, versionData),
    DOWNLOAD_GITHUB: e(site.download.github),
    REQ_TAG: e(site.requirements.tag),
    REQ_TITLE: e(site.requirements.title),
    REQ_DESC: e(site.requirements.desc),
    REQ_GRID: renderReqGrid(site),
    OS_TAG: e(site.openSource.tag),
    OS_TITLE: e(site.openSource.title),
    OS_DESC: site.openSource.desc,
    OPENSOURCE_GRID: renderOpenSourceGrid(site),
    LICENSE_SUMMARY: e(site.openSource.licenseSummary),
    HISTORY_TAG: e(site.history.tag),
    HISTORY_TITLE: e(site.history.title),
    HISTORY_DESC: e(site.history.desc),
    HOME_TIMELINE: renderHomeTimeline(versionData, site, locale),
    FOOTER: common.FOOTER_HOME
  };

  const historyValues = {
    ...common,
    HREFLANG: common.HREFLANG_HISTORY,
    META_TITLE: e(site.historyMeta.title),
    META_DESC: e(site.historyMeta.description),
    META_KEYWORDS: e(site.meta.keywords),
    OG_TITLE: e(site.historyMeta.ogTitle),
    OG_DESC: e(site.historyMeta.ogDescription),
    OG_URL: 'https://gamets.caellab.com/gpcl/history/',
    HOME_ANCHOR: `../index.${locale.slug}#`,
    HP_BACK: e(site.history.page.back),
    HP_TAG: e(site.history.page.tag),
    HP_HEADING: e(site.history.page.heading),
    HP_INTRO: e(site.history.page.intro),
    HP_NOTE: e(site.history.page.note),
    HP_INDEX_LABEL: e(site.history.page.indexLabel),
    HP_INDEX: renderHistoryIndex(versionData),
    HISTORY_ARTICLES: versionData.versions.map((v, i) => renderHistoryArticle(v, i, site)).join('\n'),
    FOOTER: common.FOOTER_HISTORY
  };

  const homeHtml = fill(templateHome, homeValues);
  const historyHtml = fill(templateHistory, historyValues);

  for (const [name, html] of [['home', homeHtml], ['history', historyHtml]]) {
    const leftover = html.match(/\{\{[A-Z0-9_]+\}\}/);
    if (leftover) throw new Error(`${locale.slug} ${name}: unresolved ${leftover[0]}`);
  }

  fs.writeFileSync(path.join(siteRoot, `index.${locale.slug}.html`), homeHtml, 'utf8');
  fs.writeFileSync(path.join(siteRoot, 'history', `index.${locale.slug}.html`), historyHtml, 'utf8');
}

function renderEntry(isHistory) {
  const base = `https://gamets.caellab.com/gpcl/${isHistory ? 'history/' : ''}`;
  const hreflang = LOCALES.map(item => `    <link rel="alternate" hreflang="${item.code}" href="${base}index.${item.slug}">`).join('\n');
  const map = LOCALES.map(item => `'${item.slug}':'${item.slug}'`).join(',');
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="1; url=./index.en-us">
<title>GoodPlanCraftLauncher</title>
${hreflang}
    <link rel="alternate" hreflang="x-default" href="${base}index.en-us">
<script>
(function () {
  var tags = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || navigator.userLanguage || 'en'];
  var supported = {${map}};
  function pick(tag) {
    var t = String(tag || '').toLowerCase();
    if (t.indexOf('zh') === 0) return /hant|tw|hk|mo/.test(t) ? 'zh-tw' : 'zh-cn';
    var base = t.split('-')[0];
    return supported[base] || supported[t] || '';
  }
  var slug = '';
  for (var i = 0; i < tags.length && !slug; i++) slug = pick(tags[i]);
  location.replace('./index.' + (slug || 'en-us') + location.search + location.hash);
})();
</script>
</head>
<body>
</body>
</html>
`;
}

function main() {
  const templateHome = fs.readFileSync(path.join(here, 'home.template.html'), 'utf8');
  const templateHistory = fs.readFileSync(path.join(here, 'history.template.html'), 'utf8');
  const baseSite = readJson(path.join(here, 'locales', 'en-us.json'));
  const baseVersions = readJson(path.join(versionsRoot, 'en-us.json'));
  const problems = [];
  const requested = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
  const targets = requested.length ? LOCALES.filter(locale => requested.includes(locale.slug)) : LOCALES;

  for (const locale of targets) {
    const siteFile = path.join(here, 'locales', `${locale.slug}.json`);
    const versionFile = path.join(versionsRoot, `${locale.slug}.json`);
    if (!fs.existsSync(siteFile)) { problems.push(`${locale.slug}: missing site JSON`); continue; }
    if (!fs.existsSync(versionFile)) { problems.push(`${locale.slug}: missing versions JSON`); continue; }
    problems.push(...compareShape(baseSite, readJson(siteFile), `${locale.slug}`).map(p => `site ${p}`));
    const versions = readJson(versionFile);
    if (!Array.isArray(versions.versions)) { problems.push(`${locale.slug}: versions.versions missing`); continue; }
    if (versions.versions.length !== baseVersions.versions.length) {
      problems.push(`${locale.slug}: ${versions.versions.length} versions != ${baseVersions.versions.length}`);
      continue;
    }
    versions.versions.forEach((version, i) => {
      const base = baseVersions.versions[i];
      if (version.version !== base.version) problems.push(`${locale.slug}: version[${i}] ${version.version} != ${base.version}`);
      if (version.anchor !== base.anchor) problems.push(`${locale.slug}: anchor[${i}] ${version.anchor} != ${base.anchor}`);
      if (version.date !== base.date) problems.push(`${locale.slug}: date[${i}] ${version.date} != ${base.date}`);
      if (base.title && !version.title) problems.push(`${locale.slug}: title[${i}] missing`);
      if (version.log.length !== base.log.length) problems.push(`${locale.slug}: log[${i}] ${version.log.length} != ${base.log.length}`);
    });
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
    return;
  }

  for (const locale of targets) buildLocale(locale, templateHome, templateHistory);
  fs.writeFileSync(path.join(siteRoot, 'index.html'), renderEntry(false), 'utf8');
  fs.writeFileSync(path.join(siteRoot, 'history', 'index.html'), renderEntry(true), 'utf8');
  console.log(`Built ${targets.length} locales x 2 pages`);
}

main();
