const fs = require('fs'),
  assert = require('assert');
const root = process.env.HUBU_ROOT || require('path').resolve(__dirname, '..');
let pw;
try {
  pw = require('playwright');
} catch (_) {
  pw = require(process.env.PLAYWRIGHT_MODULE);
}
const out = root + '/qa/campus-model';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const errors = [],
    results = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://**/*', (r) => r.abort());
    for (const width of [1500, 768, 390])
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.goto('http://127.0.0.1:8765/detail.html');
        await page.evaluate((t) => {
          HUBU.setPlayback({ playing: false });
          document.documentElement.dataset.theme = t;
        }, theme);
        await page.locator('#toggle-panels').click();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('.model-landmark').count(), 6);
        assert.equal(await page.locator('.sports-track').count(), 1);
        assert.equal(await page.locator('.field-line').count(), 7);
        const ids = await page
          .locator('.model-landmark')
          .evaluateAll((es) => es.map((e) => e.dataset.model).sort());
        assert.deepEqual(ids, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('.scene-svg path[d*="NaN"]').count(), 0);
        await page.screenshot({ path: out + `/overview-${theme}-${width}.png` });
        await page.locator('[data-point=P5]').focus();
        await page.keyboard.press('Enter');
        await page.locator('#toggle-panels').click();
        await page.waitForTimeout(800);
        assert((await page.locator('#object-detail').innerText()).includes('运动场'));
        if (width !== 768) await page.screenshot({ path: out + `/sports-${theme}-${width}.png` });
        results.push({ width, theme, landmarks: 6, passed: true });
      }
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto('http://127.0.0.1:8765/index.html');
    const before = await page.evaluate(() => HUBU.getNow());
    await page.evaluate(() =>
      scrollTo(0, document.querySelector('#scroll-story').offsetHeight * 0.3),
    );
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => HUBU.getNow()), before);
    await page.screenshot({ path: out + '/home-story.png' });
    await page.goto('http://127.0.0.1:8765/detail.html');
    await page.locator('#follow-button').click();
    const perf = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let last = performance.now(),
            start = last,
            samples = [];
          function tick(t) {
            samples.push(t - last);
            last = t;
            if (t - start < 2000) requestAnimationFrame(tick);
            else {
              samples.sort((a, b) => a - b);
              resolve({ frames: samples.length, p95: samples[Math.floor(samples.length * 0.95)] });
            }
          }
          requestAnimationFrame(tick);
        }),
    );
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(
      out + '/results.json',
      JSON.stringify({ results, storyIsolation: true, errors, followFrameSample: perf }, null, 2),
    );
    console.log(
      'PASS',
      results.length,
      'model/theme/viewport combinations; story isolation; no JS errors',
      perf,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
