import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ru from './locales/ru.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';
import fa from './locales/fa.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import id from './locales/id.json';
import ms from './locales/ms.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import el from './locales/el.json';

export interface LocaleMeta {
  code: string;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en-US', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', dir: 'ltr' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'fa', nativeName: 'فارسی', englishName: 'Persian', dir: 'rtl' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', dir: 'rtl' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', dir: 'ltr' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', dir: 'ltr' },
  { code: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', dir: 'ltr' },
];

const DICTIONARIES: Record<string, Record<string, string>> = {
  'en-US': enUS as Record<string, string>,
  'zh-CN': zhCN as Record<string, string>,
  'zh-TW': zhTW as Record<string, string>,
  ja: ja as Record<string, string>,
  ko: ko as Record<string, string>,
  ru: ru as Record<string, string>,
  de: de as Record<string, string>,
  fr: fr as Record<string, string>,
  es: es as Record<string, string>,
  pt: pt as Record<string, string>,
  it: it as Record<string, string>,
  nl: nl as Record<string, string>,
  pl: pl as Record<string, string>,
  uk: uk as Record<string, string>,
  tr: tr as Record<string, string>,
  ar: ar as Record<string, string>,
  fa: fa as Record<string, string>,
  he: he as Record<string, string>,
  hi: hi as Record<string, string>,
  bn: bn as Record<string, string>,
  id: id as Record<string, string>,
  ms: ms as Record<string, string>,
  vi: vi as Record<string, string>,
  th: th as Record<string, string>,
  el: el as Record<string, string>,
};

// 早期版本用中文原文当 key；保留一张反查表，旧调用点和新 key 可以共存。
const ZH_TO_KEY: Record<string, string> = {};
const EN_TO_KEY: Record<string, string> = {};
for (const [key, value] of Object.entries(zhCN as Record<string, string>)) {
  const text: string = value.trim();
  if (text && !ZH_TO_KEY[text]) ZH_TO_KEY[text] = key;
}
for (const [key, value] of Object.entries(enUS as Record<string, string>)) {
  const text: string = value.trim();
  if (text && !EN_TO_KEY[text]) EN_TO_KEY[text] = key;
}

// 帮助中心（docs-site）的语言目录和启动器的 BCP-47 标记不完全一样：
// 英文在 en/，简体中文是 zh-Hans/（根路径只做跳转到英文），繁体是 zh-Hant。
const DOCS_LOCALE: Record<string, string> = {
  'en-US': 'en',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  ja: 'ja',
  ko: 'ko',
  ru: 'ru',
  de: 'de',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  uk: 'uk',
  tr: 'tr',
  ar: 'ar',
  fa: 'fa',
  he: 'he',
  hi: 'hi',
  bn: 'bn',
  id: 'id',
  ms: 'ms',
  vi: 'vi',
  th: 'th',
  el: 'el',
};

const BASE_LANGUAGES: string[] = ['ja', 'ko', 'ru', 'de', 'fr', 'es', 'pt', 'it', 'nl', 'pl', 'uk', 'tr', 'ar', 'fa', 'he', 'hi', 'bn', 'id', 'ms', 'vi', 'th', 'el'];

let currentLocale: string = 'en-US';
let systemLocale: string = 'en-US';

export function isSupportedLocale(code: string): boolean {
  return LOCALES.some((item) => item.code === code);
}

export function normalizeLocaleTag(tag: string): string {
  const value: string = String(tag || '').trim().toLowerCase().replace(/_/g, '-');
  if (!value) return '';
  if (value.startsWith('zh')) {
    return /(hant|tw|hk|mo)/.test(value) ? 'zh-TW' : 'zh-CN';
  }
  if (value === 'he' || value.startsWith('he-') || value === 'iw' || value.startsWith('iw-')) return 'he';
  if (value === 'id' || value.startsWith('id-') || value === 'in' || value.startsWith('in-')) return 'id';
  const base: string = value.split('-')[0];
  if (base === 'en') return 'en-US';
  return BASE_LANGUAGES.includes(base) ? base : '';
}

export function resolveSystemLocale(tags: string[]): string {
  for (const tag of tags || []) {
    const normalized: string = normalizeLocaleTag(tag);
    if (normalized && isSupportedLocale(normalized)) return normalized;
  }
  return 'en-US';
}

export function resolveLocale(preference: string, systemTags: string[]): string {
  const picked: string = String(preference || 'auto').trim();
  if (picked && picked !== 'auto' && isSupportedLocale(picked)) return picked;
  return resolveSystemLocale(systemTags);
}

export function setSystemLocale(code: string): void {
  systemLocale = isSupportedLocale(code) ? code : 'en-US';
}

export function getSystemLocale(): string {
  return systemLocale;
}

export function setLocale(code: string): void {
  currentLocale = isSupportedLocale(code) ? code : 'en-US';
  try {
    document.documentElement.lang = currentLocale;
    document.documentElement.dir = getLocaleMeta(currentLocale).dir;
  } catch (e) {}
}

export function getLocale(): string {
  return currentLocale;
}

export function docsUrl(path: string = ''): string {
  const docsLocale: string = DOCS_LOCALE[currentLocale] ?? '';
  const prefix: string = docsLocale ? `${docsLocale}/` : '';
  return `https://gamets.caellab.com/gpcl/docs/${prefix}${path}`;
}

export function getLocaleMeta(code: string = currentLocale): LocaleMeta {
  return LOCALES.find((item) => item.code === code) || LOCALES[0];
}

function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match: string, key: string) => {
    const value: unknown = params[key];
    return value === undefined || value === null ? match : String(value);
  });
}

