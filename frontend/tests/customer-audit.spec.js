const {test,expect,host}=require('./customer-audit.fixture.cjs');
const origin='https://dagangos.com';

const routes=['dashboard','pos','sales','products','products/categories','products/brands','products/units','products/stock-adjustment','products/stock-transfer','inventory/overview','inventory/movement','inventory/valuation','inventory/low-stock','inventory/dead-stock','purchase/orders','purchase/receiving','purchase/invoices','suppliers','customers','customers/membership','customers/loyalty','debt/receivable','debt/payable','payments/cash','payments/qris','payments/ewallet','payments/va','payments/credit-card','payments/bank-transfer','payments/edc','reports/sales','reports/product','reports/inventory','reports/profit','reports/cashflow','reports/tax','staff/management','staff/roles','staff/permissions','staff/attendance','attendance','branches','integrations/xendit','integrations/doku','integrations/midtrans','integrations/whatsapp','integrations/qris','settings/general','settings/store','settings/billing','settings/receipt','settings/printer','settings/users','settings/license','about','license'];

test.describe('Every customer screen',()=>{
  for(const route of routes) test(route+' renders with working local APIs and fits the viewport',async({app:f})=>{
    await f.go('app/'+route);
    await expect(f.page.locator('.route-stage')).toBeVisible();
    await f.settle();
    await expect.poll(async () => (await f.page.locator('.route-stage').innerText()).trim().length).toBeGreaterThan(10);
    expect(f.errors).toEqual([]);
    expect(f.reads.filter(r=>r.status>=400)).toEqual([]);
    const overflow=await f.page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    expect(overflow,'The whole page must not require horizontal scrolling').toBeLessThanOrEqual(2);
  });
});

test('Login rejects a wrong password, supports reveal, and signs in with the real API',async({app:f})=>{
  await f.page.evaluate(()=>localStorage.clear());await f.go('login');
  await f.page.getByTestId('login-email-input').fill('owner-a@example.com');
  await f.page.getByTestId('login-password-input').fill('wrong-password');
  await f.page.getByTestId('login-password-toggle').click();
  await expect(f.page.getByTestId('login-password-input')).toHaveAttribute('type','text');
  await f.page.getByTestId('login-submit-btn').click();
  await expect(f.page.getByRole('alert')).toBeVisible();
  await f.page.getByTestId('login-password-input').fill('DisposableAudit123');
  await f.page.getByTestId('login-submit-btn').click();
  await expect(f.page.getByTestId('app-layout')).toBeVisible();
});

for(const [route,prefix,extra] of [['categories','category',null],['brands','brand',null],['units','unit','unit-symbol-input']]) {
  test('Customer can create and reload a product '+route,async({app:f})=>{
    await f.go('app/products/'+route);
    await f.page.getByTestId(prefix+'-name-input').fill('Audit new '+route);
    if(extra) await f.page.getByTestId(extra).fill('aud');
    await f.page.getByTestId(prefix+'-submit').click();
    await expect(f.page.getByTestId(prefix+'-success')).toBeVisible();
    await f.page.reload();await f.settle();
    await expect(f.page.getByText('Audit new '+route,{exact:true}).first()).toBeVisible();
  });
}

test('Customer creates a product using the barcode field and finds it in POS',async({app:f})=>{
  await f.go('app/products');await f.page.getByTestId('new-product-btn').click();
  await f.page.getByTestId('pf-name').fill('Audit scanned product');
  await f.page.evaluate(()=>dispatchEvent(new CustomEvent('geraina-barcode',{detail:{target:'product',value:'AUDIT-SCANNED'}})));
  await expect(f.page.getByTestId('pf-sku')).toHaveValue('AUDIT-SCANNED');
  await f.page.getByTestId('pf-price').fill('2500');await f.page.getByTestId('pf-stock').fill('5');
  await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  await f.go('app/pos');await f.page.getByTestId('pos-search').fill('Audit scanned product');
  await expect(f.page.locator('button[data-testid^="pos-product-"]')).toHaveCount(1);
});

