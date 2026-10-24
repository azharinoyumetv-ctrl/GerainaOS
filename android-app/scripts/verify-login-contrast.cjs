const assert=require('node:assert/strict');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const {chromium}=require('../../frontend/node_modules/playwright');
const root=join(__dirname,'..'),observe=process.argv.includes('--observe');
const out=join(root,'app/build/reports/login-contrast',observe?'before':'browser');mkdirSync(out,{recursive:true});
const css=readFileSync(join(root,'app/src/main/assets/mobile-support.css'),'utf8')+'\n'+readFileSync(join(root,'app/src/main/assets/mobile-ui.css'),'utf8');
const mobile=readFileSync(join(root,'app/src/main/assets/mobile-ui.js'),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css));
const bridge=readFileSync(join(root,'app/src/main/assets/android-bridge.js'),'utf8');
function rgba(value){const parts=value.match(/[\d.]+/g)?.map(Number);assert.ok(parts&&parts.length>=3,`Expected rendered RGB color: ${value}`);return [...parts.slice(0,3),parts[3]??1];}
function contrast(foreground,background){const fg=rgba(foreground),bg=rgba(background),mixed=fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const a=luminance(mixed),b=luminance(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(Number.isFinite(ratio));return ratio;}
async function inspect(page){return page.locator('.auth-field input').evaluateAll(inputs=>inputs.map(input=>{const style=getComputedStyle(input),placeholder=getComputedStyle(input,'::placeholder'),selection=getComputedStyle(input,'::selection');return {id:input.dataset.testid,type:input.type,color:style.color,fill:style.webkitTextFillColor,background:style.backgroundColor,caret:style.caretColor,placeholder:placeholder.color,selectionColor:selection.color,selectionBackground:selection.backgroundColor};}));}
function verify(fields){assert.ok(fields.length>=2);for(const field of fields){assert.ok(contrast(field.fill||field.color,field.background)>=4.5,`${field.id}: typed text contrasts with its field`);assert.ok(contrast(field.placeholder,field.background)>=4.5,`${field.id}: placeholder remains readable`);assert.ok(contrast(field.caret,field.background)>=3,`${field.id}: caret remains visible`);}}
module.exports={contrast,inspect,verify};
if(require.main===module)(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{
  const context=await browser.newContext();await context.addInitScript({content:`window.GerainaNative={postMessage:()=>{}};\n${bridge}\n${mobile}`});
  const page=await context.newPage();
  // This check never submits a login or registration request.
  await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
  for(const viewport of observe?[{width:1016,height:1380}]:[{width:393,height:760},{width:1016,height:1380},{width:1524,height:872}])for(const colorScheme of observe?['light']:['light','dark']){
   await page.setViewportSize(viewport);await page.emulateMedia({colorScheme});
   for(const form of observe?['login']:['login','register']){
    await page.goto(`https://dagangos.com/geraina/${form}`);await page.getByTestId(`${form}-form`).waitFor();
    await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ga-ui'));
    if(form==='register')await page.getByTestId('register-store-input').fill('Visibility sample store');
    await page.getByTestId(`${form}-email-input`).fill('visibility@example.invalid');
    await page.getByTestId(`${form}-password-input`).fill('VisibilitySample123');
    const fields=await inspect(page);if(!observe)verify(fields);
    await page.getByTestId(`${form}-email-input`).focus();
    if(!observe)verify(await inspect(page));
    const screenshot=`${form}-${viewport.width}-${colorScheme}.png`;await page.screenshot({path:join(out,screenshot)});
    results.push({form,viewport,colorScheme,fields:fields.map(field=>({...field,textContrast:contrast(field.fill||field.color,field.background)})),screenshot});
   }
  }
  const report={status:observe?'observed':'passed',scope:'Bundled Android presentation in Chromium, dummy text only; no login or account creation submitted',verifiedAt:new Date().toISOString(),results};
  writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:results.length,minimumTextContrast:Math.min(...results.flatMap(result=>result.fields.map(field=>field.textContrast))),report:join(out,'verification.json')},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
