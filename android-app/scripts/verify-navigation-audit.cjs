// UI contract audit against original APK assets or a prepared frontend. All APIs
// are intercepted; no merchant record, payment or third-party message is created.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('../../frontend/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const assets = path.resolve(process.env.GERAINA_AUDIT_ASSETS || path.join(root, 'app/src/main/assets'));
const build = path.resolve(process.env.GERAINA_AUDIT_BUILD || path.join(root, '../frontend/build'));
const out = path.resolve(process.env.GERAINA_AUDIT_OUT || path.join(root, 'app/build/reports/navigation-audit'));
fs.mkdirSync(out, { recursive: true });
const results = [];
const paymentConfig = { cash: { is_active: true, provider: 'Local', require_drawer: false }, ewallet: { is_active: false, provider: 'Xendit', channels: {} }, va: { is_active: false, provider: 'Midtrans', banks: {} }, credit_card: { is_active: false, provider: '', enable_3ds: true }, bank_transfer: { is_active: false, accounts: [{ bank: '', account_no: '', account_name: '' }] }, edc: { is_active: false, provider: '' } };
async function fixture(browser, { role = 'Owner', plan = 'business', width = 1280, native = true, configStatus = 200, config = paymentConfig } = {}) {
  const context = await browser.newContext({ viewport: { width: Number(process.env.GERAINA_AUDIT_WIDTH) || width, height: 1000 } });
  const user = { id: 'audit-user', store_id: 'audit-store', role, plan, email: 'audit@fixture.invalid', store_name: 'Audit fixture' };
  const scripts = native ? ['android-bridge.js', 'device-features.js', 'mobile-ui.js'].map(name => fs.readFileSync(path.join(assets, name), 'utf8').replace('__GERAINA_MOBILE_STYLE__', JSON.stringify(['mobile-support.css', 'mobile-ui.css'].map(name => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n')))).join('\n') : '';
  await context.addInitScript({ content: `localStorage.setItem('geraina_token','isolated-audit-token');localStorage.setItem('geraina_user',${JSON.stringify(JSON.stringify(user))});window.__gerainaSubscriptionPurchases=true;window.__gerainaAppInfo={versionName:'1.2.6',versionCode:11,androidVersion:'14',model:'Audit fixture'};${native ? 'window.GerainaNative={postMessage:()=>{}};' : ''}${scripts}` });
  const page = await context.newPage(), errors = [], writes = [], requests = [];
  page.setDefaultTimeout(3500);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.fulfill({ status: 404, body: 'External requests blocked by audit' }));
  await page.route('https://dagangos.com/geraina/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ path: path.join(build, pathname.includes('/static/') ? pathname.slice('/geraina/'.length) : 'index.html') });
  });
  await page.route('https://dagangos.com/app/**', route => route.fulfill({ path: path.join(build, 'index.html') }));
  let recovered = false;
  await page.route('https://dagangos.com/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    requests.push({ path: pathname, method: request.method() });
    if (request.method() !== 'GET') {
      writes.push({ path: pathname, body: request.postDataJSON() });
      return route.fulfill({ json: pathname === '/api/payments/config' ? { ...paymentConfig, ...request.postDataJSON() } : {} });
    }
    if (pathname === '/api/subscriptions/current') return route.fulfill({json:{plan,billing_model:'prepaid',auto_renew:false,can_manage:role==='Owner',subscription:null}});
    if (pathname === '/api/auth/me') return route.fulfill({ json: user });
    if (pathname === '/api/payments/config') return route.fulfill({ status: recovered ? 200 : configStatus, json: configStatus !== 200 && !recovered ? { detail: 'Audit connection interruption' } : config });
    if(pathname==='/api/products/catalogue'||pathname==='/api/orders/history'||pathname.startsWith('/api/records/')) return route.fulfill({json:{items:[],total:0,next_cursor:null}});
    const json = pathname === '/api/integrations' || pathname === '/api/settings' ? {} : pathname === '/api/payments/bank-qris' ? { is_active: false, bank_name: '', qr_payload: '' } : pathname === '/api/orders/stats' ? { today_sales: 12000, today_orders: 3, product_count: 0, low_stock_count: 0, today_date: '2026-10-26', timezone: 'Asia/Jakarta', daily_sales: [{date:'2026-10-26',value:12000}] } : pathname === '/api/subscription' ? { plan, status: 'active' } : pathname === '/api/attendance/me' ? { records: [], open_shift: null } : [];
    return route.fulfill({ json });
  });
  const go = async route => { await page.goto('https://dagangos.com' + route); await page.locator('[data-testid="app-layout"]').waitFor(); await page.waitForTimeout(120); };
  return { page, context, go, errors, writes, requests, recover: () => { recovered = true; } };
}
async function check(browser, name, fn, options) {
  if (process.env.GERAINA_AUDIT_FILTER && !name.includes(process.env.GERAINA_AUDIT_FILTER)) return;
  const f = await fixture(browser, options);
  try { await fn(f); assert.deepEqual(f.errors, []); results.push({ name, status: 'passed' }); if (/DOKU appears|Tax page|Credit-card route|Bank-transfer route/.test(name)) await f.page.screenshot({ path: path.join(out, `passed-${results.length}.png`) }); }
  catch (error) { results.push({ name, status: 'failed', error: error.message, runtimeErrors: f.errors }); await f.page.screenshot({ path: path.join(out, `failure-${results.length}.png`) }).catch(() => {}); }
  finally { await f.context.close(); }
  console.log(results.at(-1).status.toUpperCase() + ': ' + name);
}
async function expandMenu(page, key) {
  const button = page.getByTestId('menu-parent-' + key);
  const inViewport = await button.evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.right > 0 && bounds.left < innerWidth; });
  if (!inViewport) {
    await page.evaluate(() => window.GerainaMobile?.openMenu());
    if (!await page.evaluate(() => !!window.GerainaMobile)) await page.getByTestId('mobile-menu-open-btn').click();
  }
  await button.click();
}
const link = (page, href) => page.locator(`aside a[href="${href}"]`);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await check(browser, 'DOKU appears in expanded integration navigation', async ({ page, go }) => { await go('/geraina/app/integrations/xendit'); await expandMenu(page, 'integrations'); const destination = link(page, '/geraina/app/integrations/doku'); await destination.click(); await page.waitForURL('**/geraina/app/integrations/doku', { waitUntil: 'domcontentloaded' }); await page.getByText('Aktifkan DOKU Gateway', { exact: true }).waitFor(); assert.equal(await destination.getAttribute('aria-current'), 'page'); });
    await check(browser, 'Sales history is directly reachable in the sidebar', async ({ page, go }) => { await go('/geraina/app/about'); assert.equal(await link(page, '/geraina/app/sales').count(), 1); });
    await check(browser, 'EDC setup availability page is included in payment navigation', async ({ page, go }) => { await go('/geraina/app/payments/cash'); await expandMenu(page, 'payments'); assert.equal(await link(page, '/geraina/app/payments/edc').count(), 1); });
    await check(browser, 'Credit-card route renders the matching configuration', async ({ page, go }) => { await go('/geraina/app/payments/credit-card'); await page.getByRole('heading',{name:'Kartu Kredit',exact:true}).waitFor(); await page.getByTestId('payment-provider').waitFor(); assert.equal(await page.getByText('Konfigurasi tidak ditemukan.', { exact: true }).count(), 0); });
    await check(browser, 'Bank-transfer route renders the matching configuration', async ({ page, go }) => { await go('/geraina/app/payments/bank-transfer'); await page.getByTestId('payment-method-unavailable').filter({ hasText: 'Transfer Bank' }).waitFor(); });
    await check(browser, 'Failed payment settings load cannot save defaults and offers retry', async ({ page, go, writes, recover }) => { await go('/geraina/app/payments/cash'); await page.getByTestId('payment-config-error').waitFor(); assert.equal(await page.getByTestId('payment-config-save-btn').isDisabled(), true); assert.equal(writes.length, 0); recover(); await page.getByRole('button', { name: 'Coba lagi', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[data-testid="payment-config-save-btn"]')?.disabled); }, { configStatus: 503 });
    await check(browser, 'Empty payment settings merge safe defaults without crashing', async ({ page, go }) => { await go('/geraina/app/payments/cash'); await page.getByTestId('payment-active').waitFor(); assert.equal(await page.getByTestId('payment-active').isChecked(), true); assert.equal(await page.locator('[data-testid="payment-config-page"] input[type="text"]').count(), 0); }, { config: {} });
    await check(browser, 'Saving one payment section cannot resubmit unrelated sections or double submit', async ({ page, go, writes }) => { await go('/geraina/app/payments/cash'); await page.waitForFunction(() => !document.querySelector('[data-testid="payment-config-save-btn"]')?.disabled); await page.evaluate(() => { const form = document.querySelector('[data-testid="payment-config-page"] form'); form.requestSubmit(); form.requestSubmit(); }); await page.waitForTimeout(150); assert.equal(writes.length, 1); assert.deepEqual(Object.keys(writes[0].body), ['cash']); });
    for (const type of ['xendit', 'doku', 'whatsapp']) await check(browser, type + ' merchant screen excludes developer webhook simulators', async ({ page, go }) => { await go('/geraina/app/integrations/' + type); assert.equal(await page.locator('[data-testid$="-sim-send"]').count(), 0); });
    for (const section of ['integrations', 'settings', 'payments', 'reports', 'staff']) await check(browser, 'Unknown ' + section + ' subsection has a safe not-found screen', async ({ page, go, writes }) => { await go('/geraina/app/' + section + '/audit-invalid-path'); await page.getByTestId('app-page-not-found').waitFor(); assert.equal(writes.length, 0); });
    await check(browser, 'Starter Owner can reach bank QRIS from the integration menu', async ({ page, go }) => { await go('/geraina/app/payments/qris'); await expandMenu(page, 'integrations'); await link(page, '/geraina/app/integrations/qris').waitFor(); }, { plan: 'starter' });
    await check(browser, 'Browser expanding a menu retains the current screen', async ({ page, go }) => { await go('/geraina/app/about'); await expandMenu(page, 'products'); assert.equal(new URL(page.url()).pathname, '/geraina/app/about'); }, { native: false });
    await check(browser, 'Legacy product deep link retains its destination and query', async ({ page, go }) => { await go('/geraina/products/categories?audit=1'); await page.getByTestId('categories-page').waitFor(); assert.equal(new URL(page.url()).pathname, '/geraina/app/products/categories'); assert.equal(new URL(page.url()).search, '?audit=1'); });
    await check(browser, 'Root app alias applies the same cashier permissions as canonical route', async ({ page, go }) => { await go('/app/pos'); await page.getByTestId('pos-page').waitFor(); assert.equal(new URL(page.url()).pathname, '/geraina/app/pos'); }, { role: 'Cashier' });
    await check(browser, 'Cashier Android dashboard does not advertise forbidden stock/report destinations', async ({ page, go }) => { await go('/geraina/app/dashboard'); await page.getByTestId('mobile-dashboard').waitFor(); assert.equal(await page.locator('[data-testid="mobile-dashboard"] a[href^="/geraina/app/inventory"],[data-testid="mobile-dashboard"] a[href^="/geraina/app/reports"]').count(), 0); }, { role: 'Cashier' });
    await check(browser, 'Bank QRIS integration retains its own subsection navigation', async ({ page, go }) => { await go('/geraina/app/integrations/qris'); await page.locator('[data-testid="bank-qris-settings"] a[href="/geraina/app/integrations/xendit"]').waitFor(); });
    await check(browser, 'EDC cannot claim activation before certified support exists', async ({ page, go }) => { await go('/geraina/app/payments/edc'); await page.getByTestId('payment-method-unavailable').waitFor(); assert.equal(await page.locator('[data-testid="payment-config-page"] input[type="checkbox"]').count(), 0); assert.equal(await page.getByTestId('payment-config-save-btn').count(), 0); });
    await check(browser, 'Billing uses the authoritative account plan without an absent subscription API', async ({ page, go, requests }) => { await go('/geraina/app/settings/billing'); assert.match(await page.getByTestId('subscription-plan-title').innerText(), /Pro/); assert.equal(requests.some(row => row.path === '/api/subscription'), false); }, { plan: 'pro' });
    await check(browser, 'License settings retain the account plan alongside subscription management', async ({page,go}) => { await go('/geraina/app/settings/license'); await page.getByTestId('license-plan').waitFor(); assert.equal(await page.getByTestId('license-plan').innerText(),'Pro'); }, {plan:'pro'});
    await check(browser, 'Website Android retains billing navigation and exposes package purchases', async ({ page, go }) => { await go('/geraina/app/settings/general'); const tab = page.locator('[data-testid="settings-page"] a[href="/geraina/app/settings/billing"]'); assert.equal(await tab.isVisible(), true); await tab.click(); await page.waitForURL('**/geraina/app/settings/billing', { waitUntil: 'domcontentloaded' }); await page.getByTestId('subscription-plan-title').waitFor(); assert.equal(await page.getByTestId('view-pricing-matrix-link').isVisible(), true); });
    for (const provider of ['doku', 'whatsapp']) await check(browser, provider + ' instructions use the Geraina callback backend', async ({ page, go }) => { await go('/geraina/app/integrations/' + provider); assert.equal(await page.locator('code').filter({ hasText: 'https://geraina-os.vercel.app/api/webhooks/' + provider }).count(), 1); assert.equal(await page.getByText('https://api.dagangos.com/api/webhooks/' + provider, { exact: true }).count(), 0); });
    await check(browser, 'Tax page does not fabricate liability or offer a no-op e-Faktur export', async ({ page, go }) => { await go('/geraina/app/reports/tax'); await page.getByTestId('tax-report-unavailable').waitFor(); assert.equal(await page.getByRole('button', { name: /e-Faktur/ }).count(), 0); assert.equal(await page.getByText('Rp 15.000.000', { exact: true }).count(), 0); });
    await check(browser, 'Sales report does not invent a daily distribution from a weekly total', async ({ page, go }) => { await go('/geraina/app/reports/sales'); await page.getByTestId('sales-daily-unavailable').waitFor(); assert.equal(await page.locator('.recharts-area').count(), 0); });
    await check(browser, 'Browser dashboard does not fabricate drawer cash or profit', async ({ page, go }) => { await go('/geraina/app/dashboard'); await page.getByRole('heading',{name:'Transaksi terbaru',exact:true}).waitFor(); await page.getByText(/Rp\s*12\.000/).first().waitFor(); assert.equal(await page.getByRole('alert').count(),0); assert.doesNotMatch(await page.locator('body').innerText(),/Uang di laci|Saldo laci|Laba hari ini/i); assert.equal(await page.locator('.recharts-pie,.recharts-area,.recharts-bar').count(), 0); }, { native: false });
  } finally {
    await browser.close();
    const report = { status: results.every(r => r.status === 'passed') ? 'passed' : 'failed', build, assets, viewportWidth: Number(process.env.GERAINA_AUDIT_WIDTH) || 1280, scope: 'Bundled UI navigation/action contracts in Chromium with Android bridge presentation and isolated fixtures; no hardware or payment-provider certification', merchantWrites: 0, results };
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, passed: results.filter(r => r.status === 'passed').length, total: results.length }));
    if (report.status !== 'passed') process.exitCode = 1;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
