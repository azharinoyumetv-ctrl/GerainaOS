const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {chromium}=require('../../frontend/node_modules/playwright');
const root=resolve(__dirname,'..'),frontend=resolve(root,'../frontend/build'),out=join(root,'app/build/reports/offline-browser');mkdirSync(out,{recursive:true});
const user={id:'offline-fixture-user',store_id:'offline-fixture-store',email:'offline@example.invalid',store_name:'Geraina offline test',role:'Owner',plan:'pro',current_module:'geraina'};
const products=[{id:'coffee',name:'Coffee fixture',sku:'5901234123457',price:12500,stock:10,category:'Drinks',unit:'pcs'}];
let submissions=[],failResponse=true;
const origin='https://dagangos.com';
const results=[],runtimeErrors=[];
async function setup(page){
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.fallback():route.abort());
 await page.route(`${origin}/geraina/**`,route=>{const path=new URL(route.request().url()).pathname;const asset=path.includes('/static/')?path.slice('/geraina/'.length):'index.html';try{return route.fulfill({path:join(frontend,asset)});}catch{return route.abort();}});
 await page.route(`${origin}/api/**`,async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:user});
  if(path==='/api/products/catalogue')return route.fulfill({json:{items:products,total:products.length,next_cursor:null}});
  if(path==='/api/payments/options')return route.fulfill({json:{methods:{cash:{enabled:true,displayed:true}},ewallet_channels:[]}});
  if(route.request().method()!=='GET'){
   assert.equal(path,'/api/offline/orders');const body=route.request().postDataJSON();submissions.push(body);
   if(failResponse)return route.fulfill({status:503,json:{detail:'Temporary fixture interruption'}});
   return route.fulfill({json:{...body,id:body.client_order_id,store_id:body.expected_store_id,order_no:'GR-FIXTURE-0001',items:body.items,subtotal:25000,total:25000,cash_received:30000,change:5000,payment_method:'cash',payment_status:'paid',created_at:body.sold_at}});
  }
  return route.fulfill({json:path==='/api/products'?products:['/api/orders','/api/debt/receivables','/api/debt/payables','/api/attendance','/api/branches','/api/customers'].includes(path)?[]:path==='/api/orders/stats'?{today_sales:0,today_orders:0,week_sales:0,month_sales:0,product_count:products.length}:path.endsWith('category-names')?['Drinks']:path==='/api/settings'?{receipt:{footer_text:'Offline fixture'}}:{}});
 });
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1016,height:1380}});
 const css=readFileSync(join(root,'app/src/main/assets/mobile-support.css'),'utf8')+'\n'+readFileSync(join(root,'app/src/main/assets/mobile-ui.css'),'utf8');
 const scripts=['android-bridge.js','device-features.js','mobile-ui.js'].map(name=>readFileSync(join(root,'app/src/main/assets',name),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');
 await context.addInitScript({content:`window.GerainaNative={postMessage:()=>{}};localStorage.setItem('geraina_token','offline-fixture-token');if(!localStorage.getItem('geraina_user')){localStorage.setItem('geraina_user',${JSON.stringify(JSON.stringify(user))});localStorage.setItem('dagangos_user',${JSON.stringify(JSON.stringify(user))});}\n${scripts}`});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>runtimeErrors.push(error.message));await setup(page);
 await page.goto(`${origin}/geraina/app/pos`);await page.getByTestId('pos-product-coffee').waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-testid="offline-status"]').textContent.includes('Buka kasir saat terhubung'));
 results.push('Catalogue persists before going offline');
 // Block every real API request while preserving the bundled app shell fixture.
 await page.route(`${origin}/api/**`,route=>route.abort());
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});
 await page.getByTestId('pos-product-coffee').click();await page.getByTestId('pos-product-coffee').click();
 await page.getByTestId('cart-cash-received').fill('30000');await page.getByTestId('checkout-btn').click();
 await page.getByTestId('receipt-pending-sync').waitFor();assert.match(await page.getByTestId('receipt-total').innerText(),/25.000/);
 const reference=await page.getByTestId('receipt-order-no').innerText();assert.match(reference,/^OFF-/);
 results.push('Offline cash checkout commits receipt and sale durably before confirmation');
 await page.getByTestId('receipt-done-btn').click();await page.reload();await page.getByTestId('pos-product-coffee').waitFor();
 assert.match(await page.getByTestId('offline-status').innerText(),/1 transaksi tersimpan/);
 await page.locator('[data-testid="offline-status"] summary').click();await page.locator('[data-testid^="local-sale-"]').click();assert.equal(await page.getByTestId('receipt-order-no').innerText(),reference);await page.getByTestId('receipt-done-btn').click();
 results.push('Restart recovers cached catalogue and the exact pending receipt');
 await page.goto(`${origin}/geraina/app/dashboard`,{waitUntil:'domcontentloaded'});await page.unroute(`${origin}/api/**`);await setup(page);
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});
 for(let attempt=0;attempt<30&&!submissions.length;attempt++)await page.waitForTimeout(100);
 assert.equal(submissions.length,1,'Replay starts from the dashboard without reopening the cashier');
 await page.goto(`${origin}/geraina/app/pos`);await page.waitForFunction(()=>document.querySelector('[data-testid="offline-status"]').textContent.includes('Temporary fixture interruption'));
 assert.ok(submissions.length>=1);const id=submissions[0].client_order_id;
 results.push('Failed synchronization retains the sale for retry');
 await page.locator('[data-testid="offline-status"] summary').click();await page.locator('[data-testid^="local-sale-"]').click();await page.getByTestId('receipt-pending-sync').waitFor();
 failResponse=false;await page.evaluate(()=>dispatchEvent(new Event('online')));await page.getByTestId('receipt-pending-sync').waitFor({state:'hidden'});assert.equal(await page.getByTestId('receipt-order-no').innerText(),'GR-FIXTURE-0001');await page.getByTestId('receipt-done-btn').click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="offline-status"]').textContent.includes('Semua transaksi lokal sudah tersinkron'));
 assert.ok(submissions.length>=2);assert.ok(submissions.every(body=>body.client_order_id===id));
 const acknowledgedCount=submissions.length;await page.getByTestId('offline-sync').click();await page.waitForTimeout(200);assert.equal(submissions.length,acknowledgedCount);
 results.push('Successful retry keeps the same ID and acknowledged sales stop replaying');
 // Switching cached account must not expose the first account's local receipts.
 await page.evaluate(()=>{const other={id:'different-user',store_id:'different-store',email:'other@example.invalid',role:'Owner',plan:'pro',current_module:'geraina'};localStorage.setItem('geraina_user',JSON.stringify(other));});
 await page.route(`${origin}/api/**`,route=>route.abort());await page.reload();await page.getByTestId('pos-page').waitFor();assert.equal(await page.locator('[data-testid^="local-sale-"]').count(),0);
 results.push('Another account cannot read or replay the first account’s local receipts');
 await page.screenshot({path:join(out,'isolated-account.png')});
 assert.deepEqual(runtimeErrors,[]);writeFileSync(join(out,'verification.json'),JSON.stringify({status:'passed',scope:'Bundled Android frontend in Chromium; all account/product/order endpoints are isolated local fixtures',results,merchantWrites:0},null,2));console.log(JSON.stringify({status:'passed',results},null,2));await context.close();
}finally{await browser.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
