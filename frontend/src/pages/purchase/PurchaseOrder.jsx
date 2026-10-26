import { useRef,useState } from 'react';
import api,{fmtIDR} from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';

export function PurchaseLineEditor({products,items,onChange}){
 const [product,setProduct]=useState(''),[qty,setQty]=useState(''),[cost,setCost]=useState(''),[error,setError]=useState('');
 const add=()=>{
  if(!product||!Number.isInteger(Number(qty))||Number(qty)<1||cost===''||!Number.isFinite(Number(cost))||Number(cost)<0){setError('Pilih produk, jumlah bulat positif dan harga beli yang valid.');return;}
  if(items.some(line=>line.product_id===product)){setError('Produk sudah ada. Hapus baris untuk mengganti jumlah atau harga.');return;}
  const selected=products.find(p=>p.id===product);if(!selected)return;
  onChange([...items,{product_id:product,name:selected.name,qty:Number(qty),cost:Number(cost)}]);setProduct('');setQty('');setCost('');setError('');
 };
 return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-3">
  <label>Produk<select className="input-field mt-1" value={product} onChange={e=>setProduct(e.target.value)} data-testid="po-product-select"><option value="">Pilih produk</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <label>Jumlah<input className="input-field mt-1" type="number" min="1" max="100000" step="1" value={qty} onChange={e=>setQty(e.target.value)} data-testid="po-qty-input"/></label>
  <label>Harga beli per unit<input className="input-field mt-1" type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} data-testid="po-cost-input"/></label>
 </div><button className="btn-outline" type="button" onClick={add} data-testid="po-add-item">Tambah rincian</button>{error&&<p role="alert" className="text-red-800">{error}</p>}
 <div className="overflow-x-auto"><table className="workspace-table w-full text-sm text-left"><thead><tr><th>Produk</th><th>Jumlah</th><th>Harga beli</th><th>Subtotal</th><th>Aksi</th></tr></thead><tbody>{items.map(line=><tr key={line.product_id} className="border-t"><td className="py-3">{line.name}</td><td>{line.qty}</td><td>{fmtIDR(line.cost)}</td><td>{fmtIDR(line.qty*line.cost)}</td><td><button className="btn-outline" type="button" onClick={()=>onChange(items.filter(it=>it.product_id!==line.product_id))}>Hapus</button></td></tr>)}</tbody></table></div></div>;
}

export default function PurchaseOrder(){
 const query=useWorkspace(['/suppliers','/products','/purchase/orders']),action=useAction();
 const products=query.data['/products']||[],suppliers=query.data['/suppliers']||[],table=useTablePage(query.data['/purchase/orders']||[]);
 const [supplier,setSupplier]=useState(''),[number,setNumber]=useState(''),[items,setItems]=useState([]),reference=useRef(null);
 const total=Math.round(items.reduce((sum,line)=>sum+line.qty*line.cost,0)*100)/100;
 const submit=e=>{e.preventDefault();if(!items.length)return;
  if(!reference.current)reference.current='PO-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
  const body={po_no:number.trim()||reference.current,supplier_id:supplier,total,items};
  action.run(()=>api.post('/purchase/orders',body),()=>{reference.current=null;setItems([]);setNumber('');setSupplier('');query.retry();});};
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="purchase-order-page"><div><span className="label-tiny">Pembelian</span><h1 className="font-display text-3xl font-bold mt-1">Pesanan pembelian</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}
 <form onSubmit={submit} className="card-surface p-5 space-y-4" data-testid="purchase-order-form"><div className="grid gap-4 sm:grid-cols-2">
 <label>Supplier<select required className="input-field mt-1" value={supplier} onChange={e=>setSupplier(e.target.value)} data-testid="po-supplier-select"><option value="">Pilih supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label>Nomor PO (opsional)<input maxLength={200} className="input-field mt-1" placeholder="Dibuat otomatis jika kosong" value={number} onChange={e=>setNumber(e.target.value)} data-testid="po-number-input"/></label></div>
 <PurchaseLineEditor products={products} items={items} onChange={setItems}/><p className="font-bold">Total {fmtIDR(total)}</p><button className="btn-primary" disabled={action.busy||!items.length} data-testid="po-create-btn">{action.busy?'Menyimpan…':'Buat PO'}</button></form>
 <div className="card-surface p-5 overflow-x-auto" data-testid="purchase-order-list"><table className="workspace-table w-full text-sm text-left"><thead><tr><th>Nomor PO</th><th>Supplier</th><th>Total</th><th>Status</th><th>Rincian</th></tr></thead><tbody>{table.rows.map(row=><tr className="border-t" key={row.id}><td className="py-3">{row.po_no}</td><td>{row.supplier_name}</td><td>{fmtIDR(row.total)}</td><td>{row.status}</td><td>{row.items?.length?<details><summary>Lihat produk</summary>{row.items.map((line,i)=><p key={line.product_id||i}>{line.name} · {line.qty??line.quantity} · diterima {line.received_qty||0}</p>)}</details>:<a className="underline" href="/geraina/app/purchase/receiving">Lengkapi rincian PO lama</a>}</td></tr>)}</tbody></table>{!table.count&&<p className="py-6">Belum ada pesanan pembelian.</p>}<TablePage label="PO" value={table}/></div>
 </WorkspaceState></div>;
}
