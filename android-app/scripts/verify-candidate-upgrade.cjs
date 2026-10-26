// Disposable emulator only: real in-place APK installation, isolated API calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),serial='emulator-5560',app='com.dagangos.geraina';
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const from=path.join(root,'releases/Geraina-POS-1.2.6.apk'),to=path.join(root,'releases/candidates/1.2.7/Geraina-POS-1.2.7-candidate.apk');
const out=path.join(root,'app/build/reports/customer-fixes/upgrade');fs.mkdirSync(out,{recursive:true});
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:90000,maxBuffer:20000000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
let devices=[],page;
async function attach(){for(const d of devices)await d.close().catch(()=>{});devices=await _android.devices({omitDriverInstall:true});const d=devices.find(d=>d.serial()===serial);assert.ok(d);page=await(await d.webView({pkg:app},{timeout:30000})).page();page.setDefaultTimeout(30000);await page.route('https://dagangos.com/api/**',r=>r.request().method()==='GET'?r.fulfill({status:401,json:{detail:'Isolated upgrade bench'}}):r.abort());}
function launch(){adb(['shell','am','start','-f','0x10008000','-n',app+'/com.example.gerainapos.MainActivity']);}
(async()=>{try{
 adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);
 adb(['install','-r','-d',from]);adb(['shell','am','force-stop',app]);launch();await attach();
 await page.goto('https://dagangos.com/geraina/login',{waitUntil:'domcontentloaded'});await page.getByTestId('login-form').waitFor();
 const sentinel=randomUUID();
 await page.evaluate(async value=>{
  for(const key of ['geraina_token','geraina_user','dagangos_token','dagangos_user'])localStorage.removeItem(key);
  localStorage.setItem('geraina-127-upgrade-sentinel',value);
  await new Promise((resolve,reject)=>{const r=indexedDB.open('geraina-pos-offline-v1',1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('cache'))db.createObjectStore('cache',{keyPath:'key'});if(!db.objectStoreNames.contains('sales'))db.createObjectStore('sales',{keyPath:'key'}).createIndex('scope','scope');};r.onerror=()=>reject(Error('Cannot seed upgrade storage'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readwrite',{durability:'strict'});tx.objectStore('sales').put({key:'upgrade-127:sentinel',scope:'upgrade-127',status:'pending',body:{client_order_id:value},createdAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(Error('Cannot commit upgrade storage'));};});
 },sentinel);
 // Persist the fixture before killing its process. WebView batches localStorage
 // disk writes; immediate force-stop tests an unflushed fixture, not an upgrade.
 await new Promise(resolve=>setTimeout(resolve,6000));
 await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('login-form').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('geraina-127-upgrade-sentinel')),sentinel,'Fixture must survive a reload before upgrading');
 adb(['shell','am','force-stop',app]);adb(['install','-r',to]);launch();await attach();
 await page.goto('https://dagangos.com/geraina/login',{waitUntil:'domcontentloaded'});await page.getByTestId('login-form').waitFor();
 const installed=adb(['shell','dumpsys','package',app]);assert.match(installed,/versionCode=12\b/);assert.match(installed,/versionName=1\.2\.7\b/);
 await page.waitForFunction(()=>window.GerainaDevice?.appInfo?.versionCode===12);
 assert.equal(await page.evaluate(()=>localStorage.getItem('geraina-127-upgrade-sentinel')),sentinel);
 const sale=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('geraina-pos-offline-v1',1);r.onerror=()=>reject(Error('Cannot read upgrade storage'));r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readonly'),get=tx.objectStore('sales').get('upgrade-127:sentinel');get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};}));assert.equal(sale.body.client_order_id,sentinel);assert.equal(sale.status,'pending');
 await page.getByTestId('login-password-toggle').click();assert.equal(await page.locator('input[autocomplete="current-password"]').getAttribute('type'),'text');
 fs.writeFileSync(path.join(out,'upgraded-login.png'),adb(['exec-out','screencap','-p'],true));
 await page.evaluate(()=>new Promise(resolve=>{localStorage.removeItem('geraina-127-upgrade-sentinel');const r=indexedDB.open('geraina-pos-offline-v1',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('sales','readwrite');tx.objectStore('sales').delete('upgrade-127:sentinel');tx.oncomplete=()=>{db.close();resolve();};};}));
 const report={status:'passed',profile:'tablet7',fromVersion:'1.2.6',toVersion:'1.2.7',versionCode:12,apkSha256:createHash('sha256').update(fs.readFileSync(to)).digest('hex'),checks:['Signed APK installs over 1.2.6','Installed package and native appInfo report 1.2.7 / 12','Local preferences preserved','Pending offline sale preserved','Real WebView login and password reveal work'],merchantWrites:0,scope:'AOSP Android emulator; no physical hardware or live payments',verifiedAt:new Date().toISOString()};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{for(const d of devices)await d.close().catch(()=>{});adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
