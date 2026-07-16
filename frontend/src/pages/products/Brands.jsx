import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editingId, setEditingId] = useState(null);

  const fetchBrands = () => {
    api.get("/products/brands").then((r) => setBrands(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      api.put(`/products/brands/${editingId}`, { name, description: desc }).then(() => {
        setEditingId(null);
        setName("");
        setDesc("");
        fetchBrands();
      });
    } else {
      api.post("/products/brands", { name, description: desc }).then(() => {
        setName("");
        setDesc("");
        fetchBrands();
      });
    }
  };

  const handleEdit = (b) => {
    setEditingId(b.id);
    setName(b.name);
    setDesc(b.description || "");
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus brand ini?")) {
      api.delete(`/products/brands/${id}`).then(() => fetchBrands());
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="brands-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Brand Produk</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="brand-form">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Brand" : "Tambah Brand"}</h2>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Brand</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Nestle, Unilever"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none"
              data-testid="brand-name-input"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Deskripsi</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi singkat brand..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-24 resize-none"
              data-testid="brand-desc-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="brand-submit">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Brand</>}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setName(""); setDesc(""); }}
              className="btn-outline w-full py-2 mt-2"
            >
              Batal
            </button>
          )}
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="brands-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Brand</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Nama</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Deskripsi</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{b.name}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{b.description || "-"}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(b)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada brand yang dibuat.</td>
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
