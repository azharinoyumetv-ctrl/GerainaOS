// Actual checkout Worker + real backend/Mongo transactions; provider is loopback-only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),portal=path.dirname(root),{chromium,_android}=require(path.join(root,'frontend/node_modules/playwright'));
const native=process.env.GERAINA_ADDON_NATIVE==='1',out=path.join(root,'android-app/app/build/reports/addons',native?'android':'browser');fs.mkdirSync(out,{recursive:true});
const networkFetch=globalThis.fetch,base='http://127.0.0.1:8848',checks=[],errors=[];let session;
async function api(p,body,method=body?'POST':'GET'){
 const r=await networkFetch(base+p,{method,headers:{'Content-Type':'application/json','X-DagangOS-Module':'geraina',...(session?{Authorization:'Bearer '+session.access_token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();return {status:r.status,data:text?JSON.parse(text):null};
}
async function reset(plan){assert.equal((await api('/__audit/reset',{plan})).status,200);const r=await api('/api/auth/login',{email:'owner@example.com',password:'DisposableAudit123'});assert.equal(r.status,200,JSON.stringify(r.data));session=r.data;}
const snapshot=async()=>(await api('/__audit/snapshot')).data;
const device=async id=>api('/api/devices',{device_id:id,name:id});
const addonCounts=async()=>(await api('/api/subscriptions/current')).data.addons;
async function seed(page){await page.goto('https://dagangos.com/geraina/login');await page.evaluate(s=>{localStorage.clear();localStorage.setItem('geraina_token',s.access_token);localStorage.setItem('geraina_user',JSON.stringify(s.user));},session);}
async function billing(page){await page.goto('https://dagangos.com/geraina/app/settings/billing');await page.getByTestId('addon-management').waitFor();}
const env={SUBSCRIPTION_SIGNING_KEY:'addon-audit-key',XENDIT_SECRET_KEY:'local-only',XENDIT_WEBHOOK_TOKEN:'local-only',GERAINA_BACKEND_ORIGIN:'geraina-addon.test'};
globalThis.fetch=async(url,init={})=>{
 const u=new URL(url);
 if(u.origin==='https://geraina-addon.test')return networkFetch(base+u.pathname+u.search,init);
 if(u.origin==='https://api.xendit.co'&&u.pathname==='/v2/invoices'){
  if(init.method==='POST')return networkFetch(base+'/__audit/invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:init.body});
  const r=await networkFetch(base+'/__audit/invoice/'+u.searchParams.get('external_id'));const invoice=await r.json();return Response.json(invoice?[invoice]:[]);
 }
 throw Error('Forbidden network call: '+u.origin+u.pathname);
};
async function installRoutes(page,checkout){
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 page.on('console',m=>{if(m.type()==='error'&&m.text().includes('Content Security Policy'))errors.push(m.text());});
 if(!native){const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://checkout.xendit.co/*','https://checkout-staging.xendit.co/*']});}
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin==='https://checkout.xendit.co'&&!native)return route.fulfill({contentType:'text/html',body:'<h1>Unpaid local checkout fixture</h1>'});
  if(u.origin!=='https://dagangos.com')return route.abort();
  if(u.pathname.startsWith('/api/')){
   const response=await networkFetch(base+u.pathname+u.search,{method:r.method(),headers:r.headers(),...(r.postData()?{body:r.postData()}: {})});return route.fulfill({status:response.status,headers:{'Content-Type':'application/json'},body:await response.text()});
  }
  if(u.pathname==='/geraina/pricing')return route.fulfill({contentType:'text/html',body:await checkout.renderSubscriptionPricing(fs.readFileSync(path.join(portal,'public/marketing/geraina-pricing.html'),'utf8'),'geraina',new Request(u),env)});
  if(['/geraina/checkout','/geraina/order'].includes(u.pathname)){
   const response=await checkout.handleSubscriptionCheckout(new Request(u,{method:r.method(),headers:r.headers(),...(r.postData()?{body:r.postData()}: {})}),env);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(['/subscription-pricing.js','/subscription-feedback.js','/subscription-feedback.css','/subscription-checkout.css','/product-public.css'].includes(u.pathname))return route.fulfill({path:path.join(portal,'public',u.pathname.slice(1))});
  if(native&&(u.pathname.startsWith('/geraina/')||u.pathname.startsWith('/assets/brand/')))return route.continue();
  const local=path.join(root,'frontend/build',u.pathname.startsWith('/geraina/')?u.pathname.slice('/geraina/'.length):u.pathname.slice(1));
  if(local.startsWith(path.join(root,'frontend/build'))&&fs.existsSync(local)&&fs.statSync(local).isFile())return route.fulfill({path:local});
  if(u.pathname.startsWith('/geraina/'))return route.fulfill({path:path.join(root,'frontend/build/index.html')});
  return route.abort();
 });
}
async function quote(page,id,renew=false){
 await (renew?page.getByTestId('addon-renew').first():page.getByTestId('addon-buy-'+id)).click();
 await page.getByRole('heading',{name:'Konfirmasi pembelian add-on'}).waitFor();
 assert.match(await page.locator('body').innerText(),/tanpa penagihan otomatis/);
}
async function confirm(page){
 const blocked=!native?page.waitForEvent('requestfailed',{predicate:r=>r.url().startsWith('https://checkout.xendit.co/')}):null;
 await page.locator('form[data-subscription-submit] button[type=submit]').click({noWaitAfter:true});
 if(blocked)assert.match((await blocked).failure().errorText,/ERR_BLOCKED_BY_CLIENT|ERR_BLOCKED_BY_INSPECTOR|^inspector$/);
}
async function payLatest(){const s=await snapshot(),id=s.addons.at(-1)?.id;assert.ok(id);assert.equal((await api('/__audit/payment/'+id,{state:'PAID'})).status,200);assert.equal((await api('/api/subscriptions/reconcile',{orderId:id})).status,200);return id;}
function adb(...args){const r=spawnSync(path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe'),['-s','emulator-5568',...args],{encoding:'utf8',windowsHide:true,timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;}
async function activity(pkg){for(let i=0;i<80;i++){if(adb('shell','dumpsys','activity','activities').split('\n').some(s=>/topResumedActivity/.test(s)&&s.includes(pkg)))return;await new Promise(r=>setTimeout(r,150));}throw Error('Expected activity '+pkg);}
(async()=>{
 const checkout=await import(pathToFileURL(path.join(portal,'src/subscription-checkout.js')).href);
 if(native){
  const apk=path.join(root,'android-app/app/build/outputs/apk/release/app-release.apk');
  adb('install','-r','-t',path.join(root,'android-app/app/build/checkout-fixture/checkout-fixture.apk'));
  adb('shell','pm','set-app-links','--package','com.dagangos.geraina.checkoutfixture','1','checkout.xendit.co');adb('shell','pm','set-app-links-user-selection','--user','0','--package','com.dagangos.geraina.checkoutfixture','true','checkout.xendit.co');
  adb('install','-r',apk);adb('shell','am','force-stop','com.dagangos.geraina');adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
  const devices=await _android.devices({omitDriverInstall:true}),d=devices.find(d=>d.serial()==='emulator-5568');assert.ok(d);
  try{
   const page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();await installRoutes(page,checkout);await reset('pro');await seed(page);await billing(page);
   const nav=[];page.on('framenavigated',f=>{if(f===page.mainFrame())nav.push(new URL(f.url()).pathname);});
   assert.equal((await device('native-before')).status,403);await quote(page,'extra_device');assert.equal((await snapshot()).invoice_count,0);checks.push('Installed app opens a priced add-on confirmation without an invoice or capacity grant');
   await confirm(page);await activity('com.dagangos.geraina.checkoutfixture');assert.equal((await snapshot()).invoice_count,1);adb('shell','input','keyevent','4');await activity('com.dagangos.geraina/');await page.getByTestId('addon-pending-extra_device').waitFor();
   assert.equal(new URL(page.url()).pathname,'/geraina/app/settings/billing');assert.ok(await page.evaluate(()=>localStorage.getItem('geraina_token')));assert.equal(nav.includes('/geraina/login'),false);assert.equal(await page.evaluate(()=>window.GerainaCheckoutFeedback?.busy===true),false);assert.equal((await device('native-unpaid')).status,403);checks.push('Real Android Back from unpaid external checkout returns to signed-in billing; no spinner or extra capacity');
   await payLatest();await billing(page);await page.getByTestId('addon-purchase').waitFor();assert.equal((await device('native-paid')).status,200);assert.match(await page.getByTestId('subscription-plan-title').innerText(),/Pro/);checks.push('Verified payment activates the extra device and retains the main Pro package');
   await page.screenshot({path:path.join(out,'paid-addon.png')});const installed=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(installed.versionName,'1.2.13');assert.equal(installed.versionCode,18);
   const installedPath=adb('shell','pm','path','com.dagangos.geraina').trim().replace(/^package:/,'');assert.match(installedPath,/^\/data\/app\/.*\/base\.apk$/);const pulled=path.join(out,'installed-base.apk');adb('pull',installedPath,pulled);const apkSha256=createHash('sha256').update(fs.readFileSync(pulled)).digest('hex');assert.equal(apkSha256,createHash('sha256').update(fs.readFileSync(apk)).digest('hex'));assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'passed',installed,apkSha256,checks,providerRequests:0,productionWrites:0},null,2));
  }finally{for(const dev of devices)await dev.close();}
 }else{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
   for(const profile of [{id:'phone',width:412,height:915},{id:'xiaomi12',width:1016,height:1100},{id:'samsung146',width:1480,height:924}]){
    const ctx=await browser.newContext({viewport:{width:profile.width,height:profile.height}}),page=await ctx.newPage();await installRoutes(page,checkout);await reset('pro');await seed(page);await billing(page);
    assert.equal(await page.getByTestId('addon-buy-extra_device').isEnabled(),true);assert.equal(await page.getByTestId('addon-buy-extra_outlet').isDisabled(),true);assert.equal((await device('before')).status,403);
    await quote(page,'extra_device');assert.equal((await snapshot()).invoice_count,0);assert.equal((await snapshot()).addons.length,0);await page.screenshot({path:path.join(out,profile.id+'-quote.png')});
    await confirm(page);assert.equal((await snapshot()).invoice_count,1);await billing(page);await page.getByTestId('addon-pending-extra_device').waitFor();assert.equal((await device('unpaid')).status,403);
    await page.getByTestId('addon-pending-extra_device').click();await page.getByRole('heading',{name:'Menunggu pembayaran add-on'}).waitFor();assert.equal((await snapshot()).invoice_count,1);
    await payLatest();await billing(page);await page.getByTestId('addon-purchase').waitFor();assert.equal((await device('paid')).status,200);assert.equal((await device('over-cap')).status,403);
    const first=(await addonCounts()).purchases[0];assert.equal(first.active,true);await quote(page,'extra_device',true);await confirm(page);assert.equal((await snapshot()).invoice_count,2);await payLatest();await billing(page);
    const renewed=(await addonCounts()).purchases[0];assert.ok(Date.parse(renewed.expires_at)>Date.parse(first.expires_at));assert.equal((await addonCounts()).purchases.length,1);assert.equal((await device('renewal-not-extra')).status,403);assert.equal((await snapshot()).user.subscriptions.geraina.order_id,'audit-base-order');
    await page.screenshot({path:path.join(out,profile.id+'-paid.png')});checks.push(profile.id+': eligible controls, explicit quote, unpaid resume, paid capacity, renewal without duplicated capacity, base plan preserved');
    // A refunded renewal removes only its month. Expiring the original then blocks new registrations.
    const id=(await snapshot()).addons.at(-1).id;await api('/__audit/payment/'+id,{state:'REFUNDED'});
    assert.equal((await api('/api/subscriptions/reconcile',{orderId:id})).status,200);
    assert.ok(Date.parse((await addonCounts()).purchases[0].expires_at)<=Date.parse(first.expires_at));
    await api('/__audit/expire/'+first.id,{});assert.equal((await device('expired')).status,403);assert.equal((await snapshot()).devices,6);checks.push(profile.id+': expiry blocks new capacity and preserves existing devices');await ctx.close();
   }
   const ctx=await browser.newContext(),page=await ctx.newPage();await installRoutes(page,checkout);await reset('business');await seed(page);await billing(page);assert.equal(await page.getByTestId('addon-buy-extra_device').isDisabled(),true);assert.equal((await api('/api/branches',{name:'Third outlet'})).status,403);await quote(page,'extra_outlet');await confirm(page);await payLatest();await billing(page);assert.equal((await api('/api/branches',{name:'Third outlet'})).status,200);assert.equal((await device('business-extra')).status,200);checks.push('Business outlet checkout unlocks an actual third branch and extra device capacity');
   for(const plan of ['trial','starter','expired']){await reset(plan);await seed(page);await billing(page);assert.equal(await page.getByTestId('addon-buy-extra_device').isDisabled(),true);assert.equal(await page.getByTestId('addon-buy-extra_outlet').isDisabled(),true);assert.equal((await snapshot()).invoice_count,0);}checks.push('Trial, Starter and expired plans cannot purchase add-ons');await ctx.close();assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'passed',checks,providerRequests:0,productionWrites:0},null,2));
  }finally{await browser.close();}
 }
 console.log(JSON.stringify({status:'passed',checks}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
