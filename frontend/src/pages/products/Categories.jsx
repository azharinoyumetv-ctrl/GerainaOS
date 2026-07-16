import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Trash2, Edit } from "lucide-react";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editingId, setEditingId] = useState(null);

  const fetchCategories = () => {
    api.get("/products/categories").then((r) => setCategories(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      api.put(`/products/categories/${editingId}`, { name, description: desc }).then(() => {
        setEditingId(null);
        setName("");
        setDesc("");
        fetchCategories();
      });
    } else {
      api.post("/products/categories", { name, description: desc }).then(() => {
        setName("");
        setDesc("");
        fetchCategories();
      });
    }
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setName(c.name);
    setDesc(c.description || "");
  };

  const handleDelete = (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus kategori ini?")) {
      api.delete(`/products/categories/${id}`).then(() => fetchCategories());
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="categories-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Kategori Produk</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="category-form">
          <h2 className="font-display font-bold text-lg">{editingId ? "Edit Kategori" : "Tambah Kategori"}</h2>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Nama Kategori</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kopi, Makanan Ringan"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none"
              data-testid="category-name-input"
            />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Deskripsi</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi singkat kategori..."
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-24 resize-none"
              data-testid="category-desc-input"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="category-submit">
            {editingId ? "Simpan Perubahan" : <><Plus size={16} /> Tambah Kategori</>}
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

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="categories-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Kategori</h2>
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
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-[hsl(var(--muted))]">{c.description || "-"}</td>
                    <td className="py-3 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada kategori yang dibuat.</td>
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
