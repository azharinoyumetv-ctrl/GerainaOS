const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join,extname}=require('node:path');
const {inspect,verify,contrast}=require('./verify-login-contrast.cjs');
const {loadTestConfig}=require('./test-config.cjs');
const config=loadTestConfig(),build=join(__dirname,'../../frontend/build');
async function localFrontend(page){
 if(process.env.GERAINA_USE_LOCAL_FRONTEND!=='1')return;
 await page.route('**/geraina/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/geraina/static/')){const file=join(build,path.slice('/geraina/'.length));return route.fulfill({body:readFileSync(file),contentType:extname(file)==='.js'?'text/javascript':extname(file)==='.css'?'text/css':'application/octet-stream'});}
  if(/^\/geraina\/(login|register|app(?:\/.*)?)$/.test(path))return route.fulfill({body:readFileSync(join(build,'index.html')),contentType:'text/html'});
  return route.continue();
 });
}
async function readOnly(page){await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())||new URL(route.request().url()).pathname==='/api/auth/login'?route.continue():route.abort());}
async function loginContrast(page){
 if(page.url().startsWith(config.base+'/'))await page.evaluate(()=>localStorage.clear());
 await page.goto(`${config.base}/geraina/login`);await page.getByTestId('login-form').waitFor();
 await page.waitForFunction(()=>document.documentElement.dataset.gaUi==='1');
 await page.getByTestId('login-email-input').fill('visibility@example.invalid');await page.getByTestId('login-password-input').fill('VisibilitySample123');await page.getByTestId('login-password-input').blur();
 const fields=await inspect(page);verify(fields);
 assert.equal(await page.locator('h1').first().evaluate(element=>getComputedStyle(element).userSelect),'none');
 assert.equal(await page.getByTestId('login-email-input').evaluate(element=>getComputedStyle(element).userSelect),'text');
 return fields.map(field=>({id:field.id,textContrast:contrast(field.fill,field.background)}));
}
async function signIn(page){
 await page.getByTestId('login-email-input').fill(config.email);await page.getByTestId('login-password-input').fill(config.password);await page.getByTestId('login-submit-btn').click();await page.getByTestId('dashboard-page').waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('geraina_user')).store_name),config.store);
}
async function openNav(page){if(await page.evaluate(()=>innerWidth<960)){await page.evaluate(()=>GerainaMobile.openMenu());await page.getByTestId('mobile-sidebar-backdrop').waitFor();}}
async function menuChecks(page,screenshot){
 const wide=await page.evaluate(()=>innerWidth>=960);await openNav(page);
 const before=new URL(page.url()).pathname,button=page.getByTestId('menu-parent-products');
 if(await button.getAttribute('aria-expanded')!=='true')await button.click();
 assert.equal(new URL(page.url()).pathname,before,'Expanding a navigation section does not replace the page');
 await page.getByRole('link',{name:'Kategori',exact:true}).waitFor();
 const sidebar=await page.getByTestId('app-sidebar').boundingBox();assert.ok(sidebar.x>=-1);
 await page.getByTestId('odoo-ecosystem-switcher-btn').click();await page.getByTestId('odoo-ecosystem-menu').waitFor();
 assert.ok((await page.getByTestId('suite-tile-geraina').innerText()).includes('Aktif'));
 assert.equal(await page.getByTestId('suite-tile-geraina').getAttribute('href'),'/geraina/app/dashboard');
 const texts=await page.getByTestId('odoo-ecosystem-menu').evaluate(root=>[...root.querySelectorAll('span,p,a')].filter(element=>[...element.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim())).map(element=>{
  const style=getComputedStyle(element);let parent=element,background='';while(parent){background=getComputedStyle(parent).backgroundColor;if(background!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;}return {text:element.textContent.trim(),color:style.color,background};
 }));
 for(const text of texts)assert.ok(contrast(text.color,text.background)>=4.5,`Suite text is readable: ${text.text}`);
 await screenshot('suite-menu-readable');await page.getByTestId('odoo-ecosystem-switcher-btn').click();
 await page.getByRole('link',{name:'Kategori',exact:true}).click();await page.getByTestId('categories-page').waitFor();
 if(wide){const geometry=await page.evaluate(()=>({sidebar:document.querySelector('[data-testid="app-sidebar"]').getBoundingClientRect().toJSON(),workspace:document.querySelector('.ecosystem-workspace').getBoundingClientRect().toJSON(),width:innerWidth}));assert.ok(geometry.sidebar.x>=0);assert.ok(geometry.workspace.x>=geometry.sidebar.right-1);assert.ok(geometry.workspace.right<=geometry.width+1);}
 else await page.getByTestId('mobile-sidebar-backdrop').waitFor({state:'hidden'});
 return {wide,suiteTextChecks:texts.length};
}
async function metadataChecks(page,screenshot){
 const results=[];
 for(const [collection,singular]of[['categories','category'],['brands','brand'],['units','unit']]){
  let mode='failure',writes=0,rows=[];
  const pattern=new RegExp(`/api/products/${collection}(?:/[^?]+)?(?:\\?.*)?$`);
  await page.route(pattern,async route=>{
   const request=route.request(),method=request.method();if(method==='GET')return route.fulfill({json:rows});
   writes++;await new Promise(resolve=>setTimeout(resolve,500));
   if(mode==='failure')return route.fulfill({status:503,json:{detail:'Layanan sementara tidak tersedia. Coba lagi.'}});
   const payload=request.postDataJSON();assert.ok(payload.name.trim());if(singular==='unit')assert.ok(payload.short_name.trim());
   if(method==='POST')rows.push({id:`local-${collection}`,...payload});
   else if(method==='PUT')rows[0]={...rows[0],...payload};
   else throw new Error('Only isolated create/edit fixtures are supported');
   return route.fulfill({json:rows[0]});
  });
  try{
   await page.goto(`${config.base}/geraina/app/products/${collection}`);await page.getByTestId(`${singular}-form`).waitFor();
   const button=page.getByTestId(`${singular}-submit`);await button.click();await page.getByTestId(`${singular}-error`).waitFor();assert.equal(writes,0);
   await page.getByTestId(`${singular}-name-input`).fill('   ');
   if(singular==='unit')await page.getByTestId('unit-symbol-input').fill('pcs');
   await button.click();await page.getByTestId(`${singular}-error`).waitFor();assert.equal(writes,0);
   await page.getByTestId(`${singular}-name-input`).fill(`LOCAL FIXTURE ${collection}`);
   if(singular!=='unit')await page.getByTestId(`${singular}-desc-input`).fill('Isolated local example');
   await button.click();assert.equal(await button.isDisabled(),true);await page.getByTestId(`${singular}-error`).getByText('Layanan sementara tidak tersedia. Coba lagi.').waitFor();
   assert.equal(await page.getByTestId(`${singular}-name-input`).inputValue(),`LOCAL FIXTURE ${collection}`);assert.equal(writes,1);
   mode='success';await button.click();await page.getByTestId(`${singular}-success`).waitFor();
   await page.getByTestId(`${collection}-list`).getByText(`LOCAL FIXTURE ${collection}`,{exact:true}).waitFor();
   assert.equal(await page.getByTestId(`${singular}-name-input`).inputValue(),'');
   await page.getByTestId(`${collection}-list`).getByTitle('Edit',{exact:true}).click();
   await page.getByTestId(`${singular}-name-input`).fill(`EDITED LOCAL ${collection}`);await button.click();
   await page.getByTestId(`${collection}-list`).getByText(`EDITED LOCAL ${collection}`,{exact:true}).waitFor();
   await screenshot(`${collection}-saved`);assert.equal(writes,3);results.push({collection,emptyAndWhitespaceValidation:true,pendingState:true,serverErrorPreservesInput:true,retryCreatesRow:true,editUpdatesRow:true,interceptedWrites:writes});
  }finally{await page.unroute(pattern);}
 }
 return results;
}
module.exports={localFrontend,readOnly,loginContrast,signIn,openNav,menuChecks,metadataChecks};
