// Reproduce the real Android activity lifecycle: a 303 opens a separate unpaid
// checkout activity, then the system Back button returns to the installed app.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),portal=path.dirname(root),{_android}=require(path.join(root,'frontend/node_modules/playwright'));
const baseline=process.env.GERAINA_CHECKOUT_BASELINE==='1';
const out=path.join(root,'android-app/app/build/reports/checkout-return',baseline?'baseline':'candidate');fs.mkdirSync(out,{recursive:true});
const apk=path.join(root,baseline?'android-app/releases/Geraina-POS-1.2.11.apk':'android-app/app/build/outputs/apk/release/app-release.apk');
const fixtureUrl='https://checkout.xendit.co/web/geraina-checkout-fixture',token='checkout-return-local-fixture-token';
const user={id:'checkout-owner',store_id:'checkout-store',role:'Owner',email:'checkout@example.invalid',store_name:'Checkout fixture',plan:'trial',trial_ends_at:new Date(Date.now()+10*86400000).toISOString(),stores:[{module:'geraina',id:'checkout-store'}]};
const adbExe=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
function adb(...args){const r=spawnSync(adbExe,['-s','emulator-5568',...args],{encoding:'utf8',windowsHide:true,timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function activity(pkg){for(let i=0;i<50;i++){if(adb('shell','dumpsys','activity','activities').split('\n').some(s=>/topResumedActivity/.test(s)&&s.includes(pkg)))return;await pause(100);}throw Error('Expected foreground activity: '+pkg);}
(async()=>{
 adb('install','-r','-t',path.join(root,'android-app/app/build/checkout-fixture/checkout-fixture.apk'));
 adb('shell','pm','set-app-links','--package','com.dagangos.geraina.checkoutfixture','1','checkout.xendit.co');
 adb('shell','pm','set-app-links-user-selection','--user','0','--package','com.dagangos.geraina.checkoutfixture','true','checkout.xendit.co');
 adb('install','-r',apk);adb('shell','am','force-stop','com.dagangos.geraina');adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
 const devices=await _android.devices({omitDriverInstall:true}),d=devices.find(d=>d.serial()==='emulator-5568');assert.ok(d);const checks=[];
 try{
  const page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();page.setDefaultTimeout(15000);
  const {renderSubscriptionPricing}=await import(pathToFileURL(path.join(portal,'src/subscription-checkout.js')).href);
  const html=await renderSubscriptionPricing(fs.readFileSync(path.join(portal,'public/marketing/geraina-pricing.html'),'utf8'),'geraina',new Request('https://dagangos.com/geraina/pricing'),{SUBSCRIPTION_SIGNING_KEY:'local-only',XENDIT_SECRET_KEY:'test-only',XENDIT_WEBHOOK_TOKEN:'test-only'});
  let posts=0,revoked=false;const navigations=[];
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations.push(new URL(frame.url()).pathname);});
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());if(u.origin!=='https://dagangos.com')return route.abort();
   if(r.isNavigationRequest())navigations.push(u.pathname);
   if(u.pathname.startsWith('/api/'))return revoked?route.fulfill({status:401,json:{detail:'Fixture: session revoked'}}):route.fulfill({json:u.pathname==='/api/auth/me'?user:u.pathname==='/api/subscriptions/current'?{subscription:null,plan:'trial',trial_ends_at:user.trial_ends_at,billing_model:'prepaid',auto_renew:false,can_manage:true}:u.pathname==='/api/settings'?{}:u.pathname.startsWith('/api/records/')?{items:[],total:0,next_cursor:null}:[]});
   if(u.pathname==='/geraina/pricing')return route.fulfill({contentType:'text/html',body:html});
   if(u.pathname==='/geraina/checkout'){posts++;return route.fulfill({status:303,headers:{location:fixtureUrl},body:''});}
   if(['/subscription-pricing.js','/subscription-feedback.js','/subscription-feedback.css','/product-public.css','/subscription-checkout.css'].includes(u.pathname))return route.fulfill({path:path.join(portal,'public',u.pathname.slice(1))});
   if(u.pathname.startsWith('/geraina/')||u.pathname.startsWith('/assets/brand/'))return route.continue();return route.abort();
  });
  await page.goto('https://dagangos.com/geraina/login');await page.evaluate(({user,token})=>{localStorage.setItem('geraina_token',token);localStorage.setItem('geraina_user',JSON.stringify(user));},{user,token});
  await page.goto('https://dagangos.com/geraina/app/settings/billing');await page.getByTestId('view-pricing-matrix-link').waitFor();
  const launch=async()=>{
   await page.getByTestId('view-pricing-matrix-link').click();await page.waitForURL('**/geraina/pricing');await page.locator('#plan-starter button').scrollIntoViewIfNeeded();
   await page.locator('#plan-starter button').click({noWaitAfter:true});await activity('com.dagangos.geraina.checkoutfixture');
  };
  navigations.length=0;await launch();assert.equal(posts,1);checks.push('A single Buy tap opens the separate unpaid checkout activity');
  adb('shell','input','keyevent','4');await activity('com.dagangos.geraina/');await pause(600);
  const state=await page.evaluate(()=>({path:location.pathname,busy:window.GerainaCheckoutFeedback?.busy===true,tokenRetained:localStorage.getItem('geraina_token')==='checkout-return-local-fixture-token'}));
  await page.screenshot({path:path.join(out,'returned-from-checkout.png')});
  if(baseline){
   assert.equal(state.busy,true,'Baseline must reproduce the stuck spinner');
   adb('shell','input','keyevent','4');await pause(1200);
   const passedThroughLogin=navigations.includes('/geraina/login');
   const afterBack=await page.evaluate(()=>({path:location.pathname,tokenRetained:localStorage.getItem('geraina_token')==='checkout-return-local-fixture-token'}));
   const report={status:'reproduced',installedVersion:'1.2.11',afterReturn:state,afterBack,passedThroughLogin,navigations,checkoutPosts:posts,providerRequests:0,productionWrites:0};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
  }
  await page.getByTestId('subscription-billing-management-area').waitFor();assert.equal(state.path,'/geraina/app/settings/billing');assert.equal(state.busy,false);assert.equal(state.tokenRetained,true);assert.equal(navigations.includes('/geraina/login'),false);checks.push('Android Back returns directly to signed-in billing without a spinner');
  assert.match(await page.getByTestId('subscription-plan-title').innerText(),/Trial/);checks.push('Leaving before selecting a payment method does not change the plan');
  await launch();assert.equal(posts,2);adb('shell','input','keyevent','4');await activity('com.dagangos.geraina/');await page.getByTestId('subscription-billing-management-area').waitFor();assert.equal(navigations.includes('/geraina/login'),false);checks.push('A second attempt has one request and returns cleanly again');
  await page.getByTestId('view-pricing-matrix-link').click();await page.waitForURL('**/geraina/pricing');adb('shell','input','keyevent','4');await page.getByTestId('subscription-billing-management-area').waitFor();assert.equal(navigations.includes('/geraina/login'),false);checks.push('Back from package selection also returns to billing');
  await page.goto('https://dagangos.com/geraina/app/about');await page.getByTestId('about-page').waitFor();
  await page.evaluate(url=>GerainaNative.postMessage(JSON.stringify({type:'open',url})),fixtureUrl);await activity('com.dagangos.geraina.checkoutfixture');adb('shell','input','keyevent','4');await activity('com.dagangos.geraina/');await pause(300);assert.equal(new URL(page.url()).pathname,'/geraina/app/about');checks.push('External links outside subscription checkout retain their own app screen');
  const installed=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(installed.versionName,'1.2.12');assert.equal(installed.versionCode,17);
  const validReturnLoginNavigations=navigations.filter(p=>p==='/geraina/login').length;assert.equal(validReturnLoginNavigations,0);
  await page.goto('https://dagangos.com/geraina/app/settings/billing');await page.getByTestId('view-pricing-matrix-link').waitFor();await launch();revoked=true;adb('shell','input','keyevent','4');await activity('com.dagangos.geraina/');await page.getByTestId('login-form').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('geraina_token')),null);checks.push('A genuinely revoked session still requires sign-in');
  const installedPath=adb('shell','pm','path','com.dagangos.geraina').trim().replace(/^package:/,'');assert.match(installedPath,/^\/data\/app\/.*\/base\.apk$/);const target=path.join(out,'installed-base.apk');adb('pull',installedPath,target);const apkSha256=createHash('sha256').update(fs.readFileSync(target)).digest('hex');assert.equal(apkSha256,createHash('sha256').update(fs.readFileSync(apk)).digest('hex'));
  const report={status:'passed',installed,apkSha256,checks,checkoutPosts:posts,validReturnLoginNavigations,revokedSessionRequiresLogin:true,providerRequests:0,productionWrites:0};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{for(const device of devices)await device.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
