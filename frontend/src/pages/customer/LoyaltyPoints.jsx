import {useEffect,useState} from 'react';
import api from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import WorkspaceState from '@/components/WorkspaceState';
export default function LoyaltyPoints(){
 const query=useWorkspace(['/customers/loyalty']),action=useAction(),config=query.data['/customers/loyalty'];
 const [rate,setRate]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{if(config)setRate(String(config.conversion_rate));},[config]);
 const submit=e=>{e.preventDefault();setSaved(false);action.run(()=>api.post('/customers/loyalty',{...config,conversion_rate:Number(rate)}),()=>{setSaved(true);query.retry();});};
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="loyalty-page"><div><span className="label-tiny">Pelanggan</span><h1 className="font-display text-3xl font-bold mt-1">Poin loyalitas</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}{saved&&<p role="status">Aturan poin tersimpan.</p>}
 <form onSubmit={submit} className="card-surface p-5 space-y-4 max-w-2xl"><label>Belanja untuk memperoleh 1 poin (Rp)<input required className="input-field mt-2" type="number" min="1" max="1000000000" step="1" value={rate} onChange={e=>{setRate(e.target.value);setSaved(false);}} data-testid="loyalty-conversion-rate"/></label>
 <p className="text-sm">Poin diberikan sekali setelah transaksi pelanggan berstatus Lunas. Pilih pelanggan di kasir. Penjualan tunai offline diproses saat tersinkron; pembatalan atau pengembalian pembayaran membalikkan poin yang diperoleh.</p>
 <button className="btn-primary" disabled={action.busy} data-testid="loyalty-save">{action.busy?'Menyimpan…':'Simpan aturan poin'}</button></form>
 <div className="card-surface p-5 text-sm max-w-2xl"><h2 className="font-bold mb-2">Penukaran poin</h2><p>Penukaran poin otomatis menjadi diskon belum tersedia di kasir. Aturan penukaran lama tetap disimpan dan tidak mengurangi tagihan secara otomatis.</p><p className="mt-2">Nilai tersimpan: Rp{config?.point_value} per poin · minimum {config?.min_redeem_points} poin.</p></div>
 </WorkspaceState></div>;
}
