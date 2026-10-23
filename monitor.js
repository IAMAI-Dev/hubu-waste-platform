(() => {
  'use strict';
  const H = HUBU,
    U = HUBU_UI,
    $ = (id) => document.getElementById(id),
    colors = ['#4589aa', '#458868', '#bd6963', '#8d978d'];
  U.init('monitor');
  let tab = '投放监测',
    key = '',
    story = null,
    previousPoint = null;
  const saved = H.getSnapshot().playback.selected;
  $('point').innerHTML = H.POINTS.map((p) => `<option value="${p.id}">${p.name}</option>`).join(
    '',
  );
  const requested =
    new URLSearchParams(location.search).get('point') ||
    (saved?.kind === 'point' ? saved.id : 'P4');
  $('point').value = H.byId(requested) ? requested : 'P4';
  const scene = HUBU_SCENE.create($('monitor-campus'), {
    source: () => H.getSnapshot(),
    onSelect: (kind, id) => {
      if (kind === 'point' && !story) select(id);
    },
  });
  scene.setCamera({ zoom: 1.35 }, true);
  const state = (b) =>
    b.fill >= 100 ? '满载' : b.fill >= 85 ? '满溢风险' : b.fill >= 60 ? '临满关注' : '容量充足';
  const link = (id, label) =>
    `<a class="text-link" href="detail.html?point=${id}">${label}</a>`;
  function select(id) {
    $('point').value = id;
    H.setPlayback({ selected: { kind: 'point', id } });
    H.saveTime();
    render(true);
  }
  function render(force = false) {
    const s = H.getSnapshot(),
      m = s.monitoring.find((p) => p.id === $('point').value),
      all = s.monitoring;
    $('clock').textContent = H.fmt(s.time);
    $('time').value = s.time;
    $('speed').value = s.playback.speed;
    $('play').textContent = s.time >= 1200 ? '重新播放' : s.playback.playing ? '暂停' : '播放';
    const nextKey = [Math.floor(s.time), m.id, tab, s.orders.length, s.isolated].join('|');
    if (!force && key === nextKey) return;
    key = nextKey;
    const totals = [
      ['今日投放批次', all.reduce((a, p) => a + p.deposits.length, 0), '批次'],
      [
        '当前容量占用',
        Math.round((all.reduce((a, p) => a + p.stockLiters, 0) / (780 * all.length)) * 100),
        '%',
      ],
      ['高负荷点位', all.filter((p) => p.bins.some((b) => b.fill >= 85)).length, '处'],
      ['厨余暂存超时', all.filter((p) => p.overdue).length, '处'],
    ];
    $('monitor-kpis').innerHTML = totals
      .map(
        ([label, n, unit]) =>
          `<article><span>${label}</span><b>${n.toLocaleString()}</b><small>${unit}</small></article>`,
      )
      .join('');
    if (previousPoint !== m.id) {
      scene.select({ kind: 'point', id: m.id }, false);
      previousPoint = m.id;
    }
    $('point-name').textContent = m.name;
    $('point-context').textContent =
      `${m.id === 'P4' ? '餐饮集中投放' : m.id === 'P2' ? '生活区日常投放' : '校园公共区域'} · 配置容量 780 L · 当前存量 ${m.stockLiters.toFixed(1)} L`;
    $('dispatch-link').href = 'detail.html?point=' + m.id;
    const latest = m.deposits[0];
    $('monitor-bins').innerHTML = m.bins
      .map(
        (b, i) =>
          `<article class="monitor-bin" data-alert="${b.fill >= 85}"><h3>${b.name}</h3><svg viewBox="0 0 100 135" role="img" aria-label="${b.name}占用${Math.round(b.fill)}%，${state(b)}"><rect x="18" y="30" width="64" height="95" rx="8" fill="var(--accent-soft)"/><rect class="bin-fluid" x="22" y="${121 - Math.min(1, b.fill / 100) * 85}" width="56" height="${Math.min(1, b.fill / 100) * 85}" rx="5" fill="${colors[i]}"/><path d="M12 26H88M34 19H66" stroke="var(--ink)" stroke-width="3" fill="none"/>${latest?.category === b.name && (s.playback.playing || story?.act === 0) ? '<path class="deposit-drop" d="M43 4h14l3 12H40Z" fill="var(--ink)"/>' : ''}</svg><b>${Math.round(b.fill)}%</b><p class="bin-state">${state(b)}</p><p>${b.count} 桶 × ${b.capacity / b.count} L</p><p>${b.liters.toFixed(1)} L · 暂存 ${Math.floor(b.age)} 分钟</p></article>`,
      )
      .join('');
    $('deposit-signal').textContent = latest
      ? `${H.fmt(latest.at)} · ${latest.category}投入 1 批次，估算体积 ${latest.liters.toFixed(1)} L`
      : '当前仅含开场存量，尚无今日投放记录';
    document
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    const opened = [...$('monitor-content').querySelectorAll('details[open]')].map(
      (e) => e.dataset.order,
    );
    const focused = document.activeElement?.dataset.focus;
    $('monitor-content').innerHTML =
      tab === '投放监测'
        ? deposition(m, s)
        : tab === '暂存与环境'
          ? environment(m, s)
          : governance(m, s);
    opened.forEach((id) => {
      const d = $('monitor-content').querySelector(`[data-order="${id}"]`);
      if (d) d.open = true;
    });
    if (focused)
      $('monitor-content')
        .querySelector(`[data-focus="${focused}"]`)
        ?.focus({ preventScroll: true });
  }
  function deposition(m, s) {
    const hours = Array(14).fill(0);
    m.deposits.forEach((e) => (hours[Math.min(13, Math.floor((e.at - 360) / 60))] += e.liters));
    const max = Math.max(1, ...hours),
      categories = m.bins.map((b) => [
        b.name,
        m.deposits.filter((e) => e.category === b.name).reduce((a, e) => a + e.liters, 0),
      ]);
    return `<div class="monitor-columns"><section class="monitor-panel" id="deposit-trend"><div class="eyebrow">VOLUME / 投放体积</div><h2>高峰发生在什么时候</h2><div class="monitor-trend" role="group" aria-label="每小时投放体积，点击回放到该小时末">${hours.map((v, i) => `<button data-hour="${i}" data-focus="hour-${i}" style="height:${Math.max(2, (v / max) * 100)}%" aria-label="${i + 6}时，${v.toFixed(1)}升" title="${i + 6}:00 · ${v.toFixed(1)} L"><span>${i + 6}</span></button>`).join('')}</div><p class="trend-foot">时刻 / h · 体积 / L · 点击柱形查看截至该小时的记录</p><h3>分类投放构成</h3>${categories.map(([name, v]) => `<div class="category-row"><span>${name}</span><b>${v.toFixed(1)} L</b></div>`).join('')}<p class="monitor-note">投放批次不等于人数或件数；体积用于容量计算，收运重量单独统计。超过配置容量的存量包含桶外积压。</p></section><section class="monitor-panel"><div class="eyebrow">PRESSURE / 点位负荷</div><h2>优先关注哪些位置</h2><div class="monitor-rank">${s.monitoring
      .slice()
      .sort(
        (a, b) =>
          Math.max(...b.bins.map((x) => x.fill)) - Math.max(...a.bins.map((x) => x.fill)),
      )
      .map(
        (p) =>
          `<button data-point-choice="${p.id}" data-focus="rank-${p.id}" aria-pressed="${m.id === p.id}"><span>${p.name}</span><b>${Math.round(Math.max(...p.bins.map((b) => b.fill)))}% · ${p.highCount} 次预警</b></button>`,
      )
      .join(
        '',
      )}</div><p class="monitor-note">按最高负荷类别排序；点击联动上方校园模型与监测场景。</p></section></div><section class="monitor-panel" style="margin-top:20px"><h2>投放事件记录</h2><table><thead><tr><th>时刻</th><th>类别</th><th>批次</th><th>估算体积</th></tr></thead><tbody>${
      m.deposits
        .slice(0, 12)
        .map(
          (e) =>
            `<tr><td>${H.fmt(e.at)}</td><td>${e.category}</td><td>1</td><td>${e.liters.toFixed(1)} L</td></tr>`,
        )
        .join('') || '<tr><td colspan="4">当前时刻尚无投放记录</td></tr>'
    }</tbody></table><p class="monitor-note">${m.name} · 显示最近 12 批，共 ${m.deposits.length} 批。初始存量 ${m.initialLiters.toFixed(1)} L + 今日投入 ${m.inputLiters.toFixed(1)} L − 已收运 ${m.collectedLiters.toFixed(1)} L = 当前 ${m.stockLiters.toFixed(1)} L。已收运重量 ${m.collectedKg.toFixed(1)} kg。</p></section>`;
  }
  function environment(m, s) {
    const orders = H.ordersOf(m.id),
      collection = orders.find(
        (o) => ['full', 'late', 'stale'].includes(o.type) && o.status !== 'done',
      );
    return `<div class="monitor-columns"><section class="monitor-panel"><div class="eyebrow">STORAGE / 暂存与环境</div><h2>${m.priority ? '满载持续，优先处置' : m.overdue ? '厨余暂存时间较长' : '持续关注分类暂存'}</h2>${m.bins.map((b) => `<p>${b.name}：最早未收运 ${Math.floor(b.age)} 分钟；${b.fullSince == null ? '未满载' : `满载已持续 ${Math.floor(s.time - b.fullSince)} 分钟`}</p>`).join('')}<p>最近收运：${m.last == null ? '暂无记录' : H.fmt(m.last)}</p><p>最近保洁：${m.lastClean == null ? '暂无完成记录' : H.fmt(m.lastClean)}</p><p>${collection ? `已关联车辆 ${collection.truckId || '待安排'}，预计 ${collection.doneAt == null ? '当日无后续到站' : H.fmt(collection.doneAt)} 到站。` : '当前无待处理收运事项。'}</p>${link(m.id, '查看车辆与清运安排')}<h3>设施配置</h3><p>密闭桶盖：${m.facilities.lid ? '已配置' : '待完善'}</p><p>遮雨设施：${m.facilities.shelter ? '已配置' : '待完善'}</p><p>分类标识：${m.facilities.signage ? '已配置' : '待更新'}</p><p class="monitor-note">风险依据：类别占用 60% 关注、85% 预警、100% 满载；满载持续 15 分钟优先处置；厨余暂存超过 120 分钟提示超时。均为原型可配置阈值。</p></section><section class="monitor-panel"><div class="eyebrow">RESPONSE / 处置记录</div><h2>收运与保洁分别追踪</h2>${orders.map((o) => `<details data-order="${o.id}"><summary data-focus="order-${o.id}">${U.esc(o.label || o.type)} ${U.status(o)}${m.priority && o.status !== 'done' && ['full', 'late', 'stale'].includes(o.type) ? ' · 优先' : ''}</summary>${U.timeline(H.getOrderTimeline(o.id))}${o.causes ? `<p class="monitor-note">触发依据：${o.causes.map((c) => `${H.fmt(c.at)} ${c.type === 'stale' ? '厨余暂存超时' : '容量预警'}`).join('；')}</p>` : ''}</details>`).join('') || '<p>当前没有处置记录。</p>'}<p class="monitor-note">收运扣减库存；异味、脏乱按独立保洁任务处置。18 分钟受理、55 分钟完成为演示规则。</p><a class="button secondary" href="feedback.html?point=${m.id}">反馈环境或设施问题</a></section></div>`;
  }
  function governance(m, s) {
    const cards = [],
      pending = H.ordersOf(m.id).filter((o) => o.status !== 'done'),
      hot = m.bins.filter((b) => b.fill >= 85),
      low = s.monitoring.find((p) => p.id !== m.id && p.bins.every((b) => b.fill < 30));
    if (hot.length && m.highCount >= 2 && !m.overdue)
      cards.push([
        '核查高负荷类别容量',
        `累计 ${m.highCount} 次预警；${hot.map((b) => b.name).join('、')}当前达到 85%；厨余未超时。建议核查增桶或更换更大容器。`,
        'trend',
      ]);
    if (
      m.overdue ||
      pending.some((o) => ['full', 'stale'].includes(o.type) && o.doneAt - s.time > 30)
    )
      cards.push([
        '调整收运时段',
        `厨余最早未收运 ${Math.floor(m.bins[1].age)} 分钟；未办结收运事项 ${pending.filter((o) => ['full', 'stale', 'late'].includes(o.type)).length} 条。建议结合峰值时段加密收运。`,
        'dispatch',
      ]);
    if (low && hot.length)
      cards.push([
        '列入容器重新配置候选',
        `${low.name}各类别占用均低于 30%，${m.name}存在高负荷类别。建议现场核查容器调配；单个时刻的差异不能直接确定位置调整。`,
        'trend',
      ]);
    const env = H.ordersOf(m.id).filter((o) =>
      ['odor', 'dirty', 'broken', 'signage'].includes(o.type),
    );
    if (env.length || !Object.values(m.facilities).every(Boolean))
      cards.push([
        '完善保洁与设施',
        `环境及设施记录 ${env.length} 条；${!m.facilities.lid ? '密闭桶盖待完善；' : ''}${!m.facilities.shelter ? '遮雨待完善；' : ''}${!m.facilities.signage ? '标识待更新；' : ''}建议保洁和设施修缮单独验收。`,
        'feedback',
      ]);
    const convenience = H.allFeedback().filter(
      (f) =>
        (f.targetId === m.id || f.pointId === m.id) &&
        ['location', 'bins'].includes(f.issueType),
    );
    if (convenience.length)
      cards.push([
        '核查投放便利性',
        `本点位有 ${convenience.length} 条桶量或位置相关反馈。安排现场走访、检查步行路径及投放指引。`,
        'feedback',
      ]);
    if (!cards.length)
      cards.push([
        '持续观察投放高峰',
        `累计 ${m.highCount} 次容量预警，当前最高类别占用 ${Math.round(Math.max(...m.bins.map((b) => b.fill)))}%。暂不据此提出增桶结论。`,
        'trend',
      ]);
    return `<section class="monitor-panel"><div class="eyebrow">GOVERNANCE / 配置与治理依据</div><h2>让每一条建议都有出处</h2>${cards.map(([title, reason, target]) => `<article class="monitor-suggestion"><h3>${title}</h3><p>${reason}</p>${target === 'trend' ? '<button class="text-button" data-tab="投放监测">查看投放趋势与点位负荷</button>' : target === 'dispatch' ? link(m.id, '查看预设线路和预计到站') : `<a class="text-link" href="feedback.html?point=${m.id}&scope=point">查看关联反馈</a>`}</article>`).join('')}<p class="monitor-note">配置建议依据当前模拟记录生成，供现场核查。未采集实际步行路网或调研样本，不输出最佳选址与精确覆盖率。</p></section>`;
  }
  const phases = [
    '午间投放增加',
    '厨余进入高负荷',
    '关联收运安排',
    '车辆到站收运',
    '保洁独立完成',
    '查看治理建议',
  ];
  function storyStage(n) {
    story.act = Math.max(0, Math.min(5, n));
    story.elapsed = 0;
    const m = story.m;
    H.stepTo(
      [
        Math.max(660, m.before - 12),
        m.alert,
        m.assigned,
        Math.max(m.assigned, m.done - 9),
        Math.max(m.clean, m.done),
        Math.max(m.clean, m.done),
      ][story.act],
    );
    tab = story.act === 5 ? '治理建议' : story.act >= 2 ? '暂存与环境' : '投放监测';
    render(true);
    drawStory();
  }
  function drawStory() {
    const focus = document.activeElement?.dataset.story;
    const a = story.act;
    $('story-body').innerHTML =
      `<div class="story-phase">0${a + 1} / 06</div><h3>${phases[a]}</h3><p>${['午间投放量增加，每一批投入同步更新分类库存。', '分类容器达到预警阈值，记录处置原因与触发时刻。', '容量预警关联南线下一次实际到站，避免重复派单。', '用七秒观察车辆接近；到站后按先入先出扣减库存，剩余批次保留暂存年龄。', '车辆收运与环境保洁分别办结，可在上方展开各自时间线。', '结合高负荷次数、暂存时间与设施情况，查看有依据的管理建议。'][a]}</p><div class="story-actions"><button class="button secondary" data-story="prev" ${a === 0 ? 'disabled' : ''}>上一幕</button><button class="button secondary" data-story="next" ${a === 5 ? 'disabled' : ''}>下一幕</button><button class="button secondary" data-story="auto">${story.auto ? '暂停自动' : '自动播放'}</button><button class="button secondary" data-story="restart">重新开始</button><button class="button secondary" data-story="exit">返回自由操作</button><a class="button secondary" href="feedback.html?point=P4" data-story-feedback>体验点位反馈</a></div>`;
    if (focus)
      $('story-body')
        .querySelector(`[data-story="${focus}"]:not(:disabled)`)
        ?.focus({ preventScroll: true });
  }
  function endStory() {
    if (!story) return;
    const old = story.point;
    tab = story.tab;
    H.endTour();
    story = null;
    document.querySelector('.monitor-story').classList.remove('is-active');
    $('point').value = old;
    $('story-body').hidden = true;
    $('story-start').hidden = false;
    document.querySelector('.monitor-controls').inert = false;
    document.querySelector('.monitor-controls').removeAttribute('aria-disabled');
    render(true);
  }
  $('story-start').onclick = () => {
    const point = $('point').value;
    H.beginTour();
    story = { point, tab, m: H.tourMilestones(660), act: 0, auto: false, elapsed: 0 };
    $('point').value = 'P4';
    $('story-start').hidden = true;
    $('story-body').hidden = false;
    document.querySelector('.monitor-controls').inert = true;
    document.querySelector('.monitor-controls').setAttribute('aria-disabled', 'true');
    storyStage(0);
    document.querySelector('.monitor-story').classList.add('is-active');
    document
      .querySelector('.monitor-overview')
      .scrollIntoView({ behavior: U.reduced() ? 'instant' : 'smooth', block: 'start' });
  };
  document.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-point-choice]');
    if (choice && !story) select(choice.dataset.pointChoice);
    const b = e.target.closest('[data-tab]');
    if (b) {
      tab = b.dataset.tab;
      render(true);
    }
    const hour = e.target.closest('[data-hour]');
    if (hour && !story) {
      H.setPlayback({ playing: false });
      H.stepTo(Math.min(1200, 420 + Number(hour.dataset.hour) * 60 - 1));
      H.saveTime();
      render(true);
    }
    const action = e.target.closest('[data-story]');
    if (action && story) {
      const a = action.dataset.story;
      if (a === 'exit') {
        endStory();
        return;
      }
      if (a === 'auto') {
        story.auto = !story.auto;
        story.elapsed = 0;
        drawStory();
      } else {
        story.auto = false;
        storyStage(a === 'prev' ? story.act - 1 : a === 'next' ? story.act + 1 : 0);
      }
    }
    if (e.target.closest('[data-story-feedback]')) endStory();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') endStory();
  });
  $('point').onchange = () => select($('point').value);
  $('play').onclick = () => {
    if (H.getNow() >= 1200) H.stepTo(360);
    H.setPlayback({ playing: !H.getSnapshot().playback.playing });
    H.saveTime();
    render(true);
  };
  $('speed').onchange = () => {
    H.setPlayback({ speed: Number($('speed').value) });
    H.saveTime();
  };
  $('time').oninput = () => {
    H.setPlayback({ playing: false });
    H.stepTo(Number($('time').value));
    H.saveTime();
    render(true);
  };
  const stop = U.clock(
    (dt, ts) => {
      if (story) {
        story.elapsed += dt;
        if (story.act === 0) {
          const start = Math.max(660, story.m.before - 12);
          H.stepTo(
            Math.min(story.m.before, start + ((story.m.before - start) * story.elapsed) / 4),
          );
        }
        if (story.act === 3) {
          const m = story.m,
            start = Math.max(m.assigned, m.done - 9);
          H.stepTo(Math.min(m.done, start + ((m.done - start) * story.elapsed) / 7));
        }
        if (story.auto && story.elapsed >= (story.act === 3 ? 8 : 5)) {
          if (story.act < 5) storyStage(story.act + 1);
          else {
            story.auto = false;
            drawStory();
          }
        }
      }
      scene.paint(ts);
    },
    () => render(),
  );
  window.addEventListener('pagehide', () => {
    endStory();
    H.saveTime();
    stop();
    scene.destroy();
  });
  render(true);
})();
