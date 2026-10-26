import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import api from '@/api/client';
export default function usePagedReader(endpoint, filters = {}) {
  const { user } = useAuth();
  const identity = `${user?.id}:${user?.store_id}:${endpoint}:${JSON.stringify(filters)}`;
  const [page,setPage] = useState({ identity:null,cursor:null,previous:[],index:0 });
  const current = page.identity===identity?page:{ identity,cursor:null,previous:[],index:0 };
  const key=identity+':'+(current.cursor||'');
  const [attempt,setAttempt]=useState(0),[read,setRead]=useState({key:null,loading:true,error:'',data:null});
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setRead({key,loading:true,error:'',data:null});
    api.get(endpoint,{timeout:15000,signal:controller.signal,params:{...filters,limit:50,cursor:current.cursor}}).then(({data})=>{
      if(!Array.isArray(data?.items)||!Number.isInteger(data.total)||data.total<0||!(data.next_cursor===null||(typeof data.next_cursor==='string'&&data.next_cursor)))throw new Error('Invalid page');
      if(active)setRead({key,loading:false,error:'',data});
    }).catch(()=>{if(active)setRead({key,loading:false,error:'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.',data:null});});
    return()=>{active=false;controller.abort();};
  },[key,attempt]);
  const data=read.key===key?read.data:null;
  return {data,loading:read.key!==key||read.loading,error:read.key===key?read.error:'',retry:()=>setAttempt(v=>v+1),page:current.index+1,
    previous:current.previous.length?()=>setPage({identity,cursor:current.previous.at(-1),previous:current.previous.slice(0,-1),index:current.index-1}):null,
    next:data?.next_cursor?()=>setPage({identity,cursor:data.next_cursor,previous:[...current.previous,current.cursor],index:current.index+1}):null};
}
