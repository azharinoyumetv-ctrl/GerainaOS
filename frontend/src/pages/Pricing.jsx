import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Check, ArrowRight, ChevronDown, ShoppingBag } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const TEAL = "#0d9488";
const TEAL_DARK = "#0b7d72";
const INK = "#0f2622";
const BODY = "#44534a";
const MUTED = "#7a877e";
const LINE = "#e6ece8";
const TINT = "#e3f4f1";

const FAQS = [
  { q: "Apakah trial benar-benar gratis?", a: "Ya. 14 hari pemakaian fitur Pro, tanpa kartu kredit, dan Anda bisa berhenti kapan saja." },
  { q: "Bisa pakai untuk multi-cabang?", a: "Bisa. Paket Multi-Branch mendukung outlet tanpa batas dengan konsolidasi laporan antar cabang." },
  { q: "Metode pembayaran apa saja yang didukung?", a: "Tunai, QRIS dinamis, dan e-wallet OVO/DANA/ShopeePay/LinkAja via Xendit." },
  { q: "Bisa impor produk lama dari Excel?", a: "Bisa. Halaman Produk menyediakan importer Excel/CSV dengan deteksi SKU duplikat." },
  { q: "Apa beda Starter dan Pro?", a: "Pro membuka produk tanpa batas, impor Excel/CSV, dan invoice A4 — cocok untuk toko yang mulai berkembang." },
];

