import { useState } from "react";
import { Store, ArrowRight, LogOut } from "lucide-react";
import api from "@/api/client";

const MODULE = "geraina";
const BRAND = "#0d9488";
const HOME = "/geraina/app/dashboard";

export default function Activate() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/stores", { module: MODULE, store_name: name.trim() });
      window.location.href = HOME;
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Gagal membuat toko. Coba lagi.");
      setBusy(false);
    }
  };

  const logout = () => {
    ["geraina_token", "dagangos_token", "dapuros_token", "dagangos_user", "geraina_user"].forEach((k) =>
      localStorage.removeItem(k)
    );
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white" data-testid="activate-page">
      {/* Left / brand panel */}
      <div className="hidden md:flex flex-col justify-between p-10 text-white" style={{ background: BRAND }}>
        <div className="flex items-center gap-2 font-extrabold text-lg">
          <Store size={22} /> Geraina POS
        </div>
        <div>
          <h2 className="text-3xl font-extrabold leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Aktifkan Geraina untuk akun Anda
          </h2>
          <p className="mt-3 text-white/85 text-sm max-w-sm">
            Satu akun DagangOS bisa menjalankan beberapa modul. Buat toko Geraina (ritel) untuk mulai
            mengelola produk, kasir, dan stok — data terpisah dari modul lain Anda.
          </p>
        </div>
        <p className="text-[11px] text-white/70">by DagangOS</p>
      </div>

      {/* Right / form */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="activate-form">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND }}>
              Aktivasi Modul
            </span>
            <h1 className="text-2xl font-extrabold mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Buat toko Geraina
            </h1>
            <p className="text-sm text-gray-500 mt-1">Anda belum punya toko untuk modul ini. Beri nama toko ritel Anda.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase">Nama Toko</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Toko Sejahtera, Geraina Mart"
              className="mt-1 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              data-testid="activate-store-name"
            />
          </div>

          {err && <p className="text-sm text-red-600" data-testid="activate-error">{err}</p>}

          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: BRAND }}
            data-testid="activate-submit"
          >
            {busy ? "Membuat toko..." : (<>Buat &amp; Masuk <ArrowRight size={16} /></>)}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 rounded-xl text-gray-500 text-xs font-semibold flex items-center justify-center gap-1.5 hover:text-gray-700"
          >
            <LogOut size={13} /> Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
