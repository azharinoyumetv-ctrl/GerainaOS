const {test,expect,host}=require('./customer-audit.fixture.cjs');
const origin='https://dagangos.com';
const snapshot=async f=>(await f.request.get(host+'/__audit/snapshot')).json();

test('A new merchant registers into a real empty trial store without sample transactions',async({app:f})=>{
  await f.page.evaluate(()=>localStorage.clear());await f.go('register');
  await f.page.getByTestId('register-store-input').fill('Brand New Audit Store');
  await f.page.getByTestId('register-email-input').fill('brand-new-merchant@example.com');
  await f.page.getByTestId('register-password-input').fill('NewMerchantAudit123');
  await f.page.getByTestId('register-submit-btn').click();await expect(f.page.getByTestId('app-layout')).toBeVisible();
  const user=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('geraina_user')));
  expect(user.store_name).toBe('Brand New Audit Store');expect(user.plan).toBe('trial');
  const state=await snapshot(f);expect(state.products.filter(p=>p.store_id===user.store_id)).toHaveLength(0);
  expect(state.orders.filter(o=>o.store_id===user.store_id)).toHaveLength(0);
});

test('An expired merchant retains the documented pricing recovery page while POS stays locked',async({app:f})=>{
  await f.request.post(host+'/__audit/scenario/expired');await f.go('app/pos');
  await expect(f.page.getByTestId('trial-expired-page')).toBeVisible();
  // RoleGuard intentionally sends expired accounts to the public Pricing page.
  // Requiring the guarded in-app billing tab here would be a false positive.
  await f.go('pricing');await expect(f.page.getByTestId('pricing-page')).toBeVisible();
  expect((await f.api('POST','/orders',{items:[],payment_method:'cash'})).status).toBe(402);
});

test('Changing accounts cannot replay another merchants queued cash sale',async({app:f})=>{
  await f.go('app/pos');await expect(f.page.getByTestId('pos-catalogue-coverage')).toContainText('Katalog lengkap: 3');
  const blocker=route=>route.abort();await f.context.route(origin+'/api/**',blocker);
  await f.page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});
  await f.page.getByTestId('pos-product-product-0000').click();
  const open=f.page.getByTestId('mobile-cart-open');if(await open.isVisible())await open.click();
  await f.page.getByTestId('cart-cash-received').fill('1000');await f.page.getByTestId('checkout-btn').click();
  await expect(f.page.getByTestId('receipt-pending-sync')).toBeVisible();
  const other=await (await f.request.post(host+'/api/auth/login',{data:{email:'owner-b@example.com',password:'DisposableAudit123'}})).json();
  await f.context.unroute(origin+'/api/**',blocker);
  await f.page.evaluate(s=>{localStorage.clear();localStorage.setItem('geraina_token',s.access_token);localStorage.setItem('geraina_user',JSON.stringify(s.user));},other);
  await f.page.reload();await expect(f.page.getByTestId('pos-product-foreign-product')).toBeVisible();await f.settle();
  expect((await snapshot(f)).orders).toHaveLength(0);
  await f.page.evaluate(s=>{localStorage.clear();localStorage.setItem('geraina_token',s.access_token);localStorage.setItem('geraina_user',JSON.stringify(s.user));},f.session);
  await f.page.reload();await expect.poll(async()=> (await snapshot(f)).orders.length).toBe(1);
  const state=await snapshot(f);expect(state.orders[0].store_id).toBe('store-a');expect(state.orders[0].cashier_id).toBe('owner-a');
});
