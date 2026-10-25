// Isolated checkout/settings fixtures. No production merchant data or payments are written.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process'), {createHash} = require('node:crypto');
const {chromium, _android} = require('../../frontend/node_modules/playwright');
const React = require('../../frontend/node_modules/react'), {renderToStaticMarkup} = require('../../frontend/node_modules/react-dom/server'), {QRCodeSVG} = require('../../frontend/node_modules/qrcode.react');
const jsQR = require('../../frontend/node_modules/jsqr');
const root = path.resolve(__dirname, '..'), build = path.join(root, 'app/build/generated/frontend-assets/frontend'), out = path.join(root, 'app/build/reports/bank-qris');
fs.mkdirSync(out, {recursive: true});
const user = {id:'bank-owner-fixture',store_id:'bank-store-fixture',email:'bank-owner@example.invalid',role:'Owner',plan:'starter',store_name:'BANK QRIS TEST ONLY'};
const product = {id:'bank-coffee',name:'Bank fixture coffee',price:12500,stock:10,sku:'BANK-TEST',category:'Coffee'};
const field = (tag,value) => `${tag}${String(value.length).padStart(2,'0')}${value}`;
let raw = field('00','01')+field('01','11')+field('26',field('00','ID.CO.QRIS.WWW')+field('01','TEST-ONLY-NOT-PAYABLE'))+field('52','5999')+field('53','360')+field('58','ID')+field('59','GERAINA TEST ONLY')+field('60','JAKARTA')+'6304';
let crc = 0xffff; for(const byte of Buffer.from(raw)){crc ^= byte<<8;for(let bit=0;bit<8;bit++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}
const payload = raw+crc.toString(16).toUpperCase().padStart(4,'0');
const profileId=process.env.GERAINA_DEVICE_PROFILE, profile=profileId&&require('./android-device-profiles.json')[profileId];
const report={status:'running',version:'1.2.5',scope:'Synthetic QRIS image, isolated bank settings and orders; no bank payment or merchant writes',profiles:[],merchantWrites:0};
const adbPath=path.join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe'), serial=profile&&`emulator-${profile.port}`, app='com.dagangos.geraina';
function adb(args){const r=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,encoding:'utf8',timeout:90000});assert.equal(r.status,0,r.stderr);return r.stdout;}
async function runChecks(page,label,png){
  const checks=[],errors=[],requests=[],orders=[]; let config={bank_name:'',qr_payload:'',is_active:false},failLoad=false,failConfirm=false;
  page.setDefaultTimeout(15000); page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://dagangos.com/api/**',async route=>{
    const r=route.request(),p=new URL(r.url()).pathname;requests.push({path:p,method:r.method()});
    if(p==='/api/auth/me')return route.fulfill({json:user});
    if(p==='/api/payments/bank-qris'){
      if(r.method()==='GET')return route.fulfill({status:failLoad?503:200,json:failLoad?{detail:'Isolated bank setup unavailable'}:config});
      const body=r.postDataJSON();assert.equal(body.qr_payload,payload);assert.equal(body.merchant_confirmed,true);
      config={...body,merchant_name:'GERAINA TEST ONLY',merchant_city:'JAKARTA',confirmation_mode:'manual_bank'};return route.fulfill({json:config});
    }
    if(p==='/api/orders'&&r.method()==='POST'){
      const body=r.postDataJSON();assert.equal(body.payment_method,'qris_bank');
      const order={...body,id:`bank-order-${orders.length}`,order_no:`BANK-TEST-${orders.length}`,cashier_id:user.id,total:12500,subtotal:12500,payment_status:'pending',bank_qris:{...config},created_at:new Date().toISOString()};orders.push(order);return route.fulfill({json:order});
    }
    const confirm=p.match(/^\/api\/orders\/([^/]+)\/confirm-bank-qris$/);
    if(confirm){const order=orders.find(o=>o.id===confirm[1]);assert.ok(order);const body=r.postDataJSON();assert.equal(body.checked_in_bank,true);assert.equal(Number(body.received_amount),12500);if(failConfirm)return route.fulfill({status:503,json:{detail:'Isolated confirmation interruption'}});order.payment_status='paid';order.payment_confirmation={type:'manual_bank',confirmed_by:user.id,confirmed_at:new Date().toISOString(),received_amount:12500,reference:body.reference,bank_verified:false};return route.fulfill({json:order});}
    const orderMatch=p.match(/^\/api\/orders\/([^/]+)$/);
    if(orderMatch)return route.fulfill({json:orders.find(o=>o.id===orderMatch[1])});
    assert.equal(r.method(),'GET',`Unexpected mutation ${r.method()} ${p}`);
    const data=p==='/api/products'?[product]:p==='/api/products/category-names'?['Coffee']:p==='/api/orders'?orders:p==='/api/settings'?{}:p==='/api/orders/stats'?{today_sales:0,today_orders:0}:[];
    return route.fulfill({json:data});
  });
  if(profile)await page.waitForURL('https://dagangos.com/**',{waitUntil:'domcontentloaded'});
  else await page.goto('https://dagangos.com/geraina/login');
  await page.evaluate(user=>{for(const prefix of ['geraina','dagangos','dapuros']){localStorage.removeItem(`${prefix}_user`);localStorage.removeItem(`${prefix}_token`);}localStorage.removeItem('geraina_selected_role');localStorage.setItem('geraina_token','isolated-bank-qr-fixture');localStorage.setItem('geraina_user',JSON.stringify(user));localStorage.removeItem(`geraina:bank-qris:pending:${user.id}:${user.store_id}`);},user);
  await page.reload();
  if(profile){adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);await page.waitForFunction(()=>navigator.onLine);}
  const shot = name=>page.screenshot({path:path.join(out,`${label}-${name}.png`)});
  async function check(name,fn){await fn();assert.deepEqual(errors,[]);checks.push({name,status:'passed'});console.log(`PASS ${label}: ${name}`);}
  // Browser pages use the same public origin as the installed bundled WebView.
  await check('Starter merchant can open bank setup without gateway credentials',async()=>{await page.goto('https://dagangos.com/geraina/app/payments/qris');await page.getByTestId('bank-qris-form').waitFor();assert.equal(requests.some(r=>r.path==='/api/integrations'),false);assert.equal(await page.getByTestId('bank-qris-active').isChecked(),false);});
  await check('A real PNG QR image decodes unchanged and needs explicit ownership confirmation',async()=>{
    await page.getByTestId('bank-qris-bank-name').fill('Bank fixture');
    if(profile){
      await page.getByTestId('bank-qris-upload').click();
      let opened=false;
      for(let attempt=0;attempt<15;attempt++){if(/(?:mResumedActivity|topResumedActivity).*documentsui/i.test(adb(['shell','dumpsys','activity','activities']))){opened=true;break;}await new Promise(resolve=>setTimeout(resolve,300));}
      assert.equal(opened,true,'The Android document picker must open from the QRIS upload button');
      adb(['shell','input','keyevent','KEYCODE_BACK']);await page.getByTestId('bank-qris-upload').waitFor();
    }
    await page.getByTestId('bank-qris-upload').evaluate((input,base64)=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),files=new DataTransfer();files.items.add(new File([bytes],'synthetic-bank-qr.png',{type:'image/png'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));},png.toString('base64'));
    await page.getByTestId('bank-qris-preview').waitFor();await page.getByTestId('bank-qris-active').check();assert.equal(await page.getByTestId('bank-qris-save').isDisabled(),true);
    await page.getByTestId('bank-qris-ownership').check();await page.getByTestId('bank-qris-save').click();await page.getByText('GERAINA TEST ONLY · JAKARTA',{exact:true}).waitFor();assert.equal(config.qr_payload,payload);await shot('setup');
  });
  await check('Saved bank setup survives reload and failed loads cannot overwrite it',async()=>{await page.reload();await page.getByText('GERAINA TEST ONLY · JAKARTA',{exact:true}).waitFor();failLoad=true;await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.getByTestId('bank-qris-save').count(),0);failLoad=false;await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await page.getByText('GERAINA TEST ONLY · JAKARTA',{exact:true}).waitFor();});
  async function checkout(){await page.goto('https://dagangos.com/geraina/app/pos');if(await page.getByTestId('mobile-cart-close').isVisible())await page.getByTestId('mobile-cart-close').click();await page.getByTestId('pos-product-bank-coffee').click();if(await page.getByTestId('mobile-cart-open').isVisible())await page.getByTestId('mobile-cart-open').click();await page.getByTestId('pm-qris').click();await page.getByTestId('checkout-btn').click();await page.getByTestId('bank-qris-code').waitFor();}
  async function verifyDisplayedCode(){
    const pixels=await page.getByTestId('bank-qris-code').evaluate(async svg=>{
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=canvas.height=440;const context=canvas.getContext('2d');context.drawImage(image,0,0,440,440);return {data:Array.from(context.getImageData(0,0,440,440).data),width:440,height:440};}finally{URL.revokeObjectURL(url);}
    });
    assert.equal(jsQR(Uint8ClampedArray.from(pixels.data),pixels.width,pixels.height)?.data,payload,'The displayed payment QR must decode to the exact original bank payload');
  }
  await check('Checkout displays merchant code and exact amount; no automatic paid status or legacy settle',async()=>{await checkout();await verifyDisplayedCode();assert.match(await page.getByTestId('receipt-status').innerText(),/Menunggu/i);assert.equal(await page.getByTestId('receipt-mark-paid').count(),0);assert.equal(await page.getByTestId('bank-qris-confirm').isDisabled(),true);await page.waitForTimeout(3700);assert.equal(requests.filter(r=>r.path==='/api/orders/bank-order-0').length,0);assert.equal(orders[0].payment_status,'pending');await shot('pending');});
  await check('Closing or restarting POS retains the pending payment and opens the original order',async()=>{await page.getByTestId('receipt-done-btn').click();await page.getByTestId('bank-qris-pending-banner').waitFor();await page.reload();await page.getByTestId('bank-qris-resume').click();await page.getByTestId('bank-qris-code').waitFor();assert.equal(orders.length,1);assert.equal(await page.getByTestId('receipt-order-no').innerText(),'BANK-TEST-0');});
  await check('Wrong amount blocks confirmation; failed confirmation stays pending and safely retries',async()=>{await page.getByTestId('bank-qris-checked').check();await page.getByTestId('bank-qris-received').fill('12000');assert.equal(await page.getByTestId('bank-qris-confirm').isDisabled(),true);await page.getByTestId('bank-qris-received').fill('12500');await page.getByTestId('bank-qris-reference').fill('BANK-REFERENCE-TEST');failConfirm=true;await page.getByTestId('bank-qris-confirm').click();await page.getByText('Isolated confirmation interruption',{exact:true}).waitFor();assert.match(await page.getByTestId('receipt-status').innerText(),/Menunggu/i);failConfirm=false;await page.getByTestId('bank-qris-confirm').evaluate(button=>{button.click();button.click();});await page.getByTestId('bank-qris-confirmation').waitFor();assert.match(await page.getByTestId('receipt-status').innerText(),/Lunas/i);assert.equal(orders[0].payment_confirmation.reference,'BANK-REFERENCE-TEST');assert.equal(requests.filter(r=>r.path.endsWith('/confirm-bank-qris')).length,2);await shot('confirmed');await page.getByTestId('receipt-done-btn').click();assert.equal(await page.getByTestId('bank-qris-pending-banner').count(),0);});
  await check('Pending bank payments reopen from sales history',async()=>{await checkout();await page.getByTestId('receipt-done-btn').click();await page.goto('https://dagangos.com/geraina/app/sales');await page.getByTestId('sales-bank-qris-bank-order-1').click();await page.getByTestId('bank-qris-code').waitFor();assert.equal(await page.getByTestId('receipt-order-no').innerText(),'BANK-TEST-1');});
  await check('Receipt fits horizontally and confirm controls remain reachable by scrolling',async()=>{const dialog=page.getByTestId('receipt-dialog');assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.getByTestId('bank-qris-confirm').scrollIntoViewIfNeeded();const box=await page.getByTestId('bank-qris-confirm').boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1&&box.y>=0&&box.y+box.height<=viewport.height+1);await shot('confirmation-controls');});
  await page.getByTestId('receipt-done-btn').click();
  await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('bank-owner-fixture')||key==='geraina_token'||key==='geraina_user')localStorage.removeItem(key);});
  report.profiles.push({profile:label,checks});
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});let devices=[];
  try {
    const qrPage=await browser.newPage({viewport:{width:550,height:550}});await qrPage.setContent(`<body style="margin:0;background:white">${renderToStaticMarkup(React.createElement(QRCodeSVG,{value:payload,size:500,marginSize:4,level:'M'}))}</body>`);const png=await qrPage.locator('svg').screenshot();await qrPage.close();
    if(profile){
      const apk=path.join(root,'releases/Geraina-POS-1.2.5.apk');report.apkSha256=createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
      adb(['install','-r',apk]);adb(['shell','am','force-stop',app]);adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);adb(['shell','am','start','-n',`${app}/com.example.gerainapos.MainActivity`]);
      devices=await _android.devices({omitDriverInstall:true});const device=devices.find(d=>d.serial()===serial);assert.ok(device);const page=await(await device.webView({pkg:app},{timeout:20000})).page();await runChecks(page,profileId,png);
    }else for(const width of [393,1016,1524]){
      const context=await browser.newContext({viewport:{width,height:width===1524?872:1100}}),page=await context.newPage();
      const css=['mobile-support.css','mobile-ui.css'].map(n=>fs.readFileSync(path.join(root,'app/src/main/assets',n),'utf8')).join('\n');
      const scripts=['android-bridge.js','device-features.js','mobile-ui.js'].map(n=>fs.readFileSync(path.join(root,'app/src/main/assets',n),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');
      await context.addInitScript({content:`window.GerainaNative={postMessage:()=>{}};${scripts}`});
      await page.route('https://dagangos.com/geraina/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({path:path.join(build,p.includes('/static/')?p.slice('/geraina/'.length):'index.html')});});
      await runChecks(page,String(width),png);await context.close();
    }
    report.status='passed';
  }catch(error){report.status='failed';report.error=error.message;console.error(error.message);process.exitCode=1;}
  finally{for(const d of devices)await d.close().catch(()=>{});await browser.close();fs.writeFileSync(path.join(out,`${profileId||'browser'}-verification.json`),JSON.stringify(report,null,2));}
})();
