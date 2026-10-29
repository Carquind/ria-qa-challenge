// Renders the RESULT summary of a test log as a PNG (the brief asks for a screenshot of the Selenium/Cypress and Postman results).
// usage: node scripts/render-results.js <mocha|playwright|cypress|plain> <log> "<title>" <out.png>
// It only reformats text that already exists in the log (colouring pass/fail lines); nothing is invented or edited.
const { Builder } = require('selenium-webdriver');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , mode, logFile, title, out] = process.argv;
if (!mode || !logFile || !title || !out) { console.error('usage: render-results.js <mode> <log> "<title>" <out.png>'); process.exit(1); }

const lines = fs.readFileSync(logFile, 'utf8').replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
const idx = (re, from = 0) => { for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i; return -1; };
const lastIdx = (re) => { for (let i = lines.length - 1; i >= 0; i--) if (re.test(lines[i])) return i; return -1; };
const noise = (l) => /^npm notice|DevTools listening|term-size|^=+$/.test(l.trim());

let picked;
if (mode === 'mocha') {
  const end = idx(/\d+ failing|\d+ passing/);
  const failing = idx(/\d+ failing/);
  picked = lines.slice(0, (failing >= 0 ? failing : end) + 1);
} else if (mode === 'playwright') {
  const first = idx(/^\s+1\) /);
  const head = lines.slice(0, first > 0 ? first : 30);
  // the final block starts at the "N failed" line (followed by the failed tests and "N passed"); without failures only "N passed"
  const failedAt = lastIdx(/^\s+\d+ failed\s*$/);
  const tailStart = failedAt >= 0 ? failedAt : lastIdx(/^\s+\d+ passed/);
  const tail = tailStart >= 0 ? lines.slice(tailStart).filter((l) => !/show-report|To open last HTML report/.test(l)) : [];
  picked = [...head, '    ...', ...tail];
} else if (mode === 'cypress') {
  const keep = (l) => /Running:|^\s+[✓✔✖]|^\s+\d+\) |passing|failing|Tests:|Passing:|Failing:|Skipped:|Spec Ran:|All specs|failed/.test(l) && l.length < 220;
  const fin = idx(/\(Run Finished\)/);
  picked = [...lines.slice(0, fin > 0 ? fin : lines.length).filter(keep), '    ...', ...(fin > 0 ? lines.slice(fin) : [])];
} else {
  picked = lines.slice(0, 90);
}
const shorten = (l) => l.replace(/playwright\/tests\/([^:\s]+):\d+:\d+ › .* › /, '$1 › ');
picked = picked.map(shorten).filter((l) => !noise(l)).map((l) => (l.length > 170 ? l.slice(0, 167) + '...' : l));
while (picked.length && picked[0].trim() === '') picked.shift();

if (process.env.DRY) { console.log(picked.join('\n')); process.exit(0); }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cls = (l) => (/[✓✔]|passing|passed|executed|\b0\s+\│?\s*$/.test(l) && !/failing|failed|✖|✘/.test(l) ? 'ok'
  : /[✖✘]|failing|failed|^\s+\d+\) /.test(l) ? 'bad' : '');
const body = picked.map((l) => `<span class="${cls(l)}">${esc(l)}</span>`).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 body{margin:0;background:#0f1419;color:#d7dce2;font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}
 header{padding:16px 24px;background:#1b222b;border-bottom:1px solid #2b3540}
 h1{margin:0;font:600 18px system-ui,sans-serif;color:#fff} small{color:#8b98a5;font:12px system-ui,sans-serif}
 pre{margin:0;padding:18px 24px;white-space:pre} .ok{color:#7ee787} .bad{color:#ff7b72}
</style>
<header><h1>${esc(title)}</h1><small>Source: ${esc(path.basename(logFile))} (evidence/latest) &middot; rendered ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC &middot; text from the run log (long path prefixes shortened)</small></header>
<pre>${body}</pre>`;

(async () => {
  const tmp = path.join(os.tmpdir(), `results-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const driver = await new Builder().forBrowser('chrome').build();
  try {
    await driver.manage().window().setRect({ width: 1500, height: 900 });
    await driver.get('file://' + tmp);
    await driver.sleep(500);
    // window height = content height + the browser chrome (outer - inner), but a window cannot be taller than the screen,
    // so the screenshot itself is taken with the DevTools protocol, beyond the viewport (full page), with the plain one as fallback
    const [content, chrome, width] = await driver.executeScript('return [document.documentElement.scrollHeight, window.outerHeight - window.innerHeight, window.innerWidth]');
    const height = Math.min(content, 6000);
    await driver.manage().window().setRect({ width: 1500, height: Math.min(height + chrome + 40, 1000) });
    await driver.sleep(400);
    let png = null;
    try {
      const r = await driver.sendAndGetDevToolsCommand('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: height + 10, scale: 1 },
      });
      png = r && r.data;
    } catch (e) { png = null; }
    if (!png) png = await driver.takeScreenshot();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png, 'base64');
    console.log('saved', out);
  } finally {
    await driver.quit();
    fs.rmSync(tmp, { force: true });
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
