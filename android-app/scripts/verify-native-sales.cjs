// Installed APK, actual device network toggles, real disposable Mongo orders.
process.env.GERAINA_SUPPORT_NATIVE='1';
const {api,reset,routes,seed,adb,serial,root}=require('./verify-support.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_android}=require(path.join(root,'frontend/node_modules/playwright'));
const version=process.env.GERAINA_RELEASE_VERSION||'1.2.16',fromVersion=process.env.GERAINA_UPGRADE_FROM;
assert.match(version,/^\d+\.\d+\.\d+$/);if(fromVersion)assert.match(fromVersion,/^\d+\.\d+\.\d+$/);
const apk=path.join(root,`android-app/releases/Geraina-POS-${version}.apk`);
const out=path.join(root,'android-app/app/build/reports/native-sales',version,(process.env.GERAINA_DEVICE_PROFILE||'xiaomi12')+'-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
const checks=[];
async function until(fn){for(let i=0;i<60;i++){if(await fn())return;await new Promise(r=>setTimeout(r,150));}throw Error('Expected local sale state was not reached');}
(async()=>{
 if(fromVersion){
  // Only an explicitly selected disposable Geraina AVD may be reset for an upgrade test.
  const profile=require('./android-device-profiles.json')[process.env.GERAINA_DEVICE_PROFILE||'xiaomi12'];
  assert.equal(adb('emu','avd','name').trim().split(/\r?\n/)[0].trim(),profile.avd);
  if(adb('shell','pm','list','packages','com.dagangos.geraina').includes('package:com.dagangos.geraina'))adb('uninstall','com.dagangos.geraina');
  adb('install',path.join(root,`android-app/releases/Geraina-POS-${fromVersion}.apk`));
 }else adb('install','-r',apk);
 adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');adb('shell','am','force-stop','com.dagangos.geraina');adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
 let devices=await _android.devices({omitDriverInstall:true}),d=devices.find(d=>d.serial()===serial);assert.ok(d);
 try{
  let page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();await routes(page);await reset();
  const created=await api('/api/products',{name:'Native audit coffee',sku:'NATIVE-AUDIT-COFFEE',price:12500,cost:5000,stock:10,active:true});assert.equal(created.status,200,JSON.stringify(created.data));const product=created.data;
  await seed(page);await page.goto('https://dagangos.com/geraina/app/pos');await page.getByTestId('pos-product-'+product.id).waitFor();
  const cart=async()=>{const control=page.getByTestId('mobile-cart-open');if(await control.isVisible())await control.click();};
  await page.getByTestId('pos-product-'+product.id).click();await cart();await page.getByTestId('cart-cash-received').fill('15000');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-dialog').waitFor();
  await until(async()=>(await api('/api/orders')).data.length===1);assert.equal((await api('/api/products/catalogue')).data.items[0].stock,9);checks.push('Actual installed-app cash sale persists once and decrements real stock once');await page.getByTestId('receipt-done-btn').click();
  adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await page.waitForFunction(()=>!navigator.onLine);
  await page.getByTestId('pos-product-'+product.id).click();await cart();await page.getByTestId('cart-cash-received').fill('15000');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-pending-sync').waitFor();assert.equal((await api('/api/orders')).data.length,1);checks.push('With device networking off, cash is saved locally without a server order');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('pos-product-'+product.id).waitFor();assert.ok(await page.evaluate(()=>localStorage.getItem('geraina_token')));checks.push('Offline app reload retains the signed-in customer and cached catalogue');
  if(fromVersion){
   assert.equal((await page.evaluate(()=>window.__gerainaAppInfo)).versionName,fromVersion);
   const pending=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('geraina-pos-offline-v1',1);r.onerror=()=>reject(Error('Offline store unavailable'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readonly'),get=tx.objectStore('sales').getAll();get.onsuccess=()=>resolve(get.result.filter(s=>s.status==='pending'));tx.oncomplete=()=>db.close();};}));
   assert.equal(pending.length,1);
   const token=await page.evaluate(()=>localStorage.getItem('geraina_token'));
   await page.evaluate(()=>localStorage.setItem('geraina-upgrade-preference','preserve-my-setting'));
   // WebView batches preference writes; let the old app persist before stopping it.
   await new Promise(resolve=>setTimeout(resolve,6000));
   for(const device of devices)await device.close();
   adb('shell','am','force-stop','com.dagangos.geraina');adb('install','-r',apk);
   adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
   devices=await _android.devices({omitDriverInstall:true});d=devices.find(device=>device.serial()===serial);assert.ok(d);
   page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();await routes(page);
   await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.getByTestId('pos-product-'+product.id).waitFor();
   assert.equal((await page.evaluate(()=>window.__gerainaAppInfo)).versionName,version);
   assert.equal(await page.evaluate(()=>localStorage.getItem('geraina_token')),token);
   assert.equal(await page.evaluate(()=>localStorage.getItem('geraina-upgrade-preference')),'preserve-my-setting');
   const restored=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('geraina-pos-offline-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readonly'),get=tx.objectStore('sales').getAll();get.onsuccess=()=>resolve(get.result.filter(s=>s.status==='pending'));tx.oncomplete=()=>db.close();};}));
   assert.deepEqual(restored,pending);
   assert.equal((await api('/api/orders')).data.length,1);
   checks.push(`In-place ${fromVersion} to ${version} upgrade preserves login, preference, complete catalogue and actual pending cash sale while offline`);
  }
  adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');await page.waitForFunction(()=>navigator.onLine);await until(async()=>(await api('/api/orders')).data.length===2);assert.equal((await api('/api/products/catalogue')).data.items[0].stock,8);
  await page.reload();await page.getByTestId('pos-product-'+product.id).waitFor();assert.equal((await api('/api/orders')).data.length,2);checks.push('Reconnect synchronizes the pending sale once; reload does not duplicate revenue or stock changes');
  await page.goto('https://dagangos.com/geraina/app/sales');const sales=(await api('/api/orders')).data;for(const sale of sales)await page.getByTestId('sales-row-'+sale.id).waitFor();checks.push('Both sales appear in the installed app sales history');await page.screenshot({path:path.join(out,'synced-sales.png')});
  const installed=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(installed.versionName,version);const apkSha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(apk)).digest('hex');fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'passed',profile:process.env.GERAINA_DEVICE_PROFILE||'xiaomi12',installed,fromVersion,apkSha256,checks,productionWrites:0,providerRequests:0,database:'disposable loopback Mongo',deviceNetworkToggled:true,upgradeMethod:fromVersion?'Android in-place APK installation (adb), not the unpublished update-feed delivery':null},null,2));console.log(JSON.stringify({status:'passed',path:out,checks}));
 }finally{adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');for(const device of devices)await device.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
