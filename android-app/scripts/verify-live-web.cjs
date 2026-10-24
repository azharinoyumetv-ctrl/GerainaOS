const assert = require('node:assert/strict');
const { chromium } = require('../../frontend/node_modules/playwright');
const { join } = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const { loadTestConfig } = require('./test-config.cjs');

(async () => {
  const config = loadTestConfig();
  const output = join(__dirname, '../app/build/reports/android-bench/live-web-preflight');
  mkdirSync(output, { recursive: true });
  const report = { scope: 'Live mobile web preflight; Android native controls are tested separately', store: config.store, checks: [], status: 'running' };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    page.setDefaultTimeout(30000);
    await page.route('**/api/**', route => {
      const request = route.request();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && new URL(request.url()).pathname !== '/api/auth/login') return route.abort('blockedbyclient');
      return route.continue();
    });
    await page.goto(`${config.base}/geraina/login`);
    await page.getByTestId('login-email-input').fill(config.email);
    await page.getByTestId('login-password-input').fill(config.password);
    await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('dashboard-page').waitFor({ timeout: 60000 });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('geraina_user')).store_name), config.store);
    report.checks.push('Login opens the expected store');
    await page.screenshot({ path: join(output, 'mobile-web-dashboard.png') });
    for (const [route, testId] of [['products', 'products-page'], ['pos', 'pos-page'], ['inventory/overview', 'stock-overview-page'], ['reports/sales', 'reports-page']]) {
      await page.goto(`${config.base}/geraina/app/${route}`);
      await page.getByTestId(testId).waitFor({ timeout: 60000 });
      report.checks.push(`Live ${route} page loads`);
    }
    await page.getByTestId('mobile-menu-open-btn').click();
    await page.getByTestId('logout-btn').click();
    await page.getByTestId('login-form').waitFor();
    report.checks.push('Logout returns to login');
    report.status = 'passed';
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.status = 'failed';
    report.error = error.message.split(config.password).join('[REDACTED]');
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
