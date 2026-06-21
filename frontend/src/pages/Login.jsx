import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Leaf, ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/geraina/app/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative bg-grain"
           style={{ background: "linear-gradient(135deg, hsl(151,39%,17%), hsl(151,39%,12%))" }}
           data-testid="login-side">
        <Link to="/geraina" className="text-white font-display font-bold text-xl flex items-center gap-2">
          <Leaf size={22} className="text-[hsl(9,65%,62%)]" /> Geraina POS <span className="text-xs text-white/60 font-medium">by DagangOS</span>
        </Link>
        <div className="text-white space-y-4 max-w-md">
          <p className="label-tiny" style={{ color: "hsl(9,65%,75%)" }}>Geraina POS by DagangOS</p>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Kasir & Stok Pintar<br /> untuk Toko Indonesia
          </h2>
          <p className="text-white/70">Kelola penjualan, stok, supplier, dan laporan toko dari satu aplikasi.</p>
        </div>
        <p className="text-white/50 text-xs">© Geraina POS by DagangOS</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-xl font-bold">Geraina POS</span>
              <span className="text-xs text-[hsl(var(--muted))] mt-1 font-semibold">by DagangOS</span>
            </div>
            <h1 className="font-display text-3xl font-bold">Masuk</h1>
            <p className="text-sm text-[hsl(var(--muted))] mt-1.5" data-testid="login-tagline">
              Kasir & Stok Pintar untuk Toko Indonesia
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label-tiny">Email</label>
              <input
                type="email"
                className="input-field mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                placeholder="owner@geraina.com"
              />
            </div>
            <div>
              <label className="label-tiny">Password</label>
              <input
                type="password"
                className="input-field mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="login-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit-btn">
            {loading ? "Memproses…" : "Masuk"} <ArrowRight size={16} />
          </button>

          <p className="text-sm text-center text-[hsl(var(--muted))]">
            Belum punya toko?{" "}
            <Link to="/geraina/register" className="text-[hsl(var(--primary))] font-semibold" data-testid="login-to-register-link">
              Daftar gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
