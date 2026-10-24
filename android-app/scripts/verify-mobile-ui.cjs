const assert = require('node:assert/strict');
const { readFileSync,mkdirSync,writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('../../frontend/node_modules/playwright');
const { loadTestConfig } = require('./test-config.cjs');
const root=join(__dirname,'..'),config=loadTestConfig(),out=join(root,'app/build/reports/mobile-ui');
const css=readFileSync(join(root,'app/src/main/assets/mobile-support.css'),'utf8')+'\n'+readFileSync(join(root,'app/src/main/assets/mobile-ui.css'),'utf8');
const mobile=readFileSync(join(root,'app/src/main/assets/mobile-ui.js'),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css));
const bridge=readFileSync(join(root,'app/src/main/assets/android-bridge.js'),'utf8');
const support=readFileSync(join(root,'app/src/main/assets/mobile-support.js'),'utf8');
const fixtures=[{id:'mobile-coffee',name:'LOCAL FIXTURE Kopi Susu',category:'Minuman',sku:'LOCAL-001',price:18000,stock:24,unit:'cup'},
  {id:'mobile-bread',name:'LOCAL FIXTURE Roti Butter',category:'Makanan',sku:'LOCAL-002',price:12000,stock:3,unit:'pcs'},
  {id:'mobile-water',name:'LOCAL FIXTURE Air Mineral',category:'Minuman',sku:'LOCAL-003',price:6000,stock:48,unit:'botol'},
  {id:'mobile-chips',name:'LOCAL FIXTURE Keripik Kentang dengan nama produk yang panjang',category:'Makanan',sku:'LOCAL-004',price:15000,stock:4,unit:'pack'}];
