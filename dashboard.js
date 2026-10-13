(function () {
  'use strict';
  var H = HUBU,
    U = HUBU_UI,
    $ = function (id) {
      return document.getElementById(id);
    },
    kind = 'points',
    lastList = '',
    lastDetail = '',
    lastChart = '',
    selection = null;
  U.init('dashboard');
  var map = HUBU_MAP.create($('dashboard-map'), {
    onSelect: function (kind, id) {
      select({ kind: kind, id: id });
    },
    onDrag: function () {
      H.setPlayback({ follow: null });
    },
  });
  var trend = echarts.init($('trend-chart')),
    rank = echarts.init($('rank-chart'));
  function view(v) {
    document.querySelector('.workspace').dataset.view = v;
    document.querySelectorAll('[data-view]').forEach(function (b) {
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.view === v));
    });
    $('records-panel').hidden = v !== 'records';
    if (v === 'points' || v === 'trucks') setKind(v);
    if (v === 'charts') {
      requestAnimationFrame(function () {
        trend.resize();
        rank.resize();
      });
    }
  }
  function select(s, move) {
    selection = s;
    H.setPlayback({ selected: s });
    map.select(s, move !== false);
    document.querySelector('.workspace').classList.toggle('has-selection', !!s);
    $('insight-summary').hidden = !!s;
    $('object-detail').hidden = !s;
    lastDetail = '';
    if (s) view('map');
    render(H.getSnapshot());
    H.saveTime();
  }
  function setKind(k) {
    kind = k;
    document.querySelectorAll('[data-kind]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.kind === k));
    });
    $('object-status').innerHTML =
      k === 'points'
        ? '<option value="all">全部状态</option><option value="full">已满溢</option><option value="near">接近满</option><option value="ok">正常</option>'
        : '<option value="all">全部状态</option><option value="working">到站作业</option><option value="moving">行驶中</option>';
    lastList = '';
    render(H.getSnapshot());
  }
  function list(s) {
    var q = $('object-search').value.toLowerCase(),
      f = $('object-status').value;
    var arr = s[kind].filter(function (o) {
      return (
        (o.name + ' ' + (o.plate || '')).toLowerCase().includes(q) &&
        (f === 'all' ||
          (kind === 'points' ? o.status.key === f : (o.working ? 'working' : 'moving') === f))
      );
    });
    var html =
      arr
        .map(function (o) {
          var p = kind === 'points',
            color = p ? o.status.color : o.color;
          return (
            '<button class="object-row ' +
            (selection && selection.id === o.id ? 'selected' : '') +
            '" data-object="' +
            o.id +
            '" data-object-kind="' +
            (p ? 'point' : 'truck') +
            '"><span class="object-row-head"><span class="object-dot" style="--point:' +
            color +
            '"></span><b>' +
            U.esc(o.name) +
            '</b></span><span class="object-row-meta"><span>' +
            (p ? o.status.text : o.working ? '到站作业' : '行驶中') +
            '</span><span class="num">' +
            (p ? Math.round(o.fill) + '%' : o.kg + ' kg') +
            '</span></span>' +
            (p
              ? '<span class="fill-track" style="--point:' +
                color +
                '"><i style="width:' +
                Math.min(100, o.fill) +
                '%"></i></span>'
              : '<span class="object-row-meta">' + U.esc(o.plate) + '</span>') +
            '</button>'
          );
        })
        .join('') || '<p class="empty-state">没有符合条件的对象</p>';
    if (html !== lastList) {
      $('object-list').innerHTML = html;
      lastList = html;
    }
  }
  function detail(s) {
    if (!selection) return;
    var p = selection.kind === 'point',
      o = s[p ? 'points' : 'trucks'].find(function (x) {
        return x.id === selection.id;
      });
    if (!o) return;
    var html =
      '<div class="detail-header"><div><span class="eyebrow">' +
      (p ? '校园投放点' : '清运车辆') +
      '</span><h2>' +
      U.esc(o.name) +
      '</h2></div><button class="icon-btn" data-close-detail aria-label="收起详情">' +
      U.icon('close') +
      '</button></div><div class="detail-body"><div class="detail-hero"><span>' +
      (p ? '当前饱和度' : '累计收运量') +
      '</span><p><b class="big">' +
      (p ? Math.round(o.fill) : o.kg) +
      '</b> ' +
      (p ? '%' : 'kg') +
      '</p><span class="pill ' +
      (p ? o.status.pill : 'ok') +
      '">' +
      (p ? o.status.text : o.working ? '到站作业' : '行驶中') +
      '</span></div><div class="detail-metrics"><div><span>收运次数</span><b>' +
      (p ? o.times : o.trips) +
      ' 次</b></div><div><span>' +
      (p ? '累计重量' : '车辆编号') +
      '</span><b>' +
      (p ? o.kg + ' kg' : o.code + ' 号车') +
      '</b></div></div>';
    if (p) {
      html +=
        '<p class="detail-note">最近收运：' +
        (o.last == null ? '尚未收运' : H.fmt(o.last)) +
        '</p><p class="detail-note">分类准确率 ' +
        o.accuracy +
        '% · 模拟值</p><a class="button primary" href="feedback.html?point=' +
        o.id +
        '">' +
        U.icon('message') +
        '反馈点位问题</a><h3 class="detail-subtitle">关联工单</h3>';
      var orders = H.ordersOf(o.id);
      html +=
        orders
          .map(function (r) {
            return (
              '<details class="order-card"><summary>' +
              U.esc((H.ORDERS_TEXT[r.type] || {}).label || r.type) +
              U.status(r) +
              '</summary>' +
              U.timeline(H.getOrderTimeline(r.id)) +
              '<a class="text-link" href="feedback.html?point=' +
              o.id +
              '&order=' +
              encodeURIComponent(r.id) +
              '">查看进展 ' +
              U.icon('arrow') +
              '</a></details>'
            );
          })
          .join('') || '<p class="empty-state">当前没有关联工单</p>';
    } else {
      html +=
        '<p class="detail-note">车牌 ' +
        U.esc(o.plate) +
        '</p><h3 class="detail-subtitle">下一停靠点</h3><p>' +
        U.esc(o.next.name) +
        ' · 约 ' +
        H.fmt(o.next.at) +
        '</p><p class="detail-note">沿校园预设路线循环收运</p><button class="button primary" data-follow="' +
        o.id +
        '">' +
        U.icon('target') +
        (s.playback.follow === o.id ? '停止跟随' : '跟随这辆车') +
        '</button>';
    }
    html += '</div>';
    if (html !== lastDetail) {
      var open = Array.from($('object-detail').querySelectorAll('details')).map(function (d) {
        return d.open;
      });
      $('object-detail').innerHTML = html;
      $('object-detail')
        .querySelectorAll('details')
        .forEach(function (d, i) {
          d.open = !!open[i];
        });
      lastDetail = html;
    }
  }
  function charts(s) {
    var key = JSON.stringify([
      s.hourly,
      s.points.map(function (p) {
        return p.kg;
      }),
      document.documentElement.dataset.theme,
    ]);
    if (key === lastChart) return;
    lastChart = key;
    var css = getComputedStyle(document.documentElement),
      ink = css.getPropertyValue('--muted').trim(),
      line = css.getPropertyValue('--line').trim(),
      accent = css.getPropertyValue('--accent').trim(),
      surface = css.getPropertyValue('--surface').trim();
    var sum = 0,
      values = s.hourly.map(function (v, i) {
        sum += v;
        return i <= Math.floor((s.time - 360) / 60) ? sum : null;
      });
    var shared = {
      animation: !U.reduced(),
      animationDurationUpdate: 300,
      textStyle: { fontFamily: 'Segoe UI, Microsoft YaHei', color: ink },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: line,
        textStyle: { color: ink },
        valueFormatter: function (v) {
          return v + ' kg';
        },
      },
      grid: { left: 42, right: 12, top: 15, bottom: 26 },
    };
    trend.setOption(
      Object.assign({}, shared, {
        xAxis: {
          type: 'category',
          data: s.hourly.map(function (_, i) {
            return String(i + 6).padStart(2, '0') + ':00';
          }),
          axisLine: { lineStyle: { color: line } },
          axisLabel: { color: ink, fontSize: 12 },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: line } },
          axisLabel: { color: ink, fontSize: 12 },
        },
        series: [
          {
            type: 'line',
            smooth: true,
            data: values,
            showSymbol: false,
            lineStyle: { color: accent, width: 2 },
            areaStyle: { color: accent, opacity: 0.09 },
          },
        ],
      }),
    );
    var points = s.points.slice().sort(function (a, b) {
      return a.kg - b.kg;
    });
    rank.setOption(
      Object.assign({}, shared, {
        grid: { left: 86, right: 20, top: 8, bottom: 18 },
        xAxis: {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { color: ink, fontSize: 12 },
        },
        yAxis: {
          type: 'category',
          data: points.map(function (p) {
            return p.name;
          }),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: ink, fontSize: 12 },
        },
        series: [
          {
            type: 'bar',
            data: points.map(function (p) {
              return { value: p.kg, pid: p.id };
            }),
            barWidth: 9,
            itemStyle: { color: accent, borderRadius: [0, 4, 4, 0] },
          },
        ],
      }),
    );
  }
  rank.on('click', function (e) {
    if (e.data.pid) select({ kind: 'point', id: e.data.pid });
  });
  function render(s) {
    U.number($('metric-kg'), s.totalKg);
    U.number($('metric-trips'), s.totalTrips);
    U.number($('metric-alerts'), s.alerts);
    U.number($('metric-orders'), s.openOrders);
    $('play-time').textContent = H.fmt(s.time);
    $('time-slider').value = s.time;
    $('time-slider').setAttribute('aria-valuetext', H.fmt(s.time));
    $('play-button').innerHTML = U.icon(s.playback.playing ? 'pause' : 'play');
    $('play-button').setAttribute(
      'aria-label',
      s.time >= 1200 ? '重新播放' : s.playback.playing ? '暂停播放' : '开始播放',
    );
    document.querySelectorAll('[data-speed]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.speed === s.playback.speed));
    });
    $('follow-button').lastElementChild.textContent = s.playback.follow ? '停止跟随' : '跟随车辆';
    list(s);
    detail(s);
    charts(s);
    U.number($('co2-value'), s.co2Kg);
    $('recent-events').innerHTML =
      s.events
        .slice(0, 3)
        .map(function (e) {
          return (
            '<button class="event-row" data-object="' +
            e.pid +
            '" data-object-kind="point"><time>' +
            e.t +
            '</time><span>' +
            U.esc(e.station) +
            '</span><b>' +
            e.kg +
            ' kg</b></button>'
          );
        })
        .join('') || '<p class="empty-state">当前时刻尚无收运记录</p>';
    $('record-rows').innerHTML = s.events
      .slice()
      .map(function (e) {
        return (
          '<tr><td>' +
          e.t +
          '</td><td>' +
          U.esc(e.station) +
          '</td><td>' +
          U.esc(e.truck) +
          '</td><td>' +
          e.kg +
          ' kg</td><td><button class="text-button" data-object="' +
          e.pid +
          '" data-object-kind="point">定位</button></td></tr>'
        );
      })
      .join('');
    map.follow(s.playback.follow);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.view) view(b.dataset.view);
    if (b.dataset.kind) setKind(b.dataset.kind);
    if (b.dataset.object) select({ kind: b.dataset.objectKind, id: b.dataset.object });
    if (b.hasAttribute('data-close-detail')) select(null, false);
    if (b.dataset.follow) {
      H.setPlayback({
        follow: H.getSnapshot().playback.follow === b.dataset.follow ? null : b.dataset.follow,
      });
      render(H.getSnapshot());
    }
    if (b.dataset.speed) {
      H.setPlayback({ speed: +b.dataset.speed });
      H.saveTime();
      render(H.getSnapshot());
    }
  });
  $('object-search').oninput = $('object-status').onchange = function () {
    render(H.getSnapshot());
  };
  $('play-button').onclick = function () {
    var s = H.getSnapshot();
    if (s.time >= 1200) H.stepTo(360);
    H.setPlayback({ playing: !s.playback.playing });
    H.saveTime();
    render(H.getSnapshot());
  };
  $('time-slider').oninput = function () {
    H.setPlayback({ playing: false });
    H.stepTo(+this.value);
    render(H.getSnapshot());
  };
  $('time-slider').onchange = function () {
    H.saveTime();
  };
  $('timeline-toggle').onclick = function () {
    var open = document.querySelector('.playback').classList.toggle('expanded');
    this.setAttribute('aria-expanded', String(open));
    this.setAttribute('aria-label', open ? '收起时间轴' : '展开时间轴');
  };
  $('all-records').onclick = function () {
    view('records');
  };
  $('close-records').onclick = function () {
    view('map');
  };
  $('follow-button').onclick = function () {
    var s = H.getSnapshot(),
      id = s.playback.follow ? null : selection && selection.kind === 'truck' ? selection.id : 'T2';
    if (id) select({ kind: 'truck', id: id });
    H.setPlayback({ follow: id });
    render(H.getSnapshot());
  };
  new ResizeObserver(function () {
    trend.resize();
    rank.resize();
  }).observe($('insight-summary'));
  addEventListener('qy-theme-change', function () {
    render(H.getSnapshot());
  });
  var tour = HUBU_TOUR.create({
    select: select,
    render: function () {
      render(H.getSnapshot());
    },
    map: map,
  });
  $('start-tour').onclick = tour.start;
  var params = new URLSearchParams(location.search),
    initial = H.getSnapshot().playback.selected;
  if (params.has('point')) initial = { kind: 'point', id: params.get('point') };
  if (params.has('truck')) initial = { kind: 'truck', id: params.get('truck') };
  select(initial, false);
  render(H.getSnapshot());
  U.clock(function (dt, ts) {
    tour.frame(dt);
    map.paint(ts);
  }, render);
  if (params.has('tour')) tour.start();
})();
