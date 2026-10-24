(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://dagangos.com' || window.__gerainaAndroid) return;
  window.__gerainaAndroid = true;
  const send = (type, payload = {}) => window.GerainaNative.postMessage(JSON.stringify({ type, ...payload }));
  const subscriptionPath = url => {
    try {
      const parsed = new URL(url, location.href);
      return parsed.origin === location.origin && decodeURIComponent(parsed.pathname).split('/').some(p => /^(pricing|checkout|order|billing)$/i.test(p));
    } catch { return true; }
  };
  const blocked = () => send('subscription');
  // React Router uses history; WebViewClient alone cannot gate these transitions.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method].bind(history);
    history[method] = (state, title, url) => {
      if (url && subscriptionPath(url)) { blocked(); return; }
      const result = original(state, title, url);
      send('navigation');
      return result;
    };
  }
  addEventListener('popstate', () => send('navigation'));
  const blobs = new Map();
  const createUrl = URL.createObjectURL.bind(URL);
  const revokeUrl = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = createUrl(blob); blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); revokeUrl(url); };
  const download = async anchor => {
    try {
      const blob = blobs.get(anchor.href) || await (await fetch(anchor.href)).blob();
      if (blob.size > 10 * 1024 * 1024) { send('downloadTooLarge'); return; }
      const reader = new FileReader();
      reader.onload = () => send('download', { name: anchor.download || 'geraina-export.pdf', data: reader.result });
      reader.onerror = () => send('downloadError');
      reader.readAsDataURL(blob);
    } catch { send('downloadError'); }
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (!anchor) return;
    if (subscriptionPath(anchor.href)) {
      event.preventDefault(); event.stopImmediatePropagation(); blocked(); return;
    }
    if (anchor.href.startsWith('blob:') || anchor.href.startsWith('data:')) {
      event.preventDefault(); event.stopImmediatePropagation(); download(anchor);
    }
  }, true);
  document.addEventListener('submit', event => {
    if (subscriptionPath(event.target.action)) {
      event.preventDefault(); event.stopImmediatePropagation(); blocked();
    }
  }, true);
  window.print = () => send('print');
  window.open = url => {
    if (subscriptionPath(url)) blocked();
    else if (url) send('open', { url: new URL(url, location.href).href });
    return null;
  };
  // Existing accounts and free trials work here. SaaS purchases are not offered.
  const hide = element => { element.hidden = true; element.style.setProperty('display', 'none', 'important'); };
  const clean = () => {
    document.querySelectorAll('a[href], form[action]').forEach(element => {
      if (subscriptionPath(element.href || element.action)) hide(element);
    });
    document.querySelectorAll('button').forEach(element => {
      if (/^(upgrade|lihat paket|lihat harga|pilih paket|berlangganan|perpanjang|lanjut.*bayar)/i.test(element.textContent.trim())) hide(element);
    });
  };
  const ready = () => { clean(); new MutationObserver(clean).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
