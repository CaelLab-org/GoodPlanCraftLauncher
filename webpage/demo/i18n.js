/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

(function () {
  'use strict';

  var dict = window.DEMO_DICTIONARY || null;
  var slug = window.DEMO_SLUG || 'en-us';
  var localeMap = {
    'en-us': 'en-US',
    'zh-cn': 'zh-CN',
    'zh-tw': 'zh-TW'
  };
  var lang = localeMap[slug] || slug;
  var rtl = slug === 'ar' || slug === 'fa' || slug === 'he';

  function t(key, vars) {
    var text = dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        text = text.split('{' + name + '}').join(vars[name]);
      });
    }
    return text;
  }

  /* 元素里有图标之类的子元素时，只替换它自己的文本节点，保留两侧空白和子元素 */
  function setText(el, text) {
    if (!el.firstElementChild) {
      el.textContent = text;
      return;
    }
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      var lead = node.nodeValue.match(/^\s*/)[0];
      var trail = node.nodeValue.match(/\s*$/)[0];
      node.nodeValue = lead + text + trail;
      return;
    }
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      setText(el, t(el.getAttribute('data-i18n')));
    });
    ['aria-label', 'title', 'alt', 'placeholder'].forEach(function (attr) {
      root.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (el) {
        el.setAttribute(attr, t(el.getAttribute('data-i18n-' + attr)));
      });
    });
  }

  document.documentElement.lang = lang;
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  window.DEMO_I18N = { lang: lang, t: t, apply: apply };
  apply(document);
})();
