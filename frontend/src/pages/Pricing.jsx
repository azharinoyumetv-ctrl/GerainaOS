import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { Check, ArrowRight, ChevronDown, ShoppingBag } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "@/components/ui/sonner";

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
  const { user, refresh } = useAuth();
  const [upgradingId, setUpgradingId] = useState(null);
  // Whether this authenticated account already has a Geraina store. null = not checked yet
  // (don't render either way until known, to avoid flashing the wrong CTA). This is what lets
  // us show a real "Aktifkan Geraina" entry point for a DagangOS account that has a store in
  // another module (e.g. DapurOS) but not this one -- previously the only way to reach
  // /geraina/activate was accidentally, via a 409 from some unrelated API call once already
  // inside the app (see the axios interceptor in api/client.js). "Mulai Gratis" in the nav is
  // deliberately anonymous-only (new account + first store), so it's the wrong CTA for this
  // case by design, not a bug -- this adds the CTA that was actually missing.
  const [hasGerainaStore, setHasGerainaStore] = useState(null);
  const [myAddons, setMyAddons] = useState([]);
  const [buyingAddonId, setBuyingAddonId] = useState(null);

  useEffect(() => {
    api.get("/pricing/tiers").then((r) => setTiers(r.data)).catch(() => {});
    api.get("/pricing/addons").then((r) => setAddons(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { setHasGerainaStore(null); return; }
    api.get("/auth/me").then((r) => {
      const stores = r.data?.stores || [];
      setHasGerainaStore(stores.some((s) => s.module === "geraina"));
    }).catch(() => {});
  }, [user]);

  const loadMyAddons = () => {
    if (!user) { setMyAddons([]); return; }
    api.get("/pricing/addons/my").then((r) => setMyAddons(r.data || [])).catch(() => {});
  };

  useEffect(loadMyAddons, [user]);

  const isYearly = billing === "yearly";

  const handleUpgrade = async (tierId) => {
    setUpgradingId(tierId);
    try {
      const res = await api.post("/pricing/upgrade", { tier_id: tierId });
      await refresh();
      if (res?.data?.status === "pending_manual_activation") {
        toast.success(res.data.message || "Permintaan upgrade tercatat, menunggu aktivasi manual.");
      } else {
        toast.success(`Sukses mengubah paket ke ${tierId.toUpperCase()}!`);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal mengubah paket ke ${tierId.toUpperCase()}: ${msg}`);
    } finally {
      setUpgradingId(null);
    }
  };

  const handleBuyAddon = async (addonId, addonName) => {
    setBuyingAddonId(addonId);
    try {
      const res = await api.post("/pricing/addons/purchase", { addon_id: addonId });
      toast.success(res?.data?.message || `Permintaan add-on "${addonName}" tercatat.`);
      loadMyAddons();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      toast.error(`Gagal mengajukan add-on "${addonName}": ${msg}`);
    } finally {
      setBuyingAddonId(null);
    }
  };

  // extra_device is Pro-only, capped at 2 per store; extra_outlet is Business-only. Both
  // eligibility checks are enforced again server-side in purchase_addon() -- this is just so
  // the button reflects reality instead of only failing after a click.
  const addonEligiblePlan = { extra_device: "pro", extra_outlet: "business" };
  const addonStatus = (addonId) => {
    const mine = myAddons.filter((a) => a.addon_id === addonId);
    const active = mine.filter((a) => a.status === "active").length;
    const pending = mine.filter((a) => a.status === "pending").length;
    const eligible = !user || user.plan === addonEligiblePlan[addonId];
    const maxed = addonId === "extra_device" && active + pending >= 2;
    return { active, pending, eligible, maxed };
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
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-6 text-center">
          <p className="text-xs" style={{ color: MUTED }} data-testid="pricing-disclaimer">
            DagangOS adalah platform perangkat lunak mandiri. Paket tidak mencakup pelatihan pribadi, implementasi, dedicated account manager, custom development, atau jaminan waktu respons dukungan. Dokumentasi, panduan penggunaan, pemulihan akun, pembaruan sistem, dan pelaporan gangguan tersedia secara mandiri.
          </p>
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
            {addons.map((a) => {
              const st = addonStatus(a.id);
              return (
                <div key={a.id} className="rounded-2xl bg-white p-5 flex flex-col gap-3 border" style={{ borderColor: LINE }} data-testid={`addon-${a.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold text-base" style={{ fontFamily: JK, color: INK }}>{a.name}</p><p className="text-xs mt-0.5" style={{ color: MUTED }}>{a.unit}</p></div>
                    <p className="font-extrabold text-base whitespace-nowrap" style={{ fontFamily: JK, color: INK }}>{a.price_idr != null ? fmtIDR(a.price_idr) : `${fmtIDR(a.price_idr_min)} – ${fmtIDR(a.price_idr_max)}`}</p>
                  </div>
                  {!user ? (
                    <Link to="/geraina/login" className="text-center py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: LINE, color: INK }} data-testid={`addon-cta-${a.id}`}>Masuk untuk membeli</Link>
                  ) : !st.eligible ? (
                    <p className="text-xs text-center py-2" style={{ color: MUTED }} data-testid={`addon-cta-${a.id}`}>Tersedia mulai paket {addonEligiblePlan[a.id] === "business" ? "Business" : "Pro"}</p>
                  ) : st.active > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: TINT, color: TEAL_DARK }} data-testid={`addon-status-${a.id}`}>Aktif ×{st.active}</span>
                      {!st.maxed && (
                        <button onClick={() => handleBuyAddon(a.id, a.name)} disabled={buyingAddonId !== null} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: LINE, color: INK }} data-testid={`addon-cta-${a.id}`}>{buyingAddonId === a.id ? "Memproses…" : "Tambah lagi"}</button>
                      )}
                    </div>
                  ) : st.pending > 0 ? (
                    <span className="text-xs font-semibold text-center py-2 rounded-lg" style={{ color: MUTED }} data-testid={`addon-status-${a.id}`}>Menunggu Aktivasi ({st.pending})</span>
                  ) : st.maxed ? (
                    <span className="text-xs font-semibold text-center py-2 rounded-lg" style={{ color: MUTED }} data-testid={`addon-status-${a.id}`}>Batas Tercapai (2/2)</span>
                  ) : (
                    <button onClick={() => handleBuyAddon(a.id, a.name)} disabled={buyingAddonId !== null} className="w-full py-2 rounded-lg text-white text-xs font-semibold" style={{ background: TEAL }} data-testid={`addon-cta-${a.id}`}>{buyingAddonId === a.id ? "Memproses…" : "Ajukan Add-on"}</button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-center mt-6" style={{ color: MUTED }}>Add-on ditagih terpisah dari langganan. Permintaan diaktifkan manual oleh tim kami setelah pembayaran dikonfirmasi.</p>
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
