import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function Units() {
  const [units, setUnits] = useState([]);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [editingId, setEditingId] = useState(null);

  const fetchUnits = () => {
    api.get("/products/units").then((r) => setUnits(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !shortName.trim()) return;

    if (editingId) {
      api.put(`/products/units/${editingId}`, { name, short_name: shortName }).then(() => {
        setEditingId(null);
        setName("");
        setShortName("");
        fetchUnits();
      });
    } else {
      api.post("/products/units", { name, short_name: shortName }).then(() => {
        setName("");
        setShortName("");
        fetchUnits();
      });
    }
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setName(u.name);
    setShortName(u.short_name);
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus satuan unit ini?")) {
      api.delete(`/products/units/${id}`).then(() => fetchUnits());
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="units-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Satuan Unit</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="unit-form">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Unit" : "Tambah Satuan Unit"}</h2>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Unit</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kilogram, Pieces"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none"
              data-testid="unit-name-input"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Singkat (Simbol)</label>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Contoh: kg, pcs, btl"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none"
              data-testid="unit-symbol-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="unit-submit">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Unit</>}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setName(""); setShortName(""); }}
              className="btn-outline w-full py-2 mt-2"
            >
              Batal
            </button>
          )}
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="units-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Satuan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama Unit</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Simbol</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{u.name}</td>
                    <td className="py-3 font-mono text-[hsl(var(--muted))]">{u.short_name}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada satuan yang dibuat.</td>
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
