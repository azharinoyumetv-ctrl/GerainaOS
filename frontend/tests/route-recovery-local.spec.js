const {test,expect}=require('./customer-audit.fixture.cjs');

test('A failed menu download keeps the session and navigation usable and retries in place',async({app:f})=>{
  await f.go('app/dashboard');
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  await f.page.evaluate(()=>{window.__recoveryDocument='same-document';});
  let blocked=0;
  const failChunk=route=>{blocked++;return route.abort('failed');};
  await f.context.route('**/geraina/static/js/*.chunk.js',failChunk);
  await f.page.evaluate(()=>window.GerainaRouter.navigate(location.origin+'/geraina/app/products/categories'));
  await expect(f.page.getByTestId('route-error')).toBeVisible();
  expect(blocked).toBeGreaterThan(0);
  await expect(f.page.getByTestId('app-layout')).toBeVisible();
  // Repeated failures stay recoverable; no automatic retry/reload loop.
  const attempts=blocked;
  await f.page.waitForTimeout(300);
  expect(blocked).toBe(attempts);
  await f.page.getByRole('button',{name:'Coba lagi',exact:true}).click();
  await expect.poll(()=>blocked).toBeGreaterThan(attempts);
  await expect(f.page.getByTestId('route-error')).toBeVisible();
  await f.context.unroute('**/geraina/static/js/*.chunk.js',failChunk);
  await f.page.getByRole('button',{name:'Coba lagi',exact:true}).click();
  await expect(f.page.getByTestId('route-error')).toHaveCount(0);
  await expect(f.page.getByTestId('route-loading')).toHaveCount(0);
  await expect(f.page.locator('.route-stage')).toContainText('Kategori Produk');
  expect(await f.page.evaluate(()=>window.__recoveryDocument)).toBe('same-document');
  expect(await f.page.evaluate(()=>localStorage.getItem('geraina_token'))).toBe(f.session.access_token);
  await f.page.evaluate(()=>window.GerainaRouter.navigate(location.origin+'/geraina/app/dashboard'));
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
});

test('A failed secondary page can be left using the app navigation',async({app:f})=>{
  await f.go('app/dashboard');
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  await f.context.route('**/geraina/static/js/*.chunk.js',route=>route.abort('failed'));
  await f.page.evaluate(()=>window.GerainaRouter.navigate(location.origin+'/geraina/app/products/categories'));
  await expect(f.page.getByTestId('route-error')).toBeVisible();
  await f.page.getByRole('link',{name:'Kembali ke beranda',exact:true}).click();
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  await expect(f.page.getByTestId('app-layout')).toBeVisible();
});
