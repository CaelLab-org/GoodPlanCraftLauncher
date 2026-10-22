// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'GoodPlanCraftLauncher',
  tagline: 'Minecraft launcher help',

  // 用官网自己的图标，不在文档站里再存一份
  favicon: 'https://gamets.caellab.com/gpcl/icon.png',

  // 文档站挂在官网的路径下（/gpcl/docs/）。启动器里的帮助地址写死在这个路径上，
  // 改 baseUrl 时要把 renderer/index.html 和 src/renderer/*.ts 里的链接一起改。
  // 旧的 /gpcl/help/ 由 nginx 永久重定向到这里，老版本启动器还指着它。
  url: 'https://gamets.caellab.com',
  baseUrl: '/gpcl/docs/',
  trailingSlash: true,

  organizationName: 'CaelLab',
  projectName: 'GoodPlanCraftLauncher',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: [
      'zh-Hans',
      'en',
      'zh-Hant',
      'ja',
      'ko',
      'ru',
      'de',
      'fr',
      'es',
      'pt',
      'it',
      'nl',
      'pl',
      'uk',
      'tr',
      'ar',
      'fa',
      'he',
      'hi',
      'bn',
      'id',
      'ms',
      'vi',
      'th',
      'el',
    ],
    localeConfigs: {
      // 默认语言默认会直接铺在 baseUrl 根上，这里显式给它加上 /zh-Hans/，
      // 让 25 种语言都带前缀；根路径由 build 脚本写成跳转到 /en/ 的页面。
      'zh-Hans': { label: '简体中文', baseUrl: '/gpcl/docs/zh-Hans/' },
      en: { label: 'English' },
      'zh-Hant': { label: '繁體中文' },
      ja: { label: '日本語' },
      ko: { label: '한국어' },
      ru: { label: 'Русский' },
      de: { label: 'Deutsch' },
      fr: { label: 'Français' },
      es: { label: 'Español' },
      pt: { label: 'Português' },
      it: { label: 'Italiano' },
      nl: { label: 'Nederlands' },
      pl: { label: 'Polski' },
      uk: { label: 'Українська' },
      tr: { label: 'Türkçe' },
      ar: { label: 'العربية', direction: 'rtl' },
      fa: { label: 'فارسی', direction: 'rtl' },
      he: { label: 'עברית', direction: 'rtl' },
      hi: { label: 'हिन्दी' },
      bn: { label: 'বাংলা' },
      id: { label: 'Bahasa Indonesia' },
      ms: { label: 'Bahasa Melayu' },
      vi: { label: 'Tiếng Việt' },
      th: { label: 'ไทย' },
      el: { label: 'Ελληνικά' },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'main',
        path: 'docs',
        routeBasePath: '/',
        sidebarPath: './sidebars.js',
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'GoodPlanCraftLauncher',
        logo: {
          alt: 'GoodPlanCraftLauncher',
          src: 'https://gamets.caellab.com/gpcl/icon.png',
          href: 'https://gamets.caellab.com/gpcl/',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'mainSidebar',
            docsPluginId: 'main',
            position: 'left',
            label: '帮助文档',
          },
          {
            href: 'https://gamets.caellab.com/gpcl/',
            label: '返回官网',
            position: 'right',
          },
          {
            href: 'https://github.com/CaelLab-org/GoodPlanCraftLauncher',
            label: 'GitHub',
            position: 'right',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            title: '入口',
            items: [
              { label: 'GPCL 官网', href: 'https://gamets.caellab.com/gpcl/' },
              { label: '下载最新版', href: 'https://gamets.caellab.com/gpcl/#download' },
              { label: 'GitHub 源码', href: 'https://github.com/CaelLab-org/GoodPlanCraftLauncher' },
            ],
          },
          {
            title: '帮助',
            items: [
              { label: '安装与更新', to: '/install' },
              { label: 'Java 与内存', to: '/java-memory' },
              { label: '游戏崩溃', to: '/mc-game' },
            ],
          },
          {
            title: '联系',
            items: [
              { label: 'gamets@caellab.com', href: 'mailto:gamets@caellab.com' },
              { label: '官方论坛', href: 'https://forum.xmuer.online' },
              { label: '虚舟实验室', href: 'https://www.caellab.com/' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} <a href="https://www.caellab.com/" target="_blank" rel="noopener">虚舟实验室（CaelLab）</a> · CaelLabGameTS · 项目主页 <a href="https://gamets.caellab.com/gpcl/" target="_blank" rel="noopener">gamets.caellab.com/gpcl</a> · <a href="https://www.caellab.com/license/cbs-v3" target="_blank" rel="noopener">CaelLab BY-SA Code License v3</a>`,
      },
      prism: {
        theme: require('prism-react-renderer').themes.github,
        darkTheme: require('prism-react-renderer').themes.dracula,
        additionalLanguages: ['bash', 'json', 'ini'],
      },
    }),
};

module.exports = config;
