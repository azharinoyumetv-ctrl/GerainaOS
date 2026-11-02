const { test, expect } = require('./customer-audit.fixture.cjs');

async function picture(page, color = '#27705c') {
  const encoded = await page.evaluate(color => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
    const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 640, 480);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color);
  return { name: 'product-fixture.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') };
}

test('Product photos offer gallery and direct capture, then save and reopen the selected image', async ({ app: f }) => {
  await f.go('app/products'); await f.page.getByTestId('new-product-btn').click();
  await expect(f.page.getByTestId('pf-photo-camera')).toBeVisible();
  await expect(f.page.getByTestId('pf-camera-input')).toHaveAttribute('capture', 'environment');
  await expect(f.page.getByTestId('pf-image-input')).not.toHaveAttribute('capture', /.+/);
  const selection = f.page.waitForEvent('filechooser');
  await f.page.getByTestId('pf-photo-gallery').click();
  await (await selection).setFiles(await picture(f.page));
  await expect(f.page.getByTestId('pf-image-preview')).toBeVisible();
  expect(await f.page.getByTestId('pf-image-preview').evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([320, 240]);
  await f.page.getByTestId('pf-name').fill('Product with gallery photo');
  await f.page.getByTestId('pf-price').fill('5000');
  await f.page.getByTestId('pf-save').click();
  await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
  const saved = (await f.api('GET', '/products?q=Product%20with%20gallery%20photo')).data[0];
  expect(saved.image_url).toMatch(/^data:image\/jpeg;base64,/);
  await f.page.reload(); await f.page.getByTestId('edit-product-' + saved.id).click();
  await expect(f.page.getByTestId('pf-image-preview')).toHaveAttribute('src', saved.image_url);
  expect(f.errors).toEqual([]);
});

test('Retake and replace keep the draft; cancellation and reselecting the same file work', async ({ app: f }) => {
  await f.go('app/products'); await f.page.getByTestId('new-product-btn').click();
  await f.page.getByTestId('pf-name').fill('Draft with image');
  const original = await picture(f.page);
  await f.page.getByTestId('pf-image-input').setInputFiles(original);
  const preview = f.page.getByTestId('pf-image-preview'); await expect(preview).toBeVisible();
  const before = await preview.getAttribute('src');
  await expect(f.page.getByTestId('pf-image-input')).toHaveValue('');
  await f.page.getByTestId('pf-image-input').setInputFiles([]);
  await expect(preview).toHaveAttribute('src', before);
  const capture = f.page.waitForEvent('filechooser');
  await f.page.getByTestId('pf-photo-camera').click();
  await (await capture).setFiles(await picture(f.page, '#dc8046'));
  await expect(preview).not.toHaveAttribute('src', before);
  await expect(f.page.getByTestId('pf-name')).toHaveValue('Draft with image');
  await f.page.getByTestId('pf-image-input').setInputFiles(original);
  await expect(preview).toHaveAttribute('src', before);
  await f.page.getByTestId('pf-image-remove').click(); await expect(preview).toHaveCount(0);
  await expect(f.page.getByTestId('pf-photo-camera')).toBeVisible();
  expect(f.errors).toEqual([]);
});

test('Photo reading blocks premature save; bad image data recovers without discarding the previous photo', async ({ app: f }) => {
  await f.go('app/products'); await f.page.getByTestId('new-product-btn').click();
  await f.page.evaluate(() => {
    const read = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function(file) { setTimeout(() => read.call(this, file), 250); };
  });
  await f.page.getByTestId('pf-image-input').setInputFiles(await picture(f.page));
  await expect(f.page.getByTestId('pf-photo-processing')).toBeVisible();
  await expect(f.page.getByTestId('pf-save')).toBeDisabled();
  await expect(f.page.getByTestId('pf-image-preview')).toBeVisible();
  await expect(f.page.getByTestId('pf-save')).toBeEnabled();
  const before = await f.page.getByTestId('pf-image-preview').getAttribute('src');
  await f.page.getByTestId('pf-image-input').setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(f.page.getByTestId('pf-error')).toContainText('Foto tidak dapat dibaca');
  await expect(f.page.getByTestId('pf-image-preview')).toHaveAttribute('src', before);
  await expect(f.page.getByTestId('pf-save')).toBeEnabled();
  await f.page.getByTestId('pf-image-input').setInputFiles(await picture(f.page, '#3167ad'));
  await expect(f.page.getByTestId('pf-image-preview')).not.toHaveAttribute('src', before);
  await expect(f.page.getByTestId('pf-error')).toHaveCount(0);
  expect(f.errors).toEqual([]);
});
