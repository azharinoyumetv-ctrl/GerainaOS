const { chromium } = require('../../frontend/node_modules/playwright');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(join(__dirname, '../play-store/feature-graphic.svg')).href);
    await page.screenshot({ path: join(__dirname, '../play-store/feature-graphic-1024x500.png') });
    console.log('Google Play feature graphic rendered at 1024 x 500.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
