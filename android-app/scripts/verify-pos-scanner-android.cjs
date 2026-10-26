// Actual installed APK and native scanner activity; disposable local API fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto'),{_android}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),serial='emulator-5568',app='com.dagangos.geraina';
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const out=path.join(root,'app/build/reports/pos-scanner');fs.mkdirSync(out,{recursive:true});
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:90000,maxBuffer:20000000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
const user={id:'scanner-fixture',store_id:'scanner-store',store_name:'Scanner test',role:'Owner',plan:'business',capabilities:['*'],is_store_owner:true};
const product={id:'scanner-product',name:'Scanner fixture',sku:'89988108',price:1000,cost:400,stock:10,active:true};
let devices=[];
(async()=>{try{
 const fixed=process.env.GERAINA_SCANNER_FIXED==='1';
 const apk=process.env.GERAINA_SCANNER_APK||path.join(root,fixed?'app/build/outputs/apk/release/app-release.apk':'releases/Geraina-POS-1.2.7.apk');
 adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);
 adb(['shell','pm','grant',app,'android.permission.CAMERA']);
 adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);
 adb(['shell','settings','put','system','accelerometer_rotation','0']);adb(['shell','settings','put','system','user_rotation','1']);
 adb(['shell','am','start','-f','0x10008000','-n',app+'/com.example.gerainapos.MainActivity']);
 devices=await _android.devices({omitDriverInstall:true});const device=devices.find(d=>d.serial()===serial);assert.ok(device);
 const page=await(await device.webView({pkg:app},{timeout:30000})).page();page.setDefaultTimeout(20000);
 let paymentConfig={cash:{is_active:true},qris_bank:{is_active:false},ewallet:{is_active:false,provider:'Xendit',channels:{}},va:{is_active:false,provider:'Midtrans',banks:{}},credit_card:{is_active:false,provider:'Midtrans'}};
 const gateways={midtrans:{label:'Midtrans',methods:{va:['BCA','BNI'],ewallet:['GoPay','ShopeePay'],credit_card:['Kartu']}},xendit:{label:'Xendit',methods:{va:['BCA'],ewallet:['OVO','DANA'],credit_card:['Kartu']}},doku:{label:'DOKU',methods:{va:['BCA'],ewallet:['OVO'],credit_card:['Kartu']}}};
 const options=()=>({schema_version:2,methods:Object.fromEntries(Object.entries(paymentConfig).map(([key,value])=>[key,{enabled:value.is_active,displayed:value.is_active,provider:String(value.provider||'').toLowerCase()}])),ewallet_channels:[],gateways});
 await page.route('https://dagangos.com/api/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()==='POST'&&url.pathname==='/api/payments/config'){paymentConfig={...paymentConfig,...request.postDataJSON()};return route.fulfill({json:paymentConfig});}
  if(request.method()!=='GET')return route.abort();
  let json=[];
  if(url.pathname==='/api/auth/me')json=user;
  else if(url.pathname==='/api/products/catalogue')json={items:[product],total:1,next_cursor:null};
  else if(url.pathname==='/api/products/lookup')json=product;
  else if(url.pathname.startsWith('/api/records/'))json={items:[],total:0,next_cursor:null};
  else if(url.pathname==='/api/settings')json={};
  else if(url.pathname==='/api/payments/options')json=options();
  else if(url.pathname==='/api/payments/config')json={...paymentConfig,checkout_options:options()};
  else if(url.pathname==='/api/payments/bank-qris')json={bank_name:'',qr_payload:'',is_active:false};
  return route.fulfill({json});
 });
 // Radios were disabled only to isolate startup. The catalogue deliberately
 // skips network reads while offline, so enable it after API interception.
 adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);
 await page.waitForFunction(()=>navigator.onLine);
 await page.goto('https://dagangos.com/geraina/login',{waitUntil:'domcontentloaded'});
 await page.evaluate(user=>{localStorage.setItem('geraina_token','scanner-fixture-token');localStorage.setItem('geraina_user',JSON.stringify(user));},user);
 await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.getByTestId('camera-scan').waitFor();
 await page.getByTestId('pos-product-scanner-product').waitFor();
 await page.getByTestId('pos-barcode-input').locator('..').click();
 if(fixed){
  const checks=[];
  async function ready(name){
   assert.ok(adb(['shell','dumpsys','activity','activities']).includes('BarcodeScannerActivity'),name+' must launch the native scanner');
   let ui='';
   for(let n=0;n<12;n++){
    adb(['shell','uiautomator','dump','/data/local/tmp/geraina-scanner.xml']);ui=adb(['shell','cat','/data/local/tmp/geraina-scanner.xml']);
    if(ui.includes('Kamera siap'))break;
    if(ui.includes('Kamera tidak dapat dibuka'))throw Error('Camera preview failed');
    await new Promise(resolve=>setTimeout(resolve,500));
   }
   assert.ok(ui.includes('Kamera siap'),name+' must initialize the camera preview');checks.push(name);
   fs.writeFileSync(path.join(out,name+'.png'),adb(['exec-out','screencap','-p'],true));
   adb(['shell','input','keyevent','KEYCODE_BACK']);await page.getByTestId('camera-scan').waitFor();
  }
  await ready('search-shortcut-camera-ready');
  await page.getByTestId('camera-scan').click();await ready('dedicated-camera-ready');
  await page.getByTestId('manual-barcode').click();
  await page.getByTestId('pos-barcode-input').fill('89988108');
  await page.getByTestId('pos-barcode-input').locator('..').getByRole('button',{name:'Scan',exact:true}).click();
  await page.getByTestId('cart-qty-0').waitFor({state:'attached'});assert.equal(await page.getByTestId('cart-qty-0').textContent(),'1');checks.push('manual-entry-adds-product');
  const installed=adb(['shell','dumpsys','package',app]);assert.match(installed,/versionCode=13\b/);checks.push('installed-1.2.8-build-13');
  await page.goto('https://dagangos.com/geraina/app/payments/va');
  await page.getByTestId('payment-provider').selectOption('midtrans');await page.getByTestId('payment-active').check();
  await page.getByTestId('payment-config-save-btn').click();await page.getByTestId('payment-readiness').filter({hasText:'Ditampilkan di Kasir.'}).waitFor();
  await page.goto('https://dagangos.com/geraina/app/pos');await page.getByTestId('pm-va').click();
  assert.equal(await page.getByTestId('pm-va').getAttribute('aria-pressed'),'true');assert.equal(await page.getByTestId('pm-doku').count(),0);
  fs.writeFileSync(path.join(out,'payment-preferences-cashier.png'),adb(['exec-out','screencap','-p'],true));
  await page.goto('https://dagangos.com/geraina/app/payments/va');await page.getByTestId('payment-active').uncheck();
  await page.getByTestId('payment-config-save-btn').click();await page.getByTestId('payment-readiness').filter({hasText:'Tidak ditampilkan'}).waitFor();
  await page.goto('https://dagangos.com/geraina/app/pos');await page.getByTestId('camera-scan').waitFor();assert.equal(await page.getByTestId('pm-va').count(),0);
  checks.push('payment-preferences-drive-cashier');
  await page.goto('https://dagangos.com/geraina/app/integrations/qris');await page.getByTestId('bank-qris-form').waitFor();
  assert.equal(await page.getByTestId('integrations-tabs').getByRole('link',{name:'QRIS bank'}).getAttribute('aria-current'),'page');
  assert.equal(await page.getByTestId('payments-tabs').count(),0);checks.push('qris-retains-integration-navigation');
  const report={status:'passed',version:'1.2.8',versionCode:13,apkSha256:createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),checks,merchantWrites:0,scope:'Actual APK and working emulated cameras on Xiaomi tablet screen profile; physical barcode recognition not certified',verifiedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 const manualOpened=await page.evaluate(()=>document.documentElement.classList.contains('ga-barcode-open'));
 await page.goto('https://dagangos.com/geraina/app/pos',{waitUntil:'domcontentloaded'});await page.getByTestId('camera-scan').waitFor();
 await page.evaluate(()=>{window.scannerMessages=[];const original=window.GerainaNative.postMessage.bind(window.GerainaNative);window.GerainaNative.postMessage=message=>{scannerMessages.push(JSON.parse(message));return original(message);};});
 await page.getByTestId('camera-scan').click();
 await new Promise(resolve=>setTimeout(resolve,2000));
 const activities=adb(['shell','dumpsys','activity','activities']);
 const scannerOpened=activities.includes('BarcodeScannerActivity');
 const messages=await page.evaluate(()=>scannerMessages.filter(m=>m.type==='scanBarcode')).catch(()=>[]);
 const report={manualOpened,scannerOpened,messages,merchantWrites:0,scope:'Installed APK on AOSP Xiaomi tablet screen profile'};
 fs.writeFileSync(path.join(out,'reproduction.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(out,'scanner.png'),adb(['exec-out','screencap','-p'],true));
 fs.writeFileSync(path.join(out,'logcat.txt'),adb(['logcat','-d','-t','250']));
 console.log(JSON.stringify(report));
 }finally{for(const d of devices)await d.close().catch(()=>{});adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
