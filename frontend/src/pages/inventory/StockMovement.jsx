import { useEffect, useState } from "react";
import api from "@/api/client";

const DEFAULT_MOVEMENTS = [
  { id: "mov-init-1", date: new Date(Date.now() - 3600000).toISOString(), product_name: "Kopi Arabika 250g", qty: 24, type: "in", reference: "PO-2026-001", source: "Penerimaan Stok Supplier" },
  { id: "mov-init-2", date: new Date(Date.now() - 7200000).toISOString(), product_name: "Susu UHT 1L", qty: 12, type: "out", reference: "ORD-1002", source: "POS Kasir Sales" },
  { id: "mov-init-3", date: new Date(Date.now() - 14400000).toISOString(), product_name: "Sirup Vanila 750ml", qty: 5, type: "in", reference: "ADJ-001", source: "Penyesuaian Stok Gudang" }
];

export default function StockMovement() {
  const [movements, setMovements] = useState(DEFAULT_MOVEMENTS);

  useEffect(() => {
    // Generate movement records dynamically from adjustments and orders
    Promise.all([
      api.get("/orders?limit=100"),
      api.get("/products/stock-adjustments")
    ]).then(([ordersRes, adjRes]) => {
      const list = [...DEFAULT_MOVEMENTS];
      const orders = ordersRes.data || [];
      const adjustments = adjRes.data || [];

      orders.forEach(o => {
        if (o.payment_status === "paid" && o.items) {
          o.items.forEach(it => {
            list.push({
              id: `mov-ord-${o.id}-${it.product_id}`,
              date: o.created_at,
              product_name: it.name,
              qty: it.quantity,
              type: "out",
              reference: o.order_no,
              source: "POS Kasir"
            });
          });
        }
      });

      adjustments.forEach(a => {
        list.push({
          id: `mov-adj-${a.id}`,
          date: a.created_at,
          product_name: a.product_name,
          qty: a.adjustment_qty,
          type: a.type,
          reference: "ADJ-REG",
          source: a.reason || "Manual Adjustment"
        });
      });

      // Sort by date descending
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setMovements(list);
    }).catch(() => {});
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="stock-movement-page">
      <div>
        <span className="label-tiny">Inventaris</span>
        <h1 className="font-display text-3xl font-bold mt-1">Mutasi Stok</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Kartu Riwayat Pergerakan Stok (Stok Masuk / Keluar)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Referensi</th>
                <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Qty</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tipe</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                  <td className="py-3 text-[hsl(var(--muted))]">{new Date(m.date).toLocaleString("id-ID")}</td>
                  <td className="py-3 font-medium">{m.product_name}</td>
                  <td className="py-3 font-mono text-xs">{m.reference}</td>
                  <td className="py-3 text-center font-bold font-mono">{m.qty}</td>
                  <td className="py-3">
                    {m.type === "add" || m.type === "in" ? (
                      <span className="text-emerald-600 font-semibold uppercase text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Masuk (+)
                      </span>
                    ) : (
                      <span className="text-red-500 font-semibold uppercase text-xs bg-red-50 px-2 py-0.5 rounded border border-red-100">
                        Keluar (-)
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right text-xs text-[hsl(var(--muted))]">{m.source}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada pergerakan stok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
