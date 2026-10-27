// Real published frontend/backend; this test never submits a support request.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../../frontend/node_modules/playwright'),{loadTestConfig}=require('./test-config.cjs');
const config=loadTestConfig(),out=path.resolve(__dirname,'../app/build/reports/support-public');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),blocked=[];try{
 const context=await browser.newContext({viewport:{width:412,height:915}}),page=await context.newPage();
 await page.route('**/api/**',route=>{const r=route.request(),u=new URL(r.url());if(['GET','HEAD','OPTIONS'].includes(r.method())||u.pathname==='/api/auth/login')return route.continue();blocked.push(u.pathname);return route.abort();});
 await page.goto(config.base+'/geraina/login');await page.getByTestId('login-email-input').fill(config.email);await page.getByTestId('login-password-input').fill(config.password);await page.getByTestId('login-submit-btn').click();await page.waitForURL('**/geraina/app/**');
 await page.goto(config.base+'/geraina/app/about');const support=page.getByTestId('about-support');assert.equal(await support.getAttribute('href'),null);await support.click();await page.getByTestId('support-account-email').waitFor();assert.equal(await page.getByTestId('support-account-email').innerText(),config.email);assert.equal(await page.getByTestId('support-submit').isEnabled(),true);assert.equal(await page.getByRole('textbox',{name:/email/i}).count(),0);assert.deepEqual(blocked,[]);
 await page.screenshot({path:path.join(out,'published-form.png')});const report={status:'passed',publishedFrontendVerified:true,authenticatedEmailMatched:true,identityNotEditable:true,submissionReady:true,supportRequestsSubmitted:0,merchantWrites:0};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
