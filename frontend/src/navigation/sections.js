// Shared by sidebar, page tabs and route guards. Paths are canonical app URLs.
const tab = (id, label, section, minPlan) => ({ id, label, path: `/geraina/app/${section}/${id.replaceAll('_', '-')}`, minPlan });
export const SECTIONS = {
  integrations: [
    tab('xendit', 'Xendit', 'integrations', 'pro'),
    tab('doku', 'DOKU', 'integrations', 'pro'),
    tab('midtrans', 'Midtrans', 'integrations', 'pro'),
    { id: 'qris', label: 'QRIS bank', path: '/geraina/app/payments/qris' },
    tab('whatsapp', 'WhatsApp', 'integrations', 'business'),
  ],
  payments: [tab('cash', 'Tunai', 'payments'), tab('qris', 'QRIS bank', 'payments'), tab('ewallet', 'E-Wallet', 'payments'), tab('va', 'Virtual Account', 'payments'), tab('credit_card', 'Kartu Kredit', 'payments'), tab('bank_transfer', 'Transfer Bank', 'payments'), tab('edc', 'EDC (belum tersedia)', 'payments')],
  settings: [tab('general', 'Umum', 'settings'), tab('store', 'Toko', 'settings'), tab('billing', 'Langganan & Tagihan', 'settings'), tab('receipt', 'Struk', 'settings'), tab('printer', 'Printer', 'settings'), tab('users', 'Pengguna', 'settings'), tab('license', 'Lisensi', 'settings')],
  reports: [tab('sales', 'Penjualan', 'reports', 'pro'), tab('product', 'Produk', 'reports', 'pro'), tab('inventory', 'Stok / Inventaris', 'reports', 'pro'), tab('profit', 'Laba Rugi', 'reports', 'pro'), tab('cashflow', 'Arus Kas', 'reports', 'pro'), tab('tax', 'Pajak', 'reports', 'pro')],
};
export const sectionMenu = section => SECTIONS[section].map(({ path, ...item }) => ({ ...item, to: path }));
export const PLAN_RANK = { expired: -1, starter: 0, pro: 1, business: 2, trial: 2 };
export const PLAN_LABEL = { starter: 'Starter', pro: 'Pro', business: 'Business' };
export const isPlanLocked = (required, plan) => !!required && (PLAN_RANK[plan] ?? 0) < (PLAN_RANK[required] ?? 0);
const PLAN_ROUTES = [
  ['/products/stock-transfer', 'business'], ['/inventory/movement', 'pro'], ['/inventory/valuation', 'pro'], ['/inventory/dead-stock', 'pro'], ['/purchase', 'pro'], ['/suppliers', 'pro'], ['/customers/membership', 'business'], ['/customers/loyalty', 'business'], ['/debt', 'pro'], ['/reports', 'pro'], ['/staff/roles', 'business'], ['/staff/permissions', 'business'], ['/staff/attendance', 'business'], ['/attendance', 'business'], ['/branches', 'business'],
  ...SECTIONS.integrations.filter(item => item.minPlan).map(item => [item.path.replace('/geraina/app', ''), item.minPlan]),
  ['/integrations', 'pro'],
];
export function minPlanForPath(pathname) {
  const path = pathname.replace(/^\/geraina\/app/, '').replace(/\/$/, '');
  if (path === '/integrations/qris') return null;
  return PLAN_ROUTES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1] || null;
}
