import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight, ScanLine, Boxes, Receipt, BarChart3, FileSpreadsheet, ShieldCheck, Check } from "lucide-react";

const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const TEAL = "#0d9488";
const TEAL_DARK = "#0b7d72";
const INK = "#0f2622";
const BODY = "#44534a";
const MUTED = "#7a877e";
const LINE = "#e6ece8";
const WA = "https://wa.me/628999155182?text=Halo%20Geraina%20POS%2C%20saya%20tertarik%20dengan%20layanan%20kasir%20digital%20Anda.";

const FEATURES = [
  { icon: ScanLine, t: "Kasir super cepat", d: "Scan barcode, tambah, dan bayar dalam hitungan detik — di bawah 100ms." },
  { icon: Boxes, t: "Stok grosir pintar", d: "SKU multi-varian, harga bertingkat, dan notifikasi batas pesan ulang." },
  { icon: Receipt, t: "Struk & invoice PDF", d: "Thermal 80mm untuk kasir, A4 untuk B2B dan keperluan pajak." },
  { icon: BarChart3, t: "Laporan real-time", d: "Penjualan harian, stok menipis, dan produk terlaris — semua langsung." },
  { icon: FileSpreadsheet, t: "Impor Excel/CSV", d: "Pindahkan ribuan produk dari spreadsheet dalam satu klik." },
  { icon: ShieldCheck, t: "Pembayaran aman", d: "QRIS, e-wallet, dan kartu terintegrasi dengan webhook tertanda." },
];

