// Complete built app with isolated API records. No production data or credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {chromium,_android}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),build=path.join(root,'app/build/generated/frontend-assets/frontend');
const out=path.join(root,'app/build/reports/pos-accounts');fs.mkdirSync(out,{recursive:true});
const base='https://dagangos.com';
const owner={id:'owner-fixture-'+Date.now(),store_id:'store-fixture',role:'Owner',email:'owner@fixture.invalid',name:'Fixture Owner',plan:'business'};
const cashier={...owner,id:'cashier-fixture-'+Date.now(),role:'Cashier',email:'owner.cashier@fixture.invalid',name:'Fixture Cashier'};
const product={id:'coffee-fixture',name:'Fixture coffee',sku:'TEST-COFFEE',price:12500,cost:5000,stock:20,category:'Coffee'};
const catalogue=[product,...Array.from({length:100},(_,i)=>({...product,id:'extra-'+i,name:'Other coffee '+i,sku:'OTHER-'+i}))];
const results=[];
async function run(browser,label,viewport,nativePage=null,nativeOpen=null){
 const context=nativePage?nativePage.context():await browser.newContext({viewport}),page=nativePage||await context.newPage();page.setDefaultTimeout(15000);
 const errors=[],requests=[],sales=[],attendance=[],consoleErrors=[];let temporary=false,failClock=false;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.addInitScript(({owner})=>{if(localStorage.getItem('pos-fixture-seeded'))return;localStorage.setItem('pos-fixture-seeded','1');localStorage.setItem('geraina_token','fixture-owner');localStorage.setItem('geraina_user',JSON.stringify(owner));localStorage.setItem('geraina_selected_role','Cashier');},{owner});
 if(!nativePage)await page.route('**/*',route=>route.abort());
 if(!nativePage)await page.route(base+'/geraina/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({path:path.join(build,p.includes('/static/')?p.slice('/geraina/'.length):'index.html')});});
 await page.route(base+'/api/**',async route=>{
  const r=route.request(),p=new URL(r.url()).pathname,method=r.method(),body=method==='GET'?null:r.postDataJSON();
  const current=r.headers().authorization==='Bearer fixture-owner'?owner:cashier;
  requests.push({path:p,method,actor:current.id});
  if(p==='/api/auth/me')return route.fulfill({json:{...current,must_change_password:temporary}});
  if(p==='/api/auth/login'){
   if(body.password!=='FixtureUnique123')return route.fulfill({status:401,json:{detail:'Email atau password salah'}});
   return route.fulfill({json:{access_token:'fixture-cashier',user:{...cashier,must_change_password:temporary}}});
  }
  if(p==='/api/auth/change-password'){
   assert.equal(body.current_password,'FixtureUnique123');assert.equal(body.new_password,'PersonalFixture456');temporary=false;
   return route.fulfill({json:{access_token:'fixture-cashier',user:{...cashier,must_change_password:false}}});
  }
  if(p==='/api/offline/orders'){assert.equal(body.expected_cashier_id,current.id);assert.equal(body.expected_store_id,current.store_id);let sale=sales.find(x=>x.id===body.client_order_id);if(!sale){sale={...body,id:body.client_order_id,store_id:current.store_id,order_no:'FIXTURE-'+sales.length,cashier_id:current.id,total:12500,subtotal:12500,payment_status:'paid'};sales.push(sale);}return route.fulfill({json:sale});}
  if(p==='/api/orders'&&method==='POST'){
   assert.equal(body.payment_method,'cash');assert.equal(body.items[0].product_id,product.id);
   const sale={...body,id:'sale-'+sales.length,order_no:'FIXTURE-'+sales.length,cashier_id:current.id,subtotal:12500,total:12500,change:0,payment_status:'paid'};sales.push(sale);return route.fulfill({json:sale});
  }
  if(p==='/api/attendance/me/check-in'){
   assert.deepEqual(Object.keys(body),['request_id']);assert.match(body.request_id,/^[a-f0-9-]{36}$/);
   if(failClock){failClock=false;return route.fulfill({status:503,json:{detail:'Isolated interruption'}});}
   const row={id:'shift-fixture',user_id:current.id,staff_name:current.name,is_open:true,clock_in:'2026-10-26T01:00:00Z',work_date:'2026-10-26',timezone:'Asia/Jakarta',check_in_request_id:body.request_id};attendance.push(row);return route.fulfill({json:row});
  }
  if(p==='/api/attendance/me/check-out'){
   assert.deepEqual(body,{attendance_id:'shift-fixture'});attendance[0]={...attendance[0],is_open:false,clock_out:'2026-10-26T02:00:00Z'};return route.fulfill({json:attendance[0]});
  }
  assert.equal(method,'GET',`Unexpected mutation: ${method} ${p}`);
  const json=p==='/api/products'?catalogue:p.endsWith('/category-names')?['Coffee']:p==='/api/orders'?sales:p==='/api/orders/stats'?{today_sales:0,today_orders:0}:p==='/api/attendance/me'?{history:attendance,open_shift:attendance.find(x=>x.is_open)||null,timezone:'Asia/Jakarta',server_time:'2026-10-26T01:00:00Z'}:p==='/api/settings'?{}:[];
  return route.fulfill({json});
 });
 const check=async(name,fn)=>{try{await fn();}catch(e){fs.writeFileSync(path.join(out,label+'-failure.json'),JSON.stringify({name,requests,errors,consoleErrors,state:await page.evaluate(()=>({url:location.href,user:localStorage.getItem('geraina_user'),text:document.body.innerText.slice(-2000),html:document.body.innerHTML.slice(-1800),content:document.body.textContent.slice(-1800)}))},null,2));throw e;}assert.deepEqual(errors,[]);results.push({profile:label,name,status:'passed'});console.log('PASS '+label+': '+name);};
 const switchUser=async()=>{const box=await page.getByTestId('account-switch-open').boundingBox();if(!box||box.x<0){if(nativeOpen)await nativeOpen();else await page.getByTestId('mobile-menu-open-btn').click();}await page.getByTestId('account-switch-open').click();};
 const closeMenu=async()=>{if(await page.getByTestId('mobile-sidebar-backdrop').count())await page.getByTestId('mobile-menu-close-btn').click();};
 const cart=async()=>{const dock=page.getByTestId('mobile-cart-open');if(await dock.isVisible())await dock.click();};
 const settled=async n=>{for(let i=0;i<100&&sales.length<n;i++)await page.waitForTimeout(100);};
 const open=async p=>{await page.goto(base+'/geraina/app/'+p);};
 try{
 await check('Saved role selector cannot change the authenticated Owner',async()=>{await open('pos');await page.getByTestId('pos-product-'+product.id).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.geraina_user).role),'Owner');await page.waitForFunction(()=>localStorage.getItem('geraina_selected_role')===null);});
 await check('POS limits rendered cards while search finds products beyond page one',async()=>{assert.equal(await page.getByTestId('pos-product-grid').getByRole('button').count(),48);await page.getByTestId('pos-products-next').click();await page.getByTestId('pos-product-extra-60').waitFor();await page.getByTestId('pos-search').fill('OTHER-99');await page.getByTestId('pos-product-extra-99').waitFor();assert.equal(await page.getByTestId('pos-pagination').count(),0);await page.getByTestId('pos-search').fill('');await page.getByTestId('pos-product-'+product.id).waitFor();});
 await check('Switching users preserves an unfinished cart',async()=>{await page.getByTestId('pos-product-'+product.id).click();await switchUser();assert.equal(await page.getByTestId('account-switch-dialog').count(),0);await closeMenu();await page.getByTestId('cart-item-0').waitFor({state:'attached'});});
 await check('Cash checkout records the current actor and produces a paid receipt',async()=>{await cart();await page.getByTestId('cart-cash-received').fill('12500');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-status').waitFor();await settled(1);assert.equal(sales.length,1);assert.equal(sales[0].cashier_id,owner.id);assert.equal((await page.getByTestId('receipt-status').innerText()).toLowerCase(),'lunas');await page.getByTestId('receipt-done-btn').click();});
 await check('Handoff cancellation retains the session, confirmation clears all shared tokens',async()=>{await switchUser();await page.getByTestId('account-switch-cancel').click();assert.equal(await page.evaluate(()=>localStorage.geraina_token),'fixture-owner');await page.evaluate(()=>{localStorage.setItem('dapuros_token','stale-owner');localStorage.setItem('dapuros_user',localStorage.geraina_user);});await switchUser();await page.getByTestId('account-switch-confirm').click();await page.getByTestId('login-form').waitFor();assert.deepEqual(await page.evaluate(()=>['geraina','dagangos','dapuros'].map(p=>localStorage.getItem(p+'_token'))),[null,null,null]);});
 const login=async password=>{await page.getByTestId('login-email-input').fill(cashier.email);await page.getByTestId('login-password-input').fill(password);await page.getByTestId('login-submit-btn').click();};
 await check('Wrong credentials cannot restore the Owner session',async()=>{await login('WrongFixture123');await page.getByTestId('login-error').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('geraina_token')),null);});
 await check('Employee login requires a personal password before POS access',async()=>{temporary=true;await login('FixtureUnique123');await page.getByTestId('password-setup-page').waitFor();assert.equal(await page.getByTestId('pos-page').count(),0);await page.getByTestId('password-setup-current').fill('FixtureUnique123');await page.getByTestId('password-setup-new').fill('PersonalFixture456');await page.getByTestId('password-setup-confirm').fill('PersonalFixture456');await page.getByTestId('password-setup-save').click();await page.getByTestId('app-layout').waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.geraina_user).role),'Cashier');});
 await check('Forged local role cannot open Owner settings or void sales',async()=>{await page.evaluate(()=>localStorage.setItem('geraina_selected_role','Owner'));await open('settings/general');await page.getByTestId('access-denied-page').waitFor();assert.equal(await page.getByTestId('settings-page').count(),0);assert.equal(requests.some(r=>r.actor===cashier.id&&r.path==='/api/integrations'),false);await open('sales');await page.getByTestId('sales-page').waitFor();assert.equal(await page.locator('[data-testid^="sales-void-"]').count(),0);});
 await check('Cashier has personal attendance without team controls',async()=>{await open('attendance');await page.getByTestId('attendance-check-in').waitFor();assert.equal(await page.getByTestId('attendance-tab-team').count(),0);assert.equal(requests.some(r=>r.actor===cashier.id&&r.path==='/api/attendance'),false);});
 await check('Attendance interruption retries the same intent and records only this employee',async()=>{failClock=true;await page.getByTestId('attendance-check-in').click();await page.getByTestId('attendance-error').waitFor();const key='geraina:attendance:check-in:'+cashier.id+':'+cashier.store_id;const nonce=await page.evaluate(k=>localStorage.getItem(k),key);assert.ok(nonce);await page.getByTestId('attendance-refresh').click();await page.getByTestId('attendance-check-in').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-testid="attendance-check-in"]').disabled);await page.getByTestId('attendance-check-in').click();await page.getByTestId('attendance-check-out').waitFor();assert.equal(attendance.length,1);assert.equal(attendance[0].user_id,cashier.id);assert.equal(attendance[0].check_in_request_id,nonce);});
 await check('Checkout closes the existing shift and survives page reload',async()=>{await page.getByTestId('attendance-check-out').click();await page.getByTestId('attendance-check-in').waitFor();await page.reload();await page.getByTestId('attendance-own-shift-fixture').waitFor();assert.equal(attendance[0].is_open,false);assert.equal(await page.getByTestId('attendance-check-out').count(),0);});
 await check('Cashier still completes sales with their own identity',async()=>{await open('pos');await page.getByTestId('pos-product-'+product.id).click();await cart();await page.getByTestId('cart-cash-received').fill('12500');await page.getByTestId('checkout-btn').click();await page.getByTestId('receipt-status').waitFor();await settled(2);assert.equal(sales.length,2);assert.equal(sales[1].cashier_id,cashier.id);await page.screenshot({path:path.join(out,label+'-cashier.png'),fullPage:true});});
 }finally{if(!nativePage)await context.close();}
}
(async()=>{
 const profileId=process.env.GERAINA_DEVICE_PROFILE;let browser,devices=[];
 try{
  if(profileId){
   const profile=require('./android-device-profiles.json')[profileId];assert.ok(profile);
   const serial='emulator-'+profile.port,app='com.dagangos.geraina',adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
   const adb=args=>{const r=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,encoding:'utf8',timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;};
   adb(['install','-r',path.join(root,'releases/Geraina-POS-1.2.6.apk')]);adb(['shell','am','force-stop',app]);adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);adb(['shell','am','start','-n',app+'/com.example.gerainapos.MainActivity']);
   devices=await _android.devices({omitDriverInstall:true});const device=devices.find(d=>d.serial()===serial);assert.ok(device);
   const page=await(await device.webView({pkg:app},{timeout:30000})).page();
   await page.evaluate(()=>localStorage.removeItem('pos-fixture-seeded'));
   // The API route is installed inside run before fixture initialization and radio recovery.
   const ready=()=>{adb(['shell','svc','wifi','enable']);};
   page.once('domcontentloaded',ready);
   try{await run(null,profileId,{width:profile.kind==='phone'?412:1016,height:1100},page,()=>{adb(['shell','uiautomator','dump','/sdcard/pos-ui.xml']);const xml=adb(['shell','cat','/sdcard/pos-ui.xml']);const node=xml.match(/<node[^>]*content-desc="Buka navigasi"[^>]*>/)?.[0];assert.ok(node,'Native navigation button must be visible');const box=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);assert.ok(box);adb(['shell','input','tap',String(Math.round((+box[1]+ +box[3])/2)),String(Math.round((+box[2]+ +box[4])/2))]);});}
   finally{adb(['shell','am','force-stop',app]);adb(['shell','svc','wifi','disable']);}
  }else{browser=await chromium.launch({channel:'chrome',headless:true});await run(browser,'phone',{width:412,height:915});await run(browser,'large-tablet',{width:1480,height:924});}
 }finally{if(browser)await browser.close();for(const device of devices)await device.close().catch(()=>{});fs.writeFileSync(path.join(out,(profileId||'browser')+'-results.json'),JSON.stringify({scope:'Built app; synthetic accounts, payment and attendance APIs. No production access. Device profile recorded per check; emulator speed does not certify physical hardware.',merchantWrites:0,results},null,2));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
