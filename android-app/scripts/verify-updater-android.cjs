// Uses the real public HTTPS manifest/APK and Android installer. No production URL overrides.
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const root=join(__dirname,'..'),profileId=process.env.GERAINA_DEVICE_PROFILE||'phone',profile=require('./android-device-profiles.json')[profileId];
const upgrade=process.env.GERAINA_UPDATE_MODE==='upgrade',serial=`emulator-${profile.port}`,app='com.dagangos.geraina';
const apk=join(root,upgrade?'build/update-tests/bootstrap.apk':'releases/Geraina-POS-1.2.3.apk');
const out=join(root,'app/build/reports/updater',profileId);mkdirSync(out,{recursive:true});
const report={status:'running',profile:profileId,mode:upgrade?'real-system-upgrade':'current-release',apkSha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),checks:[],merchantWrites:0};
const adbPath=join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let devices=[],page;
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:20000000,timeout:90000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
function xml(){adb(['shell','uiautomator','dump','/data/local/tmp/geraina-updater.xml']);return adb(['shell','cat','/data/local/tmp/geraina-updater.xml']);}
async function tree(pattern){const match=new RegExp(pattern.source,'i');for(let n=0;n<30;n++){const value=xml();if(match.test(value))return value;await wait(400);}throw Error(`Android UI did not show ${pattern}`);}
function tap(pattern){const match=new RegExp(pattern.source,'i'),node=(xml().match(/<node[^>]*>/g)||[]).find(n=>match.test(n));assert.ok(node,`Visible native control ${pattern}`);const b=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);adb(['shell','input','tap',String(Math.round((+b[1]+ +b[3])/2)),String(Math.round((+b[2]+ +b[4])/2))]);}
function capture(name){writeFileSync(join(out,`${name}.png`),adb(['exec-out','screencap','-p'],true));}
function launch(){adb(['shell','am','start','-f','0x10008000','-n',`${app}/com.example.gerainapos.MainActivity`]);}
async function attach(){
 for(const d of devices)await d.close().catch(()=>{});devices=await _android.devices({omitDriverInstall:true});
 const device=devices.find(d=>d.serial()===serial);assert.ok(device);page=await(await device.webView({pkg:app},{timeout:20000})).page();page.setDefaultTimeout(20000);
 await page.route('https://dagangos.com/api/**',route=>route.request().method()==='GET'?route.fulfill({status:401,json:{detail:'Isolated updater bench, no merchant session'}}):route.abort());
}
async function step(name,fn){await fn();report.checks.push({name,status:'passed'});console.log(`PASS: ${name}`);}
async function manual(){tap(/content-desc="Menu aplikasi"/);tap(/text="Periksa pembaruan"/);}
(async()=>{try{
 adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);
 if(upgrade)adb(['shell','appops','set',app,'REQUEST_INSTALL_PACKAGES','deny']);
 launch();await attach();await page.goto('https://dagangos.com/geraina/login');
 if(upgrade){
  const official=await(await fetch('https://dagangos.com/downloads/geraina/latest.json')).json();assert.equal(official.versionCode,7,'Run bootstrap upgrade before staging a newer public release');report.targetVersion=official.version;report.targetVersionCode=official.versionCode;
  await step('Automatic check offers the newer official release without opening an installer',async()=>{await tree(/Geraina 1\.2\.2 tersedia/);assert.ok(!/packageinstaller|permissioncontroller:id\/permission/.test(xml()));capture('automatic-update-banner');});
  await step('Postponing the update leaves the installed version unchanged',async()=>{tap(/content-desc="Perbarui Geraina"/);await tree(/Unduh pembaruan/);tap(/text="Nanti"/);assert.match(adb(['shell','dumpsys','package',app]),/versionCode=6\b/);});
  const sentinel=randomUUID();report.sentinelId=sentinel;
  await page.evaluate(async value=>{
   for(const k of ['geraina_token','geraina_user','dagangos_token','dagangos_user'])localStorage.removeItem(k);
   localStorage.setItem('updater-preservation',value);
   await new Promise((resolve,reject)=>{const request=indexedDB.open('geraina-pos-offline-v1',1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('cache',{keyPath:'key'});db.createObjectStore('sales',{keyPath:'key'}).createIndex('scope','scope');};request.onerror=()=>reject(Error('Fixture storage failed'));request.onsuccess=()=>{const db=request.result,tx=db.transaction('sales','readwrite',{durability:'strict'});tx.objectStore('sales').put({key:'updater-isolated:sentinel',scope:'updater-isolated',status:'pending',body:{client_order_id:value},createdAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(Error('Fixture storage commit failed'));};});
  },sentinel);
  await step('Official APK downloads and is verified before requesting installation permission',async()=>{tap(/content-desc="Perbarui Geraina"/);tap(/text="Unduh pembaruan"/);await tree(/Izinkan pembaruan Geraina/);capture('verified-update-permission-explanation');});
  await step('Denying installation permission leaves the current app usable',async()=>{tap(/text="Buka pengaturan"/);await tree(/Allow from this source|Izinkan dari sumber ini/);capture('android-source-permission');adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(700);assert.match(adb(['shell','dumpsys','package',app]),/versionCode=6\b/);await page.getByTestId('login-form').waitFor();});
  await step('Permission settings return to the standard Android update confirmation',async()=>{
   tap(/content-desc="Perbarui Geraina"/);tap(/text="Unduh pembaruan"/);await tree(/Izinkan pembaruan Geraina/);tap(/text="Buka pengaturan"/);await tree(/Allow from this source|Izinkan dari sumber ini/);
   tap(/text="Allow from this source"|text="Izinkan dari sumber ini"/);adb(['shell','input','keyevent','KEYCODE_BACK']);await tree(/text="Update"|text="Perbarui"/);capture('android-update-confirmation');
  });
  await step('Android installs the newer package over the existing app',async()=>{
   tap(/text="Update"|text="Perbarui"/);
   for(let n=0;n<90;n++){if(/versionCode=7\b/.test(adb(['shell','dumpsys','package',app])))break;await wait(500);}
   assert.match(adb(['shell','dumpsys','package',app]),/versionCode=7\b/);capture('android-update-installed');launch();await attach();await page.goto('https://dagangos.com/geraina/login');
  });
  await step('The update preserves stored preferences and the pending offline-sale record',async()=>{
   assert.equal(await page.evaluate(()=>localStorage.getItem('updater-preservation')),sentinel);
   const sale=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('geraina-pos-offline-v1',1);r.onerror=()=>reject(Error('Cannot read offline store'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readonly'),get=tx.objectStore('sales').get('updater-isolated:sentinel');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};}));
   assert.equal(sale.body.client_order_id,sentinel);assert.equal(sale.status,'pending');capture('login-after-data-preserving-update');
   await page.evaluate(()=>new Promise(resolve=>{localStorage.removeItem('updater-preservation');const r=indexedDB.open('geraina-pos-offline-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readwrite');tx.objectStore('sales').delete('updater-isolated:sentinel');tx.oncomplete=()=>{db.close();resolve();};};}));
  });
 }else{
  await step('Manual update check is available before login and refuses a downgrade',async()=>{await manual();await tree(/Geraina sudah terbaru/);assert.match(xml(),/Versi terpasang: 1\.2\.3/);capture('current-release-check');tap(/text="Tutup"/);assert.equal((await page.evaluate(()=>GerainaDevice.appInfo)).versionCode,8);});
  await step('Offline update check has a readable dismissible error',async()=>{adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);await page.waitForFunction(()=>!navigator.onLine);await manual();await tree(/Pembaruan belum dapat diperiksa/);capture('offline-update-check');tap(/text="Tutup"/);await page.getByTestId('login-form').waitFor();});
  await step('About provides the user-initiated native update check',async()=>{
   adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);await page.waitForFunction(()=>navigator.onLine);
   await page.unroute('https://dagangos.com/api/**');
   const user={id:'update-ui-fixture',store_id:'update-ui-store',store_name:'Updater UI fixture',role:'Owner',plan:'trial'};
   await page.route('https://dagangos.com/api/**',route=>route.request().method()==='GET'?route.fulfill({json:user}):route.abort());
   await page.evaluate(user=>{localStorage.setItem('geraina_token','isolated-updater-ui');localStorage.setItem('geraina_user',JSON.stringify(user));},user);
   await page.goto('https://dagangos.com/geraina/app/about');await page.getByTestId('about-check-updates').click();await tree(/Geraina sudah terbaru/);capture('about-update-check');tap(/text="Tutup"/);
  });
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=error.message;console.error(error.message);capture('failure');process.exitCode=1;
}finally{adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);for(const d of devices)await d.close().catch(()=>{});report.finishedAt=new Date().toISOString();writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(`Updater verification: ${report.status}; ${out}`);}})();
