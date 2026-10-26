import { useMemo } from "react";
import useTablePage from "@/hooks/useTablePage";
import TablePage from "@/components/TablePage";
import useCatalogue from "@/hooks/useCatalogue";
import ReadState from "@/components/ReadState";
import { fmtIDR } from "@/api/client";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function LowStock() {
  const { products, loading, error, retry } = useCatalogue();
  const lowStockProducts = useMemo(() => products.filter(product => product.stock <= 5), [products]);
  const table = useTablePage(lowStockProducts);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="low-stock-page">
      <div>
        <span className="label-tiny">Inventaris</span>
        <h1 className="font-display text-3xl font-bold mt-1">Peringatan Stok Menipis</h1>
      </div>

      <ReadState loading={loading} error={error} retry={retry} testid="inventory-read-state" />
      {!loading && !error && <div className="card-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">Peringatan Stok Menipis (Stok ≤ 5)</h2>
          {lowStockProducts.length > 0 && (
            <Link to="/geraina/app/purchase/orders" className="btn-primary py-2 px-4 flex items-center gap-2 text-xs font-semibold">
              <ShoppingBag size={14} /> Buat PO Baru <ArrowRight size={14} />
            </Link>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Produk</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">SKU</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kategori</th>
                <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Stok Saat Ini</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Harga Pokok (Cost)</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {table.rows.map((p) => (
                <tr key={p.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                  <td className="py-3 font-medium">{p.name}</td>
                  <td className="py-3 font-mono text-xs">{p.sku || "-"}</td>
                  <td className="py-3 text-[hsl(var(--muted))]">{p.category || "-"}</td>
                  <td className="py-3 text-center font-bold text-red-600 font-mono">{p.stock}</td>
                  <td className="py-3 font-mono">{fmtIDR(p.cost || 0)}</td>
                  <td className="py-3 text-right">
                    {p.stock === 0 ? (
                      <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded">
                        Stok Habis Total
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded">
                        Segera Reorder
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-emerald-600 font-medium">Semua stok produk mencukupi. Mantap!</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePage value={table} />
        </div>
      </div>}
    </div>
  );
}
