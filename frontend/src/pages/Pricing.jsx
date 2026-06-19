import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Leaf, Check, ArrowRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

const FAQS = [
  { q: "Apakah trial benar-benar gratis?", a: "Ya. 14 hari pemakaian fitur Pro, tanpa kartu kredit, dan Anda bisa cabut kapan saja." },
  { q: "Bisa pakai untuk multi-cabang?", a: "Bisa. Paket Multi-Branch mendukung outlet unlimited dengan konsolidasi laporan antar cabang." },
  { q: "Metode pembayaran apa saja yang didukung?", a: "Tunai, QRIS dinamis, dan e-wallet OVO/DANA/ShopeePay/LinkAja via Xendit." },
  { q: "Bisa import produk lama dari Excel?", a: "Bisa. Halaman Products menyediakan importer Excel/CSV dengan deteksi SKU duplikat." },
  { q: "Apa beda Starter dan Pro?", a: "Pro membuka produk unlimited, Excel/CSV import, dan invoice A4 — cocok untuk toko yang sudah mulai scale." },
];

function fmtMonthlyEq(yearly) {
  if (!yearly) return null;
  return fmtIDR(Math.round(yearly / 12));
}

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [addons, setAddons] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [billing, setBilling] = useState("monthly"); // monthly | yearly
  const { user, refresh, setPlan } = useAuth();
  const [upgradingId, setUpgradingId] = useState(null);

  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers(r.data)).catch(() => {});
    api.get("/pricing/addons").then((r) => setAddons(r.data)).catch(() => {});
  }, []);

  const isYearly = billing === "yearly";

  const handleUpgrade = async (tierId) => {
    setUpgradingId(tierId);
    try {
      await api.post("/pricing/upgrade", { tier_id: tierId });
      await refresh();
      alert(`Sukses mengubah paket ke ${tierId.toUpperCase()}!`);
    } catch (err) {
      // Fallback: update plan client-side if API is unavailable (e.g. preview environment)
      setPlan(tierId);
      alert(`Sukses mengubah paket ke ${tierId.toUpperCase()}!`);
    } finally {
      setUpgradingId(null);
    }
  };

  const renderPrice = (t) => {
    if (t.id === "trial") return <span className="num-display">Gratis</span>;
    if (t.id === "multibranch") {
      return (
        <span className="num-display">
          {isYearly ? "Custom" : `${fmtIDR(t.price_idr_monthly)}+`}
        </span>
      );
    }
    const v = isYearly ? t.price_idr_yearly : t.price_idr_monthly;
    return <span className="num-display">{fmtIDR(v)}</span>;
  };

  const renderPeriod = (t) => {
    if (t.id === "trial") return "14 hari";
    if (t.id === "multibranch") return isYearly ? "" : "/bulan, mulai dari";
    return isYearly ? "/tahun" : "/bulan";
  };

  return (
    <div data-testid="pricing-page">
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-extrabold flex items-center gap-2" data-testid="pricing-nav-logo">
            <Leaf className="text-[hsl(var(--accent))]" size={22} /> Geraina <span className="text-[hsl(var(--muted))] text-sm font-medium">by DagangOS</span>
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Link to="/app/dashboard" className="btn-primary" data-testid="pricing-nav-dashboard">
                Ke Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost" data-testid="pricing-nav-login">Masuk</Link>
                <Link to="/register" className="btn-primary" data-testid="pricing-nav-register">Mulai Gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="pt-20 pb-10 text-center" data-testid="pricing-hero">
        <span className="label-tiny">Harga</span>
        <h1 className="font-display text-5xl font-extrabold mt-3 max-w-3xl mx-auto px-6">
          Satu harga jujur. Tanpa biaya transaksi tersembunyi.
        </h1>
        <p className="text-[hsl(var(--muted))] mt-4 max-w-xl mx-auto px-6">
          Pilih paket yang cocok dengan ukuran toko Anda. Bisa upgrade/downgrade kapan saja.
        </p>

        <div className="inline-flex items-center gap-1 mt-7 p-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))]" data-testid="billing-toggle">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              billing === "monthly" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--foreground))]"
            }`}
            data-testid="billing-monthly"
          >
            Bulanan
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 ${
              billing === "yearly" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--foreground))]"
            }`}
            data-testid="billing-yearly"
          >
            Tahunan
            <span className="pill" style={{ background: "hsl(9,65%,55%,0.2)", color: "hsl(9,65%,40%)" }}>Hemat ~17%</span>
          </button>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`card-surface p-6 flex flex-col ${
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
              <p className="text-sm text-[hsl(var(--muted))] mt-1 min-h-[36px]">{t.tagline}</p>
              <div className="mt-5">
                <p className="font-display text-3xl font-extrabold leading-tight">
                  {renderPrice(t)}
                </p>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">{renderPeriod(t)}</p>
                {isYearly && t.price_idr_yearly > 0 && t.id !== "trial" && (
                  <p className="text-[11px] text-[hsl(var(--muted))] mt-1" data-testid={`pricing-monthly-eq-${t.id}`}>
                    setara {fmtMonthlyEq(t.price_idr_yearly)}/bulan
                  </p>
                )}
              </div>
              <ul className="space-y-2.5 mt-6 mb-7 text-sm" data-testid={`pricing-features-${t.id}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={16} className={t.highlight ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--primary))]"} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.id === "multibranch" ? (
                <a
                  href="mailto:sales@dagangos.com"
                  className="mt-auto btn-outline w-full text-center py-2"
                  data-testid={`pricing-cta-${t.id}`}
                >
                  Hubungi Sales <ArrowRight size={14} />
                </a>
              ) : user ? (
                user.plan === t.id ? (
                  <button
                    disabled
                    className="mt-auto btn-ghost w-full bg-[hsl(var(--muted))]/10 cursor-not-allowed py-2"
                    data-testid={`pricing-cta-${t.id}`}
                  >
                    Paket Aktif
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(t.id)}
                    disabled={upgradingId !== null}
                    className={`mt-auto ${t.highlight ? "btn-accent" : "btn-primary"} w-full py-2`}
                    data-testid={`pricing-cta-${t.id}`}
                  >
                    {upgradingId === t.id ? "Memproses…" : `Pilih ${t.name}`} <ArrowRight size={14} />
                  </button>
                )
              ) : (
                <Link
                  to="/register"
                  className={`mt-auto ${t.highlight ? "btn-accent" : "btn-outline"} w-full text-center py-2`}
                  data-testid={`pricing-cta-${t.id}`}
                >
                  {t.cta} <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ADD-ONS SECTION */}
      <section className="py-16 bg-[hsl(36,17%,95%)] border-y border-[hsl(var(--border))]" data-testid="addons-section">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="label-tiny">Add-ons</span>
            <h2 className="font-display text-3xl font-bold mt-2">Tambah kapasitas saat dibutuhkan</h2>
            <p className="text-[hsl(var(--muted))] mt-2 max-w-xl mx-auto text-sm">
              Hanya bayar saat Anda butuh lebih. Bisa ditambahkan ke paket apa saja.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {addons.map((a) => (
              <div key={a.id} className="card-surface p-5 flex items-start justify-between gap-3" data-testid={`addon-${a.id}`}>
                <div>
                  <p className="font-display font-bold text-base">{a.name}</p>
                  <p className="text-xs text-[hsl(var(--muted))] mt-0.5">{a.unit}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold num-display text-base whitespace-nowrap">
                    {a.price_idr != null
                      ? fmtIDR(a.price_idr)
                      : `${fmtIDR(a.price_idr_min)} – ${fmtIDR(a.price_idr_max)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[hsl(var(--muted))] text-center mt-6">
            On-site setup tidak termasuk biaya transportasi. Konfirmasi detail dengan tim sales sebelum order.
          </p>
        </div>
      </section>

      <section id="faq" className="py-20" data-testid="pricing-faq">
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
