// Headless screenshots of the HerCova landing page (dev server must be running).
// Uses the Playwright already installed alongside the website, read-only.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/Admin/Desktop/MamaALERT/package.json');
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../assets/screenshots');
const URL = process.env.SITE_URL ?? 'http://localhost:3000/';

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080, mobile: false },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 3 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 600_000 });
  // The site shows a brand splash first; wait it out before the hero shot.
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/home-${vp.name}.png` });

  // Scroll through so in-view animations fire, then capture the full page.
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += vp.height / 2) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1200);

  // The "Why HerCova" section (70% gauge, reach graph, alert stream).
  const about = page.locator('#about');
  if (await about.count()) {
    await about.scrollIntoViewIfNeeded();
    await page.waitForTimeout(3500);
    await about.screenshot({ path: `${OUT}/why-hercova-${vp.name}.png` });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/home-full-${vp.name}.png`, fullPage: true });
  console.log('captured', vp.name);
  await ctx.close();
}
await browser.close();
