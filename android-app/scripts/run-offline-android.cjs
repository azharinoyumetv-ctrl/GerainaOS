const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const root=resolve(__dirname,'..'),profileId=process.env.GERAINA_DEVICE_PROFILE||'android14',profile=require('./android-device-profiles.json')[profileId];assert.ok(profile);
const serial=`emulator-${profile.port}`,app=process.env.GERAINA_TEST_APP_ID||'com.dagangos.geraina.debug';assert.ok(['com.dagangos.geraina.debug','com.dagangos.geraina'].includes(app));
const apk=process.env.GERAINA_TEST_APK||join(root,'app/build/outputs/apk/debug/app-debug.apk');
const out=join(root,'app/build/reports/offline-android',`${profileId}-${new Date().toISOString().replace(/[:.]/g,'-')}`);mkdirSync(out,{recursive:true});
const report={status:'running',version:'1.2.0',profile:profileId,checks:[],apkSha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),scope:'Installed APK, isolated account and sale fixtures. Emulator Wi-Fi/data are disabled for cold-start tests. No merchant writes; physical printer output is not tested.'};
const user={id:`offline-test-${randomUUID()}`,store_id:'isolated-offline-store',email:'offline@example.invalid',role:'Owner',store_name:'Offline test store',plan:'pro'};
const products=[{id:'offline-coffee',name:'Kopi Susu (contoh lokal)',sku:'5901234123457',price:12500,stock:10,unit:'pcs',category:'Minuman'}];
const adbPath=join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
let devices=[],page,submissions=[],failSync=true,disconnected=false;const runtimeErrors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function adb(args,binary=false){const result=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:20000000,timeout:90000});assert.equal(result.status,0,String(result.stderr));return result.stdout;}
async function capture(name){writeFileSync(join(out,`${name}.png`),adb(['exec-out','screencap','-p'],true));}
async function fixtures(){
 await page.route('https://dagangos.com/api/**',async route=>{
  if(disconnected)return route.abort('internetdisconnected');
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/auth/me')return route.fulfill({json:user});
  if(request.method()!=='GET'){
   assert.equal(path,'/api/offline/orders','Only isolated cash-sale replay is allowed');const body=request.postDataJSON();assert.equal(body.expected_store_id,user.store_id);assert.equal(body.expected_cashier_id,user.id);submissions.push(body);
   if(failSync)return route.fulfill({status:503,json:{detail:'Fixture: temporary synchronization failure'}});
   return route.fulfill({json:{...body,id:body.client_order_id,store_id:user.store_id,order_no:'GR-ISOLATED-0001',subtotal:25000,total:25000,cash_received:30000,change:5000,payment_method:'cash',payment_status:'paid',created_at:body.sold_at}});
  }
  return route.fulfill({json:path==='/api/products'?products:['/api/orders','/api/debt/receivables','/api/debt/payables','/api/attendance','/api/branches','/api/customers'].includes(path)?[]:path==='/api/orders/stats'?{today_sales:0,today_orders:0,week_sales:0,month_sales:0,product_count:products.length}:path.endsWith('category-names')?['Minuman']:path==='/api/settings'?{receipt:{footer_text:'Terima kasih'}}:{}});
 });
}
async function attach(){
 let error;for(let attempt=0;attempt<3;attempt++){
  for(const device of devices)await device.close();devices=await _android.devices({omitDriverInstall:true});const device=devices.find(item=>item.serial()===serial);assert.ok(device);
  try{page=await(await device.webView({pkg:app},{timeout:15000})).page();page.setDefaultTimeout(20000);page.on('pageerror',failure=>runtimeErrors.push(failure.message));await fixtures();return;}catch(failure){error=failure;}
 }throw error;
}
async function step(name,fn){await fn();report.checks.push({name,status:'passed'});writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));console.log(`PASS: ${name}`);}
function launch(){adb(['shell','am','start','-f','0x10008000','-n',`${app}/com.example.gerainapos.MainActivity`]);}
function xml(){adb(['shell','uiautomator','dump','/data/local/tmp/geraina-offline-ui.xml']);return adb(['shell','cat','/data/local/tmp/geraina-offline-ui.xml']);}
function tapResource(id){const nodes=xml().match(/<node[^>]*>/g)||[];const node=nodes.find(value=>value.includes(`resource-id="${id}"`));assert.ok(node,`Native control ${id} is visible`);const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert.ok(b);adb(['shell','input','tap',String(Math.round((+b[1]+ +b[3])/2)),String(Math.round((+b[2]+ +b[4])/2))]);}
async function waitXml(pattern){for(let attempt=0;attempt<12;attempt++){const value=xml();if(pattern.test(value))return value;await wait(500);}throw Error(`Native UI did not show ${pattern}`);}
(async()=>{try{
 adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);adb(['logcat','-b','crash','-c']);adb(['shell','pm','revoke',app,'android.permission.CAMERA']);adb(['shell','pm','clear-permission-flags',app,'android.permission.CAMERA','user-set','user-fixed']);adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);launch();await attach();
 await page.goto('https://dagangos.com/geraina/login');await page.evaluate(value=>{localStorage.setItem('geraina_token','offline-isolated-fixture-token');localStorage.setItem('dagangos_token','offline-isolated-fixture-token');localStorage.setItem('geraina_user',JSON.stringify(value));localStorage.setItem('dagangos_user',JSON.stringify(value));},user);
 await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.getByTestId('pos-product-offline-coffee').waitFor();
 await step('Bundled POS opens and stores the catalogue for offline use',async()=>{await page.waitForFunction(()=>!document.querySelector('[data-testid="offline-status"]')?.textContent.includes('Buka kasir saat terhubung'));assert.equal(await page.evaluate(()=>window.GerainaDevice.offline),true);await capture('online-catalogue-ready');});
 let reference,id;
 await step('Cash checkout succeeds with Android Wi-Fi and mobile data disabled',async()=>{
  disconnected=true;adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);await page.waitForFunction(()=>!navigator.onLine);
  await page.getByTestId('pos-product-offline-coffee').click();await page.getByTestId('pos-product-offline-coffee').click();
  const dock=page.getByTestId('mobile-cart-open');if(await dock.isVisible())await dock.click();
  await page.getByTestId('cart-cash-received').fill('30000');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-pending-sync').waitFor();reference=await page.getByTestId('receipt-order-no').innerText();assert.match(reference,/^OFF-/);assert.equal(submissions.length,0);await capture('offline-cash-receipt');await page.getByTestId('receipt-done-btn').click();
 });
 await step('Cold restart without connectivity restores the bundled screens and pending sale',async()=>{
  adb(['shell','am','force-stop',app]);launch();await attach();await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.getByTestId('pos-product-offline-coffee').waitFor();assert.match(await page.getByTestId('offline-status').innerText(),/1 transaksi tersimpan/);await page.locator('[data-testid="offline-status"] summary').click();const receipt=page.locator('[data-testid^="local-sale-"]');id=(await receipt.getAttribute('data-testid')).slice('local-sale-'.length);await receipt.click();assert.equal(await page.getByTestId('receipt-order-no').innerText(),reference);await capture('cold-restart-offline-receipt');await page.getByTestId('receipt-done-btn').click();
 });
 await step('Camera denial has a readable fallback and scanning opens without internet',async()=>{
  await page.getByTestId('camera-scan').click();await waitXml(/permission_deny_button/);tapResource('com.android.permissioncontroller:id/permission_deny_button');await waitXml(/Izin kamera ditolak/);await capture('camera-permission-denied');adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(500);
  adb(['shell','pm','grant',app,'android.permission.CAMERA']);await page.getByTestId('camera-scan').click();await waitXml(/Kamera siap/);await wait(3000);await waitXml(/Kamera siap/);await capture('camera-ready-offline');adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(500);
 });
 await step('Receipt printer selection is native and available offline',async()=>{
  await page.goto('https://dagangos.com/geraina/app/settings/printer');await page.getByTestId('android-printer-settings').waitFor();assert.equal(await page.getByRole('button',{name:'Simpan Pengaturan',exact:true}).count(),0);
  await page.getByTestId('configure-android-printer').click();await waitXml(/Hubungkan printer struk/);adb(['shell','input','keyevent','KEYCODE_BACK']);
  await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.locator('[data-testid="offline-status"] summary').click();
  await page.locator('[data-testid^="local-sale-"]').click();await page.getByTestId('receipt-bluetooth-print').click();await waitXml(/Hubungkan printer struk/);const tree=xml();assert.match(tree,/Bluetooth/);assert.match(tree,/USB \/ OTG/);await capture('offline-printer-selection');adb(['shell','input','keyevent','KEYCODE_BACK']);await page.getByTestId('receipt-done-btn').click();
 });
 await step('Connectivity restoration retains a failed replay and retries the same sale ID',async()=>{
  await page.goto('https://dagangos.com/geraina/app/dashboard',{waitUntil:'domcontentloaded'});
  await page.getByTestId('dashboard-page').waitFor();
  disconnected=false;adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);await page.waitForFunction(()=>navigator.onLine);
  for(let attempt=0;attempt<60&&!submissions.length;attempt++)await wait(100);assert.ok(submissions.length>0,'Synchronization also runs from the dashboard');
  await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-testid="offline-status"]')?.textContent.includes('Fixture: temporary synchronization failure'));assert.equal(submissions[0].client_order_id,id);
  await page.locator('[data-testid="offline-status"] summary').click();await page.locator('[data-testid^="local-sale-"]').click();await page.getByTestId('receipt-pending-sync').waitFor();failSync=false;
  adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);await page.waitForFunction(()=>!navigator.onLine);adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);await page.waitForFunction(()=>navigator.onLine);
  await page.getByTestId('receipt-pending-sync').waitFor({state:'hidden'});assert.equal(await page.getByTestId('receipt-order-no').innerText(),'GR-ISOLATED-0001');await capture('open-receipt-syncs');await page.getByTestId('receipt-done-btn').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="offline-status"]')?.textContent.includes('Semua transaksi lokal sudah tersinkron'));assert.ok(submissions.length>=2);assert.ok(submissions.every(body=>body.client_order_id===id));const count=submissions.length;await page.getByTestId('offline-sync').click();await wait(300);assert.equal(submissions.length,count);await capture('synced-without-duplicate');
 });
 assert.deepEqual(runtimeErrors,[],'The bundled frontend must not throw JavaScript errors');assert.equal(adb(['logcat','-b','crash','-d']).includes(`Process: ${app},`),false,'The tested Android app must not crash');report.status='passed';
}catch(error){report.status='failed';report.error=error.message;console.error(error.message);await capture('failure').catch(()=>{});process.exitCode=1;
}finally{adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);for(const device of devices)await device.close().catch(()=>{});report.finishedAt=new Date().toISOString();writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));writeFileSync(join(root,`app/build/reports/offline-android/latest-${profileId}.json`),JSON.stringify({path:join(out,'verification.json'),status:report.status},null,2));console.log(`Installed offline Android checks: ${report.status}; ${out}`);}})();
