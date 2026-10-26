// Full route sweep plus real-browser journeys through the actual local API.
// The host binds only to loopback, uses a disposable database and blocks providers.
const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const origin = 'https://dagangos.com', host = process.env.GERAINA_AUDIT_HOST || 'http://127.0.0.1:8846';
const root = path.resolve(__dirname, '../..');
const assets = path.join(root, 'android-app/app/src/main/assets');
const css = ['mobile-support.css','mobile-ui.css'].map(n => fs.readFileSync(path.join(assets,n),'utf8')).join('\n');
const native = ['android-bridge.js','device-features.js','mobile-ui.js'].map(n => fs.readFileSync(path.join(assets,n),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');

const test = base.extend({
  auditRole: ['owner-a',{option:true}], seedProducts: [3,{option:true}], nativeShell: [true,{option:true}],
  app: async ({page,context,request,auditRole,seedProducts,nativeShell},use,info) => {
    const reset = await request.post(host+'/__audit/reset',{data:{products:seedProducts}});
    expect(reset.ok()).toBeTruthy();
    const auth = await request.post(host+'/api/auth/login',{data:{email:auditRole+'@example.com',password:'DisposableAudit123'}});
    expect(auth.status()).toBe(200);
    const session = await auth.json();
    const errors=[],reads=[],blocked=[]; let pending=0,closing=false;
    if (nativeShell) await context.addInitScript({content:`window.__gerainaSubscriptionPurchases=true;window.__gerainaAppInfo={versionName:'1.2.10',versionCode:15,androidVersion:'14',model:'Local audit layout'};window.GerainaNative={postMessage:()=>{}};${native}`});
    await context.route('**/*',async route => {
      // Keep the external-traffic barrier installed until the page is closed.
      // Finish existing proxy calls before Playwright disposes `request`.
      if(closing) return route.abort();
      const r=route.request(),url=new URL(r.url());
      if(url.origin!==origin) {blocked.push(url.origin+url.pathname);return route.fulfill({status:403,body:'Audit blocks external traffic'});}
      if(url.pathname.startsWith('/api/')) {
        pending++;
        try {
          const headers={'content-type':r.headers()['content-type']||'application/json','x-dagangos-module':'geraina'};
          if(r.headers().authorization) headers.authorization=r.headers().authorization;
          const result=await request.fetch(host+url.pathname+url.search,{method:r.method(),headers,data:r.postDataBuffer()||undefined});
          reads.push({method:r.method(),path:url.pathname,status:result.status()});
          return await route.fulfill({response:result});
        } finally {pending--;}
      }
      if(url.pathname.startsWith('/geraina/')) {
        const asset=url.pathname.includes('/static/')?url.pathname.slice('/geraina/'.length):'index.html';
        return route.fulfill({path:path.join(root,'frontend/build',asset)});
      }
      return route.fulfill({status:404,body:'Outside audit application'});
    });
    page.on('pageerror',error=>errors.push(error.message));
    const settle=async()=>{await expect.poll(()=>pending).toBe(0);};
    const go=async route=>{await page.goto(origin+'/geraina/'+route);await page.locator('body').waitFor();await settle();};
    await go('login');
    await page.evaluate(session=>{localStorage.setItem('geraina_token',session.access_token);localStorage.setItem('geraina_user',JSON.stringify(session.user));},session);
    const api=async(method,url,data)=>{
      const response=await request.fetch(host+'/api'+url,{method,headers:{authorization:'Bearer '+session.access_token,'x-dagangos-module':'geraina'},data});
      return {status:response.status(),data:await response.json()};
    };
    try {await use({page,context,request,go,settle,api,session,errors,reads,blocked});}
    finally {
      if(info.status!==info.expectedStatus || (process.env.GERAINA_AUDIT_CAPTURE==='1' && info.file.endsWith('customer-fixes.spec.js'))) {
        if(info.status===info.expectedStatus) await page.waitForLoadState('networkidle');
        const screenshot=info.outputPath('audit-screen.png');
        await page.screenshot({path:screenshot,fullPage:false}).then(()=>info.attach('workspace-screen',{path:screenshot,contentType:'image/png'})).catch(()=>{});
      }
      closing=true;
      await expect.poll(()=>pending,{timeout:15000}).toBe(0);
      await info.attach('audit-evidence',{body:Buffer.from(JSON.stringify({errors,reads,blocked,productionWrites:0},null,2)),contentType:'application/json'});
      await page.close();
      await context.unrouteAll({behavior:'wait'});
    }
  },
});


module.exports = {test,expect,host};
