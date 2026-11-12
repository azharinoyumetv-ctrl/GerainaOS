const { test, expect } = require('./customer-audit.fixture.cjs');

test('Brands connect to products and remain consistent through edits', async ({ app: f }) => {
  const created = await f.api('POST', '/products/brands', { name: 'Brand Contoh', description: '' });
  expect(created.status).toBe(200);
  await f.go('app/products');
  await f.page.getByTestId('new-product-btn').click();
  const brand = f.page.getByTestId('pf-brand');
  await expect(brand.locator('option').filter({ hasText: 'Brand Contoh' })).toHaveCount(1);
  await brand.selectOption(created.data.id);
  await f.page.getByTestId('pf-name').fill('Produk brand contoh');
  await f.page.getByTestId('pf-price').fill('5000');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  const product = (await f.api('GET', '/products?q=Produk%20brand%20contoh')).data[0];
  expect(product.brand_id).toBe(created.data.id);
  await expect(f.page.getByTestId('products-table')).toContainText('Brand Contoh');
  expect((await f.api('DELETE', '/products/brands/' + created.data.id)).status).toBe(409);
  expect((await f.api('PUT', '/products/brands/' + created.data.id, { name: 'Brand Baru', description: '' })).status).toBe(200);
  await f.page.reload();
  await f.page.getByTestId('edit-product-' + product.id).click();
  await expect(brand.locator('option:checked')).toHaveText('Brand Baru');
  await brand.selectOption('');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  expect((await f.api('DELETE', '/products/brands/' + created.data.id)).status).toBe(200);
  expect(f.errors).toEqual([]);
});

test('Legacy products and another store brands remain isolated', async ({ app: f }) => {
  await f.go('app/products');
  await f.page.getByTestId('edit-product-product-0000').click();
  await expect(f.page.getByTestId('pf-brand')).toHaveValue('');
  await f.page.getByTestId('pf-name').fill('Legacy updated');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  const other = await f.request.post('http://127.0.0.1:8856/api/auth/login', { data: { email: 'owner-b@example.com', password: 'DisposableAudit123' } });
  const token = (await other.json()).access_token;
  const response = await f.request.post('http://127.0.0.1:8856/api/products/brands', { headers: { authorization: 'Bearer ' + token, 'x-dagangos-module': 'geraina' }, data: { name: 'Other Store', description: '' } });
  const foreignBrand = await response.json();
  const rejected = await f.api('POST', '/products', { name: 'Invalid brand', price: 10, brand_id: foreignBrand.id });
  expect(rejected.status).toBe(400);
});
