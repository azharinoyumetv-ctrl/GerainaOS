import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Leaf, Check, ArrowRight, ChevronDown } from "lucide-react";

const FAQS = [
  { q: "Apakah trial benar-benar gratis?", a: "Ya. 14 hari pemakaian penuh, tanpa kartu kredit, dan Anda bisa cabut kapan saja." },
  { q: "Bisa pakai untuk multi-cabang?", a: "Bisa. Paket Growth mendukung 3 outlet dan Enterprise unlimited dengan SLA dedicated." },
  { q: "Metode pembayaran apa saja yang didukung?", a: "Tunai, QRIS dinamis, dan e-wallet OVO/DANA/ShopeePay/LinkAja via Xendit." },
  { q: "Bisa import produk lama dari Excel?", a: "Bisa. Halaman Products menyediakan importer Excel/CSV dengan deteksi SKU duplikat." },
];

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="pricing-page">
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="pricing-nav-logo">
            <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina <span className="text-[hsl(var(--muted))] text-sm font-medium">by DagangOS</span>
          </Link>
          <div className="flex gap-2">
            <Link to="/login" className="btn-ghost" data-testid="pricing-nav-login">Masuk</Link>
            <Link to="/register" className="btn-primary" data-testid="pricing-nav-register">Mulai Gratis</Link>
          </div>
        </div>
      </header>

      <section className="pt-20 pb-12 text-center" data-testid="pricing-hero">
        <span className="label-tiny">Harga</span>
        <h1 className="font-display text-5xl font-extrabold mt-3 max-w-3xl mx-auto px-6">
          Satu harga jujur. Tanpa biaya transaksi tersembunyi.
        </h1>
        <p className="text-[hsl(var(--muted))] mt-4 max-w-xl mx-auto px-6">
          Pilih paket yang cocok dengan ukuran toko Anda. Bisa upgrade/downgrade kapan saja.
        </p>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`card-surface p-7 flex flex-col ${
                t.highlight
                  ? "border-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent))]/40 relative bg-[hsl(36,17%,99%)]"
                  : ""
              }`}
              data-testid={`pricing-card-${t.id}`}
            >
              {t.badge && (
                <span className="pill absolute -top-3 left-6 bg-[hsl(var(--accent))] text-white" data-testid={`pricing-badge-${t.id}`}>
                  {t.badge}
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{t.name}</h3>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">{t.tagline}</p>
              <div className="mt-5">
                <p className="num-display font-display text-4xl font-extrabold">
                  {t.price_idr === null ? "Custom" : t.price_idr === 0 ? "Gratis" : fmtIDR(t.price_idr)}
                </p>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">{t.period}</p>
              </div>
              <ul className="space-y-2.5 mt-6 mb-7 text-sm" data-testid={`pricing-features-${t.id}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={16} className={t.highlight ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--primary))]"} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={t.id === "enterprise" ? "mailto:sales@dagangos.com" : "/register"}
                className={`mt-auto ${t.highlight ? "btn-accent" : "btn-outline"} w-full`}
                data-testid={`pricing-cta-${t.id}`}
              >
                {t.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="py-20 border-t border-[hsl(var(--border))]" data-testid="pricing-faq">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold mb-8 text-center">Pertanyaan yang sering ditanyakan</h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="card-surface" data-testid={`faq-${i}`}>
                <button
                  className="w-full text-left p-5 flex items-center justify-between font-medium"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  data-testid={`faq-toggle-${i}`}
                >
                  {f.q}
                  <ChevronDown size={18} className={`transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-[hsl(var(--muted))]" data-testid={`faq-answer-${i}`}>{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--border))] py-10">
        <div className="max-w-7xl mx-auto px-6 text-sm text-[hsl(var(--muted))] text-center">
          © 2026 Geraina POS by DagangOS
        </div>
      </footer>
    </div>
  );
}
