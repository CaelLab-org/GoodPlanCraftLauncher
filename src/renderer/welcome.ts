/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */


import { LOCALES, applyI18n, getLocaleMeta, getSystemLocale, setLocale, t } from '../i18n';
import { refreshLanguagePicker } from './language';
import { applyStyle, loadSettings, saveStyleSetting } from './settings';

interface WelcomeLanguage {
  code: string;
  name: string;
  detail: string;
}

let slideIndex: number = 0;
let currentChoice: string = 'auto';

function fold(text: string): string {
  let value: string = (text || '').toLowerCase();
  if (value.normalize) value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return value;
}

export function initWelcome(firstRun: boolean): void {
  const overlay: HTMLElement | null = document.getElementById('welcome-overlay');
  if (!overlay) return;
  if (!firstRun) {
    overlay.classList.add('hidden');
    return;
  }

  const track: HTMLElement | null = document.getElementById('welcome-track');
  const slides: NodeListOf<HTMLElement> = overlay.querySelectorAll<HTMLElement>('.welcome-slide');
  const dots: NodeListOf<HTMLButtonElement> = overlay.querySelectorAll<HTMLButtonElement>('.welcome-dot');
  const nextBtn: HTMLButtonElement | null = document.getElementById('welcome-next') as HTMLButtonElement | null;
  const skipBtn: HTMLElement | null = document.getElementById('welcome-skip');
  const searchInput: HTMLInputElement | null = document.getElementById('welcome-language-search') as HTMLInputElement | null;
  const languageList: HTMLElement | null = document.getElementById('welcome-language-list');
  const styleCards: NodeListOf<HTMLElement> = overlay.querySelectorAll<HTMLElement>('.welcome-style-card');
  const appLayout: HTMLElement | null = document.querySelector('.app-layout');
  if (!track || !nextBtn || !skipBtn || !searchInput || !languageList) return;

  const lastSlide: number = slides.length - 1;

  const setBackgroundInert = (inert: boolean): void => {
    if (!appLayout) return;
    if (inert) appLayout.setAttribute('inert', '');
    else appLayout.removeAttribute('inert');
  };

  const languageChoices = (): WelcomeLanguage[] => {
    const system: ReturnType<typeof getLocaleMeta> = getLocaleMeta(getSystemLocale());
    const list: WelcomeLanguage[] = [{
      code: 'auto',
      name: t('ui.follow_system_named', { name: system.nativeName }),
      detail: t('ui.use_the_operating_system_language'),
    }];
    for (const meta of LOCALES) {
      list.push({ code: meta.code, name: meta.nativeName, detail: meta.englishName });
    }
    return list;
  };

  const renderLanguages = (): void => {
    const needle: string = fold(searchInput.value.trim());
    const items: WelcomeLanguage[] = languageChoices().filter((item: WelcomeLanguage) =>
      !needle || fold(`${item.name} ${item.detail} ${item.code}`).includes(needle)
    );
    languageList.innerHTML = '';
    for (const item of items) {
      const button: HTMLButtonElement = document.createElement('button');
      button.type = 'button';
      button.className = 'welcome-language-item';
      button.dataset.code = item.code;
      button.setAttribute('role', 'option');
      if (item.code === currentChoice) {
        button.classList.add('is-selected');
        button.setAttribute('aria-selected', 'true');
      }

      const text: HTMLSpanElement = document.createElement('span');
      text.className = 'welcome-language-text';
      const name: HTMLSpanElement = document.createElement('span');
      name.className = 'welcome-language-native';
      name.textContent = item.name;
      const detail: HTMLSpanElement = document.createElement('span');
      detail.className = 'welcome-language-meta';
      detail.textContent = item.detail;
      text.appendChild(name);
      text.appendChild(detail);
      button.appendChild(text);

      if (item.code === currentChoice) {
        const check: HTMLSpanElement = document.createElement('span');
        check.className = 'icon icon-check';
        button.appendChild(check);
      }

      button.addEventListener('click', () => void pickLanguage(item.code));
      languageList.appendChild(button);
    }
  };

  const updateFooter = (): void => {
    dots.forEach((dot: HTMLButtonElement, index: number) => {
      dot.classList.toggle('is-on', index === slideIndex);
      dot.setAttribute('aria-label', t('ui.welcome_step_of', { current: index + 1, total: slides.length }));
      dot.setAttribute('aria-selected', index === slideIndex ? 'true' : 'false');
    });
    const last: boolean = slideIndex === lastSlide;
    nextBtn.setAttribute('data-i18n', last ? 'ui.welcome_start' : 'ui.welcome_continue');
    nextBtn.textContent = t(last ? 'ui.welcome_start' : 'ui.welcome_continue');
    skipBtn.classList.toggle('hidden', last);
  };

  const go = (next: number): void => {
    slideIndex = Math.max(0, Math.min(lastSlide, next));
    track.style.transform = `translateX(-${slideIndex * 100}%)`;
    slides.forEach((slide: HTMLElement, index: number) => {
      slide.classList.toggle('is-active', index === slideIndex);
      if (index === slideIndex) slide.removeAttribute('inert');
      else slide.setAttribute('inert', '');
    });
    updateFooter();
  };

  const finish = async (): Promise<void> => {
    overlay.classList.add('hidden');
    setBackgroundInert(false);
    try {
      await window.gpcl.completeWelcome();
    } catch (e) {}
  };

  const pickLanguage = async (code: string): Promise<void> => {
    const result: any = await window.gpcl.setLanguage(code);
    if (!result || !result.success) return;
    currentChoice = code;
    setLocale(result.locale || (code === 'auto' ? getSystemLocale() : code));
    applyI18n(document.body);
    renderLanguages();
    updateFooter();
    void refreshLanguagePicker();
  };

  const selectStyle = async (style: string): Promise<void> => {
    applyStyle(style);
    styleCards.forEach((card: HTMLElement) => {
      card.classList.toggle('is-selected', card.dataset.style === style);
    });
    document.querySelectorAll<HTMLInputElement>('#settings-style input[name="style"]').forEach((radio: HTMLInputElement) => {
      radio.checked = radio.value === style;
    });
    await saveStyleSetting(style);
  };

  nextBtn.addEventListener('click', () => {
    if (slideIndex < lastSlide) go(slideIndex + 1);
    else void finish();
  });
  skipBtn.addEventListener('click', () => void finish());

  dots.forEach((dot: HTMLButtonElement, index: number) => {
    dot.addEventListener('click', () => go(index));
  });

  searchInput.addEventListener('input', renderLanguages);

  styleCards.forEach((card: HTMLElement) => {
    card.addEventListener('click', () => void selectStyle(String(card.dataset.style || 'advanced')));
  });

  void (async (): Promise<void> => {
    let style: string = 'advanced';
    try {
      const settings: any = await loadSettings();
      currentChoice = String(settings?.general?.language || 'auto');
      style = String(settings?.appearance?.style || 'advanced');
    } catch (e) {}
    applyStyle(style);
    styleCards.forEach((card: HTMLElement) => {
      card.classList.toggle('is-selected', card.dataset.style === style);
    });
    renderLanguages();
    go(0);
    setBackgroundInert(true);
    overlay.classList.remove('hidden');
  })();
}
