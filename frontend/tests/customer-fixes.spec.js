const {test,expect,host}=require('./customer-audit.fixture.cjs');
const snapshot=async f=>(await f.request.get(host+'/__audit/snapshot')).json();

test('Merchant creates an itemized PO, receives it and sees the actual stock movement',async({app:f})=>{
 await f.go('app/purchase/orders');
 await f.page.getByTestId('po-supplier-select').selectOption('supplier-a');
 await f.page.getByTestId('po-number-input').fill('PO-UI-FULL');
 await f.page.getByTestId('po-product-select').selectOption('product-0000');
 await f.page.getByTestId('po-qty-input').fill('5');await f.page.getByTestId('po-cost-input').fill('400');
 await f.page.getByTestId('po-add-item').click();await f.page.getByTestId('po-create-btn').click();
 await expect(f.page.getByTestId('purchase-order-list')).toContainText('PO-UI-FULL');
 await f.go('app/purchase/receiving');await f.page.getByRole('button',{name:'Terima Barang',exact:true}).click();
 await expect(f.page.getByTestId('receiving-list')).toContainText('PO-UI-FULL');
 const state=await snapshot(f);expect(state.products.find(p=>p.id==='product-0000').stock).toBe(15);
 expect(state.goods_receiving).toHaveLength(1);
 await f.go('app/inventory/movement');await expect(f.page.getByText('PO-UI-FULL',{exact:true})).toBeVisible();
});

test('An SKU-less product can be adjusted through its actual product ID',async({app:f})=>{
 expect((await f.api('PUT','/products/product-0000',{sku:''})).status).toBe(200);
 await f.go('app/products/stock-adjustment');await f.page.getByTestId('adjustment-product-select').selectOption('product-0000');
 await f.page.getByTestId('adjustment-qty-input').fill('3');await f.page.getByTestId('adjustment-reason-input').fill('Physical count audit');
 await f.page.getByTestId('adjustment-submit').click();await expect(f.page.getByTestId('adjustment-list')).toContainText('Physical count audit');
 expect((await snapshot(f)).products.find(p=>p.id==='product-0000').stock).toBe(13);
});

test('Branch shipment and receipt change only the correct branch balances',async({app:f})=>{
 await f.go('app/products/stock-transfer');await f.page.getByTestId('transfer-dest-select').selectOption('branch-a');
 await f.page.getByTestId('transfer-product-select').selectOption('product-0000');await f.page.getByTestId('transfer-qty-input').fill('4');
 await f.page.getByTestId('transfer-submit').click();await expect(f.page.getByTestId('transfer-list')).toContainText('Shipped');
 let state=await snapshot(f);const transfer=state.stock_transfers[0];expect(state.products.find(p=>p.id==='product-0000').stock).toBe(6);
 await f.page.getByTestId('receive-transfer-'+transfer.id).click();await expect(f.page.getByTestId('transfer-list')).toContainText('Received');
 state=await snapshot(f);const product=state.products.find(p=>p.id==='product-0000');expect(product.stock).toBe(6);expect(product.stock_by_branch['branch-a']).toBe(4);
});

test('A partial supplier payment and final invoice settlement agree on both screens',async({app:f})=>{
 await f.go('app/purchase/invoices');
 await f.page.getByTestId('invoice-number').fill('INV-UI-PARTIAL');
 await f.page.getByTestId('supplier-invoice-form').locator('select').nth(1).selectOption('supplier-a');
 await f.page.getByTestId('invoice-amount').fill('2000');
 await f.page.getByTestId('invoice-due').fill('2026-11-30');
 await f.page.getByRole('button',{name:'Simpan faktur',exact:true}).click();
 await expect(f.page.getByRole('row').filter({hasText:'INV-UI-PARTIAL'})).toBeVisible();
 let state=await snapshot(f);const payable=state.debt_payables[0];
 await f.go('app/debt/payable');await f.page.getByTestId('pay-debt-'+payable.id).click();
 await f.page.getByTestId('debt-payment-amount').fill('500');await f.page.getByTestId('debt-payment-save').click();
 await expect(f.page.getByTestId('debt-payment-dialog')).toHaveCount(0);
 state=await snapshot(f);expect(state.debt_payables[0].paid_amount).toBe(500);expect(state.supplier_invoices[0].status).toBe('Partial');
 await f.go('app/purchase/invoices');f.page.once('dialog',dialog=>dialog.accept());await f.page.getByRole('button',{name:'Tandai lunas',exact:true}).click();
 await expect.poll(async()=> (await snapshot(f)).debt_payables[0].paid_amount).toBe(2000);
 await expect(f.page.getByRole('row').filter({hasText:'INV-UI-PARTIAL'})).toContainText('Paid');
 await expect(f.page.getByRole('alert')).toHaveCount(0);
 await expect(f.page.getByTestId('invoice-amount')).toBeVisible();
});

test('A configured customer earns points once after the real cash sale synchronizes',async({app:f})=>{
 expect((await f.api('POST','/customers/loyalty',{conversion_rate:1000,point_value:100,min_redeem_points:1})).status).toBe(200);
 const customer=await f.api('POST','/customers',{name:'Audit loyalty member',phone:'081200000000',loyalty_points:0});expect(customer.status).toBe(200);
 await f.go('app/pos');await f.page.getByTestId('pos-product-product-0000').click();const cart=f.page.getByTestId('mobile-cart-open');if(await cart.isVisible())await cart.click();
 const selector=f.page.locator('select').filter({has:f.page.locator('option',{hasText:'Audit loyalty member'})});
 await selector.selectOption(customer.data.id);await f.page.getByTestId('cart-cash-received').fill('1000');await f.page.getByTestId('checkout-btn').click();
 await expect.poll(async()=> (await snapshot(f)).customers.find(c=>c.id===customer.data.id)?.loyalty_points).toBe(1);
 await f.page.evaluate(()=>dispatchEvent(new Event('online')));await f.settle();
 expect((await snapshot(f)).customers.find(c=>c.id===customer.data.id).loyalty_points).toBe(1);
});

test('Recorded profit stays fixed after editing product cost and incomplete legacy cost is explicit',async({app:f})=>{
 const made=await f.api('POST','/orders',{items:[{product_id:'product-0000',name:'Audit Product 0000',price:1000,quantity:1,subtotal:1000}],payment_method:'cash',cash_received:1000});expect(made.status).toBe(200);
 expect((await f.api('PUT','/products/product-0000',{cost:800})).status).toBe(200);
 const report=await f.api('GET','/reports/profit');expect(report.data.totals.net_profit).toBe(600);
 await f.go('app/reports/profit');await expect(f.page.getByText('Rp 600',{exact:true}).first()).toBeVisible();
});
