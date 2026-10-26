const { test, expect } = require('@playwright/test');
const { fixture, scenarios } = require('../../android-app/scripts/verify-remaining-pos.cjs');

test('Barcode shortcut opens the camera while explicit manual entry still adds a product', async ({browser},info)=>{
 const f=await fixture(browser,info.project.use.viewport);
 try{
  await f.page.goto('https://dagangos.com/geraina/app/pos');
  await f.page.getByTestId('camera-scan').waitFor();
  await f.page.evaluate(()=>{window.scannerRequests=[];window.GerainaNative.postMessage=raw=>scannerRequests.push(JSON.parse(raw));});
  const form=f.page.getByRole('form',{name:'Scan barcode dengan kamera'});
  await form.click();
  expect(await f.page.evaluate(()=>scannerRequests.filter(m=>m.type==='scanBarcode'))).toEqual([{type:'scanBarcode',target:'pos'}]);
  expect(await f.page.evaluate(()=>document.documentElement.classList.contains('ga-barcode-open'))).toBe(false);
  await f.page.getByTestId('camera-scan').click();
  expect(await f.page.evaluate(()=>scannerRequests.filter(m=>m.type==='scanBarcode').length)).toBe(2);
  await f.page.getByTestId('manual-barcode').click();
  await expect(f.page.getByTestId('pos-barcode-input')).toBeVisible();
  await f.page.getByTestId('pos-barcode-input').fill('SKU-0');
  await form.getByRole('button',{name:'Scan',exact:true}).click();
  await expect(f.page.getByTestId('cart-qty-0')).toHaveText('1');
  expect(await f.page.evaluate(()=>scannerRequests.filter(m=>m.type==='scanBarcode').length)).toBe(2);
  expect(f.errors).toEqual([]);expect(f.writes).toEqual([]);
 }finally{await f.context.close();}
});

for (const scenario of scenarios) {
  test(scenario.name, async ({ browser }, testInfo) => {
    const f = await fixture(browser, testInfo.project.use.viewport, scenario.options);
    await f.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    let failed = false;
    try {
      await test.step(scenario.name, () => scenario.run(f));
      expect(f.errors, 'No uncaught application errors').toEqual([]);
      const screenshot = testInfo.outputPath('screen.png');
      await f.page.screenshot({ path: screenshot });
      await testInfo.attach('screen', { path: screenshot, contentType: 'image/png' });
    } catch (error) {
      failed = true;
      const screenshot = testInfo.outputPath('failure.png');
      await f.page.screenshot({ path: screenshot }).then(() => testInfo.attach('failure', { path: screenshot, contentType: 'image/png' })).catch(() => {});
      throw error;
    } finally {
      await testInfo.attach('isolated-requests', {
        body: Buffer.from(JSON.stringify({ merchantWrites: 0, requests: f.requests, isolatedWrites: f.writes.map(row => row.path), runtimeErrors: f.errors }, null, 2)),
        contentType: 'application/json',
      });
      if (failed) {
        const trace = testInfo.outputPath('trace.zip');
        await f.context.tracing.stop({ path: trace });
        await testInfo.attach('trace', { path: trace, contentType: 'application/zip' });
      } else await f.context.tracing.stop();
      await f.context.close();
    }
  });
}
