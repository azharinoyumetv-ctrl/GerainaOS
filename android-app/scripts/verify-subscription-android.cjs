// Exercise the installed APK's packaged frontend against the disposable audit API.
// Only API requests are intercepted; no replacement frontend or customer login is used.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {_android,expect}=require('../../frontend/node_modules/@playwright/test');
const profiles=require('./android-device-profiles.json');
const profileId=process.env.GERAINA_DEVICE_PROFILE||'phone',profile=profiles[profileId];assert.ok(profile);
const root=path.resolve(__dirname,'..'),app='com.dagangos.geraina',version='1.2.15';
const apk=path.join(root,'releases',`Geraina-POS-${version}.apk`),serial=`emulator-${profile.port}`;
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const out=path.join(root,'app/build/reports/subscription-android',profileId+'-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
const report={status:'running',version,profile:profileId,apkSha256:crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex'),
 scope:'Installed signed APK and packaged frontend; disposable local API; no customer records or gateway requests',checks:[],requests:[],errors:[]};
let device,page;
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:60000,maxBuffer:20000000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
async function local(route,body){const r=await fetch('http://127.0.0.1:8846'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});assert.ok(r.ok,route+': '+r.status);return r.json();}
async function screenshot(name){fs.writeFileSync(path.join(out,name+'.png'),adb(['exec-out','screencap','-p'],true));}
async function scenario(name){
 await local('/__audit/reset',{products:3});await local('/__audit/scenario/'+name);
 const session=await local('/api/auth/login',{email:'owner-a@example.com',password:'DisposableAudit123'});
 await page.evaluate(session=>{localStorage.clear();localStorage.setItem('geraina_token',session.access_token);localStorage.setItem('geraina_user',JSON.stringify(session.user));},session);
 await page.goto('https://dagangos.com/geraina/app/settings/billing');
 await page.getByTestId('subscription-plan-title').waitFor();
}
async function go(route){await page.evaluate(route=>{if(!GerainaRouter.navigate(location.origin+'/geraina/app/'+route))throw new Error('Native router unavailable');},route);await page.getByTestId('route-loading').waitFor({state:'hidden'});}
(async()=>{try{
 adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);adb(['shell','am','start','-W','-n',`${app}/com.example.gerainapos.MainActivity`]);
 device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert.ok(device);
 page=await(await device.webView({pkg:app},{timeout:30000})).page();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  assert.equal(url.origin,'https://dagangos.com');
  const headers={'content-type':request.headers()['content-type']||'application/json','x-dagangos-module':'geraina'};
  if(request.headers().authorization)headers.authorization=request.headers().authorization;
  const response=await fetch('http://127.0.0.1:8846'+url.pathname+url.search,{method:request.method(),headers,body:['GET','HEAD'].includes(request.method())?undefined:request.postDataBuffer()});
  report.requests.push({method:request.method(),path:url.pathname,status:response.status});
  await route.fulfill({status:response.status,body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get('content-type')||'application/json'});
 });
 await page.goto('https://dagangos.com/geraina/login');await page.getByTestId('login-form').waitFor();
 await scenario('subscription-malformed');
 await expect(page.getByTestId('subscription-status-badge')).toHaveText('PERLU DIPERIKSA');
 await expect(page.getByTestId('subscription-expiry')).toHaveCount(0);
 await expect(page.getByTestId('tier-name')).toHaveText('Belum diketahui');
 await screenshot('unrecognized-plan-warning');await go('about');
 await expect(page.getByTestId('about-license-status')).toHaveText('Belum diketahui');
 report.checks.push('Malformed plan stays unknown across billing, tier notice and About without false paid expiry');
 await scenario('subscription-manual-business');
 await expect(page.getByTestId('subscription-plan-title')).toHaveText('Paket Business');
 await expect(page.getByTestId('subscription-status-badge')).toHaveText('AKTIF');
 await expect(page.getByTestId('subscription-expiry')).toContainText('2099');
 await expect(page.getByTestId('tier-name')).toHaveText('Business');
 await expect(page.getByTestId('addon-buy-extra_outlet')).toBeEnabled();
 await expect(page.getByTestId('addon-buy-extra_device')).toBeDisabled();
 await screenshot('business-through-2099');await go('about');
 await expect(page.getByTestId('about-license-status')).toHaveText('Business');
 await expect(page.getByTestId('about-version')).toHaveText('v'+version);
 await screenshot('business-about');
 report.checks.push('Business grant through 2099 agrees across screens and enables the Business outlet add-on');
 await scenario('subscription-expired');
 await expect(page.getByTestId('subscription-status-badge')).toHaveText('BERAKHIR');
 await expect(page.getByTestId('tier-name')).toHaveText('Paket berakhir');
 await expect(page.getByTestId('subscription-stop-button')).toHaveCount(0);
 report.checks.push('Expired paid access remains expired');
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1;await screenshot('failure').catch(()=>{});}
finally{if(device)await device.close().catch(()=>{});report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,path:out,checks:report.checks,error:report.error}));}})();
