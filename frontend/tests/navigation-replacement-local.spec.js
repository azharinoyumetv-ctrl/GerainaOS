const {test,expect}=require('./customer-audit.fixture.cjs');

test('Login through the form, open deferred menus and use Back/Forward without losing the session',async({app:f})=>{
  await f.page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await f.go('login');
  await f.page.getByTestId('login-email-input').fill('owner-a@example.com');
  await f.page.getByTestId('login-password-input').fill('IncorrectDisposablePassword');
  await f.page.getByTestId('login-submit-btn').click();
  await expect(f.page.getByTestId('login-error')).toContainText('Email atau password salah');
  await f.page.getByTestId('login-password-input').fill('DisposableAudit123');
  await f.page.getByTestId('login-password-toggle').click();
  await expect(f.page.getByTestId('login-password-input')).toHaveAttribute('type','text');
  await f.page.getByTestId('login-submit-btn').click();
  await expect(f.page.getByTestId('mobile-dashboard')).toBeVisible();
  await f.page.evaluate(()=>{window.__navigationJourney='retained';});
  const token=await f.page.evaluate(()=>localStorage.getItem('geraina_token'));
  expect(token).toBeTruthy();
  for(const [section,route,testid] of [
    ['products','products/categories','categories-page'],
    ['reports','reports/sales',null],
    ['settings','settings/general',null],
    [null,'about','about-page'],
    [null,'pos','pos-page'],
  ]){
    await f.page.evaluate(()=>window.GerainaMobile.openMenu());
    if(section){const parent=f.page.getByTestId('menu-parent-'+section);if(await parent.getAttribute('aria-expanded')!=='true')await parent.click();}
    await f.page.locator(`aside a[href="/geraina/app/${route}"]`).click();
    await expect(f.page).toHaveURL(new RegExp('/geraina/app/'+route+'$'));
    await expect(f.page.getByTestId('route-loading')).toHaveCount(0);
    if(testid)await expect(f.page.getByTestId(testid)).toBeVisible();
    await expect.poll(()=>f.page.locator('.route-stage').innerText()).toMatch(/\S.{10}/);
    expect(await f.page.evaluate(()=>window.__navigationJourney)).toBe('retained');
  }
  await f.page.goBack();await expect(f.page.getByTestId('about-page')).toBeVisible();
  await f.page.goForward();await expect(f.page.getByTestId('pos-page')).toBeVisible();
  expect(await f.page.evaluate(()=>localStorage.getItem('geraina_token'))).toBe(token);
  expect(f.errors).toEqual([]);
  expect(f.reads.filter(row=>row.status>=400 && !(row.method==='POST'&&row.path==='/api/auth/login'&&row.status===401))).toEqual([]);
});
