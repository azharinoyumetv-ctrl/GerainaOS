import { safeAppReturn } from './appReturn';

test('preserves only the payment reference through login', () => {
  expect(safeAppReturn('/geraina/app/sales?order=GR-TEST-001&status=paid&amount=0&redirect=https://evil.invalid')).toBe('/geraina/app/sales?order=GR-TEST-001');
});
test.each([null, '', 'https://evil.invalid/geraina/app/sales?order=id', '/geraina/app/sales?order=../other', '/geraina/app/settings?order=id', '/geraina/pricing?order=id', '/geraina/app/sales', '//evil.invalid/geraina/app/sales?order=id', '/geraina/app/sales?order=' + 'a'.repeat(201)])('rejects unsafe or unrelated return destinations: %s', value => {
  expect(safeAppReturn(value)).toBe(null);
});
