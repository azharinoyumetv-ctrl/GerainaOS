import { useEffect, useState } from 'react';
import api from '@/api/client';
import { cached, cache } from '@/offline/posStore';

export default function usePaymentOptions(scope, offline, online) {
  const [options, setOptions] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setOptions(null); setError('');
    (async () => {
      let saved;
      if (offline) saved = await cached(scope, 'payment-options').catch(() => null);
      if (!active) return;
      if (!online) {
        // Older installations already recorded offline cash sales before storing
        // payment policy. Preserve that ability; current cached disables win.
        setOptions(saved?.data || { methods: { cash: { enabled: true } }, ewallet_channels: [] });
        return;
      }
      try {
        const { data } = await api.get('/payments/options', { timeout: 12000, signal: controller.signal });
        if (!data?.methods || !Array.isArray(data.ewallet_channels)) throw new Error('Invalid payment options');
        if (!active) return;
        if (offline) await cache(scope, 'payment-options', data);
        if (active) setOptions(data);
      } catch { if (active) setError('Metode pembayaran belum dapat dimuat. Coba lagi sebelum checkout.'); }
    })();
    return () => { active = false; controller.abort(); };
  }, [scope, offline, online, attempt]);
  useEffect(() => {
    const reload = () => setAttempt(value => value + 1);
    window.addEventListener('focus', reload); window.addEventListener('geraina-payment-options-changed', reload);
    return () => { window.removeEventListener('focus', reload); window.removeEventListener('geraina-payment-options-changed', reload); };
  }, []);
  return { options, error, retry: () => setAttempt(value => value + 1) };
}
