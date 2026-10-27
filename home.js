(function () {
  'use strict';
  const H = HUBU,
    U = HUBU_UI,
    M = HUBU_MOTION,
    $ = (id) => document.getElementById(id);
  U.init('home');
  const demo = H.createDemoSession(),
    m = demo.milestones,
    root = $('scroll-story'),
    stage = $('story-stage');
  let snapshot = demo.getSnapshot(),
    progress = 0,
    chapter = -1,
    visible = true;
  const scene = HUBU_SCENE.create($('home-campus'), {
    hero: true,
    source: () => snapshot,
    onSelect: (kind, id) => {
      H.saveTime();
      location.href = 'detail.html?' + kind + '=' + id;
    },
  });
  const cuts = [0, 0.26, 0.42, 0.62, 0.84];
  const copy = [
    null,
    [
      '发现异常',
      '看见，<br>需要回应的地方。',
      '桃李园的一批批投放，增加分类库存。容量进入高负荷时，暂存风险与处置需求一同被记录。',
    ],
    [
      '路线接通',
      '让每一次出发，<br>都有所回应。',
      '南线车辆与这条工单关联。沿着已有校园路线，驶向下一次收运。',
    ],
    [
      '跟车抵达',
      '沿途有迹，<br>抵达有时。',
      '跟随 2 号车靠近桃李园。路线、车辆与模拟时刻，共同记录这一次抵达。',
    ],
    [
      '收运完成',
      '清走的是垃圾，<br>留下的是回应。',
      '到站收运扣减实际库存，剩余批次继续计算暂存时间。环境保洁独立追踪，设施建议有据可查。',
    ],
  ];
  function pct(a, b) {
    return M.clamp((progress - a) / (b - a));
  }
  function update(p, isVisible = true) {
    progress = p;
    visible = isVisible;
    $('home-campus').classList.toggle('scene-offscreen', !visible);
    const c = p < 0.2 ? 0 : p < 0.35 ? 1 : p < 0.5 ? 2 : p < 0.78 ? 3 : 4,
      small = innerWidth < 768,
      low = innerHeight < 550 || M.reduced();
    const darkness = Math.min(pct(0.12, 0.27), 1 - pct(0.88, 1));
    stage.classList.toggle('night-scene', darkness > 0.45);
    stage.style.setProperty('--story-darkness', darkness);
    stage.dataset.chapter = c;
    stage.classList.toggle('story-ended', p > 0.91);
    let time = m.before;
    if (c === 1) time = M.lerp(m.before, m.alert, pct(0.2, 0.28));
    if (c === 2) time = M.lerp(m.alert, m.assigned, pct(0.35, 0.42));
    if (c === 3) time = M.lerp(m.assigned, m.done, pct(0.5, 0.76));
    if (c === 4) time = m.done;
    snapshot = demo.seek(time);
    $('home-time').textContent = H.fmt(time);
    const p4 = H.POINTS.find((x) => x.id === 'P4'),
      tx = (p4.pos[0] - H.CAMPUS_CENTER[0]) * 65000,
      ty = (H.CAMPUS_CENTER[1] - p4.pos[1]) * 75000;
    let cam = {
      x: 0,
      y: 0,
      zoom: small ? 0.83 : 1.02,
      tilt: 36,
      rotation: -16,
      anchorX: small ? 0.54 : 0.7,
      anchorY: small ? 0.65 : 0.55,
    };
    if (c === 1 || c === 2) {
      cam = {
        ...cam,
        x: tx * 0.7,
        y: ty * 0.7,
        zoom: small ? 1.04 : 1.45,
        tilt: 24,
        anchorX: small ? 0.65 : 0.69,
        anchorY: small ? 0.65 : 0.53,
      };
    }
    if (c === 3) {
      const t = snapshot.trucks.find((t) => t.id === 'T2');
      cam = {
        ...cam,
        x: (t.pos.lng - H.CAMPUS_CENTER[0]) * 65000,
        y: (H.CAMPUS_CENTER[1] - t.pos.lat) * 75000 - 25,
        zoom: small ? 1.15 : 1.62,
        tilt: 38,
        rotation: -8,
        anchorX: small ? 0.65 : 0.66,
        anchorY: small ? 0.63 : 0.54,
      };
    }
    if (c === 4)
      cam = {
        ...cam,
        x: tx * (1 - pct(0.82, 0.97)),
        y: ty * (1 - pct(0.82, 0.97)),
        zoom: M.lerp(small ? 1.05 : 1.35, small ? 0.77 : 0.91, pct(0.82, 1)),
        anchorX: small ? 0.64 : 0.7,
        anchorY: small ? 0.64 : 0.53,
      };
    scene.setCamera(cam, low);
    scene.setBuild(M.lerp(0.55, 1, pct(0, 0.2)));
    scene.select(
      c === 0
        ? null
        : {
            kind: c === 2 || c === 3 ? 'truck' : 'point',
            id: c === 2 || c === 3 ? 'T2' : 'P4',
          },
      false,
    );
    $('cinema-hero').style.opacity = 1 - pct(0.12, 0.23);
    $('cinema-hero').style.transform = low
      ? 'none'
      : `translate3d(${-pct(0.08, 0.25) * 70}px,${-pct(0.08, 0.25) * 35}px,0)`;
    $('cinema-hero').inert = p > 0.2;
    const narrative = c > 0 && p < 0.92;
    $('story-narrative').style.opacity = narrative ? 1 : 0;
    $('story-narrative').inert = !narrative;
    $('story-finale').style.opacity = pct(0.9, 0.98);
    $('story-finale').inert = p < 0.94;
    $('story-progress').style.transform = `scaleX(${p})`;
    if (c !== chapter) {
      chapter = c;
      document.querySelectorAll('.story-chapters [data-chapter]').forEach((b) => {
        b.setAttribute('aria-current', +b.dataset.chapter === c ? 'step' : 'false');
      });
      if (c) {
        $('story-eyebrow').textContent = '校园清运纪事 / ' + copy[c][0];
        $('story-title').innerHTML = copy[c][1];
        $('story-description').textContent = copy[c][2];
        $('story-large-number').textContent = String(c).padStart(2, '0');
        M.animate(
          $('story-title'),
          [
            { opacity: 0, transform: 'translateY(25px)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 520 },
        );
      }
    }
    if (c) {
      const point = snapshot.points.find((p) => p.id === 'P4'),
        event = snapshot.events.find((e) => e.pid === 'P4' && e.at === m.done);
      $('story-fact').innerHTML =
        c === 4
          ? `<b>${event ? event.kg.toFixed(1) : 0}<small> kg</small></b><span>本次模拟收运<br>工单已办结</span>`
          : c === 3
            ? `<b>${H.fmt(time)}</b><span>2 号车 · 南线清运<br>驶向桃李园食堂</span>`
            : `<b>${Math.round(point.fill)}<small>%</small></b><span>桃李园食堂<br>${point.status.text}</span>`;
    }
  }
  const scroll = M.scrollScene(root, (p, v) =>
    update(M.reduced() || (innerHeight < 500 && innerWidth > innerHeight) ? 0 : p, v),
  );
  document.querySelectorAll('.story-chapters [data-chapter]').forEach((b) =>
    b.addEventListener('click', () => {
      const range = root.offsetHeight - innerHeight;
      scrollTo({
        top: root.offsetTop + cuts[+b.dataset.chapter] * range,
        behavior: M.reduced() ? 'instant' : 'smooth',
      });
    }),
  );
  function summary() {
    const s = H.getSnapshot();
    U.number($('home-kg'), Math.round(s.totalKg));
    U.number($('home-alert'), s.alerts);
    U.number($('home-orders'), s.openOrders);
    $('summary-time').textContent = H.fmt(s.time);
  }
  summary();
  update(0);
  M.reveal();
  U.clock(
    (dt, ts) => {
      scroll.tick();
      if (visible) scene.paint(ts);
    },
    null,
    false,
  );
  addEventListener('qy-theme-change', () => scroll.refresh());
  addEventListener('pagehide', () => {
    demo.dispose();
    scene.destroy();
    scroll.dispose();
  });
})();
