const {test, expect} = require('./customer-audit.fixture.cjs');
const configs = {
 xendit: {is_active:true,secret_key:'isolated-x-key',webhook_token:'isolated-x-token'},
 midtrans: {is_active:true,server_key:'isolated-m-key',environment:'sandbox'},
 doku: {is_active:true,client_id:'isolated-d-client',shared_key:'isolated-d-key',environment:'sandbox'},
};
const openCart = async page => { if(page.viewportSize().width < 960 && await page.locator('html').getAttribute('data-ga-cart') !== 'open') await page.getByTestId('mobile-cart-open').click(); };
const methodIds = {ewallet:'pm-ewallet',va:'pm-va','credit-card':'pm-credit-card'};

for (const provider of Object.keys(configs)) test('Saved method choices drive Kasir and preserve the chosen '+provider+' gateway',async({app:f},info)=>{
 expect((await f.api('POST','/integrations',{[provider]:configs[provider]})).status).toBe(200);
 for(const [method,button] of Object.entries(methodIds)) {
  await f.go('app/payments/'+method);
  await expect(f.page.getByTestId('payment-provider')).toBeVisible();
  await f.page.getByTestId('payment-provider').selectOption(provider);
  await f.page.getByTestId('payment-active').check();
  await f.page.getByTestId('payment-config-save-btn').click();
  await expect(f.page.getByTestId('payment-readiness')).toContainText('Ditampilkan di Kasir.');
  await f.go('app/pos');await openCart(f.page);await expect(f.page.getByTestId(button)).toBeEnabled();
  await expect(f.page.getByTestId('pm-doku')).toHaveCount(0);
  await f.page.getByTestId(button).click();await expect(f.page.getByTestId(button)).toHaveAttribute('aria-pressed','true');
  // Actual settings/options API; only outbound checkout is replaced with a disposable receipt.
  let checkout;
  await f.page.route('https://dagangos.com/api/orders', async route=>{
   checkout=route.request().postDataJSON();
   await route.fulfill({json:{...checkout,id:'ui-order',order_no:'UI-ORDER',payment_status:'pending',total:1000,subtotal:1000,
    ...(provider==='xendit' && method==='ewallet'?{xendit_checkout_url:'https://example.invalid/checkout'}:{gateway_checkout_url:'https://example.invalid/checkout',payment_provider:provider})}});
  });
  if(await f.page.locator('.ga-cart-close').isVisible()) await f.page.locator('.ga-cart-close').click();
  await f.page.getByTestId('pos-product-product-0000').click();await openCart(f.page);
  await f.page.getByTestId('checkout-btn').click();await expect(f.page.getByTestId('receipt-dialog')).toBeVisible();
  expect(checkout.payment_method).toBe(method.replace('-','_'));
  await expect(f.page.getByTestId(provider==='xendit'&&method==='ewallet'?'ewallet-open-link':'gateway-open-link')).toHaveAttribute('href','https://example.invalid/checkout');
  await f.page.unroute('https://dagangos.com/api/orders');
  await f.go('app/payments/'+method);await f.page.getByTestId('payment-active').uncheck();
  await f.page.getByTestId('payment-config-save-btn').click();await expect(f.page.getByTestId('payment-readiness')).toContainText('Tidak ditampilkan');
  await f.go('app/pos');await expect(f.page.getByTestId(button)).toHaveCount(0);
 }
 expect(f.errors).toEqual([]);
});

