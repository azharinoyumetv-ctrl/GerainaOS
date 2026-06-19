import { Link } from "react-router-dom";
import { Leaf, Check, ArrowRight, Smartphone, Receipt, Banknote, BarChart3, Zap, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import api from "@/api/client";
import { fmtIDR } from "@/api/client";

const HERO_IMG = "/hero_promo.jpg";

function Nav() {
  return (
    <header className="border-b border-[hsl(var(--border))]" data-testid="landing-nav">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="landing-logo">
          <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina <span className="text-[hsl(var(--muted))] text-sm font-medium">by DagangOS</span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium text-[hsl(var(--foreground))]">
          <a href="#features" className="hover:text-[hsl(var(--primary))]" data-testid="nav-features">Fitur</a>
          <Link to="/pricing" className="hover:text-[hsl(var(--primary))]" data-testid="nav-pricing">Harga</Link>
          <a href="#faq" className="hover:text-[hsl(var(--primary))]" data-testid="nav-faq">FAQ</a>
        </nav>
        <div className="flex gap-2">
          <Link to="/login" className="btn-ghost" data-testid="nav-login-btn">Masuk</Link>
          <Link to="/register" className="btn-primary" data-testid="nav-register-btn">Mulai Gratis <ArrowRight size={14} /></Link>
        </div>
      </div>
    </header>
  );
}

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
            Geraina POS membantu warung kopi, butik fashion, dan UMKM Anda berkembang lebih cepat.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/register" className="btn-primary" data-testid="hero-cta-primary">
              Mulai Trial 14 Hari <ArrowRight size={16} />
            </Link>
            <Link to="/pricing" className="btn-outline" data-testid="hero-cta-secondary">
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
            alt="Pemilik toko Indonesia tersenyum di kasir modern dengan POS dan pembayaran QRIS"
            className="w-full h-auto rounded-2xl"
            data-testid="hero-image"
          />
        </div>
      </div>
    </section>
  );
}

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
        <div className="max-w-2xl mb-14">
          <span className="label-tiny" data-testid="features-eyebrow">Mengapa Geraina POS</span>
          <h2 className="font-display text-4xl font-bold mt-2" data-testid="features-title">
            Built untuk UMKM, dipoles untuk skala franchise.
          </h2>
          <p className="text-[hsl(var(--muted))] mt-3 text-lg" data-testid="features-subtitle">
            DagangOS membantu UMKM mengelola bisnis lebih rapi.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card-surface p-7 hover:border-[hsl(var(--primary))] transition-colors group" data-testid={`feature-card-${i}`}>
              <div className="w-11 h-11 rounded-lg bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] grid place-items-center mb-4 group-hover:bg-[hsl(var(--primary))] group-hover:text-white transition-colors">
                <f.icon size={20} />
              </div>
              <h3 className="font-display text-lg font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
                   className={`card-surface p-5 ${t.highlight ? "border-[hsl(var(--accent))] shadow-sm ring-1 ring-[hsl(var(--accent))]/30 relative" : ""}`}
                   data-testid={`pricing-teaser-card-${t.id}`}>
                {t.badge && <span className="pill pill-warning mb-2 inline-block text-[10px]">{t.badge}</span>}
                <h3 className="font-display text-lg font-bold">{t.name}</h3>
                <p className="num-display font-display text-2xl font-extrabold mt-2 leading-tight">
                  {price}
                </p>
                <p className="text-xs text-[hsl(var(--muted))]">{period}</p>
                <p className="text-xs text-[hsl(var(--muted))] mt-2 mb-3 min-h-[32px]">{t.tagline}</p>
                <Link to="/pricing" className={`${t.highlight ? "btn-accent" : "btn-outline"} w-full text-xs`} data-testid={`pricing-teaser-cta-${t.id}`}>
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

function FinalCTA() {
  return (
    <section className="py-24" data-testid="final-cta">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="font-display text-4xl lg:text-5xl font-extrabold">
          Toko Anda layak punya POS sekelas franchise.
        </h2>
        <p className="text-[hsl(var(--muted))] mt-5 text-lg">14 hari trial. Tidak ada komitmen. Cabut kapan saja.</p>
        <div className="flex justify-center gap-3 mt-8">
          <Link to="/register" className="btn-primary" data-testid="final-cta-register">Mulai Trial Gratis <ArrowRight size={16} /></Link>
          <Link to="/pricing" className="btn-outline" data-testid="final-cta-pricing">Lihat Harga</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--border))] py-10" data-testid="landing-footer">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-4 items-center justify-between text-sm text-[hsl(var(--muted))]">
        <span className="font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
          <Leaf className="text-[hsl(var(--accent))]" size={18} /> Geraina POS
        </span>
        <span>© 2026 DagangOS. Dibuat untuk UMKM Indonesia.</span>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div data-testid="landing-page">
      <Nav />
      <Hero />
      <Features />
      <PricingTeaser />
      <FinalCTA />
      <Footer />
    </div>
  );
}
