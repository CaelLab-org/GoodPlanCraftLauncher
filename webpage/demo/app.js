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
    if (name === 'download') { renderReleaseList(); drawChart(); }
  }
  Object.keys(menus).forEach(function (k) {
    menus[k].addEventListener('click', function () { showPage(k); });
  });

  document.querySelector('.min-btn').addEventListener('click', function () {
    toast('最小化', '网页里的窗口最小化不了', 'info');
  });
  document.querySelector('.close-btn').addEventListener('click', function () {
    toast('关不掉', '这只是一个网页窗口', 'info');
  });

  /* ===== 启动页：版本选择（版本数据都在 versions.js 里） ===== */
  var DATA = window.GPCL_VERSIONS;
  var installed = DATA.installed;
  var selectedVersion = installed[0].id;

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
      el.querySelector('.version-item-time').textContent = v.time;
      el.addEventListener('click', function () {
        selectedVersion = v.id;
        renderLaunchVersions();
        updateSelectedDisplay();
      });
      box.appendChild(el);
    });
    $('version-count').textContent = installed.length + ' 个版本';
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
      historyBox.innerHTML = '<div class="username-history-empty">还没有记录</div>';
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
    'Minecraft 的方块贴图只有 16×16 像素，所以画风才能这么统一。',
    '在下界走 1 格等于主世界 8 格，长途赶路走传送门比坐船快得多。',
    '钻石镐挖一块黑曜石需要 9.4 秒，去下界之前记得带上。',
    '落地之前对着脚下倒一桶水，可以抵消所有坠落伤害。',
    '给生物用命名牌改过名之后，它就不会被刷掉了。',
    '附魔台周围摆书架能提高附魔等级，最多需要 15 个书架。',
    '床在下界和末地会爆炸，别想着在那边睡觉。',
    '苦力怕的来源是建模时把猪的模型做歪了，于是干脆留下了它。',
    '末影人的设计灵感来自网络怪谈里的“瘦长鬼影”。',
    'GPCL 是云云一个人开发的启动器，并没有什么所谓的开发团队。'
  ];

  var statusMessages = [
    '正在检查游戏文件...',
    '正在准备Java运行时...',
    '正在初始化游戏环境...',
    '正在启动游戏窗口...'
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
    statusText.textContent = '正在启动游戏...';
    $('launch-version-info').textContent = selectedVersion + ' · 离线模式 · ' + $('username').value;
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
      statusText.textContent = statusMessages[Math.min(3, Math.floor(progress / 24))];
      if (!tipShown && progress > 40) {
        tipShown = true;
        $('launch-tip-text').textContent = tips[Math.floor(Math.random() * tips.length)];
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
      statusText.textContent = 'Minecraft 已启动';

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
    $('game-monitor-state').textContent = '运行中';
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
    toast('游戏已启动', 'Minecraft ' + selectedVersion + ' · 离线模式', 'success');
  }

  function endSession(silent) {
    running = false;
    clearInterval(uptimeTimer);
    uptimeTimer = null;
    monitor.classList.remove('active');
    $('game-monitor-dot').classList.remove('running');
    $('game-monitor-state').textContent = '未运行';
    if (!silent) toast('游戏已结束', '本次运行 ' + $('mon-uptime').textContent, 'info');
  }

  $('launch-btn').addEventListener('click', startLaunch);
  $('launch-cancel-btn').addEventListener('click', function () {
    clearInterval(progressTimer);
    clearInterval(particleTimer);
    progressTimer = particleTimer = null;
    launchOverlay.classList.add('hidden');
    launchOverlay.classList.remove('show');
    toast('已取消启动', '进程还没起来，什么都没有留下', 'info');
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
    '[20:41:12] [Render thread/INFO]: OpenAL initialized on device 扬声器 (Realtek)',
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
      div.textContent = line;
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
  var loaderMeta = {
    forge: { name: 'Forge', desc: 'Forge 模组加载器', icon: 'gear' },
    fabric: { name: 'Fabric', desc: 'Fabric 模组加载器', icon: 'thread' },
    optifine: { name: 'OptiFine', desc: 'OptiFine 高清修复', icon: 'eye' }
  };
  var currentRelease = null;
  var pickedLoader = null;

  function releaseOf(row) {
    return { id: row[0], type: row[1], date: row[2], loaders: LOADERS[row[0]] || {} };
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
        '<span class="release-group-name">' + type + '</span>' +
        '<span class="release-group-count">' + byType[type].length + ' 个版本</span></div>';
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
    $('version-count-label').textContent = '共 ' + VERSIONS.length + ' 个版本';
  }

  function openDetail(release) {
    currentRelease = release;
    pickedLoader = null;
    $('detail-version-id').textContent = release.id;
    $('detail-version-type').textContent = release.type;
    $('detail-type-label').textContent = release.type;
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
      card.querySelector('.detail-option-desc').textContent = meta.desc;
      var badge = card.querySelector('.detail-option-badge');
      if (!value || !value.length) {
        badge.textContent = '暂不支持';
        card.style.opacity = '0.55';
      } else {
        badge.textContent = '可用';
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
    $('download-panel').classList.add('hidden');
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
    btn.textContent = pickedLoader ? '下载 ' + currentRelease.id + ' + ' + pickedLoader : '下载 ' + currentRelease.id;
  }

  $('detail-back-btn').addEventListener('click', function () {
    $('version-detail-page').classList.add('hidden');
    $('version-list-section').classList.remove('hidden');
  });

  $('cancel-download-btn').addEventListener('click', function () {
    if (this.classList.contains('complete')) return;
    stopDownload();
    $('download-panel').classList.add('hidden');
    toast('已取消下载', '临时文件已清理', 'info');
  });

  /* ===== 速度曲线 ===== */
  var chart = $('speedChart');
  var ctx = chart.getContext('2d');
  var speeds = [];
  var peakSpeed = 0;

  function drawChart() {
    var dpr = window.devicePixelRatio || 1;
    var w = chart.clientWidth || 300;
    var h = 150;
    if (chart.width !== Math.round(w * dpr)) {
      chart.width = Math.round(w * dpr);
      chart.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var style = getComputedStyle(body);
    var line = style.getPropertyValue('--accent-primary').trim() || '#4fc3f7';
    var dim = style.getPropertyValue('--text-dim').trim() || '#5b6d88';

    ctx.strokeStyle = dim;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    for (var g = 1; g < 4; g++) {
      var y = (h - 8) * g / 4 + 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (speeds.length < 2) {
      ctx.fillStyle = dim;
      ctx.globalAlpha = 0.5;
      ctx.font = '12px -apple-system, "Segoe UI", sans-serif';
      ctx.fillText('等待开始下载…', 10, h / 2);
      ctx.globalAlpha = 1;
      return;
    }

    var max = Math.max.apply(null, speeds) * 1.15 || 1;
    var step = w / Math.max(1, speeds.length - 1);
    var points = speeds.map(function (s, i) {
      return [i * step, h - 6 - (h - 14) * (s / max)];
    });

    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, line + '55');
    grad.addColorStop(1, line + '00');
    ctx.beginPath();
    ctx.moveTo(points[0][0], h);
    points.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  window.addEventListener('resize', drawChart);

  /* ===== 下载流程 ===== */
  var downloadTimer = null;
  var downloadCancelled = false;
  var TOTAL_MB = 386;
  var files = [
    'client.jar', 'libraries/com/mojang/logging/1.2.7/logging-1.2.7.jar',
    'assets/objects/1a/1a2b3c4d5e6f', 'libraries/net/fabricmc/loader/0.16.10/loader-0.16.10.jar',
    'assets/indexes/17.json', 'libraries/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar'
  ];

  function startDownload() {
    clearInterval(downloadTimer);
    downloadCancelled = false;
    speeds = [];
    peakSpeed = 0;
    var done = 0;
    var btn = $('cancel-download-btn');
    btn.classList.remove('complete');
    btn.textContent = '取消下载';
    btn.disabled = false;
    $('download-panel').classList.remove('hidden');
    $('current-speed').textContent = '0.00 Mbps';
    $('peak-speed').textContent = '0.00 Mbps';
    $('progress-fill').style.width = '0%';
    $('progress-text').textContent = '0%';
    $('download-filename').textContent = '正在准备…';
    drawChart();
    toast('开始下载', currentRelease.id + (pickedLoader ? ' + ' + pickedLoader : ''), 'info');

    downloadTimer = setInterval(function () {
      if (downloadCancelled) return;
      var mbps = 30 + Math.random() * 62;
      speeds.push(mbps);
      if (speeds.length > 60) speeds.shift();
      peakSpeed = Math.max(peakSpeed, mbps);
      done += mbps * 0.125 * 0.35;
      if (done >= TOTAL_MB) done = TOTAL_MB;

      $('current-speed').textContent = mbps.toFixed(2) + ' Mbps';
      $('peak-speed').textContent = peakSpeed.toFixed(2) + ' Mbps';
      var pct = Math.min(100, done / TOTAL_MB * 100);
      $('progress-fill').style.width = pct.toFixed(1) + '%';
      $('progress-text').textContent = pct.toFixed(1) + '%';
      if (done < TOTAL_MB) {
        $('download-filename').textContent =
          files[Math.floor(Math.random() * files.length)] + '  ·  ' + Math.round(done) + ' / ' + TOTAL_MB + ' MB';
      }
      drawChart();

      if (done >= TOTAL_MB) {
        clearInterval(downloadTimer);
        downloadTimer = null;
        btn.textContent = '下载完成';
        btn.classList.add('complete');
        $('download-filename').textContent = currentRelease.id + ' · 安装完成，可以去「启动」页了';
        $('current-speed').textContent = '0.00 Mbps';
        toast('下载完成', 'Minecraft ' + currentRelease.id + ' 已安装', 'success');
      }
    }, 260);
  }

  function stopDownload() {
    downloadCancelled = true;
    clearInterval(downloadTimer);
    downloadTimer = null;
  }

  $('detail-download-btn').addEventListener('click', function () { startDownload(); });

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
  document.addEventListener('click', closeAllSelects);

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
      drawChart();
    });
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
      memoryAlloc.textContent = auto ? '4.0 GB（自动）' : memorySlider.value + '.0 GB';
      toast('已保存', auto ? '内存交给 GPCL 自动控制' : '游戏内存设为 ' + memorySlider.value + ' GB', 'success');
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
      drawChart();
    } else if (id === 'scale') {
      document.documentElement.style.setProperty('--app-zoom', String(Number(value) / 100));
      setTimeout(drawChart, 60);
    } else if (id === 'tip') {
      toast('已保存', '启动小知识：' + label, 'success');
    } else if (id === 'java-mirror') {
      toast('已保存', 'Java 镜像源：' + label, 'success');
    } else if (id === 'priority') {
      toast('已保存', '进程优先级：' + label, 'success');
    } else if (id === 'file-source' || id === 'version-source') {
      toast('已保存', '下载源：' + label, 'success');
    } else if (id === 'gc') {
      toast('已保存', '内存管理：' + label, 'success');
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
    speedValue.textContent = Number(speedSlider.value) > 0 ? speedSlider.value + ' MB/s' : '不限速';
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

  if (!fitMode) drawChart();

  tellParent({ gpcl: 'ready' });
})();
