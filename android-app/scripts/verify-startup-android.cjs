// Installed-package performance checks: real read-only test-store requests.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {_android}=require('../../frontend/node_modules/playwright');
const checks=require('./usability-checks.cjs');
const {loadTestConfig}=require('./test-config.cjs');
const config=loadTestConfig(),root=path.resolve(__dirname,'..');
const version=process.env.GERAINA_RELEASE_VERSION||'1.2.16',profileId=process.env.GERAINA_DEVICE_PROFILE||'phone';
const profile=require('./android-device-profiles.json')[profileId];assert.ok(profile);
assert.match(version,/^\d+\.\d+\.\d+$/);
const apk=path.join(root,'releases',`Geraina-POS-${version}.apk`),serial=`emulator-${profile.port}`,app='com.dagangos.geraina';
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const out=path.join(root,'app/build/reports/startup-android',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
const report={version,profile:profileId,status:'running',apkSha256:crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),scope:'Installed signed APK on Android emulator; real test-store reads; merchant writes blocked; no physical-device performance claim',checks:[],menus:[]};
let device,page;
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:60000,maxBuffer:20000000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
async function attach(){
 const devices=await _android.devices({omitDriverInstall:true});device=devices.find(x=>x.serial()===serial);assert.ok(device);
 page=await(await device.webView({pkg:app},{timeout:20000})).page();page.setDefaultTimeout(30000);await checks.readOnly(page);
}
async function screenshot(name){fs.writeFileSync(path.join(out,name+'.png'),adb(['exec-out','screencap','-p'],true));}
(async()=>{try{
 adb(['install','-r',apk]);adb(['shell','cmd','uimode','night','no']);adb(['shell','am','force-stop',app]);
 report.activityStart=adb(['shell','am','start','-W','-n',`${app}/com.example.gerainapos.MainActivity`]);
 await attach();
 await page.evaluate(()=>{for(const key of ['geraina_token','geraina_user','dagangos_token','dagangos_user','dapuros_token','dapuros_user'])localStorage.removeItem(key);});
 await checks.loginContrast(page);report.checks.push('Installed login readable');
 const t=Date.now();await checks.signIn(page);await page.getByTestId('mobile-dashboard').waitFor();
 report.loginToDashboardShellMs=Date.now()-t;
 await page.evaluate(()=>{window.__startupAndroidDocument='retained';});
 for(const route of ['products','products/categories','reports/sales','settings/general','about','pos','dashboard']){
  const start=Date.now();
  await page.evaluate(route=>{if(!GerainaRouter.navigate(location.origin+'/geraina/app/'+route))throw new Error('Navigation unavailable');},route);
  await page.waitForURL(url=>url.pathname==='/geraina/app/'+route);
  await page.getByTestId('route-loading').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('.route-stage')?.innerText.trim().length>10);
  assert.equal(await page.evaluate(()=>window.__startupAndroidDocument),'retained');
  assert.equal(await page.locator('.route-stage').evaluate(x=>getComputedStyle(x).animationName),'none');
  report.menus.push({route,shellMs:Date.now()-start});
 }
 report.checks.push('Seven menus retain the authenticated document and have no transition animation');
 await screenshot('dashboard');await device.close();device=null;
 adb(['shell','am','force-stop',app]);adb(['shell','am','start','-W','-n',`${app}/com.example.gerainapos.MainActivity`]);
 await attach();await page.getByTestId('mobile-dashboard').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('geraina_user')).store_name),config.store);
 report.checks.push('Cold activity restart retains the test-store session');
 report.status='passed';
}catch(e){report.status='failed';report.error=String(e.message).split(config.password).join('[REDACTED]');await screenshot('failure').catch(()=>{});process.exitCode=1;}
finally{if(device)await device.close().catch(()=>{});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,path:out,checks:report.checks,menus:report.menus,error:report.error}));}})();
