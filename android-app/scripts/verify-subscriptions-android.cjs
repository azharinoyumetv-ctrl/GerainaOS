// Actual signed APK + Android WebView. Only the disposable loopback API is used;
// checkout POSTs are intercepted before a payment provider can be contacted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),portal=path.dirname(root);
const {_android}=require(path.join(root,'frontend/node_modules/playwright'));
const out=path.join(root,'android-app/app/build/reports/subscriptions/native');fs.mkdirSync(out,{recursive:true});
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const api='http://127.0.0.1:8846',checks=[];
function adb(...args){const r=spawnSync(adbPath,['-s','emulator-5568',...args],{encoding:'utf8',windowsHide:true,timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;}
async function post(p,data={}){const r=await fetch(api+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200,await r.clone().text());return r.json();}
(async()=>{
 await post('/__audit/reset');await post('/__audit/scenario/subscription-active');
 const session=await post('/api/auth/login',{email:'owner-a@example.com',password:'DisposableAudit123'});
 adb('install','-r',path.join(root,'android-app/app/build/outputs/apk/release/app-release.apk'));
 adb('shell','am','force-stop','com.dagangos.geraina');
 adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
 const devices=await _android.devices({omitDriverInstall:true}),device=devices.find(d=>d.serial()==='emulator-5568');assert.ok(device);
 try{
  const page=await(await device.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();page.setDefaultTimeout(15000);
  const {renderSubscriptionPricing}=await import(pathToFileURL(path.join(portal,'src/subscription-checkout.js')).href);
  const html=await renderSubscriptionPricing(fs.readFileSync(path.join(portal,'public/marketing/geraina-pricing.html'),'utf8'),'geraina',new Request('https://dagangos.com/geraina/pricing'),{SUBSCRIPTION_SIGNING_KEY:'local-native-check-only',XENDIT_SECRET_KEY:'test-only',XENDIT_WEBHOOK_TOKEN:'test-only'});
  let checkout;
  await page.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.origin!=='https://dagangos.com')return route.abort();
   if(url.pathname.startsWith('/api/')){
    const headers={'content-type':'application/json','x-dagangos-module':'geraina'};
    if(r.headers().authorization)headers.authorization=r.headers().authorization;
    const response=await fetch(api+url.pathname+url.search,{method:r.method(),headers,...(r.postData()?{body:r.postData()}:{} )});
    return route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'});
   }
   if(url.pathname==='/geraina/pricing')return route.fulfill({body:html,contentType:'text/html'});
   if(url.pathname==='/geraina/checkout'){
    assert.equal(r.method(),'POST');checkout=new URLSearchParams(r.postData());
    return route.fulfill({body:'<!doctype html><h1>Checkout reached without charging</h1>',contentType:'text/html'});
   }
   if(['/subscription-pricing.js','/product-public.css','/subscription-checkout.css'].includes(url.pathname))return route.fulfill({path:path.join(portal,'public',url.pathname.slice(1))});
   if(url.pathname.startsWith('/geraina/')||url.pathname.startsWith('/assets/brand/'))return route.continue();
   return route.abort();
  });
  await page.goto('https://dagangos.com/geraina/login');
  await page.evaluate(s=>{localStorage.setItem('geraina_token',s.access_token);localStorage.setItem('geraina_user',JSON.stringify(s.user));},session);
  await page.goto('https://dagangos.com/geraina/app/settings/billing');
  const info=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(info.versionName,'1.2.10');assert.equal(info.versionCode,15);assert.equal(info.subscriptionPurchases,true);
  await page.getByTestId('subscription-stop-button').waitFor({state:'visible'});checks.push('Signed 1.2.10 APK exposes account billing');
  const expiry=await page.getByTestId('subscription-expiry').innerText();
  await page.getByTestId('subscription-stop-button').click();await page.getByTestId('subscription-stop-confirm').click();
  await page.getByTestId('subscription-stopped').waitFor({state:'visible'});assert.equal(await page.getByTestId('subscription-expiry').innerText(),expiry);checks.push('Stopping preserves the paid expiry');
  await page.screenshot({path:path.join(out,'stopped.png')});
  await page.reload();await page.getByTestId('subscription-stopped').waitFor();checks.push('Stop intent survives restarting the screen');
  await page.getByTestId('subscription-stop-button').click();await page.getByTestId('subscription-stopped').waitFor({state:'detached'});checks.push('Owner can undo the stop');
  await page.getByTestId('view-pricing-matrix-link').click();await page.waitForURL('**/geraina/pricing');
  const buy=page.locator('#plan-business .plan-purchase button');await buy.waitFor({state:'visible'});checks.push('Pricing and package choices stay inside Android');
  await page.screenshot({path:path.join(out,'pricing.png')});
  await buy.click();await page.getByRole('heading',{name:'Checkout reached without charging'}).waitFor();
  assert.equal(checkout.get('access_token'),session.access_token);assert.ok(checkout.get('cart'));checks.push('Authenticated checkout POST is allowed without exposing the token in a URL');
  const installedPath=adb('shell','pm','path','com.dagangos.geraina').trim().replace(/^package:/,'');assert.match(installedPath,/^\/data\/app\/.*\/base\.apk$/);
  const installedApk=path.join(out,'installed-base.apk');adb('pull',installedPath,installedApk);
  const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const apkSha256=hash(installedApk);assert.equal(apkSha256,hash(path.join(root,'android-app/app/build/outputs/apk/release/app-release.apk')));
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'passed',installed:info,apkSha256,checks,productionWrites:0,providerRequests:0,scope:'Large-tablet Android emulator, real bundled UI and disposable local API; payment creation intercepted'},null,2));
  console.log(JSON.stringify({status:'passed',checks}));
 }finally{for(const d of devices)await d.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