(async()=>{
  mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'}),checks=[],errors=[];
  try {
    const context=await browser.newContext({viewport:{width:393,height:760},deviceScaleFactor:2,serviceWorkers:'block'});
    await context.addInitScript({content:`window.GerainaNative={postMessage:raw=>{const message=JSON.parse(raw);if(message.type==='open')location.href=message.url;}};\n${bridge}\n${support}\n${mobile}`});
    const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())||new URL(route.request().url()).pathname==='/api/auth/login'?route.continue():route.abort());
    await page.goto(`${config.base}/geraina/login`);
    await page.getByTestId('login-email-input').fill(config.email);await page.getByTestId('login-password-input').fill(config.password);await page.getByTestId('login-submit-btn').click();
    await page.getByTestId('mobile-dashboard').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-testid="mobile-revenue"]')?.textContent.includes('Rp'));
    const data=await page.evaluate(async()=>{const response=await fetch('/api/orders/stats',{headers:{Authorization:`Bearer ${localStorage.getItem('geraina_token')}`,'X-DagangOS-Module':'geraina'}});return response.json();});
    assert.equal(await page.getByTestId('mobile-revenue').innerText(),`Rp ${Math.round(data.today_sales).toLocaleString('id-ID')}`);
    assert.equal(await page.getByTestId('app-mobile-topbar').isVisible(),false);
    assert.equal(await page.getByTestId('trial-upgrade-banner').isVisible(),false);
    await page.screenshot({path:join(out,'live-dashboard-webview.png')});checks.push('Live revenue matches API; duplicate header and old trial banner removed');
    await page.route(/\/api\/products(?:\?|$)/,route=>{
      const url=new URL(route.request().url()),q=(url.searchParams.get('q')||'').toLowerCase(),category=url.searchParams.get('category');
      return route.fulfill({json:fixtures.filter(product=>(!q||product.name.toLowerCase().includes(q))&&(!category||product.category===category))});
    });
    await page.goto(`${config.base}/geraina/app/products`);
    await page.getByTestId('product-row-mobile-coffee').waitFor();
    const layout=await page.evaluate(()=>{const row=document.querySelector('[data-testid="product-row-mobile-coffee"]'),cells=[...row.children].map(cell=>cell.getBoundingClientRect().toJSON());return {width:innerWidth,scroll:document.documentElement.scrollWidth,cells};});
    assert.ok(layout.scroll<=layout.width,'Catalogue must fit the phone');
    assert.ok(layout.cells[0].top<layout.cells[3].top,'Price sits below product name in the mobile row');
    await page.getByTestId('edit-product-mobile-coffee').click();await page.getByTestId('product-form').waitFor();await page.getByTestId('product-form-close').click();
    await page.getByTestId('products-search').fill('Roti');await page.waitForFunction(()=>document.querySelectorAll('[data-testid^="product-row-"]').length===1);await page.getByTestId('products-search').fill('');
    await page.waitForFunction(()=>document.querySelectorAll('[data-testid^="product-row-"]').length===4);await page.screenshot({path:join(out,'fixture-products-webview.png')});checks.push('Phone product cards, search and existing edit form work with isolated fixtures');
    await page.route('**/api/products/mobile-bread',route=>{
      assert.equal(route.request().method(),'PUT');const data=route.request().postDataJSON();Object.assign(fixtures[1],data);return route.fulfill({json:fixtures[1]});
    });
    await page.getByTestId('edit-product-mobile-bread').click();await page.getByTestId('pf-stock').fill('15');await page.getByTestId('pf-save').click();
    await page.waitForFunction(()=>document.querySelector('[data-ga-stat="low"]')?.textContent==='1');
    checks.push('Product overview refreshes after an intercepted edit without any merchant database write');
    await page.goto(`${config.base}/geraina/app/pos`);await page.getByTestId('pos-product-mobile-coffee').waitFor();
    await page.getByTestId('pos-product-mobile-coffee').click();
    assert.match(await page.getByTestId('mobile-cart-open').innerText(),/18\.000/);
    const dockBounds=await page.getByTestId('mobile-cart-open').boundingBox();assert.ok(dockBounds.y+dockBounds.height<=760,'Cart dock fits above the viewport edge');
    await page.screenshot({path:join(out,'fixture-cashier-webview.png')});
    await page.getByTestId('mobile-cart-open').click();await page.getByTestId('cart-inc-0').click();
    assert.match(await page.getByTestId('cart-total').innerText(),/36\.000/);
    await page.getByTestId('mobile-cart-close').click();assert.equal(await page.getByTestId('mobile-cart-open').isVisible(),true);
    checks.push('Two-column cashier catalogue and cart sheet preserve real React quantity/totals');
    const now=new Date().toISOString();
    const orders=[{id:'local-a',order_no:'<img src=x onerror="window.__uiInjected=true">',payment_status:'paid',payment_method:'cash',total:36000,created_at:now},{id:'local-b',order_no:'LOCAL-B',payment_status:'paid',payment_method:'qris',total:12000,created_at:now},{id:'local-pending',order_no:'LOCAL-PENDING',payment_status:'pending',payment_method:'qris',total:99000,created_at:now}];
    await page.route(/\/api\/orders(?:\?|$)/,route=>route.fulfill({json:orders}));
    await page.route('**/api/orders/stats',route=>route.fulfill({json:{today_sales:48000,today_orders:2,week_sales:48000,week_orders:2}}));
    await page.goto(`${config.base}/geraina/app/dashboard`);
    await page.waitForFunction(()=>document.querySelector('[data-testid="mobile-week-total"]')?.textContent==='Rp 48.000');
    assert.equal(await page.getByTestId('mobile-revenue').innerText(),'Rp 48.000');assert.equal(await page.getByTestId('mobile-low-stock').innerText(),'1produk');
    assert.equal(await page.locator('.ga-orders img').count(),0);assert.equal(await page.evaluate(()=>window.__uiInjected),undefined);
    assert.match(await page.locator('.ga-orders').innerText(),/Belum lunas/);
    checks.push('Real-shaped paid orders produce correct daily bars; pending orders are excluded and record text is escaped');
    await page.reload();await page.getByTestId('mobile-dashboard').waitFor();
    assert.equal(await page.evaluate(()=>GerainaMobile.openSupport()),true);await page.locator('.dagangos-support__panel').waitFor({state:'visible'});await page.locator('.dagangos-support__close').click();
    checks.push('Support is available from the menu after a full authenticated-page reload, without sending a message');
    await page.route(/\/api\/orders(?:\?|$)/,route=>route.fulfill({json:Array.from({length:1000},(_,index)=>({...orders[0],id:`local-${index}`}))}));
    await page.reload();await page.getByText('Rincian harian belum tersedia.').waitFor();assert.equal(await page.locator('.ga-bars').count(),0);
    checks.push('A truncated order window does not produce an incomplete sales chart');
    await page.route('**/api/orders/stats',route=>route.fulfill({status:503,json:{detail:'Local failure fixture'}}));
    await page.goto(`${config.base}/geraina/app/dashboard`);await page.locator('.ga-data-error').waitFor();assert.equal(await page.getByTestId('mobile-revenue').innerText(),'—');
    checks.push('Unavailable data is clearly marked rather than shown as zero');
    await page.setViewportSize({width:873,height:360});await page.goto(`${config.base}/geraina/app/pos`);await page.getByTestId('pos-product-mobile-coffee').waitFor();
    const landscape=await page.evaluate(()=>{const cart=document.querySelector('[data-testid="pos-cart"]').getBoundingClientRect(),catalogue=document.querySelector('[data-testid="pos-product-grid"]').getBoundingClientRect();return {cartX:cart.x,catalogueRight:catalogue.right,width:innerWidth,scroll:document.documentElement.scrollWidth};});
    assert.ok(landscape.cartX>=landscape.catalogueRight,'Landscape cart sits beside products');assert.ok(landscape.scroll<=landscape.width);
    checks.push('Landscape has a persistent checkout column with no horizontal overflow');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',checks},null,2));
    writeFileSync(join(out,'verification.json'),JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),scope:'Bundled Android web presentation in Chromium; isolated product fixtures, no merchant writes',checks},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(String(error.message).split(config.password).join('[REDACTED]'));process.exitCode=1;});
