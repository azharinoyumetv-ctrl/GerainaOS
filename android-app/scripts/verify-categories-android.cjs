// Signed installed APK; all application API requests go to the disposable loopback host.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { _android } = require('../../frontend/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'app/build/reports/product-categories');
const serial = 'emulator-5556', app = 'com.dagangos.geraina';
const host = 'http://127.0.0.1:8856';
const adbPath = 'C:/Users/azhar/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const apk = path.join(root, 'releases/Geraina-POS-1.2.18.apk');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function adb(args, binary = false) {
  const result = spawnSync(adbPath, ['-s', serial, ...args], { encoding: binary ? undefined : 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 30 * 1024 * 1024 });
  assert.equal(result.status, 0, String(result.stderr));
  return result.stdout;
}
async function local(method, url, body) {
  const r = await fetch(host + url, { method, headers: { 'content-type': 'application/json', 'x-dagangos-module': 'geraina' }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(r.status, 200, url);
  return r.json();
}
let devices = [], page, pending = 0;
const errors = [], requests = [];
async function attach() {
  adb(['shell', 'am', 'start', '-n', app + '/com.example.gerainapos.MainActivity']);
  const available = await _android.devices({ omitDriverInstall: true });
  const device = available.find(d => d.serial() === serial);
  assert(device);
  devices = [device];
  page = await (await device.webView({ pkg: app }, { timeout: 30000 })).page();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://dagangos.com/api/**', async route => {
    pending++;
    try {
      const r = route.request(), url = new URL(r.url());
      const headers = { 'content-type': r.headers()['content-type'] || 'application/json', 'x-dagangos-module': 'geraina' };
      if (r.headers().authorization) headers.authorization = r.headers().authorization;
      const response = await fetch(host + url.pathname + url.search, { method: r.method(), headers, body: r.postDataBuffer() || undefined, signal: AbortSignal.timeout(20000) });
      requests.push({ method: r.method(), path: url.pathname, status: response.status });
      await route.fulfill({ status: response.status, contentType: response.headers.get('content-type') || 'application/json', body: Buffer.from(await response.arrayBuffer()) });
    } finally { pending--; }
  });
}
async function detach() {
  if (page) await page.waitForTimeout(100);
  for (let i = 0; pending && i < 100; i++) await new Promise(r => setTimeout(r, 50));
  assert.equal(pending, 0);
  for (const device of devices) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  devices = []; page = undefined;
  adb(['shell', 'am', 'force-stop', app]);
}
async function go(route) {
  if (route.startsWith('app/') && await page.evaluate(() => typeof window.GerainaRouter?.navigate === 'function')) {
    assert(await page.evaluate(route => window.GerainaRouter.navigate('/geraina/' + route), route));
    return;
  }
  await page.goto('https://dagangos.com/geraina/' + route, { waitUntil: 'domcontentloaded' });
}
async function selectNative(name, screenshot) {
  await page.getByTestId('pf-category').click();
  adb(['shell', 'uiautomator', 'dump', '/sdcard/category-regression.xml']);
  const xml = adb(['exec-out', 'cat', '/sdcard/category-regression.xml']);
  const node = xml.match(new RegExp('<node[^>]*text="' + name + '"[^>]*>'))?.[0];
  fs.writeFileSync(path.join(out, screenshot), adb(['exec-out', 'screencap', '-p'], true));
  if (node) {
    const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    assert(bounds);
    const [, x1, y1, x2, y2] = bounds.map(Number);
    adb(['shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2))]);
  } else {
    // On this AOSP tablet window Chromium draws the popup but exposes only
    // the focused select in UIAutomator. Diagnostic screenshot/XML verified
    // the popup below that control with 50-CSS-pixel rows. Tap that actual
    // screen row, then require the DOM's selected value to confirm the hit.
    const geometry = await page.getByTestId('pf-category').evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, dpr: devicePixelRatio }));
    const selectBounds = xml.match(/<node[^>]*class="android.view.View"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*\/>/g)
      ?.map(row => row.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).map(Number))
      .find(b => Math.abs(b[3] - b[1] - geometry.width * geometry.dpr) < 3 && Math.abs(b[4] - b[2] - geometry.height * geometry.dpr) < 3);
    assert(selectBounds, 'Accessibility bounds must match the opened select geometry');
    const bounds = selectBounds;
    const index = await page.getByTestId('pf-category').evaluate((e, name) => [...e.options].findIndex(o => o.textContent === name), name);
    const dpr = await page.evaluate(() => devicePixelRatio);
    assert(index >= 0); assert.equal(dpr, 1.5, 'Grounded tablet-window geometry');
    adb(['shell', 'input', 'tap', String(Math.round((bounds[1] + bounds[3]) / 2)), String(Math.round(bounds[4] + (index + 0.5) * 50 * dpr))]);
  }
  await page.waitForFunction(name => document.querySelector('[data-testid="pf-category"] option:checked')?.textContent === name, name);
}
(async () => {
  const oldApk = path.join(root, 'releases/Geraina-POS-1.2.17.apk');
  const expectedHash = sha(fs.readFileSync(apk));
  await local('POST', '/__audit/reset', {});
  const session = await local('POST', '/api/auth/login', { email: 'owner-a@example.com', password: 'DisposableAudit123' });
  assert.equal(adb(['shell', 'getprop', 'ro.kernel.qemu']).trim(), '1');
  assert.equal(adb(['shell', 'getprop', 'ro.boot.qemu.avd_name']).trim(), 'Geraina_API_36');
  adb(['shell', 'svc', 'wifi', 'disable']); adb(['shell', 'svc', 'data', 'disable']);
  adb(['shell', 'am', 'force-stop', app]);
  // This owned emulator contains only this disposable test account. Start the
  // upgrade sequence from its published base; never clear a physical device.
  if (adb(['shell', 'pm', 'path', app]).trim()) adb(['uninstall', app]);
  adb(['shell', 'wm', 'size', '1080x2400']); adb(['shell', 'wm', 'density', '420']);
  adb(['install', '-r', oldApk]);
  await attach();
  await go('login');
  await page.evaluate(session => {
    localStorage.setItem('geraina_token', session.access_token);
    localStorage.setItem('geraina_user', JSON.stringify(session.user));
    localStorage.setItem('category-regression-upgrade-marker', 'retained');
  }, session);
  await go('app/products');
  await page.getByTestId('new-product-btn').click();
  assert.equal(await page.getByTestId('pf-category').evaluate(e => e.tagName), 'INPUT');
  await detach();
  adb(['install', '-r', apk]);
  const installedPath = adb(['shell', 'pm', 'path', app]).trim().replace(/^package:/, '');
  assert.equal(sha(adb(['exec-out', 'cat', installedPath], true)), expectedHash);
  await attach();
  await go('app/products');
  await page.getByTestId('new-product-btn').waitFor();
  const retained = await page.evaluate(() => ({ token: localStorage.getItem('geraina_token'), marker: localStorage.getItem('category-regression-upgrade-marker') }));
  assert.equal(retained.token, session.access_token); assert.equal(retained.marker, 'retained');
  const appInfo = await page.evaluate(() => window.__gerainaAppInfo);
  assert.equal(appInfo.versionName, '1.2.18'); assert.equal(appInfo.versionCode, 23);
  const profiles = [];
  for (const profile of [
    { name: 'phone', size: '1080x2400', density: '420' },
    { name: 'large-tablet-window', size: '2960x1848', density: '240' },
  ]) {
    console.log('Checking installed APK: ' + profile.name);
    if (profile.name !== 'phone') {
      // Android can replace the WebView target when display density changes.
      // Reattach to the new target instead of navigating a disposed document.
      await detach();
      adb(['shell', 'wm', 'size', profile.size]); adb(['shell', 'wm', 'density', profile.density]);
      await attach(); await go('app/products');
      await page.getByTestId('new-product-btn').waitFor();
    }
    await go('app/products/categories');
    const categoryName = profile.name === 'phone' ? 'Phone saved category' : 'Tablet saved category';
    await page.getByTestId('category-name-input').fill(categoryName);
    await page.getByTestId('category-submit').click();
    await page.getByTestId('category-success').waitFor();
    await go('app/products');
    await page.getByTestId('new-product-btn').click();
    await page.getByTestId('pf-category').locator('option').filter({ hasText: categoryName }).waitFor({ state: 'attached' });
    await selectNative(categoryName, profile.name + '-native-dropdown.png');
    await page.getByTestId('pf-name').fill('Native ' + profile.name + ' product');
    await page.getByTestId('pf-price').fill('5000');
    await page.getByTestId('pf-save').click();
    await page.getByTestId('product-form-modal').waitFor({ state: 'hidden' });
    await page.getByText('Native ' + profile.name + ' product', { exact: true }).waitFor();
    const productResponse = await fetch(host + '/api/products?q=' + encodeURIComponent('Native ' + profile.name + ' product'), { headers: { authorization: 'Bearer ' + session.access_token, 'x-dagangos-module': 'geraina' } });
    assert.equal(productResponse.status, 200);
    const [product] = await productResponse.json(); assert.equal(product.category, categoryName);
    await page.getByTestId('edit-product-' + product.id).click();
    assert.equal(await page.getByTestId('pf-category').locator('option:checked').textContent(), categoryName);
    fs.writeFileSync(path.join(out, profile.name + '-installed-form.png'), adb(['exec-out', 'screencap', '-p'], true));
    await page.getByTestId('pf-cancel').click();
    profiles.push({ ...profile, status: 'passed', checks: ['create-category', 'native-dropdown-open-and-tap', 'save-product', 'persisted-category', 'edit-retains-selection'], apkSha256: expectedHash });
  }
  assert.deepEqual(errors, []);
  assert(requests.filter(r => r.path === '/api/records/categories').length > 0);
  const result = { status: 'passed', verifiedAt: new Date().toISOString(), version: '1.2.18', versionCode: 23,
    apkSha256: expectedHash, installedApkSha256: expectedHash,
    upgrade: { fromVersion: '1.2.17', status: 'passed', tokenRetained: true, preferenceRetained: true },
    profiles, runtimeErrors: errors, productionRequests: 0, productionWrites: 0,
    scope: 'Exact signed APK on owned AOSP emulator-5556; native phone and resized large-tablet window, isolated real backend and MongoDB. Not physical vendor firmware.' };
  fs.writeFileSync(path.join(out, 'android-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
  await detach().catch(() => {});
  adb(['shell', 'wm', 'size', 'reset']); adb(['shell', 'wm', 'density', 'reset']);
  adb(['shell', 'svc', 'wifi', 'enable']); adb(['shell', 'svc', 'data', 'enable']);
  process.exit(process.exitCode || 0);
});
