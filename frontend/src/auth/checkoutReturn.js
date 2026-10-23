export function checkoutReturn(module) {
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next) return null;
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== `/${module}/pricing` || url.searchParams.get('checkout') !== '1') return null;
    const tier = url.searchParams.get('plan');
    const period = url.searchParams.get('period');
    if (!['starter', 'pro', 'business'].includes(tier) || !['monthly', 'yearly'].includes(period)) return null;
    return `/${module}/pricing?period=${period}&plan=${tier}&checkout=1`;
  } catch { return null; }
}

export function checkoutAuthLink(module, route) {
  const next = checkoutReturn(module);
  return `/${module}/${route}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
}
