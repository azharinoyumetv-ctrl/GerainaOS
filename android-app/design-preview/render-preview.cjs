const { chromium } = require('../../frontend/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1130},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(join(__dirname,'index.html')).href);
    await page.locator('[data-phone="2"] .inventory-row').first().waitFor();
    await page.screenshot({path:join(__dirname,'geraina-modern-sample.png'),fullPage:true});
    for(let index=0;index<3;index++) {
      await page.locator(`[data-phone="${index}"]`).screenshot({path:join(__dirname,`sample-${['dashboard','cashier','products'][index]}.png`)});
    }
    const cashier=page.locator('[data-phone="1"]');
    await cashier.getByRole('button',{name:'Tambah Air Mineral'}).click();
    await cashier.locator('.cart-summary').click();
    await cashier.getByRole('dialog',{name:'Keranjang'}).waitFor();
    assert.match(await cashier.locator('.sheet-total').innerText(),/54\.000/);
    await cashier.getByRole('button',{name:'Kurangi Air Mineral'}).click();
    assert.match(await cashier.locator('.sheet-total').innerText(),/48\.000/);
    await cashier.getByRole('button',{name:'Tutup',exact:true}).click();
    const catalogue=page.locator('[data-phone="2"]');
    await catalogue.getByRole('searchbox').fill('mineral');
    assert.equal(await catalogue.locator('.inventory-row').count(),1);
    await catalogue.locator('.inventory-row').click();
    await catalogue.getByRole('dialog',{name:'Air Mineral'}).waitFor();
    await catalogue.getByRole('button',{name:'Tutup',exact:true}).click();
    const dashboard=page.locator('[data-phone="0"]');
    await dashboard.getByRole('button',{name:'Laporan',exact:true}).last().click();
    await dashboard.getByText('Performa toko',{exact:true}).waitFor();
    await page.setViewportSize({width:390,height:880});
    await page.reload();
    await page.locator('[data-phone="0"] .revenue-card').waitFor();
    const mobileGeometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
    assert.ok(mobileGeometry.width<=mobileGeometry.viewport,JSON.stringify(mobileGeometry));
    assert.deepEqual(errors,[]);
    console.log('Preview rendered. Local cart, search, product details, navigation, and narrow layout checked. No Android tests or real account requests were run.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
