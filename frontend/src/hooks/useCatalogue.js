import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { loadCatalogue } from '@/api/catalogue';
const EMPTY = [];

export default function useCatalogue() {
  const { user } = useAuth();
  const identity = `${user?.id}:${user?.store_id}`;
  const [read, setRead] = useState({ identity: '', products: EMPTY, loading: true, error: '' }), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setRead({ identity, products: EMPTY, loading: true, error: '' });
    loadCatalogue({ signal: controller.signal }).then(data => { if (active) setRead({ identity, products: data, loading: false, error: '' }); })
      .catch(() => { if (active) setRead({ identity, products: EMPTY, loading: false, error: 'Data stok belum dapat dimuat. Periksa koneksi dan coba lagi.' }); });
    return () => { active = false; controller.abort(); };
  }, [identity, attempt]);
  return { products: read.identity === identity ? read.products : EMPTY, loading: read.identity !== identity || read.loading,
    error: read.identity === identity ? read.error : '', retry: () => setAttempt(value => value + 1) };
}
