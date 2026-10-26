import { SECTIONS, sectionMenu, minPlanForPath, isPlanLocked } from './sections';
import { canAccessPath } from '../auth/permissions';

test('each section has unique canonical destinations shared by tabs and sidebar', () => {
  for (const [section, tabs] of Object.entries(SECTIONS)) {
    expect(new Set(tabs.map(tab => tab.id)).size).toBe(tabs.length);
    expect(new Set(tabs.map(tab => tab.path)).size).toBe(tabs.length);
    expect(sectionMenu(section).map(item => item.to)).toEqual(tabs.map(tab => tab.path));
    for (const tab of tabs) {
      expect(tab.path).toMatch(/^\/geraina\/app\//);
      expect(canAccessPath('Owner', tab.path)).toBe(true);
      expect(minPlanForPath(tab.path)).toBe(tab.minPlan || null);
    }
  }
});

test('DOKU and EDC cannot disappear from one navigation surface', () => {
  expect(SECTIONS.integrations.find(tab => tab.id === 'doku').path).toBe('/geraina/app/integrations/doku');
  expect(SECTIONS.payments.find(tab => tab.id === 'edc').label).toMatch(/belum tersedia/);
});

test.each(['starter', 'pro', 'business', 'trial'])('bank QRIS does not inherit a gateway plan requirement: %s', plan => {
  for (const path of ['/geraina/app/payments/qris', '/geraina/app/settings/payments/qris', '/geraina/app/integrations/qris']) {
    expect(isPlanLocked(minPlanForPath(path), plan)).toBe(false);
  }
});

test.each(['xendit', 'doku', 'midtrans'])('%s consistently requires Pro', provider => {
  const path = `/geraina/app/integrations/${provider}`;
  expect(isPlanLocked(minPlanForPath(path), 'starter')).toBe(true);
  expect(isPlanLocked(minPlanForPath(path), 'pro')).toBe(false);
});

test('WhatsApp has its own Business gate while gateway channels remain Pro', () => {
  const path = '/geraina/app/integrations/whatsapp';
  expect(isPlanLocked(minPlanForPath(path), 'pro')).toBe(true);
  expect(isPlanLocked(minPlanForPath(path), 'business')).toBe(false);
  expect(isPlanLocked(minPlanForPath(path), 'trial')).toBe(false);
});

test.each(['Manager', 'Cashier', 'Warehouse'])('%s cannot see Owner-only configuration tabs', role => {
  for (const section of ['payments', 'settings', 'integrations']) {
    expect(SECTIONS[section].filter(tab => canAccessPath(role, tab.path))).toHaveLength(0);
  }
});

test('plan route matching respects path boundaries', () => {
  expect(minPlanForPath('/geraina/app/reports/sales/')).toBe('pro');
  expect(minPlanForPath('/geraina/app/reports-archive')).toBe(null);
  expect(minPlanForPath('/geraina/app/products/stock-transfer-history')).toBe(null);
});

test('cashiers retain sales history while stock and financial reports stay restricted', () => {
  expect(canAccessPath('Cashier', '/geraina/app/sales')).toBe(true);
  expect(canAccessPath('Cashier', '/geraina/app/inventory/overview')).toBe(false);
  expect(canAccessPath('Cashier', '/geraina/app/reports/sales')).toBe(false);
  expect(canAccessPath('Warehouse', '/geraina/app/sales')).toBe(false);
});
