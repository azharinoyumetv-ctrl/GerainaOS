import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function Membership() {
  const [memberships, setMemberships] = useState([]);
  const [name, setName] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [discount, setDiscount] = useState("");
  const [desc, setDesc] = useState("");

  const fetchMemberships = () => {
    api.get("/customers/memberships").then((r) => setMemberships(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchMemberships();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !minPoints || !discount) return;

    api.post("/customers/memberships", {
      name,
      min_points: parseInt(minPoints),
      discount_percent: parseInt(discount),
      description: desc
    }).then(() => {
      setName("");
      setMinPoints("");
      setDiscount("");
      setDesc("");
      fetchMemberships();
      toast.success("Membership level berhasil disimpan!");
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="membership-page">
      <div>
        <span className="label-tiny">Pelanggan</span>
        <h1 className="font-display text-3xl font-bold mt-1">Tingkatan Keanggotaan</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="membership-form">
          <h2 className="font-display font-bold text-lg">Buat Tingkatan Member</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Tingkatan</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Gold, Premium"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Minimal Poin</label>
              <input
                type="number"
                value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
                placeholder="Poin"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Diskon (%)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="Diskon %"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Keterangan / Benefit</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Benefit level member..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-20 resize-none text-sm"
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="membership-submit">
            <Check size={16} /> Simpan Level
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="membership-list">
          <h2 className="font-display font-bold text-lg mb-4">Tingkatan Membership Aktif</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tingkatan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Syarat Minimal Poin</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Diskon Khusus</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Benefit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {memberships.map((m) => (
                  <tr key={m.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-semibold text-xs text-[hsl(var(--primary))]">{m.name}</td>
                    <td className="py-3 font-mono font-bold text-xs">{m.min_points} Poin</td>
                    <td className="py-3 font-mono text-xs text-emerald-600 font-bold">{m.discount_percent}%</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))] text-right">{m.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
