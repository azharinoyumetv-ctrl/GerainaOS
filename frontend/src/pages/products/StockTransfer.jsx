import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Send, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function StockTransfer() {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [fromBranch, setFromBranch] = useState("Outlet Utama (Jakarta)");
  const [toBranch, setToBranch] = useState("");

  const fetchData = () => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
    api.get("/products/stock-transfers").then((r) => setTransfers(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!productId || !qty || !toBranch || fromBranch === toBranch) return;

    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const payload = {
      from_branch: fromBranch,
      to_branch: toBranch,
      items: [{ name: prod.name, qty: parseInt(qty) }],
      status: "Shipped",
      created_at: new Date().toISOString()
    };

    api.post("/products/stock-transfers", payload).then(() => {
      setProductId("");
      setQty("");
      setToBranch("");
      fetchData();
      toast.success("Transfer stok berhasil dikirim!");
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="stock-transfer-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Stock Transfer</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="transfer-form">
          <h2 className="font-display font-bold text-lg">Kirim Stok Cabang</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Dari Cabang</label>
            <input
              type="text"
              readOnly
              value={fromBranch}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-[hsl(var(--background))] text-[hsl(var(--muted))] outline-none text-sm cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Ke Cabang Tujuan</label>
            <select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value)}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              data-testid="transfer-dest-select"
            >
              <option value="">-- Pilih Cabang --</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Pilih Produk</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            >
              <option value="">-- Pilih Produk --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jumlah Transfer</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Jumlah qty"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            <Send size={16} /> Kirim Barang
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="transfer-list">
          <h2 className="font-display font-bold text-lg mb-4">Mutasi Transfer Antar Cabang</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Dari</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Ke Cabang</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Items</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 text-[hsl(var(--muted))]">{new Date(t.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="py-3 font-medium text-xs">{t.from_branch}</td>
                    <td className="py-3 font-medium text-xs">{t.to_branch}</td>
                    <td className="py-3">
                      {t.items?.map((it, idx) => (
                        <div key={idx} className="text-xs">
                          {it.name} <span className="font-semibold text-[hsl(var(--primary))]">({it.qty} Qty)</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`pill ${t.status === "Received" ? "pill-success" : "pill-warning"}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada mutasi transfer antar cabang.</td>
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
