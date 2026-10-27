const fs = require('fs'),
  assert = require('assert');
const root = (process.env.HUBU_ROOT || require('path').resolve(__dirname, '..')).replace(
  /\\/g,
  '/',
);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || root + '/node_modules/playwright',
);
const base = process.env.HUBU_BASE || 'http://127.0.0.1:8766/',
  out = root + '/qa/mobile';
const results = [],
  errors = [];
function pass(name, data = {}) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name);
}
async function unobstructed(p, selector) {
  const e = p.locator(selector).first();
  await e.scrollIntoViewIfNeeded();
  assert(
    await e.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!t && (el.contains(t) || t.contains(el));
    }),
    selector + ' obstructed',
  );
}
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('qy-session-v2'))
        sessionStorage.setItem(
          'qy-session-v2',
          JSON.stringify({ time: 585, playing: false, speed: 1, selected: null, follow: null }),
        );
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('PAGEERROR', e.message);
    });
    await p.goto(base);
    if (!process.env.MOBILE_FLOW_ONLY)
      for (const [w, h] of [
        [320, 568],
        [360, 640],
        [360, 800],
        [375, 667],
        [390, 844],
        [412, 915],
        [430, 932],
        [667, 375],
        [844, 390],
        [932, 430],
      ]) {
        await p.setViewportSize({ width: w, height: h });
        for (const theme of ['light', 'dark']) {
          await p.evaluate((t) => HUBU.applyTheme(t), theme);
          for (const file of ['index', 'detail', 'monitor', 'feedback']) {
            await p.goto(base + file + '.html');
            await p.waitForTimeout(100);
            assert(
              await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              file + ' horizontal overflow ' + w + ' ' + h,
            );
            const nav = await p.locator('.main-nav').boundingBox();
            assert(nav.y + nav.height <= h + 1 && nav.y >= 0);
            if (file === 'detail') {
              assert(
                await p.evaluate(
                  () => document.documentElement.scrollHeight <= innerHeight + 1,
                ),
                'dashboard must fit screen ' + w + 'x' + h,
              );
              await unobstructed(p, '#play-button');
              await unobstructed(p, '[data-view=points]');
              assert(
                (await p.locator('.workspace').boundingBox()).height >= 90,
                'map workspace too small',
              );
            }
            if (w === 390) {
              await p.screenshot({
                path: out + '/' + file + '-' + theme + '.png',
                fullPage: file === 'monitor' || file === 'feedback',
              });
            }
          }
          pass('four pages ' + w + 'x' + h + ' ' + theme);
        }
      }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + 'index.html');
    for (let i = 0; i < 5; i++) {
      await p.locator('.story-chapters [data-chapter="' + i + '"]').tap();
      await p.waitForTimeout(750);
      assert.equal(
        await p.locator('.story-chapters [aria-current=step]').getAttribute('data-chapter'),
        String(i),
      );
    }
    await p.getByRole('link', { name: '投放与暂存', exact: true }).tap();
    await p.waitForURL('**/monitor.html');
    await p.locator('.monitor-bin').first().waitFor();
    await p.goBack({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(300);
    await p.locator('.story-chapters [data-chapter="0"]').tap();
    await p.waitForTimeout(700);
    assert.equal(
      await p.locator('.story-chapters [aria-current=step]').getAttribute('data-chapter'),
      '0',
    );
    pass('touch chapter navigation and browser back retain the scrolling story');
    await p.goto(base + 'detail.html');
    await p.locator('[data-view=points]').tap();
    await p.locator('#object-list [data-object=P4]').tap();
    const collapsed = await p.locator('.insight-panel').boundingBox();
    await unobstructed(p, '[data-sheet-toggle]');
    await p.locator('[data-sheet-toggle]').tap();
    const expanded = await p.locator('.insight-panel').boundingBox();
    assert(expanded.height > collapsed.height + 30);
    await p.screenshot({ path: out + '/detail-expanded.png' });
    await p.locator('[data-close-detail]').tap();
    await p.locator('#timeline-toggle').tap();
    await unobstructed(p, '#time-slider');
    await p.locator('#time-slider').fill('750');
    assert.equal(await p.evaluate(() => HUBU.getNow()), 750);
    await p.locator('#timeline-toggle').tap();
    await p.locator('[data-speed="16"]').tap();
    assert.equal(await p.evaluate(() => HUBU.getSnapshot().playback.speed), 16);
    await p.locator('[data-view=charts]').tap();
    assert((await p.locator('#trend-chart').boundingBox()).width > 200);
    await p.locator('[data-view=records]').tap();
    await p.locator('#record-rows [data-object]').first().tap();
    assert(await p.locator('.workspace').evaluate((e) => e.dataset.view === 'map'));
    await p.locator('[data-close-detail]').tap();
    pass('point sheet, timeline, speed, charts and record navigation');
    await p.locator('#follow-button').tap();
    await p.locator('[data-close-detail]').tap();
    assert(await p.evaluate(() => !!HUBU.getSnapshot().playback.follow));
    const cdp = await ctx.newCDPSession(p);
    const r = await p.locator('#dashboard-map').boundingBox();
    const x = r.x + 20,
      y = r.y + 20;
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 45, y: y + 30, id: 1 }],
    });
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => HUBU.getSnapshot().playback.follow), null);
    const before = await p.locator('.terrain-top').getAttribute('d'),
      cx = r.x + r.width / 2,
      cy = r.y + r.height * 0.15;
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: cx - 35, y: cy, id: 1 },
        { x: cx + 35, y: cy, id: 2 },
      ],
    });
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: cx - 75, y: cy, id: 1 },
        { x: cx + 75, y: cy, id: 2 },
      ],
    });
    await p.waitForTimeout(70);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(200);
    assert.notEqual(await p.locator('.terrain-top').getAttribute('d'), before);
    pass('touch drag exits follow and two-finger pinch changes map camera');
    await p.locator('#toggle-panels').tap();
    assert(await p.locator('.metrics').isHidden());
    await p.locator('#toggle-panels').tap();
    assert(await p.locator('.metrics').isVisible());
    await p.locator('#start-tour').tap();
    await unobstructed(p, '[data-tour=next]');
    await p.locator('[data-tour=next]').tap();
    await p.locator('[data-tour=next]').tap();
    await p.locator('[data-tour=exit]').tap();
    assert.equal(await p.evaluate(() => HUBU.isTour()), false);
    pass('focused map and mobile tour controls');
    await p.goto(base + 'monitor.html');
    assert.equal(await p.locator('#campus-map-disclosure').getAttribute('open'), null);
    await p.locator('#campus-map-disclosure summary').tap();
    assert(await p.locator('#monitor-campus').isVisible());
    await p.selectOption('#point', 'P2');
    await p.selectOption('[data-hour-select]', '5');
    assert.equal(await p.evaluate(() => HUBU.getNow()), 719);
    await p.locator('.monitor-tabs [data-tab="暂存与环境"]').tap();
    await p.locator('.monitor-tabs [data-tab="治理建议"]').tap();
    await p.locator('#story-start').tap();
    for (let i = 0; i < 5; i++) await p.locator('[data-story=next]').tap();
    await p.locator('[data-story=exit]').tap();
    assert.equal(await p.locator('#point').inputValue(), 'P2');
    assert.equal(await p.evaluate(() => HUBU.getNow()), 719);
    pass('monitor disclosure, hour picker, tabs and six-act story restore');
    await p.goto(base + 'feedback.html?point=P4');
    await p.locator('#feedback-text').fill('手机端反馈：桃李园投放点周边需要及时清洁。');
    await p.locator('#feedback-text').focus();
    await p.setViewportSize({ width: 390, height: 500 });
    await p.waitForTimeout(100);
    assert(await p.locator('body').evaluate((e) => e.classList.contains('keyboard-open')));
    assert(await p.locator('.main-nav').isHidden());
    await p.setViewportSize({ width: 390, height: 300 });
    await p.waitForTimeout(100);
    assert(await p.locator('.main-nav').isHidden());
    assert.equal(
      await p
        .locator('.site-header')
        .evaluate((e) => Math.round(e.getBoundingClientRect().height)),
      60,
    );
    await p.locator('#feedback-text').blur();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('.submit-button').tap();
    assert(await p.locator('.feedback-results').isVisible());
    assert((await p.locator('.feedback-card.mine').count()) > 0);
    await p.screenshot({ path: out + '/feedback-submitted.png' });
    pass('keyboard viewport reduction and touch feedback submission');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(base + 'index.html');
    assert(await p.locator('.story-static').isVisible());
    await p.goto(base + 'detail.html');
    await p.locator('[data-view=points]').tap();
    await p.locator('#object-list [data-object=P4]').tap();
    assert(await p.locator('[data-sheet-toggle]').isVisible());
    pass('reduced-motion retains story and full controls');
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.evaluate(() => HUBU.applyTheme('light'));
    await p.goto(base + 'detail.html');
    await p.locator('[data-map-mode=geo]').tap();
    await p.locator('#dashboard-map.has-real-map').waitFor({ timeout: 25000 });
    assert.equal(await p.locator('.amap-point').count(), 6);
    assert.equal(await p.locator('.amap-truck').count(), 3);
    if (await p.locator('[data-close-detail]').isVisible())
      await p.locator('[data-close-detail]').tap();
    await p.waitForTimeout(1000);
    await p.screenshot({ path: out + '/amap-phone.png' });
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: out + '/amap-landscape.png' });
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    pass('online AMap renders six points and three vehicles on phone and landscape');
    assert.deepEqual(errors, []);
    fs.writeFileSync(out + '/results.json', JSON.stringify({ results, errors }, null, 2));
    console.log('PASS all mobile acceptance flows');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
