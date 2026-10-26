import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { readCollection } from '@/api/records';

// A workspace publishes data only when every required read succeeds. Failed or
// superseded requests never look like a valid empty business dataset.
export default function useWorkspace(paths) {
  const { user } = useAuth();
  const actor = `${user?.id}:${user?.store_id}`;
  const definition = JSON.stringify(paths);
  const key = actor+':'+definition;
  const [attempt,setAttempt] = useState(0);
  const [read,setRead] = useState({ key:null, loading:true, error:'', data:{} });
  useEffect(()=>{
    const controller = new AbortController(); let active = true;
    setRead({ key, loading:true, error:'', data:{} });
    const paths = JSON.parse(definition);
    Promise.all(paths.map(path=>readCollection(path,{ signal:controller.signal }))).then(results=>{
      if (active) setRead({ key, loading:false, error:'', data:Object.fromEntries(paths.map((path,i)=>[path,results[i].data])) });
    }).catch(()=>{
      if (active) setRead({ key, loading:false, error:'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.', data:{} });
    });
    return ()=>{ active=false; controller.abort(); };
  },[key,definition,attempt]);
  return {
    data:read.key === key ? read.data : {},
    loading:read.key !== key || read.loading,
    error:read.key === key ? read.error : '',
    retry:useCallback(()=>setAttempt(value=>value+1),[]),
  };
}
