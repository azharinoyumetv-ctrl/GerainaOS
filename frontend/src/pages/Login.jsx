import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, login } = useAuth();

  if (user) return <Navigate to="/geraina/app/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/geraina/app/dashboard");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Email atau kata sandi tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-public public-geraina auth-page">
      <header className="auth-header">
        <Link to="/geraina" className="auth-brand">
          <img src="/assets/brand/geraina-icon.png" alt="" />
          <b>Geraina POS</b>
          <small>by DagangOS</small>
        </Link>
        <nav aria-label="Navigasi akun Geraina">
          <Link to="/geraina/pricing">Lihat harga</Link>
          <Link to="/geraina/register">Mulai gratis</Link>
        </nav>
      </header>

      <main className="auth-main">
        <section className="auth-story" aria-labelledby="geraina-login-story">
          <span className="auth-kicker">Geraina · Retail operations</span>
          <h2 id="geraina-login-story">Masuk kembali ke alur toko Anda.</h2>
          <p>Kasir, inventori, pembelian, supplier, pelanggan, dan laporan tetap berada dalam satu ruang kerja yang terhubung.</p>
          <div className="auth-scene" aria-hidden="true">
            <div className="auth-device auth-device--retail">
              <div className="auth-device__bar"><b>Geraina POS</b><span>Kasir aktif</span></div>
              <div className="auth-device__body">
                <div className="auth-device__catalog"><i /><i /><i /><i /></div>
                <div className="auth-device__total"><small>Total</small><b>Rp 29.000</b><span>Bayar</span></div>
              </div>
            </div>
            <span className="auth-node">POS</span>
            <span className="auth-node">STK</span>
            <span className="auth-node">RPT</span>
          </div>
        </section>

        <section className="auth-form-wrap">
          <form onSubmit={submit} className="auth-form" data-testid="login-form">
            <h1>Masuk ke Geraina POS</h1>
            <p>Gunakan akun DagangOS yang terhubung dengan toko Anda.</p>

            <div className="auth-field">
              <label htmlFor="geraina-login-email" data-testid="login-email-label">Alamat email</label>
              <input id="geraina-login-email" type="email" name="email" autoComplete="email" required data-testid="login-email-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@toko.com" />
            </div>

            <div className="auth-field">
              <label htmlFor="geraina-login-password" data-testid="login-password-label">Kata sandi</label>
              <input id="geraina-login-password" type="password" name="password" autoComplete="current-password" required data-testid="login-password-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
            </div>

            {error && <p className="auth-error" role="alert" data-testid="login-error">{error}</p>}

            <button type="submit" disabled={loading} data-testid="login-submit-btn" className="auth-submit">
              {loading ? "Memproses…" : "Masuk"} {!loading && <ArrowRight size={17} />}
            </button>

            <p className="auth-switch">Belum punya toko? <Link to="/geraina/register" data-testid="login-to-register-link">Daftar gratis</Link></p>
          </form>
        </section>
      </main>

      <footer className="public-contact-footer">
        <span>© 2026 Geraina POS · PT DagangOS Digital Indonesia</span>
        <nav aria-label="Tautan perusahaan"><a href="/sumber-daya">Kontak</a><a href="/">DagangOS</a></nav>
      </footer>
    </div>
  );
}
