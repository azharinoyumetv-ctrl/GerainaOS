import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Check, ClipboardCheck } from "lucide-react";

export default function GoodsReceiving() {
  const [orders, setOrders] = useState([]);
  const [receivings, setReceivings] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState("");

  const fetchData = () => {
    // Get POs that are not yet marked as Received
    api.get("/purchase/orders").then((r) => {
      const list = r.data || [];
      setOrders(list.filter(po => po.status === "Ordered"));
    }).catch(() => {});
    api.get("/purchase/receiving").then((r) => setReceivings(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReceive = (po) => {
    const payload = {
      po_no: po.po_no,
      gr_no: `GR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
      received_by: "Warehouse Manager",
      received_at: new Date().toISOString()
    };

    api.post("/purchase/receiving", payload).then(() => {
      // Also update the PO status to Received
      // Wait, mockDb does this, but let's notify the user
      fetchData();
      alert(`Barang masuk dari PO ${po.po_no} berhasil diterima dan stok ditambahkan!`);
    });
  };

  return (
    <div className="p-8 space-y-6" data-testid="goods-receiving-page">
      <div>
        <span className="label-tiny">Pembelian</span>
        <h1 className="font-display text-3xl font-bold mt-1">Penerimaan Barang</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Penerimaan Barang Pending</h2>
          <div className="space-y-3">
            {orders.map((po) => (
              <div key={po.id} className="border border-[hsl(var(--border))] rounded-lg p-4 flex flex-col justify-between hover:border-[hsl(var(--primary))] transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold text-[hsl(var(--primary))]">{po.po_no}</span>
                    <p className="text-sm font-semibold mt-1">{po.supplier_name}</p>
                  </div>
                  <span className="text-xs font-mono font-bold">{fmtIDR(po.total)}</span>
                </div>
                <div className="border-t border-[hsl(var(--border))]/50 pt-2 mt-3 flex justify-between items-center">
                  <span className="text-[10px] text-[hsl(var(--muted))]">Tgl PO: {new Date(po.created_at).toLocaleDateString("id-ID")}</span>
                  <button onClick={() => handleReceive(po)} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold">
                    <ClipboardCheck size={14} /> Terima Barang
                  </button>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted))] text-center py-8">Tidak ada penerimaan PO tertunda.</p>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 card-surface p-6" data-testid="receiving-list">
          <h2 className="font-display font-bold text-lg mb-4">Riwayat Penerimaan Barang</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Penerimaan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No PO</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal Masuk</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Petugas</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {receivings.map((r) => (
                  <tr key={r.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-mono font-semibold text-xs text-[hsl(var(--primary))]">{r.gr_no}</td>
                    <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">{r.po_no}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))]">{new Date(r.received_at).toLocaleString("id-ID")}</td>
                    <td className="py-3 text-xs">{r.received_by}</td>
                    <td className="py-3 text-right">
                      <span className="pill pill-success flex items-center gap-0.5 justify-end w-20 ml-auto">
                        <Check size={10} /> Diterima
                      </span>
                    </td>
                  </tr>
                ))}
                {receivings.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada riwayat penerimaan barang.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
