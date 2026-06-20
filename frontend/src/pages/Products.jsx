import { useEffect, useRef, useState } from "react";
import api, { fmtIDR, API_BASE } from "@/api/client";
import { Plus, Upload, Search, Edit3, Trash2, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

function ProductForm({ product, onClose, onSaved }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    price: product?.price || 0,
    cost: product?.cost || 0,
    stock: product?.stock || 0,
    category: product?.category || "Umum",
    unit: product?.unit || "pcs",
    description: product?.description || "",
    active: product?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost),
        stock: parseInt(form.stock, 10) || 0,
      };
      if (isEdit) await api.put(`/products/${product.id}`, payload);
      else await api.post("/products", payload);
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gagal menyimpan");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose} data-testid="product-form-modal">
      <form onSubmit={save} className="card-surface bg-white p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()} data-testid="product-form">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold">{isEdit ? "Edit Produk" : "Produk Baru"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-2" data-testid="product-form-close"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label-tiny">Nama Produk</label>
            <input className="input-field mt-1.5" required value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pf-name" />
          </div>
          <div>
            <label className="label-tiny">SKU</label>
            <input className="input-field mt-1.5" value={form.sku}
                   onChange={(e) => setForm({ ...form, sku: e.target.value })} data-testid="pf-sku" />
          </div>
          <div>
            <label className="label-tiny">Kategori</label>
            <input className="input-field mt-1.5" value={form.category}
                   onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="pf-category" />
          </div>
          <div>
            <label className="label-tiny">Harga Jual (Rp)</label>
            <input className="input-field mt-1.5" type="number" step="0.01" required value={form.price}
                   onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="pf-price" />
          </div>
          <div>
            <label className="label-tiny">HPP (Rp)</label>
            <input className="input-field mt-1.5" type="number" step="0.01" value={form.cost}
                   onChange={(e) => setForm({ ...form, cost: e.target.value })} data-testid="pf-cost" />
          </div>
          <div>
            <label className="label-tiny">Stok</label>
            <input className="input-field mt-1.5" type="number" value={form.stock}
                   onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="pf-stock" />
          </div>
          <div>
            <label className="label-tiny">Unit</label>
            <input className="input-field mt-1.5" value={form.unit}
                   onChange={(e) => setForm({ ...form, unit: e.target.value })} data-testid="pf-unit" />
          </div>
        </div>
        {err && <p className="text-sm text-[hsl(var(--destructive))] mt-3">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn-outline flex-1" data-testid="pf-cancel">Batal</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1" data-testid="pf-save">{saving ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>
    </div>
  );
}

function ImportDialog({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const dropRef = useRef(null);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setErr(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api.post("/products/bulk-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gagal upload");
    } finally { setUploading(false); }
  };

  const finish = () => { onDone(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" data-testid="import-dialog">
      <div className="card-surface bg-white p-6 w-full max-w-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold">Import Produk dari Excel / CSV</h2>
          <button onClick={onClose} className="btn-ghost p-2" data-testid="import-close"><X size={18} /></button>
        </div>

        {!result && (
          <>
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="border-2 border-dashed rounded-lg p-10 text-center bg-[hsl(var(--background))] hover:border-[hsl(var(--primary))] transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
              data-testid="import-dropzone"
            >
              <FileSpreadsheet size={42} className="mx-auto text-[hsl(var(--primary))] mb-3" />
              <p className="font-display font-bold text-lg">Drag & Drop file di sini</p>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">atau klik untuk pilih file (.xlsx, .csv)</p>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])}
                data-testid="import-file-input"
              />
              <label htmlFor="import-file" className="btn-outline mt-4 inline-flex cursor-pointer" data-testid="import-browse-btn">
                Pilih File
              </label>
              {file && (
                <p className="text-sm font-medium mt-4" data-testid="import-selected-file">
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <a
                href={`${API_BASE}/products/import-template.csv`}
                className="text-sm text-[hsl(var(--primary))] flex items-center gap-1.5 font-semibold"
                data-testid="import-template-link"
              >
                <Download size={14} /> Download template CSV
              </a>
              <p className="text-xs text-[hsl(var(--muted))]">Kolom wajib: <code>name</code>, <code>price</code></p>
            </div>

            {err && <p className="text-sm text-[hsl(var(--destructive))] mt-3" data-testid="import-error">{err}</p>}

            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="btn-outline flex-1" data-testid="import-cancel">Batal</button>
              <button onClick={upload} disabled={!file || uploading} className="btn-primary flex-1" data-testid="import-upload-btn">
                <Upload size={16} /> {uploading ? "Mengimpor…" : "Mulai Impor"}
              </button>
            </div>
          </>
        )}

        {result && (
          <div data-testid="import-result">
            <div className="grid grid-cols-3 gap-3">
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Ditambahkan</p>
                <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--success))]" data-testid="import-inserted">
                  {result.inserted}
                </p>
              </div>
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Diupdate</p>
                <p className="font-display num-display text-3xl font-extrabold" data-testid="import-updated">{result.updated}</p>
              </div>
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Dilewati</p>
                <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--muted))]" data-testid="import-skipped">
                  {result.skipped}
                </p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-4 p-3 rounded-md bg-[hsl(var(--destructive))]/8" data-testid="import-errors-block">
                <p className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-[hsl(var(--destructive))]">
                  <AlertCircle size={14} /> Error
                </p>
                <ul className="text-xs text-[hsl(var(--destructive))] space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((errMsg, i) => <li key={`${i}-${errMsg.slice(0, 24)}`}>· {errMsg}</li>)}
                </ul>
              </div>
            )}
            <p className="text-sm text-[hsl(var(--success))] flex items-center gap-1.5 mt-4 font-semibold">
              <CheckCircle2 size={16} /> Impor selesai
            </p>
            <button onClick={finish} className="btn-primary w-full mt-4" data-testid="import-done-btn">Selesai</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Products() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/products", { params: { q: q || undefined, category: filterCat !== "all" ? filterCat : undefined } });
      setItems(r.data);
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); api.get("/products/categories").then((r) => setCategories(r.data)).catch(() => {}); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, filterCat]);

  const remove = async (p) => {
    if (!window.confirm(`Hapus "${p.name}"?`)) return;
    await api.delete(`/products/${p.id}`);
    load();
  };

  return (
    <div className="p-8 space-y-5" data-testid="products-page">
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Manajemen</span>
          <h1 className="font-display text-3xl font-bold mt-1">Produk</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-outline" data-testid="open-import-btn">
            <Upload size={16} /> Impor Excel/CSV
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary" data-testid="new-product-btn">
            <Plus size={16} /> Produk Baru
          </button>
        </div>
      </div>

      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
            <input
              className="input-field pl-9"
              placeholder="Cari nama produk…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="products-search"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="input-field w-48"
            data-testid="products-category-filter"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm" data-testid="products-table">
          <thead className="bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
            <tr className="text-left">
              <th className="px-5 py-3 label-tiny">Nama</th>
              <th className="px-5 py-3 label-tiny">SKU</th>
              <th className="px-5 py-3 label-tiny">Kategori</th>
              <th className="px-5 py-3 label-tiny text-right">Harga</th>
              <th className="px-5 py-3 label-tiny text-right">Stok</th>
              <th className="px-5 py-3 label-tiny text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="products-loading">Memuat…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="products-empty">Belum ada produk.</td></tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-[hsl(var(--background))]" data-testid={`product-row-${p.id}`}>
                <td className="px-5 py-3 font-medium">{p.name}</td>
                <td className="px-5 py-3 text-[hsl(var(--muted))] text-xs">{p.sku || "—"}</td>
                <td className="px-5 py-3"><span className="pill pill-muted">{p.category}</span></td>
                <td className="px-5 py-3 text-right font-display font-bold num-display">{fmtIDR(p.price)}</td>
                <td className="px-5 py-3 text-right num-display">{p.stock} <span className="text-xs text-[hsl(var(--muted))]">{p.unit}</span></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="btn-ghost p-1.5" data-testid={`edit-product-${p.id}`}><Edit3 size={15} /></button>
                  <button onClick={() => remove(p)} className="btn-ghost p-1.5 text-[hsl(var(--destructive))]" data-testid={`delete-product-${p.id}`}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <ProductForm product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}
