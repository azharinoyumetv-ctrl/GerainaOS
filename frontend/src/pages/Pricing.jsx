import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Check, ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "@/components/ui/sonner";
import AddonManagement from "./settings/AddonManagement";

const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const TEAL = "#0d9488";
const TEAL_DARK = "#0b7d72";
const INK = "#0f2622";
const BODY = "#44534a";
const MUTED = "#7a877e";
const LINE = "#e6ece8";
const TINT = "#e3f4f1";

const FAQS = [
  { q: "Apakah trial benar-benar gratis?", a: "Ya. 14 hari akses penuh fitur paket Business, tanpa kartu kredit, dan Anda bisa berhenti kapan saja." },
  { q: "Bisa pakai untuk multi-outlet?", a: "Bisa. Paket Business sudah termasuk 3 outlet dengan konsolidasi laporan antar outlet. Butuh lebih banyak? Tinggal tambah outlet lewat add-on." },
  { q: "Metode pembayaran apa saja yang didukung?", a: "Tunai, QRIS dinamis, e-wallet OVO/DANA/ShopeePay/LinkAja via Xendit." },
  { q: "Bisa impor produk lama dari Excel?", a: "Bisa mulai paket Pro. Halaman Produk menyediakan importer Excel/CSV dengan deteksi SKU duplikat." },
  { q: "Apa beda Starter dan Pro?", a: "Starter hanya mencatat transaksi kasir. Pro membuka purchase order, inventory valuation, piutang/utang, dan laporan lengkap — untuk toko yang beroperasi penuh." },
];

