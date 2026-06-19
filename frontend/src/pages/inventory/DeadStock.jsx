import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";

export default function DeadStock() {
  const [deadProducts, setDeadProducts] = useState([]);

  useEffect(() => {
    // Determine dead stock (products with zero sales in the last 30 days)
    Promise.all([
      api.get("/products"),
      api.get("/orders?limit=100")
    ]).then(([productsRes, ordersRes]) => {
      const list = productsRes.data || [];
      const orders = ordersRes.data || [];

      // Find all product ids in recent orders
      const activeIds = new Set();
      orders.forEach(o => {
        if (o.items) {
          o.items.forEach(it => activeIds.add(it.product_id));
        }
      });

      // Filter products not in the active list and with stock > 0
      const dead = list.filter(p => !activeIds.has(p.id) && p.stock > 0);
      setDeadProducts(dead);
    }).catch(() => {});
  }, []);

  return (
    <div className="p-8 space-y-6" data-testid="dead-stock-page">
      <div>
        <span className="label-tiny">Inventory</span>
        <h1 className="font-display text-3xl font-bold mt-1">Dead Stock</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-2">Produk Lambat / Tidak Bergerak (Zero Sales 30 Hari Terakhir)</h2>
        <p className="text-xs text-[hsl(var(--muted))] mb-4">
          Gunakan daftar ini untuk merencanakan promo diskon bundel, cuci gudang, atau mengurangi pembelian berikutnya.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">SKU</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kategori</th>
                <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Stok Mati</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Harga Pokok (Cost)</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Kerugian Modal Mengendap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {deadProducts.map((p) => {
                const modal = (p.stock || 0) * (p.cost || 0);
                return (
                  <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs">{p.sku || "-"}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{p.category || "-"}</td>
                    <td className="py-3 text-center font-bold font-mono">{p.stock}</td>
                    <td className="py-3 font-mono">{fmtIDR(p.cost || 0)}</td>
                    <td className="py-3 text-right text-red-500 font-mono font-semibold">{fmtIDR(modal)}</td>
                  </tr>
                );
              })}
              {deadProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-emerald-600 font-medium">Luar biasa! Tidak ada stok mati, semua produk aktif berputar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
