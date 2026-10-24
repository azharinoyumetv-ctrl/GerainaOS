const {chromium}=require('../../frontend/node_modules/playwright');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const {loadTestConfig}=require('./test-config.cjs');
const root=join(__dirname,'..'),config=loadTestConfig(),out=join(root,'app/build/reports/navigation-before');mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1016,height:1380}});
 const css=readFileSync(join(root,'app/src/main/assets/mobile-ui.css'),'utf8');
 const mobile=readFileSync(join(root,'app/src/main/assets/mobile-ui.js'),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css));
 const bridge=readFileSync(join(root,'app/src/main/assets/android-bridge.js'),'utf8');
 await context.addInitScript({content:`window.GerainaNative={postMessage:()=>{}};\n${bridge}\n${mobile}`});
 const page=await context.newPage();await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())||new URL(route.request().url()).pathname==='/api/auth/login'?route.continue():route.abort());
 await page.goto(`${config.base}/geraina/login`);await page.getByTestId('login-email-input').fill(config.email);await page.getByTestId('login-password-input').fill(config.password);await page.getByTestId('login-submit-btn').click();await page.getByTestId('dashboard-page').waitFor();
 await page.evaluate(()=>GerainaMobile.openMenu());await page.getByTestId('menu-parent-inventory').click();await page.waitForURL('**/geraina/app/inventory');await page.getByTestId('stock-overview-page').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-testid="app-sidebar"]').getBoundingClientRect().right<=0);
 const sidebar=await page.getByTestId('app-sidebar').boundingBox(),result={path:new URL(page.url()).pathname,sidebar,inventorySubmenuInViewport:await page.getByRole('link',{name:'Ringkasan Stok',exact:true}).evaluate(link=>{const r=link.getBoundingClientRect();return r.right>0&&r.left<innerWidth;}),backdropVisible:await page.getByTestId('mobile-sidebar-backdrop').isVisible()};
 await page.screenshot({path:join(out,'after-inventory-button.png')});writeFileSync(join(out,'observation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}})().catch(error=>{console.error(String(error.message).split(config.password).join('[REDACTED]'));process.exitCode=1;});
