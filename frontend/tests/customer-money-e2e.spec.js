const {test,expect,host}=require('./customer-audit.fixture.cjs');
const origin='https://dagangos.com';
const snapshot=async f=>(await f.request.get(host+'/__audit/snapshot')).json();
async function startCart(f,quantity=1){
  await f.go('app/pos');await f.page.getByTestId('pos-product-product-0000').click();
  const open=f.page.getByTestId('mobile-cart-open');if(await open.isVisible())await open.click();
  for(let i=1;i<quantity;i++)await f.page.getByTestId('cart-inc-0').click();
}
function syntheticQris(){
  const field=(tag,value)=>tag+String(value.length).padStart(2,'0')+value;
  const values={'00':'01','01':'11','26':field('00','ID.CO.QRIS.WWW')+field('01','TEST-ONLY-NOT-PAYABLE'),'52':'5999','53':'360','58':'ID','59':'GERAINA TEST ONLY','60':'JAKARTA'};
  let raw=['00','01','26','52','53','58','59','60'].map(k=>field(k,values[k])).join('')+'6304',crc=0xffff;
  for(const byte of Buffer.from(raw)){crc^=byte<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;crc&=0xffff;}
  return raw+crc.toString(16).toUpperCase().padStart(4,'0');
}

test('Cash checkout persists, synchronizes once, appears in history and produces a real PDF',async({app:f})=>{
  await startCart(f,2);await f.page.getByTestId('cart-cash-received').fill('2500');
  await f.page.getByTestId('checkout-btn').click();await expect(f.page.getByTestId('receipt-status')).toHaveText('Lunas');
  await expect.poll(async()=> (await snapshot(f)).orders.length).toBe(1);
  const state=await snapshot(f),sale=state.orders[0];
  expect(sale.total).toBe(2000);expect(sale.change).toBe(500);
  expect(state.products.find(p=>p.id==='product-0000').stock).toBe(8);
  const pdf=await f.request.get(host+'/api/pdf/receipt/'+sale.id,{headers:{authorization:'Bearer '+f.session.access_token}});
  expect(pdf.status()).toBe(200);expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
  await f.page.getByTestId('receipt-done-btn').click();await f.go('app/sales');
  await expect(f.page.getByTestId('sales-row-'+sale.id)).toContainText(sale.order_no);
});

test('Offline cash survives reload then reconnects without duplicate stock or revenue',async({app:f})=>{
  await f.go('app/pos');await expect(f.page.getByTestId('pos-catalogue-coverage')).toContainText('Katalog lengkap: 3');
  const blocker=route=>route.abort();await f.context.route(origin+'/api/**',blocker);
  await f.page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});
  await f.page.getByTestId('pos-product-product-0000').click();
  const open=f.page.getByTestId('mobile-cart-open');if(await open.isVisible())await open.click();
  await f.page.getByTestId('cart-cash-received').fill('1000');await f.page.getByTestId('checkout-btn').click();
  await expect(f.page.getByTestId('receipt-pending-sync')).toBeVisible();
  expect((await snapshot(f)).orders).toHaveLength(0);
  await f.page.reload();await expect(f.page.getByTestId('pos-product-product-0000')).toBeVisible();
  await f.context.unroute(origin+'/api/**',blocker);
  await f.page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});
  await expect.poll(async()=> (await snapshot(f)).orders.length).toBe(1);
  const state=await snapshot(f);expect(state.products.find(p=>p.id==='product-0000').stock).toBe(9);
  await f.page.evaluate(()=>dispatchEvent(new Event('online')));await f.settle();
  expect((await snapshot(f)).orders).toHaveLength(1);
});

test('Lost synchronization response retries the original sale without double charging inventory',async({app:f})=>{
  let first=true;
  await f.context.route(origin+'/api/offline/orders',async route=>{
    if(!first)return route.fallback();first=false;
    const request=route.request();
    const committed=await f.request.post(host+'/api/offline/orders',{headers:{authorization:'Bearer '+f.session.access_token},data:request.postDataJSON()});
    expect(committed.status()).toBe(200);
    return route.fulfill({status:503,json:{detail:'Audit lost response after successful commit'}});
  });
  await startCart(f);await f.page.getByTestId('cart-cash-received').fill('1000');await f.page.getByTestId('checkout-btn').click();
  await expect.poll(async()=> (await snapshot(f)).orders.length).toBe(1);
  await f.settle();await f.page.evaluate(()=>dispatchEvent(new Event('online')));
  await expect.poll(async()=>f.page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('geraina-pos-offline-v1');open.onsuccess=()=>{const read=open.result.transaction('sales').objectStore('sales').getAll();read.onsuccess=()=>resolve(read.result[0]?.status);};}))).toBe('synced');
  const state=await snapshot(f);expect(state.orders).toHaveLength(1);expect(state.products.find(p=>p.id==='product-0000').stock).toBe(9);
});

test('Bank QRIS stays pending until staff confirms the exact amount and records its audit trail',async({app:f})=>{
  const configured=await f.api('POST','/payments/bank-qris',{bank_name:'AUDIT BANK',qr_payload:syntheticQris(),is_active:true,merchant_confirmed:true});
  expect(configured.status).toBe(200);
  await startCart(f);await f.page.getByTestId('pm-qris').click();await f.page.getByTestId('checkout-btn').click();
  await expect(f.page.getByTestId('bank-qris-code')).toBeVisible();
  expect((await snapshot(f)).orders[0].payment_status).toBe('pending');
  await f.page.getByTestId('bank-qris-checked').check();await f.page.getByTestId('bank-qris-received').fill('999');
  await expect(f.page.getByTestId('bank-qris-confirm')).toBeDisabled();
  await f.page.getByTestId('bank-qris-received').fill('1000');await f.page.getByTestId('bank-qris-confirm').click();
  await expect(f.page.getByTestId('receipt-status')).toHaveText('Lunas');
  const state=await snapshot(f);expect(state.orders[0].payment_confirmation.type).toBe('manual_bank');
  expect(state.orders[0].payment_confirmation.bank_verified).toBe(false);
  expect(state.products.find(p=>p.id==='product-0000').stock).toBe(9);
});

test.describe('Employee attendance journey',()=>{
  test.use({auditRole:'cashier'});
  test('Cashier signs in and out under their own server identity',async({app:f})=>{
    await f.go('app/attendance');await f.page.getByTestId('attendance-check-in').click();
    await expect(f.page.getByTestId('attendance-check-out')).toBeVisible();
    await f.page.getByTestId('attendance-check-out').click();await expect(f.page.getByTestId('attendance-check-in')).toBeVisible();
    const state=await snapshot(f);expect(state.attendance).toHaveLength(1);
    expect(state.attendance[0].user_id).toBe('cashier');expect(state.attendance[0].is_open).toBe(false);
  });
});
