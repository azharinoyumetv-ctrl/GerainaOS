const assert = require('node:assert/strict');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('../../frontend/node_modules/playwright');
const root = join(__dirname, '..');
const bridge = readFileSync(join(root, 'app/src/main/assets/android-bridge.js'), 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>
      <a id="plans" style="display:flex" href="/geraina/pricing">Lihat harga</a>
      <a id="cashier" href="/geraina/app/pos">Kasir</a>
      <a id="qris" href="https://checkout.xendit.co/physical-order">Bayar belanja</a>
      <form id="subscribe" action="/geraina/checkout"><button>Beli paket</button></form>
      <button id="upgrade">Upgrade Pro</button>
    </body></html>` }));
    await page.addInitScript({ content: `window.nativeMessages = []; window.GerainaNative = {postMessage: raw => window.nativeMessages.push(JSON.parse(raw))};\n${bridge}` });
    await page.goto('https://dagangos.com/geraina/login');
    assert.equal(await page.locator('#plans').isVisible(), false, 'SaaS pricing link must be hidden');
    assert.equal(await page.locator('#subscribe').isVisible(), false, 'SaaS checkout form must be hidden');
    assert.equal(await page.locator('#upgrade').isVisible(), false, 'Upgrade CTA must be hidden');
    assert.equal(await page.locator('#cashier').isVisible(), true);
    assert.equal(await page.locator('#qris').isVisible(), true, 'Physical goods payments must remain available');

    await page.evaluate(() => history.pushState({}, '', '/geraina/app/pos'));
    assert.equal(new URL(page.url()).pathname, '/geraina/app/pos');
    await page.evaluate(() => history.pushState({}, '', '/geraina/app/settings/billing'));
    assert.equal(new URL(page.url()).pathname, '/geraina/app/settings/billing', 'Read-only account status must remain reachable');
    await page.evaluate(() => history.pushState({}, '', '/geraina/app/settings/billing/checkout'));
    assert.equal(new URL(page.url()).pathname, '/geraina/app/settings/billing', 'Nested checkout must remain blocked');
    await page.evaluate(() => history.replaceState({}, '', '/geraina/%63heckout'));
    assert.equal(new URL(page.url()).pathname, '/geraina/app/settings/billing');
    await page.evaluate(() => window.print());
    assert.ok((await page.evaluate(() => nativeMessages)).some(m => m.type === 'print'));

    await page.evaluate(() => {
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(new Blob(['%PDF-1.7\nGeraina receipt'], { type: 'application/pdf' }));
      anchor.download = 'receipt.pdf';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(anchor.href);
    });
    await page.waitForFunction(() => nativeMessages.some(m => m.type === 'download'));
    const exported = await page.evaluate(() => nativeMessages.find(m => m.type === 'download'));
    assert.equal(exported.name, 'receipt.pdf');
    assert.equal(Buffer.from(exported.data.split(',')[1], 'base64').toString(), '%PDF-1.7\nGeraina receipt');

    await page.evaluate(() => {
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]));
      anchor.download = 'large.pdf'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    });
    await page.waitForFunction(() => nativeMessages.some(m => m.type === 'downloadTooLarge'));
    await page.evaluate(() => {
      const anchor = document.createElement('a'); anchor.id = 'dynamic-plans'; anchor.href = '/geraina/pricing';
      anchor.textContent = 'Lihat harga'; document.body.appendChild(anchor);
    });
    await page.waitForFunction(() => document.querySelector('#dynamic-plans').hidden);
    assert.deepEqual(failures, []);

    // An untrusted site receives none of the injected native integrations.
    await page.goto('https://untrusted.example/geraina/login');
    assert.equal(await page.evaluate(() => !!window.__gerainaAndroid), false);
    const report = {
      verifiedAt: new Date().toISOString(),
      checks: ['subscription links/forms/upgrade CTAs hidden', 'POS and physical payment links preserved',
        'read-only account status preserved', 'SPA subscription checkout blocked', 'encoded checkout path blocked', 'native print message',
        'PDF blob download survives immediate URL revocation', '10 MB limit', 'dynamic links hidden', 'untrusted origin excluded'],
      status: 'passed',
      scope: 'Android document-start JavaScript in Chromium; not an Android device test'
    };
    mkdirSync(join(root, 'releases'), { recursive: true });
    writeFileSync(join(root, 'releases/bridge-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