test('QRIS integration retains its own tabs while Payments only controls cashier visibility',async({app:f},info)=>{
 await f.go('app/integrations/xendit');await f.page.getByTestId('integrations-tabs').getByRole('link',{name:'QRIS bank'}).click();
 await expect(f.page).toHaveURL(/\/integrations\/qris$/);
 await expect(f.page.getByTestId('bank-qris-form')).toBeVisible();
 await expect(f.page.getByTestId('integrations-tabs').getByRole('link',{name:'QRIS bank'})).toHaveAttribute('aria-current','page');
 await expect(f.page.getByTestId('payments-tabs')).toHaveCount(0);
 await f.page.screenshot({path:info.outputPath('qris-integration.png')});
 await f.page.getByRole('link',{name:'Atur tampilan QRIS di Kasir'}).click();
 await expect(f.page.getByTestId('payment-active')).toBeVisible();await expect(f.page.getByTestId('bank-qris-upload')).toHaveCount(0);
 await f.page.getByTestId('payment-active').check();await f.page.getByTestId('payment-config-save-btn').click();
 await expect(f.page.getByTestId('payment-readiness')).toContainText('belum dapat dipakai');
 await f.go('app/pos');await openCart(f.page);await expect(f.page.getByTestId('pm-qris')).toBeDisabled();
 await expect(f.page.getByTestId('payment-unready-qris_bank')).toContainText('QRIS bank toko');
});

test('Missing gateway setup gives a visible reason instead of an unexplained unclickable method',async({app:f})=>{
 await f.go('app/payments/va');await f.page.getByTestId('payment-provider').selectOption('midtrans');
 await f.page.getByTestId('payment-active').check();await f.page.getByTestId('payment-config-save-btn').click();
 await expect(f.page.getByTestId('payment-readiness')).toContainText('Lengkapi integrasi Midtrans');
 await f.go('app/pos');await openCart(f.page);await expect(f.page.getByTestId('pm-va')).toBeDisabled();
 await expect(f.page.getByTestId('payment-unready-va')).toContainText('Lengkapi integrasi Midtrans');
 await f.page.getByTestId('pos-payment-settings').click();await expect(f.page.getByTestId('payment-config-page')).toBeVisible();
});

test('Unchecking every method leaves no hidden fallback and no enabled checkout',async({app:f})=>{
 await f.go('app/payments/cash');await f.page.getByTestId('payment-active').uncheck();await f.page.getByTestId('payment-config-save-btn').click();
 await expect(f.page.getByTestId('payment-readiness')).toContainText('Tidak ditampilkan');
 await f.go('app/pos');await openCart(f.page);await expect(f.page.getByTestId('pos-no-payments')).toBeVisible();
 await expect(f.page.getByTestId('pm-cash')).toHaveCount(0);await expect(f.page.getByTestId('checkout-btn')).toBeDisabled();
});

test('An existing configured gateway checkout remains usable when only cash preferences change',async({app:f})=>{
 expect((await f.api('POST','/integrations',{doku:configs.doku})).status).toBe(200);
 expect((await f.api('POST','/payments/config',{cash:{is_active:false}})).status).toBe(200);
 await f.go('app/pos');await openCart(f.page);
 await expect(f.page.getByTestId('pm-gateway')).toBeEnabled();await expect(f.page.getByTestId('pm-cash')).toHaveCount(0);
 await f.page.getByTestId('pm-gateway').click();await expect(f.page.getByTestId('pm-gateway')).toHaveAttribute('aria-pressed','true');
});

test('Method screens retain provider choices through reload and show no generic DOKU fallback',async({app:f},info)=>{
 for(const type of ['ewallet','va','credit-card']) {
  await f.go('app/payments/'+type);await f.page.getByTestId('payment-provider').selectOption('midtrans');
  await f.page.getByTestId('payment-config-save-btn').click();await expect(f.page.getByTestId('payment-config-save-btn')).toBeEnabled();
  await f.page.reload();await expect(f.page.getByTestId('payment-provider')).toHaveValue('midtrans');await expect(f.page.getByTestId('payment-config-save-btn')).toBeEnabled();
  await expect(f.page.getByTestId('payment-provider-integration')).toHaveAttribute('href','/geraina/app/integrations/midtrans');
  await expect(f.page.getByTestId('payment-method-unavailable')).toHaveCount(0);
 }
 await f.page.screenshot({path:info.outputPath('payment-provider-settings.png')});
 const geometry=await f.page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+2);
});
