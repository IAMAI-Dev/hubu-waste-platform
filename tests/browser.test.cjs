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
  base = 'http://127.0.0.1:8765/';
const results = [],
  errors = [];
function pass(name, data = {}) {
  results.push({ name, passed: true, ...data });
  console.log('PASS', name);
}
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await context.route('https://**/*', (r) => r.abort());
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('qy-session-v2'))
        sessionStorage.setItem(
          'qy-session-v2',
          JSON.stringify({ time: 585, playing: false, speed: 1, selected: null, follow: null }),
        );
    });
    const page = await context.newPage();
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
      for (const file of ['index', 'detail', 'feedback']) {
        await page.goto(base + file + '.html');
        await page.waitForTimeout(220);
        const dims = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert(dims.scroll <= width, `${file} overflow at ${width}: ${dims.scroll}`);
        pass(`${file} layout ${width}x${height}`, dims);
      }
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((t) => localStorage.setItem('qy-theme', t), theme);
        for (const file of ['index', 'detail', 'feedback']) {
          await page.goto(base + file + '.html');
          await page.waitForTimeout(650);
          await page.screenshot({
            path: root + `qa/${file}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
    pass('12 screenshots: 3 pages × 2 themes × desktop/mobile');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + 'detail.html');
    await page.getByRole('button', { name: '点位', exact: true }).click();
    await page.locator('#object-list [data-object="P4"]').click();
    assert(await page.locator('#object-detail').isVisible());
    assert((await page.locator('#object-detail').innerText()).includes('桃李园'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: root + 'qa/detail-mobile-point.png', fullPage: true });
    await page.getByRole('button', { name: '收起详情' }).click();
    await page.getByRole('button', { name: '车辆', exact: true }).click();
    await page.locator('#object-list [data-object="T2"]').click();
    await page.getByRole('button', { name: '跟随这辆车', exact: true }).click();
    assert.equal(await page.evaluate(() => HUBU.getSnapshot().playback.follow), 'T2');
    await page.getByRole('button', { name: '收起详情' }).click();
    const map = await page.locator('.campus-svg').boundingBox();
    await page.mouse.move(map.x + 25, map.y + 75);
    await page.mouse.down();
    await page.mouse.move(map.x + 75, map.y + 105, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => HUBU.getSnapshot().playback.follow), null);
    pass('mobile points, vehicles, details, follow and drag exit');
    await page.getByRole('button', { name: '展开时间轴' }).click();
    await page.locator('#time-slider').fill('600');
    await page.locator('[data-speed="4"]').click();
    await page.getByRole('button', { name: '图表', exact: true }).click();
    assert(await page.locator('#trend-chart').isVisible());
    await page.screenshot({ path: root + 'qa/detail-mobile-charts.png', fullPage: true });
    await page.getByRole('button', { name: '记录', exact: true }).click();
    assert((await page.locator('#record-rows tr').count()) > 0);
    await page.getByRole('button', { name: '定位', exact: true }).first().click();
    assert.equal(await page.locator('.workspace').getAttribute('data-view'), 'map');
    pass('mobile timeline, speed, charts and record-to-map selection');
    await page.getByRole('button', { name: '收起详情' }).click();
    const before = await page.evaluate(() => ({
      time: HUBU.getNow(),
      play: HUBU.getSnapshot().playback,
      feedback: localStorage.getItem('qy-feedback'),
    }));
    await page.locator('#start-tour').click();
    await page.locator('[data-tour=next]').click();
    await page.locator('[data-tour=next]').click();
    await page.waitForTimeout(7300);
    assert.equal(
      await page.evaluate(() => HUBU.getOrder(HUBU.tourMilestones().orderId).status),
      'done',
    );
    await page.locator('[data-tour=next]').click();
    await page.screenshot({ path: root + 'qa/story-mobile-result.png', fullPage: true });
    await page.locator('[data-tour=restart]').click();
    await page.locator('[data-tour=next]').click();
    await page.locator('[data-tour=prev]').click();
    await page.locator('[data-tour=exit]').first().click();
    const after = await page.evaluate(() => ({
      time: HUBU.getNow(),
      play: HUBU.getSnapshot().playback,
      feedback: localStorage.getItem('qy-feedback'),
    }));
    assert.deepEqual(after, before);
    pass('four-act tour arrival, skipping, rewind, restart and restoration');
    await page.goto(base + 'feedback.html?point=P4');
    assert.equal(await page.locator('#feedback-target').inputValue(), 'P4');
    await page.locator('#feedback-text').fill('测试反馈：桃李园食堂周围垃圾需要清理。');
    await page.locator('#feedback-issue').selectOption('dirty');
    await page.locator('button[type=submit]').click();
    assert(await page.locator('#submit-result').isVisible());
    await page.getByRole('button', { name: '查看进度', exact: true }).click();
    assert(await page.locator('.feedback-card.mine').isVisible());
    assert((await page.locator('.feedback-card.mine details').getAttribute('open')) !== null);
    const item = await page.evaluate(() => HUBU.allFeedback().find((f) => f.mine));
    assert(item.orderId);
    await page.reload();
    await page.getByRole('button', { name: '查看进展', exact: true }).click();
    assert((await page.locator('.feedback-card.mine').count()) === 1);
    await page.screenshot({ path: root + 'qa/feedback-mobile-progress.png', fullPage: true });
    await page.goto(base + 'detail.html?point=P4');
    assert((await page.locator('#object-detail').innerText()).includes('周边脏乱'));
    assert.equal(await page.evaluate(() => HUBU.getNow()), 600);
    pass('feedback submit, linked order, reload and cross-page progress');
    await page.goto(base + 'feedback.html');
    await page.locator('#clear-feedback').click();
    await page.locator('#cancel-clear').click();
    assert.equal(await page.evaluate(() => HUBU.myFeedbackCount()), 1);
    await page.locator('#clear-feedback').click();
    await page.locator('#confirm-clear').click();
    assert.equal(await page.evaluate(() => HUBU.myFeedbackCount()), 0);
    assert.equal(await page.evaluate(() => HUBU.allFeedback().length), 8);
    pass('clear confirmation preserves system examples');
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
    });
    await page.locator('#feedback-target').selectOption('P4');
    await page.locator('#feedback-text').fill('测试存储失败，不应显示提交成功。');
    await page.locator('button[type=submit]').click();
    assert((await page.locator('#form-error').innerText()).includes('未能保存到本机'));
    assert(!(await page.locator('#submit-result').isVisible()));
    pass('storage failure shows error without false success');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + 'detail.html');
    assert(await page.evaluate(() => HUBU_UI.reduced()));
    await page.locator('[data-point=P4]').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('#object-detail').isVisible());
    await page.getByRole('button', { name: '收起详情' }).click();
    await page.getByRole('button', { name: '展开时间轴' }).click();
    await page.locator('#time-slider').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#time-slider').inputValue(), '601');
    pass('reduced-motion and keyboard map/timeline interaction');
    assert.equal(errors.length, 0, errors.join('\n'));
    pass('no uncaught browser JavaScript errors');
  } finally {
    fs.writeFileSync(
      root + 'qa/browser-results.json',
      JSON.stringify({ results, errors }, null, 2),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
