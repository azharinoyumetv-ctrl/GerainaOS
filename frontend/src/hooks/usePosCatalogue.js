import { useEffect, useRef, useState } from 'react';
import api from '@/api/client';
import { loadCatalogue } from '@/api/catalogue';
import { cached, cache } from '@/offline/posStore';

export default function usePosCatalogue(scope, offline, online) {
  const [products, setProducts] = useState([]), [snapshot, setSnapshot] = useState(null);
  const [complete, setComplete] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [progress, setProgress] = useState(null), [attempt, setAttempt] = useState(0);
  const currentScope = useRef(scope); currentScope.current = scope;
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setProducts([]); setSnapshot(null); setComplete(false); setLoading(true); setError(''); setProgress(null);
    (async () => {
      if (offline) {
        const saved = await cached(scope, 'products').catch(() => null);
        if (active && saved && Array.isArray(saved.data)) { setProducts(saved.data.filter(p => p.active !== false)); setSnapshot(saved.savedAt); setComplete(saved.complete === true); }
      }
      if (!active) return;
      if (!online) { setLoading(false); return; }
      try {
        const data = await loadCatalogue({ signal: controller.signal, activeOnly: true, onProgress: value => { if (active) setProgress(value); } });
        if (!active) return;
        if (offline) await cache(scope, 'products', data, { complete: true, count: data.length });
        if (active) { setProducts(data); setComplete(true); setSnapshot(new Date().toISOString()); }
      } catch (requestError) { if (active) setError(requestError.message || 'Katalog belum dapat dimuat. Coba lagi.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [scope, offline, online, attempt]);
  const findProduct = async code => {
    const local = products.find(p => p.active !== false && (p.id === code || p.sku?.toLowerCase() === code.toLowerCase()));
    // Query the authoritative store for online scans, including duplicate/inactive SKUs.
    if (navigator.onLine) {
      const actor = currentScope.current;
      try {
        const { data } = await api.get('/products/lookup', { timeout: 12000, params: { code } });
        return actor === currentScope.current ? data : null;
      } catch (error) {
        if (actor !== currentScope.current) return null;
        if (local && (!error.response || error.response.status >= 500)) return local;
        throw error;
      }
    }
    if (local) return local;
    throw new Error(complete ? 'Barcode tidak ditemukan dalam katalog offline. Perbarui katalog saat online.' : 'Katalog offline lama belum lengkap. Hubungkan internet dan muat ulang katalog.');
  };
  return { products, setProducts, snapshot, complete, loading, error, progress, findProduct, refresh: () => setAttempt(value => value + 1) };
}
