/* ============================================================
   琴园智清 · 校园垃圾清运智能调度与反馈平台
   共用数据层 + 模拟引擎 + 地图工厂
   概览页 / 详情页 / 反馈中心共用本文件，保证数据与逻辑完全一致。
   ============================================================ */
(function () {
  'use strict';
  function createEngine(engineOptions) {
    engineOptions = engineOptions || {};

    var ROUTES = window.HUBU_ROUTES || {};

    /* ================= 基础数据（改这里即可换成真实数据） ================= */

    var CAMPUS_CENTER = [114.3332, 30.5774];

    // 校区范围示意：由校区内真实 POI 的外接范围拟合而成，仅用于提示范围
    var CAMPUS = [
      [114.32985, 30.58],
      [114.3321, 30.5813],
      [114.335, 30.5812],
      [114.33715, 30.5796],
      [114.3376, 30.5772],
      [114.3362, 30.5748],
      [114.3338, 30.5734],
      [114.331, 30.5733],
      [114.3295, 30.5748],
      [114.3289, 30.5772],
      [114.32905, 30.5788],
    ];

    // 投放点：坐标取自高德真实 POI，确保落在校园实际建筑位置
    // rate = 每分钟饱和度增长；数值按"该点位被服务的间隔"配比，
    // 使满溢预警全天周期性出现（约两成时间），而不是一直红着
    var POINTS = [
      { id: 'P1', name: '图书馆', pos: [114.3346, 30.57873], init: 45, rate: 0.4 },
      { id: 'P2', name: '学生宿舍', pos: [114.3365, 30.58025], init: 58, rate: 0.58 },
      { id: 'P3', name: '教学区', pos: [114.33086, 30.57694], init: 30, rate: 0.36 },
      { id: 'P4', name: '桃李园食堂', pos: [114.33195, 30.57395], init: 66, rate: 0.9 },
      { id: 'P5', name: '运动场', pos: [114.33526, 30.57726], init: 22, rate: 0.3 },
      { id: 'P6', name: '学术交流中心', pos: [114.33008, 30.57594], init: 74, rate: 0.55 },
    ];

    var DAY_START = 6 * 60; // 06:00
    var DAY_END = 20 * 60; // 20:00
    var MIN_PER_SEC = 10; // 1× 时每真实秒推进 10 虚拟分钟（全天约 84 秒放完）

    // 每条线的 loop = 绕一圈所占的虚拟分钟数，按线路长度配比，使三辆车屏幕速度一致。
    // waypoints 的首项同时是发车点：三条线分别从校园东部、南部、东北部发车，避免车辆扎堆。
    var TRUCKS = [
      {
        id: 'T1',
        code: '1',
        name: '东区清运线',
        plate: '鄂A·G1024',
        color: '#2F6DB5',
        phase: 12,
        waypoints: ['P1', 'P5', 'P3'],
        loop: 78,
        path: ROUTES.T1,
      },
      {
        id: 'T2',
        code: '2',
        name: '南线清运线',
        plate: '鄂A·G2077',
        color: '#7A4FBF',
        phase: 63,
        waypoints: ['P4', 'P3', 'P1'],
        loop: 96,
        path: ROUTES.T2,
      },
      {
        id: 'T3',
        code: '3',
        name: '机动巡检线',
        plate: '鄂A·G3391',
        color: '#C2662B',
        phase: 141,
        waypoints: ['P2', 'P3', 'P6', 'P1'],
        loop: 143,
        path: ROUTES.T3,
      },
    ];

    /* ================= 几何工具 ================= */
    var R = Math.PI / 180;

    function dist(a, b) {
      var dx = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * R),
        dy = a[1] - b[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    function buildCum(path) {
      var cum = [0],
        d = 0;
      for (var i = 1; i < path.length; i++) {
        d += dist(path[i - 1], path[i]);
        cum.push(d);
      }
      return { cum: cum, total: d || 1 };
    }
    function pointAt(path, cum, total, frac) {
      var target = Math.max(0, Math.min(1, frac)) * total;
      var i = 1;
      while (i < cum.length - 1 && cum[i] < target) i++;
      var seg = cum[i] - cum[i - 1] || 1e-9;
      var r = (target - cum[i - 1]) / seg;
      var a = path[i - 1],
        b = path[i];
      var lng = a[0] + (b[0] - a[0]) * r,
        lat = a[1] + (b[1] - a[1]) * r;
      var dx = (b[0] - a[0]) * Math.cos(lat * R),
        dy = b[1] - a[1];
      return { lng: lng, lat: lat, angle: -Math.atan2(dy, dx) / R };
    }
    function sliceTo(path, cum, total, frac) {
      var target = Math.max(0, Math.min(1, frac)) * total;
      var out = [];
      for (var i = 0; i < path.length; i++) {
        if (cum[i] <= target) out.push(path[i]);
        else break;
      }
      var p = pointAt(path, cum, total, frac);
      out.push([p.lng, p.lat]);
      return out.length > 1 ? out : [path[0], path[0]];
    }
    function nearestFrac(path, cum, total, pos) {
      // 闭环首尾顶点重合，排除末位顶点，避免算出 frac=1 导致起点停靠点永远触发不到
      var best = 0,
        bd = Infinity;
      for (var i = 0; i < path.length - 1; i++) {
        var d = dist(path[i], pos);
        if (d < bd) {
          bd = d;
          best = cum[i] / total;
        }
      }
      return best;
    }
    function byId(id) {
      for (var i = 0; i < POINTS.length; i++) if (POINTS[i].id === id) return POINTS[i];
      return null;
    }

    // 把闭环路径的起点旋转到指定位置，使每条线路从各自的发车点开始
    function rotateToPoint(path, pos) {
      var bi = 0,
        bd = Infinity;
      for (var i = 0; i < path.length - 1; i++) {
        var d = dist(path[i], pos);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      if (bi === 0) return path;
      var out = path.slice(bi);
      for (var j = 1; j <= bi; j++) out.push(path[j]);
      return out;
    }

    function preparePaths() {
      TRUCKS.forEach(function (t) {
        if (!t.path || t.path.length < 2) t.path = [CAMPUS_CENTER, CAMPUS_CENTER];
        var head = byId(t.waypoints[0]);
        if (head) t.path = rotateToPoint(t.path, head.pos);
        var c = buildCum(t.path);
        t.cum = c.cum;
        t.total = c.total;
        t.stops = t.waypoints
          .map(function (pid) {
            var p = byId(pid);
            return { pid: pid, name: p.name, frac: nearestFrac(t.path, c.cum, c.total, p.pos) };
          })
          .sort(function (a, b) {
            return a.frac - b.frac;
          });
      });
    }

    /* Replay processes each integer minute exactly once. Floating playhead is independent. */
    var now = DAY_START,
      handled = DAY_START,
      events = [],
      hourly = new Array(14).fill(0);
    var totalKg = 0,
      totalTrips = 0,
      orders = [],
      userOrders = [],
      feedback = [];
    var isolated = false,
      tourBackup = null,
      revision = 0;
    var FB_KEY = 'qy-feedback',
      WO_KEY = 'qy-work-orders-v2',
      SESSION_KEY = 'qy-session-v2';
    var FB_ROLES = ['学生', '教职工', '后勤人员', '访客'];
    var FB_TYPES = ['建议', '问题反馈', '表扬'];
    var FB_STATUS = {
      pending: { text: '待受理', pill: 'wait' },
      doing: { text: '处理中', pill: 'near' },
      done: { text: '已办结', pill: 'ok' },
    };
    var ORDER_TEXT = {
      full: { label: '满溢预警', msg: '桶体已满，需要安排清运' },
      late: { label: '清运不及时', msg: '等待下一次线路收运' },
      dirty: { label: '周边脏乱', msg: '桶站周边需要保洁' },
      broken: { label: '设备损坏', msg: '桶站设施需要检修' },
      wrong: { label: '分类不准', msg: '需要分类引导与整理' },
    };
    var playback = { playing: true, speed: 1, selected: null, follow: null };
    function read(storage, key, fallback) {
      try {
        var raw = storage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    }
    function local() {
      try {
        return engineOptions.demo ? null : window.localStorage;
      } catch (_) {
        return null;
      }
    }
    function session() {
      try {
        return engineOptions.demo ? null : window.sessionStorage;
      } catch (_) {
        return null;
      }
    }
    function readArray(key) {
      var a = read(local(), key, []);
      return Array.isArray(a)
        ? a.filter(function (v) {
            return v && typeof v === 'object';
          })
        : [];
    }
    function clone(v) {
      return JSON.parse(JSON.stringify(v));
    }
    function fmt(m) {
      m = Math.max(DAY_START, Math.min(DAY_END, m));
      return (
        String(Math.floor(m / 60)).padStart(2, '0') +
        ':' +
        String(Math.floor(m % 60)).padStart(2, '0')
      );
    }
    function pseudo(n) {
      var x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    }
    function lapFrac(t, m) {
      return ((((m - DAY_START + t.phase) % t.loop) + t.loop) % t.loop) / t.loop;
    }
    function crossed(a, b, s) {
      return b >= a ? a <= s && b > s : s >= a || s < b;
    }
    function statusOf(p) {
      return p.fill >= 85
        ? { key: 'full', color: '#BC4B42', text: '已满溢', pill: 'full' }
        : p.fill >= 60
          ? { key: 'near', color: '#A56717', text: '接近满', pill: 'near' }
          : { key: 'ok', color: '#277B52', text: '正常', pill: 'ok' };
    }
    function accuracyOf(p) {
      return Math.round(86 + pseudo(POINTS.indexOf(p) * 7.7 + 3.1) * 12);
    }
    function nextVisit(pid, at) {
      var best = null;
      TRUCKS.forEach(function (t) {
        var stop = t.stops.find(function (s) {
          return s.pid === pid;
        });
        if (!stop) return;
        for (var m = Math.floor(at) + 1; m <= DAY_END; m++) {
          if (crossed(lapFrac(t, m - 1), lapFrac(t, m), stop.frac)) {
            if (!best || m < best.at) best = { at: m, truckId: t.id, name: t.name, code: t.code };
            break;
          }
        }
      });
      return best;
    }
    function nextStop(t, at) {
      var best = null;
      t.stops.forEach(function (s) {
        var v = nextVisitForTruck(t, s, at);
        if (!best || v.at < best.at) best = v;
      });
      return best;
    }
    function nextVisitForTruck(t, s, at) {
      var frac = lapFrac(t, at),
        delta = ((s.frac - frac + 1) % 1) * t.loop;
      return { pid: s.pid, name: s.name, at: at + delta, minutes: Math.ceil(delta) };
    }
    function isCollection(o) {
      return o.type === 'full' || o.type === 'late';
    }
    function orderStatus(o, m) {
      if (m < o.at) return 'future';
      if (o.doneAt != null && m >= o.doneAt) return 'done';
      if (o.assignedAt != null && m >= o.assignedAt) return 'doing';
      return 'pending';
    }
    function decorateOrder(o) {
      var out = Object.assign({}, o),
        info = ORDER_TEXT[o.type] || ORDER_TEXT.dirty;
      if (isCollection(o)) {
        var visit = nextVisit(o.pid, o.at);
        out.truckId = visit ? visit.truckId : null;
        out.assignedAt = visit ? Math.min(o.at + 1, visit.at) : null;
        out.doneAt = visit ? visit.at : null;
      } else {
        out.assignedAt = o.at + 18;
        out.doneAt = o.at + 55;
      }
      out.label = info.label;
      out.msg = info.msg;
      out.time = fmt(o.at);
      out.station = byId(o.pid) ? byId(o.pid).name : '平台整体';
      return out;
    }
    function visibleOrders() {
      return orders.filter(function (o) {
        return o.at <= now;
      });
    }
    function orderView(o) {
      return Object.assign({}, o, { status: orderStatus(o, now) });
    }
    function createSystemOrder(pid, type, at, src) {
      if (
        type === 'full' &&
        orders.some(function (o) {
          return o.pid === pid && isCollection(o) && o.at <= at && orderStatus(o, at) !== 'done';
        })
      )
        return;
      orders.push(
        decorateOrder({
          id: 'S-' + pid + '-' + type + '-' + at,
          pid: pid,
          type: type,
          at: at,
          src: src || '系统预警',
        }),
      );
    }
    function reset() {
      now = handled = DAY_START;
      events = [];
      hourly = new Array(14).fill(0);
      totalKg = totalTrips = 0;
      POINTS.forEach(function (p) {
        p.fill = p.init;
        p.kg = 0;
        p.times = 0;
        p.last = null;
        p._full = false;
      });
      TRUCKS.forEach(function (t) {
        t.kg = 0;
        t.trips = 0;
      });
      orders = userOrders
        .filter(function (o) {
          return byId(o.pid) && ORDER_TEXT[o.type] && Number.isFinite(o.at);
        })
        .map(decorateOrder);
      [
        ['P4', 'dirty', 455],
        ['P6', 'broken', 510],
        ['P2', 'wrong', 565],
      ].forEach(function (s) {
        createSystemOrder(s[0], s[1], s[2], '示例上报');
      });
      revision++;
    }
    function doCollect(t, pid, m) {
      var p = byId(pid),
        kg = Math.round(26 + pseudo((m - 1) * 7.3 + pid.charCodeAt(1) * 13.7) * 44);
      p.kg += kg;
      p.times++;
      p.last = m;
      p.fill = 4 + pseudo((m - 1) * 3.1 + p.kg) * 5;
      p._full = false;
      t.kg += kg;
      t.trips++;
      totalKg += kg;
      totalTrips++;
      hourly[Math.min(13, Math.floor((m - DAY_START - 1) / 60))] += kg;
      events.unshift({
        id: 'E-' + t.id + '-' + pid + '-' + m,
        at: m,
        t: fmt(m),
        station: p.name,
        pid: pid,
        kg: kg,
        truck: t.code,
        truckId: t.id,
      });
    }
    function advanceMinute(m) {
      POINTS.forEach(function (p) {
        p.fill = Math.min(100, p.fill + p.rate);
      });
      TRUCKS.forEach(function (t) {
        t.stops.forEach(function (s) {
          if (crossed(lapFrac(t, m - 1), lapFrac(t, m), s.frac)) doCollect(t, s.pid, m);
        });
      });
      // Resolve arrivals first: a point cleared this minute must not retain a new full alert.
      POINTS.forEach(function (p) {
        if (p.fill >= 85 && !p._full) {
          p._full = true;
          createSystemOrder(p.id, 'full', m);
        }
        if (p.fill < 85) p._full = false;
      });
      revision++;
    }
    function stepTo(target) {
      target = Number(target);
      if (!Number.isFinite(target)) return;
      target = Math.max(DAY_START, Math.min(DAY_END, target));
      if (target < now) reset();
      while (handled + 1 <= target) {
        handled++;
        advanceMinute(handled);
      }
      now = target;
      if (now >= DAY_END) playback.playing = false;
    }
    function getOrder(id) {
      var o = visibleOrders().find(function (x) {
        return x.id === id;
      });
      return o ? orderView(o) : null;
    }
    function getOrderTimeline(id) {
      var o = getOrder(id);
      if (!o) return [];
      var t =
        o.truckId &&
        TRUCKS.find(function (v) {
          return v.id === o.truckId;
        });
      return [
        {
          at: o.at,
          title: o.src === '系统预警' ? '系统发现满溢' : '收到点位反馈',
          detail: o.label,
        },
        {
          at: o.assignedAt,
          title: isCollection(o) ? '清运安排已关联' : '模拟受理',
          detail: t ? t.code + ' 号车 · ' + t.name : '演示处置人员开始处理',
        },
        {
          at: o.doneAt,
          title: isCollection(o) ? '完成点位收运' : '模拟办结',
          detail: isCollection(o) ? '清运记录与点位状态已同步' : '按演示时效完成处置',
        },
      ]
        .filter(function (e) {
          return e.at != null && e.at <= now;
        })
        .map(function (e) {
          return Object.assign(e, { time: fmt(e.at) });
        });
    }
    function stamp(d) {
      d = d || new Date();
      return (
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0') +
        ' ' +
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0')
      );
    }
    function uid(prefix) {
      return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    }
    function saveRecords(nextFeedback, nextOrders) {
      if (isolated || engineOptions.demo)
        return { ok: false, error: '故事导览中暂不保存反馈，请先返回自由操作。' };
      var store = local(),
        oldF,
        oldO;
      try {
        if (!store) throw new Error('storage unavailable');
        oldF = store.getItem(FB_KEY);
        oldO = store.getItem(WO_KEY);
        store.setItem(WO_KEY, JSON.stringify(nextOrders));
        store.setItem(FB_KEY, JSON.stringify(nextFeedback));
      } catch (_) {
        try {
          if (store) {
            oldO == null ? store.removeItem(WO_KEY) : store.setItem(WO_KEY, oldO);
            oldF == null ? store.removeItem(FB_KEY) : store.setItem(FB_KEY, oldF);
          }
        } catch (ignored) {
          /* preserve current in-memory state */
        }
        return { ok: false, error: '未能保存到本机。请检查浏览器存储设置后重试。' };
      }
      feedback = nextFeedback;
      userOrders = nextOrders;
      var at = now;
      reset();
      stepTo(at);
      return { ok: true };
    }
    function addFeedback(f) {
      var text = String(f.text || '');
      if (text.trim().length < 5 || text.length > 300)
        return { ok: false, error: '请填写 5 至 300 字的问题描述。' };
      var targetId = f.targetId || null;
      if (
        targetId &&
        targetId !== 'platform' &&
        !byId(targetId) &&
        !TRUCKS.some(function (t) {
          return t.id === targetId;
        })
      )
        return { ok: false, error: '请选择有效的关联对象。' };
      var pid = byId(targetId)
        ? targetId
        : (
            POINTS.find(function (p) {
              return p.name === f.target;
            }) || {}
          ).id || null;
      if (pid && !byId(pid)) return { ok: false, error: '请选择有效的投放点。' };
      var type = FB_TYPES.indexOf(f.type) >= 0 ? f.type : '问题反馈';
      var issue = f.issueType || 'dirty',
        rating = f.rating == null || f.rating === '' ? null : Number(f.rating);
      if (type === '问题反馈' && pid && !ORDER_TEXT[issue])
        return { ok: false, error: '请选择问题类型。' };
      if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5))
        return { ok: false, error: '评分应在 1 至 5 之间。' };
      var target = pid
        ? byId(pid).name
        : feedbackTargets().indexOf(f.target) >= 0
          ? f.target
          : '平台整体';
      var item = {
        id: uid('F'),
        who: String(f.who || '匿名').slice(0, 10),
        role: FB_ROLES.indexOf(f.role) >= 0 ? f.role : '学生',
        type: type,
        rating: rating,
        target: target,
        targetId: pid,
        issueType: type === '问题反馈' ? issue : null,
        text: text,
        time: stamp(),
        createdAt: new Date().toISOString(),
        simulatedAt: now,
        status: 'pending',
        reply: '',
        mine: true,
        orderId: null,
      };
      var next = userOrders.slice();
      if (type === '问题反馈' && pid) {
        var existing =
          (issue === 'full' || issue === 'late') &&
          visibleOrders().find(function (o) {
            return o.pid === pid && isCollection(o) && orderStatus(o, now) !== 'done';
          });
        if (existing) item.orderId = existing.id;
        else {
          item.orderId = uid('UO');
          next.push({ id: item.orderId, pid: pid, type: issue, at: now, src: '本机反馈' });
        }
      }
      var result = saveRecords([item].concat(feedback), next);
      return result.ok ? { ok: true, item: item, id: item.id, orderId: item.orderId } : result;
    }
    function reportOrder(pid, type) {
      var p = byId(pid);
      return p
        ? addFeedback({
            targetId: pid,
            type: '问题反馈',
            issueType: type,
            text: ORDER_TEXT[type] ? ORDER_TEXT[type].msg : '',
            role: '学生',
            rating: null,
          })
        : { ok: false, error: '投放点不存在' };
    }
    function feedbackView(f) {
      var out = Object.assign({}, f);
      if (Number.isFinite(f.simulatedAt)) {
        if (f.orderId) {
          var o = getOrder(f.orderId);
          out.status = o ? o.status : 'pending';
        } else if (f.type === '问题反馈')
          out.status =
            now >= f.simulatedAt + 55 ? 'done' : now >= f.simulatedAt + 18 ? 'doing' : 'pending';
        else out.status = 'done';
      }
      return out;
    }
    function allFeedback() {
      return feedback
        .filter(function (f) {
          return !Number.isFinite(f.simulatedAt) || f.simulatedAt <= now;
        })
        .map(feedbackView)
        .concat(window.HUBU_FEEDBACK_SEED || []);
    }
    function feedbackTimeline(f) {
      if (f.orderId) return getOrderTimeline(f.orderId);
      if (!Number.isFinite(f.simulatedAt))
        return [
          {
            time: f.time,
            title: '历史示例反馈',
            detail: f.reply || (FB_STATUS[f.status] || FB_STATUS.pending).text,
          },
        ];
      if (f.type !== '问题反馈')
        return [
          { time: fmt(f.simulatedAt), title: '已收录' + f.type, detail: '仅保存在本机浏览器' },
        ];
      return [
        { at: f.simulatedAt, title: '收到反馈' },
        { at: f.simulatedAt + 18, title: '模拟受理' },
        { at: f.simulatedAt + 55, title: '模拟办结' },
      ]
        .filter(function (e) {
          return e.at <= now;
        })
        .map(function (e) {
          return { time: fmt(e.at), title: e.title, detail: '平台演示处理进展' };
        });
    }
    function clearMyFeedback() {
      return saveRecords([], []);
    }
    function feedbackStats() {
      var list = allFeedback(),
        rated = list.filter(function (f) {
          return Number.isFinite(f.rating);
        }),
        byType = {};
      FB_TYPES.forEach(function (t) {
        byType[t] = list.filter(function (f) {
          return f.type === t;
        }).length;
      });
      return {
        total: list.length,
        rated: rated.length,
        avg: rated.length
          ? rated.reduce(function (s, f) {
              return s + f.rating;
            }, 0) / rated.length
          : null,
        goodRate: rated.length
          ? rated.filter(function (f) {
              return f.rating >= 4;
            }).length / rated.length
          : null,
        open: list.filter(function (f) {
          return f.status !== 'done';
        }).length,
        byType: byType,
      };
    }
    function feedbackTargets() {
      return ['平台整体'].concat(
        POINTS.map(function (p) {
          return p.name;
        }),
        TRUCKS.map(function (t) {
          return t.code + ' 号车 · ' + t.name;
        }),
      );
    }
    function getSnapshot() {
      return {
        time: now,
        revision: revision,
        totalKg: totalKg,
        totalTrips: totalTrips,
        co2Kg: Math.round(totalKg * 0.3),
        alerts: POINTS.filter(function (p) {
          return p.fill >= 85;
        }).length,
        openOrders: visibleOrders().filter(function (o) {
          return orderStatus(o, now) !== 'done';
        }).length,
        points: POINTS.map(function (p) {
          return {
            id: p.id,
            name: p.name,
            pos: p.pos,
            fill: p.fill,
            kg: p.kg,
            times: p.times,
            last: p.last,
            status: statusOf(p),
            accuracy: accuracyOf(p),
          };
        }),
        trucks: TRUCKS.map(function (t) {
          var frac = lapFrac(t, now);
          return {
            id: t.id,
            code: t.code,
            name: t.name,
            plate: t.plate,
            color: t.color,
            kg: t.kg,
            trips: t.trips,
            pos: pointAt(t.path, t.cum, t.total, frac),
            frac: frac,
            next: nextStop(t, now),
            working: t.stops.some(function (s) {
              return Math.min(Math.abs(frac - s.frac), 1 - Math.abs(frac - s.frac)) < 0.012;
            }),
          };
        }),
        events: events.slice(),
        hourly: hourly.slice(),
        orders: visibleOrders().map(orderView),
        playback: Object.assign({}, playback),
        isolated: isolated,
      };
    }
    function setPlayback(p) {
      if (typeof p.playing === 'boolean') playback.playing = p.playing && now < DAY_END;
      if ([1, 4, 16].indexOf(Number(p.speed)) >= 0) playback.speed = Number(p.speed);
      if ('selected' in p) playback.selected = p.selected;
      if ('follow' in p) playback.follow = p.follow;
    }
    function saveTime() {
      if (isolated) return;
      try {
        session().setItem('qy-playhead', String(now));
        session().setItem(SESSION_KEY, JSON.stringify(Object.assign({ time: now }, playback)));
      } catch (_) {
        /* session is optional */
      }
    }
    function loadTime() {
      var n = read(session(), 'qy-playhead', null);
      return Number.isFinite(n) && n >= DAY_START && n <= DAY_END ? n : null;
    }
    function readTheme() {
      try {
        return local().getItem('qy-theme') === 'dark' ? 'dark' : 'light';
      } catch (_) {
        return 'light';
      }
    }
    function applyTheme(v) {
      v = v === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', v);
      try {
        local().setItem('qy-theme', v);
      } catch (_) {}
      return v;
    }
    function toggleTheme() {
      return applyTheme(
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark',
      );
    }
    function beginTour() {
      if (isolated) return;
      saveTime();
      tourBackup = { time: now, playback: clone(playback), userOrders: clone(userOrders) };
      isolated = true;
      userOrders = [];
      reset();
      setPlayback({ playing: false, follow: null, selected: { kind: 'point', id: 'P4' } });
      stepTo(380);
    }
    function endTour() {
      if (!isolated) return;
      var b = tourBackup;
      isolated = false;
      userOrders = b.userOrders;
      reset();
      stepTo(b.time);
      playback = b.playback;
      tourBackup = null;
      saveTime();
    }
    function tourMilestones() {
      // Discover milestones using the same engine, never a second set of display numbers.
      var old = now;
      stepTo(DAY_START);
      stepTo(480);
      var o = visibleOrders().find(function (x) {
        return x.pid === 'P4' && x.type === 'full';
      });
      var result = {
        before: o.at - 1,
        alert: o.at,
        assigned: o.assignedAt,
        done: o.doneAt,
        orderId: o.id,
      };
      stepTo(old);
      return result;
    }
    preparePaths();
    feedback = readArray(FB_KEY);
    userOrders = readArray(WO_KEY).filter(function (order) {
      // Feedback is the committed side of the two-key write. Ignore any orphan from an interrupted write.
      return feedback.some(function (f) {
        return f.orderId === order.id;
      });
    });
    reset();
    var saved = read(session(), SESSION_KEY, null);
    stepTo(
      saved && Number.isFinite(saved.time) ? saved.time : loadTime() != null ? loadTime() : 585,
    );
    if (saved) setPlayback(saved);
    var api = {
      CAMPUS: CAMPUS,
      CAMPUS_CENTER: CAMPUS_CENTER,
      POINTS: POINTS,
      TRUCKS: TRUCKS,
      DAY_START: DAY_START,
      DAY_END: DAY_END,
      MIN_PER_SEC: MIN_PER_SEC,
      CO2_PER_TON: 0.3,
      fmt: fmt,
      pseudo: pseudo,
      statusOf: statusOf,
      accuracyOf: accuracyOf,
      byId: byId,
      pointAt: pointAt,
      sliceTo: sliceTo,
      lapFrac: lapFrac,
      preparePaths: preparePaths,
      reset: reset,
      stepTo: stepTo,
      getNow: function () {
        return now;
      },
      getSnapshot: getSnapshot,
      getEvents: function () {
        return events.slice();
      },
      getHourly: function () {
        return hourly.slice();
      },
      getTotalKg: function () {
        return totalKg;
      },
      getTotalTrips: function () {
        return totalTrips;
      },
      getCo2Kg: function () {
        return Math.round(totalKg * 0.3);
      },
      alertCount: function () {
        return getSnapshot().alerts;
      },
      workingCount: function () {
        return getSnapshot().trucks.filter(function (t) {
          return t.working;
        }).length;
      },
      ORDERS_TEXT: ORDER_TEXT,
      FB_ROLES: FB_ROLES,
      FB_TYPES: FB_TYPES,
      FB_STATUS: FB_STATUS,
      orderStatus: orderStatus,
      getOrder: getOrder,
      getOrderTimeline: getOrderTimeline,
      ordersOf: function (pid) {
        return visibleOrders()
          .filter(function (o) {
            return o.pid === pid;
          })
          .map(orderView)
          .sort(function (a, b) {
            return b.at - a.at;
          });
      },
      recentOrders: function (n) {
        return visibleOrders()
          .map(orderView)
          .sort(function (a, b) {
            return b.at - a.at;
          })
          .slice(0, n || 10);
      },
      openOrderCount: function () {
        return getSnapshot().openOrders;
      },
      reportOrder: reportOrder,
      allFeedback: allFeedback,
      addFeedback: addFeedback,
      clearMyFeedback: clearMyFeedback,
      myFeedbackCount: function () {
        return feedback.length;
      },
      feedbackStats: feedbackStats,
      feedbackTargets: feedbackTargets,
      feedbackTimeline: feedbackTimeline,
      stamp: stamp,
      readTheme: readTheme,
      applyTheme: applyTheme,
      toggleTheme: toggleTheme,
      saveTime: saveTime,
      loadTime: loadTime,
      setPlayback: setPlayback,
      beginTour: beginTour,
      endTour: endTour,
      tourMilestones: tourMilestones,
      isTour: function () {
        return isolated;
      },
    };
    return api;
  }
  window.HUBU = createEngine({});
  window.HUBU.createDemoSession = function () {
    var engine = createEngine({ demo: true }),
      disposed = false;
    var milestones = engine.tourMilestones();
    engine.stepTo(milestones.before);
    return {
      milestones: milestones,
      seek: function (time) {
        if (!disposed) engine.stepTo(time);
        return engine.getSnapshot();
      },
      getSnapshot: function () {
        return engine.getSnapshot();
      },
      getOrderTimeline: function (id) {
        return engine.getOrderTimeline(id);
      },
      dispose: function () {
        disposed = true;
      },
    };
  };
})();