function fmtMonthlyEq(yearly) {
  if (!yearly) return null;
  return fmtIDR(Math.round(yearly / 12));
}

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [addons, setAddons] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [billing, setBilling] = useState("monthly");
  const { user, refresh } = useAuth();
  const [upgradingId, setUpgradingId] = useState(null);

  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers(r.data)).catch(() => {});
    api.get("/pricing/addons").then((r) => setAddons(r.data)).catch(() => {});
  }, []);

  const isYearly = billing === "yearly";

  const handleUpgrade = async (tierId) => {
    setUpgradingId(tierId);
    try {
      const res = await api.post("/pricing/upgrade", { tier_id: tierId });
      await refresh();
      if (res?.data?.status === "pending_manual_activation") {
        alert(res.data.message || "Permintaan upgrade tercatat, menunggu aktivasi manual.");
      } else {
        alert(`Sukses mengubah paket ke ${tierId.toUpperCase()}!`);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      alert(`Gagal mengubah paket ke ${tierId.toUpperCase()}: ${msg}`);
    } finally {
      setUpgradingId(null);
    }
  };

  const priceText = (t) => {
    if (t.id === "trial") return "Gratis";
    if (t.id === "multibranch") return isYearly ? "Custom" : `${fmtIDR(t.price_idr_monthly)}+`;
    return fmtIDR(isYearly ? t.price_idr_yearly : t.price_idr_monthly);
  };
  const renderPeriod = (t) => {
    if (t.id === "trial") return "14 hari";
    if (t.id === "multibranch") return isYearly ? "" : "/bulan, mulai dari";
    return isYearly ? "/tahun" : "/bulan";
  };

  return (
    <div data-testid="pricing-page" style={{ fontFamily: JK, background: "#f7fbfa", color: BODY, minHeight: "100vh" }}>
      <header className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: "rgba(247,251,250,.85)", borderColor: LINE }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/geraina" className="flex items-center gap-2.5" data-testid="pricing-nav-logo">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: TEAL }}><ShoppingBag size={17} /></span>
            <span className="font-bold text-lg" style={{ fontFamily: JK, color: INK }}>Geraina POS</span>
            <span className="text-xs font-medium" style={{ color: MUTED }}>by DagangOS</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/geraina/app/dashboard" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid="pricing-nav-dashboard">Ke Dashboard →</Link>
            ) : (
              <>
                <Link to="/geraina/login" className="px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-50" style={{ color: INK }} data-testid="pricing-nav-login">Masuk</Link>
                <Link to="/geraina/register" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid="pricing-nav-register">Mulai Gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="pt-16 sm:pt-20 pb-8 text-center px-5 sm:px-8" data-testid="pricing-hero">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: TEAL }}>Harga</span>
        <h1 className="text-4xl sm:text-5xl font-extrabold mt-3 max-w-3xl mx-auto leading-tight" style={{ fontFamily: JK, color: INK }}>
          Satu harga jujur. Tanpa biaya transaksi tersembunyi.
        </h1>
        <p className="mt-4 max-w-xl mx-auto" style={{ color: BODY }}>
          Pilih paket yang cocok dengan ukuran toko Anda. Bisa naik atau turun paket kapan saja.
        </p>
        <div className="inline-flex items-center gap-1 mt-8 p-1 rounded-full border" style={{ borderColor: LINE, background: "#fff" }} data-testid="billing-toggle">
          <button onClick={() => setBilling("monthly")} className="px-5 py-2 rounded-full text-sm font-semibold transition-colors" style={billing === "monthly" ? { background: TEAL, color: "#fff" } : { color: INK }} data-testid="billing-monthly">Bulanan</button>
          <button onClick={() => setBilling("yearly")} className="px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2" style={billing === "yearly" ? { background: TEAL, color: "#fff" } : { color: INK }} data-testid="billing-yearly">
            Tahunan <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: billing === "yearly" ? "rgba(255,255,255,.2)" : TINT, color: billing === "yearly" ? "#fff" : TEAL_DARK }}>Hemat ~17%</span>
          </button>
        </div>
      </section>

      <section className="py-10 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {tiers.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-6 flex flex-col relative" style={{ border: t.highlight ? `2px solid ${TEAL}` : `1px solid ${LINE}` }} data-testid={`pricing-card-${t.id}`}>
              {t.badge && <span className="absolute -top-3 left-6 text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: TEAL }} data-testid={`pricing-badge-${t.id}`}>{t.badge}</span>}
              <h3 className="text-xl font-bold" style={{ fontFamily: JK, color: INK }}>{t.name}</h3>
              <p className="text-sm mt-1 min-h-[36px]" style={{ color: MUTED }}>{t.tagline}</p>
              <div className="mt-5">
                <p className="text-3xl font-extrabold leading-tight" style={{ fontFamily: JK, color: INK }}>{priceText(t)}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{renderPeriod(t)}</p>
                {isYearly && t.price_idr_yearly > 0 && t.id !== "trial" && (
                  <p className="text-[11px] mt-1" style={{ color: MUTED }} data-testid={`pricing-monthly-eq-${t.id}`}>setara {fmtMonthlyEq(t.price_idr_yearly)}/bulan</p>
                )}
              </div>
              <ul className="space-y-2.5 mt-6 mb-7 text-sm" style={{ color: BODY }} data-testid={`pricing-features-${t.id}`}>
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check size={16} style={{ color: TEAL }} className="shrink-0 mt-0.5" /><span>{f}</span></li>
                ))}
              </ul>
              {t.id !== "trial" ? (
                <a href="mailto:sales@dagangos.com" className="mt-auto w-full text-center py-2.5 rounded-xl border font-semibold text-sm" style={{ borderColor: LINE, color: INK }} data-testid={`pricing-cta-${t.id}`}>Hubungi Sales →</a>
              ) : user ? (
                user.plan === t.id ? (
                  <button disabled className="mt-auto w-full py-2.5 rounded-xl font-semibold text-sm cursor-not-allowed" style={{ background: "#eef2f0", color: MUTED }} data-testid={`pricing-cta-${t.id}`}>Paket Aktif</button>
                ) : (
                  <button onClick={() => handleUpgrade(t.id)} disabled={upgradingId !== null} className="mt-auto w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid={`pricing-cta-${t.id}`}>{upgradingId === t.id ? "Memproses…" : `Pilih ${t.name}`} →</button>
                )
              ) : (
                <Link to="/geraina/register" className="mt-auto w-full text-center py-2.5 rounded-xl font-semibold text-sm" style={t.highlight ? { background: TEAL, color: "#fff" } : { border: `1px solid ${LINE}`, color: INK }} data-testid={`pricing-cta-${t.id}`}>{t.cta} →</Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 border-y" style={{ background: "#eef5f3", borderColor: LINE }} data-testid="addons-section">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: TEAL }}>Add-ons</span>
            <h2 className="text-3xl font-bold mt-2" style={{ fontFamily: JK, color: INK }}>Tambah kapasitas saat dibutuhkan</h2>
            <p className="mt-2 max-w-xl mx-auto text-sm" style={{ color: BODY }}>Hanya bayar saat Anda butuh lebih. Bisa ditambahkan ke paket apa saja.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {addons.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white p-5 flex items-start justify-between gap-3 border" style={{ borderColor: LINE }} data-testid={`addon-${a.id}`}>
                <div><p className="font-bold text-base" style={{ fontFamily: JK, color: INK }}>{a.name}</p><p className="text-xs mt-0.5" style={{ color: MUTED }}>{a.unit}</p></div>
                <p className="font-extrabold text-base whitespace-nowrap" style={{ fontFamily: JK, color: INK }}>{a.price_idr != null ? fmtIDR(a.price_idr) : `${fmtIDR(a.price_idr_min)} – ${fmtIDR(a.price_idr_max)}`}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-6" style={{ color: MUTED }}>Add-on ditagih terpisah dari langganan dan bisa diaktifkan kapan saja.</p>
        </div>
      </section>

      <section id="faq" className="py-20 px-5 sm:px-8" data-testid="pricing-faq">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center" style={{ fontFamily: JK, color: INK }}>Pertanyaan yang sering ditanyakan</h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-2xl bg-white border" style={{ borderColor: LINE }} data-testid={`faq-${i}`}>
                <button className="w-full text-left p-5 flex items-center justify-between font-semibold" style={{ color: INK }} onClick={() => setOpenFaq(openFaq === i ? null : i)} data-testid={`faq-toggle-${i}`}>
                  {f.q}<ChevronDown size={18} className={`transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-sm" style={{ color: BODY }} data-testid={`faq-answer-${i}`}>{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: LINE }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 text-sm text-center" style={{ color: MUTED }}>© 2026 Geraina POS · DagangOS Digital Indonesia</div>
      </footer>
    </div>
  );
}
