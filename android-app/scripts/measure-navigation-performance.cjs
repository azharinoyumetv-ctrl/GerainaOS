// Controlled replay of packaged/current UI assets. No production API or merchant writes.
// GERAINA_PERF_ASSET_ROOT can select a read-only extracted APK assets directory
// containing frontend/, mobile-ui.js and the other Android presentation assets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),tag=process.env.GERAINA_PERF_LABEL||'working-tree';
assert.match(tag,/^[a-zA-Z0-9._-]+$/);
const assets=process.env.GERAINA_PERF_ASSET_ROOT?path.resolve(process.env.GERAINA_PERF_ASSET_ROOT):path.join(root,'app/src/main/assets');
const build=process.env.GERAINA_PERF_ASSET_ROOT?path.join(assets,'frontend'):path.join(root,'app/build/generated/frontend-assets/frontend');
const out=path.join(root,'app/build/reports/navigation-performance');fs.mkdirSync(out,{recursive:true});
const user={id:'performance-fixture',store_id:'performance-store',email:'owner@performance.invalid',role:'Owner',plan:'business',store_name:'Isolated performance fixture'};
const products=Array.from({length:500},(_,i)=>({id:`p-${i}`,name:`Coffee ${String(i).padStart(3,'0')}`,sku:`PERF-${i}`,price:12500,cost:5000,stock:10,category:i%2?'Coffee':'Tea',unit:'pcs'}));
async function sample(browser,rate){
 const context=await browser.newContext({viewport:{width:1016,height:1100}}),page=await context.newPage(),requests=[],errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 const css=['mobile-support.css','mobile-ui.css'].map(name=>fs.readFileSync(path.join(assets,name),'utf8')).join('\n');
 const scripts=['android-bridge.js','device-features.js','mobile-ui.js'].map(name=>fs.readFileSync(path.join(assets,name),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');
 await context.addInitScript({content:`localStorage.setItem('geraina_token','isolated-performance-fixture');localStorage.setItem('geraina_user',${JSON.stringify(JSON.stringify(user))});window.GerainaNative={postMessage:()=>{}};window.__navigationPerformance={frames:0,queries:0,longTasks:[]};const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{if(fn.name==='sync')__navigationPerformance.frames++;return raf(fn)};for(const type of [Document,Element])for(const name of ['querySelector','querySelectorAll']){const original=type.prototype[name];type.prototype[name]=function(...args){__navigationPerformance.queries++;return original.apply(this,args)}};new PerformanceObserver(list=>__navigationPerformance.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});${scripts}`});
 await page.route('https://dagangos.com/geraina/**',route=>{const pathname=new URL(route.request().url()).pathname;return route.fulfill({path:path.join(build,pathname.includes('/static/')?pathname.slice('/geraina/'.length):'index.html')});});
 await page.route('https://dagangos.com/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());assert.equal(request.method(),'GET','This audit never writes API data');
  const row={path:url.pathname,query:url.search,startedAt:Date.now()};requests.push(row);
  await new Promise(resolve=>setTimeout(resolve,url.pathname==='/api/auth/me'?1500:250));
  const json=url.pathname==='/api/auth/me'?user:url.pathname==='/api/products'?products.filter(p=>(!url.searchParams.get('q')||p.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()))&&(!url.searchParams.get('category')||p.category===url.searchParams.get('category'))):url.pathname.endsWith('category-names')?['Coffee','Tea']:url.pathname==='/api/orders/stats'?{today_sales:0,today_orders:0,product_count:500}:url.pathname==='/api/settings'?{}:[];
  row.respondedAt=Date.now();return route.fulfill({json}).catch(()=>{});
 });
 const cdp=await context.newCDPSession(page);if(rate!==1)await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 let start=Date.now();await page.goto('https://dagangos.com/geraina/app/dashboard',{waitUntil:'domcontentloaded'});await page.getByTestId('mobile-dashboard').waitFor();const shellMs=Date.now()-start;await page.waitForFunction(()=>document.querySelector('[data-testid="mobile-revenue"]')?.textContent==='Rp 0');await paint();const dashboardDataMs=Date.now()-start;
 await page.waitForTimeout(1700);await page.evaluate(()=>{window.__performanceDocument=crypto.randomUUID();window.__performanceOriginalDocument=__performanceDocument;});
 const dashboard=await page.evaluate(()=>({...__navigationPerformance,nodeCount:document.querySelectorAll('*').length,hiddenCharts:document.querySelectorAll('.recharts-responsive-container').length}));
 let before=requests.length;start=Date.now();await page.evaluate(()=>GerainaRouter.navigate('https://dagangos.com/geraina/app/products'));await page.getByTestId('products-page').waitFor();const productsShellMs=Date.now()-start;await page.getByTestId('products-loading').waitFor({state:'hidden'});await page.getByTestId('product-row-p-0').waitFor();await paint();const productsDataMs=Date.now()-start,productRequests=requests.slice(before),catalogue=await page.evaluate(()=>({...__navigationPerformance,nodeCount:document.querySelectorAll('*').length,rows:document.querySelectorAll('[data-testid^="product-row-"]').length}));
 before=requests.length;start=Date.now();await page.getByTestId('products-search').fill('Coffee 49');await page.getByTestId('product-row-p-0').waitFor({state:'hidden'});await page.getByTestId('product-row-p-499').waitFor();await paint();const searchMs=Date.now()-start,searchRequests=requests.slice(before);
 before=requests.length;start=Date.now();await page.evaluate(()=>GerainaRouter.navigate('https://dagangos.com/geraina/app/pos'));await page.getByTestId('pos-page').waitFor();const posShellMs=Date.now()-start;await page.getByTestId('pos-product-p-0').waitFor();await paint();const posDataMs=Date.now()-start,posRequests=requests.slice(before),pos=await page.evaluate(()=>({...__navigationPerformance,nodeCount:document.querySelectorAll('*').length,cards:document.querySelectorAll('[data-testid="pos-product-grid"] button').length,sameDocument:__performanceDocument===__performanceOriginalDocument}));
 assert.deepEqual(errors,[]);assert.equal(pos.sameDocument,true);
 const result={tag,cpuThrottle:rate,apiDelayMs:250,authDelayMs:1500,shellMs,dashboardDataMs,productsShellMs,productsDataMs,searchMs,posShellMs,posDataMs,dashboard,catalogue,pos,productRequests,searchRequests,posRequests,requests,errors};
 await context.close();console.log(JSON.stringify({tag,cpuThrottle:rate,shellMs,dashboardDataMs,productsShellMs,productsDataMs,searchMs,posShellMs,posDataMs,productGetCount:productRequests.filter(row=>row.path==='/api/products').length,productRows:catalogue.rows,productNodes:catalogue.nodeCount,hiddenCharts:dashboard.hiddenCharts,posCards:pos.cards,posNodes:pos.nodeCount}));return result;
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];try{for(const rate of [1,4])results.push(await sample(browser,rate));}finally{await browser.close();fs.writeFileSync(path.join(out,`${tag}.json`),JSON.stringify({scope:'Controlled Chromium replay, 500 synthetic products, fixed 250ms API/1500ms auth latency. CPU throttle is simulated; this does not measure physical HyperOS, real device startup, or production backend response time.',tag,merchantWrites:0,results},null,2));}})().catch(error=>{console.error(error.message);process.exitCode=1;});
