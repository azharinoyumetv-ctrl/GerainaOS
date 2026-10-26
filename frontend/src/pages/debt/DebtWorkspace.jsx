import {useState} from 'react';
import api,{fmtIDR} from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import useAction from '@/hooks/useAction';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import WorkspaceState from '@/components/WorkspaceState';
export default function DebtWorkspace({payable=false}){
 const path=payable?'/debt/payables':'/debt/receivables',query=useWorkspace([path]),action=useAction(),table=useTablePage(query.data[path]||[]);
 const [name,setName]=useState(''),[reference,setReference]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(''),[phone,setPhone]=useState('');
 const [paying,setPaying]=useState(null),[payment,setPayment]=useState('');
 const create=e=>{e.preventDefault();const body={amount:Number(amount),paid_amount:0,due_date:date,status:'Unpaid',
  ...(payable?{supplier_name:name.trim(),invoice_no:reference.trim()}:{customer_name:name.trim(),order_no:reference.trim(),phone:phone||undefined})};
  action.run(()=>api.post(path,body),()=>{setName('');setReference('');setAmount('');setDate('');setPhone('');query.retry();});};
 const settle=e=>{e.preventDefault();const paid=Math.round((paying.paid_amount+Number(payment))*100)/100;
  action.run(()=>api.put(path+'/'+paying.id,{paid_amount:paid,expected_paid_amount:paying.paid_amount,status:paid===paying.amount?'Paid':'Partial'}),()=>{setPaying(null);setPayment('');query.retry();});};
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid={payable?'accounts-payable-page':'accounts-receivable-page'}><div className="flex flex-wrap justify-between gap-3"><div><span className="label-tiny">Keuangan</span><h1 className="font-display text-3xl font-bold mt-1">{payable?'Hutang supplier':'Piutang pelanggan'}</h1></div><button className="btn-outline" onClick={()=>{setPaying(null);query.retry();}}>Segarkan</button></div>
 <WorkspaceState query={query}>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}
 <form onSubmit={create} className="card-surface p-5 grid gap-4 sm:grid-cols-2">
 <label>{payable?'Nama supplier':'Nama pelanggan'}<input required className="input-field mt-1" value={name} onChange={e=>setName(e.target.value)} data-testid="debt-name"/></label>
 <label>{payable?'Nomor faktur':'Nomor order'}<input required className="input-field mt-1" value={reference} onChange={e=>setReference(e.target.value)} data-testid="debt-reference"/></label>
 {!payable&&<label>Telepon<input className="input-field mt-1" value={phone} onChange={e=>setPhone(e.target.value)}/></label>}
 <label>Jumlah tagihan<input required className="input-field mt-1" type="number" min="0.01" max="1000000000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} data-testid="debt-amount"/></label>
 <label>Jatuh tempo<input required className="input-field mt-1" type="date" value={date} onChange={e=>setDate(e.target.value)} data-testid="debt-due"/></label>
 <button className="btn-primary" disabled={action.busy} data-testid="debt-create">{action.busy?'Menyimpan…':'Catat tagihan'}</button></form>
 <section className="card-surface p-5 overflow-x-auto"><table className="workspace-table w-full text-left text-sm"><thead><tr><th>{payable?'Supplier':'Pelanggan'}</th><th>Referensi</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{table.rows.map(row=><tr key={row.id} className="border-t"><td className="py-3">{payable?row.supplier_name:row.customer_name}</td><td>{payable?row.invoice_no:row.order_no}</td><td>{fmtIDR(row.amount)}</td><td>{fmtIDR(row.paid_amount)}</td><td>{fmtIDR(row.amount-row.paid_amount)}</td><td>{row.status}</td><td>{row.paid_amount<row.amount&&<button className="btn-primary" disabled={action.busy} onClick={()=>{setPaying(row);setPayment('');}} data-testid={'pay-debt-'+row.id}>Catat pembayaran</button>}</td></tr>)}</tbody></table>{!table.count&&<p className="py-6">Belum ada tagihan.</p>}<TablePage label="tagihan" value={table}/></section>
 {paying&&<div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4"><form onSubmit={settle} className="card-surface bg-white p-6 max-w-md w-full space-y-4" data-testid="debt-payment-dialog"><h2 className="font-display text-xl">Catat pembayaran</h2><p>Sisa tagihan {fmtIDR(paying.amount-paying.paid_amount)}. Pencatatan ini tidak mentransfer dana.</p><label>Nominal dibayar sekarang<input required className="input-field mt-1" type="number" min="0.01" max={paying.amount-paying.paid_amount} step="0.01" value={payment} onChange={e=>setPayment(e.target.value)} data-testid="debt-payment-amount"/></label><div className="flex gap-3"><button type="button" className="btn-outline" onClick={()=>setPaying(null)}>Batal</button><button className="btn-primary" disabled={action.busy} data-testid="debt-payment-save">Simpan pembayaran</button></div>{action.error&&<p role="alert" className="text-red-800">{action.error}</p>}</form></div>}
 </WorkspaceState></div>;
}
