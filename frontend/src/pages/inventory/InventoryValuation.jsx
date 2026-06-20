import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";

export default function InventoryValuation() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  const totalAssetValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.cost || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0);

  return (
    <div className="p-8 space-y-6" data-testid="inventory-valuation-page">
      <div>
        <span className="label-tiny">Inventaris</span>
        <h1 className="font-display text-3xl font-bold mt-1">Penilaian Inventaris</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card-surface p-6">
          <span className="label-tiny">Total Nilai Aset (Harga Beli)</span>
          <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--primary))] mt-2">
            {fmtIDR(totalAssetValue)}
          </p>
        </div>
        <div className="card-surface p-6">
          <span className="label-tiny">Total Nilai Jual (Harga Retail)</span>
          <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--primary))] mt-2">
            {fmtIDR(totalRetailValue)}
          </p>
        </div>
        <div className="card-surface p-6">
          <span className="label-tiny">Potensi Keuntungan Kotor</span>
          <p className="font-display num-display text-3xl font-extrabold text-emerald-600 mt-2">
            {fmtIDR(totalRetailValue - totalAssetValue)}
          </p>
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Detail Valuasi Persediaan</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Stok Fisik</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Harga Pokok (Cost)</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nilai Aset</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Harga Jual</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Nilai Retail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {products.map((p) => {
                const assetVal = (p.stock || 0) * (p.cost || 0);
                const retailVal = (p.stock || 0) * (p.price || 0);
                return (
                  <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono font-bold">{p.stock}</td>
                    <td className="py-3 font-mono">{fmtIDR(p.cost || 0)}</td>
                    <td className="py-3 font-mono font-semibold text-[hsl(var(--primary))]">{fmtIDR(assetVal)}</td>
                    <td className="py-3 font-mono">{fmtIDR(p.price || 0)}</td>
                    <td className="py-3 font-mono text-right font-semibold text-[hsl(var(--primary))]">{fmtIDR(retailVal)}</td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada data produk.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
