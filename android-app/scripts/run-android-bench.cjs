const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { _android } = require('../../frontend/node_modules/playwright');
const { loadTestConfig } = require('./test-config.cjs');

const root = join(__dirname, '..');
const config = loadTestConfig();
const profiles=require('./android-device-profiles.json');
const profileId=process.env.GERAINA_DEVICE_PROFILE||'phone';
const profile=profiles[profileId];
assert.ok(profile,'A known Android device profile is required');
const primaryRotation=process.env.GERAINA_ORIENTATION==='landscape'?1:0;
const orientation=primaryRotation?'landscape':'portrait';
const serial = process.env.GERAINA_EMULATOR_SERIAL || `emulator-${profile.port}`;
if (!/^emulator-\d+$/.test(serial)) throw new Error('This local bench only operates on an emulator.');
const adbPath = process.env.GERAINA_ADB || join(process.env.USERPROFILE, 'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const app = 'com.dagangos.geraina.debug';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = join(root, 'app/build/reports/android-bench', runId);
mkdirSync(reportDir, { recursive: true });
const report = { runId, applicationId: app, store: config.store, status: 'running',
  deviceProfile:profileId,deviceLabel:profile.label,orientation,
  scope: 'Real Android debug APK: live account/navigation checks plus isolated POS/native-feature fixtures; no cloud service or merchant record writes',
  checks: [], startedAt: new Date().toISOString() };
let device, page;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const redact = text => String(text).split(config.password).join('[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]');
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function adb(args, binary = false) {
  const result = spawnSync(adbPath, ['-s', serial, ...args], {
    windowsHide: true, timeout: 90000, maxBuffer: 30 * 1024 * 1024,
    encoding: binary ? undefined : 'utf8'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(redact((result.stderr || result.stdout || `ADB exited ${result.status}`).toString()));
  return result.stdout;
}
function screen(name) {
  const file = `${name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.png`;
  writeFileSync(join(reportDir, file), adb(['exec-out', 'screencap', '-p'], true));
  return file;
}
function nativeTree() {
  adb(['shell', 'uiautomator', 'dump', '/data/local/tmp/geraina-bench-ui.xml']);
  const xml = adb(['shell', 'cat', '/data/local/tmp/geraina-bench-ui.xml']);
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map(match => {
    const attributes = {};
    for (const entry of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) attributes[entry[1]] = entry[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    return attributes;
  });
}
async function nativeFind(text, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastDumpError;
  while (Date.now() < deadline) {
    let nodes;
    try { nodes = nativeTree(); }
    catch (error) {
      // Android's hierarchy dumper can exit while a native window changes.
      // Retry the read; a tap still requires a fresh, visible matching node.
      lastDumpError = error.message; await wait(350); continue;
    }
    const node = nodes.find(item => {
      const labels = [item.text || '', item['content-desc'] || ''];
      const matches = labels.some(label => typeof text === 'string' ? label.toLowerCase() === text.toLowerCase() : text.test(label));
      const bounds = [...(item.bounds || '').matchAll(/\d+/g)].map(match => Number(match[0]));
      return matches && bounds.length === 4 && bounds[2] > bounds[0] && bounds[3] > bounds[1];
    });
    if (node) return node;
    await wait(350);
  }
  throw new Error(`Native Android control not found: ${text}${lastDumpError ? `; last hierarchy read: ${lastDumpError}` : ''}`);
}
async function nativeTap(text) {
  const node = await nativeFind(text);
  assert.notEqual(node.enabled, 'false', `Native Android control must be enabled: ${text}`);
  const bounds = [...(node.bounds || '').matchAll(/\d+/g)].map(match => Number(match[0]));
  assert.equal(bounds.length, 4, 'Native control has valid screen bounds');
  adb(['shell', 'input', 'tap', String(Math.floor((bounds[0] + bounds[2]) / 2)), String(Math.floor((bounds[1] + bounds[3]) / 2))]);
}
async function attach() {
  // Activity recreation replaces WebContents while retaining the process/socket.
  // A fresh Android connection avoids Playwright's cached Page for the old view.
  if (device) await device.close();
  const devices = await _android.devices({ omitDriverInstall: true });
  device = devices.find(item => item.serial() === serial);
  assert.ok(device, 'Playwright must detect the selected emulator');
  const deadline = Date.now() + 60000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const webview = await device.webView({ pkg: app }, { timeout: 10000 });
      page = await webview.page();
      if (page.isClosed()) throw new Error('Waiting for the recreated Android WebView.');
      page.setDefaultTimeout(25000); page.setDefaultNavigationTimeout(60000);
      return;
    } catch (error) { lastError = error; await wait(500); }
  }
  throw lastError || new Error('The Android WebView did not become available.');
}
async function visible(testId) { await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 60000 }); }
async function openCheckout(){if(await page.getByTestId('mobile-cart-open').isVisible())await page.getByTestId('mobile-cart-open').click();await visible('pos-cart');}
async function closeCheckout(){if(await page.getByTestId('mobile-cart-close').isVisible())await page.getByTestId('mobile-cart-close').click();}
async function step(name, action, critical = false) {
  const started = Date.now();
  try {
    await action();
    const screenshot = screen(name);
    report.checks.push({ name, status: 'passed', durationMs: Date.now() - started, screenshot });
    console.log(`PASS: ${name}`);
    return true;
  } catch (error) {
    let screenshot;
    try { screenshot = screen(`failed-${name}`); } catch {}
    report.checks.push({ name, status: 'failed', error: redact(error.message), durationMs: Date.now() - started, screenshot });
    console.log(`FAIL: ${name}: ${redact(error.message).slice(0, 350)}`);
    if (critical) throw new Error(`Required bench step failed: ${name}`);
    return false;
  } finally { writeReport(); }
}
function writeReport() {
  writeFileSync(join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
  const rows = report.checks.map(check => `<tr><td>${escape(check.name)}</td><td class="${check.status}">${check.status.toUpperCase()}</td><td>${(check.durationMs / 1000).toFixed(1)}s</td><td>${check.error ? escape(check.error) : ''}${check.screenshot ? ` <a href="${check.screenshot}">Screenshot</a>` : ''}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geraina Android test bench</title><style>body{font:16px/1.55 system-ui;color:#172033;background:#f3f6fa;margin:0}main{max-width:1100px;margin:35px auto;padding:30px;background:white;border-radius:16px}h1{margin-bottom:8px}p{color:#506078}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;padding:12px;border-bottom:1px solid #dce3ec;vertical-align:top}th{background:#eef3f8}.passed{color:#047857;font-weight:bold}.failed{color:#b91c1c;font-weight:bold}a{color:#0369a1}code{background:#e8eef4;padding:2px 5px}</style><main><h1>Geraina Android test bench</h1><p>${escape(report.scope)}</p><p><strong>Status: ${escape(report.status.toUpperCase())}</strong> · ${escape(report.deviceLabel)} · ${escape(orientation)} · ${escape(report.androidVersion || 'Android')}</p><p>${escape(report.displayConfiguration||'')} · ${escape(report.serial || serial)}</p><table><thead><tr><th>Automated check</th><th>Result</th><th>Duration</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table><p>Credentials and session tokens are excluded. Screenshots come from the Android emulator, including its native controls. Real printer output and payment-provider settlement are outside this suite.</p></main></html>`;
  writeFileSync(join(reportDir, 'report.html'), html);
}

const fixtureUrl = `${config.base}/geraina/android-test-fixture`;
const exportName = `geraina-bench-${Date.now()}.pdf`;
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geraina native feature checks</title><style>body{font:17px sans-serif;padding:20px;background:#f8fafc;color:#172033}button,input,a{font:inherit;margin:12px 0;padding:12px;display:block}h1{font-size:24px}</style></head><body>
<h1 id="ready">Geraina Android test fixture</h1><p>Local fixture for native features. No merchant data is changed.</p>
<button id="download" onclick="const a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob(['%PDF-1.7\\nGeraina bench export'],{type:'application/pdf'}));a.download='${exportName}';document.body.appendChild(a);a.click();window.URL.revokeObjectURL(a.href);a.remove();">Save test PDF</button>
<input id="import-file" type="file" accept=".csv,text/csv"><p id="file-result"></p>
<button id="print" onclick="window.print()">Print test page</button>
<a id="plans" href="/geraina/pricing">Subscription pricing</a><button id="spa-plans" onclick="history.pushState({},'', '/geraina/app/settings/billing')">Subscription route check</button>
<script>document.querySelector('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];document.querySelector('#file-result').textContent=file?file.name+':'+await file.text():'cancelled';});</script></body></html>`;

(async () => {
  assert.ok(existsSync(adbPath), 'Android ADB must be installed');
  assert.equal(adb(['get-state']).trim(), 'device', 'Test emulator must be connected');
  report.serial = serial;
  report.displayConfiguration=`${adb(['shell','wm','size']).trim()}; ${adb(['shell','wm','density']).trim()}`;
  report.androidConfiguration=adb(['shell','am','get-config']).split('\n')[0].trim();
  report.androidVersion = `Android ${adb(['shell', 'getprop', 'ro.build.version.release']).trim()} / API ${adb(['shell', 'getprop', 'ro.build.version.sdk']).trim()}`;
  adb(['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0']);
  adb(['shell', 'settings', 'put', 'system', 'user_rotation', String(primaryRotation)]);
  adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  adb(['shell', 'wm', 'dismiss-keyguard']);
  adb(['logcat', '-c']);
  const apk = join(root, 'app/build/outputs/apk/debug/app-debug.apk');
  assert.ok(existsSync(apk), 'Build the test APK first');
  adb(['install', '-r', apk]);
  adb(['shell', 'am', 'force-stop', app]);
  adb(['shell', 'am', 'start', '-f', '0x10008000', '-n', `${app}/com.example.gerainapos.MainActivity`]);
  const devices = await _android.devices({ omitDriverInstall: true });
  device = devices.find(item => item.serial() === serial);
  assert.ok(device, 'Playwright must detect the selected emulator');
  await attach();
  if (!config.allowWrites) {
    await page.route('**/api/**', route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && path !== '/api/auth/login') return route.abort('blockedbyclient');
      return route.continue();
    });
  }

  await step('Launch and secure native bridge', async () => {
    await page.waitForFunction(() => window.__gerainaAndroid === true, undefined, { timeout: 60000 });
    await nativeFind('Menu aplikasi');
    await page.waitForFunction(() => window.GerainaMobile?.version === 1);
    assert.equal(await page.evaluate(() => location.origin), config.base);
  }, true);

  if(profile.kind==='tablet')await step('Tablet hardware profile and orientation are verified',async()=>{
    assert.match(report.androidConfiguration,/sw(\d+)dp/);
    assert.ok(Number(report.androidConfiguration.match(/sw(\d+)dp/)[1])>=600);
    report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
    assert.equal(report.viewport.width>report.viewport.height,primaryRotation===1);
    assert.match(report.displayConfiguration,new RegExp(`${profile.width}x${profile.height}`));
  });

  await step('Live sign-in reaches the correct store', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${config.base}/geraina/login`);
    await visible('login-form');
    await page.getByTestId('login-email-input').fill(config.email);
    await page.getByTestId('login-password-input').fill(config.password);
    await page.getByTestId('login-submit-btn').click();
    await visible('dashboard-page');
    const store = await page.evaluate(() => JSON.parse(localStorage.getItem('geraina_user') || '{}').store_name);
    assert.equal(store, config.store, 'Test must stay inside the configured store');
    await page.waitForFunction(() => document.querySelector('[data-testid="mobile-revenue"]')?.textContent.includes('Rp'));
  }, true);

  await step(`Modern dashboard matches live data and fits the ${profile.kind==='tablet'?'tablet':'phone'}`, async () => {
    const stats = await page.evaluate(async () => (await fetch('/api/orders/stats', {headers:{Authorization:`Bearer ${localStorage.getItem('geraina_token')}`,'X-DagangOS-Module':'geraina'}})).json());
    assert.equal(await page.getByTestId('mobile-revenue').innerText(), `Rp ${Math.round(stats.today_sales).toLocaleString('id-ID')}`);
    assert.equal(await page.getByTestId('mobile-order-count').innerText(), String(stats.today_orders));
    assert.equal(await page.getByTestId('app-mobile-topbar').isVisible(), false);
    const geometry = await page.evaluate(() => {const hero=document.querySelector('.ga-revenue').getBoundingClientRect(),head=document.querySelector('.ga-head').getBoundingClientRect();return {hero:hero.toJSON(),head:head.toJSON(),width:innerWidth,scroll:document.documentElement.scrollWidth,color:getComputedStyle(document.querySelector('.ga-revenue')).backgroundColor};});
    assert.equal(geometry.color, 'rgb(21, 63, 48)');
    assert.ok(geometry.head.top<=30, 'Dashboard starts below the single native header without duplicate padding');
    assert.ok(geometry.hero.left>=16 && geometry.hero.right<=geometry.width-16);
    assert.ok(geometry.scroll<=geometry.width);
    await nativeFind('Laporan'); await nativeFind('Menu');
  });
  if(profile.kind==='tablet')await step('Tablet dashboard uses balanced columns without horizontal overflow',async()=>{
    const layout=await page.evaluate(()=>{const root=document.querySelector('.ga-dashboard').getBoundingClientRect(),hero=document.querySelector('.ga-revenue').getBoundingClientRect(),chart=document.querySelector('.ga-chart').getBoundingClientRect();return {root:root.toJSON(),hero:hero.toJSON(),chart:chart.toJSON(),width:innerWidth};});
    assert.ok(Math.abs(layout.root.x-(layout.width-layout.root.width)/2)<=2,'Dashboard content is centered on large tablet screens');
    if(layout.width>=720)assert.ok(layout.chart.x>layout.hero.x,'Wide tablets use two dashboard columns');
  });

  await step('Native product shortcut opens the live catalogue', async () => {
    await nativeTap('Produk'); await visible('products-page');
    await page.getByTestId('products-search').fill('ANDROID-BENCH-NO-SUCH-PRODUCT');
    await visible('products-empty');
    await page.getByTestId('products-search').fill('');
  });
  await step(`Modern product summary and filters fit the ${profile.kind==='tablet'?'tablet':'phone'}`, async () => {
    await page.waitForFunction(() => {const value=document.querySelector('[data-ga-stat="total"]')?.textContent;return value && value!=='—';});
    const geometry=await page.getByTestId('products-category-filter').boundingBox();
    const width=await page.evaluate(()=>innerWidth);
    assert.ok(geometry.x>=0 && geometry.x+geometry.width<=width);
    assert.equal(await page.locator('.ga-product-summary>div').count(),3);
    assert.ok(await page.locator('.ga-product-summary').isVisible());
  });
  if(profile.kind==='tablet')await step('Populated tablet catalogue and product dialog remain usable',async()=>{
    const items=Array.from({length:8},(_,index)=>({id:`tablet-${index}`,name:index===0?'TABLET FIXTURE A long product name for tablet layout verification':`TABLET FIXTURE Product ${index+1}`,sku:`TABLET-${index}`,price:10000+index*1000,cost:4000,stock:index+2,category:index%2?'Makanan':'Minuman',unit:'pcs'}));
    const pattern=/\/api\/products(?:\?|$)/;
    await page.route(pattern,route=>route.fulfill({json:items}));
    try{
      await page.goto(`${config.base}/geraina/app/products`);await visible('product-row-tablet-0');
      const layout=await page.getByTestId('product-row-tablet-0').evaluate(row=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cells:[...row.children].map(cell=>cell.getBoundingClientRect().toJSON())}));
      assert.ok(layout.scroll<=layout.width);assert.ok(layout.cells[0].right<=layout.cells[4].left+1,'Product name and stock badge do not overlap');
      screen('tablet-populated-product-list');
      await page.getByTestId('edit-product-tablet-0').click();await visible('product-form');
      const form=await page.getByTestId('product-form').boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      assert.ok(form.x>=0&&form.x+form.width<=viewport.width&&form.y>=0&&form.y+form.height<=viewport.height+2);
      screen('tablet-product-edit-dialog');await page.getByTestId('product-form-close').click();
    }finally{await page.unroute(pattern);await page.goto(`${config.base}/geraina/app/products`);await visible('products-page');}
  });
  await step('Product form and required-field validation', async () => {
    await page.getByTestId('new-product-btn').click(); await visible('product-form');
    assert.equal(await page.getByTestId('pf-name').evaluate(input => input.checkValidity()), false);
    await page.getByTestId('product-form-close').click();
  });
  await step('Native cashier shortcut prevents empty checkout', async () => {
    await nativeTap('Kasir'); await visible('pos-page');
    await openCheckout(); await visible('cart-empty');
    assert.equal(await page.getByTestId('checkout-btn').isDisabled(), true);
    await closeCheckout();
  });
  await step('Cashier adapts between a cart sheet and side-by-side checkout', async () => {
    if(await page.evaluate(()=>innerWidth>=720)){
      await visible('pos-cart');assert.equal(await page.getByTestId('mobile-cart-open').isVisible(),false);
      const layout=await page.evaluate(()=>({cart:document.querySelector('[data-testid="pos-cart"]').getBoundingClientRect().toJSON(),grid:document.querySelector('[data-testid="pos-product-grid"]').getBoundingClientRect().toJSON(),height:innerHeight}));
      assert.ok(layout.cart.x>=layout.grid.right,'Wide-screen checkout sits beside the catalogue');
      assert.ok(layout.cart.bottom<=layout.height+2,'Tablet checkout fits inside the visible workspace');
      assert.ok(layout.cart.width>=300);return;
    }
    const bounds=await page.getByTestId('mobile-cart-open').boundingBox(),height=await page.evaluate(()=>innerHeight);
    assert.ok(bounds.y+bounds.height<=height, 'Cart summary remains above native navigation');
    await page.getByTestId('mobile-cart-open').click(); await visible('cart-empty');
    adb(['shell','input','keyevent','KEYCODE_BACK']);
    await visible('mobile-cart-open');
    assert.equal(await page.getByTestId('pos-cart').isVisible(),false);
    await visible('pos-page');
  });
  if(profile.kind==='tablet')await step('Tablet cashier title search and populated product grid fit',async()=>{
    const names=['Kopi Susu Gula Aren dengan Susu Segar','Roti Butter','Es Teh Lemon','Croissant Cokelat','Americano','Sandwich Keju','Matcha Latte','Roti Srikaya','Cokelat Dingin','Donat Gula','Air Mineral','Kue Pisang'];
    const pattern='**/api/products',items=names.map((name,index)=>({id:`tablet-pos-${index}`,name,price:10000+index*1000,stock:20,category:index%2?'Makanan':'Minuman',sku:`DEMO-${index+1}`,unit:'pcs'}));
    await page.route(pattern,route=>route.fulfill({json:items}));
    try{
      await page.goto(`${config.base}/geraina/app/pos`);await visible('pos-product-tablet-pos-0');
      const layout=await page.evaluate(()=>{const heading=document.querySelector('[data-testid="pos-page"] h1'),search=document.querySelector('[data-testid="pos-search"]');return {height:heading.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(heading).lineHeight),heading:heading.getBoundingClientRect().toJSON(),search:search.getBoundingClientRect().toJSON(),width:innerWidth,scroll:document.documentElement.scrollWidth};});
      assert.ok(layout.height<=layout.lineHeight*1.5,'Cashier title remains on one line');assert.ok(layout.scroll<=layout.width);
      const card=await page.getByTestId('pos-product-tablet-pos-0').boundingBox();assert.ok(card.width>=130&&card.height>=44);
      await page.getByTestId('pos-product-tablet-pos-0').click();await openCheckout();
      assert.match(await page.getByTestId('cart-total').innerText(),/10[.]000/);screen('tablet-populated-cashier');
      await page.getByTestId('pos-clear-cart').click();await closeCheckout();
    }finally{await page.unroute(pattern);}
  });
  if(profile.kind==='tablet')await step('Tablet checkout remains usable with the Android keyboard open',async()=>{
    const pattern='**/api/products',previous=adb(['shell','settings','get','secure','show_ime_with_hard_keyboard']).trim();
    await page.route(pattern,route=>route.fulfill({json:[{id:'keyboard-fixture',name:'LOCAL FIXTURE Keyboard check',price:10000,stock:10,category:'Test',unit:'pcs'}]}));
    try{
      adb(['shell','settings','put','secure','show_ime_with_hard_keyboard','1']);
      await page.goto(`${config.base}/geraina/app/pos`);await visible('pos-product-keyboard-fixture');
      await page.getByTestId('pos-product-keyboard-fixture').click();await openCheckout();
      const height=await page.evaluate(()=>innerHeight);
      await page.getByTestId('cart-cash-received').click();
      await page.waitForFunction(before=>innerHeight<before-100,height,{timeout:15000});
      const keyboardState=adb(['shell','dumpsys','input_method']);
      assert.match(keyboardState,/mInputShown=true/,'The real Android soft keyboard must be visible');
      await page.getByTestId('cart-cash-received').fill('20000');
      await page.getByTestId('checkout-btn').scrollIntoViewIfNeeded();
      const button=await page.getByTestId('checkout-btn').boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      assert.ok(button.y>=0&&button.y+button.height<=viewport.height+2,'Checkout action can be scrolled above the keyboard');
      assert.ok(button.x>=0&&button.x+button.width<=viewport.width);
      screen('tablet-checkout-android-keyboard');
    }finally{
      adb(['shell','input','keyevent','KEYCODE_BACK']);
      adb(['shell','settings',previous==='null'?'delete':'put','secure','show_ime_with_hard_keyboard',...(previous==='null'?[]:[previous])]);
      await page.unroute(pattern);await page.goto(`${config.base}/geraina/app/pos`);await visible('pos-page');
    }
  });
  await step('POS totals and cash receipt using isolated local records', async () => {
    const product = { id: 'android-bench-product', name: 'LOCAL FIXTURE Android item', sku: 'ANDROID-BENCH-LOCAL',
      price: 10000, cost: 4000, stock: 10, category: 'Android bench', unit: 'pcs', active: true };
    let capturedOrder;
    const productPattern = '**/api/products';
    const orderPattern = '**/api/orders';
    await page.route(productPattern, route => route.fulfill({ json: [product] }));
    await page.route(orderPattern, async route => {
      assert.equal(route.request().method(), 'POST');
      capturedOrder = route.request().postDataJSON();
      await route.fulfill({ json: { id: 'android-bench-order', order_no: 'LOCAL-ANDROID-BENCH',
        ...capturedOrder, subtotal: 20000, tax_amount: 1900, total: 20900, change: 4100, payment_status: 'paid' } });
    });
    try {
      await page.goto(`${config.base}/geraina/app/pos`); await visible('pos-product-android-bench-product');
      await page.getByTestId('pos-product-android-bench-product').click();
      await openCheckout();
      await page.getByTestId('cart-inc-0').click();
      await page.getByTestId('cart-discount').fill('1000');
      await page.getByTestId('cart-tax').fill('10');
      await page.getByTestId('cart-cash-received').fill('25000');
      assert.match(await page.getByTestId('cart-total').innerText(), /20[.]900/);
      assert.match(await page.getByTestId('cart-change').innerText(), /4[.]100/);
      await page.getByTestId('checkout-btn').click(); await visible('receipt-dialog');
      assert.equal(capturedOrder.items.length, 1);
      assert.equal(capturedOrder.items[0].quantity, 2);
      assert.equal(capturedOrder.discount, 1000);
      assert.equal(capturedOrder.tax_percent, 10);
      assert.equal(capturedOrder.cash_received, 25000);
      assert.match(await page.getByTestId('receipt-total').innerText(), /20[.]900/);
      screen('local-fixture-cash-receipt');
      await page.getByTestId('receipt-done-btn').click();
      await openCheckout(); await visible('cart-empty');
      await closeCheckout();
    } finally {
      await page.unroute(productPattern); await page.unroute(orderPattern);
    }
  });
  await step('Inventory and reports load with the authenticated account', async () => {
    await page.goto(`${config.base}/geraina/app/inventory/overview`); await visible('stock-overview-page');
    await page.goto(`${config.base}/geraina/app/reports/sales`); await visible('reports-page');
  });
  await step('Session survives an Android app restart', async () => {
    adb(['shell', 'am', 'force-stop', app]);
    adb(['shell', 'am', 'start', '-f', '0x10008000', '-n', `${app}/com.example.gerainapos.MainActivity`]);
    await attach(); await visible('dashboard-page');
  });
  await step('Landscape and portrait recreation preserve the session', async () => {
    const opposite=primaryRotation?0:1;
    adb(['shell', 'settings', 'put', 'system', 'user_rotation', String(opposite)]);
    await wait(2000); await attach();
    if (new URL(page.url()).pathname.includes('login')) await visible('dashboard-page');
    else await visible('app-layout');
    assert.equal(await page.evaluate(() => window.innerWidth > window.innerHeight), opposite===1);
    screen(opposite?'landscape-session':'portrait-session');
    adb(['shell', 'settings', 'put', 'system', 'user_rotation', String(primaryRotation)]);
    await wait(2000); await attach(); await visible('app-layout');
  });
  await step('Deletion request dialog can be cancelled without sending', async () => {
    await nativeTap('Menu aplikasi'); await nativeTap('Minta penghapusan akun');
    await nativeFind('Buka draf email'); await nativeTap('Batal'); await nativeFind('Menu aplikasi');
  });
  await step('Support chat opens from Menu without covering the dashboard', async () => {
    assert.equal(await page.locator('.dagangos-support__launcher').isVisible(),false);
    await nativeTap('Menu aplikasi'); await nativeTap('Chat bantuan');
    await page.locator('.dagangos-support__panel').waitFor({state:'visible'});
    adb(['shell','input','keyevent','KEYCODE_BACK']);
    await wait(700);
    if(await page.locator('.dagangos-support__panel').isVisible())adb(['shell','input','keyevent','KEYCODE_BACK']);
    await page.locator('.dagangos-support__panel').waitFor({state:'hidden'});
  });
  await step('Authenticated app logs out successfully', async () => {
    await nativeTap('Menu');
    await page.getByTestId('logout-btn').click(); await visible('login-form');
  });

  await page.route('**/geraina/android-test-fixture*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto(fixtureUrl); await page.locator('#ready').waitFor();
  await step('Subscription routes are blocked by the actual native bridge', async () => {
    assert.equal(await page.locator('#plans').isVisible(), false);
    await page.locator('#spa-plans').click(); await nativeFind('Langganan Geraina');
    assert.equal(new URL(page.url()).pathname, '/geraina/android-test-fixture'); await nativeTap('Mengerti');
  });
  await step('PDF export opens the Android Save As picker', async () => {
    await page.locator('#download').click();
    await nativeFind(/^(SAVE|Save|SIMPAN|Simpan)$/);
    await nativeTap(/^(SAVE|Save|SIMPAN|Simpan)$/);
    await wait(1500); await nativeFind('Menu aplikasi');
    const destination = join(reportDir, exportName);
    adb(['pull', `/sdcard/Download/${exportName}`, destination]);
    assert.ok(readFileSync(destination).subarray(0, 8).toString().startsWith('%PDF-1.7'));
  });
  await step('PDF Save As cancellation releases the next download', async () => {
    await page.locator('#download').click(); await nativeFind(/^(SAVE|Save|SIMPAN|Simpan)$/);
    adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']); await nativeFind('Menu aplikasi');
    await page.locator('#download').click(); await nativeFind(/^(SAVE|Save|SIMPAN|Simpan)$/);
    adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']); await nativeFind('Menu aplikasi');
  });
  await step('Interrupted PDF export can be retried after restarting Android app', async () => {
    await page.locator('#download').click(); await nativeFind(/^(SAVE|Save|SIMPAN|Simpan)$/);
    adb(['shell', 'am', 'force-stop', app]);
    adb(['shell', 'am', 'start', '-f', '0x10008000', '-n', `${app}/com.example.gerainapos.MainActivity`]);
    await attach();
    await page.route('**/geraina/android-test-fixture*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.goto(fixtureUrl); await page.locator('#ready').waitFor();
    await page.locator('#download').click(); await nativeFind(/^(SAVE|Save|SIMPAN|Simpan)$/);
    adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']); await nativeFind('Menu aplikasi');
  });
  await step('CSV import uses the Android file picker and reads the selected file', async () => {
    const csv = 'name,price,stock\nAndroid bench fixture,1000,1\n';
    const csvFile = join(reportDir, 'geraina-bench-import.csv'); writeFileSync(csvFile, csv);
    adb(['push', csvFile, '/sdcard/Download/geraina-bench-import.csv']);
    await page.locator('#import-file').click();
    try { await nativeTap('geraina-bench-import.csv'); }
    catch {
      const nodes = nativeTree(); const menu = nodes.find(item => /Show roots|Open navigation|Navigation drawer/.test(item['content-desc'] || ''));
      if (menu) {
        const bounds = [...menu.bounds.matchAll(/\d+/g)].map(match => Number(match[0]));
        adb(['shell', 'input', 'tap', String((bounds[0] + bounds[2]) >> 1), String((bounds[1] + bounds[3]) >> 1)]);
        await nativeTap('Downloads'); await nativeTap('geraina-bench-import.csv');
      } else throw new Error('Downloads location was not available in the Android file picker.');
    }
    await page.waitForFunction(() => document.querySelector('#file-result')?.textContent.includes('Android bench fixture'));
  });
  await step('Native print bridge opens Android print preview', async () => {
    await page.locator('#print').click();
    const deadline = Date.now() + 20000;
    let activity = '';
    while (Date.now() < deadline) {
      activity = adb(['shell', 'dumpsys', 'activity', 'activities']);
      if (/mResumedActivity.*printspooler|topResumedActivity.*printspooler/.test(activity)) break;
      await wait(500);
    }
    assert.match(activity, /mResumedActivity.*printspooler|topResumedActivity.*printspooler/);
    screen('android-print-preview'); adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
  });
  await step('Offline connection screen and recovery', async () => {
    try {
      adb(['shell', 'svc', 'wifi', 'disable']); adb(['shell', 'svc', 'data', 'disable']);
      await page.goto(`${config.base}/geraina/login?android_bench_offline=${Date.now()}`, { timeout: 15000 }).catch(() => {});
      await nativeFind('Geraina belum dapat dibuka', 15000);
      screen('offline-connection-screen');
    } finally {
      adb(['shell', 'svc', 'wifi', 'enable']); adb(['shell', 'svc', 'data', 'enable']);
    }
    await wait(2500); await nativeTap('Coba lagi'); await visible('login-form');
  });
  await step('HTTP failure shows a native retry screen and recovers', async () => {
    // A real missing asset produces an HTTP error through WebView's native loader;
    // DevTools-fulfilled 503s do not reliably notify Android's HTTP callback.
    const failureUrl = `${config.base}/geraina/android-bench-missing-${Date.now()}.png`;
    await page.evaluate(url => GerainaNative.postMessage(JSON.stringify({ type: 'open', url })), failureUrl);
    await nativeFind('Geraina belum dapat dibuka'); await nativeFind('Coba lagi');
    await page.route(failureUrl, route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await nativeTap('Coba lagi'); await page.locator('#ready').waitFor();
    await page.unroute(failureUrl);
  });

  const log = redact(adb(['logcat', '-d', '-t', '2000']));
  writeFileSync(join(reportDir, 'android-logcat.txt'), log);
  const crashLog = redact(adb(['logcat', '-b', 'crash', '-d']));
  writeFileSync(join(reportDir, 'android-crashes.txt'), crashLog);
  if (/FATAL EXCEPTION[\s\S]{0,500}com\.dagangos\.geraina\.debug/.test(crashLog)) report.checks.push({ name: 'No Android process crashes', status: 'failed', error: 'An Android crash was recorded.', durationMs: 0 });
  else report.checks.push({ name: 'No Android process crashes', status: 'passed', durationMs: 0 });
  report.status = report.checks.some(check => check.status === 'failed') ? 'failed' : 'passed';
})().catch(error => {
  report.status = 'failed'; report.error = redact(error.message); console.error(redact(error.message));
}).finally(async () => {
  report.finishedAt = new Date().toISOString();
  try { adb(['shell', 'settings', 'put', 'system', 'user_rotation', '0']); } catch {}
  try { if (device) await device.close(); } catch {}
  writeReport();
  const pointer=JSON.stringify({path:join(reportDir,'report.html'),status:report.status,deviceProfile:profileId,orientation},null,2);
  writeFileSync(join(root,`app/build/reports/android-bench/latest-${profileId}-${orientation}.json`),pointer);
  if(profileId==='phone')writeFileSync(join(root,'app/build/reports/android-bench/latest-report.json'),pointer);
  console.log(`Android bench: ${report.status}. Report: ${join(reportDir, 'report.html')}`);
  if (report.status !== 'passed') process.exitCode = 1;
});
