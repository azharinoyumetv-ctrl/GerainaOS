const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const {_android}=require('../../frontend/node_modules/playwright');
const {loadTestConfig}=require('./test-config.cjs');
const {inspect,contrast}=require('./verify-login-contrast.cjs');
const root=join(__dirname,'..'),config=loadTestConfig(),serial='emulator-5568',app='com.dagangos.geraina';
const out=join(root,'app/build/reports/installed-controls-before');mkdirSync(out,{recursive:true});
const adbPath=join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
function adb(args,binary=false){const result=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,timeout:90000,maxBuffer:20000000});assert.equal(result.status,0,String(result.stderr));return result.stdout;}
(async()=>{let devices=[];try{
 adb(['install','-r',join(root,'releases/Geraina-POS-1.1.1.apk')]);adb(['shell','am','force-stop',app]);adb(['shell','am','start','-n',`${app}/com.example.gerainapos.MainActivity`]);
 devices=await _android.devices({omitDriverInstall:true});const device=devices.find(item=>item.serial()===serial);const page=await(await device.webView({pkg:app})).page();page.setDefaultTimeout(30000);
 await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())||new URL(route.request().url()).pathname==='/api/auth/login'?route.continue():route.abort());
 await page.goto(`${config.base}/geraina/login`);await page.getByTestId('login-form').waitFor();await page.getByTestId('login-email-input').fill('visibility@example.invalid');await page.getByTestId('login-password-input').fill('VisibilitySample123');
 await page.getByTestId('login-password-input').blur();
 const login=await inspect(page);writeFileSync(join(out,'unreadable-login.png'),adb(['exec-out','screencap','-p'],true));
 await page.getByTestId('login-email-input').fill(config.email);await page.getByTestId('login-password-input').fill(config.password);await page.getByTestId('login-submit-btn').click();await page.getByTestId('dashboard-page').waitFor();
 const results=[];
 for(const [collection,singular] of [['categories','category'],['brands','brand'],['units','unit']]){
  await page.goto(`${config.base}/geraina/app/products/${collection}`);await page.getByTestId(`${singular}-form`).waitFor();
  const button=page.getByTestId(`${singular}-submit`),geometry=await button.evaluate(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),disabled:button.disabled,hit:hit?.tagName,receivesClick:button.contains(hit)};});
  await button.click();const emptyFeedback=await page.locator('[role="alert"]').count();
  let captured;const pattern=`**/api/products/${collection}`;const rows=[];
  await page.route(pattern,route=>{if(route.request().method()==='POST'){captured=route.request().postDataJSON();rows.push({id:`local-${collection}`,...captured});return route.fulfill({json:rows[0]});}return route.fulfill({json:rows});});
  await page.getByTestId(`${singular}-name-input`).fill(`LOCAL FIXTURE ${collection}`);
  await page.getByTestId(singular==='unit'?'unit-symbol-input':`${singular}-desc-input`).fill(singular==='unit'?'pcs':'Isolated local record');
  await button.click();await page.getByTestId(`${collection}-list`).getByText(`LOCAL FIXTURE ${collection}`,{exact:true}).waitFor();
  results.push({collection,geometry,emptyFeedback,fixtureSubmitReachedRequest:!!captured,fixtureRowDisplayed:true});
  writeFileSync(join(out,`${collection}.png`),adb(['exec-out','screencap','-p'],true));await page.unroute(pattern);
 }
 const result={appVersion:'1.1.1',login:login.map(field=>({...field,textContrast:contrast(field.fill,field.background)})),results,merchantWrites:0};writeFileSync(join(out,'observation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{for(const device of devices)await device.close();}})().catch(error=>{console.error(String(error.message).split(config.password).join('[REDACTED]'));process.exitCode=1;});
