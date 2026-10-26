import {Link} from 'react-router-dom';
import {useAuth} from '@/auth/AuthContext';
import {canAccessPath} from '@/auth/permissions';
import {isPlanLocked,minPlanForPath} from '@/navigation/sections';
import {fmtIDR} from '@/api/client';
import useWorkspace from '@/hooks/useWorkspace';
import WorkspaceState from '@/components/WorkspaceState';
const card='card-surface p-5';
function Metric({label,value}){return <div className={card}><p className="label-tiny">{label}</p><p className="font-display text-2xl font-bold mt-2">{value}</p></div>;}
export default function Dashboard(){
 const {user}=useAuth(),native=Boolean(window.__gerainaAndroid);
 const allowed=route=>canAccessPath(user?.role,'/geraina/app/'+route)&&!isPlanLocked(minPlanForPath('/geraina/app/'+route),user?.plan);
 const paths=native?[]:['/orders/stats','/orders/history?limit=5',...(allowed('inventory/overview')?['/products']:[]),...(allowed('debt/payable')?['/debt/receivables','/debt/payables']:[])];
 const query=useWorkspace(paths),stats=query.data['/orders/stats'];
 if(native)return <div key={`${user?.id}:${user?.store_id}:${user?.role}:${user?.plan}`} data-testid="dashboard-page" data-dashboard-stock={allowed('inventory/overview')} data-dashboard-reports={allowed('reports/sales')}/>;
 const recent=query.data['/orders/history?limit=5']?.items||[],products=query.data['/products']||[];
 const debt=path=>(query.data[path]||[]).reduce((sum,row)=>sum+row.amount-row.paid_amount,0);
 const days=stats?.daily_sales||[],max=Math.max(1,...days.map(day=>day.value));
 return <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="dashboard-page"><div className="flex flex-wrap justify-between gap-3"><div><p className="label-tiny">{stats?new Date(stats.today_date+'T12:00:00Z').toLocaleDateString('id-ID',{timeZone:'UTC',dateStyle:'full'}):'Ringkasan toko'}</p><h1 className="font-display text-3xl font-bold mt-1" data-testid="dashboard-greeting">{user?.store_name}</h1></div><button className="btn-outline" onClick={query.retry}>Segarkan</button></div>
 <WorkspaceState query={query}><div className="grid gap-4 sm:grid-cols-3"><Metric label="Penjualan lunas hari ini" value={fmtIDR(stats?.today_sales)}/><Metric label="Transaksi hari ini" value={stats?.today_orders}/><Metric label="Rata-rata transaksi" value={fmtIDR(stats?.today_orders?stats.today_sales/stats.today_orders:0)}/></div>
 <nav className="flex flex-wrap gap-3">{[['pos','Buka kasir'],['products','Produk'],['inventory/overview','Stok'],['reports/sales','Laporan'],['attendance','Absensi saya']].filter(([route])=>allowed(route)).map(([route,label])=><Link className="btn-outline" key={route} to={'/geraina/app/'+route}>{label}</Link>)}</nav>
 {allowed('inventory/overview')&&<div className="grid gap-4 sm:grid-cols-2"><Metric label="Stok menipis" value={products.filter(p=>p.stock<=5).length+' produk'}/><Metric label="Nilai persediaan saat ini" value={fmtIDR(products.reduce((sum,p)=>sum+p.stock*(p.cost||0),0))}/></div>}
 {allowed('debt/payable')&&<div className="grid gap-4 sm:grid-cols-2"><Metric label="Piutang belum dibayar" value={fmtIDR(debt('/debt/receivables'))}/><Metric label="Hutang belum dibayar" value={fmtIDR(debt('/debt/payables'))}/></div>}
 <section className={card}><h2 className="font-display text-lg font-bold mb-4">Penjualan 7 hari terakhir</h2><div className="flex gap-3 items-end h-40">{days.map(day=><div className="flex-1 min-w-0 text-center" key={day.date}><span className="block text-xs truncate">{fmtIDR(day.value)}</span><div className="bg-[hsl(var(--primary))] rounded-t mt-2" style={{height:Math.max(2,day.value/max*96)}}/><span className="text-xs">{new Date(day.date+'T12:00:00Z').toLocaleDateString('id-ID',{timeZone:'UTC',weekday:'short'})}</span></div>)}</div></section>
 <section className={card}><h2 className="font-display text-lg font-bold mb-4">Transaksi terbaru</h2>{recent.map(order=><Link key={order.id} className="flex justify-between gap-4 py-3 border-b text-sm" to={'/geraina/app/sales?order='+encodeURIComponent(order.id)}><span>{order.order_no} · {order.payment_status}</span><strong>{fmtIDR(order.total)}</strong></Link>)}{!recent.length&&<p>Belum ada transaksi.</p>}</section>
 </WorkspaceState></div>;
}
