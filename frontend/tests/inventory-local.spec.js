const { test: base, expect } = require('@playwright/test');
const { fixture } = require('../../android-app/scripts/verify-remaining-pos.cjs');

const products = Array.from({ length: 501 }, (_, i) => ({ id: `value-${String(i).padStart(4, '0')}`, name: `Inventory product ${i}`, sku: `VALUE-${i}`, stock: 1, cost: 100, price: 200, unit: 'pcs' }));
products[0].name = 'Only sold in year 2000';
products[1].name = 'Only pending payments';
products[2].name = 'Recently paid product';
products[500].name = 'Beyond product 500';
const eligible = products.filter(p => p.id !== products[2].id);

const test = base.extend({
  inventory: async ({ browser }, use, testInfo) => {
    const f = await fixture(browser, testInfo.project.use.viewport);
    const state = { productFailure: false, deadFailure: false, empty: false }, reads = [];
    await f.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    await f.page.route('https://dagangos.com/api/products', route => {
      reads.push('/api/products');
      return route.fulfill({ status: state.productFailure ? 503 : 200, json: state.productFailure ? { detail: 'Isolated interruption' } : products.slice(0, 500) });
    });
    await f.page.route('https://dagangos.com/api/products/catalogue?*', route => {
      reads.push('/api/products/catalogue');
      const start = Number(new URL(route.request().url()).searchParams.get('cursor') || 0);
      return route.fulfill({ status: state.productFailure ? 503 : 200, json: state.productFailure ? { detail: 'Isolated interruption' } : { items: products.slice(start, start + 500), total: products.length, next_cursor: start + 500 < products.length ? String(start + 500) : null } });
    });
    await f.page.route(/\/api\/orders\?limit=100$/, route => {
      reads.push('/api/orders?limit=100');
      return route.fulfill({ json: [
        { id: 'ancient', created_at: '2000-01-01T00:00:00Z', payment_status: 'paid', items: [{ product_id: products[0].id, quantity: 1 }] },
        { id: 'unpaid', created_at: '2026-10-26T00:00:00Z', payment_status: 'pending', items: [{ product_id: products[1].id, quantity: 1 }] },
      ] });
    });
    await f.page.route(/\/api\/reports\/inventory\/dead-stock(?:\?.*)?$/, route => {
      reads.push('/api/reports/inventory/dead-stock');
      const start = Number(new URL(route.request().url()).searchParams.get('cursor') || 0), rows = state.empty ? [] : eligible;
      return route.fulfill({ status: state.deadFailure ? 503 : 200, json: state.deadFailure ? { detail: 'Isolated interruption' } : { items: rows.slice(start, start + 50), total: rows.length, next_cursor: start + 50 < rows.length ? String(start + 50) : null, days: 30, window_start: '2026-09-26T10:00:00+00:00', window_end: '2026-10-26T10:00:00+00:00' } });
    });
    try {
      await use({ ...f, state, reads });
      expect(f.errors).toEqual([]);
    } finally {
      const screenshot = testInfo.outputPath('screen.png');
      await f.page.screenshot({ path: screenshot }).then(() => testInfo.attach('screen', { path: screenshot, contentType: 'image/png' })).catch(() => {});
      await testInfo.attach('inventory-requests', { body: Buffer.from(JSON.stringify({ reads, merchantWrites: 0, runtimeErrors: f.errors }, null, 2)), contentType: 'application/json' });
      if (testInfo.status !== testInfo.expectedStatus) {
        const trace = testInfo.outputPath('trace.zip');
        await f.context.tracing.stop({ path: trace });
        await testInfo.attach('trace', { path: trace, contentType: 'application/zip' });
      } else await f.context.tracing.stop();
      await f.context.close();
    }
  },
});

test('Valuation totals include every product beyond 500 while table rows stay bounded', async ({ inventory: f }) => {
  await f.go('app/inventory/valuation');
  await expect(f.page.locator('[data-testid="inventory-valuation-page"] .num-display').first()).toHaveText('Rp 50.100');
  await expect(f.page.getByTestId('valuation-retail-total')).toHaveText('Rp 100.200');
  await expect(f.page.getByTestId('valuation-profit-total')).toHaveText('Rp 50.100');
  await expect(f.page.locator('tbody tr')).toHaveCount(50);
  await expect(f.page.getByTestId('table-pagination')).toContainText('501 produk');
  await f.page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await expect(f.page.getByTestId('table-pagination')).toContainText('2/11');
  expect(f.reads.filter(path => path === '/api/products/catalogue')).toHaveLength(2);
  expect(f.reads).not.toContain('/api/products');
});

test('Valuation errors never display zero assets and retry recovers the complete totals', async ({ inventory: f }) => {
  f.state.productFailure = true;
  await f.go('app/inventory/valuation');
  await expect(f.page.getByTestId('valuation-read-state').getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  await expect(f.page.locator('[data-testid="inventory-valuation-page"] .num-display')).toHaveCount(0);
  await expect(f.page.getByText('Belum ada data produk.', { exact: true })).toHaveCount(0);
  f.state.productFailure = false;
  await f.page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(f.page.getByTestId('valuation-asset-total')).toHaveText('Rp 50.100');
});

test('Dead stock uses the paid 30-day report, handles pages, errors and valid empty data', async ({ inventory: f }) => {
  await f.go('app/inventory/dead-stock');
  await expect(f.page.getByText('Only sold in year 2000', { exact: true })).toBeVisible();
  await expect(f.page.getByText('Only pending payments', { exact: true })).toBeVisible();
  await expect(f.page.getByText('Recently paid product', { exact: true })).toHaveCount(0);
  await expect(f.page.locator('tbody tr')).toHaveCount(50);
  await expect(f.page.getByTestId('dead-stock-period')).toContainText('UTC');
  expect(f.reads).not.toContain('/api/orders?limit=100');
  expect(f.reads).not.toContain('/api/products');
  await f.page.getByTestId('dead-stock-next').click();
  await expect(f.page.getByTestId('dead-stock-result-count')).toContainText('halaman 2');
  await f.page.getByTestId('dead-stock-prev').click();
  await expect(f.page.getByText('Only sold in year 2000', { exact: true })).toBeVisible();
  f.state.deadFailure = true;
  await f.page.getByTestId('dead-stock-refresh').click();
  await expect(f.page.getByTestId('dead-stock-read-state').getByRole('button', { name: 'Coba lagi' })).toBeVisible();
  await expect(f.page.getByTestId('dead-stock-empty')).toHaveCount(0);
  f.state.deadFailure = false; f.state.empty = true;
  await f.page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(f.page.getByTestId('dead-stock-empty')).toBeVisible();
  await expect(f.page.getByTestId('dead-stock-result-count')).toContainText('0 produk');
});
