const {test,expect,host}=require('./customer-audit.fixture.cjs');
const active=async f=>{const r=await f.request.post(host+'/__audit/scenario/subscription-active');expect(r.ok()).toBeTruthy();};

test('Unrecognized plan never claims active paid access or a paid expiry',async({app:f})=>{
 await f.request.post(host+'/__audit/scenario/subscription-malformed');
 await f.go('app/settings/billing');
 await expect(f.page.getByTestId('subscription-status-badge')).toHaveText('PERLU DIPERIKSA');
 await expect(f.page.getByTestId('subscription-plan-title')).toHaveText('Paket Belum diketahui');
 await expect(f.page.getByTestId('subscription-expiry')).toHaveCount(0);
 await expect(f.page.getByTestId('subscription-data-warning')).toBeVisible();
 await expect(f.page.getByTestId('tier-name')).toHaveText('Belum diketahui');
 await expect(f.page.getByTestId('addon-buy-extra_outlet')).toBeDisabled();
 await f.go('app/about');
 await expect(f.page.getByTestId('about-license-status')).toHaveText('Belum diketahui');
 expect(f.errors).toEqual([]);
});

test('A legacy paid plan never borrows the trial date as its paid expiry',async({app:f})=>{
 await f.request.post(host+'/__audit/scenario/subscription-legacy-business');
 await f.go('app/settings/billing');
 await expect(f.page.getByTestId('subscription-status-badge')).toHaveText('AKTIF');
 await expect(f.page.getByTestId('subscription-expiry')).toHaveCount(0);
});

test('Manual Business grant agrees across billing, navigation, About and outlet eligibility',async({app:f},info)=>{
 await f.request.post(host+'/__audit/scenario/subscription-manual-business');
 await f.go('app/settings/billing');
 await expect(f.page.getByTestId('subscription-plan-title')).toHaveText('Paket Business');
 await expect(f.page.getByTestId('subscription-status-badge')).toHaveText('AKTIF');
 await expect(f.page.getByTestId('subscription-expiry')).toContainText('2099');
 await expect(f.page.getByTestId('tier-name')).toHaveText('Business');
 await expect(f.page.getByTestId('addon-buy-extra_outlet')).toBeEnabled();
 await expect(f.page.getByTestId('addon-buy-extra_device')).toBeDisabled();
 await expect(f.page.getByTestId('subscription-stop-button')).toHaveCount(0);
 await f.page.screenshot({path:info.outputPath('manual-business-grant.png')});
 await f.go('app/about');
 await expect(f.page.getByTestId('about-license-status')).toHaveText('Business');
 await f.go('app/reports/sales');
 await expect(f.page.getByTestId('access-denied-page')).toHaveCount(0);
 expect(f.errors).toEqual([]);
});

test('Owner can stop a paid term, retain cashier access, reload and undo the stop',async({app:f},info)=>{
 await active(f);await f.go('app/settings/billing');
 await expect(f.page.getByTestId('subscription-plan-title')).toHaveText('Paket Pro');
 await expect(f.page.getByTestId('view-pricing-matrix-link')).toBeVisible();
 const before=await f.page.getByTestId('subscription-expiry').innerText();
 await f.page.getByTestId('subscription-stop-button').click();
 await expect(f.page.getByRole('alertdialog')).toBeVisible();
 await f.page.getByRole('button',{name:'Kembali',exact:true}).click();
 expect(f.reads.filter(r=>r.path.endsWith('/cancel'))).toHaveLength(0);
 await f.page.getByTestId('subscription-stop-button').click();
 await f.page.getByTestId('subscription-stop-confirm').click();
 await expect(f.page.getByTestId('subscription-stopped')).toBeVisible();
 await expect(f.page.getByTestId('subscription-expiry')).toHaveText(before);
 await f.go('app/pos');await expect(f.page.getByTestId('pos-page')).toBeVisible();
 await f.go('app/settings/billing');await expect(f.page.getByTestId('subscription-stopped')).toBeVisible();
 await f.page.screenshot({path:info.outputPath('stopped-term.png')});
 await f.page.getByTestId('subscription-stop-button').click();
 await expect(f.page.getByTestId('subscription-stopped')).toHaveCount(0);
 expect((await f.api('GET','/subscriptions/current')).data.auto_renew).toBe(false);
 expect(f.errors).toEqual([]);
});

test('Expired Owner can reach billing and buy a package while POS stays locked',async({app:f})=>{
 await f.request.post(host+'/__audit/scenario/subscription-expired');
 await f.go('app/settings/billing');await expect(f.page.getByTestId('subscription-status-badge')).toHaveText('BERAKHIR');
 await expect(f.page.getByTestId('view-pricing-matrix-link')).toBeVisible();
 await expect(f.page.getByTestId('subscription-stop-button')).toHaveCount(0);
 await f.go('app/pos');await expect(f.page.getByTestId('trial-expired-page')).toBeVisible();
 await f.page.getByRole('link',{name:'Kelola Paket',exact:true}).click();
 await expect(f.page.getByTestId('subscription-plan-title')).toBeVisible();
 expect(f.errors).toEqual([]);
});

test('Failed stop request leaves access and expiry unchanged and shows the failure',async({app:f})=>{
 await active(f);await f.go('app/settings/billing');
 const before=await f.page.getByTestId('subscription-expiry').innerText();
 await f.page.route('**/api/subscriptions/cancel',r=>r.fulfill({status:503,json:{detail:'Audit: layanan sementara tidak tersedia'}}));
 await f.page.getByTestId('subscription-stop-button').click();await f.page.getByTestId('subscription-stop-confirm').click();
 await expect(f.page.getByRole('alertdialog').getByRole('alert')).toContainText('Audit: layanan');
 await expect(f.page.getByTestId('subscription-expiry')).toHaveText(before);
 expect((await f.api('GET','/subscriptions/current')).data.subscription.cancel_at_period_end).toBe(false);
});

test('Billing load failure offers retry without any purchase or stop controls',async({app:f})=>{
 await active(f);let fail=true;
 await f.page.route('**/api/subscriptions/current',async r=>{if(fail)return r.fulfill({status:503,json:{detail:'offline'}});return r.fallback();});
 await f.go('app/settings/billing');await expect(f.page.getByRole('alert')).toContainText('Informasi paket belum dapat dimuat');
 await expect(f.page.getByTestId('subscription-stop-button')).toHaveCount(0);
 await expect(f.page.getByTestId('view-pricing-matrix-link')).toHaveCount(0);
 fail=false;await f.page.getByRole('button',{name:'Coba lagi',exact:true}).click();
 await expect(f.page.getByTestId('subscription-plan-title')).toHaveText('Paket Pro');
});

test.describe('Staff permissions',()=>{
 test.use({auditRole:'cashier'});
 test('Cashier cannot manage or cancel the store subscription',async({app:f})=>{
  await active(f);await f.go('app/settings/billing');await expect(f.page.getByTestId('access-denied-page')).toBeVisible();
  expect((await f.api('POST','/subscriptions/cancel',{orderId:'DG-geraina-'+'a'.repeat(32),confirm:true})).status).toBe(403);
  await expect(f.page.getByTestId('subscription-stop-button')).toHaveCount(0);
 });
});
