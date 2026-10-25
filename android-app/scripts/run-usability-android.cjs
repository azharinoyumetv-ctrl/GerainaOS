const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const checks=require('./usability-checks.cjs');
const {keyboardBack}=require('./check-keyboard-back.cjs');
const {loadTestConfig}=require('./test-config.cjs');
const config=loadTestConfig(),root=join(__dirname,'..'),profiles=require('./android-device-profiles.json');
const profileId=process.env.GERAINA_DEVICE_PROFILE||'xiaomi12',profile=profiles[profileId];assert.ok(profile);
const version=process.env.GERAINA_RELEASE_VERSION||'1.2.2',versionCode=Number(process.env.GERAINA_RELEASE_CODE||7);
assert.match(version,/^\d+\.\d+\.\d+$/);
const serial=`emulator-${profile.port}`,app='com.dagangos.geraina',apk=join(root,`releases/Geraina-POS-${version}.apk`);
const out=join(root,'app/build/reports/android-usability',`${profileId}-${new Date().toISOString().replace(/[:.]/g,'-')}`);mkdirSync(out,{recursive:true});
const report={status:'running',version,profile:profileId,serial,scope:'Installed signed APK; account sign-in plus intercepted metadata records. No merchant writes.',localFrontend:process.env.GERAINA_USE_LOCAL_FRONTEND==='1',checks:[],apkSha256:createHash('sha256').update(readFileSync(apk)).digest('hex')};
const adbPath=join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
let devices=[],page;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function adb(args,binary=false){const result=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:20000000,timeout:90000});assert.equal(result.status,0,String(result.stderr));return result.stdout;}
async function attach(){
 let lastError,connected=false;
 for(let attempt=0;attempt<3;attempt++){
  for(const device of devices)await device.close().catch(()=>{});
  try { devices=await _android.devices({omitDriverInstall:true}); }
  catch(error){lastError=error;if(!/android\.devices: FAIL/.test(error.message))throw error;await wait(500);continue;}
  const device=devices.find(item=>item.serial()===serial);assert.ok(device);
  try{page=await(await device.webView({pkg:app},{timeout:15000})).page();connected=true;if(attempt>0){report.connectionRediscoveries=(report.connectionRediscoveries||0)+1;console.log('Test connection rediscovered after Android activity recreation.');}break;}
  catch(error){lastError=error;if(!/Timeout .*event "webview"/.test(error.message))throw error;await wait(250);}
 }
 if(!connected)throw lastError;
 page.setDefaultTimeout(30000);await checks.localFrontend(page);await checks.readOnly(page);
}
async function screenshot(name){writeFileSync(join(out,`${name}.png`),adb(['exec-out','screencap','-p'],true));}
async function step(name,fn){await fn();report.checks.push({name,status:'passed'});writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));console.log(`PASS: ${name}`);}
(async()=>{try{
 adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);adb(['shell','settings','put','system','accelerometer_rotation','0']);adb(['shell','settings','put','system','user_rotation','0']);adb(['shell','cmd','uimode','night','no']);
 adb(['shell','am','start','-f','0x10008000','-n',`${app}/com.example.gerainapos.MainActivity`]);await attach();
 report.androidVersion=adb(['shell','getprop','ro.build.version.release']).trim();report.api=Number(adb(['shell','getprop','ro.build.version.sdk']).trim());
 const info=adb(['shell','dumpsys','package',app]);assert.match(info,new RegExp(`versionCode=${versionCode}\\b`));assert.match(info,/minSdk=34/);assert.doesNotMatch(info.match(/pkgFlags=\[([^\]]+)\]/)?.[1]||'',/DEBUGGABLE/);
 await step('Typed login text cursor and placeholders are readable',async()=>{report.login=await checks.loginContrast(page);await screenshot('login-readable');});
 await step('Dark system appearance retains readable login fields',async()=>{adb(['shell','cmd','uimode','night','yes']);await wait(1200);await attach();await checks.loginContrast(page);await screenshot('login-dark-system');adb(['shell','cmd','uimode','night','no']);await wait(1200);await attach();await checks.loginContrast(page);});
 await step('Real account signs in to the correct store',async()=>{await checks.signIn(page);await page.waitForFunction(()=>document.querySelector('[data-testid="mobile-revenue"]')?.textContent.includes('Rp'));await screenshot('dashboard-visible');});
 await step('Navigation groups stay open and Suite labels are readable',async()=>{report.navigation=await checks.menuChecks(page,screenshot);});
 await step('Category brand and unit validate fail recover save and edit',async()=>{report.metadata=await checks.metadataChecks(page,screenshot);});
 await step('Product dialog opens and Back dismisses it without leaving the page',async()=>{
  await page.goto(`${config.base}/geraina/app/products`);await page.getByTestId('new-product-btn').click();await page.getByTestId('product-form').waitFor();adb(['shell','input','keyevent','KEYCODE_BACK']);await page.getByTestId('product-form').waitFor({state:'hidden'});assert.ok(new URL(page.url()).pathname.endsWith('/products'));
 });
 await step('Back dismisses the Android keyboard without navigating away',()=>keyboardBack(page,adb,screenshot));
 await step('Ordinary page text resists long press while inputs allow selection',async()=>{
  const heading=page.locator('.ga-product-summary p').first();await heading.waitFor();const rect=await heading.boundingBox(),dpr=await page.evaluate(()=>devicePixelRatio);assert.ok(rect);
  adb(['shell','uiautomator','dump','/data/local/tmp/geraina-usability-ui.xml']);const xml=adb(['shell','cat','/data/local/tmp/geraina-usability-ui.xml']);
  const bounds=xml.match(/class="android.webkit.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert.ok(bounds);
  const x=String(Math.round(Number(bounds[1])+(rect.x+Math.min(30,rect.width/2))*dpr)),y=String(Math.round(Number(bounds[2])+(rect.y+rect.height/2)*dpr));
  await page.evaluate(()=>getSelection().removeAllRanges());adb(['shell','input','swipe',x,y,x,y,'900']);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  const search=page.getByTestId('products-search');await search.fill('Editable sample');await search.evaluate(input=>input.select());assert.equal(await search.evaluate(input=>input.selectionEnd-input.selectionStart),15);await search.fill('');
  await screenshot('text-selection-behavior');
 });
 if(profile.kind==='tablet')await step('Landscape keeps navigation catalogue and checkout inside the window',async()=>{
  adb(['shell','settings','put','system','user_rotation','1']);await wait(1400);await attach();
  const names=['Kopi Susu Gula Aren','Roti Butter','Es Teh Lemon','Croissant Cokelat','Americano','Sandwich Keju','Matcha Latte','Roti Srikaya'];
  await page.route('**/api/products',route=>route.fulfill({json:names.map((name,index)=>({id:`demo-${index}`,name,price:10000+index*1000,stock:20,category:index%2?'Makanan':'Minuman',sku:`DEMO-${index+1}`,unit:'pcs'}))}));
  await page.goto(`${config.base}/geraina/app/pos`);await page.getByTestId('pos-product-demo-0').waitFor();await page.getByTestId('pos-product-demo-0').click();
  const geometry=await page.evaluate(()=>({sidebar:document.querySelector('[data-testid="app-sidebar"]').getBoundingClientRect().toJSON(),cart:document.querySelector('[data-testid="pos-cart"]').getBoundingClientRect().toJSON(),height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(geometry.width>geometry.height);assert.ok(geometry.sidebar.x>=0);assert.ok(geometry.cart.bottom<=geometry.height+2);assert.ok(geometry.scroll<=geometry.width);
  await page.getByText(config.email,{exact:true}).evaluate(element=>element.textContent='demo@toko.id');
  await screenshot('landscape-cashier-navigation');
  await page.getByText('demo@toko.id',{exact:true}).evaluate((element,email)=>element.textContent=email,config.email);
  await page.getByTestId('pos-clear-cart').click();await page.unroute('**/api/products');
 });
 await step('Single Back returns to dashboard instead of stepping through web history',async()=>{
  await page.goto(`${config.base}/geraina/app/products/brands`);await page.getByTestId('brands-page').waitFor();adb(['shell','input','keyevent','KEYCODE_BACK']);await page.getByTestId('dashboard-page').waitFor();
 });
 await step('Back after the exit timeout leaves the app running',async()=>{
  await wait(2200);adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(300);assert.equal(new RegExp(`(?:mResumedActivity|topResumedActivity).*${app.replaceAll('.','\\.')}/`).test(adb(['shell','dumpsys','activity','activities'])),true,'The signed app remains resumed after the timeout');
 });
 await step('Two quick Back presses close the Android activity',async()=>{
  await wait(2200);adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(250);adb(['shell','input','keyevent','KEYCODE_BACK']);await wait(700);
  const activity=adb(['shell','dumpsys','activity','activities']);assert.equal(new RegExp(`(?:mResumedActivity|topResumedActivity).*${app.replaceAll('.','\\.')}/`).test(activity),false,'The signed app must exit; a separate debug app is allowed underneath it');await screenshot('double-back-exited');
 });
 await step('Reopening after exit retains the session',async()=>{adb(['shell','am','start','-f','0x10008000','-n',`${app}/com.example.gerainapos.MainActivity`]);await attach();await page.getByTestId('dashboard-page').waitFor();});
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.message).split(config.password).join('[REDACTED]');await screenshot('failure').catch(()=>{});console.error(report.error);process.exitCode=1;
}finally{for(const device of devices)await device.close().catch(()=>{});adb(['shell','settings','put','system','user_rotation','0']);adb(['shell','cmd','uimode','night','no']);report.finishedAt=new Date().toISOString();writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));writeFileSync(join(root,`app/build/reports/android-usability/latest-${profileId}.json`),JSON.stringify({status:report.status,path:join(out,'verification.json')},null,2));console.log(`Android usability: ${report.status}; ${out}`);}})();
