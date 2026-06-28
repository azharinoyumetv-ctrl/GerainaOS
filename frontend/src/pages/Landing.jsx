import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  Leaf, Check, ArrowRight, Smartphone, Receipt, Banknote, BarChart3, Zap, Shield,
  ScanBarcode, CreditCard, Users, Package, Truck, ClipboardList, UserCheck,
  Wifi, WifiOff, Printer, Monitor, Tablet, ChevronDown, QrCode, Globe, FileText,
  Star, TrendingUp, ShieldCheck, Download, Apple, Chrome, MonitorSmartphone
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/api/client";
import { fmtIDR } from "@/api/client";

const HERO_IMG = "https://customer-assets.emergentagent.com/job_dagangos-features/artifacts/0kij0lxo_ChatGPT%20Image%20Jun%2010%2C%202026%2C%2005_42_03%20PM.png";

/* ─────────────────────── NAV ─────────────────────── */
function Nav() {
  const { user } = useAuth();
  return (
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]/80 backdrop-blur-md sticky top-0 z-50" data-testid="landing-nav">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/geraina" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="landing-logo">
          <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina <span className="text-[hsl(var(--muted))] text-sm font-medium">by DagangOS</span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium text-[hsl(var(--foreground))] items-center">
          <a href="#features" className="hover:text-[hsl(var(--primary))] transition-colors" data-testid="nav-features">Fitur</a>
          <a href="#modules" className="hover:text-[hsl(var(--primary))] transition-colors" data-testid="nav-modules">Modul</a>
          <Link to="/geraina/pricing" className="hover:text-[hsl(var(--primary))] transition-colors" data-testid="nav-pricing">Harga</Link>
          <a href="#faq" className="hover:text-[hsl(var(--primary))] transition-colors" data-testid="nav-faq">FAQ</a>
          <a
            href="https://wa.me/628999155182?text=Halo%20Geraina%20POS%2C%20saya%20tertarik%20dengan%20layanan%20kasir%20digital%20Anda."
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors flex items-center gap-1"
          >
            Hubungi Kami
          </a>
        </nav>
        <div className="flex gap-2">
          {user ? (
            <Link to="/geraina/app/dashboard" className="btn-primary" data-testid="nav-dashboard-btn">
              Buka Dashboard Software &rarr;
            </Link>
          ) : (
            <>
              <Link to="/geraina/login" className="btn-ghost" data-testid="nav-login-btn">Masuk</Link>
              <Link to="/geraina/register" className="btn-primary" data-testid="nav-register-btn">Mulai Gratis <ArrowRight size={14} /></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────── HERO ─────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6 animate-fadeup" data-testid="hero-content">
          <span className="pill pill-muted" data-testid="hero-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" /> Geraina POS by DagangOS
          </span>
          <h1 className="font-display text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]" data-testid="hero-title">
            Kasir & Stok Pintar<br />
            untuk <span className="text-[hsl(var(--primary))]">Toko Indonesia.</span>
          </h1>
          <p className="text-lg text-[hsl(var(--muted))] max-w-xl" data-testid="hero-subtitle">
            Kelola penjualan, stok, supplier, dan laporan toko dari satu aplikasi.
            Geraina POS membantu retail, minimarket, toko kelontong, dan UMKM Anda berkembang lebih cepat.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/geraina/register" className="btn-primary" data-testid="hero-cta-primary">
              Mulai Trial 14 Hari <ArrowRight size={16} />
            </Link>
            <Link to="/geraina/pricing" className="btn-outline" data-testid="hero-cta-secondary">
              Lihat Harga
            </Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[hsl(var(--muted))] pt-3" data-testid="hero-trust">
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[hsl(var(--accent))]" /> Tanpa kartu kredit</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[hsl(var(--accent))]" /> Setup &lt; 5 menit</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[hsl(var(--accent))]" /> Support Bahasa</span>
          </div>
        </div>

        <div className="lg:col-span-6 relative" data-testid="hero-image-wrap">
          <img
            src={HERO_IMG}
            alt="Pemilik toko Indonesia tersenyum di kasir modern dengan POS and pembayaran QRIS"
            className="w-full h-auto rounded-2xl"
            data-testid="hero-image"
          />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── FEATURES SPLIT (promo mockup left, cards right) ─────────────────── */
const FEATURES = [
  { icon: Smartphone, title: "POS Tablet Cepat", desc: "Antarmuka tap-friendly, scan & charge dalam hitungan detik." },
  { icon: Banknote, title: "QRIS + E-Wallet", desc: "OVO, DANA, ShopeePay, LinkAja terintegrasi via Xendit." },
  { icon: Receipt, title: "Struk & Invoice PDF", desc: "Thermal 80mm untuk kasir, A4 untuk B2B & pajak." },
  { icon: BarChart3, title: "Laporan Real-time", desc: "Penjualan harian, stok rendah, produk terlaris — semua live." },
  { icon: Zap, title: "Import Excel/CSV", desc: "Pindahkan 1000+ produk dari spreadsheet dalam satu klik." },
  { icon: Shield, title: "Webhook Aman", desc: "Status pembayaran update otomatis via webhook tertanda." },
];

function Features() {
  return (
    <section id="features" className="py-24 border-t border-[hsl(var(--border))]" data-testid="features-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left: High-quality promo mockup showing actual dashboard and phone layout */}
          <div className="lg:col-span-6 relative" data-testid="features-image-wrap">
            <img
              src="/hero_promo.jpg"
              alt="Mockup Geraina POS Kasir dan Stok Pintar"
              className="w-full h-auto rounded-2xl border border-[hsl(var(--border))] shadow-xl"
              data-testid="features-image"
            />
          </div>

          {/* Right: Heading and Features list */}
          <div className="lg:col-span-6 space-y-8">
            <div>
              <span className="label-tiny" data-testid="features-eyebrow">Mengapa Geraina POS</span>
              <h2 className="font-display text-4xl font-bold mt-2 leading-tight" data-testid="features-title">
                Built untuk UMKM, dipoles untuk skala franchise.
              </h2>
              <p className="text-[hsl(var(--muted))] mt-3 text-lg" data-testid="features-subtitle">
                DagangOS membantu UMKM mengelola bisnis lebih rapi.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="card-surface p-5 hover:border-[hsl(var(--primary))] transition-colors group flex items-start gap-4" data-testid={`feature-card-${i}`}>
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--primary))] group-hover:text-white transition-colors">
                    <f.icon size={18} />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold mb-1 leading-snug">{f.title}</h3>
                    <p className="text-xs text-[hsl(var(--muted))] leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── INTERACTIVE MODULE TABS (Odoo-style) ──────────────── */
const MODULE_TABS = [
  {
    id: "kasir",
    label: "Kasir & Pembayaran",
    icon: ScanBarcode,
    headline: "Transaksi secepat kilat, pembayaran fleksibel.",
    description: "Antarmuka kasir yang dioptimalkan untuk kecepatan. Scan barcode, tap produk, terima semua jenis pembayaran — selesai dalam hitungan detik.",
    features: [
      { icon: ScanBarcode, text: "Scan barcode USB/Bluetooth otomatis" },
      { icon: QrCode, text: "QRIS, OVO, DANA, ShopeePay, GoPay" },
      { icon: CreditCard, text: "Tunai, kartu debit/kredit, split payment" },
      { icon: Receipt, text: "Struk thermal 80mm & invoice PDF A4" },
      { icon: Users, text: "Manajemen pelanggan di layar kasir" },
      { icon: ShieldCheck, text: "Pembayaran aman via webhook Xendit" },
    ],
  },
  {
    id: "stok",
    label: "Stok & Inventaris",
    icon: Package,
    headline: "Pantau stok dari mana saja, kapan saja.",
    description: "Manajemen inventaris lengkap dengan notifikasi stok rendah, transfer antar-cabang, dan purchase order ke supplier — semua otomatis.",
    features: [
      { icon: Package, text: "Pelacakan stok real-time per SKU" },
      { icon: Truck, text: "Purchase order & goods receiving" },
      { icon: ClipboardList, text: "Stock opname & adjustment" },
      { icon: TrendingUp, text: "Alert otomatis saat stok menipis" },
      { icon: Zap, text: "Import massal via Excel/CSV" },
      { icon: Globe, text: "Transfer stok antar outlet/cabang" },
    ],
  },
  {
    id: "crm",
    label: "CRM & Membership",
    icon: Users,
    headline: "Kenali pelanggan. Bangun loyalitas.",
    description: "Kelola database pelanggan, program membership multi-tier, poin loyalty, dan catatan hutang piutang dalam satu tempat.",
    features: [
      { icon: Users, text: "Database pelanggan tak terbatas" },
      { icon: Star, text: "Membership tier: Bronze → Platinum" },
      { icon: CreditCard, text: "Sistem poin & reward otomatis" },
      { icon: FileText, text: "Hutang piutang (A/R & A/P)" },
      { icon: Receipt, text: "Riwayat transaksi per pelanggan" },
      { icon: UserCheck, text: "Segmentasi & targeting pelanggan" },
    ],
  },
  {
    id: "laporan",
    label: "Laporan & Karyawan",
    icon: BarChart3,
    headline: "Data akurat. Keputusan tepat.",
    description: "Dashboard analytics real-time, absensi karyawan, dan role-based access control untuk menjaga keamanan data toko Anda.",
    features: [
      { icon: BarChart3, text: "Dashboard penjualan harian/mingguan/bulanan" },
      { icon: TrendingUp, text: "Produk terlaris & margin analysis" },
      { icon: UserCheck, text: "Absensi & jadwal karyawan" },
      { icon: Shield, text: "Role: Owner, Manager, Kasir, Gudang" },
      { icon: FileText, text: "Ekspor laporan ke PDF & Excel" },
      { icon: Globe, text: "Laporan multi-cabang terpusat" },
    ],
  },
];

function InteractiveModules() {
  const [active, setActive] = useState(0);
  const tab = MODULE_TABS[active];

  return (
    <section id="modules" className="py-24 bg-[hsl(var(--surface))] border-y border-[hsl(var(--border))]" data-testid="modules-section">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="label-tiny">Semua Modul yang Anda Butuhkan</span>
          <h2 className="font-display text-4xl lg:text-5xl font-extrabold mt-3 leading-tight">
            Lengkap <span className="text-[hsl(var(--primary))]">→</span> Intuitif
          </h2>
          <p className="text-[hsl(var(--muted))] mt-4 text-lg">
            Interface yang punya segalanya: begitu intuitif sehingga siapapun bisa menguasainya dalam hitungan menit, namun dikemas dengan fitur-fitur canggih.
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-12" data-testid="module-tabs">
          {MODULE_TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                active === i
                  ? "bg-[hsl(var(--primary))] text-white shadow-lg shadow-[hsl(var(--primary))]/20 scale-[1.02]"
                  : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--background))]"
              }`}
              data-testid={`module-tab-${t.id}`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <div className="grid lg:grid-cols-12 gap-10 items-start" key={tab.id} data-testid={`module-content-${tab.id}`}>
          {/* Left: headline + description */}
          <div className="lg:col-span-5 space-y-6 animate-fadeup">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]">
              <tab.icon size={18} />
              <span className="text-sm font-semibold">{tab.label}</span>
            </div>
            <h3 className="font-display text-3xl lg:text-4xl font-bold leading-tight">
              {tab.headline}
            </h3>
            <p className="text-[hsl(var(--muted))] text-lg leading-relaxed">
              {tab.description}
            </p>
          </div>

          {/* Right: feature list grid */}
          <div className="lg:col-span-7">
            <div className="grid sm:grid-cols-2 gap-3">
              {tab.features.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40 hover:shadow-sm transition-all duration-200 group"
                  style={{ animationDelay: `${i * 60}ms` }}
                  data-testid={`module-feature-${tab.id}-${i}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--primary))] group-hover:text-white transition-colors duration-200">
                    <feat.icon size={16} />
                  </div>
                  <span className="text-sm font-medium leading-snug pt-1.5">{feat.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── OFFLINE & HARDWARE SHOWCASE ──────────────── */
const DEVICES = [
  { icon: Tablet, label: "Tablet & iPad" },
  { icon: Monitor, label: "Laptop & Desktop" },
  { icon: Smartphone, label: "Smartphone" },
  { icon: Printer, label: "Printer Thermal" },
  { icon: ScanBarcode, label: "Barcode Scanner" },
  { icon: CreditCard, label: "EDC Terminal" },
];

function OfflineShowcase() {
  return (
    <section className="py-24" data-testid="offline-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Offline capability */}
          <div className="space-y-8">
            <span className="label-tiny">Reliabel & Fleksibel</span>
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold leading-tight">
              Bekerja <span className="text-[hsl(var(--accent))]">Offline</span>,<br />
              Sinkronisasi Otomatis.
            </h2>
            <p className="text-[hsl(var(--muted))] text-lg leading-relaxed max-w-lg">
              Internet mati? Tidak masalah. Geraina POS tetap berjalan dan mencatat semua transaksi secara lokal.
              Saat koneksi kembali, data langsung tersinkronisasi ke cloud — tanpa data hilang.
            </p>

            <div className="flex gap-6">
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[hsl(var(--success))]/8 border border-[hsl(var(--success))]/20">
                <WifiOff size={22} className="text-[hsl(var(--success))]" />
                <div>
                  <p className="text-sm font-bold">Mode Offline</p>
                  <p className="text-xs text-[hsl(var(--muted))]">Kasir tetap jalan</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[hsl(var(--primary))]/8 border border-[hsl(var(--primary))]/20">
                <Wifi size={22} className="text-[hsl(var(--primary))]" />
                <div>
                  <p className="text-sm font-bold">Auto Sync</p>
                  <p className="text-xs text-[hsl(var(--muted))]">Data aman di cloud</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Device compatibility grid */}
          <div className="space-y-6">
            <h3 className="font-display text-2xl font-bold">Semua Perangkat Welcome</h3>
            <p className="text-[hsl(var(--muted))] text-base">
              Geraina POS berjalan mulus di semua perangkat. Koneksikan ke barcode scanner, printer thermal, dan EDC terminal.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DEVICES.map((d, i) => (
                <div
                  key={d.label}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40 hover:shadow-md transition-all duration-200 group"
                  data-testid={`device-card-${i}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] flex items-center justify-center group-hover:bg-[hsl(var(--primary))] group-hover:text-white transition-colors duration-200">
                    <d.icon size={22} />
                  </div>
                  <span className="text-sm font-semibold text-center">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── INDONESIAN RETAIL FOCUS ──────────────── */
const LOCAL_FEATURES = [
  {
    icon: QrCode,
    title: "QRIS Universal",
    desc: "Terima pembayaran dari semua e-wallet & mobile banking Indonesia dengan satu QR code.",
  },
  {
    icon: FileText,
    title: "PPN 11% Otomatis",
    desc: "Kalkulasi pajak pertambahan nilai otomatis sesuai regulasi Indonesia di setiap transaksi.",
  },
  {
    icon: Package,
    title: "Kategori Lokal Siap Pakai",
    desc: "Langsung mulai dengan kategori Makanan, Minuman, Cemilan, Bumbu & Bahan yang sudah tersedia.",
  },
  {
    icon: Globe,
    title: "Bahasa Indonesia",
    desc: "Seluruh interface dalam Bahasa Indonesia. Cocok untuk karyawan dari berbagai latar belakang.",
  },
];

function LocalRetailFocus() {
  return (
    <section className="py-24 border-t border-[hsl(var(--border))]" data-testid="local-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="label-tiny">Dibuat Khusus untuk Indonesia</span>
          <h2 className="font-display text-4xl lg:text-5xl font-extrabold mt-3 leading-tight">
            Pahami bisnis lokal.<br />
            <span className="text-[hsl(var(--accent))]">Solusi yang mengerti Indonesia.</span>
          </h2>
          <p className="text-[hsl(var(--muted))] mt-4 text-lg">
            Bukan terjemahan dari software luar. Geraina POS dibangun dari nol untuk ekosistem retail Indonesia.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {LOCAL_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card-surface p-7 hover:border-[hsl(var(--accent))]/50 transition-all duration-200 group hover:shadow-lg"
              data-testid={`local-card-${i}`}
            >
              <div className="w-12 h-12 rounded-xl bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] flex items-center justify-center mb-5 group-hover:bg-[hsl(var(--accent))] group-hover:text-white transition-colors duration-200">
                <f.icon size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────── PRICING TEASER ──────────────── */
function PricingTeaser() {
  const [tiers, setTiers] = useState([]);
  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers(r.data)).catch(() => {});
  }, []);
  return (
    <section className="py-24 bg-[hsl(36,17%,95%)] border-y border-[hsl(var(--border))]" data-testid="pricing-teaser">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="label-tiny">Harga</span>
          <h2 className="font-display text-4xl font-bold mt-2">Mulai gratis. Bayar saat Anda siap.</h2>
          <p className="text-[hsl(var(--muted))] mt-3">5 paket. Mulai dari Rp 0, scale sampai Multi-Branch.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          {tiers.map((t) => {
            const price =
              t.id === "trial" ? "Gratis"
              : t.id === "multibranch" ? `${fmtIDR(t.price_idr_monthly)}+`
              : fmtIDR(t.price_idr_monthly);
            const period =
              t.id === "trial" ? "14 hari"
              : t.id === "multibranch" ? "/bulan, mulai"
              : "/bulan";
            return (
              <div key={t.id}
                   className={`card-surface p-5 flex flex-col justify-between ${t.highlight ? "border-[hsl(var(--accent))] shadow-sm ring-1 ring-[hsl(var(--accent))]/30 relative bg-[hsl(36,17%,99%)]" : ""}`}
                   data-testid={`pricing-teaser-card-${t.id}`}>
                <div>
                  {t.badge && <span className="pill pill-warning mb-2 inline-block text-[10px]">{t.badge}</span>}
                  <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  <p className="num-display font-display text-2xl font-extrabold mt-2 leading-tight">
                    {price}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted))]">{period}</p>
                  <p className="text-xs text-[hsl(var(--muted))] mt-2 mb-3 min-h-[32px]">{t.tagline}</p>
                  
                  <ul className="space-y-2 mt-4 mb-6 text-left text-xs border-t border-[hsl(var(--border))]/40 pt-4" data-testid={`pricing-teaser-features-${t.id}`}>
                    {t.features && t.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check size={14} className={`shrink-0 mt-0.5 ${t.highlight ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--primary))]"}`} />
                        <span className="leading-tight">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to="/geraina/pricing" className={`${t.highlight ? "btn-accent" : "btn-outline"} w-full text-xs mt-auto`} data-testid={`pricing-teaser-cta-${t.id}`}>
                  {t.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────── FAQ ACCORDION ──────────────── */
const FAQ_DATA = [
  {
    q: "Apakah Geraina POS bisa digunakan tanpa internet?",
    a: "Ya! Geraina POS memiliki mode offline penuh. Semua transaksi, penambahan produk, dan pencetakan struk tetap berjalan saat koneksi terputus. Data akan otomatis tersinkronisasi ke cloud begitu internet kembali aktif.",
  },
  {
    q: "Metode pembayaran apa saja yang didukung?",
    a: "Geraina POS mendukung pembayaran tunai, QRIS (semua e-wallet & mobile banking), OVO, DANA, ShopeePay, GoPay, LinkAja, kartu debit/kredit, dan split payment. Integrasi pembayaran digital diproses melalui gateway Xendit yang aman.",
  },
  {
    q: "Berapa lama waktu setup untuk toko baru?",
    a: "Kurang dari 5 menit. Setelah registrasi, toko Anda langsung dilengkapi dengan kategori produk default Indonesia (Makanan, Minuman, Cemilan, dll.), unit satuan, dan konfigurasi dasar. Anda bisa langsung mulai menambahkan produk dan bertransaksi.",
  },
  {
    q: "Apakah data saya aman?",
    a: "Sangat aman. Data Anda dienkripsi dan disimpan di cloud server berstandar enterprise. Setiap toko memiliki isolasi data penuh — tidak ada toko lain yang bisa mengakses data Anda. Kami juga mendukung backup otomatis harian.",
  },
  {
    q: "Perangkat apa yang kompatibel?",
    a: "Geraina POS berjalan di browser modern manapun — tablet Android/iPad, laptop Windows/Mac, dan desktop. Anda juga bisa mengkoneksikan barcode scanner USB/Bluetooth, printer thermal ESC/POS 80mm, dan EDC terminal untuk pengalaman kasir lengkap.",
  },
  {
    q: "Apakah bisa digunakan untuk multi-cabang?",
    a: "Ya! Dengan paket Multi-Branch, Anda dapat mengelola beberapa outlet dari satu dashboard pusat. Setiap cabang memiliki stok, karyawan, dan laporan terpisah, namun data penjualan dapat digabungkan untuk laporan konsolidasi.",
  },
  {
    q: "Apakah mendukung perhitungan pajak PPN?",
    a: "Ya. Geraina POS secara otomatis menghitung PPN 11% sesuai regulasi Indonesia. Anda bisa mengaktifkan atau menonaktifkan perhitungan pajak per produk, dan invoice yang dihasilkan sudah mencantumkan detail pajak secara lengkap.",
  },
];

function FAQItem({ item, isOpen, onClick }) {
  return (
    <div
      className={`border border-[hsl(var(--border))] rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? "bg-[hsl(var(--surface))] shadow-sm" : "bg-[hsl(var(--background))]"}`}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors hover:bg-[hsl(var(--surface))]"
        data-testid={`faq-toggle-${item.q.substring(0, 20).replace(/\s/g, "-")}`}
      >
        <span className="font-display text-base font-bold pr-4">{item.q}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-[hsl(var(--muted))] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <p className="px-6 pb-5 text-sm text-[hsl(var(--muted))] leading-relaxed">
          {item.a}
        </p>
      </div>
    </div>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="faq" className="py-24 border-t border-[hsl(var(--border))]" data-testid="faq-section">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="label-tiny">Pertanyaan Umum</span>
          <h2 className="font-display text-4xl font-extrabold mt-3">
            Frequently Asked Questions
          </h2>
          <p className="text-[hsl(var(--muted))] mt-3 text-lg">
            Jawaban cepat untuk pertanyaan yang paling sering ditanyakan oleh pemilik toko.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_DATA.map((item, i) => (
            <FAQItem
              key={i}
              item={item}
              isOpen={openIdx === i}
              onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────── DOWNLOAD APP ──────────────── */
const PLATFORMS = [
  {
    id: "android",
    label: "Android APK",
    sublabel: "Download langsung",
    icon: Smartphone,
    href: "#",
    color: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    id: "playstore",
    label: "Google Play",
    sublabel: "Segera hadir",
    icon: MonitorSmartphone,
    href: "#",
    color: "bg-[hsl(var(--primary))] hover:bg-[hsl(151,39%,24%)]",
    soon: true,
  },
  {
    id: "appstore",
    label: "App Store",
    sublabel: "Segera hadir",
    icon: Apple,
    href: "#",
    color: "bg-gray-900 hover:bg-gray-800",
    soon: true,
  },
  {
    id: "windows",
    label: "Windows",
    sublabel: "Desktop app",
    icon: Monitor,
    href: "#",
    color: "bg-blue-600 hover:bg-blue-700",
    soon: true,
  },
  {
    id: "macos",
    label: "macOS",
    sublabel: "Desktop app",
    icon: Apple,
    href: "#",
    color: "bg-gray-700 hover:bg-gray-600",
    soon: true,
  },
  {
    id: "webapp",
    label: "Web App",
    sublabel: "Buka di browser",
    icon: Chrome,
    href: "/geraina/login",
    color: "bg-[hsl(var(--accent))] hover:bg-[hsl(9,65%,60%)]",
    isLink: true,
  },
];

function DownloadApp() {
  return (
    <section className="py-24 bg-[hsl(var(--surface))] border-y border-[hsl(var(--border))]" data-testid="download-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="label-tiny">Download & Install</span>
          <h2 className="font-display text-4xl lg:text-5xl font-extrabold mt-3">
            Tersedia di <span className="text-[hsl(var(--primary))]">semua platform.</span>
          </h2>
          <p className="text-[hsl(var(--muted))] mt-4 text-lg max-w-2xl mx-auto">
            Gunakan Geraina POS di perangkat favorit Anda. Download aplikasi native atau langsung akses via web browser.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORMS.map((p) => {
            const Inner = () => (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <p.icon size={24} />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold leading-snug">{p.label}</p>
                    <p className="text-xs opacity-75">{p.sublabel}</p>
                  </div>
                </div>
                {p.soon ? (
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-white/20 px-2 py-0.5 rounded-full">Soon</span>
                ) : (
                  <Download size={18} className="opacity-70" />
                )}
              </>
            );

            if (p.isLink) {
              return (
                <Link
                  key={p.id}
                  to={p.href}
                  className={`flex items-center justify-between gap-3 px-5 py-4 rounded-xl text-white transition-all duration-200 ${p.color} ${p.soon ? "opacity-60 cursor-not-allowed" : "hover:shadow-lg hover:scale-[1.02]"}`}
                  data-testid={`download-${p.id}`}
                >
                  <Inner />
                </Link>
              );
            }

            return (
              <a
                key={p.id}
                href={p.href}
                className={`flex items-center justify-between gap-3 px-5 py-4 rounded-xl text-white transition-all duration-200 ${p.color} ${p.soon ? "opacity-60 pointer-events-none" : "hover:shadow-lg hover:scale-[1.02]"}`}
                data-testid={`download-${p.id}`}
                {...(p.soon ? {} : { download: true })}
              >
                <Inner />
              </a>
            );
          })}
        </div>

        <p className="text-center text-sm text-[hsl(var(--muted))] mt-8">
          <ShieldCheck size={14} className="inline mr-1.5 text-[hsl(var(--success))]" />
          Semua download aman & terverifikasi. Minimum Android 8.0 / iOS 15 / Windows 10.
        </p>
      </div>
    </section>
  );
}

/* ──────────────── FINAL CTA ──────────────── */
function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden" data-testid="final-cta">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/[0.03] to-[hsl(var(--accent))]/[0.03]" />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <h2 className="font-display text-4xl lg:text-5xl font-extrabold">
          Toko Anda layak punya POS sekelas franchise.
        </h2>
        <p className="text-[hsl(var(--muted))] mt-5 text-lg">14 hari trial. Tidak ada komitmen. Cabut kapan saja.</p>
        <div className="flex justify-center gap-3 mt-8">
          <Link to="/geraina/register" className="btn-primary" data-testid="final-cta-register">Mulai Trial Gratis <ArrowRight size={16} /></Link>
          <Link to="/geraina/pricing" className="btn-outline" data-testid="final-cta-pricing">Lihat Harga</Link>
        </div>
      </div>
    </section>
  );
}

/* ──────────────── TERMS & CONDITIONS MODAL ──────────────── */
function TermsModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadein">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-[hsl(var(--accent))]" size={20} />
            <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">Syarat & Ketentuan Geraina POS</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors p-1.5 rounded-lg hover:bg-black/5"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-[hsl(var(--muted))] leading-relaxed text-left">
          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">1. Lisensi Penggunaan</h4>
            <p>
              Geraina POS memberikan lisensi non-eksklusif, tidak dapat dipindahtangankan, dan terbatas kepada Anda untuk mengakses serta menggunakan platform kasir pintar kami sesuai dengan paket langganan yang dipilih. Anda dilarang keras melakukan rekayasa balik (reverse engineering), memodifikasi, atau mendistribusikan ulang kode sumber aplikasi ini.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">2. Kewajiban & Akun Pengguna</h4>
            <p>
              Anda bertanggung jawab penuh untuk menjaga kerahasiaan informasi akun, termasuk kata sandi login sistem kasir offline maupun backoffice. Semua aktivitas yang terjadi di bawah akun Anda adalah tanggung jawab Anda sepenuhnya. Anda wajib memberikan data bisnis yang akurat dan sah.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">3. Kebijakan Pembayaran & Langganan</h4>
            <p>
              Layanan kami ditawarkan dengan metode pembayaran berulang (bulanan/tahunan) sesuai paket yang dipilih. Keterlambatan pembayaran dapat mengakibatkan pembatasan akses sementara atau penghentian layanan. Semua biaya yang telah dibayarkan tidak dapat dikembalikan (non-refundable), kecuali ditentukan lain oleh kebijakan DagangOS.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">4. Keamanan & Cadangan Data</h4>
            <p>
              Kami mengimplementasikan langkah-langkah keamanan tingkat industri untuk melindungi data transaksi dan pelanggan Anda. Transaksi dicadangkan otomatis ke server cloud aman kami. Namun, Anda disarankan untuk melakukan ekspor data berkala untuk arsip mandiri Anda.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">5. Batasan Tanggung Jawab</h4>
            <p>
              Geraina POS dan perusahaan induknya, DagangOS, tidak bertanggung jawab atas kerugian finansial, kehilangan data, atau gangguan bisnis yang disebabkan oleh kegagalan koneksi internet lokal, kerusakan perangkat keras pengguna, atau penggunaan platform yang tidak sesuai instruksi.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">6. Hukum yang Berlaku</h4>
            <p>
              Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Republik Indonesia. Setiap perselisihan yang timbul dari atau terkait dengan layanan ini akan diselesaikan secara musyawarah, atau melalui pengadilan yang berwenang di wilayah hukum domisili DagangOS.
            </p>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex justify-end bg-[hsl(var(--surface))]">
          <button 
            onClick={onClose} 
            className="btn-primary text-xs px-5 py-2.5"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── FLOATING WHATSAPP ──────────────── */
function FloatingWhatsApp() {
  return (
    <a
      href="https://wa.me/628999155182?text=Halo%20Geraina%20POS%2C%20saya%20tertarik%20dengan%20layanan%20kasir%20digital%20Anda."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold text-sm"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
      </span>
      <span>Tanya via WhatsApp</span>
    </a>
  );
}

/* ──────────────── FOOTER ──────────────── */
function Footer({ onOpenTerms }) {
  return (
    <footer className="border-t border-[hsl(var(--border))] py-10 bg-white" data-testid="landing-footer">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-6 items-center justify-between text-sm text-[hsl(var(--muted))]">
        <span className="font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
          <Leaf className="text-[hsl(var(--accent))]" size={18} /> Geraina POS
        </span>
        <div className="flex flex-wrap justify-center gap-6 text-xs font-semibold">
          <button 
            onClick={onOpenTerms} 
            className="hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Syarat & Ketentuan
          </button>
          <a 
            href="https://wa.me/628999155182?text=Halo%20Geraina%20POS%2C%20saya%20ingin%20konsultasi%20mengenai%20sistem%20kasir." 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-emerald-600 transition-colors text-emerald-600 font-bold"
          >
            Hubungi Kami (WhatsApp)
          </a>
        </div>
        <span>© 2026 DagangOS. Dibuat untuk UMKM Indonesia.</span>
      </div>
    </footer>
  );
}

/* ──────────────── PAGE ASSEMBLY ──────────────── */
export default function Landing() {
  const { user } = useAuth();
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token") || localStorage.getItem("dapuros_token");
    if (user || token) {
      window.location.replace("/geraina/app/dashboard");
    }
  }, [user]);

  return (
    <div data-testid="landing-page" className="relative">
      <Nav />
      <Hero />
      <Features />
      <InteractiveModules />
      <OfflineShowcase />
      <LocalRetailFocus />
      <PricingTeaser />
      <FAQ />
      <DownloadApp />
      <FinalCTA />
      <Footer onOpenTerms={() => setIsTermsOpen(true)} />
      
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      <FloatingWhatsApp />
    </div>
  );
}