function Nav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: "rgba(255,255,255,.82)", borderColor: LINE }} data-testid="landing-nav">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/geraina" className="flex items-center gap-2.5" data-testid="landing-logo">
          <img src="/assets/brand/geraina-icon.png" alt="" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg" style={{ fontFamily: JK, color: INK }}>Geraina POS</span>
          <span className="text-xs font-medium" style={{ color: MUTED }}>by DagangOS</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: BODY }}>
          <a href="#fitur" className="hover:opacity-70">Fitur</a>
          <Link to="/geraina/pricing" className="hover:opacity-70">Harga</Link>
          <a href={WA} target="_blank" rel="noopener noreferrer" className="hover:opacity-70" style={{ color: TEAL }}>Hubungi Kami</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/geraina/app/dashboard" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid="nav-dashboard-btn">Buka Dashboard →</Link>
          ) : (
            <>
              <Link to="/geraina/login" className="px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-50" style={{ color: INK }} data-testid="nav-login-btn">Masuk</Link>
              <Link to="/geraina/register" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid="nav-register-btn">Mulai Gratis</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PosMockup() {
  const items = [["Indomie Goreng", "Rp 3.500"], ["Aqua 600ml", "Rp 4.000"], ["Kopi Sachet", "Rp 2.000"], ["Beras 1kg", "Rp 13.000"]];
  return (
    <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: LINE, boxShadow: "0 40px 80px -40px rgba(13,148,136,.35)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: LINE, background: "#f4faf8" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d5ece6" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d5ece6" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#d5ece6" }} />
        <span className="ml-2 text-xs font-semibold" style={{ color: MUTED }}>Geraina POS — Kasir</span>
      </div>
      <div className="p-5 grid grid-cols-5 gap-4">
        <div className="col-span-3 grid grid-cols-2 gap-2">
          {items.map(([n, p]) => (
            <div key={n} className="rounded-xl border p-2.5" style={{ borderColor: LINE }}>
              <p className="text-xs font-semibold leading-tight" style={{ color: INK }}>{n}</p>
              <p className="text-[11px] mt-1" style={{ color: MUTED }}>{p}</p>
            </div>
          ))}
        </div>
        <div className="col-span-2 rounded-xl border p-3 flex flex-col" style={{ borderColor: LINE, background: "#f4faf8" }}>
          <p className="text-[11px] font-semibold mb-2" style={{ color: MUTED }}>Keranjang</p>
          <div className="space-y-1.5 text-xs flex-1">
            <div className="flex justify-between"><span style={{ color: MUTED }}>2× Indomie</span><span className="font-semibold" style={{ color: INK }}>Rp 7.000</span></div>
            <div className="flex justify-between"><span style={{ color: MUTED }}>1× Aqua</span><span className="font-semibold" style={{ color: INK }}>Rp 4.000</span></div>
          </div>
          <div className="border-t mt-2 pt-2 flex justify-between items-center" style={{ borderColor: LINE }}>
            <span className="text-xs" style={{ color: MUTED }}>Total</span><span className="font-bold" style={{ fontFamily: JK, color: TEAL }}>Rp 11.000</span>
          </div>
          <div className="mt-2 w-full py-2 rounded-lg text-white text-center text-xs font-semibold" style={{ background: TEAL }}>Bayar</div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ fontFamily: JK, background: "#fff", color: BODY }}>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-20 pb-14 grid lg:grid-cols-2 gap-12 items-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" aria-hidden="true">
          <defs>
            <pattern id="circuitGerainaHero" width="140" height="140" patternUnits="userSpaceOnUse">
              <g fill="none" stroke={TEAL} strokeOpacity=".08" strokeWidth="1.5">
                <path d="M18 18 L18 55 L70 55 L70 100" />
                <path d="M120 10 L120 45 L95 45 L95 130" />
                <path d="M40 130 L40 95 L10 95" />
              </g>
              <g fill={TEAL} fillOpacity=".12">
                <circle cx="18" cy="18" r="3" /><circle cx="70" cy="100" r="3" />
                <circle cx="120" cy="10" r="2.4" /><circle cx="95" cy="130" r="2.4" />
                <circle cx="40" cy="130" r="2.4" /><circle cx="10" cy="95" r="2.4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuitGerainaHero)" />
        </svg>
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium mb-6" style={{ borderColor: LINE, color: BODY }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: TEAL }} /> Retail & Toko OS · bagian dari DagangOS
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05]" style={{ fontFamily: JK, color: INK, letterSpacing: "-.02em" }} data-testid="hero-title">
            Kasir &amp; stok pintar untuk <span style={{ color: TEAL }}>toko Indonesia.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ color: BODY }}>
            Kelola penjualan, stok, supplier, dan laporan dari satu aplikasi. Cepat, andal, dan 100% Bahasa Indonesia.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
            <Link to="/geraina/register" className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm sm:text-base" style={{ background: TEAL }} data-testid="hero-cta-primary">Mulai gratis</Link>
            <Link to="/geraina/pricing" className="px-6 py-3.5 rounded-xl border font-semibold text-sm sm:text-base" style={{ borderColor: LINE, color: INK }} data-testid="hero-cta-secondary">Lihat harga</Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center lg:justify-start" style={{ color: MUTED }}>
            <span className="flex items-center gap-1.5"><Check size={15} style={{ color: TEAL }} /> Tanpa kartu kredit</span>
            <span className="flex items-center gap-1.5"><Check size={15} style={{ color: TEAL }} /> Siap dalam 5 menit</span>
          </div>
        </div>
        <div className="transition-transform duration-500 ease-out hover:-translate-y-1.5">
          <PosMockup />
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="border-y" style={{ borderColor: LINE, background: "#f7fbfa" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: TEAL }}>Fitur</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 leading-tight" style={{ fontFamily: JK, color: INK }}>Semua yang toko Anda butuhkan</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="group relative rounded-2xl p-6 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(15,38,34,.04)" }}>
                <div className="absolute top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" style={{ background: TEAL }} />
                <f.icon size={26} strokeWidth={1.75} style={{ color: TEAL }} />
                <h3 className="font-bold text-lg mt-4" style={{ fontFamily: JK, color: INK }}>{f.t}</h3>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: BODY }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="rounded-3xl px-6 sm:px-16 py-16 text-center relative overflow-hidden" style={{ background: `linear-gradient(155deg, #0f766e, #0a4f49)` }}>
          <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,.07)" }} />
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,.07)" }} />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold text-white max-w-xl mx-auto leading-tight" style={{ fontFamily: JK }}>Siap kelola toko Anda lebih rapi?</h2>
          <p className="relative mt-4 max-w-md mx-auto text-sm sm:text-base" style={{ color: "#cdeae4" }}>Mulai gratis hari ini. Tanpa kartu kredit, langsung pakai.</p>
          <div className="relative mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link to="/geraina/register" className="px-7 py-3.5 rounded-xl bg-white font-semibold text-sm sm:text-base" style={{ color: TEAL_DARK }}>Mulai gratis sekarang</Link>
            <Link to="/geraina/login" className="px-7 py-3.5 rounded-xl border font-semibold text-sm sm:text-base text-white" style={{ borderColor: "rgba(255,255,255,.3)" }}>Masuk ke akun</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: LINE, background: "#f7fbfa" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: MUTED }}>
          <div className="flex items-center gap-2.5">
            <img src="/assets/brand/geraina-icon.png" alt="" className="w-6 h-6 object-contain" />
            <span>© 2026 Geraina POS · DagangOS Digital Indonesia</span>
          </div>
          <div className="flex gap-6">
            <Link to="/geraina/pricing" className="hover:opacity-70">Harga</Link>
            <a href={WA} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">Hubungi Kami</a>
            <a href="/" className="hover:opacity-70">DagangOS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
