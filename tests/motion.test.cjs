const fs = require('fs'),
  assert = require('assert');
let pw;
try {
  pw = require('playwright');
} catch (_) {
  pw = require(
    process.env.PLAYWRIGHT_MODULE ||
      process.env.TEMP + '/qinyuan-browser-qa/node_modules/playwright',
  );
}
const { chromium } = pw;
const root =
    (process.env.HUBU_ROOT || require('path').resolve(__dirname, '..')).replace(/\\/g, '/') + '/',
  results = [];
function pass(name, data) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name, data || '');
}
(async () => {
  const b = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const c = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await c.route('https://**/*', (r) => r.abort());
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:8765/detail.html');
    await p.locator('#play-button').click();
    await p.locator('#time-slider').fill('600');
    await p.locator('#start-tour').click();
    await p.locator('[data-tour=auto]').click();
    await p.waitForTimeout(18500);
    assert((await p.locator('#tour-panel h2').innerText()).includes('处置结果'));
    await p.screenshot({ path: root + 'qa/story-desktop-result.png' });
    await p.locator('.tour-actions [data-tour=exit]').click();
    assert.equal(await p.evaluate(() => HUBU.getNow()), 600);
    pass('automatic story reaches actual arrival and restores free playback');
    await p.locator('#play-button').click();
    const perf = await p.evaluate(
      () =>
        new Promise((resolve) => {
          let prev = performance.now(),
            start = prev,
            times = [];
          function f(ts) {
            times.push(ts - prev);
            prev = ts;
            if (ts - start < 3000) requestAnimationFrame(f);
            else {
              times.sort((a, b) => a - b);
              resolve({
                frames: times.length,
                medianMs: times[Math.floor(times.length * 0.5)],
                p95Ms: times[Math.floor(times.length * 0.95)],
                over50ms: times.filter((t) => t > 50).length,
              });
            }
          }
          requestAnimationFrame(f);
        }),
    );
    pass('3 second active map animation sampling', perf);
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const paused = await p.evaluate(() => HUBU.getNow());
    await p.waitForTimeout(600);
    assert.equal(await p.evaluate(() => HUBU.getNow()), paused);
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await p.waitForTimeout(100);
    const resumed = await p.evaluate(() => HUBU.getNow());
    assert(resumed - paused < 2);
    pass('background visibility event freezes time without catch-up');
    await p.locator('a[href="feedback.html"]').first().click();
    await p.waitForFunction(() => !!window.HUBU);
    const stored = await p.evaluate(() => JSON.parse(sessionStorage.getItem('qy-session-v2')));
    assert(stored.playing);
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => HUBU.getNow()), stored.time);
    await p.locator('a[href="detail.html"]').first().click();
    await p.waitForFunction(() => !!window.HUBU);
    assert(await p.evaluate(() => HUBU.getSnapshot().playback.playing));
    pass('navigation retains playing flag and freezes time on feedback page');
    await p.evaluate(() => {
      HUBU.setPlayback({ playing: false });
      HUBU.stepTo(1200);
    });
    await p.waitForTimeout(350);
    await p.getByRole('button', { name: '重新播放' }).click();
    assert(await p.evaluate(() => HUBU.getNow() < 370));
    pass('20:00 stops and replay restarts from 06:00');
    await p.evaluate(() => HUBU.setPlayback({ playing: false }));
    await p.locator('.keep-schematic').click();
    assert((await p.locator('.map-note').innerText()).includes('本地校园示意图'));
    await c.setOffline(true);
    await p.locator('[data-point=P4]').focus();
    await p.keyboard.press('Enter');
    assert((await p.locator('#object-detail').innerText()).includes('桃李园'));
    await p.locator('#time-slider').fill('720');
    assert.equal(await p.evaluate(() => HUBU.getNow()), 720);
    pass('offline schematic retains point selection and replay');
  } finally {
    fs.writeFileSync(root + 'qa/motion-results.json', JSON.stringify(results, null, 2));
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
