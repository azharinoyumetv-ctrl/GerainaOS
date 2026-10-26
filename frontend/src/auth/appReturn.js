// Payment references locate records; they never carry payment authority.
export function safeAppReturn(value) {
  if (typeof value !== 'string' || value.length > 1000) return null;
  try {
    const url = new URL(value, window.location.origin);
    const reference = url.searchParams.get('order');
    if (url.origin !== window.location.origin || url.pathname !== '/geraina/app/sales' || !/^[A-Za-z0-9_-]{1,200}$/.test(reference || '')) return null;
    return '/geraina/app/sales?order=' + encodeURIComponent(reference);
  } catch { return null; }
}