function fmtMonthlyEq(yearly) {
  if (!yearly) return null;
  return fmtIDR(Math.round(yearly / 12));
}

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [addons, setAddons] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [billing, setBilling] = useState("yearly");
  const { user } = useAuth();
  const [upgradingId, setUpgradingId] = useState(null);
  const purchasing = useRef(false);
  useEffect(() => {
    const returned = event => {
      if (event.persisted) { purchasing.current = false; setUpgradingId(null); }
    };
    window.addEventListener("pageshow", returned);
    return () => window.removeEventListener("pageshow", returned);
  }, []);
  // Whether this authenticated account already has a Geraina store. null = not checked yet
  // (don't render either way until known, to avoid flashing the wrong CTA). This is what lets
  // us show a real "Aktifkan Geraina" entry point for a DagangOS account that has a store in
  // another module (e.g. DapurOS) but not this one -- previously the only way to reach
  // /geraina/activate was accidentally, via a 409 from some unrelated API call once already
  // inside the app (see the axios interceptor in api/client.js). "Mulai Gratis" in the nav is
  // deliberately anonymous-only (new account + first store), so it's the wrong CTA for this
  // case by design, not a bug -- this adds the CTA that was actually missing.
  const [hasGerainaStore, setHasGerainaStore] = useState(null);
  const [addonAccount, setAddonAccount] = useState(null);

  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers((r.data || []).filter(t => ["starter", "pro", "business"].includes(t.id)))).catch(() => {});
    api.get("/pricing/addons").then((r) => setAddons(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setHasGerainaStore(null); return; }
    api.get("/auth/me").then((r) => {
      const stores = r.data?.stores || [];
      setHasGerainaStore(stores.some((s) => s.module === "geraina"));
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) { setAddonAccount(null); return; }
    api.get("/subscriptions/current").then(r => { if (active) setAddonAccount(r.data); }).catch(() => { if (active) setAddonAccount(null); });
    return () => { active = false; };
  }, [user]);

  const isYearly = billing === "yearly";

  const handleUpgrade = async (tierId) => {
    if (purchasing.current || !['starter', 'pro', 'business'].includes(tierId)) return;
    purchasing.current = true;
    setUpgradingId(tierId);
    try {
      sessionStorage.setItem('dagangos_checkout_geraina', JSON.stringify({ tier: tierId, period: billing, expires: Date.now() + 1800000 }));
      requestAnimationFrame(() => requestAnimationFrame(() => window.location.assign(`/geraina/pricing?period=${billing}&plan=${tierId}&checkout=1`)));
    } catch (err) {
      purchasing.current = false;
      setUpgradingId(null);
      toast.error("Pembelian belum dapat dibuka. Coba lagi.");
    }
  };

  const priceText = (t) => {
    if (t.id === "trial") return "Gratis";
    return fmtIDR(isYearly ? t.price_idr_yearly : t.price_idr_monthly);
  };
  const renderPeriod = (t) => {
    if (t.id === "trial") return "14 hari";
    return isYearly ? "/tahun" : "/bulan";
  };

  return (
    <div className="ecosystem-pricing product-public public-geraina" data-testid="pricing-page" style={{ fontFamily: JK, minHeight: "100vh" }}>
      <header className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: "rgba(247,251,250,.85)", borderColor: LINE }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/geraina" className="flex items-center gap-2.5" data-testid="pricing-nav-logo">
            <img src="/assets/brand/geraina-icon.png" alt="" className="w-9 h-9 object-contain" />
            <span className="font-bold text-lg" style={{ fontFamily: JK, color: INK }}>Geraina POS</span>
            <span className="text-xs font-medium" style={{ color: MUTED }}>by DagangOS</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {hasGerainaStore === false && (
                  <Link to="/geraina/activate" className="px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-50" style={{ color: INK }} data-testid="pricing-nav-activate">Aktifkan Geraina</Link>
                )}
                <Link to="/geraina/app/dashboard" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: TEAL }} data-testid="pricing-nav-dashboard">Ke Dashboard →</Link>
              </>
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
          Mulai dari kasir sederhana. Naik ke sistem operasional lengkap saat bisnis berkembang.
        </h1>
        <p className="mt-4 max-w-xl mx-auto" style={{ color: BODY }}>
          Satu harga jujur, tanpa biaya transaksi tersembunyi. Bisa naik atau turun paket kapan saja.
        </p>
        <div className="inline-flex items-center gap-1 mt-8 p-1 rounded-full border" style={{ borderColor: LINE, background: "#fff" }} data-testid="billing-toggle">
          <button onClick={() => setBilling("monthly")} className="px-5 py-2 rounded-full text-sm font-semibold transition-colors" style={billing === "monthly" ? { background: TEAL, color: "#fff" } : { color: INK }} data-testid="billing-monthly">Bulanan</button>
          <button onClick={() => setBilling("yearly")} className="px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2" style={billing === "yearly" ? { background: TEAL, color: "#fff" } : { color: INK }} data-testid="billing-yearly">
            Tahunan <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: billing === "yearly" ? "rgba(255,255,255,.2)" : TINT, color: billing === "yearly" ? "#fff" : TEAL_DARK }}>Hemat ~17%</span>
          </button>
        </div>
      </section>

      <section className="py-10 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <div key={t.id} className={`rounded-2xl bg-white flex flex-col relative ${t.highlight ? "p-7" : "p-6"}`} style={{ border: t.highlight ? `2px solid ${TEAL}` : `1px solid ${LINE}`, boxShadow: t.highlight ? "0 16px 40px -12px rgba(13,148,136,0.35)" : "none" }} data-testid={`pricing-card-${t.id}`}>
              {t.badge && <span className="absolute -top-3 left-6 text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: TEAL }} data-testid={`pricing-badge-${t.id}`}>{t.badge}</span>}
              <h3 className="text-xl font-bold" style={{ fontFamily: JK, color: INK }}>{t.name}</h3>
              <p className="text-sm mt-1 min-h-[36px]" style={{ color: MUTED }}>{t.tagline}</p>
              {t.highlight_note && <p className="text-xs mt-1 font-semibold" style={{ color: TEAL_DARK }} data-testid={`pricing-highlight-note-${t.id}`}>{t.highlight_note}</p>}
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
                <button type="button" onClick={() => handleUpgrade(t.id)} disabled={upgradingId !== null} aria-busy={upgradingId === t.id} className="mt-auto w-full flex items-center justify-center gap-2 text-center py-2.5 rounded-xl border font-semibold text-sm disabled:opacity-60" style={{ borderColor: LINE, color: INK }} data-testid={`pricing-cta-${t.id}`}>{upgradingId === t.id ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Membuka pembayaran…</> : <>Beli {t.name} →</>}</button>
            </div>
          ))}
        </div>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-6 text-center">
          <p className="text-xs" style={{ color: MUTED }} data-testid="pricing-disclaimer">
            DagangOS adalah platform perangkat lunak mandiri. Paket tidak mencakup pelatihan pribadi, implementasi, dedicated account manager, custom development, atau jaminan waktu respons dukungan. Dokumentasi, panduan penggunaan, pemulihan akun, pembaruan sistem, dan pelaporan gangguan tersedia secara mandiri.
          </p>
        </div>
      </section>

      <section className="py-12 px-5 sm:px-8 border-y" style={{ background: "#eef5f3", borderColor: LINE }} data-testid="addons-section">
        <div className="max-w-5xl mx-auto"><AddonManagement data={addonAccount?.addons} catalogue={addons} canManage={addonAccount?.can_manage} signedIn={!!user} /></div>
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

      <footer className="public-contact-footer">
        <span>© 2026 Geraina POS · PT DagangOS Digital Indonesia</span>
        <nav aria-label="Tautan perusahaan"><a href="/sumber-daya">Kontak</a><a href="/">DagangOS</a></nav>
      </footer>
    </div>
  );
}
