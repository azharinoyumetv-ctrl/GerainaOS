export function addonCheckoutUrl(id, renewal) {
  if (!['extra_device', 'extra_outlet'].includes(id) || renewal && !/^(DG-geraina-[a-f0-9]{32}|[a-f0-9-]{36})$/.test(renewal)) return null;
  return `/geraina/pricing?period=monthly&addon=${id}&checkout=1${renewal ? `&renewal=${encodeURIComponent(renewal)}` : ''}`;
}

export function checkoutReturn(module) {
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next) return null;
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== `/${module}/pricing` || url.searchParams.get('checkout') !== '1') return null;
    const tier = url.searchParams.get('plan');
    const period = url.searchParams.get('period');
    if (module === 'geraina' && url.searchParams.has('addon') && period === 'monthly') return addonCheckoutUrl(url.searchParams.get('addon'), url.searchParams.get('renewal'));
    if (!['starter', 'pro', 'business'].includes(tier) || !['monthly', 'yearly'].includes(period)) return null;
    return `/${module}/pricing?period=${period}&plan=${tier}&checkout=1`;
  } catch { return null; }
}

export function checkoutAuthLink(module, route) {
  const next = checkoutReturn(module);
  return `/${module}/${route}${next ? `?next=${encodeURIComponent(next)}` : ''}`;
}
