const assert=require('node:assert/strict');
async function keyboardBack(page,adb,screenshot){
 const previous=adb(['shell','settings','get','secure','show_ime_with_hard_keyboard']).trim();
 try{
  adb(['shell','settings','put','secure','show_ime_with_hard_keyboard','1']);
  await page.goto('https://dagangos.com/geraina/app/products');await page.getByTestId('products-search').waitFor();
  const height=await page.evaluate(()=>innerHeight);await page.getByTestId('products-search').click();
  await page.waitForFunction(before=>innerHeight<before-100,height,{timeout:15000});
  assert.match(adb(['shell','dumpsys','input_method']),/mInputShown=true/);
  await screenshot('keyboard-visible');adb(['shell','input','keyevent','KEYCODE_BACK']);
  await page.waitForFunction(before=>innerHeight>=before-2,height,{timeout:15000});
  assert.equal(new URL(page.url()).pathname,'/geraina/app/products');await screenshot('back-dismissed-keyboard');
 }finally{adb(['shell','settings',previous==='null'?'delete':'put','secure','show_ime_with_hard_keyboard',...(previous==='null'?[]:[previous])]);}
}
module.exports={keyboardBack};
