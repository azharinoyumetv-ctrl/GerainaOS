import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';

export default function useAction() {
  const { user } = useAuth();
  const actor = `${user?.id}:${user?.store_id}`;
  const active = useRef(actor); active.current = actor;
  const lock = useRef(false), mounted = useRef(true);
  const [state,setState] = useState({ actor, busy:false, error:'' });
  useEffect(()=>{ mounted.current=true; return ()=>{ mounted.current=false; }; },[]);
  const run = useCallback(async (operation,onSuccess)=>{
    if (lock.current) return;
    lock.current=true;
    const identity=active.current;
    setState({ actor:identity,busy:true,error:'' });
    try {
      const result=await operation();
      if (mounted.current && active.current===identity) onSuccess?.(result);
    } catch (error) {
      const detail=error?.response?.data?.detail;
      if (mounted.current && active.current===identity) setState({ actor:identity,busy:false,
        error:typeof detail==='string'?detail:!error?.isAxiosError && error?.message ? error.message : 'Perubahan belum tersimpan. Periksa data dan koneksi lalu coba lagi.' });
    } finally {
      lock.current=false;
      if (mounted.current && active.current===identity) setState(value=>({...value,busy:false}));
    }
  },[]);
  return { run,busy:state.actor===actor && state.busy,error:state.actor===actor?state.error:'' };
}
