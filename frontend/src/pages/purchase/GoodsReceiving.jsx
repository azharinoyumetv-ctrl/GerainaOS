import { useMemo,useRef,useState } from 'react';
import api,{fmtIDR} from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';
import {PurchaseLineEditor} from './PurchaseOrder';
function ReceiptForm({po,onReceive,busy}){
 const [amounts,setAmounts]=useState({});
 const lines=po.items||[],remaining=line=>(line.qty??line.quantity)-(line.received_qty||0);
 return <form onSubmit={e=>{e.preventDefault();const items=lines.map(line=>({product_id:line.product_id,qty:Number(amounts[line.product_id]??remaining(line))})).filter(line=>line.qty>0);if(items.length)onReceive(po,items);}} className="space-y-3">
 {lines.filter(line=>remaining(line)>0).map(line=><label key={line.product_id} className="flex flex-wrap items-center gap-3 text-sm">{line.name} · sisa {remaining(line)}<input aria-label={'Jumlah diterima '+line.name} className="input-field max-w-36" type="number" min="0" max={remaining(line)} step="1" value={amounts[line.product_id]??remaining(line)} onChange={e=>setAmounts({...amounts,[line.product_id]:e.target.value})}/></label>)}
 <button className="btn-primary" disabled={busy}>{busy?'Menyimpan…':'Terima Barang'}</button></form>;
}
function Repair({po,products,onSave,busy}){
 const [items,setItems]=useState([]);
 return <div className="space-y-3"><p className="text-sm">PO lama ini tidak menyimpan produk dan jumlah. Isi ulang dari dokumen pembelian asli; stok belum berubah.</p><PurchaseLineEditor products={products} items={items} onChange={setItems}/><button className="btn-primary" disabled={busy||!items.length} onClick={()=>onSave(po,items)}>Simpan rincian PO</button></div>;
}
export default function GoodsReceiving(){
 const query=useWorkspace(['/purchase/orders','/purchase/receiving','/products']),action=useAction(),attempts=useRef(new Map());
 const pending=useMemo(()=>(query.data['/purchase/orders']||[]).filter(po=>['Ordered','Partial'].includes(po.status)),[query.data['/purchase/orders']]);
 const orders=useTablePage(pending),history=useTablePage(query.data['/purchase/receiving']||[]);
 const receive=(po,items)=>{const signature=JSON.stringify(items),previous=attempts.current.get(po.id);
  if(previous?.signature!==signature)attempts.current.set(po.id,{signature,key:crypto.randomUUID()});
  action.run(()=>api.post('/purchase/receiving',{po_no:po.po_no,items,request_id:attempts.current.get(po.id).key}),()=>{attempts.current.delete(po.id);query.retry();});};
 const repair=(po,items)=>action.run(()=>api.put('/purchase/orders/'+po.id+'/items',items),query.retry);
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="goods-receiving-page"><div><span className="label-tiny">Pembelian</span><h1 className="font-display text-3xl font-bold mt-1">Penerimaan barang</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}
 <section className="space-y-4" data-testid="receiving-pending"><h2 className="font-display text-xl font-bold">PO yang belum diterima penuh</h2>{orders.rows.map(po=><article className="card-surface p-5 space-y-3" key={po.id}><h3 className="font-bold">{po.po_no} · {po.supplier_name}</h3><p>{fmtIDR(po.total)} · {po.status}</p>{po.items?.length?<ReceiptForm po={po} onReceive={receive} busy={action.busy}/>:<Repair po={po} products={query.data['/products']||[]} onSave={repair} busy={action.busy}/>}</article>)}{!orders.count&&<p>Tidak ada penerimaan PO tertunda.</p>}<TablePage label="PO" value={orders}/></section>
 <section className="card-surface p-5 overflow-x-auto" data-testid="receiving-list"><h2 className="font-display text-xl font-bold mb-4">Riwayat penerimaan barang</h2><table className="workspace-table w-full text-left text-sm"><thead><tr><th>No penerimaan</th><th>No PO</th><th>Petugas</th><th>Rincian</th></tr></thead><tbody>{history.rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{row.gr_no}</td><td>{row.po_no}</td><td>{row.received_by}</td><td>{row.inventory_applied?row.items.map((line,i)=><p key={line.product_id||i}>{line.name} · +{line.qty}</p>):'Catatan lama; tidak memperbarui stok'}</td></tr>)}</tbody></table>{!history.count&&<p className="py-6">Belum ada riwayat penerimaan barang.</p>}<TablePage label="penerimaan" value={history}/></section>
 </WorkspaceState></div>;
}
