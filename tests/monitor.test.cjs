const fs = require('fs'),
  assert = require('assert');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = (process.env.HUBU_ROOT || require('path').resolve(__dirname, '..')).replace(
  /\\/g,
  '/',
);
const results = [];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const ctx = await browser.newContext();
    await ctx.route('https://**/*', (r) => r.abort());
    await ctx.addInitScript(() => {
      if (!sessionStorage.getItem('qy-session-v2'))
        sessionStorage.setItem(
          'qy-session-v2',
          JSON.stringify({
            time: 750,
            playing: false,
            speed: 4,
            selected: { kind: 'point', id: 'P4' },
            follow: null,
          }),
        );
    });
    const page = await ctx.newPage();
    let errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [360, 800],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:8765/monitor.html');
      await page.locator('.monitor-bin').first().waitFor();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => HUBU.applyTheme(t), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('.main-nav a').count(), 4);
        for (const tab of ['投放监测', '暂存与环境', '治理建议']) {
          await page.locator(`.monitor-tabs [data-tab="${tab}"]`).click();
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.locator('.monitor-tabs [data-tab="投放监测"]').click();
        if (width === 1366 || width === 390)
          await page.screenshot({
            path: root + `/qa/monitor/${width}-${theme}.png`,
            fullPage: true,
          });
        results.push({ width, height, theme, overflow: false });
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.selectOption('#point', 'P2');
    const before = await page.evaluate(() =>
      JSON.stringify({
        time: HUBU.getNow(),
        play: HUBU.getSnapshot().playback,
        monitoring: HUBU.getSnapshot().monitoring,
        local: { ...localStorage },
      }),
    );
    await page.locator('#story-start').click();
    for (let i = 0; i < 5; i++) await page.locator('[data-story=next]').click();
    assert.equal(await page.locator('#story-body h3').textContent(), '查看治理建议');
    await page.locator('[data-story=restart]').click();
    await page.locator('[data-story=next]').click();
    await page.locator('[data-story=prev]').click();
    await page.locator('[data-story=exit]').click();
    assert.equal(
      await page.evaluate(() =>
        JSON.stringify({
          time: HUBU.getNow(),
          play: HUBU.getSnapshot().playback,
          monitoring: HUBU.getSnapshot().monitoring,
          local: { ...localStorage },
        }),
      ),
      before,
    );
    await page.locator('#story-start').click();
    await page.locator('[data-story=auto]').click();
    await page.waitForTimeout(29000);
    assert.equal(await page.locator('#story-body h3').textContent(), '查看治理建议');
    await page.locator('[data-story=exit]').click();
    const normal = await page.evaluate(() => ({
      time: HUBU.getNow(),
      stock: HUBU.monitoring('P2').stockKg,
    }));
    await page.locator('#dispatch-link').click();
    await page.waitForURL('**/detail.html?point=P2');
    await page.waitForFunction(() => !!window.HUBU);
    assert.equal(await page.evaluate(() => HUBU.getNow()), normal.time);
    assert.equal(await page.evaluate(() => HUBU.monitoring('P2').stockKg), normal.stock);
    await page.getByRole('link', { name: '投放与暂存', exact: true }).click();
    await page.locator('.monitor-bin').first().waitFor();
    assert.equal(await page.locator('#point').inputValue(), 'P2');
    await page.reload();
    await page.locator('.monitor-bin').first().waitFor();
    assert.equal(await page.evaluate(() => HUBU.getNow()), normal.time);
    await page.getByRole('button', { name: '原型与数据口径说明' }).click();
    assert(await page.locator('.prototype-dialog').isVisible());
    await page.getByRole('button', { name: '知道了' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#play').click();
    await page.waitForTimeout(500);
    assert((await page.evaluate(() => HUBU.getNow())) > normal.time);
    assert.deepEqual(errors, []);
    results.push({
      flow: 'manual-auto-story-restart-restore-cross-page-reload-reduced-motion-offline',
      passed: true,
    });
    fs.writeFileSync(root + '/qa/monitor/results.json', JSON.stringify(results, null, 2));
    console.log(
      'PASS monitor: 14 viewport/theme checks, all tabs, story controls and isolation, cross-page inventory, offline, reduced motion; no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
