const fs = require('fs'),
  assert = require('assert'),
  path = require('path');
const root = process.env.HUBU_ROOT || path.resolve(__dirname, '..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const base = process.env.HUBU_BASE || 'http://127.0.0.1:8767/';
const out = process.env.HUBU_QA_OUT || path.join(root, 'qa', 'home-touch');
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [];
async function swipe(page, cdp, x, y, delta) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + (delta * i) / 12, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(450);
}
function pass(name, data = {}) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name);
}
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 760 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    for (const [width, height] of [
      [320, 568],
      [390, 640],
      [390, 760],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1024, 768],
    ]) {
      await p.setViewportSize({ width, height });
      await p.goto(base + 'index.html');
      await p.waitForTimeout(700);
      const before = await p.evaluate(() => JSON.stringify(HUBU.getSnapshot().playback));
      const y = await p.evaluate(() => {
        const scene = document.querySelector('#home-campus').getBoundingClientRect(),
          nav = document.querySelector('.main-nav').getBoundingClientRect();
        const bottom = nav.top > innerHeight * 0.6 ? nav.top : innerHeight;
        return Math.min(scene.bottom - 80, bottom - 80);
      });
      await swipe(p, cdp, width * 0.82, y, -160);
      const moved = await p.evaluate(() => scrollY);
      assert(moved > 80, 'right-hand swipe blocked at ' + width + 'x' + height + ': ' + moved);
      assert(p.url().includes('index.html'), 'swipe navigated away');
      await swipe(p, cdp, width * 0.82, y - 140, 140);
      assert((await p.evaluate(() => scrollY)) < moved - 50, 'downward swipe blocked');
      await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await p.waitForTimeout(250);
      const targets = await p
        .locator('#home-campus .scene-truck, #home-campus .scene-point')
        .evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }),
        );
      let taps = 0;
      for (const t of targets)
        if (t.x > 10 && t.x < width - 10 && t.y > 150 && t.y < y + 20) {
          await p.touchscreen.tap(t.x, t.y);
          taps++;
          assert(p.url().includes('index.html'), 'marker tap navigated away');
        }
      assert(taps > 0, 'no model markers exercised');
      assert.equal(
        await p.evaluate(() => JSON.stringify(HUBU.getSnapshot().playback)),
        before,
        'story changed shared playback',
      );
      pass('native two-way scroll and harmless marker taps ' + width + 'x' + height, {
        scrolled: moved,
        taps,
      });
      if (width === 390 && height === 760)
        await p.screenshot({ path: path.join(out, 'home-mobile.png') });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + 'index.html');
    await p.locator('.story-chapters [data-chapter="3"]').tap();
    await p.waitForTimeout(900);
    assert.equal(
      await p.locator('.story-chapters [aria-current="step"]').getAttribute('data-chapter'),
      '3',
    );
    pass('story chapter controls still animate the campus');
    await p.goto(base + 'index.html');
    await p.getByRole('link', { name: '进入清运看板', exact: true }).tap();
    await p.waitForURL('**/detail.html');
    assert(await p.locator('#dashboard-map').isVisible());
    pass('explicit hero button enters dashboard');
    await p.goto(base + 'index.html');
    await p.locator('.main-nav a[href="detail.html"]').tap();
    await p.waitForURL('**/detail.html');
    pass('bottom navigation enters dashboard');
    await p.goto(base + 'index.html');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    assert(await p.locator('.story-static').isVisible());
    await swipe(p, cdp, 320, 540, -150);
    assert((await p.evaluate(() => scrollY)) > 50);
    pass('reduced-motion home retains native scrolling');
    const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } }),
      d = await desktop.newPage();
    d.on('pageerror', (e) => errors.push(e.message));
    await d.goto(base + 'index.html');
    await d.waitForTimeout(800);
    await d.locator('#home-campus .scene-truck[data-truck="T3"]').click();
    await d.waitForURL('**/detail.html?truck=T3');
    assert.equal(await d.evaluate(() => HUBU.getSnapshot().playback.selected.id), 'T3');
    pass('desktop model marker still opens matching vehicle');
    await d.goto(base + 'index.html');
    await d.setViewportSize({ width: 768, height: 1024 });
    assert(await d.locator('#home-campus').evaluate((e) => e.inert));
    await d.setViewportSize({ width: 1366, height: 768 });
    assert(await d.locator('#home-campus').evaluate((e) => !e.inert));
    pass('resizing restores desktop model interaction');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'results.json'),
      JSON.stringify({ results, errors }, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
