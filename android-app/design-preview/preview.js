'use strict';
// Isolated visual prototype. It deliberately has no authentication or API calls.
const paths = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  cart:'<path d="M3 3h2l2.5 12h11l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  box:'<path d="m12 3 9 5-9 5-9-5zM3 8v10l9 5 9-5V8M12 13v10M7.5 5.5l9 5"/>',
  chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9V9"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6m-6 4h6m-6 4h3"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  trend:'<path d="m4 16 6-6 4 4 6-9m-6 0h6v6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M7 7v10m3-10v10m4-10v10m3-10v10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  alert:'<path d="m12 3 10 18H2zM12 9v4m0 4h.01"/>',
  stock:'<path d="M3 10 12 4l9 6v11H3zM8 21v-9h8v9M8 16h8"/>',
  signal:'<path d="M3 19v-3m4 3v-7m4 7V8m4 11V4"/>',
  wifi:'<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 4a4 4 0 0 1 6 0m-3 3h.01"/>',
  battery:'<rect x="2" y="6" width="18" height="12" rx="3"/><path d="M23 10v4M5 9h12v6H5z" fill="currentColor" stroke="none"/>',
  filter:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="17" r="2" fill="white"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  settings:'<path d="m10 3-1 3-3 1-3 3 2 3-1 3 4 2 2 3h4l2-3 4-2-1-3 2-3-3-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
};
const icon = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const rupiah = value => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const art = {
  coffee:'<ellipse cx="36" cy="77" rx="19" ry="4" fill="#543c2912"/><path d="M18 23h36l-4 46q-1 6-7 6H29q-6 0-7-6z" fill="#e7d1b4"/><path d="M20 39h32l-2 30q-1 6-7 6H29q-6 0-7-6z" fill="#ab7953"/><path d="m21 40 31 0-2 11H22z" fill="#f5e7d0"/><rect x="16" y="19" width="40" height="7" rx="3" fill="#344c36"/><path d="m37 19 5-16" stroke="#49614a" stroke-width="3"/><circle cx="37" cy="56" r="9" fill="#ede4ce"/><path d="M35 51c-6 2-3 10 2 9 5-2 3-9-2-9z" fill="#456040"/><path d="m37 52-2 7" stroke="#ede4ce" stroke-width="1"/><path d="m24 29 1 9" stroke="#fff9" stroke-width="2"/>',
  bread:'<path d="M14 65c-10-9-5-32 5-39 4-4 9-3 13-6 8-3 20 3 23 9 13 15 10 32 1 39-8 8-32 9-42-3z" fill="#ba7f38"/><path d="M15 60c-8-10-3-27 7-32 8-5 23-7 31 4 8 10 9 24-1 31-10 6-26 6-37-3z" fill="#e3b86c"/><path d="m29 26-7 19m18-22-7 22m19-15-6 20" stroke="#f3d9a2" stroke-width="5" stroke-linecap="round"/><path d="M16 57q18 9 41-1" stroke="#cd994c" stroke-width="2" fill="none"/>',
  water:'<path d="M29 8h17v11l5 8v42q0 7-7 7H31q-7 0-7-7V27l5-8z" fill="#c9dfdc"/><path d="M27 31h21v37q0 5-5 5H32q-5 0-5-5z" fill="#eaf3f0"/><path d="M25 38h26v22H25z" fill="#518b80"/><path d="m29 51 5-6 5 6 6-7 3 9H28" fill="#bed9c2"/><rect x="28" y="5" width="19" height="9" rx="2" fill="#4e7f72"/><path d="M31 27v9m0 28v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M31 17h13" stroke="#9abbb4" stroke-width="1.5"/>',
  chips:'<path d="m18 14 37-2 4 63-44 1z" fill="#d89d51"/><path d="m19 15 35-2-2 9-32 2z" fill="#c48c49"/><path d="m17 63 40-2 1 14-43 1z" fill="#c7873c"/><path d="m22 26 28-1 2 27-32 1z" fill="#f3ddb2"/><path d="m23 29 26-1" stroke="#774e2e" stroke-width="2"/><ellipse cx="33" cy="43" rx="8" ry="6" fill="#dbb362" transform="rotate(-20 33 43)"/><ellipse cx="40" cy="46" rx="8" ry="6" fill="#e7c579" transform="rotate(20 40 46)"/><path d="m27 42 9-2m0 6 9 2" stroke="#c19b50" stroke-width="1"/><path d="m22 69 29-1" stroke="#e5b36c" stroke-width="2"/>',
  tea:'<path d="M29 8h17v13l5 8v40q0 7-7 7H31q-7 0-7-7V29l5-8z" fill="#c19559"/><path d="M25 36h25v22H25z" fill="#e6e5ce"/><path d="M31 49q8-12 15-8-2 13-15 8" fill="#758452"/><path d="m32 49 10-6" stroke="#d7d9b6" stroke-width="1.3"/><rect x="28" y="5" width="19" height="9" rx="2" fill="#d6c59d"/><path d="M30 23v10" stroke="#e8d6ac" stroke-width="2" stroke-linecap="round"/>',
};
const products = [
  {id:'coffee',name:'Kopi Susu',category:'Minuman',unit:'Cup · 250 ml',price:18000,stock:24,tone:'cream'},
  {id:'bread',name:'Roti Butter',category:'Makanan',unit:'Pcs · Fresh daily',price:12000,stock:18,tone:'wheat'},
  {id:'water',name:'Air Mineral',category:'Minuman',unit:'Botol · 600 ml',price:6000,stock:48,tone:'blue'},
  {id:'chips',name:'Keripik Kentang',category:'Makanan',unit:'Pack · 75 gr',price:15000,stock:4,tone:'peach'},
  {id:'tea',name:'Teh Melati',category:'Minuman',unit:'Botol · 350 ml',price:8000,stock:32,tone:'green'},
];
const productArt = product => `<div class="product-art ${product.tone}"><svg viewBox="0 0 74 84" aria-hidden="true">${art[product.id]}</svg></div>`;
const views = {home:'Dasbor',pos:'Kasir',products:'Produk',reports:'Laporan',menu:'Menu'};
const state = [
  {view:'home',category:'Semua',query:'',cart:{coffee:2,bread:1}},
  {view:'pos',category:'Semua',query:'',cart:{coffee:2,bread:1}},
  {view:'products',category:'Semua',query:'',cart:{coffee:2,bread:1}},
];
const navigation = [{view:'home',name:'Dasbor',icon:'home'},{view:'pos',name:'Kasir',icon:'cart'},{view:'products',name:'Produk',icon:'box'},{view:'reports',name:'Laporan',icon:'chart'},{view:'menu',name:'Menu',icon:'grid'}];
function header(view) {
  if(view === 'home') return `<div class="app-brand"><img src="geraina-icon.png" alt=""><span class="app-wordmark">geraina<span class="brand-dot">.</span></span></div><button class="avatar" data-view="menu" aria-label="Buka profil dan menu">GA</button>`;
  return `<div><h2 class="header-title">${views[view]}</h2><p class="header-subtitle"><i></i> Geraina · Toko utama</p></div><div class="header-end">${view==='products'?`<button class="icon-button primary" data-action="new-product" aria-label="Tambah produk">${icon('plus')}</button>`:view==='pos'?`<button class="icon-button" data-action="history" aria-label="Riwayat transaksi">${icon('receipt')}</button>`:`<button class="avatar" data-view="menu" aria-label="Buka profil dan menu">GA</button>`}</div>`;
}
function dashboard(){return `<div class="page dashboard-page">
  <div class="page-head"><div><p class="date-label">Sabtu, 24 Oktober 2026</p><h1>Ringkasan toko</h1></div><button class="store-switch" data-action="store">Geraina ${icon('down')}</button></div>
  <section class="revenue-card"><span class="revenue-top-icon">${icon('trend')}</span><p class="revenue-title">PENJUALAN HARI INI</p><p class="revenue-amount">Rp 1.285.000</p><div class="revenue-change"><span class="positive-pill">${icon('trend')} 12,8%</span> dibanding kemarin</div><div class="revenue-bottom"><span><b>24</b> transaksi</span><span><b>Rp 53.542</b> / transaksi</span></div></section>
  <div class="quick-actions">${[{name:'Buka kasir',view:'pos',icon:'cart'},{name:'Produk',view:'products',icon:'box'},{name:'Stok',action:'stock',icon:'stock'},{name:'Laporan',view:'reports',icon:'chart'}].map(item=>`<button class="quick-action" ${item.view?`data-view="${item.view}"`:`data-action="${item.action}"`}><span>${icon(item.icon)}</span>${item.name}</button>`).join('')}</div>
  <div class="overview-metrics"><div class="mini-stat"><span class="mini-icon">${icon('receipt')}</span><div><p>Transaksi hari ini</p><b>24</b></div></div><button class="mini-stat" data-action="stock"><span class="mini-icon warn">${icon('alert')}</span><div><p>Stok menipis</p><b>6 <small>produk</small></b></div></button></div>
  <section class="chart-card"><div class="section-header"><h2>Penjualan minggu ini</h2><button class="chart-period" data-action="period">7 hari ${icon('down')}</button></div><p class="chart-value">Rp 8.460.000 <small>+8,2%</small></p><div class="chart-bars" aria-label="Contoh grafik penjualan mingguan"><span class="bar" style="height:37%"></span><span class="bar" style="height:62%"></span><span class="bar" style="height:47%"></span><span class="bar" style="height:80%"></span><span class="bar" style="height:64%"></span><span class="bar current" style="height:96%"></span><span class="bar" style="height:4%;opacity:.4"></span></div><div class="chart-labels"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span class="current">Sab</span><span>Min</span></div></section>
  <section><div class="section-header"><h2>Transaksi terbaru</h2><button data-action="history">Lihat semua ${'↗'}</button></div><button class="recent-list" data-action="receipt" style="width:100%;text-align:left"><span class="recent-icon">${icon('receipt')}</span><span class="recent-copy"><b>Penjualan #GR-024</b><p>13.42 · Tunai</p></span><span class="recent-amount">Rp 85.000<small>Selesai</small></span></button></section>
</div>`}
function searchBox(placeholder){return `<label class="search-box">${icon('search')}<input type="search" data-search placeholder="${placeholder}" aria-label="${placeholder}"></label>`}
function categories(current){return `<div class="category-tabs">${['Semua','Minuman','Makanan','Kebutuhan'].map(category=>`<button class="category-tab ${current===category?'active':''}" data-category="${category}">${category}</button>`).join('')}</div>`}
function filtered(model){return products.filter(product=>(model.category==='Semua'||product.category===model.category)&&product.name.toLowerCase().includes(model.query.toLowerCase()));}
function productCards(model){const items=filtered(model).slice(0,4);return items.length?items.map(product=>`<article class="product-card"><span class="stock-pill">Stok ${product.stock}</span>${productArt(product)}<div class="product-meta"><h3>${product.name}</h3><p class="product-unit">${product.unit}</p><div class="product-price-row"><b>${rupiah(product.price)}</b><button class="${model.cart[product.id]?'product-count':'add-product'}" data-add="${product.id}" aria-label="Tambah ${product.name}">${model.cart[product.id]||icon('plus')}</button></div></div></article>`).join(''):`<p class="empty-state">Produk belum ditemukan.<br>Coba kata kunci atau kategori lainnya.</p>`;}
function totals(model){return products.reduce((result,product)=>({count:result.count+(model.cart[product.id]||0),amount:result.amount+(model.cart[product.id]||0)*product.price}),{count:0,amount:0});}
function cartDock(model){const total=totals(model);return `<div class="cart-dock"><button class="cart-summary" data-action="cart"><span><p>${total.count} barang dipilih</p><strong>${rupiah(total.amount)}</strong></span><span class="cart-summary-end">Keranjang<span>${icon('arrow')}</span></span></button></div>`;}
function pos(model){return `<div class="page pos-page"><div class="pos-heading"><h1>Mulai transaksi</h1><p>Pilih produk, lanjutkan ke pembayaran.</p></div><div class="search-row">${searchBox('Cari nama atau barcode')}<button class="scan-button" data-action="scan" aria-label="Masukkan barcode">${icon('scan')}</button></div>${categories(model.category)}<div class="catalogue">${productCards(model)}</div><p class="catalogue-note">${icon('lock')} Transaksi tersimpan dengan aman</p></div>`;}
function inventoryRows(model){const items=filtered(model);return items.length?items.map(product=>`<button class="inventory-row" data-detail="${product.id}">${productArt(product).replace('product-art','product-art inventory-thumb')}<span class="inventory-copy"><h3>${product.name}</h3><p>${product.category}</p><b>${rupiah(product.price)}</b></span><span class="inventory-stock"><span class="${product.stock<6?'low':''}">${product.stock} ${product.stock<6?'· Menipis':'tersedia'}</span>${icon('chevron')}</span></button>`).join(''):'<p class="empty-state">Produk belum ditemukan.</p>';}
function inventory(model){return `<div class="page products-page"><div class="inventory-stats"><div class="inventory-stat"><p>Total produk</p><b>128</b></div><div class="inventory-stat"><p>Produk aktif</p><b>122</b><small></small></div><div class="inventory-stat"><p>Stok menipis</p><b>6</b></div></div><div class="search-row">${searchBox('Cari produk Anda')}<button class="filter-button" data-action="filter" aria-label="Filter produk">${icon('filter')}</button></div>${categories(model.category)}<div class="list-heading"><h2>Semua produk</h2><span class="result-count">${filtered(model).length} produk contoh</span></div><div class="inventory-list">${inventoryRows(model)}</div><p class="list-footer">Menampilkan produk contoh · <button data-action="new-product">Tambah produk baru</button></p></div>`;}
function reports(){return `<div class="page"><div class="simple-head"><p class="date-label">Sabtu, 24 Oktober 2026</p><h1>Performa toko</h1><p>Gambaran penjualan dan aktivitas toko hari ini.</p></div><div class="report-list">${[{name:'Penjualan hari ini',value:'Rp 1.285.000',icon:'trend'},{name:'Transaksi selesai',value:'24 transaksi',icon:'receipt'},{name:'Rata-rata transaksi',value:'Rp 53.542',icon:'cart'},{name:'Laba kotor contoh',value:'Rp 385.500',icon:'chart'}].map(item=>`<div class="report-metric"><div><p>${item.name}</p><b>${item.value}</b></div>${icon(item.icon)}</div>`).join('')}</div><p class="sample-note">Angka pada pratinjau ini adalah data contoh.</p></div>`;}
function menu(){return `<div class="page"><div class="simple-head"><h1>Kelola toko Anda</h1><p>Geraina · Toko utama<br>Semua kebutuhan operasional, satu tempat.</p></div><div class="menu-grid">${[{label:'Inventaris',icon:'stock',action:'stock'},{label:'Pelanggan',icon:'people',action:'customers'},{label:'Laporan',icon:'chart',view:'reports'},{label:'Pengaturan',icon:'settings',action:'settings'},{label:'Bantuan',icon:'help',action:'help'},{label:'Akun & privasi',icon:'lock',action:'privacy'}].map(item=>`<button class="menu-tile" ${item.view?`data-view="${item.view}"`:`data-action="${item.action}"`}>${icon(item.icon)}<span>${item.label}</span></button>`).join('')}</div><p class="sample-note">Geraina POS · by DagangOS<br>Pratinjau tampilan — belum terhubung ke toko.</p></div>`;}
function render(index){
  const model=state[index],column=document.querySelector(`[data-column="${index}"]`);
  column.querySelector('.screen-caption p').innerHTML=`<em>0${index+1}</em>${views[model.view]}`;
  const phone=column.querySelector('.phone');
  phone.innerHTML=`<div class="status-bar"><span>9:41</span><span class="status-icons">${icon('signal')}${icon('wifi')}${icon('battery','battery')}</span></div><header class="app-header">${header(model.view)}</header><div class="app-content">${model.view==='home'?dashboard():model.view==='pos'?pos(model):model.view==='products'?inventory(model):model.view==='reports'?reports():menu()}</div>${model.view==='pos'?cartDock(model):''}<nav class="bottom-nav" aria-label="Navigasi Geraina">${navigation.map(item=>`<button class="nav-button ${model.view===item.view?'selected':''}" data-view="${item.view}" ${model.view===item.view?'aria-current="page"':''}><span>${icon(item.icon)}</span>${item.name}</button>`).join('')}</nav><div class="home-indicator"></div><div class="toast" role="status" hidden></div>`;
  const input=phone.querySelector('[data-search]');if(input) input.value=model.query;
}
document.querySelector('#phones').innerHTML=state.map((model,index)=>`<section class="phone-column" data-column="${index}"><div class="screen-caption"><p></p><span>ANDROID · SAMPLE</span></div><div class="phone-frame"><div class="phone" data-phone="${index}"></div></div></section>`).join('');
state.forEach((_,index)=>render(index));
const toastTimers=new Map();
function toast(index,text){const element=document.querySelector(`[data-phone="${index}"] .toast`);element.textContent=text;element.hidden=false;clearTimeout(toastTimers.get(index));toastTimers.set(index,setTimeout(()=>element.hidden=true,3500));}
function sheet(index,title,content){const phone=document.querySelector(`[data-phone="${index}"]`);phone.querySelector('.sheet-backdrop')?.remove();const overlay=document.createElement('div');overlay.className='sheet-backdrop';overlay.innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-label="${title}"><div class="sheet-handle"></div><div class="sheet-title"><h2>${title}</h2><button data-action="close-sheet" aria-label="Tutup">${icon('close')}</button></div>${content}</section>`;phone.append(overlay);overlay.querySelector('[data-action="close-sheet"]').focus();}
function cartSheet(index){const model=state[index],total=totals(model);sheet(index,'Keranjang',`${products.filter(product=>model.cart[product.id]).map(product=>`<div class="cart-row"><div><h3>${product.name}</h3><p>${rupiah(product.price)}</p></div><div class="quantity"><button data-minus="${product.id}" aria-label="Kurangi ${product.name}">${icon('minus')}</button><b>${model.cart[product.id]}</b><button data-plus="${product.id}" aria-label="Tambah ${product.name}">${icon('plus')}</button></div></div>`).join('')||'<p class="empty-state">Keranjang masih kosong.</p>'}<div class="sheet-total"><span>Total pembayaran</span><b>${rupiah(total.amount)}</b></div><button class="primary-button" data-action="pay">Lanjut pembayaran ${icon('arrow')}</button><p class="sample-note">Pratinjau desain · tidak membuat transaksi sungguhan.</p>`);}
document.addEventListener('input',event=>{if(!event.target.matches('[data-search]'))return;const index=Number(event.target.closest('[data-phone]').dataset.phone),model=state[index];model.query=event.target.value;const phone=event.target.closest('[data-phone]');if(model.view==='pos')phone.querySelector('.catalogue').innerHTML=productCards(model);else{phone.querySelector('.inventory-list').innerHTML=inventoryRows(model);phone.querySelector('.result-count').textContent=`${filtered(model).length} produk contoh`;}});
document.addEventListener('click',event=>{
  const button=event.target.closest('button'),phone=event.target.closest('[data-phone]');
  if(event.target.classList.contains('sheet-backdrop')){event.target.remove();return;}
  if(!button||!phone)return;
  const index=Number(phone.dataset.phone),model=state[index];
  if(button.dataset.view){model.view=button.dataset.view;model.query='';model.category='Semua';render(index);return;}
  if(button.dataset.category){model.category=button.dataset.category;render(index);return;}
  if(button.dataset.add){model.cart[button.dataset.add]=(model.cart[button.dataset.add]||0)+1;const scroll=phone.querySelector('.app-content').scrollTop;render(index);phone.querySelector('.app-content').scrollTop=scroll;return;}
  if(button.dataset.plus||button.dataset.minus){const id=button.dataset.plus||button.dataset.minus;model.cart[id]=Math.max(0,(model.cart[id]||0)+(button.dataset.plus?1:-1));phone.querySelector('.cart-dock').outerHTML=cartDock(model);cartSheet(index);return;}
  if(button.dataset.detail){const product=products.find(item=>item.id===button.dataset.detail);sheet(index,product.name,`${productArt(product).replace('product-art','product-art detail-art')}<div class="detail-info"><span>${product.category}</span><b>${rupiah(product.price)}</b></div><p class="sample-note" style="text-align:left">${product.unit}<br>Stok tersedia: ${product.stock}<br>Produk contoh untuk pratinjau tampilan.</p>`);return;}
  switch(button.dataset.action){
    case 'close-sheet':phone.querySelector('.sheet-backdrop')?.remove();break;
    case 'cart':cartSheet(index);break;
    case 'pay':toast(index,'Ini pratinjau desain. Tidak ada pembayaran atau transaksi yang diproses.');break;
    case 'stock':model.view='products';model.category='Semua';model.query='';render(index);toast(index,'6 produk contoh memiliki stok menipis.');break;
    case 'new-product':sheet(index,'Tambah produk','<label class="preview-field">Nama produk<input placeholder="Contoh: Kopi Susu"></label><label class="preview-field">Harga jual<input type="number" placeholder="18000"></label><button class="primary-button" data-action="save-draft">Simpan contoh produk</button><p class="sample-note">Form contoh · tidak menyimpan ke toko Anda.</p>');break;
    case 'save-draft':phone.querySelector('.sheet-backdrop')?.remove();toast(index,'Tampilan formulir contoh. Data toko Anda tidak berubah.');break;
    case 'filter':sheet(index,'Filter produk',`<div class="menu-grid">${['Semua','Minuman','Makanan'].map(category=>`<button class="menu-tile" data-category="${category}">${icon('box')}<span>${category}</span></button>`).join('')}</div>`);break;
    case 'history':sheet(index,'Transaksi terbaru','<div class="cart-row"><div><h3>#GR-024 · Tunai</h3><p>13.42 · Selesai</p></div><b style="font-size:13px">Rp 85.000</b></div><div class="cart-row"><div><h3>#GR-023 · QRIS</h3><p>13.26 · Selesai</p></div><b style="font-size:13px">Rp 42.000</b></div><p class="sample-note">Riwayat contoh untuk pratinjau desain.</p>');break;
    case 'receipt':sheet(index,'Penjualan #GR-024','<div class="cart-row"><div><h3>Tunai</h3><p>24 Oktober 2026 · 13.42</p></div><span class="positive-pill" style="background:#edf3e6;color:#578442">Selesai</span></div><div class="sheet-total"><span>Total</span><b>Rp 85.000</b></div><p class="sample-note">Struk contoh · bukan transaksi toko Anda.</p>');break;
    case 'scan':sheet(index,'Masukkan barcode','<label class="preview-field">Kode barcode<input inputmode="numeric" placeholder="8990123456789"></label><button class="primary-button" data-action="scan-done">Cari produk</button><p class="sample-note">Pratinjau masukan barcode untuk kasir.</p>');break;
    case 'scan-done':phone.querySelector('.sheet-backdrop')?.remove();toast(index,'Pratinjau desain — belum terhubung ke pemindai barcode.');break;
    case 'store':sheet(index,'Toko Anda','<button class="inventory-row" data-action="close-sheet"><span class="recent-icon">'+icon('stock')+'</span><span class="inventory-copy"><h3>Geraina</h3><p>Toko utama · Aktif</p></span>'+icon('check')+'</button><p class="sample-note">Pilihan toko contoh.</p>');break;
    case 'period':sheet(index,'Periode penjualan',`<div class="menu-grid">${['Hari ini','7 hari','Bulan ini','Tahun ini'].map(period=>`<button class="menu-tile" data-action="period-done">${icon('chart')}<span>${period}</span></button>`).join('')}</div><p class="sample-note">Grafik pada sampel menggunakan data contoh.</p>`);break;
    case 'period-done':phone.querySelector('.sheet-backdrop')?.remove();toast(index,'Periode contoh dipilih. Angka adalah data pratinjau.');break;
    default:toast(index,'Pratinjau tampilan. Fitur ini akan memakai data dan alur Geraina yang sudah ada.');
  }
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.sheet-backdrop').forEach(element=>element.remove());});
