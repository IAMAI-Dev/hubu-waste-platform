(function () {
  'use strict';
  const H = HUBU,
    U = HUBU_UI,
    M = HUBU_MOTION,
    NS = 'http://www.w3.org/2000/svg';
  let serial = 0;
  function create(el, options = {}) {
    const source = options.source || (() => H.getSnapshot()),
      uid = 'scene-' + ++serial,
      abort = new AbortController(),
      signal = abort.signal;
    let width = 1000,
      height = 700,
      selected = null,
      follow = null,
      alive = true,
      drag = null,
      dragged = false,
      previous = 0,
      lastGeometry = '',
      lastSnapshot = null,
      preview = null,
      entrance = options.hero ? 1 : 0;
    let camera = {
        x: 0,
        y: 0,
        zoom: options.hero ? 1 : 0.9,
        tilt: 28,
        rotation: -14,
        anchorX: 0.5,
        anchorY: 0.5,
      },
      target = { ...camera, zoom: 1 };
    const points = H.POINTS.map((p) => ({ ...p, world: world(p.pos) })),
      paths = H.TRUCKS.map((t) => ({ id: t.id, color: t.color, points: t.path.map(world) }));
    el.classList.add('cinema-campus');
    el.classList.remove('has-real-map');
    el.innerHTML = `<svg class="campus-svg scene-svg" role="group" aria-label="湖北大学立体校园示意"><defs><linearGradient id="${uid}-side" x2="0" y2="1"><stop stop-color="var(--terrain-edge)"/><stop offset="1" stop-color="var(--terrain-bottom)"/></linearGradient></defs><g class="terrain-contours"></g><path class="terrain-shadow"/><path class="terrain-side" fill="url(#${uid}-side)"/><path class="terrain-top"/><g class="scene-groves"></g><g class="scene-roads"></g><g class="scene-buildings"></g><g class="scene-routes"></g><g class="scene-traces"></g><g class="scene-signals"></g><path class="scene-connector"/></svg><div class="scene-markers"></div><div class="scene-coordinate-label" aria-hidden="true">HUBU / CAMPUS IN MOTION<span>114.3332 E · 30.5774 N</span></div><div class="scene-caption"><span>${U.icon('layers')}校园示意</span><small>预设路线 · 模拟演示</small></div>${options.hero ? '' : `<div class="map-tools"><button class="icon-btn" data-scene-action="fit" aria-label="重置地图视角">${U.icon('target')}</button><button class="icon-btn" data-scene-action="in" aria-label="放大地图">${U.icon('plus')}</button><button class="icon-btn" data-scene-action="out" aria-label="缩小地图">${U.icon('minus')}</button></div>`}`;
    const svg = el.querySelector('svg'),
      markerLayer = el.querySelector('.scene-markers');
    const node = (tag, cls, parent) => {
      const n = document.createElementNS(NS, tag);
      n.setAttribute('class', cls);
      parent.appendChild(n);
      return n;
    };
    const contours = Array.from({ length: 4 }, () =>
      node('path', 'terrain-contour', svg.querySelector('.terrain-contours')),
    );
    const campusModel = HUBU_CAMPUS_MODEL.create(svg, points, paths, H.CAMPUS.map(world));
    const routeNodes = paths.map((p) => {
      const road = node('path', 'scene-road', svg.querySelector('.scene-roads')),
        route = node('path', 'scene-route', svg.querySelector('.scene-routes')),
        trace = node('path', 'scene-trace', svg.querySelector('.scene-traces')),
        flow = node('path', 'scene-flow', svg.querySelector('.scene-signals'));
      [route, trace, flow].forEach((n) => n.style.setProperty('--route', p.color));
      return { p, road, route, trace, flow };
    });
    const markers = {};
    points.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'scene-point';
      b.dataset.point = p.id;
      b.setAttribute('aria-label', '查看' + p.name);
      b.innerHTML = `<span class="point-beacon"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="capacity-track" cx="24" cy="24" r="20"/><circle class="capacity-value" cx="24" cy="24" r="20"/></svg><i></i></span><span class="scene-label">${U.esc(p.name)}</span><span class="point-percent"></span>`;
      markerLayer.appendChild(b);
      markers[p.id] = b;
    });
    H.TRUCKS.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'scene-truck';
      b.dataset.truck = t.id;
      b.style.setProperty('--route', t.color);
      b.setAttribute('aria-label', '查看' + t.code + '号车');
      b.innerHTML = `<span class="vehicle-shell">${U.icon('truck')}</span><span class="scene-label">${t.code} 号车</span>`;
      markerLayer.appendChild(b);
      markers[t.id] = b;
    });
    function world(pos) {
      return [(pos[0] - H.CAMPUS_CENTER[0]) * 65000, (H.CAMPUS_CENTER[1] - pos[1]) * 75000];
    }
    function project(p, z = 0) {
      const a = (camera.rotation * Math.PI) / 180,
        t = (camera.tilt * Math.PI) / 180,
        x = p[0] - camera.x,
        y = p[1] - camera.y,
        rx = x * Math.cos(a) - y * Math.sin(a),
        ry = x * Math.sin(a) + y * Math.cos(a),
        scale = Math.min(width / 850, height / 840) * camera.zoom;
      return [
        width * camera.anchorX + rx * scale,
        height * camera.anchorY + (ry * Math.cos(t) - z * Math.sin(t)) * scale,
      ];
    }
    function path(ps, z = 0, close = false) {
      return (
        ps
          .map(
            (p, i) =>
              (i ? 'L' : 'M') +
              project(p, z)
                .map((v) => v.toFixed(2))
                .join(' '),
          )
          .join(' ') + (close ? 'Z' : '')
      );
    }
    const campus = H.CAMPUS.map(world);
    function geometry() {
      const signature = JSON.stringify([camera, width, height, entrance]);
      if (signature === lastGeometry) return;
      lastGeometry = signature;
      svg.querySelector('.terrain-top').setAttribute('d', path(campus, 0, true));
      svg.querySelector('.terrain-shadow').setAttribute('d', path(campus, -38, true));
      svg.querySelector('.terrain-side').setAttribute('d', path(campus, -24, true));
      contours.forEach((n, i) =>
        n.setAttribute(
          'd',
          path(
            campus.map((p) => [p[0] * (1.12 + i * 0.12), p[1] * (1.12 + i * 0.12)]),
            -32,
            true,
          ),
        ),
      );
      campusModel.paint(project, entrance);
      routeNodes.forEach((r) => {
        const d = path(r.p.points, 2);
        r.road.setAttribute('d', d);
        r.route.setAttribute('d', d);
        r.flow.setAttribute('d', d);
      });
    }
    function fit() {
      follow = null;
      target = {
        ...target,
        x: 0,
        y: 0,
        zoom: 1,
        tilt: 28,
        rotation: -14,
        anchorX: 0.5,
        anchorY: 0.5,
      };
      if (options.onDrag) options.onDrag();
    }
    function choose(kind, id) {
      if (options.onSelect) options.onSelect(kind, id);
    }
    markerLayer.addEventListener(
      'click',
      (e) => {
        const b = e.target.closest('button');
        if (b && !dragged)
          choose(b.dataset.point ? 'point' : 'truck', b.dataset.point || b.dataset.truck);
      },
      { signal },
    );
    el.addEventListener(
      'pointerdown',
      (e) => {
        if (options.hero || e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, c: { ...camera } };
        dragged = false;
        el.setPointerCapture(e.pointerId);
      },
      { signal },
    );
    el.addEventListener(
      'pointermove',
      (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x,
          dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) < 4) return;
        dragged = true;
        follow = null;
        if (options.onDrag) options.onDrag();
        const scale = Math.min(width / 850, height / 840) * camera.zoom,
          a = (camera.rotation * Math.PI) / 180,
          xx = dx / scale,
          yy = dy / scale / Math.cos((camera.tilt * Math.PI) / 180);
        target.x = drag.c.x - (xx * Math.cos(a) + yy * Math.sin(a));
        target.y = drag.c.y - (-xx * Math.sin(a) + yy * Math.cos(a));
        camera = { ...target };
      },
      { signal },
    );
    el.addEventListener('pointerup', () => (drag = null), { signal });
    el.addEventListener('pointercancel', () => (drag = null), { signal });
    el.querySelectorAll('[data-scene-action]').forEach((b) =>
      b.addEventListener(
        'click',
        () => {
          const a = b.dataset.sceneAction;
          if (a === 'fit') fit();
          else target.zoom = M.clamp(target.zoom * (a === 'in' ? 1.2 : 0.8), 0.6, 2.8);
        },
        { signal },
      ),
    );
    const observer = new ResizeObserver(() => {
      width = el.clientWidth;
      height = el.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      lastGeometry = '';
    });
    observer.observe(el);
    function select(s, move = true) {
      const changed = !selected || !s || selected.id !== s.id;
      selected = s;
      el.classList.toggle('has-scene-selection', !!s);
      if (s && changed && move && !M.reduced()) {
        const snap = source(),
          p =
            s.kind === 'point'
              ? points.find((p) => p.id === s.id)
              : snap.trucks.find((t) => t.id === s.id);
        if (p) {
          const pos = s.kind === 'point' ? p.world : world([p.pos.lng, p.pos.lat]);
          target = {
            ...target,
            x: pos[0],
            y: pos[1],
            zoom: 1.38,
            tilt: 24,
            anchorX: width < 768 ? 0.5 : 0.52,
            anchorY: width < 768 ? 0.36 : 0.46,
          };
        }
      }
      if (!s && move && changed) {
        target = { ...target, zoom: 1, x: 0, y: 0, tilt: 28, anchorX: 0.5, anchorY: 0.5 };
      }
      Object.keys(markers).forEach((id) =>
        markers[id].classList.toggle('selected', !!s && s.id === id),
      );
    }
    function paint(ts) {
      if (!alive || !width || !height) return;
      const dt = previous ? Math.min(0.1, (ts - previous) / 1000) : 0.016;
      previous = ts;
      const s = source();
      lastSnapshot = s;
      if (!options.hero) entrance = Math.min(1, entrance + dt / 1.1);
      if (follow && !M.reduced()) {
        const truck = s.trucks.find((t) => t.id === follow);
        if (truck) {
          const p = world([truck.pos.lng, truck.pos.lat]);
          target = {
            ...target,
            x: p[0],
            y: p[1] - 25,
            zoom: 1.55,
            tilt: 34,
            anchorX: 0.5,
            anchorY: width < 768 ? 0.36 : 0.52,
          };
        }
      }
      const f = M.reduced() ? 1 : 1 - Math.exp(-dt * 6);
      Object.keys(camera).forEach(
        (k) =>
          (camera[k] =
            Math.abs(camera[k] - target[k]) < 0.001
              ? target[k]
              : M.lerp(camera[k], target[k], f)),
      );
      geometry();
      s.points.forEach((p) => {
        const b = markers[p.id],
          q = project(world(p.pos), 65);
        b.style.left = q[0] + 'px';
        b.style.top = q[1] + 'px';
        b.style.setProperty('--point', p.status.color);
        b.style.setProperty('--capacity', M.clamp(p.fill / 100));
        b.classList.toggle('is-full', p.status.key === 'full');
        b.setAttribute(
          'aria-label',
          `查看${p.name}，${p.status.text}，饱和度${Math.round(p.fill)}%`,
        );
        b.querySelector('.point-percent').textContent = Math.round(p.fill) + '%';
      });
      s.trucks.forEach((t, i) => {
        const b = markers[t.id],
          q = project(world([t.pos.lng, t.pos.lat]), 24);
        b.style.left = q[0] + 'px';
        b.style.top = q[1] + 'px';
        b.classList.toggle('is-followed', follow === t.id);
        b.querySelector('.vehicle-shell').style.transform =
          'rotate(' + (t.pos.angle + camera.rotation) + 'deg)';
        const route = routeNodes[i],
          model = H.TRUCKS[i];
        route.trace.setAttribute(
          'd',
          path(H.sliceTo(model.path, model.cum, model.total, t.frac).map(world), 3),
        );
        const focus =
          preview ||
          (selected && selected.kind === 'truck' ? selected.id : null) ||
          (options.hero ? 'T2' : null);
        [route.route, route.trace, route.flow].forEach((n) =>
          n.classList.toggle('route-muted', !!focus && focus !== t.id),
        );
        route.flow.classList.toggle(
          'flow-active',
          (s.playback.playing || options.hero) && (!focus || focus === t.id),
        );
      });
      const connector = svg.querySelector('.scene-connector');
      if (selected && width >= 768) {
        const b = markers[selected.id],
          x = parseFloat(b.style.left),
          y = parseFloat(b.style.top);
        connector.setAttribute(
          'd',
          `M${x} ${y}L${Math.min(width - 330, x + 65)} ${y - 45}H${width - 310}`,
        );
        connector.style.opacity = 1;
      } else connector.style.opacity = 0;
    }
    function event(e) {
      const b = markers[e.pid];
      if (!b) return;
      U.announce(e.station + '完成收运，' + e.kg.toFixed(1) + '千克');
      M.pulse(b);
      b.classList.add('collection-flash');
      setTimeout(() => b.classList.remove('collection-flash'), 1100);
      M.flight(b, document.getElementById('metric-kg'), e.kg.toFixed(1) + ' kg');
    }
    return {
      paint,
      select,
      fit,
      event,
      ghost() {
        if (M.reduced()) return;
        el.querySelectorAll('.scene-ghost').forEach((n) => n.remove());
        const original = markers[selected && selected.kind === 'truck' ? selected.id : 'T2'];
        if (!original) return;
        const g = document.createElement('span');
        g.className = 'scene-ghost';
        g.setAttribute('aria-hidden', 'true');
        g.style.left = original.style.left;
        g.style.top = original.style.top;
        g.innerHTML = U.icon('truck');
        el.appendChild(g);
        const a = M.animate(g, [{ opacity: 0.5 }, { opacity: 0 }], { duration: 700 });
        if (a) a.finished.catch(() => {}).finally(() => g.remove());
      },
      preview(id) {
        preview = id;
      },
      marker(id) {
        return markers[id];
      },
      setCamera(c, immediate = false) {
        target = { ...target, ...c };
        if (immediate || M.reduced()) camera = { ...target };
      },
      setBuild(v) {
        entrance = v;
      },
      follow(id) {
        follow = id;
      },
      getCamera() {
        return { ...camera };
      },
      destroy() {
        alive = false;
        observer.disconnect();
        abort.abort();
        el.classList.remove('cinema-campus');
      },
      getSnapshot() {
        return lastSnapshot;
      },
    };
  }
  window.HUBU_SCENE = { create };
})();
