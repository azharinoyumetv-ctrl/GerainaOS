import { Shield } from "lucide-react";

export default function Roles() {
  const defaultRoles = [
    { name: "Owner", desc: "Akses penuh tanpa batasan ke semua menu, laporan keuangan, dan pengaturan integrasi cloud." },
    { name: "Manager", desc: "Akses operasional penuh, termasuk edit produk, inventory, customer, staff, dan laporan harian. Tidak diizinkan mengakses menu integrasi API & lisensi perangkat." },
    { name: "Cashier", desc: "Akses khusus layar penjualan POS Kasir, tambah pelanggan, dan riwayat transaksi retail. Produk bersifat Read-Only." },
    { name: "Warehouse", desc: "Akses khusus modul logistik: Stok masuk, opname stok, transfer cabang, purchase order, dan list supplier." }
  ];

  return (
    <div className="p-8 space-y-6" data-testid="roles-page">
      <div>
        <span className="label-tiny">Staff</span>
        <h1 className="font-display text-3xl font-bold mt-1">Jabatan & Peran (Roles)</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Shield className="text-[hsl(var(--primary))]" size={20} /> Tingkatan Hak Akses POS
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {defaultRoles.map((r, idx) => (
            <div key={idx} className="border border-[hsl(var(--border))] rounded-lg p-5 bg-[hsl(var(--background))]/30 flex flex-col justify-between">
              <div>
                <span className="font-display font-bold text-base text-[hsl(var(--primary))]">{r.name}</span>
                <p className="text-xs text-[hsl(var(--muted))] mt-2 leading-relaxed">{r.desc}</p>
              </div>
              <div className="border-t border-[hsl(var(--border))]/50 pt-3 mt-4 flex items-center justify-between text-[10px] text-[hsl(var(--muted))] font-semibold uppercase tracking-wider">
                <span>Status: Sistem Default</span>
                <span className="text-emerald-600">Aktif</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