function lookupKey(key: string): string | null {
  const dictionary: Record<string, string> | undefined = DICTIONARIES[currentLocale];
  if (dictionary && Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key];
  const mapped: string | undefined = ZH_TO_KEY[key] || EN_TO_KEY[key];
  if (mapped && dictionary && Object.prototype.hasOwnProperty.call(dictionary, mapped)) {
    return dictionary[mapped];
  }
  return null;
}

export function t(key: string, params?: Record<string, unknown>): string {
  const translated: string | null = lookupKey(key);
  return interpolate(translated === null ? key : translated, params);
}

export function translateText(text: string): string {
  const trimmed: string = text.trim();
  if (!trimmed) return text;
  const hasCjk: boolean = /[\u4e00-\u9fff]/.test(trimmed);
  // 已经是目标语言就别再查表，否则观察器会把文字改来改去，渲染进程直接卡死。
  if (currentLocale === 'zh-CN' && hasCjk) return text;
  if (currentLocale === 'en-US' && !hasCjk) return text;
  const translated: string | null = lookupKey(trimmed);
  if (translated === null) return text;
  // 译文按 trim 后的内容回填、原文的缩进保留。直接把带空白的译文塞回 replace，
  // 每次观察器回调都会多叠一层空白，文本无限变长，渲染进程直接卡死。
  const next: string = translated.trim();
  if (next === trimmed) return text;
  return text.replace(trimmed, () => next);
}

const SKIP_TAGS: Set<string> = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);

function shouldSkip(node: Node): boolean {
  let element: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute('data-i18n-skip')) return true;
    element = element.parentElement;
  }
  return false;
}

function translateTextNode(node: Node): void {
  if (!node.nodeValue || !node.nodeValue.trim()) return;
  if (shouldSkip(node)) return;
  const next: string = translateText(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function translateAttributes(element: Element): void {
  const mappings: Array<[string, string]> = [
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-title', 'title'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-alt', 'alt'],
  ];
  for (const [dataAttribute, attribute] of mappings) {
    const key: string | null = element.getAttribute(dataAttribute);
    if (!key) continue;
    const next: string = t(key);
    if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
  }
  const legacyAttributes: string[] = ['placeholder', 'title', 'aria-label', 'alt'];
  for (const name of legacyAttributes) {
    const value: string | null = element.getAttribute(name);
    if (!value || !value.trim()) continue;
    const next: string = translateText(value);
    if (next !== value) element.setAttribute(name, next);
  }
}

function applyElementTranslations(element: Element): void {
  const key: string | null = element.getAttribute('data-i18n');
  if (key) {
    const next: string = t(key);
    if (element.textContent !== next) element.textContent = next;
  }
  const htmlKey: string | null = element.getAttribute('data-i18n-html');
  if (htmlKey) {
    const next: string = t(htmlKey);
    if (element.innerHTML !== next) element.innerHTML = next;
  }
}

export function applyI18n(root: ParentNode = document.body): void {
  if (!root) return;
  if (root instanceof Element) applyElementTranslations(root);
  const elements: NodeListOf<Element> = (root as ParentNode).querySelectorAll('*');
  elements.forEach((element: Element) => applyElementTranslations(element));
  elements.forEach((element: Element) => translateAttributes(element));
  if (root instanceof Element) translateAttributes(root);

  const walker: TreeWalker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes: Node[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) translateTextNode(node);
}

let observer: MutationObserver | null = null;

export function observeI18n(): void {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateTextNode(mutation.target);
        continue;
      }
      mutation.addedNodes.forEach((node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          translateTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          applyI18n(node as Element);
        }
      });
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        translateAttributes(mutation.target as Element);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
  });
}

export function initI18n(preference: string, systemTags: string[]): void {
  setSystemLocale(resolveSystemLocale(systemTags));
  setLocale(resolveLocale(preference, systemTags));
}
