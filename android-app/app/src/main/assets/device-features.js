(() => {
  'use strict';
  if (window.top !== window || location.origin !== 'https://dagangos.com') return;
  const send = (type, payload = {}) => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    window.GerainaNative.postMessage(JSON.stringify({ type, ...payload }));
  };
  window.GerainaDevice = Object.freeze({
    offline: true,
    scanBarcode: () => send('scanBarcode'),
    configurePrinter: () => send('configurePrinter'),
    testPrinter: () => send('testPrinter'),
    printReceipt: order => send('printReceipt', { order })
  });
})();
