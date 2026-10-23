import { checkoutReturn, checkoutAuthLink } from './checkoutReturn';

test('login and registration preserve a validated package and billing period', () => {
  const next = '/geraina/pricing?period=yearly&plan=business&checkout=1';
  window.history.replaceState(null, '', `/geraina/login?next=${encodeURIComponent(next)}`);
  expect(checkoutReturn('geraina')).toBe(next);
  expect(checkoutAuthLink('geraina', 'register')).toBe(`/geraina/register?next=${encodeURIComponent(next)}`);
});

test.each([
  'https://evil.test/geraina/pricing?period=yearly&plan=business&checkout=1',
  '//evil.test/geraina/pricing?period=yearly&plan=business&checkout=1',
  '/geraina/pricing?period=weekly&plan=business&checkout=1',
  '/geraina/pricing?period=yearly&plan=free&checkout=1',
  '/dapuros/pricing?period=yearly&plan=business&checkout=1',
])('rejects an invalid checkout return path: %s', next => {
  window.history.replaceState(null, '', `/geraina/login?next=${encodeURIComponent(next)}`);
  expect(checkoutReturn('geraina')).toBeNull();
  expect(checkoutAuthLink('geraina', 'register')).toBe('/geraina/register');
});
