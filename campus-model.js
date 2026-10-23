/* Architectural illustration anchored exclusively to the six existing POIs.
   Footprints are typological illustrations, not surveyed building outlines. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  function create(svg, points, routes, boundary) {
    const ground = svg.querySelector('.scene-groves'),
      architecture = svg.querySelector('.scene-buildings');
    const shapes = [],
      blocks = [];
    function group(parent, cls, id) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', cls);
      if (id) g.dataset.model = id;
      parent.appendChild(g);
      return g;
    }
    function shape(parent, cls, vertices, closed = true) {
      const n = document.createElementNS(NS, 'path');
      n.setAttribute('class', cls);
      parent.appendChild(n);
      shapes.push({ n, vertices, closed });
      return n;
    }
    const rect = (x, y, w, d, z = 0) => [
      [x - w / 2, y - d / 2, z],
      [x + w / 2, y - d / 2, z],
      [x + w / 2, y + d / 2, z],
      [x - w / 2, y + d / 2, z],
    ];
    const oval = (x, y, rx, ry, z = 0) =>
      Array.from({ length: 64 }, (_, i) => {
        const a = (i * Math.PI) / 32;
        return [x + Math.cos(a) * rx, y + Math.sin(a) * ry, z];
      });
    function box(parent, x, y, w, d, h, type = 'stone') {
      const g = group(parent, 'campus-block material-' + type);
      const a = rect(x, y, w, d),
        t = rect(x, y, w, d, h);
      shape(g, 'model-shadow', rect(x + 6, y + 7, w + 7, d + 5));
      shape(g, 'model-wall side', [a[1], a[2], t[2], t[1]]);
      shape(g, 'model-wall front', [a[2], a[3], t[3], t[2]]);
      shape(g, 'model-roof', t);
      shape(g, 'model-parapet', rect(x, y, w - 3, d - 3, h + 0.4));
      // Glazed horizontal bands and individual mullions give buildings a readable scale.
      for (let z = 5; z < h - 2; z += 7) {
        shape(g, 'model-glazing', [
          [x - w / 2 + 3, y + d / 2 + 0.1, z],
          [x + w / 2 - 3, y + d / 2 + 0.1, z],
          [x + w / 2 - 3, y + d / 2 + 0.1, z + 3],
          [x - w / 2 + 3, y + d / 2 + 0.1, z + 3],
        ]);
        shape(g, 'model-glazing side-glazing', [
          [x + w / 2 + 0.1, y - d / 2 + 3, z],
          [x + w / 2 + 0.1, y + d / 2 - 3, z],
          [x + w / 2 + 0.1, y + d / 2 - 3, z + 3],
          [x + w / 2 + 0.1, y - d / 2 + 3, z + 3],
        ]);
      }
      for (let xx = x - w / 2 + 9; xx < x + w / 2 - 3; xx += 9)
        shape(
          g,
          'model-mullion',
          [
            [xx, y + d / 2 + 0.2, 3],
            [xx, y + d / 2 + 0.2, h - 2],
          ],
          false,
        );
      blocks.push({ g, x, y });
      return g;
    }
    function trees(x, y, r = 5) {
      const g = group(architecture, 'model-tree');
      shape(g, 'tree-shadow', oval(x + 3, y + 3, r + 1, r * 0.7));
      shape(
        g,
        'tree-trunk',
        [
          [x, y, 0],
          [x, y, 8],
        ],
        false,
      );
      shape(g, 'tree-crown', oval(x, y, r, r * 0.85, 9));
      shape(g, 'tree-light', oval(x - 1.2, y - 1.2, r * 0.65, r * 0.55, 11));
      blocks.push({ g, x, y });
    }
    const centers = {};
    points.forEach((p) => (centers[p.id] = p.world));
    points.forEach((p) => {
      const [anchorX, anchorY] = p.world;
      // Sports collection POI stays at the western access; keep the field east of the service road.
      const x = anchorX + (p.id === 'P5' ? 45 : 0),
        y = anchorY,
        area = group(ground, 'model-precinct', p.id),
        g = group(architecture, 'model-landmark', p.id);
      const title = document.createElementNS(NS, 'title');
      title.textContent = p.name + ' · 功能建筑示意';
      g.appendChild(title);
      if (p.id === 'P1') {
        shape(area, 'model-plaza', rect(x, y, 100, 82));
        box(g, x, y + 6, 78, 44, 19);
        box(g, x - 25, y - 5, 24, 47, 33);
        box(g, x + 25, y - 5, 24, 47, 33);
        box(g, x, y - 3, 23, 39, 39, 'glass');
        for (let i = 0; i < 4; i++)
          shape(g, 'library-skylight', rect(x - 6 + i * 4, y - 3, 2, 28, 40));
        for (let i = 0; i < 4; i++)
          shape(area, 'model-step', rect(x, y + 35 + i * 2, 43 + i * 5, 1));
      } else if (p.id === 'P2') {
        shape(area, 'model-plaza', rect(x - 4, y + 3, 109, 94));
        for (let i = 0; i < 3; i++) {
          box(g, x - 8, y - 28 + i * 29, 81, 16, 30, 'residence');
          for (let j = 0; j < 5; j++)
            shape(g, 'roof-panel', rect(x - 35 + j * 13, y - 28 + i * 29, 9, 9, 30.5));
          trees(x + 41, y - 27 + i * 29, 4);
        }
      } else if (p.id === 'P3') {
        shape(area, 'model-plaza', rect(x - 7, y - 7, 93, 86));
        box(g, x - 33, y - 8, 20, 65, 27);
        box(g, x + 29, y - 8, 20, 65, 27);
        box(g, x - 2, y - 34, 45, 18, 27);
        shape(area, 'model-lawn', rect(x - 2, y, 31, 28));
        shape(
          area,
          'model-walk',
          [
            [x - 2, y - 15, 0],
            [x - 2, y + 28, 0],
          ],
          false,
        );
        trees(x - 10, y + 3, 4);
        trees(x + 7, y + 3, 4);
      } else if (p.id === 'P4') {
        shape(area, 'model-plaza', rect(x, y, 102, 70));
        box(g, x - 12, y, 63, 40, 17, 'dining');
        box(g, x + 31, y + 2, 20, 43, 23);
        box(g, x - 13, y - 2, 42, 14, 22, 'glass');
        for (let i = 0; i < 5; i++)
          shape(g, 'roof-panel', rect(x - 33 + i * 10, y - 13, 7, 7, 17.5));
        for (let i = 0; i < 6; i++)
          shape(g, 'dining-awning', rect(x - 39 + i * 10, y + 23, 7, 10, 12));
        for (let i = 0; i < 4; i++) {
          shape(area, 'model-seat', rect(x - 28 + i * 17, y + 31, 7, 3));
        }
      } else if (p.id === 'P5') {
        // The athletics ground is centered on the existing sports POI, never a building block.
        shape(area, 'sports-apron', oval(x, y, 57, 76));
        shape(area, 'sports-track', oval(x, y, 50, 69));
        for (let i = 0; i < 5; i++)
          shape(area, 'track-lane', oval(x, y, 49 - i * 2.1, 68 - i * 2.1));
        shape(area, 'sports-infield', oval(x, y, 38, 57));
        shape(area, 'football-pitch', rect(x, y, 55, 84));
        for (let i = 0; i < 6; i++) shape(area, 'pitch-stripe', rect(x, y - 35 + i * 14, 54, 7));
        shape(area, 'field-line', rect(x, y, 54, 82));
        shape(
          area,
          'field-line',
          [
            [x - 27, y, 0],
            [x + 27, y, 0],
          ],
          false,
        );
        shape(area, 'field-line', oval(x, y, 10, 10));
        for (const side of [-1, 1]) {
          shape(area, 'field-line', rect(x, y + side * 33, 27, 16));
          shape(area, 'field-line', rect(x, y + side * 38, 14, 6));
          shape(area, 'goal-frame', rect(x, y + side * 43, 11, 3, 2));
        }
        for (let i = 0; i < 4; i++) box(g, x + 59 + i * 3, y, 3, 81, 3 + i * 2, 'stand');
      } else if (p.id === 'P6') {
        shape(area, 'model-plaza', rect(x - 9, y + 4, 96, 69));
        box(g, x - 24, y + 6, 36, 43, 29);
        box(g, x + 13, y + 8, 39, 39, 14, 'conference');
        for (let i = 0; i < 6; i++)
          shape(
            g,
            'hall-roof-rib',
            [
              [x - 4 + i * 6, y - 9, 15],
              [x - 4 + i * 6, y + 26, 15],
            ],
            false,
          );
        box(g, x - 7, y - 16, 63, 12, 20, 'glass');
        shape(
          area,
          'model-step',
          [
            [x - 40, y + 34, 0],
            [x + 33, y + 34, 0],
          ],
          false,
        );
      }
    });
    // A landscaped western campus garden: no invented POI or extra route destinations.
    const park = group(ground, 'model-garden');
    shape(park, 'model-lawn', [
      [-230, -170, 0],
      [-126, -187, 0],
      [-100, -91, 0],
      [-151, 12, 0],
      [-231, -15, 0],
    ]);
    shape(
      park,
      'garden-path',
      [
        [-220, -130, 0],
        [-164, -141, 0],
        [-130, -96, 0],
        [-163, -44, 0],
        [-222, -38, 0],
      ],
      false,
    );
    shape(
      park,
      'garden-path',
      [
        [-200, -163, 0],
        [-198, -75, 0],
        [-155, -27, 0],
      ],
      false,
    );
    function inside(p) {
      let c = false;
      for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
        const a = boundary[i],
          b = boundary[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          c = !c;
      }
      return c;
    }
    function distance(p, a, b) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
        );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }
    // Deterministic planting: exclude buildings, athletics ground, roads and outside boundary.
    for (let row = 0; row < 22; row++)
      for (let col = 0; col < 22; col++) {
        const x = -260 + col * 24 + (row % 2) * 9,
          y = -280 + row * 26,
          p = [x, y];
        if (
          !inside(p) ||
          points.some(
            (q) =>
              Math.abs(x - q.world[0] - (q.id === 'P5' ? 45 : 0)) < 68 &&
              Math.abs(y - q.world[1]) < (q.id === 'P5' ? 86 : 58),
          )
        )
          continue;
        if (routes.some((r) => r.points.some((a, i) => i && distance(p, r.points[i - 1], a) < 17)))
          continue;
        if ((row * 7 + col * 3) % 5 < 2) trees(x, y, 4 + ((row + col) % 3));
      }
    // Draw buildings and planting in stable back-to-front order at the fixed scene yaw.
    [...architecture.children]
      .sort((a, b) => {
        const position = (g) => {
          const point = points.find((p) => p.id === g.dataset.model);
          if (point) return point.world[1] * 0.97 - point.world[0] * 0.24;
          const t = blocks.find((t) => t.g === g);
          return t ? t.y * 0.97 - t.x * 0.24 : 0;
        };
        return position(a) - position(b);
      })
      .forEach((g) => architecture.appendChild(g));
    return {
      paint(project, rise) {
        const lift = Math.max(0.08, rise);
        for (const s of shapes) {
          s.n.setAttribute(
            'd',
            s.vertices
              .map(
                (v, i) =>
                  (i ? 'L' : 'M') +
                  project(v, (v[2] || 0) * lift)
                    .map((n) => n.toFixed(2))
                    .join(' '),
              )
              .join(' ') + (s.closed ? 'Z' : ''),
          );
        }
      },
    };
  }
  window.HUBU_CAMPUS_MODEL = { create };
})();
