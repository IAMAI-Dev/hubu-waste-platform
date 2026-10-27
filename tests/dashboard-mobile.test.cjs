const fs = require('fs'),
  assert = require('assert');
const root = (process.env.HUBU_ROOT || require('path').resolve(__dirname, '..')).replace(
    /\\/g,
    '/',
  ),
  base = process.env.HUBU_BASE || 'http://127.0.0.1:8766/';
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || root + '/node_modules/playwright',
);
const out = root + '/qa/dashboard-mobile';
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [];
function pass(name, data = {}) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name);
}
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 640 },
      isMobile: true,
      hasTouch: true,
    });
    await ctx.addInitScript(() =>
      sessionStorage.setItem(
        'qy-session-v2',
        JSON.stringify({ time: 674, playing: false, speed: 1, selected: null, follow: null }),
      ),
    );
    const p = await ctx.newPage();
    p.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('ERROR', e.message);
    });
    await p.goto(base + 'detail.html');
    for (const [width, height] of [
      [320, 568],
      [360, 560],
      [390, 560],
      [390, 640],
      [390, 700],
      [390, 844],
      [430, 932],
      [667, 375],
      [844, 390],
    ]) {
      await p.setViewportSize({ width, height });
      for (const theme of ['light', 'dark']) {
        await p.evaluate((t) => HUBU.applyTheme(t), theme);
        await p.goto(base + 'detail.html');
        await p.locator('[data-view=trucks]').tap();
        await p.locator('#object-list [data-object=T2]').tap();
        await p.waitForTimeout(150);
        const geometry = await p.evaluate(() => {
          const rect = (s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
          };
          return {
            map: rect('#dashboard-map'),
            card: rect('.selection-peek'),
            toolbar: rect('.map-topline'),
            nav: rect('.main-nav'),
            overflow: document.documentElement.scrollWidth > innerWidth,
            pageHeight: document.documentElement.scrollHeight,
          };
        });
        assert(!geometry.overflow);
        if (width < 568) {
          assert(geometry.map.width >= width - 30, 'portrait map must use full width');
          if (height <= 700)
            assert(
              await p.locator('.metrics').isHidden(),
              'short screen prioritizes selected object',
            );
        }
        assert(geometry.pageHeight <= height + 1);
        assert(geometry.map.bottom <= geometry.card.y + 1, 'summary overlaps map');
        assert(geometry.map.height >= 120, 'map too short');
        assert(geometry.card.height <= 82);
        assert(geometry.card.bottom < geometry.nav.y);
        assert(await p.locator('.insight-panel:not(.sheet-expanded) .detail-body').isHidden());
        assert(await p.locator('.peek-main').isVisible());
        if (width === 390 && height === 640)
          await p.screenshot({ path: out + '/peek-' + theme + '.png' });
        await p.locator('.peek-main').tap();
        assert(await p.locator('.detail-header').isVisible());
        assert(await p.locator('.detail-body').isVisible());
        assert(
          (await p.locator('.insight-panel').boundingBox()).height > geometry.card.height + 40,
        );
        if (width === 390 && height === 640)
          await p.screenshot({ path: out + '/expanded-' + theme + '.png' });
        await p.locator('.insight-panel').evaluate((e) => (e.scrollTop = e.scrollHeight));
        await p.locator('[data-follow=T2]').tap();
        assert.equal(await p.evaluate(() => HUBU.getSnapshot().playback.follow), 'T2');
        await p.locator('.detail-header [data-sheet-toggle]').tap();
        assert(await p.locator('.peek-main').isVisible());
        await p.locator('.selection-peek [data-close-detail]').tap();
        assert(await p.locator('.metrics').isVisible());
        await p.locator('[data-view=charts]').tap();
        assert((await p.locator('#trend-chart').boundingBox()).width > 150);
        await p.locator('[data-view=map]').tap();
        await p.locator('#toggle-panels').tap();
        assert(await p.locator('.metrics').isHidden());
        await p.locator('#toggle-panels').tap();
        await p.locator('#timeline-toggle').tap();
        await p.locator('#time-slider').fill('750');
        assert.equal(await p.evaluate(() => HUBU.getNow()), 750);
        await p.locator('#timeline-toggle').tap();
        pass('truck summary, details and tools ' + width + 'x' + height + ' ' + theme, {
          mapHeight: geometry.map.height,
          cardHeight: geometry.card.height,
        });
      }
    }
    await p.setViewportSize({ width: 390, height: 640 });
    await p.goto(base + 'detail.html');
    await p.locator('[data-view=points]').tap();
    await p.locator('#object-list [data-object=P4]').tap();
    assert((await p.locator('.peek-copy').textContent()).includes('桃李园'));
    await p.locator('[data-view=charts]').tap();
    await p.locator('[data-view=map]').tap();
    assert(await p.locator('.selection-peek').isVisible());
    pass('selected point survives charts and returns as complete summary');
    await p.locator('#start-tour').tap();
    await p.locator('[data-tour=next]').tap();
    await p.locator('[data-tour=next]').tap();
    await p.locator('[data-tour=exit]').tap();
    assert.equal(await p.evaluate(() => HUBU.isTour()), false);
    pass('compact toolbar retains tour controls');
    await p.locator('.selection-peek [data-close-detail]').tap();
    await p.locator('[data-map-mode=geo]').tap();
    await p.locator('#dashboard-map.has-real-map').waitFor({ timeout: 25000 });
    await p.locator('[data-view=trucks]').tap();
    await p.locator('#object-list [data-object=T2]').tap();
    await p.waitForTimeout(700);
    assert.equal(await p.locator('.amap-truck').count(), 3);
    assert((await p.locator('.amap-truck.selected').count()) === 1);
    await p.screenshot({ path: out + '/amap-peek.png' });
    pass('online AMap survives resized selection space');
    await p.setViewportSize({ width: 1366, height: 768 });
    await p.waitForTimeout(200);
    assert(await p.locator('.dashboard-heading #start-tour').isVisible());
    assert(await p.locator('.selection-peek').isHidden());
    assert(await p.locator('.detail-header').isVisible());
    pass('desktop controls restore after orientation and breakpoint changes');
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/results.json', JSON.stringify({ results, errors }, null, 2));
    console.log('PASS dashboard-focused acceptance');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
