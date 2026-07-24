import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  PackageSearch,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
} from "lucide-react";

const ACCENT = "#27df75";
const ACCENT_2 = "#0bbf65";
const BLUE = "#1e7cff";
const BG = "#020a08";
const PANEL = "#061713";
const LINE = "rgba(86,224,143,.17)";
const TEXT = "#f5fff8";
const MUTED = "#92aa9c";
const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const WA = "https://wa.me/628999155182?text=Halo%20Geraina%20POS%2C%20saya%20tertarik%20dengan%20layanan%20kasir%20digital%20Anda.";

const FEATURES = [
  { icon: ShoppingCart, title: "POS & Kasir", text: "Transaksi penjualan, pencarian produk, keranjang, diskon, dan metode pembayaran dalam satu layar." },
  { icon: Boxes, title: "Inventori", text: "Kelola stok, mutasi, penyesuaian, stok minimum, dan riwayat pergerakan barang." },
  { icon: Truck, title: "Pembelian & Supplier", text: "Catat supplier, purchase order, penerimaan barang, dan histori pembelian." },
  { icon: BarChart3, title: "Laporan", text: "Ringkasan penjualan, produk, stok, pengeluaran, dan aktivitas operasional." },
  { icon: Building2, title: "Multi Outlet", text: "Pisahkan data cabang dan akses operasional sesuai struktur bisnis Anda." },
  { icon: UsersRound, title: "Staff & Hak Akses", text: "Atur pengguna, peran, dan izin untuk fungsi operasional yang berbeda." },
];

const QUICK_FEATURES = [
  { icon: ScanLine, label: "Barcode" },
  { icon: PackageSearch, label: "Produk" },
  { icon: FileSpreadsheet, label: "Impor Data" },
  { icon: ReceiptText, label: "Struk & Invoice" },
  { icon: CreditCard, label: "Pembayaran" },
  { icon: ShieldCheck, label: "Kontrol Akses" },
];

function Nav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="neo-nav" data-testid="landing-nav">
      <div className="neo-shell neo-nav-inner">
        <Link to="/geraina" className="neo-brand" data-testid="landing-logo">
          <img src="/assets/brand/geraina-icon.png" alt="" />
          <span>Geraina<span>POS</span></span>
        </Link>
        <nav className="neo-links" aria-label="Navigasi Geraina POS">
          <a href="#fitur">Fitur</a>
          <a href="#solusi">Solusi</a>
          <Link to="/geraina/pricing">Harga</Link>
          <a href="/">Ekosistem</a>
          <a href={WA} target="_blank" rel="noopener noreferrer">Kontak</a>
        </nav>
        <div className="neo-actions">
          {user ? (
            <Link to="/geraina/app/dashboard" className="neo-button neo-primary" data-testid="nav-dashboard-btn">Buka Dashboard</Link>
          ) : (
            <>
              <Link to="/geraina/login" className="neo-button" data-testid="nav-login-btn">Masuk</Link>
              <Link to="/geraina/register" className="neo-button neo-primary" data-testid="nav-register-btn">Mulai Gratis</Link>
            </>
          )}
          <button className="neo-menu" type="button" aria-label="Buka menu" onClick={() => setOpen((value) => !value)}>☰</button>
        </div>
      </div>
      <div className={`neo-mobile ${open ? "is-open" : ""}`}>
        <a href="#fitur" onClick={() => setOpen(false)}>Fitur</a>
        <a href="#solusi" onClick={() => setOpen(false)}>Solusi</a>
        <Link to="/geraina/pricing" onClick={() => setOpen(false)}>Harga</Link>
        <a href="/">Ekosistem DagangOS</a>
        <a href={WA} target="_blank" rel="noopener noreferrer">Kontak</a>
      </div>
    </header>
  );
}

