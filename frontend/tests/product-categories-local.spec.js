const { test, expect } = require('./customer-audit.fixture.cjs');

test('A newly created category is selectable for a new product and survives edit/reload', async ({ app: f }) => {
  await f.go('app/products/categories');
  await f.page.getByTestId('category-name-input').fill('Minuman baru');
  await f.page.getByTestId('category-submit').click();
  await expect(f.page.getByTestId('category-success')).toBeVisible();
  await expect(f.page.getByTestId('categories-list')).toContainText('Minuman baru');
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  const category = f.page.getByTestId('pf-category');
  await expect(category).toHaveJSProperty('tagName', 'SELECT');
  await expect(category.locator('option').filter({ hasText: /^Minuman baru$/ })).toHaveCount(1);
  await category.selectOption({ label: 'Minuman baru' });
  await f.page.getByTestId('pf-name').fill('Teh kategori baru');
  await f.page.getByTestId('pf-price').fill('5000');
  await f.page.getByTestId('pf-stock').fill('4');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  const saved = await f.api('GET', '/products?q=Teh%20kategori%20baru');
  expect(saved.status).toBe(200);
  expect(saved.data).toHaveLength(1);
  expect(saved.data[0].category).toBe('Minuman baru');
  await f.page.reload();
  await f.page.getByTestId('edit-product-' + saved.data[0].id).click();
  await expect(f.page.getByTestId('pf-category').locator('option:checked')).toHaveText('Minuman baru');
  await f.page.getByTestId('pf-name').fill('Teh kategori tetap');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  expect((await f.api('GET', '/products?q=Teh%20kategori%20tetap')).data[0].category).toBe('Minuman baru');
  expect(f.errors).toEqual([]);
});

test('Unused saved categories and legacy product categories share the filter and editor without duplicates', async ({ app: f }) => {
  for (const name of ['Saved but unused', 'Legacy category']) expect((await f.api('POST', '/products/categories', { name })).status).toBe(200);
  await f.go('app/products');
  const filter = f.page.getByTestId('products-category-filter');
  await expect(filter.locator('option').filter({ hasText: /^Saved but unused$/ })).toHaveCount(1);
  await expect(filter.locator('option').filter({ hasText: /^Legacy category$/ })).toHaveCount(1);
  await filter.selectOption({ label: 'Saved but unused' });
  await expect(f.page.getByTestId('products-empty')).toBeVisible();
  await filter.selectOption('all');
  await f.page.getByTestId('edit-product-product-0000').click();
  const category = f.page.getByTestId('pf-category');
  await expect(category.locator('option:checked')).toHaveText('Legacy category');
  await expect(category.locator('option').filter({ hasText: /^Legacy category$/ })).toHaveCount(1);
  await expect(category.locator('option').filter({ hasText: /^Saved but unused$/ })).toHaveCount(1);
  await f.page.screenshot({ path: test.info().outputPath('category-dropdown.png') });
  expect(await f.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  expect(f.errors).toEqual([]);
});

test('Custom categories remain possible and empty managed lists keep the default usable', async ({ app: f }) => {
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  const category = f.page.getByTestId('pf-category');
  await expect(category.locator('option:checked')).toHaveText('Umum');
  await category.selectOption({ label: 'Kategori lainnya…' });
  await f.page.getByTestId('pf-category-custom').fill('  Nama tambahan  ');
  await f.page.getByTestId('pf-name').fill('Produk kategori tambahan');
  await f.page.getByTestId('pf-price').fill('2500');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  const saved = (await f.api('GET', '/products?q=Produk%20kategori%20tambahan')).data[0];
  expect(saved.category).toBe('Nama tambahan');
  await f.page.getByTestId('edit-product-' + saved.id).click();
  await expect(f.page.getByTestId('pf-category').locator('option:checked')).toHaveText('Nama tambahan');
  expect(f.errors).toEqual([]);
});

test('A failed category load is visible, retry recovers, and the product draft survives', async ({ app: f }) => {
  expect((await f.api('POST', '/products/categories', { name: 'Recovered category' })).status).toBe(200);
  let failed = true;
  await f.page.route('**/api/records/categories?*', async route => {
    if (failed) return route.fulfill({ status: 503, json: { detail: 'Isolated interruption' } });
    return route.fallback();
  });
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  await f.page.getByTestId('pf-name').fill('Draft retained');
  await expect(f.page.getByTestId('pf-category-error')).toBeVisible();
  failed = false;
  await f.page.getByTestId('pf-category-error').getByRole('button', { name: 'Coba lagi' }).click();
  await expect(f.page.getByTestId('pf-category').locator('option').filter({ hasText: /^Recovered category$/ })).toHaveCount(1);
  await expect(f.page.getByTestId('pf-category-error')).toHaveCount(0);
  await expect(f.page.getByTestId('pf-name')).toHaveValue('Draft retained');
  expect(f.errors).toEqual([]);
});

test('Saved categories are isolated to the active store', async ({ app: f }) => {
  expect((await f.api('POST', '/products/categories', { name: 'My store category' })).status).toBe(200);
  const otherLogin = await f.request.post('http://127.0.0.1:8856/api/auth/login', { data: { email: 'owner-b@example.com', password: 'DisposableAudit123' } });
  expect(otherLogin.status()).toBe(200);
  const otherSession = await otherLogin.json();
  const made = await f.request.post('http://127.0.0.1:8856/api/products/categories', {
    headers: { authorization: 'Bearer ' + otherSession.access_token, 'x-dagangos-module': 'geraina' }, data: { name: 'Other store private category' },
  });
  expect(made.status()).toBe(200);
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  const category = f.page.getByTestId('pf-category');
  await expect(category.locator('option').filter({ hasText: /^My store category$/ })).toHaveCount(1);
  await expect(category.locator('option').filter({ hasText: /^Other store private category$/ })).toHaveCount(0);
  expect(f.errors).toEqual([]);
});

test('Category choices include saved records beyond the first page', async ({ app: f }) => {
  const pageReads = [];
  await f.page.route('**/api/records/categories?*', route => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    pageReads.push(cursor);
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: 'cat-' + String(i).padStart(4, '0'), name: 'Category ' + String(i).padStart(4, '0') }));
    return route.fulfill({ json: { items: cursor ? rows.slice(500) : rows.slice(0, 500), total: rows.length, next_cursor: cursor ? null : 'isolated-second-page' } });
  });
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  const category = f.page.getByTestId('pf-category');
  await expect(category.locator('option').filter({ hasText: /^Category 0500$/ })).toHaveCount(1);
  await category.selectOption({ label: 'Category 0500' });
  await expect(category.locator('option:checked')).toHaveText('Category 0500');
  expect(pageReads).toContain('isolated-second-page');
  expect(f.errors).toEqual([]);
});
