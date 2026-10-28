// Disposable API bench only; excluded from the production-facing suite.
const {test,expect}=require('./customer-audit.fixture.cjs');

test('Secondary screens load within the existing authenticated Android document',async({app:f})=>{
  await f.go('app/dashboard');
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  await f.page.evaluate(()=>{window.__startupDocument='retained-document';});
  for(const route of ['products/categories','reports/sales','settings/general','about','pos','dashboard']){
    await f.page.evaluate(route=>{
      if(!window.GerainaRouter?.navigate(location.origin+'/geraina/app/'+route))throw new Error('Android navigation bridge unavailable');
    },route);
    await expect(f.page).toHaveURL(new RegExp('/geraina/app/'+route+'$'));
    await expect(f.page.getByTestId('route-loading')).toHaveCount(0);
    await expect.poll(async()=>f.page.locator('.route-stage').innerText()).toMatch(/\S.{10}/);
    await f.settle();
    expect(await f.page.evaluate(()=>window.__startupDocument)).toBe('retained-document');
    expect(await f.page.locator('.route-stage').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');
    await expect(f.page.getByTestId('app-layout')).toBeVisible();
  }
  await f.page.goBack();
  await expect(f.page).toHaveURL(/\/geraina\/app\/pos$/);
  await expect(f.page.getByTestId('pos-page')).toBeVisible();
  await f.page.goForward();
  await expect(f.page).toHaveURL(/\/geraina\/app\/dashboard$/);
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  expect(await f.page.evaluate(()=>window.__startupDocument)).toBe('retained-document');
  expect(f.errors).toEqual([]);
  expect(f.reads.filter(row=>row.status>=400)).toEqual([]);
});
