import { useRef,useState } from 'react';
import api from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';
export default function StockTransfer(){
 const query=useWorkspace(['/products','/inventory/branches','/products/stock-transfers']),action=useAction();
 const products=query.data['/products']||[],branches=query.data['/inventory/branches']||[],table=useTablePage(query.data['/products/stock-transfers']||[]);
 const [from,setFrom]=useState('main'),[to,setTo]=useState(''),[productId,setProductId]=useState(''),[qty,setQty]=useState(''),attempt=useRef(null);
 const submit=e=>{e.preventDefault();const body={from_branch:from,to_branch:to,items:[{product_id:productId,qty:Number(qty)}]},signature=JSON.stringify(body);
  if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
  action.run(()=>api.post('/products/stock-transfers',{...body,request_id:attempt.current.key}),()=>{attempt.current=null;setProductId('');setQty('');query.retry();});};
 const finish=(id,name)=>action.run(()=>api.post(`/products/stock-transfers/${id}/${name}`),query.retry);
 const available=p=>from==='main'?p.stock||0:p.stock_by_branch?.[from]||0;
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="stock-transfer-page"><div><span className="label-tiny">Produk</span><h1 className="font-display text-3xl font-bold mt-1">Transfer antar cabang</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}<p className="text-sm">Pengiriman mengurangi stok cabang asal. Stok tujuan bertambah saat barang dikonfirmasi diterima.</p>
 <form onSubmit={submit} className="card-surface p-5 grid gap-4 sm:grid-cols-2" data-testid="transfer-form">
 <label>Dari cabang<select required className="input-field mt-1" value={from} onChange={e=>setFrom(e.target.value)} data-testid="transfer-source-select">{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
 <label>Ke cabang<select required className="input-field mt-1" value={to} onChange={e=>setTo(e.target.value)} data-testid="transfer-dest-select"><option value="">Pilih tujuan</option>{branches.filter(b=>b.id!==from).map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
 <label>Produk<select required className="input-field mt-1" value={productId} onChange={e=>setProductId(e.target.value)} data-testid="transfer-product-select"><option value="">Pilih produk</option>{products.map(p=><option value={p.id} key={p.id}>{p.name} · stok asal {available(p)}</option>)}</select></label>
 <label>Jumlah<input required className="input-field mt-1" type="number" min="1" max="100000" step="1" value={qty} onChange={e=>setQty(e.target.value)} data-testid="transfer-qty-input"/></label>
 <button className="btn-primary" disabled={action.busy} data-testid="transfer-submit">{action.busy?'Menyimpan…':'Kirim barang'}</button></form>
 <div className="card-surface p-5 overflow-x-auto" data-testid="transfer-list"><table className="workspace-table w-full text-left text-sm"><thead><tr><th>Tanggal</th><th>Dari</th><th>Ke</th><th>Produk</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{table.rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{new Date(row.created_at).toLocaleDateString('id-ID')}</td><td>{row.from_branch}</td><td>{row.to_branch}</td><td>{row.items.map((it,i)=><p key={it.product_id||i}>{it.name} · {it.qty}</p>)}</td><td>{row.status}{!row.inventory_applied&&<small className="block">Catatan lama; tidak mengubah stok</small>}</td><td>{row.status==='Shipped'&&row.inventory_applied&&<div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={action.busy} onClick={()=>finish(row.id,'receive')} data-testid={`receive-transfer-${row.id}`}>Terima barang</button><button className="btn-outline" disabled={action.busy} onClick={()=>finish(row.id,'cancel')}>Batalkan pengiriman</button></div>}</td></tr>)}</tbody></table>{!table.count&&<p className="py-6">Belum ada transfer antar cabang.</p>}<TablePage label="transfer" value={table}/></div>
 </WorkspaceState></div>;
}
