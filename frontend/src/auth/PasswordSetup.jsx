import { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import PasswordInput from "@/components/PasswordInput";

export default function PasswordSetup() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const submit = async event => {
    event.preventDefault(); setError("");
    if (lock.current) return;
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) { setError("Gunakan minimal 10 karakter, termasuk huruf dan angka."); return; }
    if (next !== confirm) { setError("Konfirmasi kata sandi belum sama."); return; }
    if (!navigator.onLine) { setError("Hubungkan internet untuk mengamankan akun sebelum digunakan."); return; }
    lock.current = true; setBusy(true);
    try { await changePassword(current, next); setCurrent(""); setNext(""); setConfirm(""); }
    catch (e) { setError(typeof e?.response?.data?.detail === "string" ? e.response.data.detail : e.message || "Kata sandi belum dapat diubah. Coba lagi."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="min-h-screen p-5 grid place-items-center bg-[hsl(var(--background))]" data-testid="password-setup-page">
    <form onSubmit={submit} className="card-surface p-6 space-y-4 w-full max-w-md">
      <div><span className="label-tiny">Keamanan akun</span><h1 className="font-display text-2xl font-bold">Buat kata sandi pribadi</h1></div>
      <p className="text-sm">{user?.name || user?.email}, ganti kata sandi sementara dari Owner sebelum membuka kasir atau absensi. Akses mengikuti peran akun Anda.</p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm">Kata sandi sementara<PasswordInput className="input-field mt-1" required value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" data-testid="password-setup-current" /></label>
        <label className="block text-sm">Kata sandi pribadi baru<PasswordInput className="input-field mt-1" required value={next} onChange={e => setNext(e.target.value)} minLength={10} maxLength={128} autoComplete="new-password" data-testid="password-setup-new" /></label>
        <label className="block text-sm">Ulangi kata sandi baru<PasswordInput className="input-field mt-1" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" data-testid="password-setup-confirm" /></label>
      </fieldset>
      {error && <p className="text-sm text-red-700" role="alert" data-testid="password-setup-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50" data-testid="password-setup-save">{busy ? "Menyimpan…" : "Amankan akun & lanjutkan"}</button>
      <button type="button" onClick={logout} disabled={busy} className="btn-outline w-full">Keluar dari akun ini</button>
    </form>
  </div>;
}
