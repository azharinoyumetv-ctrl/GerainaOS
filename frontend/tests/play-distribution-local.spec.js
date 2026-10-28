const {test,expect,host}=require('./customer-audit.fixture.cjs');
test.use({subscriptionPurchases:false});

test('Play consumes the active package without offering blocked tier or add-on checkouts',async({app:f})=>{
  const result=await f.request.post(host+'/__audit/scenario/subscription-manual-business');
  expect(result.ok()).toBeTruthy();
  await f.go('app/settings/billing');
  await expect(f.page.getByTestId('subscription-plan-title')).toHaveText('Paket Business');
  await expect(f.page.getByTestId('subscription-status-badge')).toHaveText('AKTIF');
  await expect(f.page.getByTestId('play-subscription-notice')).toBeVisible();
  await expect(f.page.getByTestId('view-pricing-matrix-link')).toHaveCount(0);
  await expect(f.page.locator('[data-testid^="addon-buy-"], [data-testid^="addon-pending-"], [data-testid="addon-renew"]')).toHaveCount(0);
  expect(await f.page.evaluate(()=>sessionStorage.getItem('dagangos_checkout_geraina'))).toBeNull();
  await f.page.evaluate(()=>window.GerainaRouter.navigate(location.origin+'/geraina/app/pos'));
  await expect(f.page.getByTestId('pos-page')).toBeVisible();
  expect(f.errors).toEqual([]);
});

test('Play About directs updates to Google Play and keeps the authenticated support form',async({app:f})=>{
  await f.go('app/about');
  await expect(f.page.getByTestId('about-check-updates')).toHaveText('Buka Google Play');
  await f.page.getByTestId('about-support').click();
  await expect(f.page.getByTestId('support-account-email')).toHaveText('owner-a@example.com');
  await expect(f.page.getByTestId('support-dialog')).toBeVisible();
  expect(f.reads.filter(row=>row.method==='POST'&&row.path==='/api/support/requests')).toHaveLength(0);
  expect(f.errors).toEqual([]);
});
