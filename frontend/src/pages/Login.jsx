import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight, ShoppingBag, ScanLine, Boxes } from "lucide-react";

const JAKARTA = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const ACCENT = "#0d9488";
const ACCENT_DARK = "#0b7d72";
const TINT = "#e3f4f1";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, login } = useAuth();

  if (user) return <Navigate to="/geraina/app/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/geraina/app/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Email atau kata sandi tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase = {
    width: "100%",
    borderRadius: "0.75rem",
    border: "1px solid #dfe6e3",
    padding: "0.7rem 1rem",
    fontSize: "0.9rem",
    color: "#0f2622",
    outline: "none",
    transition: "border-color .15s, box-shadow .15s",
  };
  const focusOn = (e) => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${TINT}`; };
  const focusOff = (e) => { e.target.style.borderColor = "#dfe6e3"; e.target.style.boxShadow = "none"; };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: JAKARTA, background: "#f7fbfa" }}>
      {/* Brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(155deg, #0f766e 0%, #0a4f49 100%)` }}
        data-testid="login-side"
      >
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full" style={{ background: "rgba(255,255,255,.06)" }} />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,.05)" }} />

        <Link to="/geraina" className="relative flex items-center gap-2.5 text-white">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,.14)" }}>
            <ShoppingBag size={18} />
          </span>
          <span className="font-bold text-lg" style={{ fontFamily: JAKARTA }}>Geraina POS</span>
          <span className="text-xs font-medium text-white/60">by DagangOS</span>
        </Link>

        <div className="relative text-white max-w-md">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80" /> Retail & Toko OS
          </span>
          <h2 className="text-4xl font-extrabold leading-tight" style={{ fontFamily: JAKARTA, letterSpacing: "-.02em" }}>
            Kasir pintar untuk toko Indonesia.
          </h2>
          <p className="text-white/70 mt-4 leading-relaxed">
            Scan, tambah, bayar — di bawah 100ms. Kelola stok grosir, harga bertingkat, dan laporan dari satu dasbor.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <li className="flex items-center gap-3"><ScanLine size={18} className="text-white/70" /> Kasir cepat & sinkron barcode scanner</li>
            <li className="flex items-center gap-3"><Boxes size={18} className="text-white/70" /> Stok grosir & struk thermal 80mm</li>
          </ul>
        </div>

        <p className="relative text-white/40 text-xs">© 2026 Geraina POS · DagangOS Digital Indonesia</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: ACCENT }}>
              <ShoppingBag size={18} />
            </span>
            <span className="font-bold text-lg" style={{ fontFamily: JAKARTA, color: "#0f2622" }}>Geraina POS</span>
            <span className="text-xs font-medium" style={{ color: "#6d857f" }}>by DagangOS</span>
          </div>

          <h1 className="text-2xl font-extrabold" style={{ fontFamily: JAKARTA, color: "#0f2622", letterSpacing: "-.02em" }}>
            Masuk ke Geraina POS
          </h1>
          <p className="text-sm mt-1.5 mb-7" style={{ color: "#5f766f" }}>
            Kasir &amp; stok pintar untuk toko Indonesia.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#22423b" }} data-testid="login-email-label">Alamat email</label>
              <input type="email" required data-testid="login-email-input" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="nama@toko.com"
                style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#22423b" }} data-testid="login-password-label">Kata sandi</label>
              <input type="password" required data-testid="login-password-input" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                style={inputBase} onFocus={focusOn} onBlur={focusOff} />
            </div>
          </div>

          {error && <p className="text-sm mt-4" style={{ color: "#c0392b" }} data-testid="login-error">{error}</p>}

          <button type="submit" disabled={loading} data-testid="login-submit-btn"
            className="w-full mt-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity"
            style={{ background: loading ? ACCENT_DARK : ACCENT, opacity: loading ? 0.8 : 1 }}>
            {loading ? "Memproses…" : "Masuk"} {!loading && <ArrowRight size={16} />}
          </button>

          <p className="text-sm text-center mt-6" style={{ color: "#5f766f" }}>
            Belum punya toko?{" "}
            <Link to="/geraina/register" className="font-semibold" style={{ color: ACCENT }} data-testid="login-to-register-link">Daftar gratis</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