test('Stock movement on a new store contains no invented sales or purchases',async({app:f})=>{
  await f.go('app/inventory/movement');await f.settle();
  await expect(f.page.getByText('Kopi Arabika 250g',{exact:true})).toHaveCount(0);
  await expect(f.page.getByText('ORD-1002',{exact:true})).toHaveCount(0);
});

test('Receiving a purchase changes actual stock rather than only its status',async({app:f})=>{
  await f.request.post(host+'/__audit/scenario/purchase');
  await f.go('app/purchase/receiving');await f.page.getByRole('button',{name:'Terima Barang'}).click();
  await expect(f.page.getByTestId('receiving-list')).toContainText('PO-AUDIT');
  const snapshot=await (await f.request.get(host+'/__audit/snapshot')).json();
  expect(snapshot.products.find(p=>p.id==='product-0000').stock,'5 units received should raise stock from 10 to 15').toBe(15);
});

test('Creating a purchase preserves its selected product and quantity',async({app:f})=>{
  const result=await f.api('POST','/purchase/orders',{po_no:'PO-LINES',supplier_id:'supplier-a',supplier_name:'Audit supplier',total:5000,items:[{product_id:'product-0000',quantity:5,price:1000}],status:'Ordered'});
  expect(result.status).toBe(200);
  const saved=(await f.api('GET','/purchase/orders')).data.find(p=>p.po_no==='PO-LINES');
  expect(saved.items,'Purchasing requires persistent product/quantity lines').toEqual([expect.objectContaining({product_id:'product-0000',qty:5,cost:1000})]);
});

test('A voided sale cannot be marked paid again without restoring stock accounting',async({app:f})=>{
  const order=await f.api('POST','/orders',{items:[{product_id:'product-0000',name:'Audit Product 0000',price:1000,quantity:1,subtotal:1000}],payment_method:'cash',cash_received:1000});
  expect(order.status).toBe(200);
  expect((await f.api('POST',`/orders/${order.data.id}/void`)).status).toBe(200);
  const resurrect=await f.api('POST',`/orders/${order.data.id}/mark-paid`);
  expect(resurrect.status,'Voided is a terminal state; restoring payment alone corrupts stock/revenue').toBeGreaterThanOrEqual(400);
});

test.describe('Large catalogue selectors',()=>{
  test.use({seedProducts:501});
  for(const route of ['products/stock-adjustment','products/stock-transfer','purchase/orders']) test(route+' can select product 501',async({app:f})=>{
    await f.go('app/'+route);
    await f.page.locator('select').first().waitFor();
    const values=await f.page.locator('select option').allTextContents();
    expect(values.some(v=>v.includes('Audit Product 0500')),'The selector must include the complete store catalogue').toBeTruthy();
  });
});

test.describe('Cashier boundaries',()=>{
  test.use({auditRole:'cashier'});
  test('Cashier reaches own attendance and cannot write owner payment settings',async({app:f})=>{
    await f.go('app/attendance');await expect(f.page.getByTestId('app-layout')).toBeVisible();
    expect(f.reads.filter(r=>r.status>=400)).toEqual([]);
    expect((await f.api('POST','/payments/config',{cash:{is_active:false}})).status).toBe(403);
    expect((await f.api('GET','/integrations')).status).toBe(403);
  });
});

for(const [route,apiPath] of [['dashboard','/orders/stats'],['inventory/movement','/inventory/movements'],['purchase/orders','/records/purchase-orders'],['purchase/receiving','/records/receiving'],['purchase/invoices','/records/invoices'],['customers','/records/customers'],['suppliers','/records/suppliers'],['branches','/records/branches'],['settings/general','/settings']]) {
  test('A failed read on '+route+' is visible to the customer',async({app:f})=>{
    await f.context.route(origin+'/api'+apiPath+'*',route=>route.fulfill({status:503,json:{detail:'Isolated audit interruption'}}));
    await f.go('app/'+route);
    await expect(f.page.getByRole('alert').first(),'A failed read must have an explicit error state').toBeVisible();
  });
}
