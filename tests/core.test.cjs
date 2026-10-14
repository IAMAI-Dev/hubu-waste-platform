const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
const root =
  (process.env.HUBU_ROOT || require('path').resolve(__dirname, '..')).replace(/\\/g, '/') + '/';
function storage(initial = {}) {
  return {
    data: { ...initial },
    fail: false,
    getItem(k) {
      return this.data[k] ?? null;
    },
    setItem(k, v) {
      if (this.fail) throw Error('quota');
      this.data[k] = String(v);
    },
    removeItem(k) {
      delete this.data[k];
    },
  };
}
function boot(local = storage(), session = storage()) {
  const c = {
    console,
    window: { localStorage: local, sessionStorage: session },
    document: {
      documentElement: {
        setAttribute() {},
        getAttribute() {
          return 'light';
        },
      },
    },
  };
  vm.createContext(c);
  for (const f of ['routes.js', 'seed-data.js', 'core.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), c);
  return c.window.HUBU;
}
function state(h) {
  const s = h.getSnapshot();
  return JSON.stringify({
    kg: s.totalKg,
    trips: s.totalTrips,
    points: s.points,
    events: s.events,
    orders: s.orders,
    hourly: s.hourly,
  });
}
const results = [];
function test(name, fn) {
  fn();
  results.push({ name, passed: true });
  console.log('PASS', name);
}
test('30/60/120 fps and 1/4/16 speed produce identical business snapshots', () => {
  for (const end of [595, 720, 1200]) {
    const base = boot();
    base.stepTo(end);
    const expected = state(base);
    for (const fps of [30, 60, 120])
      for (const speed of [1, 4, 16]) {
        const h = boot();
        h.stepTo(360);
        for (let t = 360; t < end; t += (10 * speed) / fps) h.stepTo(Math.min(end, t));
        h.stepTo(end);
        assert.equal(state(h), expected);
      }
  }
});
test('rewind removes future records and replay never double counts', () => {
  const h = boot();
  h.stepTo(1200);
  const expected = state(h);
  h.stepTo(360);
  assert.equal(h.getSnapshot().orders.length, 0);
  assert.equal(h.getEvents().length, 0);
  h.stepTo(600.4);
  assert(h.getEvents().every((e) => e.at <= 600.4));
  assert(h.recentOrders(999).every((o) => o.at <= 600.4));
  h.stepTo(1200);
  assert.equal(state(h), expected);
  assert.equal(h.getSnapshot().playback.playing, false);
});
test('feedback merges open overflow order, completes at real collection and survives reload', () => {
  const l = storage(),
    session = storage(),
    h = boot(l, session);
  h.stepTo(382);
  const a = h.addFeedback({
    type: '问题反馈',
    targetId: 'P4',
    issueType: 'full',
    text: '桃李园垃圾满溢，请及时收运。',
  });
  assert(a.ok);
  const b = h.reportOrder('P4', 'full');
  assert(b.ok);
  assert.equal(a.orderId, b.orderId);
  const o = h.getOrder(a.orderId);
  h.stepTo(o.doneAt);
  assert.equal(h.getOrder(o.id).status, 'done');
  assert(h.getEvents().some((e) => e.pid === 'P4' && e.at === o.doneAt));
  assert.equal(h.allFeedback().find((f) => f.id === a.id).status, 'done');
  h.saveTime();
  const fresh = boot(l, session);
  assert.equal(fresh.getOrder(o.id).status, 'done');
  assert.equal(fresh.allFeedback().find((f) => f.id === a.id).text, '桃李园垃圾满溢，请及时收运。');
});
test('generic issues use 18/55 minute demo progress; suggestions and praise create no orders', () => {
  const h = boot();
  h.stepTo(600);
  const a = h.addFeedback({
    targetId: 'P3',
    type: '问题反馈',
    issueType: 'broken',
    text: '这里的垃圾桶盖损坏了。',
    rating: null,
  });
  assert(a.ok);
  h.stepTo(617);
  assert.equal(h.getOrder(a.orderId).status, 'pending');
  h.stepTo(618);
  assert.equal(h.getOrder(a.orderId).status, 'doing');
  h.stepTo(655);
  assert.equal(h.getOrder(a.orderId).status, 'done');
  for (const type of ['建议', '表扬'])
    assert.equal(
      h.addFeedback({ targetId: 'P4', type, text: '建议增加更清晰的分类说明。' }).orderId,
      null,
    );
  for (const targetId of ['platform', 'T2'])
    assert(
      h.addFeedback({
        targetId,
        target: targetId === 'T2' ? '2 号车 · 南线清运线' : '平台整体',
        text: '非常感谢工作人员的辛勤劳动。',
      }).ok,
    );
});
test('tour isolation restores time speed selection follow and local data', () => {
  const l = storage(),
    h = boot(l);
  h.addFeedback({ targetId: 'P4', text: '周围垃圾需要及时处理。' });
  h.setPlayback({ playing: false, speed: 16, selected: { kind: 'truck', id: 'T3' }, follow: 'T3' });
  const before = state(h),
    play = JSON.stringify(h.getSnapshot().playback),
    stored = JSON.stringify(l.data),
    time = h.getNow();
  h.beginTour();
  const m = h.tourMilestones();
  assert(m.done > m.alert);
  h.stepTo(m.done);
  assert.equal(h.getOrder(m.orderId).status, 'done');
  assert.equal(h.reportOrder('P4', 'full').ok, false);
  h.endTour();
  assert.equal(h.getNow(), time);
  assert.equal(state(h), before);
  assert.equal(JSON.stringify(h.getSnapshot().playback), play);
  assert.equal(JSON.stringify(l.data), stored);
});
test('legacy feedback preserved without inferred orders; unrated excluded; failed storage never reports success', () => {
  const legacy = {
    id: 'old',
    text: '历史内容🙂 原样保留',
    time: '10-01 08:00',
    reply: '历史回复',
    type: '问题反馈',
    target: '桃李园食堂',
    status: 'pending',
    rating: null,
    mine: true,
  };
  const l = storage({ 'qy-feedback': JSON.stringify([legacy]) }),
    h = boot(l);
  const f = h.allFeedback().find((x) => x.id === 'old');
  assert.equal(f.text, legacy.text);
  assert(!f.orderId);
  const total = h.feedbackStats().rated;
  l.fail = true;
  assert.equal(h.addFeedback({ targetId: 'P4', text: '不应该被保存的反馈内容。' }).ok, false);
  assert.equal(h.myFeedbackCount(), 1);
  assert.equal(h.feedbackStats().rated, total);
  l.fail = false;
  assert(h.clearMyFeedback().ok);
  assert.equal(h.myFeedbackCount(), 0);
  assert.equal(h.allFeedback().length, 8);
});
test('fractional boundary never exposes the next minute event', () => {
  const h = boot();
  h.stepTo(1200);
  const at = h.getEvents()[10].at;
  h.stepTo(at - 1e-9);
  assert(h.getEvents().every((e) => e.at <= h.getNow()));
  h.stepTo(at);
  assert(h.getEvents().some((e) => e.at === at));
});
test('reload ignores an orphan work order from an interrupted two-key write', () => {
  const l = storage({
    'qy-work-orders-v2': JSON.stringify([
      { id: 'UO-orphan', pid: 'P4', type: 'dirty', at: 400, src: '本机反馈' },
    ]),
  });
  const h = boot(l);
  assert.equal(h.getOrder('UO-orphan'), null);
});
test('independent demo engines preserve populated storage and normal playback', () => {
  const local = storage(),
    session = storage(),
    h = boot(local, session);
  const feedback = h.addFeedback({
    targetId: 'P4',
    type: '问题反馈',
    issueType: 'dirty',
    text: '保留这条真实本机提交用于隔离测试。',
  });
  assert(feedback.ok);
  h.setPlayback({ playing: false, speed: 16, selected: { kind: 'truck', id: 'T2' }, follow: 'T2' });
  h.saveTime();
  const original = JSON.stringify(h.getSnapshot()),
    localBefore = JSON.stringify(local.data),
    sessionBefore = JSON.stringify(session.data);
  const a = h.createDemoSession(),
    b = h.createDemoSession(),
    initial = b.getSnapshot().time;
  a.seek(a.milestones.done);
  assert.equal(b.getSnapshot().time, initial);
  assert(!a.getSnapshot().orders.some((o) => o.id === feedback.orderId));
  a.seek(a.milestones.before);
  a.seek(a.milestones.done);
  b.seek(b.milestones.done);
  assert.equal(state(a), state(b));
  a.dispose();
  const ended = a.getSnapshot().time;
  a.seek(1200);
  assert.equal(a.getSnapshot().time, ended);
  assert.equal(JSON.stringify(h.getSnapshot()), original);
  assert.equal(JSON.stringify(local.data), localBefore);
  assert.equal(JSON.stringify(session.data), sessionBefore);
});
fs.writeFileSync(root + 'qa/core-results.json', JSON.stringify(results, null, 2));
