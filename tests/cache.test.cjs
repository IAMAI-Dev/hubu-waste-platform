const fs = require('fs'),
  http = require('http'),
  path = require('path'),
  assert = require('assert'),
  { execFileSync } = require('child_process');
const root = process.env.HUBU_ROOT || path.resolve(__dirname, '..');
let pw;
try {
  pw = require('playwright');
} catch (_) {
  pw = require(process.env.PLAYWRIGHT_MODULE);
}
(async () => {
  let legacy = true;
  const oldScene = execFileSync('git', ['-C', root, 'show', '8da1642:scene.js']);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost'),
      name = u.pathname === '/' ? 'detail.html' : u.pathname.slice(1);
    let data;
    try {
      data = fs.readFileSync(path.join(root, name));
    } catch (_) {
      res.writeHead(404);
      return res.end();
    }
    const type = name.endsWith('.js')
      ? 'text/javascript'
      : name.endsWith('.css')
        ? 'text/css'
        : name.endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/html';
    res.setHeader('Content-Type', type + ';charset=utf-8');
    if (name === 'detail.html') {
      res.setHeader('Cache-Control', 'no-store');
      if (legacy)
        data = Buffer.from(
          data
            .toString()
            .replace(/\?v=[a-f0-9]+/g, '')
            .replace(/<script src="campus-model.js"><\/script>/, ''),
        );
    } else res.setHeader('Cache-Control', 'public,max-age=86400');
    if (name === 'scene.js' && !u.search) data = oldScene;
    res.end(data);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let b;
  try {
    b = await pw.chromium.launch({
      executablePath:
        process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
    });
    const p = await b.newPage();
    await p.goto(base + '/detail.html');
    await p.waitForFunction(() => document.querySelectorAll('.building-roof').length > 0);
    assert.equal(await p.locator('.model-landmark').count(), 0);
    legacy = false;
    await p.reload();
    await p.waitForFunction(() => document.querySelectorAll('.model-landmark').length === 6);
    const loaded = await p.evaluate(() =>
      [...document.scripts].filter((s) => /scene.js|campus-model.js/.test(s.src)).map((s) => s.src),
    );
    assert(loaded.every((u) => u.includes('?v=')));
    await p.goto('http://127.0.0.1:8765/detail.html?v=campus-model-20261023');
    await p.waitForFunction(() => document.querySelectorAll('.model-landmark').length === 6);
    await p.evaluate(() => HUBU.setPlayback({ playing: false }));
    await p.waitForTimeout(700);
    fs.mkdirSync(root + '/qa/cache', { recursive: true });
    await p.screenshot({ path: root + '/qa/cache/updated-model.png' });
    const responses = [];
    for (const asset of ['detail.html', 'scene.js', 'campus-model.js']) {
      const r = await p.request.get('http://127.0.0.1:8765/' + asset, {
        headers: { 'If-Modified-Since': 'Thu, 01 Jan 2099 00:00:00 GMT' },
      });
      assert.equal(r.status(), 200);
      assert(r.headers()['cache-control'].includes('no-store'));
      responses.push({ asset, status: r.status(), cacheControl: r.headers()['cache-control'] });
    }
    fs.writeFileSync(
      root + '/qa/cache/results.json',
      JSON.stringify(
        { staleModelReproduced: true, versionedReloadShowsSixLandmarks: true, loaded, responses },
        null,
        2,
      ),
    );
    console.log(
      'PASS cached legacy scene reproduced, normal reload uses six new landmarks; no-store server ignores stale validators',
    );
  } finally {
    if (b) await b.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
