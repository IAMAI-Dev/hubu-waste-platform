(function () {
  'use strict';
  var H = window.HUBU,
    U = window.HUBU_UI,
    serial = 0,
    loadPromise = null;
  function loadAMap() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve, reject) {
      var cfg = window.HUBU_MAP_CONFIG;
      if (!cfg || !cfg.key) return reject(new Error('map configuration missing'));
      window._AMapSecurityConfig = { securityJsCode: cfg.securityJsCode };
      var script = document.createElement('script'),
        timer = setTimeout(function () {
          reject(new Error('map load timeout'));
        }, 6500);
      window.__qyMapReady = function () {
        clearTimeout(timer);
        window.AMap ? resolve(window.AMap) : reject(new Error('map unavailable'));
      };
      script.src =
        'https://webapi.amap.com/maps?v=2.0&key=' +
        encodeURIComponent(cfg.key) +
        '&callback=__qyMapReady';
      script.onerror = function () {
        clearTimeout(timer);
        reject(new Error('map network unavailable'));
      };
      document.head.appendChild(script);
    }).catch(function (err) {
      loadPromise = null;
      throw err;
    });
    return loadPromise;
  }
  function create(el, options) {
    options = options || {};
    var id = 'campus-' + ++serial,
      real = null,
      amapReady = false,
      points = {},
      trucks = {},
      selected = null,
      follow = null,
      active = true;
    var zoom = 1,
      center = [450, 350],
      targetCenter = [450, 350],
      width = 900,
      height = 700,
      drag = null,
      hasDragged = false,
      lastFollow = 0,
      selectionKey = '',
      angles = {},
      lastPaint = 0;
    var all = H.CAMPUS.concat.apply(
      H.CAMPUS,
      H.TRUCKS.map(function (t) {
        return t.path;
      }),
    );
    var xs = all.map(function (p) {
        return p[0];
      }),
      ys = all.map(function (p) {
        return p[1];
      });
    var minX = Math.min.apply(null, xs),
      maxX = Math.max.apply(null, xs),
      minY = Math.min.apply(null, ys),
      maxY = Math.max.apply(null, ys);
    var scale = Math.min(700 / ((maxX - minX) * 0.86), 540 / (maxY - minY));
    function xy(p) {
      return [
        450 + (p[0] - (maxX + minX) / 2) * 0.86 * scale,
        350 - (p[1] - (maxY + minY) / 2) * scale,
      ];
    }
    function pts(path) {
      return path
        .map(function (p) {
          return xy(p)
            .map(function (x) {
              return x.toFixed(1);
            })
            .join(',');
        })
        .join(' ');
    }
    var trees = Array.from({ length: 35 }, function (_, i) {
      var x = 160 + H.pseudo(i + 100) * 570,
        y = 95 + H.pseudo(i + 200) * 495;
      return '<circle cx="' + x + '" cy="' + y + '" r="' + (4 + H.pseudo(i + 300) * 9) + '"/>';
    }).join('');
    var buildings = H.POINTS.map(function (p, i) {
      var q = xy(p.pos),
        w = i === 4 ? 64 : 50,
        h = i === 4 ? 40 : 28;
      return (
        '<g transform="translate(' +
        (q[0] - w / 2) +
        ' ' +
        (q[1] + 16) +
        ')"><rect width="' +
        w +
        '" height="' +
        h +
        '" rx="' +
        (i === 4 ? 18 : 4) +
        '"/><path d="M8 8h' +
        (w - 16) +
        ' M8 16h' +
        (w - 16) +
        '"/></g>'
      );
    }).join('');
    el.classList.add('campus-map');
    el.innerHTML =
      '<div class="real-map" aria-label="校园地理底图"></div><svg class="campus-svg" viewBox="0 0 900 700" role="group" aria-label="湖北大学校园示意地图"><defs><pattern id="' +
      id +
      '-grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" class="map-grid"/></pattern></defs><rect x="-3000" y="-3000" width="7000" height="7000" class="map-ground"/><rect x="0" y="0" width="900" height="700" fill="url(#' +
      id +
      '-grid)"/><path d="M-30 640C150 600 135 500 45 470S-20 355 50 300" class="map-water"/><polygon points="' +
      pts(H.CAMPUS) +
      '" class="campus-boundary"/><g class="map-trees">' +
      trees +
      '</g><g class="schematic-roads">' +
      H.TRUCKS.map(function (t) {
        return '<polyline points="' + pts(t.path) + '"/>';
      }).join('') +
      '</g><g class="map-buildings">' +
      buildings +
      '</g><g class="route-ghosts">' +
      H.TRUCKS.map(function (t) {
        return (
          '<polyline points="' +
          pts(t.path) +
          '" data-route="' +
          t.id +
          '" style="--route:' +
          t.color +
          '"/>'
        );
      }).join('') +
      '</g><g class="route-traces">' +
      H.TRUCKS.map(function (t) {
        return '<polyline data-trace="' + t.id + '" style="--route:' + t.color + '"/>';
      }).join('') +
      '</g><text x="450" y="345" class="campus-watermark" text-anchor="middle">湖北大学</text><text x="450" y="367" class="campus-watermark small" text-anchor="middle">武昌校区 · 校园示意</text><g class="point-marks">' +
      H.POINTS.map(function (p) {
        var q = xy(p.pos);
        return (
          '<g tabindex="0" role="button" aria-label="查看' +
          p.name +
          '" data-point="' +
          p.id +
          '" transform="translate(' +
          q.join(' ') +
          ')"><circle class="hit-area" r="24"/><circle class="point-ring" r="17"/><circle class="point-dot" r="7"/><g class="point-label"><rect x="-53" y="-43" width="106" height="25" rx="6"/><text y="-26" text-anchor="middle">' +
          p.name +
          '</text></g></g>'
        );
      }).join('') +
      '</g><g class="truck-marks">' +
      H.TRUCKS.map(function (t) {
        return (
          '<g tabindex="0" role="button" aria-label="查看' +
          t.code +
          '号车" data-truck="' +
          t.id +
          '" style="--route:' +
          t.color +
          '"><circle class="hit-area" r="24"/><circle class="truck-halo" r="19"/><g class="truck-body"><rect x="-13" y="-7" width="17" height="14" rx="3"/><path d="M5-5h6l4 5v7H5Z"/><path class="wheels" d="M-9-9h5 M-9 9h5 M8-7h3 M8 9h3"/></g><g class="truck-tag"><rect x="-26" y="23" width="52" height="23" rx="6"/><text y="39" text-anchor="middle">' +
          t.code +
          ' 号车</text></g></g>'
        );
      }).join('') +
      '</g></svg><div class="map-caption"><span class="map-mode">' +
      U.icon('layers') +
      '校园示意</span><span class="map-note">依据预设点位与路线绘制</span></div>' +
      (options.hero
        ? ''
        : '<div class="map-tools"><button class="icon-btn" data-map-action="fit" aria-label="重置地图视角" title="重置视角">' +
          U.icon('target') +
          '</button><button class="icon-btn" data-map-action="in" aria-label="放大地图">' +
          U.icon('plus') +
          '</button><button class="icon-btn" data-map-action="out" aria-label="缩小地图">' +
          U.icon('minus') +
          '</button></div><div class="map-legend"><span><i class="normal"></i>正常</span><span><i class="near"></i>临满</span><span><i class="full"></i>满溢</span></div>');
    var svg = el.querySelector('.campus-svg'),
      pixelScale = 1;
    svg.querySelectorAll('[data-point],[data-truck]').forEach(function (g) {
      var inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      inner.classList.add('marker-glyph');
      while (g.firstChild) inner.appendChild(g.firstChild);
      g.appendChild(inner);
    });
    function resize() {
      var r = el.getBoundingClientRect();
      pixelScale = Math.max(0.1, Math.min(r.width / width, r.height / height));
      el.classList.toggle('compact-map', r.width < 550);
      viewport();
    }
    var observer = new ResizeObserver(resize);
    observer.observe(el);
    function choose(kind, pid) {
      if (options.onSelect) options.onSelect(kind, pid);
    }
    svg.addEventListener('click', function (e) {
      if (hasDragged) {
        hasDragged = false;
        return;
      }
      var p = e.target.closest('[data-point]'),
        t = e.target.closest('[data-truck]');
      if (p) choose('point', p.dataset.point);
      if (t) choose('truck', t.dataset.truck);
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var p = e.target.closest('[data-point]'),
          t = e.target.closest('[data-truck]');
        if (p || t) {
          e.preventDefault();
          choose(p ? 'point' : 'truck', p ? p.dataset.point : t.dataset.truck);
        }
      }
    });
    function stopFollow() {
      follow = null;
      if (options.onDrag) options.onDrag();
    }
    if (!options.hero) {
      svg.addEventListener('pointerdown', function (e) {
        if (e.target.closest('[role="button"]')) return;
        drag = { x: e.clientX, y: e.clientY, center: center.slice() };
        svg.setPointerCapture(e.pointerId);
        hasDragged = false;
      });
      svg.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x,
          dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) {
          hasDragged = true;
          stopFollow();
          var rect = svg.getBoundingClientRect(),
            unit = Math.max(width / zoom / rect.width, height / zoom / rect.height);
          center = [drag.center[0] - dx * unit, drag.center[1] - dy * unit];
          targetCenter = center.slice();
          viewport();
        }
      });
      svg.addEventListener('pointerup', function () {
        drag = null;
      });
      svg.addEventListener('pointercancel', function () {
        drag = null;
      });
      el.querySelectorAll('[data-map-action]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.dataset.mapAction;
          if (a === 'fit') fit();
          else if (amapReady) real.setZoom(real.getZoom() + (a === 'in' ? 1 : -1));
          else {
            zoom = Math.max(0.75, Math.min(3, zoom * (a === 'in' ? 1.25 : 0.8)));
            viewport();
          }
        });
      });
    }
    function viewport() {
      el.classList.toggle('zoomed-out', zoom < 0.95);
      svg.querySelectorAll('.marker-glyph').forEach(function (g) {
        g.setAttribute('transform', 'scale(' + (1 / (pixelScale * zoom)).toFixed(3) + ')');
      });
      svg.setAttribute(
        'viewBox',
        [
          (center[0] - width / zoom / 2).toFixed(2),
          (center[1] - height / zoom / 2).toFixed(2),
          (width / zoom).toFixed(2),
          (height / zoom).toFixed(2),
        ].join(' '),
      );
    }
    function fit() {
      stopFollow();
      zoom = 1;
      targetCenter = [450, 350];
      center = targetCenter.slice();
      viewport();
      if (amapReady) real.setFitView(null, U.reduced(), [55, 55, 55, 55], 17);
    }
    function select(s, move) {
      selected = s;
      var key = s ? s.kind + ':' + s.id : '';
      if (move && key !== selectionKey && !U.reduced()) {
        var p = s && s.kind === 'point' ? H.byId(s.id) : null,
          t =
            s && s.kind === 'truck'
              ? H.getSnapshot().trucks.find(function (x) {
                  return x.id === s.id;
                })
              : null;
        var pos = p ? p.pos : t ? [t.pos.lng, t.pos.lat] : null;
        if (pos) {
          targetCenter = xy(pos);
          if (amapReady) real.setZoomAndCenter(17, pos, false, 700);
        }
      }
      selectionKey = key;
      svg.querySelectorAll('[data-point],[data-truck]').forEach(function (g) {
        g.classList.toggle(
          'selected',
          !!s &&
            ((s.kind === 'point' && g.dataset.point === s.id) ||
              (s.kind === 'truck' && g.dataset.truck === s.id)),
        );
      });
    }
    function paint(ts) {
      if (!active) return;
      var dt = lastPaint ? Math.min(0.1, (ts - lastPaint) / 1000) : 0.016;
      lastPaint = ts;
      var s = H.getSnapshot();
      s.points.forEach(function (p) {
        var g = svg.querySelector('[data-point="' + p.id + '"]');
        g.style.setProperty('--point', p.status.color);
        g.classList.toggle('overflow', p.status.key === 'full');
        g.classList.toggle(
          'quiet',
          !!selected && selected.id !== p.id && p.status.key !== 'full',
        );
        if (points[p.id]) {
          points[p.id].dom.style.setProperty('--point', p.status.color);
          points[p.id].dom.classList.toggle('overflow', p.status.key === 'full');
          points[p.id].dom.classList.toggle('selected', !!selected && selected.id === p.id);
          points[p.id].dom.classList.toggle(
            'quiet',
            real &&
              real.getZoom() < 17 &&
              (!selected || selected.id !== p.id) &&
              p.status.key !== 'full',
          );
        }
      });
      s.trucks.forEach(function (t, i) {
        var model = H.TRUCKS[i],
          q = xy([t.pos.lng, t.pos.lat]),
          g = svg.querySelector('[data-truck="' + t.id + '"]');
        g.setAttribute('transform', 'translate(' + q.join(' ') + ')');
        var angle = angles[t.id] == null ? t.pos.angle : angles[t.id],
          turn = ((t.pos.angle - angle + 540) % 360) - 180;
        angle += turn * (U.reduced() ? 1 : Math.min(1, dt * 12));
        angles[t.id] = angle;
        g.querySelector('.truck-body').setAttribute('transform', 'rotate(' + angle + ')');
        g.style.opacity = options.hero && t.id !== 'T2' ? '.24' : '1';
        var trace = H.sliceTo(model.path, model.cum, model.total, t.frac);
        svg.querySelector('[data-trace="' + t.id + '"]').setAttribute('points', pts(trace));
        if (trucks[t.id]) {
          trucks[t.id].dom.classList.toggle('selected', !!selected && selected.id === t.id);
          trucks[t.id].marker.setPosition([t.pos.lng, t.pos.lat]);
          trucks[t.id].body.style.transform = 'rotate(' + angle + 'deg)';
          trucks[t.id].trace.setPath(trace);
        }
        if (follow === t.id && !U.reduced()) {
          targetCenter = q;
          if (amapReady && ts - lastFollow > 180) {
            real.setCenter([t.pos.lng, t.pos.lat], true);
            lastFollow = ts;
          }
        }
      });
      if (!drag) {
        var factor = U.reduced() ? 1 : 0.09;
        center[0] += (targetCenter[0] - center[0]) * factor;
        center[1] += (targetCenter[1] - center[1]) * factor;
        viewport();
      }
    }
    function theme() {
      if (real)
        real.setMapStyle(
          document.documentElement.dataset.theme === 'dark'
            ? 'amap://styles/dark'
            : 'amap://styles/normal',
        );
    }
    function fail(error) {
      console.warn('[campus map]', error.message);
      amapReady = false;
      points = {};
      trucks = {};
      if (real) {
        real.destroy();
        real = null;
      }
      el.classList.remove('has-real-map');
      el.querySelector('.map-mode').innerHTML = U.icon('layers') + '校园示意';
      el.querySelector('.map-note').innerHTML =
        '底图暂不可用 <button class="text-button retry-map">重试</button><button class="text-button keep-schematic">使用示意图</button>';
      el.querySelector('.retry-map').onclick = startReal;
      el.querySelector('.keep-schematic').onclick = function () {
        el.querySelector('.map-note').textContent = '正在使用本地校园示意图';
      };
    }
    async function startReal() {
      if (options.schematicOnly) return;
      el.querySelector('.map-note').textContent = '正在连接地理底图，示意图可正常操作';
      try {
        var A = await loadAMap();
        if (!active) return;
        if (real) real.destroy();
        points = {};
        trucks = {};
        real = new A.Map(el.querySelector('.real-map'), {
          center: H.CAMPUS_CENTER,
          zoom: 16,
          viewMode: '2D',
          resizeEnable: true,
          animateEnable: !U.reduced(),
          features: ['bg', 'road', 'building', 'point'],
          mapStyle:
            document.documentElement.dataset.theme === 'dark'
              ? 'amap://styles/dark'
              : 'amap://styles/normal',
        });
        var completed = false,
          timeout = setTimeout(function () {
            if (!completed) fail(new Error('map initialization timeout'));
          }, 7000);
        real.on('complete', function () {
          if (completed || !real) return;
          completed = true;
          clearTimeout(timeout);
          amapReady = true;
          el.classList.add('has-real-map');
          el.querySelector('.map-mode').innerHTML = U.icon('map') + '高德地图';
          el.querySelector('.map-note').textContent = '预设校园路线 · 模拟车辆';
          real.setFitView(null, U.reduced(), [50, 45, 50, 45], 17);
        });
        real.on('error', function (e) {
          clearTimeout(timeout);
          fail(new Error(e.info || 'map initialization error'));
        });
        real.on('dragstart', stopFollow);
        new A.Polygon({
          path: H.CAMPUS,
          fillColor: '#2B7566',
          fillOpacity: 0.045,
          strokeColor: '#2B7566',
          strokeWeight: 1,
          strokeOpacity: 0.25,
          map: real,
        });
        H.POINTS.forEach(function (p) {
          var dom = document.createElement('button');
          dom.className = 'amap-point';
          dom.setAttribute('aria-label', '查看' + p.name);
          dom.innerHTML =
            '<span class="amap-point-dot"></span><span class="amap-point-label">' +
            U.esc(p.name) +
            '</span>';
          dom.addEventListener('click', function () {
            choose('point', p.id);
          });
          var marker = new A.Marker({
            position: p.pos,
            content: dom,
            offset: new A.Pixel(-22, -22),
            map: real,
          });
          points[p.id] = { marker: marker, dom: dom };
        });
        H.TRUCKS.forEach(function (t) {
          new A.Polyline({
            path: t.path,
            strokeColor: t.color,
            strokeOpacity: 0.3,
            strokeWeight: 2,
            strokeStyle: 'dashed',
            map: real,
          });
          var trace = new A.Polyline({
            path: [t.path[0], t.path[0]],
            strokeColor: t.color,
            strokeOpacity: 0.9,
            strokeWeight: 4,
            map: real,
          });
          var dom = document.createElement('button');
          dom.className = 'amap-truck';
          dom.style.setProperty('--route', t.color);
          dom.setAttribute('aria-label', '查看' + t.code + '号车');
          dom.innerHTML =
            '<span class="amap-truck-body">' +
            U.icon('truck') +
            '</span><span class="amap-truck-label">' +
            t.code +
            ' 号车</span>';
          dom.addEventListener('click', function () {
            choose('truck', t.id);
          });
          var mk = new A.Marker({
            position: t.path[0],
            content: dom,
            offset: new A.Pixel(-22, -22),
            zIndex: 150,
            map: real,
          });
          trucks[t.id] = {
            marker: mk,
            dom: dom,
            body: dom.querySelector('.amap-truck-body'),
            trace: trace,
          };
        });
      } catch (e) {
        fail(e);
      }
    }
    window.addEventListener('qy-theme-change', theme);
    if (!options.schematicOnly) startReal();
    paint(0);
    return {
      paint: paint,
      select: select,
      fit: fit,
      follow: function (id) {
        if (follow === id) return;
        follow = id;
        if (!amapReady) zoom = id ? 1.5 : 1;
        if (amapReady && id && !U.reduced()) real.setZoom(17);
      },
      retry: startReal,
      destroy: function () {
        active = false;
        observer.disconnect();
        window.removeEventListener('qy-theme-change', theme);
        if (real) real.destroy();
      },
    };
  }
  window.HUBU_MAP = { create: create };
})();
