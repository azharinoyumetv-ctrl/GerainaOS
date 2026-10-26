import { useRef,useState } from 'react';
import api from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';
export default function StockAdjustment(){
 const query=useWorkspace(['/products','/products/stock-adjustments']),action=useAction();
 const products=query.data['/products']||[],table=useTablePage(query.data['/products/stock-adjustments']||[]);
 const [productId,setProductId]=useState(''),[qty,setQty]=useState(''),[type,setType]=useState('add'),[reason,setReason]=useState(''),attempt=useRef(null);
 const submit=e=>{e.preventDefault();const body={product_id:productId,adjustment_qty:Number(qty),type,reason:reason.trim()},signature=JSON.stringify(body);
  if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
  action.run(()=>api.post('/products/stock-adjustments',{...body,request_id:attempt.current.key}),()=>{attempt.current=null;setProductId('');setQty('');setReason('');query.retry();});};
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="stock-adjustment-page"><div><span className="label-tiny">Produk</span><h1 className="font-display text-3xl font-bold mt-1">Penyesuaian stok</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}
 <form onSubmit={submit} className="card-surface p-5 grid gap-4 sm:grid-cols-2" data-testid="adjustment-form">
 <label>Produk<select required className="input-field mt-1" value={productId} onChange={e=>setProductId(e.target.value)} data-testid="adjustment-product-select"><option value="">Pilih produk</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · stok {p.stock}</option>)}</select></label>
 <label>Jenis<select className="input-field mt-1" value={type} onChange={e=>setType(e.target.value)} data-testid="adjustment-type-select"><option value="add">Tambah stok</option><option value="sub">Kurangi stok</option></select></label>
 <label>Jumlah<input required type="number" min="1" max="100000" step="1" className="input-field mt-1" value={qty} onChange={e=>setQty(e.target.value)} data-testid="adjustment-qty-input"/></label>
 <label>Alasan<input required maxLength={1000} className="input-field mt-1" value={reason} onChange={e=>setReason(e.target.value)} data-testid="adjustment-reason-input"/></label>
 <button className="btn-primary" disabled={action.busy} data-testid="adjustment-submit">{action.busy?'Menyimpan…':'Simpan penyesuaian'}</button></form>
 <div className="card-surface p-5 overflow-x-auto" data-testid="adjustment-list"><table className="workspace-table w-full text-sm text-left"><thead><tr><th>Tanggal</th><th>Produk</th><th>Jumlah</th><th>Alasan</th><th>Petugas</th></tr></thead><tbody>{table.rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{new Date(row.created_at).toLocaleDateString('id-ID')}</td><td>{row.product_name}</td><td>{row.type==='add'?'+':'−'}{row.adjustment_qty}</td><td>{row.reason}</td><td>{row.created_by}</td></tr>)}</tbody></table>{!table.count&&<p className="py-6">Belum ada penyesuaian stok.</p>}<TablePage label="catatan" value={table}/></div>
 </WorkspaceState></div>;
}
