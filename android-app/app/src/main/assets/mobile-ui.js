(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://dagangos.com' || window.GerainaMobile) return;
  const css = __GERAINA_MOBILE_STYLE__;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const money = value => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
  const token = () => localStorage.getItem('geraina_token') || localStorage.getItem('dagangos_token');
  const user = () => { try { return JSON.parse(localStorage.getItem('geraina_user') || localStorage.getItem('dagangos_user') || '{}'); } catch { return {}; } };
  const text = (element, value) => { if (element && element.textContent !== String(value)) element.textContent = String(value); };
  const paths = {
    cart:'<path d="M3 3h2l2.5 12h11l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    box:'<path d="m12 3 9 5-9 5-9-5zM3 8v10l9 5 9-5V8M12 13v10M7.5 5.5l9 5"/>',
    stock:'<path d="m3 10 9-6 9 6v11H3zM8 21v-9h8v9M8 16h8"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6m-6 4h6m-6 4h3"/>',
    alert:'<path d="m12 3 10 18H2zM12 9v4m0 4h.01"/>',
    trend:'<path d="m4 16 6-6 4 4 6-9m-6 0h6v6"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.box}</svg>`;
  let scheduled = false, shellSignature = '', dashboardController, dashboardIdentity = '';
  function openMenu() { $('[data-testid="mobile-menu-open-btn"]')?.click(); }
  function openSupport() {
    if(!$('.dagangos-support'))window.__gerainaInstallSupport?.();
    const launcher=$('.dagangos-support__launcher'),panel=$('.dagangos-support__panel');
    if(!launcher||!panel)return false;
    if(panel.hidden)launcher.click();
    return true;
  }
  function closeCart() { document.documentElement.removeAttribute('data-ga-cart'); }
  function back() {
    if ($('[data-testid="account-switch-dialog"]')) { $('[data-testid="account-switch-cancel"]')?.click(); return true; }
    const support=$('.dagangos-support__panel:not([hidden])');
    if(support){$('.dagangos-support__close')?.click();return true;}
    if ($('[data-testid="receipt-dialog"]')) { $('[data-testid="receipt-done-btn"]')?.click(); return true; }
    if ($('[data-testid="product-form"]')) { $('[data-testid="product-form-close"]')?.click(); return true; }
    if ($('[data-testid="import-dialog"]')) { $('[data-testid="import-close"]')?.click(); return true; }
    if ($('[data-testid="odoo-ecosystem-menu"]')) { $('[data-testid="odoo-ecosystem-switcher-btn"]')?.click(); return true; }
    if (document.documentElement.hasAttribute('data-ga-cart')) { closeCart(); return true; }
    if (document.documentElement.classList.contains('ga-barcode-open')) { document.documentElement.classList.remove('ga-barcode-open'); return true; }
    const backdrop = $('[data-testid="mobile-sidebar-backdrop"]');
    if (backdrop) { backdrop.click(); return true; }
    return false;
  }
  function navigate(route) {
    const parsed = new URL(route, location.origin);
    if (parsed.origin !== location.origin || !parsed.pathname.startsWith('/geraina/app/')) return;
    window.GerainaNative.postMessage(JSON.stringify({type:'open',url:parsed.href}));
  }
  async function read(path, signal, authToken) {
    const response = await fetch(`/api${path}`, {signal, credentials:'include', headers:{Authorization:`Bearer ${authToken}`,'X-DagangOS-Module':'geraina'}});
    if (!response.ok) throw new Error('Store data unavailable');
    return response.json();
  }
  function chartData(orders, now = new Date()) {
    const start = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()) - 6*86400000);
    if (!Array.isArray(orders) || (orders.length >= 1000 && new Date(orders.at(-1)?.created_at) >= start)) return null;
    const days = Array.from({length:7},(_,index) => ({date:new Date(start.getTime()+index*86400000),value:0}));
    for (const order of orders) {
      if (order.payment_status !== 'paid') continue;
      const index = Math.floor((new Date(order.created_at).getTime()-start.getTime())/86400000);
      if (index >= 0 && index < 7) days[index].value += Number(order.total) || 0;
    }
    return days;
  }
  const dashboardAllows = route => !route.startsWith("inventory/") && !route.startsWith("reports/") || $('[data-testid="dashboard-page"]')?.dataset[route.startsWith("inventory/") ? "dashboardStock" : "dashboardReports"] === "true";
  function chartMarkup(orders, stats) {
    const days = Array.isArray(stats?.daily_sales) && stats.daily_sales.length === 7 ? stats.daily_sales.map(row => ({date:new Date(row.date+'T12:00:00Z'),value:row.value})) : null;
    if (!days) return `<div class="ga-empty">Rincian harian belum tersedia.<br><a href="/geraina/app/sales">Buka riwayat penjualan →</a></div>`;
    const maximum = Math.max(1,...days.map(day=>day.value));
    const total = days.reduce((sum,day)=>sum+day.value,0);
    return `<p class="ga-chart-total" data-testid="mobile-week-total">${money(total)}</p><div class="ga-bars" role="img" aria-label="Penjualan per hari dalam zona waktu UTC">${days.map(day=>`<span class="ga-bar" style="height:${Math.max(3,day.value/maximum*100)}%" aria-label="${esc(day.date.toLocaleDateString('id-ID',{timeZone:'UTC'}))}: ${money(day.value)}" title="${money(day.value)}"></span>`).join('')}</div><div class="ga-days">${days.map(day=>`<span>${esc(day.date.toLocaleDateString('id-ID',{weekday:'short',timeZone:'UTC'}))}</span>`).join('')}</div><p class="ga-chart-note">${total===0?'Belum ada penjualan pada periode ini.':'Transaksi lunas'} · UTC</p>`;
  }
  function recentMarkup(orders) {
    if (!Array.isArray(orders)) return `<div class="ga-empty">Transaksi belum dapat dimuat.</div>`;
    if (!orders.length) return `<div class="ga-empty">${icon('receipt')}Belum ada transaksi.<br>Mulai penjualan pertama dari kasir.<br><a href="/geraina/app/pos">Buka kasir →</a></div>`;
    const methods = {cash:'Tunai',qris:'QRIS',qris_bank:'QRIS bank',ewallet:'E-Wallet',edc:'Kartu',doku:'DOKU'};
    return orders.slice(0,3).map(order=>`<div class="ga-order"><span class="ga-order-icon">${icon('receipt')}</span><div class="ga-order-copy"><b>${esc(order.order_no || 'Penjualan')}</b><p>${esc(methods[order.payment_method] || order.payment_method || 'Pembayaran')} · ${esc(new Date(order.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'}))}</p></div><div class="ga-order-amount">${money(order.total)}<small>${order.payment_status==='paid'?'Lunas':order.payment_status==='failed'?'Gagal':'Belum lunas'}</small></div></div>`).join('');
  }
  function dashboardMarkup(result) {
    const stats=result?.[0]?.status==='fulfilled'?result[0].value:null;
    const products=result?.[1]?.status==='fulfilled'&&Array.isArray(result[1].value)?result[1].value:null;
    const orders=result?.[2]?.status==='fulfilled'&&Array.isArray(result[2].value)?result[2].value:null;
    const loaded = !!result && result.every(item=>item.status!=='pending');
    const failed = !!result && result.some(item=>item.status==='rejected');
    const lowStock = stats && Number.isInteger(stats.low_stock_count) ? stats.low_stock_count : undefined;
    const count=stats?Number(stats.today_orders)||0:null;
    const sales=stats?Number(stats.today_sales)||0:null;
    const average=count?sales/count:0;
    const currentUser=user();
    return `<div class="ga-head"><div><p class="ga-date">${esc(new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:stats?.timezone || 'Asia/Jakarta'}))}</p><h1>Ringkasan toko</h1></div><button class="ga-store" data-ga-action="menu" aria-label="Pilih toko atau buka menu">${esc(currentUser.store_name || 'Toko Anda')}</button></div>
      ${failed?'<div class="ga-data-error" role="alert">Sebagian data belum dapat dimuat. Angka yang tidak tersedia ditandai —.<br><button data-ga-action="reload-dashboard">Coba lagi</button></div>':''}
      <section class="ga-revenue"><span class="ga-revenue-symbol">${icon('trend')}</span><p>PENJUALAN HARI INI</p><strong data-testid="mobile-revenue">${sales===null?'—':money(sales)}</strong><p class="ga-revenue-caption">${stats?'Ringkasan transaksi lunas':loaded?'Data penjualan belum tersedia':'Memuat data toko…'}</p><div class="ga-revenue-footer"><span><b>${count===null?'—':count}</b> transaksi</span><span><b>${sales===null?'—':money(average)}</b> / transaksi</span></div></section>
      <div class="ga-quick">${[{label:'Buka kasir',route:'pos',icon:'cart'},{label:'Produk',route:'products',icon:'box'},{label:'Stok',route:'inventory/overview',icon:'stock'},{label:'Laporan',route:'reports/sales',icon:'chart'}].filter(item=>dashboardAllows(item.route)).map(item=>`<a href="/geraina/app/${item.route}"><span>${icon(item.icon)}</span>${item.label}</a>`).join('')}</div>
      <div class="ga-metrics"><a class="ga-metric" href="/geraina/app/sales">${icon('receipt')}<div><p>Transaksi hari ini</p><b data-testid="mobile-order-count">${count===null?'—':count}</b></div></a><a class="ga-metric" href="/geraina/app/${dashboardAllows('inventory/low-stock')?'inventory/low-stock':'products'}">${icon('alert')}<div><p>Stok menipis</p><b data-testid="mobile-low-stock">${lowStock===undefined?'—':lowStock}<small>produk</small></b></div></a></div>
      <section class="ga-chart"><div class="ga-section-head"><h2>Penjualan 7 hari terakhir</h2><span class="ga-period">7 hari</span></div>${result?.[2]?.status!=='pending'&&result?chartMarkup(orders,stats):'<p class="ga-empty">Memuat penjualan…</p>'}</section>
      <section class="ga-recent"><div class="ga-section-head"><h2>Transaksi terbaru</h2><a href="/geraina/app/sales">Lihat semua ↗</a></div><div class="ga-orders">${result?.[2]?.status!=='pending'&&result?recentMarkup(orders):'<p class="ga-empty">Memuat transaksi…</p>'}</div></section>`;
  }
  async function loadDashboard(mount) {
    dashboardController?.abort();
    const controller=new AbortController();dashboardController=controller;
    const authToken=token();
    const timer=setTimeout(()=>controller.abort(),15000);
    mount.innerHTML=dashboardMarkup();
    const result=Array.from({length:3},()=>({status:'pending'}));
    result[1]={status:'fulfilled',value:[]};
    await Promise.all([['/orders/stats',0],['/orders/history?limit=5',2]].map(async([path,index])=>{
      try {const value=await read(path,controller.signal,authToken);if(index===0&&(!value||!['today_sales','today_orders','low_stock_count'].every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]))))throw new Error('Invalid stats');if(index===2&&!Array.isArray(value?.items))throw new Error('Invalid history');result[index]={status:'fulfilled',value:index===2?value.items:value};}
      catch {result[index]={status:'rejected'};}
      if(mount.isConnected&&authToken===token()&&controller===dashboardController)mount.innerHTML=dashboardMarkup(result);
    }));
    clearTimeout(timer);
    if(mount.isConnected && authToken===token() && controller===dashboardController) mount.innerHTML=dashboardMarkup(result);
  }
  function decorateDashboard() {
    const page=$('[data-testid="dashboard-page"]');
    if(!page) { if(dashboardController) {dashboardController.abort();dashboardController=null;} dashboardIdentity=''; return; }
    const currentUser=user(),identity=JSON.stringify([token(),currentUser.id,currentUser.store_id,currentUser.role,currentUser.plan]);
    const existing=$('.ga-dashboard',page);
    if(existing&&dashboardIdentity===identity) return;
    if(existing)existing.remove();
    dashboardIdentity=identity;
    const mount=document.createElement('section');mount.className='ga-dashboard';mount.dataset.testid='mobile-dashboard';
    page.append(mount);loadDashboard(mount);
  }
  function decorateProducts() {
    const page=$('[data-testid="products-page"]');if(!page)return;
    // React owns the full-catalogue summary and paginated rows. Decoration must
    // not fetch the catalogue again or remove React-owned DOM after writes.
    $$('[data-testid^="product-row-"]',page).forEach(row=>{
      const stock=row.children[4];if(stock)stock.classList.toggle('ga-stock-low',parseFloat(stock.textContent)<=5);
      const placeholder=$('td:first-child>div>span:first-child',row);
      if(placeholder?.textContent.trim()==='—'&&!placeholder.dataset.gaIcon){placeholder.dataset.gaIcon='true';placeholder.innerHTML=icon('box');}
      const edit=$('[data-testid^="edit-product-"]',row),remove=$('[data-testid^="delete-product-"]',row);
      if(edit&&!edit.hasAttribute('aria-label'))edit.setAttribute('aria-label','Edit produk');
      if(remove&&!remove.hasAttribute('aria-label'))remove.setAttribute('aria-label','Hapus produk');
    });
  }
  function decoratePos() {
    const page=$('[data-testid="pos-page"]');
    if(!page) {closeCart();document.documentElement.classList.remove('ga-barcode-open');return;}
    text($('h1',page),'Mulai transaksi');
    const cart=$('[data-testid="pos-cart"]',page);if(!cart)return;
    if(!$('.ga-cart-close',cart)) {
      const close=document.createElement('button');close.type='button';close.className='ga-cart-close';close.dataset.testid='mobile-cart-close';close.setAttribute('aria-label','Tutup keranjang');close.innerHTML=icon('close');close.addEventListener('click',closeCart);cart.firstElementChild.append(close);
    }
    if(!$('.ga-cart-dock',page)) {
      const scrim=document.createElement('div');scrim.className='ga-cart-scrim';scrim.addEventListener('click',closeCart);page.append(scrim);
      const dock=document.createElement('button');dock.type='button';dock.className='ga-cart-dock';dock.dataset.testid='mobile-cart-open';dock.innerHTML=`<span><p></p><b></b></span><span>Keranjang<span>${icon('arrow')}</span></span>`;dock.addEventListener('click',()=>document.documentElement.setAttribute('data-ga-cart','open'));page.append(dock);
    }
    const dock=$('.ga-cart-dock',page),quantity=$$('[data-testid^="cart-qty-"]',cart).reduce((sum,item)=>sum+(Number(item.textContent)||0),0);
    text($('p',dock),quantity?`${quantity} barang dipilih`:'Keranjang kosong');
    text($('b',dock),$('[data-testid="cart-total"]',cart)?.textContent||'Rp 0');
    if($('[data-testid="receipt-dialog"]'))closeCart();
    const barcode=$('[data-testid="pos-barcode-input"]',page),form=barcode?.closest('form');
    if(form&&!form.dataset.gaBound){form.dataset.gaBound='true';form.setAttribute('aria-label','Masukkan barcode');form.addEventListener('click',event=>{
      if(!document.documentElement.classList.contains('ga-barcode-open')){event.preventDefault();event.stopPropagation();document.documentElement.classList.add('ga-barcode-open');barcode.focus();}
    },true);}
  }
  function sync() {
    scheduled=false;
    if(!document.documentElement||!document.body)return;
    document.documentElement.setAttribute('data-ga-ui','1');
    if(!$('#geraina-mobile-style')){const style=document.createElement('style');style.id='geraina-mobile-style';style.textContent=css;document.documentElement.append(style);}
    const currentUser=user(),authenticated=!!$('[data-testid="app-layout"]');
    const shell={type:'shell',path:location.pathname,store:currentUser.store_name||'',authenticated,wideNavigation:authenticated&&innerWidth>=960};
    const signature=JSON.stringify(shell);
    if(signature!==shellSignature){shellSignature=signature;window.GerainaNative.postMessage(signature);}
    decorateDashboard();decorateProducts();decoratePos();
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}
  window.GerainaMobile={version:1,sync:schedule,openMenu,openSupport,back,navigate};
  for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{const result=original(...args);schedule();return result;};}
  addEventListener('popstate',schedule);
  addEventListener('resize',schedule);
  document.addEventListener('click',event=>{
    window.GerainaNative.postMessage(JSON.stringify({type:'interaction'}));
    const action=event.target.closest?.('[data-ga-action]')?.dataset.gaAction;
    if(action==='menu')openMenu();
    if(action==='reload-dashboard'){const mount=$('.ga-dashboard');if(mount)loadDashboard(mount);}
  });
  const ready=()=>{sync();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
