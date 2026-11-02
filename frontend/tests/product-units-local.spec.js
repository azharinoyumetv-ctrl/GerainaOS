const {test,expect,host}=require('./customer-audit.fixture.cjs');

test('Saved units can be chosen in a new product and survive save, reload and edit',async({app:f})=>{
 await f.go('app/products/units');
 await f.page.getByTestId('unit-name-input').fill('Kilogram');
 await f.page.getByTestId('unit-symbol-input').fill('kg');
 await f.page.getByTestId('unit-submit').click();
 await expect(f.page.getByTestId('unit-success')).toBeVisible();
 await f.go('app/products');await f.page.getByTestId('new-product-btn').click();
 const unit=f.page.getByTestId('pf-unit');
 await expect(unit).toHaveJSProperty('tagName','SELECT');
 await expect(unit.locator('option').filter({hasText:/^Kilogram \(kg\)$/})).toHaveCount(1);
 await unit.selectOption({label:'Kilogram (kg)'});
 await f.page.getByTestId('pf-name').fill('Produk satuan tersimpan');await f.page.getByTestId('pf-price').fill('5000');
 await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 const saved=(await f.api('GET','/products?q=Produk%20satuan%20tersimpan')).data[0];expect(saved.unit).toBe('kg');
 await f.page.reload();await f.page.getByTestId('edit-product-'+saved.id).click();
 await expect(f.page.getByTestId('pf-unit').locator('option:checked')).toHaveText('Kilogram (kg)');
 await f.page.getByTestId('pf-price').fill('6000');await f.page.getByTestId('pf-save').click();
 await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 expect((await f.api('GET','/products?q=Produk%20satuan%20tersimpan')).data[0].unit).toBe('kg');expect(f.errors).toEqual([]);
});

test('Legacy units and pcs remain selectable with an empty registry; custom units are retained',async({app:f})=>{
 expect((await f.api('PUT','/products/product-0000',{unit:'karton lama'})).status).toBe(200);
 await f.go('app/products');await f.page.getByTestId('edit-product-product-0000').click();
 await expect(f.page.getByTestId('pf-unit').locator('option:checked')).toHaveText('karton lama');
 await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 expect((await f.api('GET','/products?q=Legacy')).data[0].unit).toBe('karton lama');
 await f.page.getByTestId('new-product-btn').click();
 await expect(f.page.getByTestId('pf-unit').locator('option:checked')).toHaveText('pcs');
 await f.page.getByTestId('pf-unit').selectOption({label:'Satuan lainnya…'});
 await f.page.getByTestId('pf-unit-custom').fill('   ');await f.page.getByTestId('pf-name').fill('Satuan khusus');
 await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('pf-error')).toContainText('satuan');
 await f.page.getByTestId('pf-unit-custom').fill('  dus  ');await f.page.getByTestId('pf-save').click();
 await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 const saved=(await f.api('GET','/products?q=Satuan%20khusus')).data[0];expect(saved.unit).toBe('dus');
 await f.page.getByTestId('edit-product-'+saved.id).click();await expect(f.page.getByTestId('pf-unit').locator('option:checked')).toHaveText('dus');expect(f.errors).toEqual([]);
});

test('Failed unit loading is visible and retry preserves the product draft',async({app:f})=>{
 expect((await f.api('POST','/products/units',{name:'Botol',short_name:'btl'})).status).toBe(200);
 let fail=true;await f.page.route('**/api/records/units?*',r=>fail?r.fulfill({status:503,json:{detail:'Isolated failure'}}):r.fallback());
 await f.go('app/products');await f.page.getByTestId('new-product-btn').click();await f.page.getByTestId('pf-name').fill('Draft tetap');
 await expect(f.page.getByTestId('pf-unit-error')).toBeVisible();fail=false;
 await f.page.getByTestId('pf-unit-error').getByRole('button',{name:'Coba lagi'}).click();
 await expect(f.page.getByTestId('pf-unit').locator('option').filter({hasText:/^Botol \(btl\)$/})).toHaveCount(1);
 await expect(f.page.getByTestId('pf-unit-error')).toHaveCount(0);await expect(f.page.getByTestId('pf-name')).toHaveValue('Draft tetap');expect(f.errors).toEqual([]);
});

test('Only active-store units are offered, including newly added units on reopening the editor',async({app:f})=>{
 expect((await f.api('POST','/products/units',{name:'Paket toko',short_name:'pkt'})).status).toBe(200);
 const login=await f.request.post(host+'/api/auth/login',{data:{email:'owner-b@example.com',password:'DisposableAudit123'}});expect(login.status()).toBe(200);const session=await login.json();
 const other=await f.request.post(host+'/api/products/units',{headers:{authorization:'Bearer '+session.access_token,'x-dagangos-module':'geraina'},data:{name:'Rahasia toko lain',short_name:'secret'}});expect(other.status()).toBe(200);
 await f.go('app/products');await f.page.getByTestId('new-product-btn').click();
 await expect(f.page.getByTestId('pf-unit').locator('option').filter({hasText:/^Paket toko \(pkt\)$/})).toHaveCount(1);
 await expect(f.page.getByTestId('pf-unit').locator('option').filter({hasText:/Rahasia/})).toHaveCount(0);await f.page.getByTestId('pf-cancel').click();
 expect((await f.api('POST','/products/units',{name:'Dus baru',short_name:'dus'})).status).toBe(200);
 await f.page.getByTestId('new-product-btn').click();await expect(f.page.getByTestId('pf-unit').locator('option').filter({hasText:/^Dus baru \(dus\)$/})).toHaveCount(1);expect(f.errors).toEqual([]);
});

test('All pages load, duplicate symbols collapse and legacy full-name values stay unchanged',async({app:f})=>{
 expect((await f.api('PUT','/products/product-0000',{unit:'Kilogram'})).status).toBe(200);
 const rows=[{id:'u-0000',name:'Kilogram',short_name:'kg'}, {id:'u-0001',name:'Kg duplicate',short_name:'kg'},...Array.from({length:499},(_,i)=>({id:'u-'+String(i+2).padStart(4,'0'),name:'Unit '+i,short_name:'s'+i}))];const reads=[];
 await f.page.route('**/api/records/units?*',r=>{const cursor=new URL(r.request().url()).searchParams.get('cursor');reads.push(cursor);return r.fulfill({json:{items:cursor?rows.slice(500):rows.slice(0,500),total:501,next_cursor:cursor?null:'next-unit-page'}});});
 await f.go('app/products');await f.page.getByTestId('edit-product-product-0000').click();const unit=f.page.getByTestId('pf-unit');
 await expect(unit.locator('option:checked')).toHaveText('Kilogram');
 await expect(unit.locator('option[value="unit:kg"]')).toHaveCount(1);await expect(unit.locator('option[value="unit:s498"]')).toHaveCount(1);
 await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);expect((await f.api('GET','/products?q=Legacy')).data[0].unit).toBe('Kilogram');expect(reads).toContain('next-unit-page');
 await f.page.getByTestId('new-product-btn').click();await unit.selectOption('unit:s498');await f.page.screenshot({path:test.info().outputPath('unit-selection.png')});
 expect(await f.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);expect(f.errors).toEqual([]);
});
