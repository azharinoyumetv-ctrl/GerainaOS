(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://dagangos.com') return;
  const send = (type, payload = {}) => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    window.GerainaNative.postMessage(JSON.stringify({ type, ...payload }));
  };
  window.GerainaDevice = Object.freeze({
    offline: true,
    appInfo: window.__gerainaAppInfo ? Object.freeze({ ...window.__gerainaAppInfo }) : null,
    checkForUpdates: () => send('checkForUpdates'),
    scanBarcode: (target = 'pos') => send('scanBarcode', { target }),
    // FileReader completion is asynchronous, after the original user activation.
    // Native code accepts only generated camera-cache basenames for this cleanup.
    releaseProductPhoto: name => window.GerainaNative.postMessage(JSON.stringify({ type: 'releaseProductPhoto', name })),
    configurePrinter: () => send('configurePrinter'),
    testPrinter: () => send('testPrinter'),
    printReceipt: order => send('printReceipt', { order })
  });
})();
