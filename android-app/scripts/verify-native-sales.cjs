// Installed APK, actual device network toggles, real disposable Mongo orders.
process.env.GERAINA_SUPPORT_NATIVE='1';
const {api,reset,routes,seed,adb,serial,root}=require('./verify-support.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_android}=require(path.join(root,'frontend/node_modules/playwright'));
const out=path.join(root,'android-app/app/build/reports/native-sales',process.env.GERAINA_DEVICE_PROFILE||'xiaomi12');fs.mkdirSync(out,{recursive:true});
const checks=[];
async function until(fn){for(let i=0;i<60;i++){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Expected local sale state was not reached');}
(async()=>{
 adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');adb('shell','am','force-stop','com.dagangos.geraina');adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
 const devices=await _android.devices({omitDriverInstall:true}),d=devices.find(d=>d.serial()===serial);assert.ok(d);
 try{
  const page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();await routes(page);await reset();
  const created=await api('/api/products',{name:'Native audit coffee',sku:'NATIVE-AUDIT-COFFEE',price:12500,cost:5000,stock:10,active:true});assert.equal(created.status,200,JSON.stringify(created.data));const product=created.data;
  await seed(page);await page.goto('https://dagangos.com/geraina/app/pos');await page.getByTestId('pos-product-'+product.id).waitFor();
  const cart=async()=>{const control=page.getByTestId('mobile-cart-open');if(await control.isVisible())await control.click();};
  await page.getByTestId('pos-product-'+product.id).click();await cart();await page.getByTestId('cart-cash-received').fill('15000');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-dialog').waitFor();
  await until(async()=>(await api('/api/orders')).data.length===1);assert.equal((await api('/api/products/catalogue')).data.items[0].stock,9);checks.push('Actual installed-app cash sale persists once and decrements real stock once');await page.getByTestId('receipt-done-btn').click();
  adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await page.waitForFunction(()=>!navigator.onLine);
  await page.getByTestId('pos-product-'+product.id).click();await cart();await page.getByTestId('cart-cash-received').fill('15000');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-pending-sync').waitFor();assert.equal((await api('/api/orders')).data.length,1);checks.push('With device networking off, cash is saved locally without a server order');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('pos-product-'+product.id).waitFor();assert.ok(await page.evaluate(()=>localStorage.getItem('geraina_token')));checks.push('Offline app reload retains the signed-in customer and cached catalogue');
  adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');await page.waitForFunction(()=>navigator.onLine);await until(async()=>(await api('/api/orders')).data.length===2);assert.equal((await api('/api/products/catalogue')).data.items[0].stock,8);
  await page.reload();await page.getByTestId('pos-product-'+product.id).waitFor();assert.equal((await api('/api/orders')).data.length,2);checks.push('Reconnect synchronizes the pending sale once; reload does not duplicate revenue or stock changes');
  await page.goto('https://dagangos.com/geraina/app/sales');const sales=(await api('/api/orders')).data;for(const sale of sales)await page.getByTestId('sales-row-'+sale.id).waitFor();checks.push('Both sales appear in the installed app sales history');await page.screenshot({path:path.join(out,'synced-sales.png')});
  const installed=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(installed.versionName,'1.2.14');fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'passed',installed,checks,productionWrites:0,providerRequests:0,database:'disposable loopback Mongo',deviceNetworkToggled:true},null,2));console.log(JSON.stringify({status:'passed',checks}));
 }finally{adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');for(const device of devices)await device.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
