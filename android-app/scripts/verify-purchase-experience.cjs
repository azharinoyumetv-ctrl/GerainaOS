const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),portal=path.dirname(root);
const {chromium,_android}=require(path.join(root,'frontend/node_modules/playwright'));
const {fixture}=require('./verify-remaining-pos.cjs');
const out=path.join(root,'android-app/app/build/reports/purchase-experience');fs.mkdirSync(out,{recursive:true});
const native=process.env.GERAINA_PURCHASE_NATIVE==='1',colors=[],checks=[];
const plans=['trial','starter','pro','business','expired'];
const labels={trial:'Trial',starter:'Starter',pro:'Pro',business:'Business',expired:'Paket berakhir'};
const expiry=new Date(Date.now()+12*86400000-3600000).toISOString();
function contrast(a,b){const lum=s=>{const c=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function inspect(page,plan,profile){
 const notice=page.getByTestId('tier-notice');await notice.waitFor({state:'visible'});
 await page.waitForFunction(()=>{const r=document.querySelector('[data-testid="tier-notice"]')?.getBoundingClientRect();return r&&r.x>=0&&r.right<=innerWidth;});
 assert.equal(await page.getByTestId('tier-name').textContent(),labels[plan]);
 const m=await notice.evaluate(e=>({height:e.getBoundingClientRect().height,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.clientWidth,scroll:e.scrollWidth,background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e.querySelector('[data-testid="tier-name"]')).color}));
 const ratio=contrast(m.color,m.background);assert.ok(ratio>=4.5,'Tier text must remain readable: '+JSON.stringify(m));assert.ok(m.height<=40&&m.scroll<=m.width+1);
 colors.push({plan,profile,...m,contrast:ratio});await page.screenshot({path:path.join(out,profile+'-'+plan+'.png')});
}
const owner=plan=>({id:'purchase-fixture',store_id:'purchase-store',store_name:'Purchase preview',role:'Owner',plan,email:'fixture@example.invalid',trial_ends_at:expiry,stores:[{module:'geraina',id:'purchase-store'}]});
function adb(...args){const p=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');const r=spawnSync(p,['-s','emulator-5568',...args],{encoding:'utf8',windowsHide:true,timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;}
(async()=>{
 if(!native){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
   for(const [profile,viewport] of [['phone',{width:412,height:915}],['xiaomi',{width:1016,height:1100}],['samsung',{width:1480,height:924}]]){
    const f=await fixture(browser,viewport);let user=owner('trial');
    await f.page.route('**/api/auth/me',r=>r.fulfill({json:user}));
    for(const plan of plans){user=owner(plan);await f.page.goto('https://dagangos.com/geraina/login');await f.page.evaluate(u=>{localStorage.setItem('geraina_user',JSON.stringify(u));},user);await f.page.goto('https://dagangos.com/geraina/app/about');if(profile==='phone')await f.page.evaluate(()=>GerainaMobile.openMenu());await inspect(f.page,plan,profile);}
    const tiers=['trial','starter','pro','business'].map(id=>({id,name:labels[id],price_idr_monthly:149000,price_idr_yearly:1490000,features:['Fixture feature']}));
    await f.page.route('**/api/pricing/tiers',r=>r.fulfill({json:tiers}));
    await f.page.goto('https://dagangos.com/geraina/pricing');await f.page.getByTestId('pricing-card-business').waitFor();
    assert.equal(await f.page.locator('[data-testid^="pricing-card-"]').count(),3);assert.equal(await f.page.getByTestId('pricing-card-trial').count(),0);
    let destination;
    await f.page.route('https://dagangos.com/geraina/pricing?**',r=>{destination=r.request().url();return r.fulfill({contentType:'text/html',body:'<!doctype html><h1>Purchase continued</h1>'});});
    await f.page.evaluate(()=>{window.__gerainaSubscriptionPurchases=true;window.__buyFrames=[];window.requestAnimationFrame=fn=>{window.__buyFrames.push(fn);return window.__buyFrames.length;};});
    await f.page.getByTestId('pricing-cta-starter').click();
    assert.equal(await f.page.getByTestId('pricing-cta-starter').getAttribute('aria-busy'),'true');assert.equal(await f.page.locator('[data-testid="pricing-cta-starter"] svg.animate-spin').count(),1);
    await f.page.screenshot({path:path.join(out,profile+'-react-purchase.png')});
    await f.page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.__buyFrames=[];});
    await f.page.waitForFunction(()=>document.querySelector('[data-testid="pricing-cta-starter"]').getAttribute('aria-busy')==='false',{},{polling:100});
    await f.page.getByTestId('pricing-cta-starter').click();
    await f.page.evaluate(()=>{for(let i=0;i<100&&window.__buyFrames.length;i++)window.__buyFrames.shift()(performance.now());});await f.page.getByRole('heading',{name:'Purchase continued'}).waitFor();
    const url=new URL(destination);assert.equal(url.pathname,'/geraina/pricing');assert.equal(url.searchParams.get('checkout'),'1');assert.equal(url.searchParams.get('plan'),'starter');
    checks.push({profile,name:'React purchase shows three paid tiers and immediate feedback without the legacy checkout detour',status:'passed'});
    assert.deepEqual(f.errors,[]);await f.context.close();
   }
  }finally{await browser.close();}
  assert.equal(new Set(colors.map(r=>r.background)).size,5);
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'passed',colors,checks,productionWrites:0},null,2));
 }else{
  adb('install','-r',path.join(root,'android-app/app/build/outputs/apk/release/app-release.apk'));adb('shell','am','force-stop','com.dagangos.geraina');adb('shell','am','start','-n','com.dagangos.geraina/com.example.gerainapos.MainActivity');
  const devices=await _android.devices({omitDriverInstall:true}),d=devices.find(d=>d.serial()==='emulator-5568');assert.ok(d);
  try{
   const page=await(await d.webView({pkg:'com.dagangos.geraina'},{timeout:30000})).page();page.setDefaultTimeout(10000);let user=owner('trial'),posts=0,body;
   const {renderSubscriptionPricing}=await import(pathToFileURL(path.join(portal,'src/subscription-checkout.js')).href);
   const html=await renderSubscriptionPricing(fs.readFileSync(path.join(portal,'public/marketing/geraina-pricing.html'),'utf8'),'geraina',new Request('https://dagangos.com/geraina/pricing'),{SUBSCRIPTION_SIGNING_KEY:'native-local-test',XENDIT_SECRET_KEY:'local-only',XENDIT_WEBHOOK_TOKEN:'local-only'});
   await page.route('**/*',async route=>{
    const r=route.request(),url=new URL(r.url());if(url.origin!=='https://dagangos.com')return route.abort();
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/auth/me'?user:url.pathname==='/api/subscriptions/current'?{subscription:null}:url.pathname==='/api/settings'?{}:url.pathname.startsWith('/api/records/')?{items:[],total:0,next_cursor:null}:[]});
    if(url.pathname==='/geraina/pricing')return route.fulfill({contentType:'text/html',body:html});
    if(url.pathname==='/geraina/checkout'){posts++;body=new URLSearchParams(r.postData());return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Native checkout intercepted</h1>'});}
    if(['/subscription-pricing.js','/subscription-feedback.js','/subscription-feedback.css','/product-public.css','/subscription-checkout.css'].includes(url.pathname))return route.fulfill({path:path.join(portal,'public',url.pathname.slice(1))});
    if(url.pathname.startsWith('/geraina/')||url.pathname.startsWith('/assets/brand/'))return route.continue();return route.abort();
   });
   await page.goto('https://dagangos.com/geraina/login');await page.evaluate(()=>localStorage.setItem('geraina_token','native-local-fixture-token'));
   for(const plan of plans){user=owner(plan);await page.evaluate(u=>localStorage.setItem('geraina_user',JSON.stringify(u)),user);await page.goto('https://dagangos.com/geraina/app/about');await inspect(page,plan,'native');checks.push({name:plan+' tier is colored, readable and one line',status:'passed'});}
   await page.goto('https://dagangos.com/geraina/pricing');assert.equal(await page.locator('.price-card').count(),3);checks.push({name:'Only three paid tiers are offered',status:'passed'});
   await page.evaluate(()=>{const original=HTMLFormElement.prototype.submit;window.__submitCalls=0;HTMLFormElement.prototype.submit=function(){window.__submitCalls++;window.__releaseSubmit=()=>original.call(this);};});
   const feedback=await page.evaluate(()=>{const form=document.querySelector('#plan-starter form'),start=performance.now();form.querySelector('button').click();return{ms:performance.now()-start,busy:form.getAttribute('aria-busy'),spinner:!!form.querySelector('.checkout-spinner')};});
   assert.equal(feedback.busy,'true');assert.equal(feedback.spinner,true);assert.ok(feedback.ms<150);await page.locator('.checkout-progress').waitFor({state:'visible'});checks.push({name:'First tap immediately shows payment spinner',status:'passed',feedbackMs:feedback.ms});
   await page.evaluate(()=>document.querySelector('#plan-starter form').requestSubmit());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__submitCalls),1);checks.push({name:'Repeated tap sends only one checkout request',status:'passed'});
   await page.screenshot({path:path.join(out,'native-checkout-loading.png')});await page.evaluate(()=>window.__releaseSubmit());await page.getByRole('heading',{name:'Native checkout intercepted'}).waitFor();assert.equal(posts,1);assert.equal(body.get('access_token'),'native-local-fixture-token');checks.push({name:'Signed-in checkout remains bound to the selected account',status:'passed'});
   const installed=await page.evaluate(()=>window.__gerainaAppInfo);assert.equal(installed.versionName,'1.2.11');assert.equal(installed.versionCode,16);
   const installedPath=adb('shell','pm','path','com.dagangos.geraina').trim().replace(/^package:/,'');assert.match(installedPath,/^\/data\/app\/.*\/base\.apk$/);const target=path.join(out,'installed-base.apk');adb('pull',installedPath,target);
   const apkSha256=createHash('sha256').update(fs.readFileSync(target)).digest('hex');assert.equal(apkSha256,createHash('sha256').update(fs.readFileSync(path.join(root,'android-app/app/build/outputs/apk/release/app-release.apk'))).digest('hex'));
   fs.writeFileSync(path.join(out,'native.json'),JSON.stringify({status:'passed',installed,apkSha256,colors,checks,productionWrites:0,providerRequests:0},null,2));
  }finally{for(const device of devices)await device.close();}
 }
 console.log(JSON.stringify({status:'passed',native,colors:colors.length,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
