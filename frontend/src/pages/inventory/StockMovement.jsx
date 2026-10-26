import { useState } from 'react';
import usePagedReader from '@/hooks/usePagedReader';
import WorkspaceState from '@/components/WorkspaceState';
const labels={sale:'Penjualan',void:'Pembatalan',adjustment:'Penyesuaian',receiving:'Penerimaan PO',transfer_shipped:'Transfer dikirim',transfer_received:'Transfer diterima',transfer_cancelled:'Transfer dibatalkan',payment_declined:'Pembayaran ditolak',product_created:'Stok awal',product_updated:'Perubahan stok',sale_legacy:'Penjualan lama',void_legacy:'Pembatalan lama',adjustment_legacy:'Penyesuaian lama'};
export default function StockMovement(){
 const [search,setSearch]=useState(''),[q,setQ]=useState('');
 const query=usePagedReader('/inventory/movements',{q}),rows=query.data?.items||[];
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="stock-movement-page">
  <div><span className="label-tiny">Inventaris</span><h1 className="font-display text-3xl font-bold mt-1">Pergerakan stok</h1></div>
  <form className="flex gap-3" onSubmit={e=>{e.preventDefault();setQ(search.trim());}}><input className="input-field" placeholder="Cari produk atau referensi" aria-label="Cari pergerakan stok" value={search} onChange={e=>setSearch(e.target.value)}/><button className="btn-primary">Cari</button><button className="btn-outline" type="button" onClick={query.retry}>Segarkan</button></form>
  <WorkspaceState query={query}>{query.data?.history_note&&<p className="text-sm card-surface p-4">{query.data.history_note}</p>}
   <div className="card-surface p-4 overflow-x-auto"><table className="workspace-table w-full text-left text-sm"><thead><tr><th>Waktu toko</th><th>Produk</th><th>Perubahan</th><th>Jenis</th><th>Referensi</th><th>Cabang</th></tr></thead><tbody>
   {rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{new Date(row.created_at).toLocaleString('id-ID',{timeZone:query.data?.timezone||'Asia/Jakarta'})}</td><td>{row.product_name}{row.reconstructed&&<small className="block">Rekonstruksi catatan lama</small>}</td><td className="font-mono">{row.quantity>0?'+':''}{row.quantity}</td><td>{labels[row.kind]||row.kind}</td><td>{row.reference}</td><td>{row.branch_id==='main'?'Outlet utama':row.branch_id}</td></tr>)}</tbody></table>
   {!rows.length&&<p className="text-sm py-8 text-center" data-testid="movement-empty">Belum ada pergerakan stok yang sesuai.</p>}
   <div className="flex flex-wrap gap-3 mt-4 items-center"><span>{query.data?.total||0} catatan · halaman {query.page}</span><button className="btn-outline" disabled={!query.previous} onClick={query.previous}>Sebelumnya</button><button className="btn-outline" disabled={!query.next} onClick={query.next}>Berikutnya</button></div></div>
  </WorkspaceState></div>;
}
