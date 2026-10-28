const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('../../frontend/node_modules/playwright');
const args=Object.fromEntries(process.argv.slice(2).reduce((all,value,index,items)=>index%2?all:[...all,[value,items[index+1]]],[]));
const port=Number(args['--port']),fixtureKey=args['--fixture-key'];
assert(Number.isInteger(port)&&port>0&&port<65536&&/^[a-f0-9]{32}$/.test(fixtureKey));
const base='http://127.0.0.1:'+port,root=path.resolve(__dirname,'../../..'),build=path.join(root,'GerainaOS/frontend/build');
const out=path.resolve(__dirname,'../app/build/reports/account-erasure');
const type=file=>file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'application/octet-stream';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
 try{
  for(const width of [1365,393]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/'))return route.fulfill({response:await route.fetch({url:base+url.pathname+url.search})});
    if(url.origin===base&&url.pathname==='/__erasure_bench_control')return route.continue();
    if(url.pathname.startsWith('/geraina/static/')){
     const file=path.resolve(build,url.pathname.slice('/geraina/'.length));
     assert(file.startsWith(build+path.sep));return route.fulfill({body:fs.readFileSync(file),contentType:type(file)});
    }
    if(/^\/geraina\/(login|register|activate|app(?:\/.*)?)$/.test(url.pathname))return route.fulfill({body:fs.readFileSync(path.join(build,'index.html')),contentType:'text/html'});
    if(url.pathname.startsWith('/assets/')){
     const publicRoot=path.join(root,'public'),file=path.resolve(publicRoot,'.'+url.pathname);
     if(file.startsWith(publicRoot+path.sep)&&fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:type(file)});
    }
    return route.fulfill({status:404,body:''}); // No external or customer network traffic.
   });
   const page=await context.newPage();page.setDefaultTimeout(15000);
   async function control(action){const r=await context.request.post(base+'/__erasure_bench_control',{data:{fixture_key:fixtureKey,action}});assert.equal(r.status(),200);}
   async function login(email){
    await page.goto(base+'/geraina/login');await page.getByTestId('login-email-input').fill(email);
    await page.getByTestId('login-password-input').fill('DisposableFixtureOnly9!');await page.getByTestId('login-submit-btn').click();
    await page.waitForURL(/\/geraina\/app\//);await page.getByTestId('app-sidebar').waitFor({state:'attached'});
   }
   await control('reset');await login('owner-a@example.com');
   await control('store');await page.reload();await page.getByTestId('login-form').waitFor();
   assert.equal(await page.getByText('Fixture Kopi',{exact:true}).count(),0);
   await page.screenshot({path:path.join(out,'closed-owner-'+width+'.png')});
   checks.push('Owner closure drops the old session and cached workspace on reload at '+width+'px');
   await control('reset');await login('staff-a@example.com');
   await control('staff');await page.reload();await page.getByTestId('login-form').waitFor();
   checks.push('Staff-only deletion drops the old staff session at '+width+'px');
   await login('owner-a@example.com');
   await page.goto(base+'/geraina/app/products');await page.getByTestId('products-page').waitFor();
   await page.getByText('Fixture Kopi',{exact:true}).first().waitFor();
   await page.screenshot({path:path.join(out,'surviving-owner-'+width+'.png')});
   checks.push('The surviving owner can sign in and load the unchanged product catalogue at '+width+'px');
   await context.close();
  }
  fs.writeFileSync(path.join(out,'browser-verification.json'),JSON.stringify({status:'passed',finishedAt:new Date().toISOString(),checks,productionWrites:0,scope:'Actual built Geraina frontend and current backend; isolated loopback fixtures'},null,2)+'\n');
  console.log(JSON.stringify({status:'passed',checks},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
