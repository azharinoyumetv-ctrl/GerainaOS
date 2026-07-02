import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Leaf, ArrowRight, Check } from "lucide-react";

export default function Register() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, storeName);
      nav("/geraina/app/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const perks = [
    "14 hari trial penuh, semua fitur",
    "Tanpa kartu kredit",
    "QRIS + e-wallet built-in",
    "Cabut kapan saja",
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative bg-grain"
           style={{ background: "linear-gradient(135deg, hsl(151,39%,17%), hsl(151,39%,12%))" }}>
        <Link to="/geraina" className="text-white font-display font-bold text-xl flex items-center gap-2">
          <Leaf size={22} className="text-[hsl(9,65%,62%)]" /> Geraina POS <span className="text-xs text-white/60 font-medium">by DagangOS</span>
        </Link>
        <div className="text-white space-y-5 max-w-md">
          <p className="label-tiny" style={{ color: "hsl(9,65%,75%)" }}>Geraina POS by DagangOS</p>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Buka toko digital<br /> dalam 60 detik.
          </h2>
          <ul className="space-y-2 text-white/80 mt-4">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm">
                <Check size={16} className="text-[hsl(9,65%,62%)]" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-white/50 text-xs">© Geraina POS by DagangOS</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="register-form">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-xl font-bold">Geraina POS</span>
              <span className="text-xs text-[hsl(var(--muted))] mt-1 font-semibold">by DagangOS</span>
            </div>
            <h1 className="font-display text-3xl font-bold">Buat Akun</h1>
            <p className="text-sm text-[hsl(var(--muted))] mt-1.5">Daftar gratis, mulai jualan hari ini.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label-tiny">Nama Toko</label>
              <input
                className="input-field mt-1.5"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                data-testid="register-store-input"
                placeholder="Kopi Senja Bandung"
              />
            </div>
            <div>
              <label className="label-tiny">Email Pemilik</label>
              <input
                type="email"
                className="input-field mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="register-email-input"
                placeholder="owner@geraina.com"
              />
            </div>
            <div>
              <label className="label-tiny">Password (min 6)</label>
              <input
                type="password"
                className="input-field mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="register-password-input"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="register-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="register-submit-btn">
            {loading ? "Memproses…" : "Mulai Trial 14 Hari"} <ArrowRight size={16} />
          </button>

          <p className="text-sm text-center text-[hsl(var(--muted))]">
            Sudah punya akun?{" "}
            <Link to="/geraina/login" className="text-[hsl(var(--primary))] font-semibold" data-testid="register-to-login-link">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
