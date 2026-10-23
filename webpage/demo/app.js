/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 3
 * or any later version. https://www.caellab.com/license/cbs-v3.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 * Project: https://gamets.caellab.com/gpcl/
 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');
  var body = document.body;
  var t = window.DEMO_I18N.t;

  /* ===== 主题：默认跟随系统（判不出来就用浅色），设置里可以手动改 =====
     app.js 是 body 末尾的同步脚本，第一帧之前就跑完了，所以不会闪一下深色 */
  var themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var followsSystemTheme = true;
  var currentTheme = 'light';

  function applyTheme(theme) {
    currentTheme = theme;
    body.classList.toggle('light-mode', theme === 'light');
  }
  applyTheme(themeQuery && !themeQuery.matches ? 'dark' : 'light');
  if (themeQuery && themeQuery.addEventListener) {
    themeQuery.addEventListener('change', function (e) {
      if (followsSystemTheme) applyTheme(e.matches ? 'light' : 'dark');
    });
  }

  /* ===== 舞台缩放：固定 1000×620 的“窗口”，按容器等比缩到刚好放下 ===== */
  var params = new URLSearchParams(location.search);
  var fitMode = params.get('fit') === '1';
  function fitStage() {
    if (!fitMode) return;
    var k = Math.min(window.innerWidth / 1000, window.innerHeight / 620);
    stage.style.transform = 'scale(' + k + ')';
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  /* ===== 提示条 ===== */
  var toastIcons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  function toast(title, message, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML =
      '<span class="toast-icon icon icon-' + toastIcons[type] + '"></span>' +
      '<div><div class="toast-title"></div><div class="toast-message"></div></div>';
    el.querySelector('.toast-title').textContent = title;
    el.querySelector('.toast-message').textContent = message || '';
    $('toast-container').appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  }

  /* ===== 页面切换 ===== */
  var pages = { launch: $('launch-page'), download: $('download-page'), settings: $('settings-page') };
  var menus = { launch: $('menu-launch'), download: $('menu-download'), settings: $('menu-settings') };
  function showPage(name) {
    Object.keys(pages).forEach(function (k) {
      pages[k].classList.toggle('hidden', k !== name);
      menus[k].classList.toggle('active', k === name);
    });
    if (name === 'download') showDownloadTab(currentDownloadTab);
  }
  Object.keys(menus).forEach(function (k) {
    menus[k].addEventListener('click', function () { showPage(k); });
  });

  document.querySelector('.min-btn').addEventListener('click', function () {
    toast(t('Minimize'), t("You can't minimize a window in a web page"), 'info');
  });
  document.querySelector('.close-btn').addEventListener('click', function () {
    toast(t("Can't close it"), t('This is just a web page window'), 'info');
  });

  /* ===== 启动页：版本选择（版本数据都在 versions.js 里） ===== */
  var DATA = window.GPCL_VERSIONS;
  var installed = DATA.installed;
  var selectedVersion = installed[0].id;
  var installedTimeLabels = { '2 小时前': '2 hours ago' };

  function renderLaunchVersions() {
    var box = $('launch-version-list');
    box.innerHTML = '';
    installed.forEach(function (v) {
      var el = document.createElement('div');
      el.className = 'version-item' + (v.id === selectedVersion ? ' selected' : '');
      el.innerHTML = '<span class="version-item-icon icon icon-' +
        (v.recent ? 'star' : 'box') + '"></span>' +
        '<span class="version-item-id"></span><span class="version-item-time"></span>';
      el.querySelector('.version-item-id').textContent = v.id;
      el.querySelector('.version-item-time').textContent = t(installedTimeLabels[v.time] || v.time);
      el.addEventListener('click', function () {
        selectedVersion = v.id;
        renderLaunchVersions();
        updateSelectedDisplay();
      });
      box.appendChild(el);
    });
    $('version-count').textContent = t('{n} versions', { n: installed.length });
    updateSelectedDisplay();
  }

  function updateSelectedDisplay() {
    var display = $('selected-version-display');
    display.classList.remove('hidden');
    $('selected-version-text').textContent = selectedVersion;
    $('selected-version-name').textContent = 'Minecraft ' + selectedVersion;
  }
  renderLaunchVersions();
  $('version-select-btn').addEventListener('click', function () {
    var panel = $('version-select-panel');
    var hidden = panel.classList.toggle('hidden');
    panel.style.animation = hidden ? '' : 'slideInRight 0.3s ease-out';
  });

  /* ===== 启动页：用户名历史 ===== */
  var history = ['GPCL_Player', 'Yunyun', 'Steve'];
  var historyOpen = false;
  var historyBox = $('username-history');
  var historyBtn = $('username-history-btn');

  function renderHistory() {
    historyBox.innerHTML = '';
    if (!history.length) {
      historyBox.innerHTML = '<div class="username-history-empty"></div>';
      historyBox.firstChild.textContent = t('No recent names yet');
      return;
    }
    history.forEach(function (name) {
      var item = document.createElement('div');
      item.className = 'username-history-item';
      item.innerHTML = '<span class="username-history-name"></span><button class="username-history-remove" type="button">&times;</button>';
      item.querySelector('.username-history-name').textContent = name;
      item.querySelector('.username-history-name').addEventListener('click', function () {
        $('username').value = name;
        toggleHistory(false);
      });
      item.querySelector('.username-history-remove').addEventListener('click', function (e) {
        e.stopPropagation();
        history = history.filter(function (n) { return n !== name; });
        renderHistory();
      });
      historyBox.appendChild(item);
    });
  }

  function toggleHistory(open) {
    historyOpen = open === undefined ? !historyOpen : open;
    historyBox.classList.toggle('hidden', !historyOpen);
    historyBtn.classList.toggle('open', historyOpen);
  }
  historyBtn.addEventListener('click', function () { toggleHistory(); });
  document.addEventListener('click', function (e) {
    if (historyOpen && !e.target.closest('.username-field')) toggleHistory(false);
  });

  /* ===== 启动流程 ===== */
  var launchOverlay = $('launch-animation-overlay');
  var monitor = $('game-monitor');
  var running = false;
  var uptimeTimer = null;
  var uptimeSeconds = 0;

  var tips = [
    "Minecraft block textures are only 16×16 pixels — that's why the art style stays so consistent.",
    'One block in the Nether equals eight in the Overworld, so portals beat boats for long trips.',
    'A diamond pickaxe needs 9.4 seconds per obsidian block — bring one before heading to the Nether.',
    'Place a water bucket under your feet before you land to cancel all fall damage.',
    'A mob renamed with a name tag will never despawn.',
    'Bookshelves around an enchanting table raise its level — 15 is the maximum you need.',
    "Beds explode in the Nether and the End, so don't try to sleep there.",
    'Creepers began as a pig model with the dimensions mixed up, and the mistake was kept.',
    'Endermen were inspired by the Slender Man internet legend.',
    'GPCL is a launcher built by Yunyun alone — there is no development team behind it.'
  ];

  var statusMessages = [
    'Checking game files...',
    'Preparing the Java runtime...',
    'Initializing the game environment...',
    'Opening the game window...'
  ];

  var progressTimer = null;
  var particleTimer = null;

  function spawnParticles() {
    var box = $('break-particles');
    var colors = ['#4a4a4a', '#353535', '#484848', '#424242', '#3a3a3a', '#26C6DA'];
    for (var i = 0; i < 4; i++) {
      var p = document.createElement('span');
      var size = 3 + Math.random() * 4;
      p.style.position = 'absolute';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      box.appendChild(p);
      var angle = Math.random() * Math.PI * 2;
      var dist = 24 + Math.random() * 34;
      var anim = p.animate([
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: 'translate(' + Math.cos(angle) * dist + 'px,' + (Math.sin(angle) * dist - 10) + 'px)', opacity: 0 }
      ], { duration: 520 + Math.random() * 320, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      anim.onfinish = function () { p.remove(); };
    }
  }

  function startLaunch() {
    if (running) return;
    var overlay = launchOverlay;
    var fill = $('launch-progress-fill');
    var statusText = $('launch-status-text');
    var tipCard = $('launch-tip-card');

    fill.style.width = '0%';
    statusText.textContent = t('Starting the game...');
    $('launch-version-info').textContent = selectedVersion + ' · ' + t('Offline Mode') + ' · ' + $('username').value;
    tipCard.classList.add('hidden');
    overlay.classList.remove('hidden', 'fade-out');
    // 别用连续两帧 rAF 触发过渡：后台标签页里 rAF 不回调，元素会卡在初始态
    void overlay.offsetWidth;
    overlay.classList.add('show');

    var tipShown = false;
    var progress = 0;
    progressTimer = setInterval(function () {
      progress += Math.random() * 14 + 6;
      if (progress >= 90) { progress = 90; clearInterval(progressTimer); progressTimer = null; }
      fill.style.width = progress + '%';
      statusText.textContent = t(statusMessages[Math.min(3, Math.floor(progress / 24))]);
      if (!tipShown && progress > 40) {
        tipShown = true;
        $('launch-tip-text').textContent = t(tips[Math.floor(Math.random() * tips.length)]);
        tipCard.classList.remove('hidden');
      }
    }, 220);

    particleTimer = setInterval(spawnParticles, 280);

    setTimeout(function () {
      clearInterval(progressTimer);
      progressTimer = null;
      clearInterval(particleTimer);
      particleTimer = null;
      fill.style.width = '100%';
      statusText.textContent = t('Minecraft started');

      setTimeout(function () {
        overlay.classList.add('fade-out');
        setTimeout(function () {
          overlay.classList.add('hidden');
          overlay.classList.remove('show', 'fade-out');
          beginSession();
        }, 340);
      }, 420);
    }, 3000);
  }

  function beginSession() {
    running = true;
    uptimeSeconds = 0;
    monitor.classList.add('active');
    $('game-monitor-dot').classList.add('running');
    $('game-monitor-state').textContent = t('Running');
    $('mon-version').textContent = selectedVersion;
    $('mon-pid').textContent = String(10000 + Math.floor(Math.random() * 20000));
    $('mon-uptime').textContent = '00:00';
    $('mon-memory').textContent = '1.8 GB / 4.0 GB';
    uptimeTimer = setInterval(function () {
      uptimeSeconds++;
      var m = String(Math.floor(uptimeSeconds / 60)).padStart(2, '0');
      var s = String(uptimeSeconds % 60).padStart(2, '0');
      $('mon-uptime').textContent = m + ':' + s;
      $('mon-memory').textContent = (1.8 + Math.random() * 1.2).toFixed(1) + ' GB / 4.0 GB';
    }, 1000);
    toast(t('Game started'), 'Minecraft ' + selectedVersion + ' · ' + t('Offline Mode'), 'success');
  }

  function endSession(silent) {
    running = false;
    clearInterval(uptimeTimer);
    uptimeTimer = null;
    monitor.classList.remove('active');
    $('game-monitor-dot').classList.remove('running');
    $('game-monitor-state').textContent = t('Not running');
    if (!silent) toast(t('Game ended'), t('Ran for {time}', { time: $('mon-uptime').textContent }), 'info');
  }

  $('launch-btn').addEventListener('click', startLaunch);
  $('launch-cancel-btn').addEventListener('click', function () {
    clearInterval(progressTimer);
    clearInterval(particleTimer);
    progressTimer = particleTimer = null;
    launchOverlay.classList.add('hidden');
    launchOverlay.classList.remove('show');
    toast(t('Launch cancelled'), t('The process never started, so nothing was left behind'), 'info');
  });
  $('mon-stop-btn').addEventListener('click', function () { endSession(); });

  /* ===== 日志窗口 ===== */
  var logLines = [
    '[20:41:03] [main/INFO]: Loading Minecraft 1.21.4 with Fabric Loader',
    '[20:41:03] [main/INFO]: Loading 42 mods:',
    '[20:41:04] [main/INFO]:   fabric-api 0.110.5+1.21.4',
    '[20:41:06] [Render thread/INFO]: Backend library: LWJGL 3.3.3',
    '[20:41:07] [Render thread/WARN]: Pack "vanilla" was not found, using built-in',
    '[20:41:09] [Render thread/INFO]: Sound engine started',
    '[20:41:11] [Render thread/INFO]: Created: 1024x512x4 minecraft:textures/atlas/blocks.png',
    '[20:41:12] [Render thread/INFO]: OpenAL initialized on device Speakers (Realtek)',
    '[20:41:14] [Render thread/INFO]: Narrator library for x64 loaded',
    '[20:41:15] [Render thread/INFO]: Done (11.842s)!'
  ];
  $('mon-log-btn').addEventListener('click', function () {
    var view = $('log-view');
    view.innerHTML = '';
    logLines.forEach(function (line) {
      var div = document.createElement('div');
      if (line.indexOf('WARN') !== -1) div.className = 'log-warn';
      else if (line.indexOf('Done') !== -1) div.className = 'log-ok';
      div.textContent = t(line);
      view.appendChild(div);
    });
    $('log-overlay').classList.remove('hidden');
  });
  $('log-close').addEventListener('click', function () { $('log-overlay').classList.add('hidden'); });

  /* ===== 下载页（版本表也在 versions.js 里） ===== */
  var VERSIONS = DATA.versions;
  var LOADERS = DATA.loaders;
  var releaseIndex = {};
  VERSIONS.forEach(function (row) { releaseIndex[row[0]] = row; });
  var NEOFORGE = window.GPCL_NEOFORGE || {};
  var loaderMeta = {
    forge: { name: 'Forge', desc: 'Forge mod loader', icon: 'gear' },
    neoforge: { name: 'NeoForge', desc: 'NeoForge mod loader', icon: 'loader' },
    fabric: { name: 'Fabric', desc: 'Fabric mod loader', icon: 'thread' },
    optifine: { name: 'OptiFine', desc: 'OptiFine HD patches', icon: 'eye' }
  };
  var releaseTypes = { '正式版': 'Release', '快照': 'Snapshot', '旧版': 'Old' };
  function releaseTypeLabel(type) {
    return t(releaseTypes[type] || type);
  }
  var currentRelease = null;
  var pickedLoader = null;

  function releaseOf(row) {
    var loaders = Object.assign({}, LOADERS[row[0]] || {});
    if (NEOFORGE[row[0]]) loaders.neoforge = NEOFORGE[row[0]];
    return { id: row[0], type: row[1], date: row[2], loaders: loaders };
  }

  /* 900 多个版本，一次性拼好塞进去；第一次打开下载页才渲染 */
  var listRendered = false;
  function renderReleaseList() {
    if (listRendered) return;
    listRendered = true;
    var byType = {};
    VERSIONS.forEach(function (row) {
      (byType[row[1]] = byType[row[1]] || []).push(row);
    });
    var html = '';
    ['正式版', '快照', '旧版'].forEach(function (type) {
      if (!byType[type]) return;
      html += '<div class="release-group">' +
        '<span class="release-group-dot' + (type === '正式版' ? ' on' : '') + '"></span>' +
        '<span class="release-group-name">' + releaseTypeLabel(type) + '</span>' +
        '<span class="release-group-count">' + t('{n} versions', { n: byType[type].length }) + '</span></div>';
      byType[type].forEach(function (row) {
        html += '<div class="release-row" data-id="' + row[0] + '">' +
          '<span class="release-id">' + row[0] + '</span>' +
          '<span class="release-date">' + row[2] + '</span></div>';
      });
    });
    var box = $('version-list');
    box.innerHTML = html;
    box.addEventListener('click', function (e) {
      var row = e.target.closest('.release-row');
      if (row) openDetail(releaseOf(releaseIndex[row.dataset.id]));
    });
    $('version-count-label').textContent = t('Total {n} versions', { n: VERSIONS.length });
  }

  function openDetail(release) {
    currentRelease = release;
    pickedLoader = null;
    $('detail-version-id').textContent = release.id;
    $('detail-version-type').textContent = releaseTypeLabel(release.type);
    $('detail-type-label').textContent = releaseTypeLabel(release.type);
    $('detail-release-time').textContent = release.date;

    var box = $('mod-loader-options');
    box.innerHTML = '';
    Object.keys(loaderMeta).forEach(function (key) {
      var meta = loaderMeta[key];
      var value = release.loaders[key];
      var card = document.createElement('div');
      card.className = 'detail-option-card';
      card.innerHTML =
        '<div class="detail-option-header">' +
          '<div class="detail-option-left">' +
            '<span class="detail-option-icon icon icon-' + meta.icon + '"></span>' +
            '<div class="detail-option-text"><span class="detail-option-name"></span><span class="detail-option-desc"></span></div>' +
          '</div>' +
          '<div class="detail-option-right">' +
            '<span class="detail-option-badge"></span>' +
            '<span class="detail-option-arrow icon icon-chevron"></span>' +
          '</div>' +
        '</div>' +
        '<div class="detail-option-content hidden"></div>';
      card.querySelector('.detail-option-name').textContent = meta.name;
      card.querySelector('.detail-option-desc').textContent = t(meta.desc);
      var badge = card.querySelector('.detail-option-badge');
      if (!value || !value.length) {
        badge.textContent = t('Not supported');
        card.style.opacity = '0.55';
      } else {
        badge.textContent = t('Available');
        badge.classList.add('available');
        card.querySelector('.detail-option-header').addEventListener('click', function () {
          toggleLoaderCard(key, card, value);
        });
      }
      box.appendChild(card);
    });
    updateDetailButton();

    $('version-list-section').classList.add('hidden');
    $('version-detail-page').classList.remove('hidden');
  }

  function toggleLoaderCard(key, card, value) {
    var content = card.querySelector('.detail-option-content');
    var arrow = card.querySelector('.detail-option-arrow');
    var opening = content.classList.contains('hidden');
    card.parentNode.querySelectorAll('.detail-option-content').forEach(function (c) { c.classList.add('hidden'); });
    card.parentNode.querySelectorAll('.detail-option-arrow').forEach(function (a) { a.classList.remove('expanded'); });
    if (!opening) return;
    content.classList.remove('hidden');
    arrow.classList.add('expanded');
    if (content.childElementCount) return;
    value.forEach(function (v) {
      var item = document.createElement('div');
      item.className = 'detail-option-version-item';
      item.innerHTML = '<span class="detail-option-version-name"></span><span class="detail-option-version-check icon icon-check"></span>';
      item.querySelector('.detail-option-version-name').textContent = loaderMeta[key].name + ' ' + v;
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        content.querySelectorAll('.detail-option-version-item').forEach(function (i) { i.classList.remove('selected'); });
        item.classList.add('selected');
        pickedLoader = key + ' ' + v;
        updateDetailButton();
      });
      content.appendChild(item);
    });
  }

  function updateDetailButton() {
    var btn = $('detail-download-btn');
    btn.textContent = pickedLoader
      ? t('Download') + ' ' + currentRelease.id + ' + ' + pickedLoader
      : t('Download') + ' ' + currentRelease.id;
  }

  $('detail-back-btn').addEventListener('click', function () {
    $('version-detail-page').classList.add('hidden');
    $('version-list-section').classList.remove('hidden');
  });

  /* ===== 底部下载条 ===== */
  var dockEl = $('download-dock');
  var dockPanel = $('download-dock-panel');
  var dockHideTimer = null;
  var dockTaskRow = null;
  var dockState = { title: '-', current: '', speed: '', percent: 0, status: 'running' };

  function renderDock() {
    $('download-dock-title').textContent = dockState.title;
    $('download-dock-current').textContent = dockState.current;
    $('download-dock-speed').textContent = dockState.speed;
    $('download-dock-percent').textContent = Math.round(dockState.percent) + '%';
    $('download-dock-fill').style.width = Math.max(0, Math.min(100, dockState.percent)) + '%';
    dockEl.classList.toggle('is-done', dockState.status === 'done');
    dockEl.classList.toggle('is-error', dockState.status === 'error');
  }

  function updateDockCount() {
    var list = $('download-task-list');
    var rows = list.querySelectorAll('.download-task');
    var settled = list.querySelectorAll('.download-task[data-status="done"], .download-task[data-status="error"]').length;
    $('download-dock-count').textContent = rows.length ? settled + ' / ' + rows.length : '';
    $('download-dock-panel-count').textContent = rows.length ? '(' + rows.length + ')' : '';
  }

  function showDock() {
    clearTimeout(dockHideTimer);
    body.classList.add('download-dock-open');
    dockEl.classList.remove('hidden');
    requestAnimationFrame(function () { dockEl.classList.add('show'); });
  }

  function hideDock() {
    clearTimeout(dockHideTimer);
    setDockExpanded(false);
    body.classList.remove('download-dock-open');
    dockEl.classList.remove('show');
    dockHideTimer = setTimeout(function () {
      if (!dockEl.classList.contains('show')) dockEl.classList.add('hidden');
    }, 320);
  }

  function scheduleDockHide(delay) {
    clearTimeout(dockHideTimer);
    if (dockEl.classList.contains('expanded')) return;
    dockHideTimer = setTimeout(hideDock, delay || 3000);
  }

  function setDockExpanded(open) {
    dockEl.classList.toggle('expanded', open);
    dockPanel.classList.toggle('hidden', !open);
    $('download-dock-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('download-dock-toggle-label').textContent = open ? t('Collapse') : t('Expand');
  }

  function toggleDock() {
    var open = !dockEl.classList.contains('expanded');
    setDockExpanded(open);
    if (open) clearTimeout(dockHideTimer);
    else scheduleDockHide();
  }
  $('download-dock-open').addEventListener('click', toggleDock);
  $('download-dock-toggle').addEventListener('click', toggleDock);
  document.addEventListener('click', function (e) {
    if (!dockEl.classList.contains('expanded')) return;
    if (e.target.closest('#download-dock')) return;
    setDockExpanded(false);
    scheduleDockHide();
  });

  /* ===== 下载流程 ===== */
  var downloadTimer = null;
  var downloadCancelled = false;
  var activeVersionTask = null;
  var TOTAL_MB = 386;
  var files = [
    'client.jar', 'libraries/com/mojang/logging/1.2.7/logging-1.2.7.jar',
    'assets/objects/1a/1a2b3c4d5e6f', 'libraries/net/fabricmc/loader/0.16.10/loader-0.16.10.jar',
    'assets/indexes/17.json', 'libraries/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar'
  ];

  function startDownload() {
    if (activeVersionTask) return;
    clearInterval(downloadTimer);
    downloadCancelled = false;
    var done = 0;
    var label = 'Minecraft ' + currentRelease.id + (pickedLoader ? ' + ' + pickedLoader : '');
    var versionTask = addTask(label, cancelVersionDownload);
    activeVersionTask = versionTask;
    dockState.title = label;
    dockState.current = t('Preparing…');
    dockState.speed = '';
    dockState.percent = 0;
    dockState.status = 'running';
    renderDock();
    versionTask.set('running', t('Preparing…'), 0);
    toast(t('Download started'), currentRelease.id + (pickedLoader ? ' + ' + pickedLoader : ''), 'info');

    downloadTimer = setInterval(function () {
      var speed = 30 + Math.random() * 62;
      done += speed * 0.35;
      if (done >= TOTAL_MB) done = TOTAL_MB;
      var pct = Math.min(100, done / TOTAL_MB * 100);
      dockState.percent = pct;

      if (done < TOTAL_MB) {
        versionTask.set('running', pct.toFixed(0) + '%', pct);
        dockState.current =
          files[Math.floor(Math.random() * files.length)] + '  ·  ' + Math.round(done) + ' / ' + TOTAL_MB + ' MB';
        dockState.speed = speed.toFixed(1) + ' MB/s';
        renderDock();
      } else {
        clearInterval(downloadTimer);
        downloadTimer = null;
        versionTask.set('done', t('Done'), 100);
        dockState.current = currentRelease.id + ' · ' + t('Installed — go to the Launch page');
        dockState.speed = '';
        dockState.status = 'done';
        renderDock();
        activeVersionTask = null;
        toast(t('Download complete'), 'Minecraft ' + currentRelease.id + ' ' + t('installed'), 'success');
        scheduleDockHide();
      }
    }, 260);
  }

  function cancelVersionDownload() {
    if (!activeVersionTask) return;
    stopDownload();
    var task = activeVersionTask;
    activeVersionTask = null;
    task.set('error', t('Cancelled'), 0);
    dockState.status = 'error';
    dockState.current = t('Cancelled');
    dockState.speed = '';
    renderDock();
    toast(t('Download cancelled'), t('Temporary files cleaned up'), 'info');
    scheduleDockHide(4000);
  }

  function stopDownload() {
    downloadCancelled = true;
    clearInterval(downloadTimer);
    downloadTimer = null;
  }

  $('detail-download-btn').addEventListener('click', function () { startDownload(); });

  /* ===== 下载页分区：游戏版本 / 模组 / 光影 / 资源包 / 整合包 ===== */
  var downloadTabs = document.querySelectorAll('.download-tab');
  var currentDownloadTab = 'versions';
  var currentProjectType = 'mods';
  var currentProject = null;

  var typeCopy = {
    mods: { placeholder: 'Search mods, or paste a CurseForge project link' },
    shaders: { placeholder: 'Search shaders' },
    resourcepacks: { placeholder: 'Search resource packs' },
    modpacks: { placeholder: 'Search modpacks' }
  };

  var PROJECTS = {
    mods: [
      { title: 'Fabric API', desc: 'Lightweight and modular API providing common hooks and interoperability for mods.', icon: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png', downloads: 286109303, tags: ['fabric', 'library'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'quilt'], version: '0.140.2+1.21.11' },
      { title: 'Sodium', desc: 'A high-performance rendering engine replacement for Minecraft.', icon: 'https://cdn.modrinth.com/data/AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp', downloads: 251328114, tags: ['fabric', 'neoforge', 'optimization'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'neoforge'], version: '0.7.6+1.21.11' },
      { title: 'Iris Shaders', desc: 'A modern shader pack loader for Minecraft, compatible with existing OptiFine shaderpacks.', icon: 'https://cdn.modrinth.com/data/YL57xq9U/18d0e7f076d3d6ed5bedd472b853909aac5da202_96.webp', downloads: 194790209, tags: ['fabric', 'neoforge', 'decoration'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'neoforge'], version: '1.9.4+1.21.11' },
      { title: 'Entity Culling', desc: 'Async path-tracing hides blocks and entities that are not visible.', icon: 'https://cdn.modrinth.com/data/NNAgCjsB/7873452d6cede4daed12da3d7d8c193ab88b4fd6_96.webp', downloads: 187905954, tags: ['fabric', 'forge', 'optimization'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'forge'], version: '1.9.3+1.21.11' },
      { title: 'Cloth Config API', desc: 'Configuration library for Minecraft mods.', icon: 'https://cdn.modrinth.com/data/9s6osm5g/ed8a2316cbb6f4fc5f510e8e13a59a85cbbbff4d_96.webp', downloads: 183927705, tags: ['fabric', 'forge', 'library'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'forge', 'neoforge'], version: '18.0.145+1.21.11' },
      { title: 'FerriteCore', desc: 'Memory usage optimizations for Minecraft.', icon: 'https://cdn.modrinth.com/data/uXXizFIs/222a126f26f8f9ae1eb339f3b767677f18bff31f_96.webp', downloads: 165338501, tags: ['fabric', 'forge', 'optimization'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'forge', 'neoforge'], version: '8.0.0+1.21.11' },
      { title: 'Mod Menu', desc: 'Adds a menu to view the list of mods you have installed.', icon: 'https://cdn.modrinth.com/data/mOgUt4GM/5a20ed1450a0e1e79a1fe04e61bb4e5878bf1d20.png', downloads: 159861313, tags: ['fabric', 'quilt', 'utility'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'quilt'], version: '15.0.0+1.21.11' },
      { title: 'Lithium', desc: 'No-compromises game logic optimization mod, for clients and servers.', icon: 'https://cdn.modrinth.com/data/gvQqBUqZ/bcc8686c13af0143adf4285d741256af824f70b7_96.webp', downloads: 141028859, tags: ['fabric', 'neoforge', 'optimization'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric', 'neoforge'], version: '0.18.1+1.21.11' }
    ],
    shaders: [
      { title: 'Complementary Shaders - Reimagined', desc: 'Preserving the elements of Minecraft with exceptional quality and performance.', icon: 'https://cdn.modrinth.com/data/HVnmMxH1/79cb7c8123bbc54945305b2ebad6b8881efdf5f8_96.webp', downloads: 72307455, tags: ['atmosphere', 'bloom'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: 'r5.5.1' },
      { title: 'Complementary Shaders - Unbound', desc: 'Transforming the visuals of Minecraft with exceptional quality and performance.', icon: 'https://cdn.modrinth.com/data/R6NEzAwj/c85ce4049aac76360d2cd24fd9a7003de01ef312_96.webp', downloads: 46911064, tags: ['atmosphere', 'bloom'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: 'r5.5.1' },
      { title: 'BSL Shaders', desc: 'Bright, colorful and customizable shaderpack for Minecraft: Java Edition.', icon: 'https://cdn.modrinth.com/data/Q1vvjJYV/2a611a3cb434fb52fb81fa5dace13c5d8b67e55d_96.webp', downloads: 31675781, tags: ['atmosphere', 'bloom'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '10.0' },
      { title: 'Photon Shaders', desc: 'A gameplay-focused shader pack with a semi-realistic style.', icon: 'https://cdn.modrinth.com/data/lLqFfGNs/39cb5f12e7dcc68d6cb666f225fcb2b801dd70fb_96.webp', downloads: 29257962, tags: ['atmosphere', 'colored-lighting'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.5b' },
      { title: 'Solas Shader', desc: 'A modern fantasy stylized shaderpack with colored lighting.', icon: 'https://cdn.modrinth.com/data/EpQFjzrQ/e3efc6ba7a63f9e1cf473a794d0224a6daf243c7_96.webp', downloads: 18616113, tags: ['atmosphere', 'fantasy'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '2.3' },
      { title: 'Bliss Shaders', desc: 'A well performing fantasy styled shaderpack with emphasis on color.', icon: 'https://cdn.modrinth.com/data/ZvMtQlho/90145c971ea24387775108fc86c89bed9bd2c8f1_96.webp', downloads: 15774159, tags: ['atmosphere', 'fantasy'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '2.1.1' },
      { title: 'MakeUp - Ultra Fast', desc: 'The best quality and performance ratio, with a focus on speed.', icon: 'https://cdn.modrinth.com/data/izsIPI7a/a08432baa86b8ffd58c08f4b3a001ef976ff764d_96.webp', downloads: 14099462, tags: ['atmosphere', 'fantasy'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '9.7' },
      { title: 'Rethinking Voxels', desc: 'A gameplay shaderpack based on Complementary Reimagined.', icon: 'https://cdn.modrinth.com/data/kmwfVOoi/fc89eadad417dd376b14c3b31e1a2b87acaca034_96.webp', downloads: 13778850, tags: ['atmosphere', 'colored-lighting'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: 'r0.1b' }
    ],
    resourcepacks: [
      { title: 'Fresh Animations', desc: 'Dynamic animated entities that make the game look like the trailers.', icon: 'https://cdn.modrinth.com/data/50dA9Sha/3132c10e9e3c73fde9799720fd3da5561071708c_96.webp', downloads: 51404735, tags: ['16x', 'entities'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.10.4' },
      { title: 'Translations for Sodium', desc: 'Unofficial translations for the Sodium mod.', icon: 'https://cdn.modrinth.com/data/yfDziwn1/907581019df45903df237952ce8d10ac37134cb5_96.webp', downloads: 23163512, tags: ['locale', 'tweaks'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.4.0' },
      { title: "Motschen's Better Leaves", desc: 'Improves the appearance of leaves with high mod compatibility.', icon: 'https://cdn.modrinth.com/data/uvpymuxq/fe1a61998ae57dc6ad1a4bb028334c3c3925d22f_96.webp', downloads: 21579362, tags: ['minecraft', 'models'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '2.8' },
      { title: 'Chat Reporting Helper', desc: 'An educational tool that explains chat reporting in a simple way.', icon: 'https://cdn.modrinth.com/data/tN4E9NfV/c2d93fd85469a512f67e53baa7648c1abe6645ef.png', downloads: 18025820, tags: ['16x', 'gui'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.0' },
      { title: 'Low On Fire', desc: 'Lower fire on your screen, vanilla friendly.', icon: 'https://cdn.modrinth.com/data/RRxvWKNC/06a7e7691a6da41798c255108a8563d7ffea171d.png', downloads: 17420241, tags: ['16x', 'combat'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.9' },
      { title: 'Fresh Moves', desc: 'Fancy animated player and equipment models.', icon: 'https://cdn.modrinth.com/data/slufHzC2/02b78db6655ad8dd6cfd847f99c76f7552c053ec_96.webp', downloads: 15581522, tags: ['16x', 'equipment'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '3.1' },
      { title: 'Fast Better Grass', desc: 'Makes grass and related blocks use the top texture on the sides.', icon: 'https://cdn.modrinth.com/data/dspVZXKP/5de0774f423d220fcd4e635b91f2bdfcb8a2b910.png', downloads: 14003714, tags: ['16x', 'decoration'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.6' },
      { title: 'Fullbright UB', desc: 'Fullbright for Sodium, OptiFine and vanilla.', icon: 'https://cdn.modrinth.com/data/ItHr72Fy/c28c5e4ae4e1e5ac726ff192855d16d2c15c83e2_96.webp', downloads: 12308380, tags: ['core-shaders', 'environment'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: [], version: '1.2' }
    ],
    modpacks: [
      { title: 'Fabulously Optimized', desc: 'Beautiful graphics, speedy performance and familiar features.', icon: 'https://cdn.modrinth.com/data/1KVo5zza/d8152911f8fd5d7e9a8c499fe89045af81fe816e_96.webp', downloads: 19137209, tags: ['fabric', 'lightweight'], mc: ['1.21.11', '1.21.4', '1.20.1'], loaders: ['fabric'], version: '6.6.0' },
      { title: 'Cobblemon Official Modpack', desc: 'The official modpack of Cobblemon, for Fabric.', icon: 'https://cdn.modrinth.com/data/5FFgwNNP/e7f9ee2e9d361623847853fe2ddce42f519ee64f.png', downloads: 11461739, tags: ['adventure', 'fabric'], mc: ['1.21.1', '1.20.1'], loaders: ['fabric'], version: '1.6.1' },
      { title: 'COBBLEVERSE - Pokemon Adventure', desc: 'A full Pokemon adventure built on Cobblemon.', icon: 'https://cdn.modrinth.com/data/Jkb29YJU/581ecf54530972afb18a04660afd820f2f24f6c7.png', downloads: 7255195, tags: ['adventure', 'fabric'], mc: ['1.21.1', '1.20.1'], loaders: ['fabric'], version: '1.7.3' },
      { title: 'Better MC - BMC2', desc: 'A proper vanilla+ modpack that expands the game without changing it.', icon: 'https://cdn.modrinth.com/data/shFhR8Vx/a19c2bcb51d38f32f138d3607e91cb2b7b8e387f_96.webp', downloads: 3705682, tags: ['adventure', 'fabric'], mc: ['1.20.1'], loaders: ['fabric'], version: '26' },
      { title: 'Sodium Plus', desc: 'A client-side optimization modpack with a few extra tweaks.', icon: 'https://cdn.modrinth.com/data/ch7UHY2J/cf0150ba8d6c01144974709a27b23bba93c0fc9e.png', downloads: 2896946, tags: ['fabric', 'lightweight'], mc: ['1.21.11', '1.21.4'], loaders: ['fabric'], version: '3.2.1' },
      { title: 'Vanilla Perfected', desc: 'A compilation of vanilla+ mods and packs to perfect Minecraft.', icon: 'https://cdn.modrinth.com/data/1ocGzRHv/ebec737126db7637001194ca5560ae58413d338f_96.webp', downloads: 2689848, tags: ['adventure', 'fabric'], mc: ['1.21.11', '1.21.4'], loaders: ['fabric'], version: '2.4.0' }
    ]
  };

  function fmtDownloads(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function renderProjectFilters() {
    var select = $('mod-game-version');
    if (!select.childElementCount) {
      select.innerHTML = '<option value="" data-i18n="All versions">All versions</option>';
      ['26.3', '26.2', '26.1.2', '1.21.11', '1.21.10', '1.21.4', '1.21.1', '1.20.1'].forEach(function (v) {
        var o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
      });
      window.DEMO_I18N.apply(select);
    }
    $('mod-loader').classList.toggle('hidden', currentProjectType !== 'mods');
  }

  function projectVisible(item, q, mc, loader, source) {
    if (q && (item.title + ' ' + item.desc).toLowerCase().indexOf(q) === -1) return false;
    if (mc && item.mc.indexOf(mc) === -1) return false;
    if (loader && item.loaders.indexOf(loader) === -1) return false;
    if (source !== 'both' && (item.source || 'Modrinth').toLowerCase() !== source) return false;
    return true;
  }

  function renderProjects() {
    var q = $('mod-search-input').value.trim().toLowerCase();
    var mc = $('mod-game-version').value;
    var loader = $('mod-loader').value;
    var source = $('mod-source').value;
    var list = PROJECTS[currentProjectType].filter(function (item) {
      return projectVisible(item, q, mc, loader, source);
    });

    $('mod-detail').classList.add('hidden');
    $('mod-results').classList.remove('hidden');
    var box = $('mod-results');
    box.innerHTML = '';
    $('mod-status').textContent = t('Found {n} results', { n: list.length });

    if (!list.length) {
      var empty = document.createElement('div');
      empty.className = 'mod-empty';
      empty.textContent = t('No results. Try another search.');
      box.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'mod-card';
      card.innerHTML =
        '<img class="mod-card-icon" alt="" loading="lazy" referrerpolicy="no-referrer">' +
        '<div class="mod-card-body">' +
          '<div class="mod-card-title"><span class="mod-title"></span><span class="mod-source-tag"></span></div>' +
          '<div class="mod-card-desc"></div>' +
          '<div class="mod-card-meta"></div>' +
        '</div>';
      card.querySelector('img').src = item.icon;
      card.querySelector('.mod-title').textContent = item.title;
      card.querySelector('.mod-source-tag').textContent = item.source || 'Modrinth';
      card.querySelector('.mod-card-desc').textContent = t(item.desc);
      card.querySelector('.mod-card-meta').textContent =
        t('{n} downloads', { n: fmtDownloads(item.downloads) }) + ' · ' + item.tags.join(' · ');
      card.addEventListener('click', function () { openProject(item); });
      box.appendChild(card);
    });
  }

  function openProject(item) {
    currentProject = item;
    $('mod-results').classList.add('hidden');
    $('mod-detail').classList.remove('hidden');
    $('mod-status').textContent = '';

    var head = $('mod-detail-head');
    head.innerHTML =
      '<img alt="" referrerpolicy="no-referrer">' +
      '<div class="mod-detail-info">' +
        '<div class="mod-detail-title"></div>' +
        '<div class="mod-detail-meta"></div>' +
        '<div class="mod-detail-desc"></div>' +
      '</div>';
    head.querySelector('img').src = item.icon;
    head.querySelector('.mod-detail-title').textContent = item.title;
    head.querySelector('.mod-detail-meta').textContent =
      (item.source || 'Modrinth') + ' · ' + t('{n} downloads', { n: fmtDownloads(item.downloads) }) + ' · ' + item.tags.join(' · ');
    head.querySelector('.mod-detail-desc').textContent = t(item.desc);

    var versions = $('mod-detail-versions');
    versions.innerHTML = '';
    item.mc.forEach(function (mc) {
      var row = document.createElement('div');
      row.className = 'mod-version-row';
      row.innerHTML =
        '<div class="mod-version-info"><div class="mod-version-name"></div><div class="mod-version-meta"></div></div>' +
        '<button class="mod-install-btn" type="button"></button>';
      row.querySelector('.mod-version-name').textContent = item.title + ' ' + item.version;
      row.querySelector('.mod-version-meta').textContent =
        'Minecraft ' + mc + (item.loaders.length ? ' · ' + loaderLabel(item.loaders[0]) : '');
      var btn = row.querySelector('.mod-install-btn');
      btn.textContent = t('Install');
      btn.addEventListener('click', function () { openTargetDialog(item, mc); });
      versions.appendChild(row);
    });
  }

  function loaderLabel(key) {
    var map = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', optifine: 'OptiFine' };
    return map[key] || key;
  }

  function showDownloadTab(tab) {
    currentDownloadTab = tab;
    downloadTabs.forEach(function (b) { b.classList.toggle('active', b.dataset.downloadTab === tab); });
    var isVersions = tab === 'versions';
    $('version-list-section').classList.toggle('hidden', !isVersions);
    $('version-detail-page').classList.add('hidden');
    $('mod-download-section').classList.toggle('hidden', isVersions);
    if (isVersions) {
      renderReleaseList();
      return;
    }
    currentProjectType = tab;
    currentProject = null;
    $('mod-search-input').value = '';
    $('mod-search-input').placeholder = t(typeCopy[tab].placeholder);
    $('mod-game-version').value = '';
    $('mod-loader').value = '';
    renderProjectFilters();
    renderProjects();
  }

  downloadTabs.forEach(function (tab) {
    tab.addEventListener('click', function () { showDownloadTab(tab.dataset.downloadTab); });
  });
  $('mod-search-btn').addEventListener('click', renderProjects);
  $('mod-search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') renderProjects();
  });
  ['mod-game-version', 'mod-loader', 'mod-source'].forEach(function (id) {
    $(id).addEventListener('change', renderProjects);
  });
  $('mod-detail-back').addEventListener('click', function () {
    $('mod-detail').classList.add('hidden');
    $('mod-results').classList.remove('hidden');
    $('mod-status').textContent = t('Found {n} results', { n: PROJECTS[currentProjectType].length });
  });

  $('local-install-btn').addEventListener('click', function () {
    toast(t('Not available in the demo'), '', 'info');
  });

  /* ===== 下载任务队列 ===== */
  var taskSeq = 0;
  function addTask(name, onCancel) {
    var list = $('download-task-list');
    var row = document.createElement('div');
    row.className = 'download-task';
    row.dataset.status = 'running';
    row.innerHTML =
      '<div class="download-task-head">' +
        '<span class="download-task-name"></span>' +
        '<span class="download-task-state"></span>' +
        '<button class="download-task-remove" type="button">&times;</button>' +
      '</div>' +
      '<div class="download-task-bar"><div class="download-task-fill"></div></div>';
    row.querySelector('.download-task-name').textContent = name;
    row.querySelector('.download-task-remove').addEventListener('click', function () {
      if (row.dataset.status === 'running' && onCancel) { onCancel(); return; }
      row.remove();
      updateDockCount();
      if (!list.childElementCount) scheduleDockHide(1000);
    });
    list.appendChild(row);
    dockTaskRow = row;
    dockState.title = name;
    dockState.current = t('Preparing…');
    dockState.speed = '';
    dockState.percent = 0;
    dockState.status = 'running';
    showDock();
    renderDock();
    updateDockCount();
    return {
      row: row,
      set: function (status, state, pct) {
        if (!row.isConnected) return;
        row.dataset.status = status;
        row.querySelector('.download-task-state').textContent = state;
        row.querySelector('.download-task-fill').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
        updateDockCount();
        if (row !== dockTaskRow) return;
        dockState.status = status === 'error' ? 'error' : status === 'done' ? 'done' : 'running';
        dockState.percent = status === 'done' ? 100 : (pct || 0);
        if (state) dockState.current = state;
        renderDock();
      }
    };
  }

  /* ===== 安装目标选择 ===== */
  var targetVersion = installed[0].id;
  var pendingInstall = null;

  function openTargetDialog(item, mc) {
    pendingInstall = { item: item, mc: mc };
    targetVersion = installed[0].id;
    var list = $('mod-target-list');
    list.innerHTML = '';
    installed.forEach(function (v) {
      var row = document.createElement('div');
      row.className = 'mod-target-item' + (v.id === targetVersion ? ' selected' : '');
      row.innerHTML = '<span class="mod-target-name"></span><span class="mod-target-meta"></span>';
      row.querySelector('.mod-target-name').textContent = v.id;
      row.querySelector('.mod-target-meta').textContent = 'Minecraft ' + v.id;
      row.addEventListener('click', function () {
        targetVersion = v.id;
        Array.prototype.forEach.call(list.children, function (c) { c.classList.remove('selected'); });
        row.classList.add('selected');
      });
      list.appendChild(row);
    });
    $('mod-target-overlay').classList.remove('hidden');
  }

  $('mod-target-cancel').addEventListener('click', function () {
    $('mod-target-overlay').classList.add('hidden');
  });
  $('mod-target-choose').addEventListener('click', function () {
    toast(t('Not available in the demo'), '', 'info');
  });
  $('mod-target-install').addEventListener('click', function () {
    $('mod-target-overlay').classList.add('hidden');
    if (!pendingInstall) return;
    var item = pendingInstall.item;
    var task = addTask(item.title + ' ' + item.version);
    var pct = 0;
    var timer = setInterval(function () {
      pct += 12 + Math.random() * 18;
      if (pct >= 100) {
        pct = 100;
        clearInterval(timer);
        task.set('done', t('Installed to {version}', { version: targetVersion }), 100);
        toast(t('Install complete'), item.title + ' · ' + targetVersion, 'success');
        scheduleDockHide();
      } else {
        task.set('running', pct.toFixed(0) + '%', pct);
      }
    }, 260);
    toast(t('Installing'), item.title + ' · ' + targetVersion, 'info');
  });

  /* ===== 设置页 ===== */
  var sidebarItems = document.querySelectorAll('.settings-sidebar-item');
  sidebarItems.forEach(function (item) {
    item.addEventListener('click', function () {
      sidebarItems.forEach(function (i) { i.classList.remove('active'); });
      item.classList.add('active');
      document.querySelectorAll('.settings-content-panel').forEach(function (p) {
        p.classList.toggle('active', p.dataset.panel === item.dataset.tab);
      });
    });
  });

  document.querySelectorAll('.custom-select').forEach(function (select) {
    var trigger = select.querySelector('.custom-select-trigger');
    var dropdown = select.querySelector('.custom-select-dropdown');
    var valueEl = select.querySelector('.custom-select-value');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains('open');
      closeAllSelects();
      if (willOpen) {
        dropdown.classList.add('open');
        trigger.classList.add('active');
      }
    });
    select.querySelectorAll('.custom-select-option').forEach(function (option) {
      option.addEventListener('click', function (e) {
        e.stopPropagation();
        select.querySelectorAll('.custom-select-option').forEach(function (o) { o.classList.remove('selected'); });
        option.classList.add('selected');
        valueEl.textContent = option.textContent;
        dropdown.classList.remove('open');
        trigger.classList.remove('active');
        applySetting(select.dataset.selectId, option.dataset.value, option.textContent);
      });
    });
  });

  function closeAllSelects() {
    document.querySelectorAll('.custom-select-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
    document.querySelectorAll('.custom-select-trigger.active').forEach(function (t) { t.classList.remove('active'); });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('.custom-select') || e.target.closest('.language-select')) return;
    closeAllSelects();
  });

  /* 设置页的主题分段按钮要跟当前主题对上（默认跟随系统时也一样） */
  var themeRadios = document.querySelectorAll('#demo-theme input');
  function syncThemeSegmented() {
    themeRadios.forEach(function (r) { r.checked = r.value === currentTheme; });
  }
  syncThemeSegmented();
  themeRadios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      followsSystemTheme = false;
      applyTheme(r.value);
    });
  });

  var styleRadios = document.querySelectorAll('#demo-style input');
  function applyStyle(style) {
    body.classList.toggle('style-mc', style === 'mc');
    body.classList.toggle('style-minimal', style === 'minimal');
  }
  styleRadios.forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      applyStyle(r.value);
      toast(t('Saved'), t('Interface style: {value}', { value: t(r.value === 'mc' ? 'Minecraft' : r.value === 'minimal' ? 'Minimal' : 'Advanced') }), 'success');
    });
  });

  var avatarSlider = $('demo-avatar-size');
  avatarSlider.addEventListener('input', function () {
    $('demo-avatar-size-value').textContent = avatarSlider.value + ' px';
  });

  document.querySelectorAll('.settings-action-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      toast(t('Not available in the demo'), '', 'info');
    });
  });

  var resetSwitch = $('demo-reset-settings');
  resetSwitch.addEventListener('change', function () {
    if (!resetSwitch.checked) return;
    applyTheme('light');
    syncThemeSegmented();
    applyStyle('advanced');
    document.querySelectorAll('#demo-style input').forEach(function (r) { r.checked = r.value === 'advanced'; });
    document.documentElement.style.setProperty('--app-zoom', '1');
    document.querySelectorAll('.custom-select[data-select-id="scale"]').forEach(function (s) {
      s.querySelector('.custom-select-value').textContent = t('100% (Default)');
    });
    resetSwitch.checked = false;
    toast(t('Settings reset'), t('Every setting is back to its default value.'), 'success');
  });

  var LANGUAGES = [
    { slug: 'en-us', name: 'English' }, { slug: 'zh-cn', name: '简体中文' }, { slug: 'zh-tw', name: '繁體中文' },
    { slug: 'ja', name: '日本語' }, { slug: 'ko', name: '한국어' }, { slug: 'de', name: 'Deutsch' },
    { slug: 'fr', name: 'Français' }, { slug: 'es', name: 'Español' }, { slug: 'pt', name: 'Português' },
    { slug: 'it', name: 'Italiano' }, { slug: 'nl', name: 'Nederlands' }, { slug: 'pl', name: 'Polski' },
    { slug: 'ru', name: 'Русский' }, { slug: 'uk', name: 'Українська' }, { slug: 'tr', name: 'Türkçe' },
    { slug: 'ar', name: 'العربية' }, { slug: 'fa', name: 'فارسی' }, { slug: 'he', name: 'עברית' },
    { slug: 'hi', name: 'हिन्दी' }, { slug: 'bn', name: 'বাংলা' }, { slug: 'id', name: 'Bahasa Indonesia' },
    { slug: 'ms', name: 'Bahasa Melayu' }, { slug: 'vi', name: 'Tiếng Việt' }, { slug: 'th', name: 'ไทย' },
    { slug: 'el', name: 'Ελληνικά' }
  ];
  var languageBox = $('demo-language-options');
  var currentSlug = window.DEMO_SLUG || 'en-us';
  function renderLanguages(filter) {
    filter = (filter || '').toLowerCase();
    languageBox.innerHTML = '';
    LANGUAGES.forEach(function (lang) {
      if (filter && lang.name.toLowerCase().indexOf(filter) === -1 && lang.slug.indexOf(filter) === -1) return;
      var row = document.createElement('div');
      row.className = 'language-option' + (lang.slug === currentSlug ? ' selected' : '');
      row.textContent = lang.name;
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        if (lang.slug === currentSlug) {
          closeAllSelects();
          return;
        }
        var q = new URLSearchParams(location.search);
        q.set('lang', lang.slug);
        location.search = q.toString();
      });
      languageBox.appendChild(row);
    });
  }
  renderLanguages();
  var currentLang = LANGUAGES.filter(function (l) { return l.slug === currentSlug; })[0];
  if (currentLang) $('demo-language-value').textContent = currentLang.name;
  $('demo-language-search').addEventListener('input', function () {
    renderLanguages(this.value.trim());
  });
  $('demo-language-search').addEventListener('click', function (e) { e.stopPropagation(); });

  $('about-check-update').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = t('Checking...');
    setTimeout(function () {
      btn.disabled = false;
      btn.textContent = t('Check for updates');
      toast(t('Up to date'), 'GoodPlanCraftLauncher 1.7.2', 'success');
    }, 900);
  });

  var memorySlider = $('demo-memory-slider');
  var memoryValue = $('demo-memory-value');
  var memoryAlloc = $('demo-memory-alloc');
  var memoryCustomRow = $('demo-memory-custom-row');
  document.querySelectorAll('#demo-memory-mode input').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      var auto = r.value === 'auto';
      memorySlider.disabled = auto;
      memoryCustomRow.classList.toggle('hidden', auto);
      memoryAlloc.textContent = auto ? t('4.0 GB (Auto)') : memorySlider.value + '.0 GB';
      toast(t('Saved'), auto ? t('Memory is managed automatically by GPCL') : t('Game memory set to {size} GB', { size: memorySlider.value }), 'success');
    });
  });
  memorySlider.addEventListener('input', function () {
    memoryValue.textContent = memorySlider.value + ' GB';
    memoryAlloc.textContent = memorySlider.value + '.0 GB';
  });

  function applySetting(id, value, label) {
    if (id === 'theme') {
      followsSystemTheme = false;
      applyTheme(value);
    } else if (id === 'scale') {
      document.documentElement.style.setProperty('--app-zoom', String(Number(value) / 100));
    } else if (id === 'tip') {
      toast(t('Saved'), t('Launch tips: {value}', { value: label }), 'success');
    } else if (id === 'java-mirror') {
      toast(t('Saved'), t('Java mirror: {value}', { value: label }), 'success');
    } else if (id === 'priority') {
      toast(t('Saved'), t('Process priority: {value}', { value: label }), 'success');
    } else if (id === 'file-source' || id === 'version-source') {
      toast(t('Saved'), t('Download source: {value}', { value: label }), 'success');
    } else if (id === 'gc') {
      toast(t('Saved'), t('Memory management: {value}', { value: label }), 'success');
    } else if (id === 'log-unit') {
      toast(t('Saved'), t('Log retention: {value}', { value: label }), 'success');
    }
  }

  var threadSlider = $('demo-threads');
  var threadValue = $('demo-threads-value');
  threadSlider.addEventListener('input', function () {
    threadValue.textContent = threadSlider.value;
  });

  var speedSlider = $('demo-speed');
  var speedValue = $('demo-speed-value');
  speedSlider.addEventListener('input', function () {
    speedValue.textContent = Number(speedSlider.value) > 0 ? speedSlider.value + ' MB/s' : t('Unlimited');
  });

  /* ===== 和官网那一侧说话：它让自动播一遍、它把主题广播过来 ===== */
  function tellParent(message) {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage(message, '*');
    } catch (err) {}
  }

  window.addEventListener('message', function (e) {
    var data = e.data || {};
    if (data.gpcl === 'autoplay' && !running) {
      showPage('launch');
      startLaunch();
    }
    if (data.gpcl === 'reset') {
      if (running) endSession(true);
      showPage('launch');
      launchOverlay.classList.add('hidden');
      launchOverlay.classList.remove('show', 'fade-out');
    }
  });

  tellParent({ gpcl: 'ready' });
})();
