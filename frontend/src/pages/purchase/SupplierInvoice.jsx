import {useState} from 'react';
import api,{fmtIDR} from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';
export default function SupplierInvoice(){
 const query=useWorkspace(['/purchase/invoices','/purchase/orders','/suppliers']),action=useAction(),table=useTablePage(query.data['/purchase/invoices']||[]);
 const [number,setNumber]=useState(''),[po,setPo]=useState(''),[supplier,setSupplier]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState('');
 const orders=query.data['/purchase/orders']||[],suppliers=query.data['/suppliers']||[];
 const create=e=>{e.preventDefault();action.run(()=>api.post('/purchase/invoices',{invoice_no:number.trim(),po_no:po,supplier_id:supplier||undefined,amount:Number(amount),due_date:date}),()=>{setNumber('');setPo('');setSupplier('');setAmount('');setDate('');query.retry();});};
 const pay=row=>{if(confirm('Tandai lunas hanya jika pembayaran faktur sudah dilakukan.'))action.run(()=>api.put('/purchase/invoices/'+row.id,{status:'Paid'}),query.retry);};
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="supplier-invoice-page"><div><span className="label-tiny">Pembelian</span><h1 className="font-display text-3xl font-bold mt-1">Faktur supplier</h1></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}
 <form onSubmit={create} className="card-surface p-5 grid gap-4 sm:grid-cols-2" data-testid="supplier-invoice-form">
 <label>Nomor faktur<input required maxLength={200} className="input-field mt-1" value={number} onChange={e=>setNumber(e.target.value)} data-testid="invoice-number"/></label>
 <label>PO (opsional)<select className="input-field mt-1" value={po} onChange={e=>{setPo(e.target.value);const selected=orders.find(row=>row.po_no===e.target.value);if(selected){setSupplier(selected.supplier_id);setAmount(String(selected.total));}}}><option value="">Faktur tanpa PO</option>{orders.map(row=><option key={row.id} value={row.po_no}>{row.po_no}</option>)}</select></label>
 <label>Supplier<select required={!po} className="input-field mt-1" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Pilih supplier</option>{suppliers.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
 <label>Jumlah tagihan<input required className="input-field mt-1" type="number" min="0.01" max="1000000000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} data-testid="invoice-amount"/></label>
 <label>Jatuh tempo<input required className="input-field mt-1" type="date" value={date} onChange={e=>setDate(e.target.value)} data-testid="invoice-due"/></label>
 <button className="btn-primary" disabled={action.busy}>Simpan faktur</button></form>
 <section className="card-surface p-5 overflow-x-auto"><table className="workspace-table w-full text-left text-sm"><thead><tr><th>Faktur</th><th>PO</th><th>Jumlah</th><th>Dibayar</th><th>Jatuh tempo</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{table.rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{row.invoice_no}</td><td>{row.po_no||'—'}</td><td>{fmtIDR(row.amount)}</td><td>{fmtIDR(row.paid_amount||0)}</td><td>{row.due_date}</td><td>{row.status}</td><td>{row.status!=='Paid'&&<button className="btn-primary" disabled={action.busy} onClick={()=>pay(row)}>Tandai lunas</button>}</td></tr>)}</tbody></table>{!table.count&&<p className="py-6">Belum ada faktur supplier.</p>}<TablePage label="faktur" value={table}/></section>
 </WorkspaceState></div>;
}