function TiltWrap({ children, className = "" }) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const move = (event) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({ ry: (px - 0.5) * 9, rx: (0.5 - py) * 7 });
  };
  return (
    <div
      className={className}
      onMouseMove={move}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      style={{ transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: "transform .28s ease", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

function PosVisual() {
  const products = [
    ["Air Mineral", "Rp 5.000"],
    ["Teh Botol", "Rp 8.000"],
    ["Kopi Kaleng", "Rp 10.000"],
    ["Snack", "Rp 12.000"],
    ["Susu UHT", "Rp 9.000"],
    ["Sabun", "Rp 15.000"],
  ];
  return (
    <div className="pos-stage">
      <div className="pos-glow" />
      <div className="pos-screen">
        <div className="pos-window-bar"><span /><span /><span /><b>Geraina POS</b></div>
        <div className="pos-dashboard">
          <aside>
            <div className="pos-sidebar-active">Penjualan</div>
            <div>Produk</div><div>Inventori</div><div>Laporan</div><div>Pelanggan</div>
          </aside>
          <main>
            <div className="pos-heading"><div><small>Penjualan Baru</small><strong>Kasir Retail</strong></div><div className="pos-status">Siap</div></div>
            <div className="pos-products">{products.map(([name, price]) => <div key={name}><span className="product-dot" /><b>{name}</b><small>{price}</small></div>)}</div>
          </main>
          <section>
            <small>Keranjang</small>
            <div className="cart-line"><span>Air Mineral × 1</span><b>5.000</b></div>
            <div className="cart-line"><span>Snack × 2</span><b>24.000</b></div>
            <div className="cart-total"><span>Total</span><strong>Rp 29.000</strong></div>
            <button type="button">Bayar</button>
          </section>
        </div>
      </div>
      <div className="pos-scanner"><ScanLine size={34} /></div>
      <div className="pos-printer"><ReceiptText size={36} /><i /></div>
      <div className="pos-card"><CreditCard size={30} /></div>
      <div className="pos-cube"><img src="/assets/brand/geraina-icon.png" alt="" /></div>
      <div className="floating-panel stock-panel"><Boxes size={19} /><div><small>Inventori</small><b>Stok dapat dipantau</b></div></div>
      <div className="floating-panel report-panel"><BarChart3 size={19} /><div><small>Laporan</small><b>Data operasional</b></div></div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="neo-page">
      <style>{`
        .neo-page{min-height:100vh;background:${BG};color:${TEXT};font-family:Inter,system-ui,sans-serif;overflow:hidden}
        .neo-page *{box-sizing:border-box}.neo-page a{text-decoration:none;color:inherit}.neo-page button{font:inherit}.neo-page img{display:block;max-width:100%}
        .neo-page:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 76% 12%,rgba(39,223,117,.13),transparent 34rem),radial-gradient(circle at 15% 42%,rgba(30,124,255,.08),transparent 30rem),linear-gradient(rgba(39,223,117,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(39,223,117,.025) 1px,transparent 1px);background-size:auto,auto,42px 42px,42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 90%)}
        .neo-shell{width:min(1220px,calc(100% - 40px));margin:auto}.neo-nav{position:sticky;top:0;z-index:50;border-bottom:1px solid ${LINE};background:rgba(2,10,8,.82);backdrop-filter:blur(20px)}.neo-nav-inner{height:70px;display:flex;align-items:center;justify-content:space-between;gap:24px}.neo-brand{display:flex;align-items:center;gap:10px;font:800 20px ${JK}}.neo-brand img{width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(39,223,117,.35))}.neo-brand>span>span{color:${ACCENT}}.neo-links{display:flex;align-items:center;gap:27px;color:#b7cbbf;font-size:13px;font-weight:600}.neo-links a:hover{color:white}.neo-actions{display:flex;align-items:center;gap:9px}.neo-button{border:1px solid ${LINE};border-radius:10px;padding:10px 15px;font-size:13px;font-weight:700;color:white;background:rgba(255,255,255,.025);transition:.2s}.neo-button:hover{transform:translateY(-2px);border-color:rgba(39,223,117,.42)}.neo-primary{border-color:transparent;background:linear-gradient(135deg,${ACCENT_2},${ACCENT});box-shadow:0 8px 24px rgba(18,196,99,.24);color:#00170b}.neo-menu{display:none;background:none;border:1px solid ${LINE};color:white;border-radius:9px;width:40px;height:40px}.neo-mobile{display:none;width:min(1220px,calc(100% - 40px));margin:auto;padding:8px 0 18px}.neo-mobile.is-open{display:grid}.neo-mobile a{padding:11px 0;color:#b7cbbf}
        .neo-hero{width:min(1220px,calc(100% - 40px));margin:auto;min-height:680px;display:grid;grid-template-columns:.88fr 1.12fr;align-items:center;gap:42px;padding:64px 0 44px;position:relative}.neo-copy{position:relative;z-index:2}.neo-kicker{display:inline-flex;gap:8px;align-items:center;border:1px solid rgba(39,223,117,.32);border-radius:999px;padding:7px 11px;background:rgba(8,36,24,.7);color:#c6f6d8;font-size:12px}.neo-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:${ACCENT};box-shadow:0 0 14px ${ACCENT}}.neo-title{font:800 clamp(42px,5.7vw,70px)/1.04 ${JK};letter-spacing:-.055em;margin:23px 0 18px}.neo-title span{background:linear-gradient(90deg,${ACCENT},#33e1a0);-webkit-background-clip:text;color:transparent}.neo-lead{max-width:560px;color:#9cb1a5;font-size:16px;line-height:1.78;margin:0}.neo-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.neo-cta .neo-button{padding:13px 20px;font-size:14px}.neo-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:34px}.neo-check{border-top:1px solid ${LINE};padding-top:15px;color:#81998b;font-size:11px;line-height:1.45}.neo-check b{display:flex;align-items:center;gap:7px;color:#f4fff8;font-size:13px;margin-bottom:4px}.neo-check svg{color:${ACCENT}}
        .pos-stage{height:560px;position:relative;transform-style:preserve-3d}.pos-glow{position:absolute;inset:18% 3% 5%;border-radius:50%;background:radial-gradient(circle,rgba(39,223,117,.2),transparent 62%);filter:blur(15px)}.pos-screen{position:absolute;left:17%;top:12%;width:76%;border:1px solid rgba(67,255,143,.34);background:#06130f;border-radius:20px;overflow:hidden;box-shadow:0 38px 90px rgba(0,0,0,.48),0 0 50px rgba(39,223,117,.22);transform:rotateY(-8deg) rotateX(3deg);transform-style:preserve-3d}.pos-window-bar{height:38px;display:flex;align-items:center;gap:7px;padding:0 14px;border-bottom:1px solid ${LINE};background:#081c16}.pos-window-bar span{width:8px;height:8px;border-radius:50%;background:#174c34}.pos-window-bar b{font-size:11px;margin-left:6px;color:#a9c8b5}.pos-dashboard{display:grid;grid-template-columns:88px 1fr 155px;min-height:310px}.pos-dashboard aside{padding:16px 10px;border-right:1px solid ${LINE};font-size:10px;color:#6d8d7b}.pos-dashboard aside div{padding:9px 8px;border-radius:7px}.pos-sidebar-active{color:#d9ffe7!important;background:linear-gradient(90deg,rgba(39,223,117,.16),transparent)}.pos-dashboard main{padding:18px}.pos-heading{display:flex;justify-content:space-between;align-items:center}.pos-heading small,.pos-heading strong{display:block}.pos-heading small{color:#6e8c7b;font-size:9px}.pos-heading strong{font:700 15px ${JK};margin-top:3px}.pos-status{font-size:9px;color:#052314;background:${ACCENT};border-radius:999px;padding:5px 8px}.pos-products{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px}.pos-products>div{border:1px solid ${LINE};border-radius:9px;padding:9px;background:#071a14}.product-dot{display:block;width:20px;height:20px;border-radius:7px;background:linear-gradient(145deg,#26dd76,#115c37);margin-bottom:7px}.pos-products b,.pos-products small{display:block}.pos-products b{font-size:8px}.pos-products small{font-size:7px;color:#719180;margin-top:3px}.pos-dashboard section{border-left:1px solid ${LINE};padding:18px 13px;background:#071712}.pos-dashboard section>small{color:#759281;font-size:9px}.cart-line{display:flex;justify-content:space-between;font-size:8px;margin-top:12px;color:#91a99b}.cart-line b{color:white}.cart-total{border-top:1px solid ${LINE};margin-top:18px;padding-top:12px}.cart-total span,.cart-total strong{display:block}.cart-total span{font-size:8px;color:#749180}.cart-total strong{font:700 14px ${JK};color:${ACCENT};margin-top:4px}.pos-dashboard section button{border:0;width:100%;border-radius:8px;background:${ACCENT};color:#00210f;font-weight:800;padding:9px;margin-top:12px;font-size:9px}.pos-scanner,.pos-printer,.pos-card,.pos-cube{position:absolute;display:grid;place-items:center;color:${ACCENT};border:1px solid rgba(39,223,117,.4);background:linear-gradient(145deg,#0b2119,#030b08);box-shadow:0 18px 36px rgba(0,0,0,.35),0 0 25px rgba(39,223,117,.14)}.pos-scanner{left:6%;bottom:14%;width:80px;height:105px;border-radius:26px 26px 18px 18px;transform:rotate(-8deg)}.pos-printer{left:26%;bottom:8%;width:116px;height:96px;border-radius:18px}.pos-printer i{width:62px;height:28px;border-top:5px solid #d7e9dc;background:repeating-linear-gradient(#a8bbae 0 2px,transparent 2px 5px)}.pos-card{right:7%;bottom:14%;width:85px;height:105px;border-radius:17px;transform:rotate(8deg)}.pos-cube{right:2%;top:45%;width:68px;height:68px;border-radius:16px}.pos-cube img{width:48px;height:48px;object-fit:contain}.floating-panel{position:absolute;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(39,223,117,.32);border-radius:13px;background:rgba(5,27,18,.91);box-shadow:0 14px 32px rgba(0,0,0,.34),0 0 22px rgba(39,223,117,.12);color:${ACCENT}}.floating-panel small,.floating-panel b{display:block}.floating-panel small{font-size:8px;color:#789686}.floating-panel b{font-size:10px;color:white;margin-top:2px}.stock-panel{left:1%;top:4%}.report-panel{right:0;top:5%}
        .neo-strip{border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};background:rgba(4,20,14,.72)}.neo-strip-inner{width:min(1220px,calc(100% - 40px));margin:auto;display:grid;grid-template-columns:repeat(6,1fr)}.neo-strip-item{padding:18px 10px;border-right:1px solid ${LINE};display:flex;align-items:center;justify-content:center;gap:8px;color:#9bb2a4;font-size:11px}.neo-strip-item:last-child{border-right:0}.neo-strip-item svg{color:${ACCENT}}
        .neo-section{width:min(1220px,calc(100% - 40px));margin:auto;padding:88px 0}.neo-section-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:32px}.neo-section-head small{color:${ACCENT};font-weight:800;letter-spacing:.16em;text-transform:uppercase}.neo-section-head h2{font:800 clamp(30px,4vw,46px)/1.1 ${JK};letter-spacing:-.04em;margin:9px 0 0}.neo-section-head p{max-width:480px;color:${MUTED};line-height:1.65;margin:0;font-size:14px}.neo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.neo-card{position:relative;overflow:hidden;min-height:220px;padding:22px;border:1px solid ${LINE};border-radius:19px;background:linear-gradient(150deg,rgba(10,35,24,.92),rgba(4,15,10,.92));transition:.25s}.neo-card:hover{transform:translateY(-6px);border-color:rgba(39,223,117,.42);box-shadow:0 22px 50px rgba(0,0,0,.32),0 0 30px rgba(39,223,117,.08)}.neo-card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 100% 0%,rgba(39,223,117,.14),transparent 48%)}.neo-card svg{position:relative;color:${ACCENT}}.neo-card h3{position:relative;font:800 18px ${JK};margin:26px 0 9px}.neo-card p{position:relative;color:${MUTED};font-size:13px;line-height:1.65;margin:0}.neo-solution{border:1px solid ${LINE};border-radius:25px;background:linear-gradient(135deg,rgba(8,33,22,.9),rgba(3,15,11,.94));padding:36px;display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;align-items:center}.neo-solution-copy h2{font:800 38px/1.14 ${JK};letter-spacing:-.04em;margin:0 0 14px}.neo-solution-copy p{color:${MUTED};line-height:1.75;margin:0}.neo-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.neo-flow>div{padding:17px;border:1px solid ${LINE};border-radius:15px;background:rgba(2,13,9,.65)}.neo-flow svg{color:${ACCENT};margin-bottom:18px}.neo-flow b{display:block;font:700 13px ${JK};margin-bottom:5px}.neo-flow span{color:${MUTED};font-size:10px;line-height:1.5}.neo-cta-panel{width:min(1220px,calc(100% - 40px));margin:0 auto 88px;border:1px solid rgba(39,223,117,.25);border-radius:24px;padding:42px;background:radial-gradient(circle at 80% 40%,rgba(39,223,117,.13),transparent 34%),linear-gradient(135deg,#061d14,#03110c);display:flex;justify-content:space-between;align-items:center;gap:28px}.neo-cta-panel h2{font:800 34px/1.15 ${JK};margin:0 0 8px}.neo-cta-panel p{color:${MUTED};margin:0}.neo-footer{border-top:1px solid ${LINE};background:#010705}.neo-footer-inner{width:min(1220px,calc(100% - 40px));margin:auto;padding:38px 0 24px;display:flex;justify-content:space-between;align-items:center;gap:24px;color:#6f897a;font-size:12px}.neo-footer-brand{display:flex;align-items:center;gap:9px}.neo-footer-brand img{width:28px;height:28px}.neo-footer-links{display:flex;gap:22px}.neo-footer a:hover{color:white}
        @media(max-width:1050px){.neo-links{display:none}.neo-menu{display:block}.neo-actions>.neo-button{display:none}.neo-hero{grid-template-columns:1fr;padding-top:70px}.neo-copy{text-align:center}.neo-lead{margin:auto}.neo-cta{justify-content:center}.neo-checks{max-width:700px;margin-left:auto;margin-right:auto}.pos-stage{width:min(760px,100%);margin:auto}.neo-grid{grid-template-columns:1fr 1fr}.neo-solution{grid-template-columns:1fr}}
        @media(max-width:720px){.neo-shell,.neo-hero,.neo-strip-inner,.neo-section,.neo-cta-panel,.neo-footer-inner{width:min(100% - 28px,1220px)}.neo-title{font-size:43px}.neo-checks{grid-template-columns:1fr}.pos-stage{height:490px;transform:scale(.82);margin:-35px auto}.neo-strip-inner{grid-template-columns:repeat(3,1fr)}.neo-strip-item:nth-child(3){border-right:0}.neo-strip-item:nth-child(-n+3){border-bottom:1px solid ${LINE}}.neo-section-head{display:block}.neo-section-head p{margin-top:16px}.neo-grid{grid-template-columns:1fr}.neo-solution{padding:24px}.neo-flow{grid-template-columns:1fr 1fr}.neo-cta-panel{display:block;text-align:center;padding:32px 22px}.neo-cta-panel .neo-cta{justify-content:center}.neo-footer-inner{display:block;text-align:center}.neo-footer-brand,.neo-footer-links{justify-content:center}.neo-footer-links{margin-top:17px}}
        @media(max-width:480px){.pos-stage{height:420px;transform:scale(.68);margin:-75px -21%}.neo-strip-inner{grid-template-columns:1fr 1fr}.neo-strip-item:nth-child(n){border-bottom:1px solid ${LINE}}.neo-strip-item:nth-child(2n){border-right:0}.neo-flow{grid-template-columns:1fr}.neo-footer-links{flex-wrap:wrap}}
        @media(prefers-reduced-motion:reduce){.neo-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
      `}</style>
      <Nav />
      <main>
        <section className="neo-hero">
          <div className="neo-copy">
            <span className="neo-kicker">Sistem POS Retail &amp; Inventory</span>
            <h1 className="neo-title" data-testid="hero-title">Kelola Toko &amp; Stok Lebih <span>Mudah, Jualan Makin Cuan.</span></h1>
            <p className="neo-lead">Geraina POS membantu mengelola kasir, produk, inventori, supplier, pembelian, penjualan, pelanggan, dan laporan dalam satu sistem retail.</p>
            <div className="neo-cta">
              <Link to="/geraina/register" className="neo-button neo-primary" data-testid="hero-cta-primary">Mulai Gratis <ArrowRight size={16} style={{ display: "inline", marginLeft: 7 }} /></Link>
              <Link to="/geraina/pricing" className="neo-button" data-testid="hero-cta-secondary">Lihat Harga</Link>
            </div>
            <div className="neo-checks">
              <div className="neo-check"><b><CheckCircle2 size={15} />Operasional Retail</b>Fokus pada kebutuhan toko dan perdagangan retail.</div>
              <div className="neo-check"><b><CheckCircle2 size={15} />Data Terhubung</b>Transaksi dan inventori berada dalam alur yang sama.</div>
              <div className="neo-check"><b><CheckCircle2 size={15} />Bagian dari DagangOS</b>Identitas produk tetap terhubung dengan parent ecosystem.</div>
            </div>
          </div>
          <TiltWrap><PosVisual /></TiltWrap>
        </section>

        <section className="neo-strip">
          <div className="neo-strip-inner">{QUICK_FEATURES.map((item) => <div className="neo-strip-item" key={item.label}><item.icon size={17} /><span>{item.label}</span></div>)}</div>
        </section>

        <section id="fitur" className="neo-section">
          <div className="neo-section-head"><div><small>Fitur utama</small><h2>Perangkat operasional untuk bisnis retail</h2></div><p>Struktur halaman, interaksi, dan visual mengikuti keluarga DagangOS, sedangkan konten dan warna tetap spesifik untuk retail.</p></div>
          <div className="neo-grid">{FEATURES.map((feature) => <article className="neo-card" key={feature.title}><feature.icon size={28} strokeWidth={1.7} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </section>

        <section id="solusi" className="neo-section" style={{ paddingTop: 0 }}>
          <div className="neo-solution"><div className="neo-solution-copy"><h2>Satu alur dari transaksi sampai laporan.</h2><p>Geraina POS menyatukan aktivitas kasir dan back-office agar perubahan stok, pembelian, dan laporan dapat dikelola dalam sistem yang sama.</p></div><div className="neo-flow"><div><Store size={24} /><b>Produk</b><span>Siapkan katalog dan data barang.</span></div><div><ShoppingCart size={24} /><b>Transaksi</b><span>Proses penjualan melalui kasir.</span></div><div><Boxes size={24} /><b>Inventori</b><span>Pantau pergerakan dan penyesuaian stok.</span></div><div><BarChart3 size={24} /><b>Laporan</b><span>Tinjau data operasional bisnis.</span></div></div></div>
        </section>

        <section className="neo-cta-panel"><div><h2>Mulai kelola operasional retail Anda.</h2><p>Buat akun Geraina POS atau tinjau paket yang tersedia.</p></div><div className="neo-cta"><Link to="/geraina/register" className="neo-button neo-primary">Mulai Gratis</Link><Link to="/geraina/pricing" className="neo-button">Lihat Harga</Link></div></section>
      </main>
      <footer className="neo-footer"><div className="neo-footer-inner"><div className="neo-footer-brand"><img src="/assets/brand/geraina-icon.png" alt="" /><span>© 2026 Geraina POS · PT DagangOS Digital Indonesia</span></div><div className="neo-footer-links"><Link to="/geraina/pricing">Harga</Link><a href={WA} target="_blank" rel="noopener noreferrer">Kontak</a><a href="/">DagangOS</a></div></div></footer>
    </div>
  );
}
