import { readCollection } from '@/api/records';
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR, API_BASE } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { canManageProducts } from "@/auth/permissions";
import { Plus, Upload, Search, Edit3, Trash2, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ScanBarcode } from "lucide-react";
import { toast } from "@/components/ui/sonner";

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
    image_url: product?.image_url || null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const saveInFlight = useRef(false);
  useEffect(() => {
    const scanned = event => {
      const { value, target } = event.detail || {};
      if (target !== "product" || typeof value !== "string" || !value.trim()) return;
      if (value.length > 200) { setErr("Barcode terlalu panjang untuk SKU produk. Masukkan kode produk secara manual."); return; }
      setForm(current => ({ ...current, sku: value }));
    };
    window.addEventListener("geraina-barcode", scanned);
    return () => window.removeEventListener("geraina-barcode", scanned);
  }, []);

  const handleImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("File harus berupa gambar (JPG/PNG)."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 320;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        setForm((f) => ({ ...f, image_url: canvas.toDataURL("image/jpeg", 0.72) }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (saveInFlight.current) return;
    const cost = String(form.cost).trim() === "" ? 0 : Number(form.cost);
    const stock = String(form.stock).trim() === "" ? 0 : Number(form.stock);
    if (!form.name.trim() || String(form.price).trim() === "" || ![Number(form.price), cost, stock].every(value => Number.isFinite(value) && value >= 0) || !Number.isInteger(stock)) {
      setErr("Isi nama produk serta harga, HPP dan stok yang valid. Stok harus berupa bilangan bulat."); return;
    }
    saveInFlight.current = true;
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        price: Number(form.price),
        cost,
        stock,
      };
      if (isEdit) {
        if (stock === product.stock) delete payload.stock;
        else payload.expected_stock = product.stock;
        await api.put(`/products/${product.id}`, payload);
      }
      else await api.post("/products", payload);
      onSaved();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : "Produk belum tersimpan. Periksa data produk lalu coba lagi.");
    } finally { saveInFlight.current = false; setSaving(false); }
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
            <label className="label-tiny" htmlFor="product-sku">SKU / Barcode</label>
            <input id="product-sku" className="input-field mt-1.5" value={form.sku} maxLength={200}
                   onChange={(e) => setForm({ ...form, sku: e.target.value })} data-testid="pf-sku" />
            {window.GerainaDevice?.scanBarcode && <button type="button" className="btn-outline mt-2 w-full" data-testid="pf-scan-barcode" onClick={() => window.GerainaDevice.scanBarcode("product")}><ScanBarcode size={17} /> Scan barcode</button>}
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
          <div className="col-span-2">
            <label className="label-tiny block mb-1.5">Foto Produk</label>
            {form.image_url ? (
              <div className="relative w-full">
                <img src={form.image_url} alt="Pratinjau produk" className="w-full h-40 object-cover rounded-lg border border-slate-200" data-testid="pf-image-preview" />
                <button type="button" onClick={() => setForm({ ...form, image_url: null })} title="Hapus foto"
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-lg p-1.5 shadow" data-testid="pf-image-remove"><Trash2 size={16} /></button>
              </div>
            ) : (
              <label htmlFor="pf-image-input" className="flex flex-col items-center justify-center gap-1 w-full h-40 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors text-center" data-testid="pf-image-drop">
                <Upload size={22} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Unggah foto produk</span>
                <span className="text-[10px] text-slate-400">JPG/PNG · otomatis dikecilkan</span>
              </label>
            )}
            <input id="pf-image-input" type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} data-testid="pf-image-input" />
          </div>
        </div>
        {err && <p role="alert" data-testid="pf-error" className="text-sm text-[hsl(var(--destructive))] mt-3">{err}</p>}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Kesalahan</p>
                <p className={`font-display num-display text-3xl font-extrabold ${(result.errors?.length || 0) > 0 ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted))]"}`} data-testid="import-error-count">
                  {result.errors?.length || 0}
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
  const { user } = useAuth();
  const identity = `${user?.id || ""}:${user?.store_id || ""}`;
  const editable = canManageProducts(user?.role);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [items, setItems] = useState([]);
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const [catalogue, setCatalogue] = useState(null);
  const [catalogueIdentity, setCatalogueIdentity] = useState("");
  const [page, setPage] = useState(0);
  const [dialogIdentity, setDialogIdentity] = useState("");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [filterCat, setFilterCat] = useState("all");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const guard = event => { if (editable && dialogIdentity === identity && (showForm || showImport)) event.preventDefault(); };
    window.addEventListener("geraina-before-account-switch", guard);
    return () => window.removeEventListener("geraina-before-account-switch", guard);
  }, [editable, dialogIdentity, identity, showForm, showImport]);
  // Monotonic request id: search-as-you-type + category filter can both fire load()
  // in quick succession (each keystroke debounces its own call, but the debounce only
  // cancels the pending *timeout*, not a request already in flight). Two overlapping
  // GET /products calls with different q/category params can resolve out of order --
  // an earlier, narrower query (e.g. a mid-typing state that legitimately matches
  // nothing) resolving AFTER the final, correct query would overwrite good results
  // with "Belum ada produk." Same race-condition class already found and fixed in
  // Attendance.jsx; guard here by only applying a response if it's still the latest
  // request issued.
  const loadReqIdRef = useRef(0);
  const summaryReqIdRef = useRef(0);
  const requestControllerRef = useRef(null);
  const requestIsUnfilteredRef = useRef(false);
  const controllersRef = useRef(new Set());
  const listRef = useRef(null);

  const load = async ({ refreshSummary = false } = {}) => {
    setLoading(true);
    setLoadError("");
    const reqId = ++loadReqIdRef.current;
    const requestIdentity = identity;
    const unfiltered = !q && filterCat === "all";
    const summaryReqId = unfiltered || refreshSummary ? ++summaryReqIdRef.current : null;
    // Keep a useful initial whole-catalogue response alive if search starts
    // before it finishes. Superseded filtered results can be cancelled.
    if (!requestIsUnfilteredRef.current || unfiltered) requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestIsUnfilteredRef.current = unfiltered;
    controllersRef.current.add(controller);
    if (refreshSummary) setCatalogue(null);
    const applySummary = products => {
      if (identityRef.current === requestIdentity && summaryReqId === summaryReqIdRef.current) {
        setCatalogue({
          total: products.length,
          categories: new Set(products.map(product => product.category).filter(Boolean)).size,
          low: products.filter(product => Number(product.stock) <= 5).length,
        });
        setCatalogueIdentity(requestIdentity);
      }
    };
    // A filtered edit/import can change the whole-catalogue counts. Ordinary
    // page entry uses the same unfiltered response for rows and summary once.
    if (refreshSummary && !unfiltered) {
      readCollection("/products").then(r => { if (Array.isArray(r.data)) applySummary(r.data); }).catch(() => {});
    }
    try {
      const r = await api.get("/products", { signal: controller.signal, params: { q: q || undefined, category: filterCat !== "all" ? filterCat : undefined } });
      if (!Array.isArray(r.data)) throw new Error("Jawaban katalog tidak valid.");
      if (unfiltered) applySummary(r.data);
      if (reqId === loadReqIdRef.current && identityRef.current === requestIdentity) { setItems(r.data); setLoadedIdentity(requestIdentity); }
    } catch {
      if (reqId === loadReqIdRef.current && identityRef.current === requestIdentity) setLoadError("Produk belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    } finally {
      controllersRef.current.delete(controller);
      if (reqId === loadReqIdRef.current && identityRef.current === requestIdentity) setLoading(false);
    }
  };

  // Filter dropdown must reflect the same category values the product table shows
  // (the free-text `category` field on each product), not the separate user-managed
  // Kategori collection -- that collection is often empty even when products exist,
  // which left the dropdown stuck on "Semua Kategori" only.
  const loadCategories = () => {
    const requestIdentity = identity;
    api.get("/products/category-names").then((r) => { if (identityRef.current === requestIdentity) setCategories(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setItems([]); setCatalogue(null); setCategories([]); setPage(0); setQ(""); setFilterCat("all");
    setShowForm(false); setShowImport(false); setEditing(null); setLoading(true); setLoadError("");
    loadCategories();
    return () => { loadReqIdRef.current++; summaryReqIdRef.current++; controllersRef.current.forEach(controller => controller.abort()); controllersRef.current.clear(); };
  }, [identity]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 200 : 0); return () => clearTimeout(t); }, [q, filterCat, identity]);

  const currentItems = loadedIdentity === identity ? items : [];
  const pages = Math.max(1, Math.ceil(currentItems.length / 25));
  const currentPage = Math.min(page, pages - 1);
  const visibleItems = currentItems.slice(currentPage * 25, currentPage * 25 + 25);
  const summary = catalogueIdentity === identity ? catalogue : null;
  const showPage = next => { setPage(next); requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "start" })); };

  const remove = async (p) => {
    if (!editable) return;
    if (!window.confirm(`Hapus "${p.name}"?`)) return;
    try { await api.delete(`/products/${p.id}`); load({ refreshSummary: true }); } catch { toast.error("Produk belum dapat dihapus. Periksa koneksi lalu coba lagi."); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5" data-testid="products-page">
      {window.__gerainaAndroid && <div className="ga-product-summary" data-testid="mobile-product-summary">
        <div><p>Produk dimuat</p><b data-ga-stat="total">{summary?.total ?? "—"}</b></div>
        <div><p>Kategori</p><b data-ga-stat="categories">{summary?.categories ?? "—"}</b></div>
        <div><p>Stok menipis</p><b data-ga-stat="low">{summary?.low ?? "—"}</b></div>
      </div>}
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Manajemen</span>
          <h1 className="font-display text-3xl font-bold mt-1">Produk</h1>
        </div>
        {editable && <div className="flex gap-2">
          <button onClick={() => { setDialogIdentity(identity); setShowImport(true); }} className="btn-outline" data-testid="open-import-btn">
            <Upload size={16} /> Impor Excel/CSV
          </button>
          <button onClick={() => { setDialogIdentity(identity); setEditing(null); setShowForm(true); }} className="btn-primary" data-testid="new-product-btn">
            <Plus size={16} /> Produk Baru
          </button>
        </div>}
      </div>

      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
            <input
              className="input-field pl-9"
              placeholder="Cari nama produk…"
              value={q}
              onChange={(e) => { setPage(0); setQ(e.target.value); }}
              data-testid="products-search"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => { setPage(0); setFilterCat(e.target.value); }}
            className="input-field w-48"
            data-testid="products-category-filter"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => {
              const name = typeof c === "string" ? c : c.name;
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>
        </div>
      </div>

      {loadError && <div role="alert" data-testid="products-error" className="card-surface p-4"><p>{loadError}</p><button className="btn-outline mt-2" data-testid="products-retry" onClick={load}>Coba lagi</button></div>}
      <div ref={listRef} className="card-surface overflow-x-auto">
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
            {!loading && !loadError && currentItems.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="products-empty">Belum ada produk.</td></tr>
            )}
            {visibleItems.map((p) => (
              <tr key={p.id} className="hover:bg-[hsl(var(--background))]" data-testid={`product-row-${p.id}`}>
                <td className="px-5 py-3 font-medium">
                  <div className="flex items-center gap-2.5">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <span className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-300 text-[10px]">—</span>
                    )}
                    <span>{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[hsl(var(--muted))] text-xs">{p.sku || "—"}</td>
                <td className="px-5 py-3"><span className="pill pill-muted">{p.category}</span></td>
                <td className="px-5 py-3 text-right font-display font-bold num-display">{fmtIDR(p.price)}</td>
                <td className="px-5 py-3 text-right num-display">{p.stock} <span className="text-xs text-[hsl(var(--muted))]">{p.unit}</span></td>
                <td className="px-5 py-3 text-right">
                  {editable && <>
                    <button onClick={() => { setDialogIdentity(identity); setEditing(p); setShowForm(true); }} className="btn-ghost p-1.5" data-testid={`edit-product-${p.id}`}><Edit3 size={15} /></button>
                    <button onClick={() => remove(p)} className="btn-ghost p-1.5 text-[hsl(var(--destructive))]" data-testid={`delete-product-${p.id}`}><Trash2 size={15} /></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !loadError && <div className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="products-pagination">
        <div><p data-testid="products-result-count">{currentItems.length ? `${currentPage * 25 + 1}–${Math.min((currentPage + 1) * 25, currentItems.length)}` : "0"} dari {currentItems.length} hasil dimuat</p>
          {currentItems.length >= 500 && <p className="text-xs text-[hsl(var(--muted))]">Gunakan pencarian atau kategori untuk mempersempit hasil dari seluruh katalog.</p>}
        </div>
        <div className="flex gap-2 items-center">
          <button type="button" className="btn-outline disabled:opacity-50" disabled={currentPage === 0} onClick={() => showPage(currentPage - 1)} data-testid="products-page-prev">Sebelumnya</button>
          <span className="text-xs" data-testid="products-page-position">{currentPage + 1} / {pages}</span>
          <button type="button" className="btn-outline disabled:opacity-50" disabled={currentPage + 1 >= pages} onClick={() => showPage(currentPage + 1)} data-testid="products-page-next">Berikutnya</button>
        </div>
      </div>}

      {editable && showForm && dialogIdentity === identity && <ProductForm product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load({ refreshSummary: true }); loadCategories(); }} />}
      {editable && showImport && dialogIdentity === identity && <ImportDialog onClose={() => setShowImport(false)} onDone={() => { load({ refreshSummary: true }); loadCategories(); }} />}
    </div>
  );
}
