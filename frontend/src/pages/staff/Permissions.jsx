import { Shield } from "lucide-react";

export default function Permissions() {
  const modules = [
    { key: "dashboard", label: "Dashboard Ringkasan" },
    { key: "pos", label: "Layar Kasir POS" },
    { key: "products", label: "Katalog & CRUD Produk" },
    { key: "inventory", label: "Stok Opname & Kartu Stok" },
    { key: "purchase", label: "Purchase Order & Invoicing" },
    { key: "suppliers", label: "Database Supplier" },
    { key: "customers", label: "Database Pelanggan & Poin" },
    { key: "debt", label: "Buku Hutang Piutang" },
    { key: "payments", label: "Konfigurasi Metode Bayar" },
    { key: "reports", label: "Laporan Profit & Laba Kotor" },
    { key: "staff", label: "Lihat daftar staf / kehadiran tim" },
    { key: "staff_manage", label: "Ubah staf, peran dan kata sandi" },
    { key: "attendance", label: "Absensi pribadi (sesuai paket toko)" },
    { key: "sales", label: "Riwayat penjualan" },
    { key: "products_write", label: "Tambah, ubah dan hapus produk" },
    { key: "branches", label: "Kelola Cabang Outlet" },
    { key: "settings", label: "Pengaturan Sistem" },
  ];

  const roles = ["Owner", "Manager", "Cashier", "Warehouse"];

  const matrix = {
    Owner: ["dashboard", "pos", "products", "products_write", "inventory", "purchase", "suppliers", "customers", "debt", "payments", "reports", "staff", "staff_manage", "attendance", "sales", "branches", "settings"],
    Manager: ["dashboard", "pos", "products", "products_write", "inventory", "purchase", "suppliers", "customers", "debt", "reports", "staff", "attendance", "sales"],
    Cashier: ["dashboard", "pos", "products", "customers", "sales", "attendance"],
    Warehouse: ["products", "inventory", "purchase", "suppliers", "attendance"]
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="permissions-page">
      <div>
        <span className="label-tiny">Karyawan</span>
        <h1 className="font-display text-3xl font-bold mt-1">Hak Akses Modul (Permissions)</h1>
      </div>

      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
          <Shield className="text-[hsl(var(--primary))]" size={20} /> Matriks Hak Akses Karyawan
        </h2>
        <p className="text-xs text-[hsl(var(--muted))] mb-6">
          Peran bawaan ditetapkan pada akun staf oleh Owner dan diperiksa oleh server. Tabel ini menjelaskan akses yang tersedia; ubah penugasan peran melalui Kelola Karyawan. Hak fitur juga mengikuti paket toko.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/50">
                <th className="py-3 px-4 font-semibold text-[hsl(var(--muted))]">Nama Modul / Menu</th>
                {roles.map(r => (
                  <th key={r} className="py-3 text-center font-semibold text-[hsl(var(--muted))]">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {modules.map((m) => (
                <tr key={m.key} className="hover:bg-[hsl(var(--background))]/50">
                  <td className="py-3 px-4 font-medium">{m.label}</td>
                  {roles.map(role => {
                    const hasAccess = matrix[role].includes(m.key);
                    return (
                      <td key={role} className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={hasAccess}
                          readOnly
                          className="rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-0 cursor-not-allowed"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
