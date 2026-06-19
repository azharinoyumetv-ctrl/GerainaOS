import { useEffect, useState } from "react";
import api from "@/api/client";

export default function StockOverview() {
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-8 space-y-6" data-testid="stock-overview-page">
      <div>
        <span className="label-tiny">Inventory</span>
        <h1 className="font-display text-3xl font-bold mt-1">Stock Overview</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Ringkasan Stok Produk</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">SKU</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kategori</th>
                <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Stok Fisik</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Unit</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {products.map((p) => {
                const isLow = p.stock <= 5;
                const isOut = p.stock <= 0;
                return (
                  <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs">{p.sku || "-"}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{p.category || "-"}</td>
                    <td className="py-3 text-center font-bold font-mono">{p.stock}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))]">{p.unit || "pcs"}</td>
                    <td className="py-3 text-right">
                      {isOut ? (
                        <span className="pill pill-danger">Habis</span>
                      ) : isLow ? (
                        <span className="pill pill-warning">Menipis</span>
                      ) : (
                        <span className="pill pill-success">Cukup</span>
                      )}
                    </td>
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
