const {chromium}=require('../../frontend/node_modules/playwright');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const checks=require('./usability-checks.cjs');
const {loadTestConfig}=require('./test-config.cjs');
const root=join(__dirname,'..'),config=loadTestConfig(),out=join(root,'app/build/reports/usability-browser');mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];try{
 for(const width of [393,1016,1524]){
  const context=await browser.newContext({viewport:{width,height:width===1524?872:1100}});
  const css=readFileSync(join(root,'app/src/main/assets/mobile-support.css'),'utf8')+'\n'+readFileSync(join(root,'app/src/main/assets/mobile-ui.css'),'utf8');
  const mobile=readFileSync(join(root,'app/src/main/assets/mobile-ui.js'),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css));
  const bridge=readFileSync(join(root,'app/src/main/assets/android-bridge.js'),'utf8');
  await context.addInitScript({content:`window.GerainaNative={postMessage:()=>{}};\n${bridge}\n${mobile}`});
  const page=await context.newPage();page.setDefaultTimeout(30000);await checks.localFrontend(page);await checks.readOnly(page);
  const screenshot=name=>page.screenshot({path:join(out,`${width}-${name}.png`)});
  const login=await checks.loginContrast(page);await screenshot('login-readable');await checks.signIn(page);
  const menu=await checks.menuChecks(page,screenshot),metadata=await checks.metadataChecks(page,screenshot);
  results.push({width,login,menu,metadata});await context.close();
 }
 writeFileSync(join(out,'verification.json'),JSON.stringify({status:'passed',version:'1.1.2',localFrontend:process.env.GERAINA_USE_LOCAL_FRONTEND==='1',results,merchantWrites:0},null,2));console.log(JSON.stringify({status:'passed',widths:results.map(result=>result.width),metadataScenarios:results.reduce((n,result)=>n+result.metadata.length*6,0)},null,2));
}finally{await browser.close();}})().catch(error=>{console.error(String(error.message).split(config.password).join('[REDACTED]'));process.exitCode=1;});
