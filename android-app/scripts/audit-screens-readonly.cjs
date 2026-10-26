const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../frontend/node_modules/playwright');
const checks=require('./usability-checks.cjs'),{loadTestConfig}=require('./test-config.cjs');
const config=loadTestConfig(),root=path.resolve(__dirname,'..'),out=path.join(root,'app/build/reports/screen-audit');fs.mkdirSync(out,{recursive:true});
const routes=['dashboard','pos','products','products/categories','products/brands','products/units','inventory/overview','inventory/low-stock','purchase/orders','suppliers','customers','sales','reports/sales','staff/management','staff/attendance','branches','integrations/xendit','integrations/doku','integrations/whatsapp','integrations/qris','settings/general','settings/store','settings/receipt','settings/printer','about','license'];
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];try{
 const context=await browser.newContext({viewport:{width:1016,height:1200}});
 const css=['mobile-support.css','mobile-ui.css'].map(name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8')).join('\n');const scripts=['android-bridge.js','device-features.js','mobile-ui.js'].map(name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');
 await context.addInitScript({content:`window.__gerainaAppInfo={versionName:'1.2.6',versionCode:11,androidVersion:'14',model:'Audit profile'};window.GerainaNative={postMessage:()=>{}};\n${scripts}`});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const bundle=path.join(root,'app/build/generated/frontend-assets/frontend');
 await page.route('https://dagangos.com/geraina/**',route=>{const pathname=new URL(route.request().url()).pathname;return route.fulfill({path:path.join(bundle,pathname.includes('/static/')?pathname.slice('/geraina/'.length):'index.html')});});
 const errors=[],blocked=[];let active=0;
 page.on('pageerror',error=>errors.push(error.message.split(config.password).join('[REDACTED]')));
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))active++;});const finished=request=>{if(new URL(request.url()).pathname.startsWith('/api/'))active=Math.max(0,active-1);};page.on('requestfinished',finished);page.on('requestfailed',finished);
 await page.route('**/api/**',route=>{const request=route.request();if(['GET','HEAD','OPTIONS'].includes(request.method())||new URL(request.url()).pathname==='/api/auth/login')return route.continue();blocked.push(new URL(request.url()).pathname);return route.abort();});
 await checks.loginContrast(page);await checks.signIn(page);
 for(const route of routes){const start=errors.length;let failure=null;try{await page.goto(`${config.base}/geraina/app/${route}`,{waitUntil:'domcontentloaded'});await page.locator('.route-stage').waitFor();const deadline=Date.now()+12000;while(active&&Date.now()<deadline)await page.waitForTimeout(100);await page.waitForTimeout(250);assert.ok((await page.locator('.route-stage').innerText()).trim().length>0,'Screen must not be blank');}catch(error){failure=error.message.split(config.password).join('[REDACTED]');}
  const runtimeErrors=errors.slice(start);results.push({route,status:failure||runtimeErrors.length?'failed':'passed',runtimeErrors,...(failure?{error:failure}:{})});console.log(`${results.at(-1).status.toUpperCase()}: ${route}`);
 }
 const report={status:results.every(row=>row.status==='passed')?'passed':'failed',scope:'Prepared frontend at production origin, real account sign-in and read-only APIs; every merchant mutation is blocked',screens:results.length,results,blockedMutationPaths:blocked,merchantWrites:0};fs.writeFileSync(path.join(out,process.env.GERAINA_AUDIT_BASELINE?'baseline.json':'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,screens:report.screens,failed:results.filter(row=>row.status==='failed').map(row=>row.route),merchantWrites:0}));if(report.status==='failed')process.exitCode=1;await context.close();
}finally{await browser.close();}})().catch(error=>{console.error(String(error.message).split(config.password).join('[REDACTED]'));process.exitCode=1;});
