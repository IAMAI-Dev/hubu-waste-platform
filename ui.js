(function () {
  'use strict';
  var paths = {
    leaf: 'M20 4C9 2 3 7 5 14c2 6 12 7 15-10Z M5 20 15 10 M9 16v-5 M9 16h5',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    back: 'M19 12H5 M11 6l-6 6 6 6',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z M9 3v16 M15 5v16',
    pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    truck:
      'M3 6h11v11H3V6Z M14 10h4l3 4v3h-7 M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    chart: 'M4 3v17h17 M8 15v-4 M13 15V7 M18 15v-6',
    message: 'M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4Z M7 8h10 M7 12h7',
    sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5',
    moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z',
    play: 'm8 4 12 8-12 8V4Z',
    pause: 'M8 4v16 M16 4v16',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12 M18 6 6 18',
    alert: 'm12 3 10 17H2L12 3Z M12 9v5 M12 17v.1',
    search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
    layers: 'm12 3 10 5-10 5L2 8l10-5Z M2 12l10 5 10-5 M2 16l10 5 10-5',
    target:
      'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M19 7a9 9 0 0 0-14 0 M19 17a9 9 0 0 1-14 0',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    chevron: 'm7 10 5 5 5-5',
    chevronUp: 'm7 14 5-5 5 5',
    history: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
    star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9L12 3Z',
    list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.1 M3 12h.1 M3 18h.1',
    book: 'M12 5C7 2 3 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-1-1-5-2-10 1Z M12 5v15',
    bin: 'M4 6h16 M9 3h6 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
    route: 'M6 6h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8 M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M10 22h5',
    external: 'M14 3h7v7 M21 3l-9 9 M10 5H4v15h15v-6',
    info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7v.1',
    send: 'm22 2-7 20-4-9-9-4 20-7Z M11 13 22 2',
  };
  function icon(name, cls) {
    return (
      '<svg class="icon ' +
      (cls || '') +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      (paths[name] || paths.info) +
      '"/></svg>'
    );
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(message, error) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = icon(error ? 'alert' : 'check') + '<span>' + esc(message) + '</span>';
    el.classList.add('visible');
    el.classList.toggle('error', !!error);
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      el.classList.remove('visible');
    }, 4200);
  }
  function init(page) {
    var H = window.HUBU;
    H.applyTheme(H.readTheme());
    var links = [
      ['index.html', 'home', '校园概览', 'leaf'],
      ['monitor.html', 'monitor', '投放与暂存', 'bin'],
      ['detail.html', 'dashboard', '清运看板', 'map'],
      ['feedback.html', 'feedback', '反馈中心', 'message'],
    ];
    document.getElementById('site-header').innerHTML =
      '<a class="brand" href="index.html" aria-label="琴园智清首页"><span class="brand-mark">' +
      icon('leaf') +
      '</span><span><b>琴园智清</b><small>湖北大学 · 全过程管理</small></span></a><nav class="main-nav" aria-label="主导航">' +
      links
        .map(function (l) {
          return (
            '<a href="' +
            l[0] +
            '" ' +
            (l[1] === page ? 'aria-current="page"' : '') +
            '>' +
            icon(l[3]) +
            '<span>' +
            l[2] +
            '</span></a>'
          );
        })
        .join('') +
      '</nav><div class="header-tools"><span class="demo-badge"><i></i>模拟演示</span><button class="icon-btn theme-switch" aria-label="切换深浅色主题" title="切换深浅色主题"></button></div>';
    function themeLabel() {
      var dark = document.documentElement.dataset.theme === 'dark';
      document.querySelector('.theme-switch').innerHTML = icon(dark ? 'sun' : 'moon');
      document
        .querySelector('.theme-switch')
        .setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
    }
    const info = document.createElement('button');
    info.className = 'icon-btn';
    info.setAttribute('aria-label', '原型与数据口径说明');
    info.innerHTML = icon('info');
    document.querySelector('.header-tools').prepend(info);
    const dialog = document.createElement('dialog');
    dialog.className = 'prototype-dialog';
    dialog.innerHTML =
      '<h2>原型与数据口径</h2><p>本平台为纯前端模拟演示，尚未接入摄像头、称重设备或实际后勤系统。本机反馈仅保存在当前浏览器。</p><p>投放批次表示投放事件数，不表示人数或垃圾件数。容量以升计，收运重量以千克计；两者分别记账。</p><p>重量由确定性模拟批次生成，使用分类密度参数（0.12 / 0.45 / 0.20 / 0.16 kg/L），不是摄像头称重。开场存量纳入对账；到站按先入先出收运 95% 库存。</p><p>60% / 85% / 100% 容量阈值、15 分钟满载和 120 分钟厨余暂存规则均为原型配置，不代表学校现行标准。地图点位和设施配置用于方案演示，治理建议需现场核查。</p><form method="dialog"><button class="button primary">知道了</button></form>';
    document.body.append(dialog);
    info.onclick = () => dialog.showModal();
    themeLabel();
    document.querySelector('.theme-switch').addEventListener('click', function () {
      H.toggleTheme();
      themeLabel();
      window.dispatchEvent(new CustomEvent('qy-theme-change'));
    });
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.dataset.icon);
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (a && !a.getAttribute('href').startsWith('#')) H.saveTime();
    });
    addEventListener('pagehide', function () {
      if (H.isTour()) H.endTour();
      H.saveTime();
    });
    return H.getSnapshot();
  }
  function clock(onFrame, onTick, advance) {
    var previous = 0,
      lastPaint = -1,
      stop = false,
      wasPlaying = false;
    var H = window.HUBU;
    function frame(ts) {
      if (stop) return;
      var dt = previous ? Math.min((ts - previous) / 1000, 0.12) : 0;
      previous = ts;
      if (!document.hidden) {
        var s = H.getSnapshot();
        if (advance !== false && s.playback.playing && !s.isolated)
          H.stepTo(s.time + dt * H.MIN_PER_SEC * s.playback.speed);
        if (onFrame) onFrame(dt, ts);
        if (ts - lastPaint >= 300) {
          lastPaint = ts;
          if (onTick) onTick(H.getSnapshot());
        }
      }
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', function () {
      previous = 0;
      if (document.hidden) H.saveTime();
    });
    requestAnimationFrame(frame);
    return function () {
      stop = true;
    };
  }
  function number(el, value, suffix) {
    if (!el) return;
    var target = Number(value),
      previous = Number(el.dataset.value);
    if (el.dataset.value === String(value)) return;
    var first = el.dataset.value == null;
    el.dataset.value = String(value);
    suffix = suffix || '';
    if (el._numberFrame) cancelAnimationFrame(el._numberFrame);
    if (first || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target.toLocaleString('zh-CN') + suffix;
      el._shown = target;
      return;
    }
    var from = Number.isFinite(el._shown) ? el._shown : previous,
      start = performance.now();
    function animate(ts) {
      var p = Math.min(1, (ts - start) / 360),
        n = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      el._shown = n;
      el.textContent = n.toLocaleString('zh-CN') + suffix;
      if (p < 1) el._numberFrame = requestAnimationFrame(animate);
    }
    el._numberFrame = requestAnimationFrame(animate);
  }
  function status(o) {
    var s = HUBU.FB_STATUS[o.status] || HUBU.FB_STATUS.pending;
    return '<span class="pill ' + s.pill + '">' + s.text + '</span>';
  }
  function timeline(items) {
    return (
      '<ol class="timeline">' +
      items
        .map(function (e, i) {
          return (
            '<li><span class="timeline-node">' +
            icon(i === items.length - 1 ? 'check' : 'clock') +
            '</span><div><time>' +
            esc(e.time) +
            '</time><b>' +
            esc(e.title) +
            '</b><p>' +
            esc(e.detail || '') +
            '</p></div></li>'
          );
        })
        .join('') +
      '</ol>'
    );
  }
  function announce(text) {
    var el = document.getElementById('announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'announcer';
      el.className = 'sr-only';
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = text;
  }
  window.HUBU_UI = {
    icon: icon,
    esc: esc,
    toast: toast,
    init: init,
    clock: clock,
    number: number,
    status: status,
    timeline: timeline,
    announce: announce,
    reduced: function () {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
  };
})();
