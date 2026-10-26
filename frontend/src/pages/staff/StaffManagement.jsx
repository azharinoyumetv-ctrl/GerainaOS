import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { canManageStaff, canonicalRole } from "@/auth/permissions";
import api from "@/api/client";
import PasswordInput from "@/components/PasswordInput";
import { Plus, UserX, Edit, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const roles = ["Manager", "Cashier", "Warehouse"];
const message = (error, fallback) => typeof error?.response?.data?.detail === "string" ? error.response.data.detail : fallback;

export default function StaffManagement() {
  const { user } = useAuth();
  const canManage = canManageStaff(user?.role);
  const canRead = canManage || canonicalRole(user?.role) === "Manager";
  const [staffList, setStaffList] = useState([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState("");
  const [role, setRole] = useState("Cashier"), [status, setStatus] = useState("Aktif"), [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState(null), [formError, setFormError] = useState(""), [saving, setSaving] = useState(false), [deactivating, setDeactivating] = useState(null);
  const sequence = useRef(0), mounted = useRef(true), savingRef = useRef(false), deactivatingRef = useRef(false);
  const clearForm = () => { setName(""); setEmail(""); setPhone(""); setRole("Cashier"); setStatus("Aktif"); setPassword(""); setEditingId(null); setFormError(""); };
  const fetchStaff = async () => {
    if (!canRead) { setLoading(false); return; }
    const seq = ++sequence.current; setLoading(true); setLoadError("");
    try { const { data } = await api.get("/staff"); if (!Array.isArray(data)) throw new Error("Invalid roster"); if (mounted.current && seq === sequence.current) setStaffList(data); }
    catch (error) { if (mounted.current && seq === sequence.current) setLoadError(message(error, "Daftar karyawan belum dapat dimuat. Coba lagi.")); }
    finally { if (mounted.current && seq === sequence.current) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true; setStaffList([]); clearForm(); fetchStaff();
    return () => { mounted.current = false; sequence.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.store_id, user?.role]);
  useEffect(() => {
    const hasDraft = canManage && (saving || editingId || name || email || phone || password || role !== "Cashier" || status !== "Aktif");
    const beforeSwitch = event => { if (hasDraft) event.preventDefault(); };
    window.addEventListener("geraina-before-account-switch", beforeSwitch);
    return () => window.removeEventListener("geraina-before-account-switch", beforeSwitch);
  }, [canManage, saving, editingId, name, email, phone, password, role, status]);

  const handleSubmit = async event => {
    event.preventDefault();
    if (!canManage || savingRef.current) return;
    if (!name.trim() || !email.trim() || !roles.includes(role)) { setFormError("Isi nama, email login, dan peran karyawan yang valid."); return; }
    if ((!editingId || password) && (password.length < 10 || new TextEncoder().encode(password).length > 72 || !/\p{L}/u.test(password) || !/[0-9]/.test(password))) {
      setFormError("Password awal minimal 10 karakter, memuat huruf dan angka, dan maksimal 72 byte."); return;
    }
    savingRef.current = true; setSaving(true); setFormError("");
    const payload = { name: name.trim(), email: email.trim(), phone, role, status, ...(password ? { initial_password: password } : {}) };
    try {
      const { data } = await (editingId ? api.put(`/staff/${editingId}`, payload) : api.post("/staff", payload));
      sequence.current++;
      if (mounted.current) {
        setStaffList(previous => [...previous.filter(row => row.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name, "id")));
        clearForm(); toast.success("Karyawan disimpan. Perubahan akses berlaku pada login yang terkait.");
      }
    } catch (error) { if (mounted.current) setFormError(message(error, "Karyawan gagal disimpan. Periksa isian dan koneksi.")); }
    finally { savingRef.current = false; if (mounted.current) { setSaving(false); setLoading(false); } }
  };
  const handleEdit = row => {
    if (!canManage || row.is_owner_account) return;
    setEditingId(row.id); setName(row.name); setEmail(row.email); setPhone(row.phone || "");
    setRole(roles.includes(row.role) ? row.role : ""); setStatus(row.status === "Aktif" ? "Aktif" : "Non-Aktif"); setPassword(""); setFormError("");
  };
  const handleDeactivate = async row => {
    if (!canManage || row.is_owner_account || deactivatingRef.current) return;
    if (!window.confirm(`Nonaktifkan login ${row.name}? Riwayat absensi dan transaksi tetap disimpan.`)) return;
    deactivatingRef.current = true; setDeactivating(row.id);
    try {
      await api.delete(`/staff/${row.id}`); sequence.current++;
      if (mounted.current) { setStaffList(previous => previous.map(value => value.id === row.id ? { ...value, status: "Non-Aktif", login_enabled: false } : value)); toast.success("Login karyawan dinonaktifkan dan sesi sebelumnya dicabut."); }
    } catch (error) { toast.error(message(error, "Login karyawan belum dapat dinonaktifkan. Coba lagi.")); }
    finally { deactivatingRef.current = false; if (mounted.current) setDeactivating(null); }
  };
  if (!canRead) return <div className="p-6" role="alert">Daftar karyawan hanya tersedia untuk Owner atau Manager.</div>;
  return <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="staff-page">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="label-tiny">Karyawan</span><h1 className="font-display text-3xl font-bold mt-1">Manajemen Staf</h1></div><button type="button" className="btn-outline" onClick={fetchStaff} disabled={loading || saving} data-testid="staff-refresh"><RefreshCw size={15} /> Segarkan</button></div>
    <p className="text-sm text-[hsl(var(--muted))]">Setiap karyawan menggunakan akun dan password sendiri. {canManage ? "Hanya Owner yang dapat mengatur login, peran, dan penonaktifan." : "Anda dapat melihat daftar karyawan; perubahan login dan akses dilakukan oleh Owner."}</p>
    {loadError && <div role="alert" className="card-surface p-4 space-y-3" data-testid="staff-load-error"><p>{loadError}</p><button className="btn-outline" onClick={fetchStaff}>Coba lagi</button></div>}
    <div className="grid grid-cols-12 gap-6">
      {canManage && <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-5 space-y-4" data-testid="staff-form">
        <h2 className="font-display font-bold text-lg">{editingId ? "Edit Karyawan" : "Tambah Karyawan"}</h2>
        <label className="block text-sm font-medium">Nama lengkap<input value={name} onChange={e => setName(e.target.value)} required maxLength={150} className="input-field mt-1" data-testid="staff-name" /></label>
        <label className="block text-sm font-medium">Email login<input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-field mt-1" autoComplete="off" data-testid="staff-email" /></label>
        <label className="block text-sm font-medium">Nomor HP<input value={phone} onChange={e => setPhone(e.target.value)} className="input-field mt-1" data-testid="staff-phone" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Peran<select value={role} onChange={e => setRole(e.target.value)} required className="input-field mt-1" data-testid="staff-role"><option value="" disabled>Pilih peran</option>{roles.map(value => <option key={value}>{value}</option>)}</select></label><label className="block text-sm font-medium">Status<select value={status} onChange={e => setStatus(e.target.value)} className="input-field mt-1" data-testid="staff-status"><option>Aktif</option><option>Non-Aktif</option></select></label></div>
        <label className="block text-sm font-medium">{editingId ? "Reset password awal (opsional)" : "Password awal yang unik"}<PasswordInput value={password} onChange={e => setPassword(e.target.value)} required={!editingId} autoComplete="new-password" className="input-field mt-1" data-testid="staff-initial-password" toggleTestId="staff-password-toggle" /></label>
        <p className="text-xs text-[hsl(var(--muted))]">Minimal 10 karakter dengan huruf dan angka, maksimal 72 byte. Berikan secara aman kepada karyawan; karyawan wajib menggantinya saat masuk. {editingId && "Kosongkan bila tidak ingin mereset password. Reset/perubahan peran akan mencabut sesi lama."}</p>
        {formError && <p role="alert" className="text-sm text-red-700" data-testid="staff-form-error">{formError}</p>}
        <button type="submit" disabled={saving || loading || Boolean(loadError)} className="btn-primary w-full disabled:opacity-60" data-testid="staff-submit-btn">{saving ? "Menyimpan…" : editingId ? "Simpan perubahan" : <><Plus size={16} /> Tambah karyawan</>}</button>
        {editingId && <button type="button" onClick={clearForm} disabled={saving} className="btn-outline w-full" data-testid="staff-cancel">Batal</button>}
      </form>}
      <div className={`col-span-12 ${canManage ? "lg:col-span-8" : ""} card-surface p-5`} data-testid="staff-list"><h2 className="font-display font-bold text-lg mb-4">Daftar karyawan toko</h2>
        {loading ? <p role="status">Memuat karyawan…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3 pr-4">Karyawan</th><th className="py-3 pr-4">Peran</th><th className="py-3 pr-4">Login</th>{canManage && <th className="py-3 text-right">Aksi</th>}</tr></thead><tbody className="divide-y">
          {staffList.map(row => <tr key={row.id} data-testid={`staff-row-${row.id}`}><td className="py-3 pr-4"><p className="font-semibold">{row.name}</p><p className="text-xs text-[hsl(var(--muted))] break-all">{row.email}</p>{row.is_owner_account && <p className="text-xs mt-1">Akun utama pemilik toko</p>}</td><td className="py-3 pr-4">{row.role}</td><td className="py-3 pr-4"><span className="text-xs">{row.is_owner_account ? "Dikelola melalui akun pemilik" : row.status !== "Aktif" ? "Dinonaktifkan" : row.credential_reset_required ? "Perlu reset password oleh Owner" : row.must_change_password ? "Wajib ganti password saat masuk" : row.login_enabled ? "Aktif" : "Login belum terhubung"}</span></td>{canManage && <td className="py-3 text-right whitespace-nowrap">{!row.is_owner_account && <><button type="button" onClick={() => handleEdit(row)} disabled={saving || Boolean(deactivating)} className="btn-ghost p-2" aria-label={`Edit ${row.name}`} data-testid={`staff-edit-${row.id}`}><Edit size={16} /></button>{row.status === "Aktif" && <button type="button" onClick={() => handleDeactivate(row)} disabled={saving || Boolean(deactivating)} className="btn-ghost p-2 text-red-700" aria-label={`Nonaktifkan ${row.name}`} data-testid={`staff-deactivate-${row.id}`}><UserX size={16} /></button>}</>}</td>}</tr>)}
          {!staffList.length && !loadError && <tr><td colSpan={canManage ? 4 : 3} className="py-8 text-center text-[hsl(var(--muted))]">Belum ada karyawan terdaftar.</td></tr>}
        </tbody></table></div>}
      </div>
    </div>
  </div>;
}
