// Exact signed APK on the owned emulator; all API traffic uses an isolated database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'app/build/reports/product-units');
const app='com.dagangos.geraina',serial='emulator-5556',host='http://127.0.0.1:8856';
const apk=path.join(root,'releases/Geraina-POS-1.2.20.apk');
const adbPath='C:/Users/azhar/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const hash=b=>createHash('sha256').update(b).digest('hex');
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:90000,maxBuffer:30*1024*1024});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
const screen=name=>fs.writeFileSync(path.join(out,name+'.png'),adb(['exec-out','screencap','-p'],true));
async function local(method,url,data,token){const r=await fetch(host+url,{method,headers:{'content-type':'application/json','x-dagangos-module':'geraina',...(token?{authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined});assert.equal(r.status,200,url);return r.json();}
let page,devices=[],pending=0;const errors=[],reads=[];
async function attach(){
 adb(['shell','am','start','-n',app+'/com.example.gerainapos.MainActivity']);
 const d=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert(d);devices=[d];
 page=await(await d.webView({pkg:app},{timeout:30000})).page();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://dagangos.com/api/**',async route=>{
  pending++;try{const r=route.request(),u=new URL(r.url()),headers={'content-type':r.headers()['content-type']||'application/json','x-dagangos-module':'geraina'};
   if(r.headers().authorization)headers.authorization=r.headers().authorization;
   const response=await fetch(host+u.pathname+u.search,{method:r.method(),headers,body:r.postDataBuffer()||undefined,signal:AbortSignal.timeout(20000)});
   reads.push({method:r.method(),path:u.pathname,status:response.status});await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:Buffer.from(await response.arrayBuffer())});
  }finally{pending--;}
 });
}
async function detach(){for(let i=0;pending&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.equal(pending,0);for(const d of devices)await Promise.race([d.close(),new Promise(r=>setTimeout(r,5000))]);devices=[];page=undefined;adb(['shell','am','force-stop',app]);}
async function go(route){if(route.startsWith('app/')&&await page.evaluate(()=>typeof window.GerainaRouter?.navigate==='function')){assert(await page.evaluate(r=>window.GerainaRouter.navigate('/geraina/'+r),route));return;}await page.goto('https://dagangos.com/geraina/'+route,{waitUntil:'domcontentloaded'});}
async function tapUnit(label){
 await page.getByTestId('pf-unit').click();
 for(let i=0;i<5;i++){
  adb(['shell','uiautomator','dump','/sdcard/unit-regression.xml']);const xml=adb(['exec-out','cat','/sdcard/unit-regression.xml']);fs.writeFileSync(path.join(out,'phone-dropdown.xml'),xml);
  const node=[...xml.matchAll(/<node\s+([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]))).find(n=>n.text===label);
  if(node){const b=node.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/).map(Number);screen('phone-native-dropdown');adb(['shell','input','tap',String(Math.round((b[1]+b[3])/2)),String(Math.round((b[2]+b[4])/2))]);return;}
  await new Promise(r=>setTimeout(r,300));
 }
 screen('missing-unit-popup');throw Error('Native unit option missing; inspect phone-dropdown.xml');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});assert.equal(adb(['shell','getprop','ro.kernel.qemu']).trim(),'1');assert.equal(adb(['shell','getprop','ro.boot.qemu.avd_name']).trim(),'Geraina_API_36');
 await local('POST','/__audit/reset',{});const session=await local('POST','/api/auth/login',{email:'owner-a@example.com',password:'DisposableAudit123'});
 adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);adb(['shell','am','force-stop',app]);
 if(adb(['shell','pm','path',app]).trim())adb(['uninstall',app]);
 adb(['shell','wm','size','1080x2400']);adb(['shell','wm','density','420']);adb(['install','-r',path.join(root,'releases/Geraina-POS-1.2.19.apk')]);
 await attach();await go('login');await page.evaluate(s=>{localStorage.setItem('geraina_token',s.access_token);localStorage.setItem('geraina_user',JSON.stringify(s.user));localStorage.setItem('unit-upgrade-marker','retained');},session);
 await go('app/products');await page.getByTestId('new-product-btn').click();assert.equal(await page.getByTestId('pf-unit').evaluate(e=>e.tagName),'INPUT');await detach();
 adb(['install','-r',apk]);const digest=hash(fs.readFileSync(apk));const installed=adb(['shell','pm','path',app]).trim().replace(/^package:/,'');assert.equal(hash(adb(['exec-out','cat',installed],true)),digest);
 await attach();await go('app/products');await page.getByTestId('new-product-btn').waitFor();
 const retained=await page.evaluate(()=>({token:localStorage.getItem('geraina_token'),marker:localStorage.getItem('unit-upgrade-marker')}));assert.equal(retained.token,session.access_token);assert.equal(retained.marker,'retained');
 const info=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(info.versionName,'1.2.20');assert.equal(info.versionCode,25);
 const profiles=[];
 for(const profile of [{name:'phone',size:'1080x2400',density:'420'},{name:'large-tablet-window',size:'2960x1848',density:'240'}]){
  if(profile.name!=='phone'){await detach();adb(['shell','wm','size',profile.size]);adb(['shell','wm','density',profile.density]);await attach();await go('app/products');await page.getByTestId('new-product-btn').waitFor();}
  await go('app/products/units');const name=profile.name==='phone'?'Kilogram':'Botol',symbol=profile.name==='phone'?'kg':'btl',label=name+' ('+symbol+')';
  await page.getByTestId('unit-name-input').fill(name);await page.getByTestId('unit-symbol-input').fill(symbol);await page.getByTestId('unit-submit').click();await page.getByTestId('unit-success').waitFor();
  await go('app/products');await page.getByTestId('new-product-btn').click();await page.getByTestId('pf-unit').locator('option').filter({hasText:label}).waitFor({state:'attached'});
  if(profile.name==='phone')await tapUnit(label);else await page.getByTestId('pf-unit').selectOption({label});
  // Native popup dismissal dispatches the WebView change asynchronously.
  await page.waitForFunction(value=>document.querySelector('[data-testid="pf-unit"]')?.value===value,'unit:'+symbol);
  assert.equal(await page.getByTestId('pf-unit').inputValue(),'unit:'+symbol);
  await page.getByTestId('pf-name').fill('Native unit '+profile.name);await page.getByTestId('pf-price').fill('5000');
  assert.equal(await page.getByTestId('pf-category').evaluate(e=>e.tagName),'SELECT');assert(await page.getByTestId('pf-photo-camera').isVisible());assert(await page.getByTestId('pf-photo-gallery').isVisible());
  await page.getByTestId('pf-save').click();await page.getByTestId('product-form-modal').waitFor({state:'hidden'});
  const [product]=await local('GET','/api/products?q='+encodeURIComponent('Native unit '+profile.name),undefined,session.access_token);assert.equal(product.unit,symbol);
  await page.getByTestId('edit-product-'+product.id).click();assert.equal(await page.getByTestId('pf-unit').locator('option:checked').textContent(),label);screen(profile.name+'-installed-form');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.getByTestId('pf-cancel').click();
  profiles.push({...profile,status:'passed',apkSha256:digest,checks:['create-unit','select-saved-unit','save-product-symbol','edit-retains-selection','category-and-photo-actions-retained'],selection:profile.name==='phone'?'native-popup-open-and-tap':'real-WebView-selectOption'});
 }
 assert.deepEqual(errors,[]);assert(reads.some(r=>r.path==='/api/records/units'));
 const result={status:'passed',verifiedAt:new Date().toISOString(),version:'1.2.20',versionCode:25,apkSha256:digest,installedApkSha256:digest,upgrade:{fromVersion:'1.2.19',status:'passed',tokenRetained:true,preferenceRetained:true},profiles,runtimeErrors:errors,productionRequests:0,productionWrites:0,scope:'Signed installed APK; owned AOSP phone/resized tablet emulator and real isolated API/MongoDB. Phone popup tapped via native UI; tablet selection through real WebView. No physical vendor certification.'};
 fs.writeFileSync(path.join(out,'android-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);try{screen('failure');}catch{}process.exitCode=1;}).finally(async()=>{await detach().catch(()=>{});adb(['shell','wm','size','reset']);adb(['shell','wm','density','reset']);adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);process.exit(process.exitCode||0);});
