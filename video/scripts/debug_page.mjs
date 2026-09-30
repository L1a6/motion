// Loads the composition in headless Chromium and prints console errors — a quick JS sanity check.
//   node scripts/debug_page.mjs [seconds...]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/Admin/Desktop/MamaALERT/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type() + ':', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(() => { window.__timelines = {}; });
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => ({ hasTl: !!(window.__timelines && window.__timelines.main), dur: window.__timelines.main ? window.__timelines.main.duration() : null }));
console.log('timeline:', JSON.stringify(info));
const times = process.argv.slice(2).map(Number);
for (const t of times) {
  await page.evaluate((tt) => window.__timelines.main.seek(tt, false), t);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(ROOT, `snapshots/debug-${t}.png`) });
  console.log('shot', t);
}
await browser.close();
server.close();
