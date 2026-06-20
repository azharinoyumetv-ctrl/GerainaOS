import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Save, Check } from "lucide-react";

export default function LoyaltyPoints() {
  const [conversionRate, setConversionRate] = useState("");
  const [pointValue, setPointValue] = useState("");
  const [minRedeem, setMinRedeem] = useState("");

  useEffect(() => {
    api.get("/customers/loyalty").then((r) => {
      const data = r.data || {};
      setConversionRate(data.conversion_rate || 10000);
      setPointValue(data.point_value || 100);
      setMinRedeem(data.min_redeem_points || 50);
    }).catch(() => {});
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    api.post("/customers/loyalty", {
      conversion_rate: parseInt(conversionRate),
      point_value: parseInt(pointValue),
      min_redeem_points: parseInt(minRedeem)
    }).then(() => {
      alert("Aturan poin loyalitas berhasil disimpan!");
    });
  };

  return (
    <div className="p-8 space-y-6" data-testid="loyalty-page">
      <div>
        <span className="label-tiny">Pelanggan</span>
        <h1 className="font-display text-3xl font-bold mt-1">Poin Loyalitas</h1>
      </div>

      <div className="max-w-2xl card-surface p-6 space-y-6">
        <h2 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3">Aturan Poin Loyalitas & Reward</h2>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Rasio Poin per Pembelanjaan</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[hsl(var(--muted))] font-medium">Setiap Kelipatan</span>
                <input
                  type="number"
                  value={conversionRate}
                  onChange={(e) => setConversionRate(e.target.value)}
                  className="w-full border border-[hsl(var(--border))] rounded-md pl-28 pr-16 py-2 text-sm text-right"
                />
                <span className="absolute right-3 text-xs text-[hsl(var(--muted))]">= 1 Poin</span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted))] mt-1">Contoh: Belanja Rp 10.000 dapat 1 Poin.</p>
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nilai Rupiah per 1 Poin</label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[hsl(var(--muted))] font-medium">1 Poin =</span>
                <input
                  type="number"
                  value={pointValue}
                  onChange={(e) => setPointValue(e.target.value)}
                  className="w-full border border-[hsl(var(--border))] rounded-md pl-16 pr-12 py-2 text-sm text-right font-mono"
                />
                <span className="absolute right-3 text-xs text-[hsl(var(--muted))]">Rupiah</span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted))] mt-1">Contoh: 1 Poin dapat digunakan senilai Rp 100.</p>
            </div>
          </div>

          <div className="flex flex-col space-y-1 max-w-xs pt-2">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Minimal Poin untuk Redeem</label>
            <div className="relative flex items-center">
              <input
                type="number"
                value={minRedeem}
                onChange={(e) => setMinRedeem(e.target.value)}
                className="w-full border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm text-right font-mono pr-14"
              />
              <span className="absolute right-3 text-xs text-[hsl(var(--muted))]">Poin</span>
            </div>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end">
            <button type="submit" className="btn-primary py-2 px-6 flex items-center gap-2 font-semibold">
              <Save size={16} /> Simpan Konfigurasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
