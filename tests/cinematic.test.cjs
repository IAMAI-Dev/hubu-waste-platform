const fs = require('fs'),
  assert = require('assert'),
  path = require('path');
let pw;
try {
  pw = require('playwright');
} catch (_) {
  pw = require(
    process.env.PLAYWRIGHT_MODULE ||
      process.env.TEMP + '/qinyuan-browser-qa/node_modules/playwright',
  );
}
const root = process.env.HUBU_ROOT || path.resolve(__dirname, '..'),
  out = path.join(root, 'qa', 'cinematic');
fs.mkdirSync(out, { recursive: true });
const results = [],
  errors = [];
function pass(name, data = {}) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name, data);
}
(async () => {
  const browser = await pw.chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    for (const mobile of [false, true]) {
      const width = mobile ? 390 : 1366,
        height = mobile ? 844 : 768;
      const context = await browser.newContext({
        viewport: { width, height },
        recordVideo: { dir: out, size: { width, height } },
      });
      await context.route('https://**/*', (r) => r.abort());
      await context.addInitScript(() => {
        if (!sessionStorage.getItem('qy-session-v2'))
          sessionStorage.setItem(
            'qy-session-v2',
            JSON.stringify({ time: 585, playing: false, speed: 4, selected: null, follow: null }),
          );
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/index.html');
      await page.waitForTimeout(900);
      const before = await page.evaluate(() => ({
        s: JSON.stringify(HUBU.getSnapshot()),
        local: JSON.stringify(localStorage),
        session: JSON.stringify(sessionStorage),
      }));
      await page.evaluate(() => {
        const a = HUBU.createDemoSession(),
          b = HUBU.createDemoSession();
        window.demoProof = { initial: b.getSnapshot().time };
        a.seek(a.milestones.done);
        window.demoProof.other = b.getSnapshot().time;
        window.demoProof.order = a.getOrderTimeline(a.milestones.orderId);
        a.seek(a.milestones.before);
        a.seek(a.milestones.done);
        window.demoProof.final = JSON.stringify(a.getSnapshot());
        const c = HUBU.createDemoSession();
        c.seek(c.milestones.done);
        window.demoProof.direct = JSON.stringify(c.getSnapshot());
        a.dispose();
        b.dispose();
        c.dispose();
      });
      const proof = await page.evaluate(() => demoProof);
      assert.equal(proof.initial, proof.other);
      // revision counts may differ; compare business output only.
      const a = JSON.parse(proof.final),
        b = JSON.parse(proof.direct);
      for (const key of ['totalKg', 'totalTrips', 'events', 'orders', 'points'])
        assert.deepEqual(a[key], b[key]);
      let previous = 0;
      for (const [name, progress] of [
        ['opening', 0],
        ['alert', 0.29],
        ['assignment', 0.43],
        ['arrival', 0.7],
        ['result', 0.85],
        ['finale', 0.99],
      ]) {
        const target = await page.evaluate((p) => {
          const el = document.getElementById('scroll-story');
          return el.offsetTop + p * (el.offsetHeight - innerHeight);
        }, progress);
        const steps = 24;
        for (let n = 1; n <= steps; n++) {
          await page.evaluate(
            (y) => window.scrollTo(0, y),
            previous + ((target - previous) * n) / steps,
          );
          await page.waitForTimeout(25);
        }
        previous = target;
        await page.waitForTimeout(550);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        if (progress === 0.85)
          assert((await page.locator('#story-fact').innerText()).includes('工单已办结'));
        await page.screenshot({ path: path.join(out, `home-${name}-${width}.png`) });
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        s: JSON.stringify(HUBU.getSnapshot()),
        local: JSON.stringify(localStorage),
        session: JSON.stringify(sessionStorage),
      }));
      assert.deepEqual(after, before);
      pass(`scroll story reversible and independent ${width}`, { demoIsolation: true });
      await page.goto('http://127.0.0.1:8765/detail.html');
      await page.waitForTimeout(1000);
      await page.locator('[data-view=points]').click();
      await page.locator('#object-list [data-object=P4]').click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(out, `dashboard-focus-${width}.png`) });
      await page.getByRole('button', { name: '收起详情' }).click();
      await page.locator('[data-view=trucks]').click();
      await page.locator('#object-list [data-object=T2]').click();
      await page.getByRole('button', { name: '跟随这辆车', exact: true }).click();
      await page.waitForTimeout(800);
      await page.locator('#toggle-panels').click();
      await page.locator('#play-button').click();
      await page.waitForTimeout(2000);
      assert.equal(await page.evaluate(() => HUBU.getSnapshot().playback.follow), 'T2');
      await page.screenshot({ path: path.join(out, `dashboard-follow-${width}.png`) });
      await page.locator('#play-button').click();
      await page.locator('#toggle-panels').click();
      if (mobile) await page.locator('#timeline-toggle').click();
      await page.locator('#time-slider').fill('390');
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.data-flight').count(), 0);
      await page.locator('[data-speed="1"]').click();
      await page.locator('#play-button').click();
      await page.waitForTimeout(800);
      await page.locator('#play-button').click();
      pass(`immersive selection, following and scrub ${width}`);
      await page.evaluate(() => HUBU.setPlayback({ playing: false }));
      await page.goto('http://127.0.0.1:8765/feedback.html?point=P4');
      await page.locator('#feedback-text').fill('动效验收：桃李园投放点周边需要清理。');
      await page.locator('#feedback-issue').selectOption('dirty');
      await page.locator('button[type=submit]').click();
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('.feedback-card.mine').count(), 1);
      await page.screenshot({ path: path.join(out, `feedback-saved-${width}.png`) });
      await context.close();
      await page.video().saveAs(path.join(out, `walkthrough-${width}.webm`));
      await page.video().delete();
    }
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8765/index.html');
    assert.equal(await page.locator('.story-static article').count(), 4);
    assert(await page.locator('.story-static').isVisible());
    assert.equal(
      await page.locator('.story-stage').evaluate((el) => getComputedStyle(el).position),
      'relative',
    );
    await page.screenshot({ path: path.join(out, 'reduced-motion.png'), fullPage: true });
    pass('reduced motion exposes four static chapters');
    assert.equal(errors.length, 0, errors.join('\n'));
    pass('no cinematic browser exceptions');
    await context.close();
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
