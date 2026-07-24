import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight, Check } from "lucide-react";

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
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-grain"
           style={{ background: "linear-gradient(135deg, hsl(151,39%,17%), hsl(151,39%,12%))" }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <defs>
            <pattern id="circuitGerainaReg" width="140" height="140" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="#ffffff" strokeOpacity=".07" strokeWidth="1.5">
                <path d="M18 18 L18 55 L70 55 L70 100" />
                <path d="M120 10 L120 45 L95 45 L95 130" />
                <path d="M40 130 L40 95 L10 95" />
              </g>
              <g fill="#ffffff" fillOpacity=".1">
                <circle cx="18" cy="18" r="3" /><circle cx="70" cy="100" r="3" />
                <circle cx="120" cy="10" r="2.4" /><circle cx="95" cy="130" r="2.4" />
                <circle cx="40" cy="130" r="2.4" /><circle cx="10" cy="95" r="2.4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuitGerainaReg)" />
        </svg>
        <Link to="/geraina" className="relative text-white font-display font-bold text-xl flex items-center gap-2">
          <img src="/assets/brand/geraina-icon.png" alt="" className="w-6 h-6 object-contain" /> Geraina POS <span className="text-xs text-white/60 font-medium">by DagangOS</span>
        </Link>
        <div className="relative text-white space-y-5 max-w-md">
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
        <p className="relative text-white/50 text-xs">© Geraina POS by DagangOS</p>
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
                name="organization"
                autoComplete="organization"
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
                name="email"
                autoComplete="email"
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
                name="new-password"
                autoComplete="new-password"
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
