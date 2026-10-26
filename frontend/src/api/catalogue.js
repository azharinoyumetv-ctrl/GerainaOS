import api from './client';

// Publish/cache only a complete enumeration. A failed later page must not
// replace a previously usable offline catalogue with a truncated list.
export async function loadCatalogue({ signal, activeOnly = false, onProgress } = {}) {
  const items = [], seen = new Set(), cursors = new Set();
  let cursor, total;
  do {
    const { data } = await api.get('/products/catalogue', { signal, timeout: 15000, params: { limit: 500, active_only: activeOnly, cursor } });
    if (!data || !Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0 || !(data.next_cursor === null || typeof data.next_cursor === 'string')) throw new Error('Katalog lengkap belum tersedia. Perbarui server dan coba lagi.');
    if (total !== undefined && total !== data.total) throw new Error('Katalog berubah saat dimuat. Coba muat ulang.');
    total = data.total;
    for (const product of data.items) {
      if (!product?.id || seen.has(product.id)) throw new Error('Halaman katalog berulang. Coba muat ulang.');
      seen.add(product.id); items.push(product);
    }
    onProgress?.({ loaded: items.length, total });
    cursor = data.next_cursor;
    if (cursor && (cursors.has(cursor) || !data.items.length)) throw new Error('Halaman katalog tidak berlanjut. Coba muat ulang.');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  if (items.length !== total) throw new Error('Katalog belum lengkap. Coba muat ulang sebelum menyimpan untuk offline.');
  const compare = new Intl.Collator('id-ID', { numeric: true, sensitivity: 'base' }).compare;
  return items.sort((a, b) => compare(a.name || '', b.name || '') || compare(a.id, b.id));
}
