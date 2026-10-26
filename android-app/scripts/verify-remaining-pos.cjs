// Full prepared UI + native presentation. Every request is intercepted and every
// write goes to an isolated fixture, never a real merchant or payment provider.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('../../frontend/node_modules/playwright');
const root = path.resolve(__dirname, '..'), build = path.resolve(root, '../frontend/build');
const out = path.join(root, 'app/build/reports/remaining-pos'); fs.mkdirSync(out, { recursive: true });
const results = [];
const owner = { id: 'remaining-owner', store_id: 'remaining-store', role: 'Owner', plan: 'business', email: 'fixture@example.invalid', store_name: 'Isolated POS fixture' };
const products = Array.from({ length: 1203 }, (_, i) => ({ id: `p-${String(i).padStart(4, '0')}`, name: `Product ${String(i).padStart(4, '0')}`, sku: `SKU-${i}`, price: 1000, cost: 500, stock: i === 1202 ? 1 : 20, category: 'Test', unit: 'pcs' }));
const orders = Array.from({ length: 257 }, (_, i) => ({ id: `order-${i}`, store_id: owner.store_id, order_no: `ORDER-${String(i).padStart(4, '0')}`, created_at: new Date(Date.UTC(2026, 9, 26) + i * 1000).toISOString(), payment_method: 'doku', payment_status: 'pending', total: 1000, subtotal: 1000, items: [{ product_id: products[0].id, name: products[0].name, quantity: 1, price: 1000, subtotal: 1000 }] }));
async function fixture(browser, viewport, { signedIn = true, fail = [], failSecond = false } = {}) {
  const context = await browser.newContext({ viewport }), page = await context.newPage();
  page.setDefaultTimeout(7000); const errors = [], requests = [], writes = [], failures = new Set(fail);
  let failLaterPage = failSecond, configuration = { cash: { is_active: true }, ewallet: { is_active: true, provider: 'Xendit', channels: { OVO: true, DANA: true, ShopeePay: true, LinkAja: true } } };
  const css = ['mobile-support.css', 'mobile-ui.css'].map(name => fs.readFileSync(path.join(root, 'app/src/main/assets', name), 'utf8')).join('\n');
  const scripts = ['android-bridge.js', 'device-features.js', 'mobile-ui.js'].map(name => fs.readFileSync(path.join(root, 'app/src/main/assets', name), 'utf8').replace('__GERAINA_MOBILE_STYLE__', JSON.stringify(css))).join('\n');
  await context.addInitScript({ content: `if(!sessionStorage.getItem('fixture-started')){sessionStorage.setItem('fixture-started','yes');${signedIn ? `localStorage.setItem('geraina_token','remaining-token');localStorage.setItem('geraina_user',${JSON.stringify(JSON.stringify(owner))});` : ''}}window.GerainaNative={postMessage:()=>{}};window.__gerainaAppInfo={versionName:'local-patch',versionCode:11,androidVersion:'14',model:'Isolated UI profile'};${scripts}` });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.route('https://dagangos.com/geraina/**', route => { const p = new URL(route.request().url()).pathname; return route.fulfill({ path: path.join(build, p.includes('/static/') ? p.slice('/geraina/'.length) : 'index.html') }); });
  await page.route('https://dagangos.com/api/**', async route => {
    const r = route.request(), url = new URL(r.url()), p = url.pathname, body = r.method() === 'GET' ? null : r.postDataJSON();
    requests.push({ path: p, method: r.method(), query: url.search });
    if (failures.has(p)) return route.fulfill({ status: 503, json: { detail: 'Isolated interrupted connection' } });
    if (p === '/api/auth/login') return route.fulfill({ json: { access_token: 'remaining-token', user: owner } });
    if (p === '/api/auth/me') return route.fulfill({ json: owner });
    if (p === '/api/products/catalogue') {
      const start = Number(url.searchParams.get('cursor') || 0);
      if (failLaterPage && start) return route.fulfill({ status: 503, json: { detail: 'Later page interrupted' } });
      return route.fulfill({ json: { items: products.slice(start, start + 500), total: products.length, next_cursor: start + 500 < products.length ? String(start + 500) : null } });
    }
    if (p === '/api/products/lookup') { const code = url.searchParams.get('code'), product = products.find(p => p.sku === code || p.id === code); return route.fulfill({ status: product ? 200 : 404, json: product || { detail: 'Barcode tidak ditemukan.' } }); }
    if (p === '/api/payments/config') {
      if (body) { writes.push({ path: p, body }); configuration = { ...configuration, ...body }; }
      return route.fulfill({ json: configuration });
    }
    if (p === '/api/payments/options') {
      const channels = Object.entries(configuration.ewallet.channels).filter(([, on]) => on).map(([label]) => ({ code: label.toUpperCase(), label }));
      return route.fulfill({ json: { schema_version: 1, methods: { cash: { enabled: configuration.cash.is_active }, qris_bank: { enabled: false }, ewallet: { enabled: configuration.ewallet.is_active && channels.length > 0 }, doku: { enabled: true } }, ewallet_channels: channels } });
    }
    if (p === '/api/orders/history') {
      const q = (url.searchParams.get('q') || '').toLowerCase(), status = url.searchParams.get('status');
      const rows = [...orders].reverse().filter(row => row.order_no.toLowerCase().includes(q) && (!status || row.payment_status === status));
      const start = Number(url.searchParams.get('cursor') || 0);
      return route.fulfill({ json: { items: rows.slice(start, start + 50), total: rows.length, next_cursor: start + 50 < rows.length ? String(start + 50) : null } });
    }
    if (p === '/api/orders/resolve') {
      const row = orders.find(row => row.id === url.searchParams.get('reference'));
      return route.fulfill({ status: row ? 200 : 404, json: row || { detail: 'Transaksi tidak ditemukan di toko akun ini.' } });
    }
    if (p.startsWith('/api/orders/') && orders.some(row => row.id === p.split('/').at(-1))) return route.fulfill({ json: orders.find(row => row.id === p.split('/').at(-1)) });
    if (p === '/api/offline/orders' || p === '/api/orders') {
      if (body) { writes.push({ path: p, body }); return route.fulfill({ json: { ...body, id: body.client_order_id || 'isolated-created', store_id: owner.store_id, cashier_id: owner.id, order_no: 'ISOLATED-CASH', total: 1000, subtotal: 1000, payment_status: body.payment_method === 'cash' ? 'paid' : 'pending', created_at: new Date().toISOString() } }); }
      return route.fulfill({ json: orders.slice(-5) });
    }
    if (p === '/api/orders/stats') return route.fulfill({ json: { today_sales: 0, today_orders: 0, week_sales: 0, month_sales: 0, product_count: products.length } });
    if (p === '/api/reports/profit') return route.fulfill({ json: { series: [], totals: { revenue: 0 } } });
    if (p === '/api/reports/cashflow') return route.fulfill({ json: { series: [] } });
    if (p === '/api/reports/inventory/turnover') return route.fulfill({ json: { turnover_ratio_monthly_est: null } });
    if (p === '/api/settings' || p === '/api/integrations') return route.fulfill({ json: {} });
    if (p === '/api/products/category-names') return route.fulfill({ json: ['Test'] });
    if (p === '/api/payments/bank-qris') return route.fulfill({ json: { is_active: false, bank_name: '', qr_payload: '' } });
    if (r.method() !== 'GET') throw Error('Unexpected isolated mutation: ' + p);
    return route.fulfill({ json: [] });
  });
  const go = async route => { await page.goto('https://dagangos.com/geraina/' + route); };
  const cart = async () => { const button = page.getByTestId('mobile-cart-open'); if (await button.isVisible()) await button.click(); };
  return { page, context, go, cart, errors, requests, writes, recover: () => { failures.clear(); failLaterPage = false; }, interruptLaterPage: () => { failLaterPage = true; }, config: value => { configuration = value; } };
}
async function check(browser, profile, name, fn, options) {
  if (process.env.GERAINA_REMAINING_FILTER && !name.includes(process.env.GERAINA_REMAINING_FILTER)) return;
  const f = await fixture(browser, profile.viewport, options);
  try { await fn(f); assert.deepEqual(f.errors, []); results.push({ profile: profile.id, name, status: 'passed' }); }
  catch (error) { results.push({ profile: profile.id, name, status: 'failed', error: error.message, runtimeErrors: f.errors }); await f.page.screenshot({ path: path.join(out, `${profile.id}-failure-${results.length}.png`) }).catch(() => {}); }
  finally { await f.context.close(); }
  console.log(results.at(-1).status.toUpperCase() + ': ' + profile.id + ' / ' + name);
}
const scenarios = [
{ name: 'Complete catalogue search and barcode lookup beyond product 500', run: async ({ page, go, cart, requests }) => {
        await go('app/pos'); await page.getByTestId('pos-catalogue-coverage').filter({ hasText: 'Katalog lengkap: 1203' }).waitFor();
        assert.equal(await page.locator('button[data-testid^="pos-product-"]').count(), 48);
        await page.getByTestId('pos-search').fill('Product 1202'); await page.getByTestId('pos-product-p-1202').waitFor();
        await page.evaluate(() => dispatchEvent(new CustomEvent('geraina-barcode', { detail: { target: 'pos', value: 'SKU-1202' } })));
        await page.getByTestId('cart-item-0').waitFor({ state: 'attached' }); await cart();
        assert.match(await page.getByTestId('cart-item-0').innerText(), /Product 1202/);
        assert.equal(requests.filter(r => r.path === '/api/products/catalogue').length, 3);
        assert.ok(requests.some(r => r.path === '/api/products/lookup' && r.query.includes('SKU-1202')));
      } },
{ name: 'Interrupted later catalogue page preserves complete offline snapshot and retries', run: async ({ page, go, recover, context, interruptLaterPage }) => {
        await go('app/pos'); await page.getByTestId('pos-catalogue-state').getByRole('button', { name: 'Coba lagi' }).waitFor();
        assert.equal(await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('geraina-pos-offline-v1'); r.onsuccess = () => { const q = r.result.transaction('cache').objectStore('cache').get('remaining-owner:remaining-store:products'); q.onsuccess = () => resolve(q.result || null); }; })), null);
        recover(); await page.getByTestId('pos-catalogue-state').getByRole('button', { name: 'Coba lagi' }).click(); await page.getByTestId('pos-catalogue-coverage').filter({ hasText: 'Katalog lengkap: 1203' }).waitFor();
        interruptLaterPage(); await page.reload(); await page.getByTestId('pos-catalogue-state').getByRole('button', { name: 'Coba lagi' }).waitFor();
        const saved = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('geraina-pos-offline-v1'); r.onsuccess = () => { const q = r.result.transaction('cache').objectStore('cache').get('remaining-owner:remaining-store:products'); q.onsuccess = () => resolve({ count: q.result.data.length, complete: q.result.complete }); }; }));
        assert.deepEqual(saved, { count: 1203, complete: true });
        await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event('offline')));
        await page.getByTestId('pos-catalogue-coverage').filter({ hasText: 'Katalog lengkap: 1203' }).waitFor();
        await page.getByTestId('pos-search').fill('Product 1202'); await page.getByTestId('pos-product-p-1202').waitFor();
      }, options: { failSecond: true } },
{ name: 'Owner cash and channel preferences change POS choices', run: async ({ page, go, cart, writes }) => {
        await go('app/payments/cash'); await page.getByTestId('payment-active').uncheck(); await page.getByTestId('payment-config-save-btn').click(); await page.waitForTimeout(100);
        await go('app/payments/ewallet'); await page.getByLabel('DANA', { exact: true }).uncheck(); await page.getByTestId('payment-config-save-btn').click(); await page.waitForTimeout(100);
        await go('app/pos'); await page.getByTestId('pos-product-p-0000').click(); await cart(); await page.waitForFunction(() => !document.querySelector('[data-testid="pm-ewallet"]')?.disabled);
        assert.equal(await page.getByTestId('pm-cash').isDisabled(), true); await page.getByTestId('pm-ewallet').click();
        assert.equal(await page.getByTestId('ew-DANA').count(), 0); assert.equal(await page.getByTestId('ew-OVO').count(), 1);
        assert.equal(await page.getByTestId('pm-edc').count(), 0); assert.deepEqual(writes.map(w => Object.keys(w.body)), [['cash'], ['ewallet']]);
      } },
{ name: 'Payment-options failure prevents checkout and recovers explicitly', run: async ({ page, go, cart, recover, writes }) => {
        await go('app/pos'); await page.getByTestId('pos-product-p-0000').click(); await cart();
        await page.getByTestId('pos-payment-options-state').getByRole('button', { name: 'Coba lagi' }).waitFor(); assert.equal(await page.getByTestId('checkout-btn').isDisabled(), true); assert.equal(writes.length, 0);
        recover(); await page.getByTestId('pos-payment-options-state').getByRole('button', { name: 'Coba lagi' }).click(); await page.waitForFunction(() => !document.querySelector('[data-testid="pm-cash"]')?.disabled);
      }, options: { fail: ['/api/payments/options'] } },
{ name: 'Unsupported standalone payments cannot be activated or saved', run: async ({ page, go }) => {
        for (const type of ['va', 'credit-card', 'bank-transfer', 'edc']) { await go('app/payments/' + type); await page.getByTestId('payment-method-unavailable').waitFor(); assert.equal(await page.locator('[data-testid="payment-config-page"] input').count(), 0); assert.equal(await page.getByTestId('payment-config-save-btn').count(), 0); }
        await go('app/integrations/midtrans'); await page.getByTestId('midtrans-unavailable').waitFor(); assert.equal(await page.getByRole('button', { name: 'Simpan Integrasi' }).count(), 0);
      } },
{ name: 'Sales history searches old orders on the server and pages bounded rows', run: async ({ page, go, requests }) => {
        await go('app/sales'); await page.getByTestId('sales-row-order-256').waitFor(); assert.equal(await page.locator('[data-testid^="sales-row-"]').count(), 50);
        await page.getByTestId('sales-page-next').click(); await page.getByTestId('sales-row-order-206').waitFor();
        await page.getByTestId('sales-search').fill('ORDER-0000'); await page.getByTestId('sales-row-order-0').waitFor(); assert.equal(await page.locator('[data-testid^="sales-row-"]').count(), 1);
        assert.ok(requests.some(r => r.path === '/api/orders/history' && r.query.includes('ORDER-0000')));
        await page.getByTestId('sales-search').fill(''); await page.getByTestId('sales-row-order-256').waitFor(); assert.equal(await page.getByTestId('sales-page-prev').isDisabled(), true);
      } },
{ name: 'Sales history failure is not presented as no transactions', run: async ({ page, go, recover }) => {
        await go('app/sales'); await page.getByTestId('sales-error').waitFor(); assert.equal(await page.getByTestId('sales-empty').count(), 0);
        recover(); await page.getByTestId('sales-error').getByRole('button', { name: 'Coba lagi' }).click(); await page.getByTestId('sales-row-order-256').waitFor();
      }, options: { fail: ['/api/orders/history'] } },
{ name: 'DOKU return survives login and ignores forged paid URL parameters', run: async ({ page, go, writes }) => {
        await go('app/sales?order=order-0&status=paid&amount=0'); await page.getByTestId('login-form').waitFor(); assert.ok(page.url().includes('returnTo='));
        await page.getByTestId('login-email-input').fill(owner.email); await page.getByTestId('login-password-input').fill('IsolatedPassword123'); await page.getByTestId('login-submit-btn').click();
        await page.getByTestId('receipt-status').waitFor(); assert.match((await page.getByTestId('receipt-status').innerText()).toLowerCase(), /menunggu|pending/); assert.equal(writes.length, 0);
        await page.getByTestId('receipt-done-btn').click(); await page.waitForFunction(() => !new URL(location.href).searchParams.has('order'));
      }, options: { signedIn: false } },
{ name: 'DOKU missing reference shows a scoped error rather than a fake receipt', run: async ({ page, go }) => {
        await go('app/sales?order=other-store-id&status=paid'); await page.getByTestId('payment-return-state').getByRole('button', { name: 'Coba lagi' }).waitFor(); assert.equal(await page.getByTestId('receipt-status').count(), 0);
      } },
{ name: 'Inventory failure preserves unknown state then loads all products with bounded rows', run: async ({ page, go, recover }) => {
        await go('app/inventory/overview'); await page.getByTestId('inventory-read-state').getByRole('button', { name: 'Coba lagi' }).waitFor(); assert.equal(await page.getByText('Belum ada data produk.', { exact: true }).count(), 0);
        recover(); await page.getByTestId('inventory-read-state').getByRole('button', { name: 'Coba lagi' }).click(); await page.getByTestId('table-pagination').filter({ hasText: '1203 produk' }).waitFor(); assert.equal(await page.locator('tbody tr').count(), 50);
        await go('app/inventory/low-stock'); await page.getByText('Product 1202', { exact: true }).waitFor();
      }, options: { fail: ['/api/products/catalogue'] } },
{ name: 'Report failures have retry states instead of false zeroes or perpetual loading', run: async ({ page, go, recover }) => {
        for (const type of ['sales', 'product', 'inventory', 'profit', 'cashflow']) { await go('app/reports/' + type); await page.getByTestId('reports-read-state').getByRole('button', { name: 'Coba lagi' }).waitFor(); }
        recover(); await page.getByTestId('reports-read-state').getByRole('button', { name: 'Coba lagi' }).click(); await page.getByTestId('reports-read-state').waitFor({ state: 'hidden' });
      }, options: { fail: ['/api/orders/stats', '/api/orders/product-sales', '/api/products/catalogue', '/api/reports/profit', '/api/reports/cashflow'] } },
{ name: 'Cash checkout remains actor-scoped and produces a preserved local receipt', run: async ({ page, go, cart }) => {
        await go('app/pos'); await page.getByTestId('pos-product-p-0000').click(); await cart(); await page.getByTestId('cart-cash-received').fill('1000'); await page.getByTestId('checkout-btn').click(); await page.getByTestId('receipt-status').waitFor(); assert.equal((await page.getByTestId('receipt-status').innerText()).toLowerCase(), 'lunas');
        const rows = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('geraina-pos-offline-v1'); r.onsuccess = () => { const q = r.result.transaction('sales').objectStore('sales').getAll(); q.onsuccess = () => resolve(q.result); }; }));
        assert.equal(rows.length, 1); assert.equal(rows[0].body.expected_cashier_id, owner.id); assert.equal(rows[0].body.expected_store_id, owner.store_id);
      } }
];
module.exports = { fixture, scenarios };

if (require.main === module) (async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const profile of [{ id: 'phone', viewport: { width: 412, height: 915 } }, { id: 'xiaomi', viewport: { width: 1016, height: 1100 } }, { id: 'samsung', viewport: { width: 1480, height: 924 } }]) {
      if (process.env.GERAINA_REMAINING_PROFILE && process.env.GERAINA_REMAINING_PROFILE !== profile.id) continue;
      for (const scenario of scenarios) await check(browser, profile, scenario.name, scenario.run, scenario.options);
    }
  } finally {
    await browser.close();
    const report = { status: results.every(r => r.status === 'passed') ? 'passed' : 'failed', scope: 'Prepared frontend + Android presentation in Chromium, isolated API/IndexedDB fixtures; no physical devices or real gateway settlement', merchantWrites: 0, results };
    fs.writeFileSync(path.join(out, process.env.GERAINA_REMAINING_PROFILE ? `${process.env.GERAINA_REMAINING_PROFILE}-verification.json` : 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, total: results.length, failed: results.filter(r => r.status !== 'passed').map(r => ({ profile: r.profile, name: r.name })) }));
    if (report.status !== 'passed') process.exitCode = 1;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
