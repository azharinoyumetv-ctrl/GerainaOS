import api from './client';
import { loadCatalogue } from './catalogue';

const kinds = {
  '/customers':'customers', '/customers/memberships':'memberships', '/suppliers':'suppliers', '/purchase/orders':'purchase-orders',
  '/purchase/receiving':'receiving', '/purchase/invoices':'invoices',
  '/debt/receivables':'receivables', '/debt/payables':'payables',
  '/products/categories':'categories', '/products/brands':'brands', '/products/units':'units',
  '/products/stock-adjustments':'adjustments', '/products/stock-transfers':'transfers', '/branches':'branches',
};
const named = new Set(['customers','suppliers','categories','brands','units','branches','memberships']);
const collator = new Intl.Collator('id', { numeric:true, sensitivity:'base' });

export async function readCollection(path, options = {}) {
  if (path === '/products') return { data:await loadCatalogue(options) };
  const kind = kinds[path];
  if (!kind) {
    const response=await api.get(path,{timeout:15000,...options});
    if (path==='/orders/stats' && (!response.data || !['today_sales','today_orders','low_stock_count'].every(key=>typeof response.data[key]==='number' && Number.isFinite(response.data[key])))) throw new Error('Data ringkasan tidak valid.');
    if (path.startsWith('/orders/history') && !Array.isArray(response.data?.items)) throw new Error('Data transaksi tidak valid.');
    return response;
  }
  let cursor = null, total = null;
  const rows = [], ids = new Set(), cursors = new Set();
  do {
    const response = await api.get('/records/'+kind, { timeout:15000, ...options, params:{ ...options.params, limit:500, cursor } });
    const page = response.data;
    if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0 ||
        !(page.next_cursor === null || (typeof page.next_cursor === 'string' && page.next_cursor))) throw new Error('Jawaban daftar data tidak lengkap.');
    if (total !== null && total !== page.total) throw new Error('Daftar berubah saat dimuat. Coba lagi.');
    total = page.total;
    for (const row of page.items) {
      if (!row?.id || ids.has(row.id)) throw new Error('Daftar memuat referensi yang tidak valid atau duplikat.');
      ids.add(row.id); rows.push(row);
    }
    cursor = page.next_cursor;
    if (cursor && (cursors.has(cursor) || !page.items.length)) throw new Error('Halaman daftar tidak valid.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  if (rows.length !== total) throw new Error('Daftar belum lengkap. Coba lagi.');
  rows.sort(named.has(kind)
    ? (a,b)=>collator.compare(a.name || '', b.name || '') || collator.compare(a.id,b.id)
    : (a,b)=>String(b.created_at || b.received_at || '').localeCompare(String(a.created_at || a.received_at || '')) || collator.compare(a.id,b.id));
  return { data:rows, total };
}
