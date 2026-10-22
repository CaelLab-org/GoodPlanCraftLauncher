import { LOCALES, getLocaleMeta, t } from '../i18n';
import { placeDropdown } from './dom';

interface LanguageChoice {
  code: string;
  name: string;
  detail: string;
}

let currentChoice: string = 'auto';
let systemCode: string = 'zh-CN';
let query: string = '';
let activeIndex: number = -1;
let choices: LanguageChoice[] = [];

function fold(text: string): string {
  let value: string = (text || '').toLowerCase();
  if (value.normalize) value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return value;
}

function buildChoices(): LanguageChoice[] {
  const autoMeta = getLocaleMeta(systemCode);
  const list: LanguageChoice[] = [{
    code: 'auto',
    name: t('ui.follow_system_named', { name: autoMeta.nativeName }),
    detail: t('ui.use_the_operating_system_language')
  }];
  for (const meta of LOCALES) {
    list.push({
      code: meta.code,
      name: meta.nativeName,
      detail: meta.nativeName === meta.englishName ? meta.code : `${meta.englishName} · ${meta.code}`
    });
  }
  return list;
}

function visibleChoices(): LanguageChoice[] {
  const needle: string = fold(query.trim());
  if (!needle) return choices;
  return choices.filter((item: LanguageChoice) => fold(`${item.name} ${item.detail} ${item.code}`).includes(needle));
}

function currentLabel(): string {
  if (currentChoice === 'auto') {
    return t('ui.follow_system_named', { name: getLocaleMeta(systemCode).nativeName });
  }
  return getLocaleMeta(currentChoice).nativeName;
}

export async function refreshLanguagePicker(): Promise<void> {
  try {
    const settings: any = await window.gpcl.getSettings();
    currentChoice = String(settings?.general?.language || 'auto');
  } catch (e) {}
  try {
    const info: any = await window.gpcl.getI18nInfo();
    systemCode = info?.systemLocale || systemCode;
  } catch (e) {}
  choices = buildChoices();
  const valueEl: HTMLElement | null = document.getElementById('settings-language-value');
  if (valueEl) valueEl.textContent = currentLabel();
}

export function initLanguagePicker(): void {
  const root: HTMLElement | null = document.getElementById('settings-language-select');
  const trigger: HTMLElement | null = document.getElementById('settings-language-trigger');
  const dropdown: HTMLElement | null = document.getElementById('settings-language-dropdown');
  const valueEl: HTMLElement | null = document.getElementById('settings-language-value');
  const input: HTMLInputElement | null = document.getElementById('settings-language-search') as HTMLInputElement | null;
  const list: HTMLElement | null = document.getElementById('settings-language-options');
  if (!root || !trigger || !dropdown || !valueEl || !input || !list) return;

  const render = (): void => {
    const items: LanguageChoice[] = visibleChoices();
    list.innerHTML = '';
    if (!items.length) {
      const empty: HTMLDivElement = document.createElement('div');
      empty.className = 'language-empty';
      empty.textContent = t('ui.no_language_found');
      list.appendChild(empty);
      activeIndex = -1;
      return;
    }
    if (activeIndex >= items.length) activeIndex = items.length - 1;
    items.forEach((item: LanguageChoice, index: number) => {
      const option: HTMLDivElement = document.createElement('div');
      option.className = 'language-option';
      option.setAttribute('role', 'option');
      option.dataset.code = item.code;
      if (item.code === currentChoice) option.classList.add('selected');
      if (index === activeIndex) option.classList.add('active');
      option.setAttribute('aria-selected', item.code === currentChoice ? 'true' : 'false');

      const name: HTMLSpanElement = document.createElement('span');
      name.className = 'language-option-name';
      name.textContent = item.name;

      const detail: HTMLSpanElement = document.createElement('span');
      detail.className = 'language-option-meta';
      detail.textContent = item.detail;

      option.appendChild(name);
      option.appendChild(detail);
      option.addEventListener('mousedown', (event: MouseEvent) => {
        event.preventDefault();
        void pick(item.code);
      });
      list.appendChild(option);
    });
  };

  const open = (): void => {
    if (dropdown.classList.contains('open')) return;
    if (!choices.length) choices = buildChoices();
    document.querySelectorAll('.custom-select-dropdown').forEach((node: Element) => node.classList.remove('open'));
    document.querySelectorAll('.custom-select-trigger').forEach((node: Element) => node.classList.remove('active'));
    dropdown.classList.add('open');
    trigger.classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
    query = '';
    input.value = '';
    activeIndex = Math.max(0, visibleChoices().findIndex((item: LanguageChoice) => item.code === currentChoice));
    render();
    placeDropdown(dropdown, trigger);
    input.focus();
  };

  const close = (): void => {
    dropdown.classList.remove('open');
    trigger.classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
    query = '';
    activeIndex = -1;
  };

  const pick = async (code: string): Promise<void> => {
    close();
    if (code === currentChoice) return;
    const result: any = await window.gpcl.setLanguage(code);
    if (result && result.success) {
      currentChoice = code;
      try {
        sessionStorage.setItem('gpcl:restore', JSON.stringify({ page: 'settings', tab: 'appearance' }));
      } catch (e) {}
      // 脚本内联在 index.html 里，重载后的第一帧就是正确的界面，直接刷新即可
      window.location.reload();
    }
  };

  trigger.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    if (dropdown.classList.contains('open')) close();
    else open();
  });

  input.addEventListener('input', (): void => {
    query = input.value;
    activeIndex = 0;
    render();
  });

  input.addEventListener('keydown', (event: KeyboardEvent): void => {
    const items: LanguageChoice[] = visibleChoices();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!items.length) return;
      activeIndex = (activeIndex + 1 + items.length) % items.length;
      render();
      list.querySelector('.language-option.active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!items.length) return;
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      render();
      list.querySelector('.language-option.active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item: LanguageChoice | undefined = items[activeIndex >= 0 ? activeIndex : 0];
      if (item) void pick(item.code);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  document.addEventListener('click', (event: MouseEvent) => {
    if (!root.contains(event.target as Node)) close();
  });

  void (async (): Promise<void> => {
    try {
      const settings: any = await window.gpcl.getSettings();
      currentChoice = String(settings?.general?.language || 'auto');
    } catch (e) {}
    try {
      const info: any = await window.gpcl.getI18nInfo();
      systemCode = info?.systemLocale || 'zh-CN';
    } catch (e) {}
    choices = buildChoices();
    valueEl.textContent = currentLabel();
  })();
}
