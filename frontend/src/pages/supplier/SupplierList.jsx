import { useEffect, useRef, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState(null);
  // Same unsequenced-refetch race already found and fixed in Attendance.jsx/Products.jsx:
  // guard against an older fetchSuppliers() call resolving after a newer one and
  // clobbering the list with a stale snapshot.
  const fetchReqIdRef = useRef(0);

  const fetchSuppliers = () => {
    const reqId = ++fetchReqIdRef.current;
    api.get("/suppliers").then((r) => {
      if (reqId === fetchReqIdRef.current) setSuppliers(r.data);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = { name, phone, email, address };

    if (editingId) {
      api.put(`/suppliers/${editingId}`, payload).then(() => {
        setEditingId(null);
        clearForm();
        fetchSuppliers();
      });
    } else {
      api.post("/suppliers", payload).then(() => {
        clearForm();
        fetchSuppliers();
      });
    }
  };

  const clearForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone || "");
    setEmail(s.email || "");
    setAddress(s.address || "");
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus supplier ini?")) {
      api.delete(`/suppliers/${id}`).then(() => fetchSuppliers());
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="suppliers-page">
      <div>
        <span className="label-tiny">Pemasok</span>
        <h1 className="font-display text-3xl font-bold mt-1">Supplier Database</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="supplier-form">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Supplier" : "Tambah Supplier"}</h2>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Supplier</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama PT / Toko Supplier"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Telepon</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0812..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supplier@email.com"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Alamat Kantor</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap supplier..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-20 resize-none text-sm"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="supplier-submit">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Supplier</>}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); clearForm(); }}
              className="btn-outline w-full py-2 mt-2 text-xs"
            >
              Batal
            </button>
          )}
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="suppliers-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Supplier</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Supplier</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Kontak</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Alamat</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors" data-testid={`supplier-row-${s.id}`}>
                    <td className="py-3 font-medium text-xs">{s.name}</td>
                    <td className="py-3 text-xs">
                      <div>{s.phone || "-"}</div>
                      <div className="text-[hsl(var(--muted))]">{s.email || "-"}</div>
                    </td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))] truncate max-w-[200px]">{s.address || "-"}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      {/* Per-row data-testid: this list is sorted by name (list_suppliers, backend),
                          so editing a supplier's name can reshuffle row order on the very next fetch.
                          Every row's Edit/Hapus button previously shared the exact same title="Edit"/
                          "Hapus" with no other distinguishing attribute -- a selector without a stable,
                          per-record anchor (position- or label-based) can silently target the wrong row
                          after a resort. Likely explanation for TestSprite postrun-9's finding that a
                          name edit landed correctly but phone/email landed on a different supplier. */}
                      <button onClick={() => handleEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit" data-testid={`supplier-edit-${s.id}`}>
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus" data-testid={`supplier-delete-${s.id}`}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada supplier terdaftar.</td>
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
