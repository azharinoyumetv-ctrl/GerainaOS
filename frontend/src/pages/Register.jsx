import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Register() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, storeName);
      nav("/geraina/app/dashboard");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Gagal mendaftar.");
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
        <nav aria-label="Navigasi pendaftaran Geraina">
          <Link to="/geraina/pricing">Lihat harga</Link>
          <Link to="/geraina/login">Masuk</Link>
        </nav>
      </header>

      <main className="auth-main auth-main--register">
        <section className="auth-story" aria-labelledby="geraina-register-story">
          <span className="auth-kicker">Geraina · Retail operations</span>
          <h2 id="geraina-register-story">Mulai alur toko yang terhubung.</h2>
          <p>Buat ruang kerja retail untuk kasir, inventori, pembelian, supplier, pelanggan, dan laporan dalam satu sistem.</p>
          <div className="auth-scene" aria-hidden="true">
            <div className="auth-device auth-device--retail">
              <div className="auth-device__bar"><b>Geraina POS</b><span>Toko baru</span></div>
              <div className="auth-device__body">
                <div className="auth-device__catalog"><i /><i /><i /><i /></div>
                <div className="auth-device__total"><small>SIAP DIGUNAKAN</small><b>1 toko</b><span>Mulai</span></div>
              </div>
            </div>
            <span className="auth-node">POS</span>
            <span className="auth-node">STK</span>
            <span className="auth-node">RPT</span>
          </div>
        </section>

        <section className="auth-form-wrap">
          <form onSubmit={submit} className="auth-form" data-testid="register-form">
            <h1>Buat akun Geraina POS</h1>
            <p>Mulai trial 14 hari tanpa kartu kredit.</p>

            <div className="auth-field">
              <label htmlFor="geraina-register-store" data-testid="register-store-label">Nama toko</label>
              <input id="geraina-register-store" name="organization" autoComplete="organization" required data-testid="register-store-input" value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Kopi Senja Bandung" />
            </div>

            <div className="auth-field">
              <label htmlFor="geraina-register-email" data-testid="register-email-label">Email pemilik</label>
              <input id="geraina-register-email" type="email" name="email" autoComplete="email" required data-testid="register-email-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@toko.com" />
            </div>

            <div className="auth-field">
              <label htmlFor="geraina-register-password" data-testid="register-password-label">Kata sandi</label>
              <input id="geraina-register-password" type="password" name="new-password" autoComplete="new-password" required minLength={6} data-testid="register-password-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" />
            </div>

            {error && <p className="auth-error" role="alert" data-testid="register-error">{error}</p>}

            <button type="submit" disabled={loading} data-testid="register-submit-btn" className="auth-submit">
              {loading ? "Memproses..." : "Mulai Trial 14 Hari"} {!loading && <ArrowRight size={17} />}
            </button>

            <p className="auth-switch">Sudah punya akun? <Link to="/geraina/login" data-testid="register-to-login-link">Masuk</Link></p>
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
