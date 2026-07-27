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
          <a href="/sumber-daya">Kontak</a>
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
        <a href="/sumber-daya" onClick={() => setOpen(false)}>Kontak</a>
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

function RetailFeatureScene({ index }) {
  if (index === 0) {
    return <div className="feature-sim sim-pos" aria-label="Simulasi kasir">
      <div className="sim-pos-products"><b>Produk</b>{["Air mineral", "Kopi", "Snack", "Susu"].map((item, itemIndex) => <span key={item} style={{ "--delay": `${itemIndex * 0.35}s` }}><i />{item}<small>+</small></span>)}</div>
      <div className="sim-pos-cart"><small>KERANJANG AKTIF</small><strong>3 produk</strong><div><span>Total</span><b>Rp 42.000</b></div><button type="button">Bayar</button></div>
      <i className="sim-scan" />
    </div>;
  }
  if (index === 1) {
    return <div className="feature-sim sim-stock" aria-label="Simulasi inventori">
      <div className="stock-rack">{[78, 44, 91, 27, 63, 85].map((level, itemIndex) => <div key={level}><span style={{ "--level": `${level}%`, "--delay": `${itemIndex * 0.18}s` }} /><small>{level}%</small></div>)}</div>
      <div className="stock-status"><b>Stok bergerak</b><span><i />Masuk</span><span><i />Keluar</span><span className="warning"><i />Minimum</span></div>
      <i className="stock-packet" /><i className="stock-packet second" />
    </div>;
  }
  if (index === 2) {
    return <div className="feature-sim sim-supply" aria-label="Simulasi pembelian dan supplier">
      <div className="supply-node"><small>01</small><b>Purchase order</b><span>PO-0248</span></div>
      <div className="supply-path"><i /></div>
      <div className="supply-node"><small>02</small><b>Supplier</b><span>Pesanan diproses</span></div>
      <div className="supply-path"><i /></div>
      <div className="supply-node"><small>03</small><b>Penerimaan</b><span>Stok diperbarui</span></div>
    </div>;
  }
  if (index === 3) {
    return <div className="feature-sim sim-report" aria-label="Simulasi laporan">
      <div className="report-metric"><small>RINGKASAN HARI INI</small><b>Penjualan &amp; aktivitas</b><span>Data diperbarui dari transaksi</span></div>
      <div className="report-chart">{[35, 58, 43, 74, 61, 88, 72].map((value, itemIndex) => <i key={value} style={{ "--x": itemIndex, "--y": `${100 - value}%`, "--delay": `${itemIndex * 0.12}s` }} />)}<span className="chart-sweep" /></div>
    </div>;
  }
  if (index === 4) {
    return <div className="feature-sim sim-outlet" aria-label="Simulasi multi outlet">
      <div className="outlet-core"><img src="/assets/brand/geraina-icon.png" alt="" /><b>Pusat</b></div>
      {["Outlet Utara", "Outlet Tengah", "Outlet Selatan"].map((outlet, itemIndex) => <div className={`outlet-node outlet-${itemIndex + 1}`} key={outlet}><i /><b>{outlet}</b><small>Terhubung</small></div>)}
      <span className="outlet-orbit" /><span className="outlet-orbit orbit-two" />
    </div>;
  }
  return <div className="feature-sim sim-access" aria-label="Simulasi hak akses">
    <div className="access-head"><b>Kontrol peran</b><span>4 fungsi operasional</span></div>
    {["Kasir", "Supervisor", "Inventori", "Pemilik"].map((role, roleIndex) => <div className="access-row" key={role}><b>{role}</b>{[0, 1, 2, 3].map((cell) => <i key={cell} className={cell <= roleIndex ? "allowed" : ""} style={{ "--delay": `${(roleIndex + cell) * 0.08}s` }} />)}</div>)}
    <span className="access-scan" />
  </div>;
}

export default function Landing() {
  const [activeFeature, setActiveFeature] = useState(0);
  const selectedFeature = FEATURES[activeFeature];
  const SelectedFeatureIcon = selectedFeature.icon;

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
      <style>{`
        .neo-workbench{display:grid;grid-template-columns:330px 1fr;min-height:470px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE}}
        .neo-feature-rail{display:flex;flex-direction:column;border-right:1px solid ${LINE}}
        .neo-feature-tab{appearance:none;border:0;border-bottom:1px solid ${LINE};background:transparent;color:#6f8d7b;text-align:left;padding:20px 6px;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;cursor:pointer;transition:.22s}
        .neo-feature-tab svg{color:#557565}.neo-feature-tab b{font:700 14px ${JK}}.neo-feature-tab span{font:800 10px ${JK};color:#41604e}
        .neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:16px;color:white;background:linear-gradient(90deg,rgba(39,223,117,.12),transparent)}
        .neo-feature-tab.is-active svg,.neo-feature-tab.is-active span{color:${ACCENT}}
        .neo-feature-stage{position:relative;overflow:hidden;padding:46px 54px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(circle at 80% 30%,rgba(39,223,117,.12),transparent 32rem)}
        .neo-feature-stage:before{content:"";position:absolute;inset:-40% 0 auto;height:40%;background:linear-gradient(transparent,rgba(39,223,117,.12),transparent);animation:stage-scan 4s linear infinite}
        .neo-stage-head{position:relative;display:flex;gap:20px;align-items:flex-start}.neo-stage-icon{width:68px;height:68px;display:grid;place-items:center;border:1px solid rgba(39,223,117,.38);border-radius:18px;color:${ACCENT};background:rgba(39,223,117,.08);box-shadow:0 0 36px rgba(39,223,117,.13)}
        .neo-stage-copy small{color:${ACCENT};letter-spacing:.16em;text-transform:uppercase;font-size:10px;font-weight:800}.neo-stage-copy h3{font:800 clamp(28px,4vw,46px)/1.1 ${JK};margin:9px 0 13px}.neo-stage-copy p{color:${MUTED};line-height:1.75;max-width:650px;margin:0}
        .neo-stage-visual{position:relative;height:180px;display:flex;align-items:end;gap:10px;border-bottom:1px solid ${LINE}}.neo-stage-bar{flex:1;height:calc(28px + var(--bar) * 18px);max-height:150px;background:linear-gradient(180deg,${ACCENT},rgba(39,223,117,.08));border-radius:5px 5px 0 0;transform-origin:bottom;animation:bar-rise .62s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--bar) * 55ms);box-shadow:0 0 18px rgba(39,223,117,.12)}
        .neo-stage-line{position:absolute;left:0;right:0;top:42%;height:1px;background:linear-gradient(90deg,transparent,${BLUE},transparent);box-shadow:0 0 12px ${BLUE}}
        .neo-solution{border-radius:0;border-left:0;border-right:0;padding:42px 0;background:transparent}.neo-flow{gap:0}.neo-flow>div{position:relative;border-radius:0;border-width:0 0 0 1px;background:transparent;padding:18px 18px 18px 22px}.neo-flow>div:after{content:"";position:absolute;right:-4px;top:28px;width:7px;height:7px;border-radius:50%;background:${ACCENT};box-shadow:0 0 14px ${ACCENT}}.neo-flow>div:last-child:after{display:none}
        @keyframes stage-scan{to{transform:translateY(750px)}}@keyframes bar-rise{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}
        @media(max-width:1050px){.neo-workbench{grid-template-columns:270px 1fr}}
        @media(max-width:720px){.neo-workbench{display:block}.neo-feature-rail{border-right:0;display:grid;grid-template-columns:1fr 1fr}.neo-feature-tab{padding:15px 8px;grid-template-columns:28px 1fr}.neo-feature-tab span{display:none}.neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:12px}.neo-feature-stage{min-height:420px;padding:34px 22px}.neo-stage-icon{width:54px;height:54px}}
      `}</style>
      <style>{`
        .neo-page{background:#f5fbf7;color:#0b2a1a}
        .neo-page:before{background:radial-gradient(circle at 78% 8%,rgba(39,223,117,.22),transparent 34rem),radial-gradient(circle at 12% 38%,rgba(30,124,255,.11),transparent 30rem),linear-gradient(rgba(19,92,54,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(19,92,54,.035) 1px,transparent 1px);background-size:auto,auto,46px 46px,46px 46px}
        .neo-nav{background:rgba(250,255,252,.82);border-color:rgba(15,79,43,.12);box-shadow:0 12px 42px rgba(14,77,41,.08)}.neo-links,.neo-mobile a{color:#4e695a}.neo-links a:hover{color:#0b2a1a}.neo-button{color:#123c27;background:rgba(255,255,255,.76);border-color:rgba(18,91,50,.15)}.neo-primary{color:#032411}.neo-menu{color:#123c27;background:white}
        .neo-kicker{background:#e9fff1;color:#145b32;border-color:rgba(39,180,95,.25)}.neo-lead,.neo-section-head p,.neo-stage-copy p,.neo-solution-copy p{color:#577063}.neo-check{color:#657c70}.neo-check b{color:#173b27}
        .pos-stage{filter:drop-shadow(0 30px 45px rgba(26,93,56,.13))}.pos-glow{background:radial-gradient(circle,rgba(39,223,117,.3),transparent 62%)}
        .neo-strip{background:rgba(255,255,255,.7);border-color:rgba(15,79,43,.12)}.neo-strip-item{color:#4c6758;border-color:rgba(15,79,43,.12)}
        .neo-workbench{min-height:560px;border:1px solid rgba(15,79,43,.12);border-radius:30px;overflow:hidden;background:rgba(255,255,255,.74);box-shadow:0 30px 80px rgba(21,85,49,.1)}
        .neo-feature-rail{background:rgba(236,249,240,.68);border-color:rgba(15,79,43,.12)}.neo-feature-tab{color:#547061;border-color:rgba(15,79,43,.1);padding-left:22px}.neo-feature-tab svg{color:#4f7760}.neo-feature-tab span{color:#718b7d}.neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:29px;color:#092d1a;background:linear-gradient(90deg,rgba(39,223,117,.17),rgba(255,255,255,.2))}.neo-feature-tab.is-active{box-shadow:inset 3px 0 ${ACCENT}}
        .neo-feature-stage{padding:42px 48px;background:radial-gradient(circle at 84% 16%,rgba(39,223,117,.17),transparent 25rem),linear-gradient(145deg,rgba(255,255,255,.75),rgba(237,249,241,.75))}.neo-feature-stage:before{display:none}.neo-stage-icon{background:#e9fff1;box-shadow:0 15px 35px rgba(28,162,82,.13)}.neo-stage-copy h3{color:#0b2a1a}
        .neo-solution{border-color:rgba(15,79,43,.12)}.neo-flow>div{border-color:rgba(15,79,43,.12)}.neo-flow b{color:#123c27}.neo-flow span{color:#62796c}
        .feature-sim{position:relative;height:245px;margin-top:28px;overflow:hidden;border:1px solid rgba(19,101,52,.12);border-radius:24px;background:linear-gradient(145deg,#fff,#eef9f2);box-shadow:inset 0 1px #fff}
        .sim-pos{display:grid;grid-template-columns:1.25fr .75fr;gap:12px;padding:20px}.sim-pos-products{display:grid;grid-template-columns:1fr 1fr;gap:9px}.sim-pos-products>b{grid-column:1/-1;font-size:11px;color:#789083}.sim-pos-products span{position:relative;display:flex;align-items:center;gap:8px;padding:10px;border:1px solid rgba(20,92,49,.1);border-radius:12px;background:#fff;font-size:10px;font-weight:700;animation:sim-rise .6s both;animation-delay:var(--delay)}.sim-pos-products span i{width:23px;height:23px;border-radius:8px;background:linear-gradient(145deg,#75efaa,#1ebd64)}.sim-pos-products small{margin-left:auto;color:#17aa58}.sim-pos-cart{padding:17px;border-radius:16px;color:white;background:#123c27;display:flex;flex-direction:column}.sim-pos-cart small{font-size:8px;color:#99b7a6}.sim-pos-cart>strong{font:700 22px ${JK};margin:8px 0 auto}.sim-pos-cart>div{display:flex;justify-content:space-between;align-items:end;padding-top:12px;border-top:1px solid rgba(255,255,255,.13)}.sim-pos-cart>div span{font-size:9px}.sim-pos-cart>div b{color:${ACCENT}}.sim-pos-cart button{border:0;border-radius:9px;background:${ACCENT};font-weight:800;padding:9px;margin-top:11px}.sim-scan{position:absolute;left:18px;right:41%;height:2px;background:${ACCENT};box-shadow:0 0 16px ${ACCENT};animation:scan-y 3s ease-in-out infinite}
        .sim-stock{padding:25px 27px}.stock-rack{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;height:150px;align-items:end;border-bottom:2px solid #aac7b5}.stock-rack>div{height:130px;position:relative;border:1px solid rgba(18,92,48,.12);border-radius:10px 10px 0 0;background:#fff;overflow:hidden}.stock-rack>div span{position:absolute;left:0;right:0;bottom:0;height:var(--level);background:linear-gradient(#69e69f,#25ba66);animation:fill-stock .9s both;animation-delay:var(--delay)}.stock-rack small{position:absolute;left:0;right:0;top:9px;text-align:center;font-weight:800;font-size:9px;z-index:2}.stock-status{display:flex;gap:18px;align-items:center;padding-top:15px;font-size:9px;color:#60786a}.stock-status b{margin-right:auto;color:#173c27;font-size:11px}.stock-status i{display:inline-block;width:7px;height:7px;border-radius:50%;background:${ACCENT};margin-right:5px}.stock-status .warning i{background:#ff9f39}.stock-packet{position:absolute;width:10px;height:10px;border-radius:50%;left:5%;bottom:87px;background:white;box-shadow:0 0 0 4px ${ACCENT},0 0 18px ${ACCENT};animation:stock-move 4.8s linear infinite}.stock-packet.second{animation-delay:-2.4s}
        .sim-supply{display:grid;grid-template-columns:1fr .45fr 1fr .45fr 1fr;align-items:center;padding:32px}.supply-node{min-height:128px;padding:20px;border:1px solid rgba(19,101,52,.13);border-radius:18px;background:#fff;box-shadow:0 15px 30px rgba(21,80,45,.07);animation:sim-rise .65s both}.supply-node small{font-weight:800;color:${ACCENT_2}}.supply-node b,.supply-node span{display:block}.supply-node b{font:700 13px ${JK};margin:25px 0 6px}.supply-node span{font-size:9px;color:#6a8174}.supply-path{height:1px;background:#9ecbb2;position:relative}.supply-path i{position:absolute;top:-4px;width:9px;height:9px;border-radius:50%;background:${ACCENT};box-shadow:0 0 12px ${ACCENT};animation:path-run 2.4s linear infinite}
        .sim-report{display:grid;grid-template-columns:.7fr 1.3fr;padding:26px;gap:25px}.report-metric{display:flex;flex-direction:column;justify-content:center}.report-metric small{font-size:8px;color:${ACCENT_2};font-weight:800}.report-metric b{font:700 22px/1.15 ${JK};margin:10px 0}.report-metric span{font-size:9px;color:#71887b}.report-chart{position:relative;border-left:1px solid #bcd1c4;border-bottom:1px solid #bcd1c4;background:repeating-linear-gradient(0deg,transparent 0 37px,rgba(30,98,57,.07) 38px);overflow:hidden}.report-chart>i{position:absolute;left:calc(5% + var(--x)*15%);top:var(--y);width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ${ACCENT_2};box-shadow:0 0 0 5px rgba(39,223,117,.12);animation:point-in .5s both;animation-delay:var(--delay)}.report-chart>i:not(:last-of-type):after{content:"";position:absolute;left:7px;top:3px;width:calc(15vw - 10px);max-width:90px;height:2px;background:${ACCENT_2};transform:rotate(-15deg);transform-origin:left}.chart-sweep{position:absolute;top:0;bottom:0;width:25%;background:linear-gradient(90deg,transparent,rgba(72,231,136,.18),transparent);animation:chart-sweep 3.5s linear infinite}
        .sim-outlet{display:grid;place-items:center}.outlet-core,.outlet-node{position:absolute;display:grid;place-items:center;text-align:center;border-radius:18px;background:#fff;box-shadow:0 15px 35px rgba(18,78,44,.12);z-index:2}.outlet-core{width:106px;height:106px}.outlet-core img{width:52px}.outlet-core b{font-size:10px}.outlet-node{width:118px;height:68px}.outlet-node i{position:absolute;top:-4px;width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 12px ${ACCENT}}.outlet-node b{font-size:10px}.outlet-node small{font-size:8px;color:#6d8578}.outlet-1{left:7%;top:22%}.outlet-2{right:7%;top:18%}.outlet-3{right:14%;bottom:12%}.outlet-orbit{position:absolute;width:52%;height:72%;border:1px solid rgba(30,180,88,.24);border-radius:50%;animation:outlet-spin 9s linear infinite}.orbit-two{width:75%;height:46%;animation-direction:reverse;animation-duration:12s}
        .sim-access{padding:22px 28px}.access-head{display:flex;justify-content:space-between;padding-bottom:13px;border-bottom:1px solid rgba(19,101,52,.12)}.access-head b{font-size:12px}.access-head span{font-size:9px;color:#6e8478}.access-row{display:grid;grid-template-columns:1fr repeat(4,42px);gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(19,101,52,.08)}.access-row b{font-size:10px}.access-row i{width:31px;height:19px;border-radius:20px;background:#dce8e0;position:relative}.access-row i:after{content:"";position:absolute;width:13px;height:13px;left:3px;top:3px;border-radius:50%;background:white;transition:.3s}.access-row i.allowed{background:${ACCENT};animation:permit .4s both;animation-delay:var(--delay)}.access-row i.allowed:after{left:15px}.access-scan{position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${ACCENT},transparent);box-shadow:0 0 14px ${ACCENT};animation:scan-y 3.2s ease-in-out infinite}
        .neo-cta-panel{color:white}.neo-footer{background:#eaf5ee;border-color:rgba(15,79,43,.12)}.neo-footer-inner{color:#557063}.neo-footer a:hover{color:#123c27}
        .pos-screen{animation:geraina-screen-flight 8s cubic-bezier(.45,0,.55,1) infinite}.pos-scanner{animation:geraina-scanner-route 10s cubic-bezier(.45,0,.55,1) infinite}.pos-printer{animation:geraina-printer-route 10s cubic-bezier(.45,0,.55,1) infinite}.pos-card{animation:geraina-card-route 10s cubic-bezier(.45,0,.55,1) infinite}.pos-cube{animation:geraina-cube-route 10s cubic-bezier(.45,0,.55,1) infinite}.stock-panel{animation:geraina-panel-left 10s cubic-bezier(.45,0,.55,1) infinite}.report-panel{animation:geraina-panel-right 10s cubic-bezier(.45,0,.55,1) infinite}.pos-printer i{animation:geraina-receipt 3.3s ease-in-out infinite}.product-dot{animation:geraina-product-scan 4.8s ease-in-out infinite}.pos-products>div:nth-child(2) .product-dot{animation-delay:-.7s}.pos-products>div:nth-child(3) .product-dot{animation-delay:-1.4s}.pos-products>div:nth-child(4) .product-dot{animation-delay:-2.1s}.pos-products>div:nth-child(5) .product-dot{animation-delay:-2.8s}.pos-products>div:nth-child(6) .product-dot{animation-delay:-3.5s}.pos-status{animation:geraina-ready 2.4s ease-in-out infinite}.cart-total strong{animation:geraina-total 4.8s ease-in-out infinite}.pos-stage:after{content:"";position:absolute;left:12%;right:6%;bottom:10%;height:16%;border-radius:50%;background:radial-gradient(ellipse,rgba(24,145,70,.18),transparent 68%);filter:blur(16px);animation:geraina-shadow 8s ease-in-out infinite;z-index:-1}
        @keyframes geraina-screen-flight{0%,100%{transform:rotateY(-8deg) rotateX(3deg) translate3d(0,0,0)}35%{transform:rotateY(-4deg) rotateX(1deg) translate3d(8px,-12px,22px)}70%{transform:rotateY(-11deg) rotateX(5deg) translate3d(-5px,-5px,8px)}}@keyframes geraina-scanner-route{0%,100%{transform:translate3d(0,0,20px) rotate(-8deg)}28%{transform:translate3d(18px,-25px,45px) rotate(-3deg)}55%{transform:translate3d(10px,-8px,28px) rotate(-12deg)}78%{transform:translate3d(-9px,-18px,42px) rotate(-6deg)}}@keyframes geraina-printer-route{0%,100%{transform:translate3d(0,0,18px) rotate(0)}30%{transform:translate3d(10px,-14px,34px) rotate(2deg)}62%{transform:translate3d(-7px,-5px,22px) rotate(-2deg)}}@keyframes geraina-card-route{0%,100%{transform:translate3d(0,0,12px) rotate(8deg)}32%{transform:translate3d(-24px,-34px,48px) rotate(-2deg)}62%{transform:translate3d(-12px,-10px,30px) rotate(13deg)}82%{transform:translate3d(7px,-20px,24px) rotate(6deg)}}@keyframes geraina-cube-route{0%,100%{transform:translate3d(0,0,18px) rotateY(0) rotateX(0)}50%{transform:translate3d(-18px,-18px,52px) rotateY(180deg) rotateX(12deg)}}@keyframes geraina-panel-left{0%,100%{transform:translate3d(0,0,24px)}36%{transform:translate3d(18px,-12px,48px)}68%{transform:translate3d(6px,8px,30px)}}@keyframes geraina-panel-right{0%,100%{transform:translate3d(0,0,26px)}32%{transform:translate3d(-20px,10px,52px)}72%{transform:translate3d(-7px,-14px,34px)}}@keyframes geraina-receipt{0%,100%{transform:translateY(-8px);height:18px}50%{transform:translateY(7px);height:38px}}@keyframes geraina-product-scan{0%,60%,100%{transform:none;filter:none}72%{transform:translateY(-4px) scale(1.12);filter:drop-shadow(0 0 9px ${ACCENT})}}@keyframes geraina-ready{50%{transform:scale(1.08);box-shadow:0 0 0 7px rgba(39,223,117,.1)}}@keyframes geraina-total{50%{text-shadow:0 0 16px rgba(39,223,117,.7)}}@keyframes geraina-shadow{50%{transform:scale(.78);opacity:.55}}
        @keyframes sim-rise{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:none}}@keyframes scan-y{0%,100%{top:15%}50%{top:85%}}@keyframes fill-stock{from{height:0}to{height:var(--level)}}@keyframes stock-move{from{left:5%}to{left:93%}}@keyframes path-run{from{left:0}to{left:100%}}@keyframes point-in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}@keyframes chart-sweep{from{left:-30%}to{left:110%}}@keyframes outlet-spin{to{transform:rotate(360deg)}}@keyframes permit{from{transform:scale(.65)}to{transform:none}}
        @media(max-width:720px){.neo-workbench{border-radius:22px}.neo-feature-stage{padding:28px 20px}.feature-sim{height:265px}.sim-supply{padding:18px;grid-template-columns:1fr 20px 1fr 20px 1fr}.supply-node{padding:11px}.supply-node b{font-size:10px}.sim-report{grid-template-columns:1fr}.report-metric{display:none}.access-row{grid-template-columns:1fr repeat(4,30px);gap:4px}.access-row i{transform:scale(.8)}}
      `}</style>
      <style>{`
        .neo-page{background:#040a08;color:#f6fff9}.neo-page:before{background:radial-gradient(circle at 78% 8%,rgba(39,223,117,.15),transparent 34rem),radial-gradient(circle at 12% 46%,rgba(29,105,202,.08),transparent 30rem),linear-gradient(rgba(80,205,129,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(80,205,129,.025) 1px,transparent 1px);background-size:auto,auto,46px 46px,46px 46px}
        .neo-nav{background:rgba(4,10,8,.86);border-color:rgba(74,222,132,.16);box-shadow:0 14px 46px rgba(0,0,0,.28)}.neo-links,.neo-mobile a{color:#a3b7aa}.neo-links a:hover{color:#fff}.neo-button{color:#f2fff7;background:rgba(8,23,16,.72);border-color:rgba(74,222,132,.2)}.neo-primary{color:#00170b}.neo-menu{color:#fff;background:#08160f}
        .neo-kicker{background:rgba(8,36,24,.72);color:#c9f7d9;border-color:rgba(39,223,117,.3)}.neo-lead,.neo-section-head p,.neo-stage-copy p,.neo-solution-copy p{color:#9eb2a5}.neo-check{color:#82968a}.neo-check b{color:#f4fff8}
        .neo-hero-cinematic{grid-template-columns:.82fr 1.18fr;gap:30px}
        .hero-scene-image{height:570px;position:relative;overflow:hidden;border:1px solid rgba(77,227,137,.2);border-radius:30px;background:#020807;isolation:isolate;box-shadow:0 40px 90px rgba(0,0,0,.4),inset 0 1px rgba(255,255,255,.04)}
        .hero-scene-image:before{content:"";position:absolute;inset:-10px;background:url("/geraina/assets/scenes/geraina-retail.png") 76% center/cover no-repeat;animation:retail-camera 13s ease-in-out infinite alternate;z-index:-3}
        .hero-scene-image:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,10,8,.5),transparent 38%),linear-gradient(180deg,transparent 62%,rgba(2,10,8,.64));z-index:-2}
        .scene-sweep{position:absolute;left:-30%;top:0;width:24%;height:100%;transform:skewX(-12deg);background:linear-gradient(90deg,transparent,rgba(72,255,150,.12),transparent);animation:retail-sweep 6.5s ease-in-out infinite}
        .scene-sigil{position:absolute;right:28px;bottom:28px;width:94px;height:94px;display:grid;place-items:center;border:1px solid rgba(65,231,132,.35);border-radius:28px;background:rgba(2,16,10,.72);box-shadow:0 22px 50px rgba(0,0,0,.35),0 0 35px rgba(39,223,117,.16);backdrop-filter:blur(14px);animation:sigil-float 5s ease-in-out infinite}
        .scene-sigil:before,.scene-sigil:after{content:"";position:absolute;inset:-13px;border:1px solid rgba(39,223,117,.18);border-radius:36px;animation:sigil-pulse 3.6s ease-out infinite}.scene-sigil:after{animation-delay:-1.8s}
        .scene-sigil img{width:62px;height:62px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(39,223,117,.46))}
        .scene-particle{position:absolute;width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 16px ${ACCENT};animation:retail-particle 8s ease-in-out infinite}.scene-particle.p1{left:14%;top:24%}.scene-particle.p2{left:48%;top:14%;animation-delay:-2.7s}.scene-particle.p3{left:38%;bottom:12%;animation-delay:-5.1s}
        .neo-strip{background:rgba(7,19,13,.78);border-color:rgba(70,220,128,.14)}.neo-strip-item{color:#93a99a;border-color:rgba(70,220,128,.13)}
        .neo-workbench{border-color:rgba(70,220,128,.14);background:#07130d;box-shadow:0 34px 90px rgba(0,0,0,.32)}.neo-feature-rail{background:#050d09;border-color:rgba(70,220,128,.13)}.neo-feature-tab{color:#82978a;border-color:rgba(70,220,128,.1)}.neo-feature-tab:hover,.neo-feature-tab.is-active{color:#f5fff9;background:linear-gradient(90deg,rgba(39,223,117,.15),transparent)}
        .neo-feature-stage{background:radial-gradient(circle at 84% 16%,rgba(39,223,117,.12),transparent 25rem),linear-gradient(145deg,#0b1a12,#07100b)}.neo-stage-icon{background:#0b2416}.neo-stage-copy h3{color:#f4fff8}
        .feature-sim{border-color:rgba(70,220,128,.13);background:linear-gradient(145deg,#0c1b12,#07100b);box-shadow:inset 0 1px rgba(255,255,255,.03)}
        .sim-pos-products,.sim-pos-cart,.supply-node,.outlet-core,.outlet-node,.ops-stream span{color:#f5fff8;background:#0c1d14;border-color:rgba(70,220,128,.14);box-shadow:0 15px 28px rgba(0,0,0,.24)}.stock-status,.report-metric,.access-head,.access-row{color:#d7e8dd}.neo-solution{border-color:rgba(70,220,128,.14)}.neo-flow>div{border-color:rgba(70,220,128,.13)}.neo-flow b{color:#f4fff8}.neo-flow span{color:#90a698}.neo-footer{background:#07100b;border-color:rgba(70,220,128,.14)}.neo-footer-inner{color:#8ea295}.neo-footer a:hover{color:#fff}
        @keyframes retail-camera{0%{transform:scale(1.03) translate3d(-3px,0,0)}100%{transform:scale(1.09) translate3d(11px,-8px,0)}}@keyframes retail-sweep{0%,18%{left:-30%;opacity:0}42%{opacity:1}70%,100%{left:115%;opacity:0}}@keyframes sigil-float{50%{transform:translateY(-11px) rotate(1.5deg)}}@keyframes sigil-pulse{0%{transform:scale(.84);opacity:.8}100%{transform:scale(1.3);opacity:0}}@keyframes retail-particle{0%,100%{transform:translate3d(0,0,0);opacity:.35}35%{transform:translate3d(35px,-22px,0);opacity:1}70%{transform:translate3d(70px,18px,0);opacity:.55}}
        @media(max-width:1050px){.neo-hero-cinematic{grid-template-columns:1fr}.hero-scene-image{width:min(900px,100%);height:520px;margin:auto}}
        @media(max-width:720px){.hero-scene-image{height:430px;margin-top:14px;border-radius:23px}.hero-scene-image:before{background-position:72% center}.scene-sigil{right:18px;bottom:18px;width:76px;height:76px}.scene-sigil img{width:50px;height:50px}}
        @media(prefers-reduced-motion:reduce){.hero-scene-image:before,.scene-sweep,.scene-sigil,.scene-sigil:before,.scene-sigil:after,.scene-particle{animation:none}}
      `}</style>
      <Nav />
      <main>
        <section className="neo-hero neo-hero-cinematic">
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
          <div className="hero-scene-image geraina-scene" aria-label="Lingkungan operasional retail Geraina POS">
            <i className="scene-sweep" aria-hidden="true" />
            <i className="scene-particle p1" aria-hidden="true" /><i className="scene-particle p2" aria-hidden="true" /><i className="scene-particle p3" aria-hidden="true" />
            <div className="scene-sigil" aria-hidden="true"><img src="/assets/brand/geraina-icon.png" alt="" /></div>
          </div>
        </section>

        <section className="neo-strip">
          <div className="neo-strip-inner">{QUICK_FEATURES.map((item) => <div className="neo-strip-item" key={item.label}><item.icon size={17} /><span>{item.label}</span></div>)}</div>
        </section>

        <section id="fitur" className="neo-section">
          <div className="neo-section-head"><div><small>Fitur utama</small><h2>Perangkat operasional untuk bisnis retail</h2></div><p>Struktur halaman, interaksi, dan visual mengikuti keluarga DagangOS, sedangkan konten dan warna tetap spesifik untuk retail.</p></div>
          <div className="neo-workbench">
            <div className="neo-feature-rail" role="tablist" aria-label="Fitur Geraina POS">
              {FEATURES.map((feature, index) => (
                <button key={feature.title} type="button" role="tab" aria-selected={activeFeature === index} className={`neo-feature-tab ${activeFeature === index ? "is-active" : ""}`} onClick={() => setActiveFeature(index)} onMouseEnter={() => setActiveFeature(index)}>
                  <feature.icon size={20} /><b>{feature.title}</b><span>0{index + 1}</span>
                </button>
              ))}
            </div>
            <div className="neo-feature-stage" key={selectedFeature.title}>
              <div className="neo-stage-head"><div className="neo-stage-icon"><SelectedFeatureIcon size={32} /></div><div className="neo-stage-copy"><small>Modul aktif · 0{activeFeature + 1}</small><h3>{selectedFeature.title}</h3><p>{selectedFeature.text}</p></div></div>
              <RetailFeatureScene index={activeFeature} />
            </div>
          </div>
        </section>

        <section id="solusi" className="neo-section" style={{ paddingTop: 0 }}>
          <div className="neo-solution"><div className="neo-solution-copy"><h2>Satu alur dari transaksi sampai laporan.</h2><p>Geraina POS menyatukan aktivitas kasir dan back-office agar perubahan stok, pembelian, dan laporan dapat dikelola dalam sistem yang sama.</p></div><div className="neo-flow"><div><Store size={24} /><b>Produk</b><span>Siapkan katalog dan data barang.</span></div><div><ShoppingCart size={24} /><b>Transaksi</b><span>Proses penjualan melalui kasir.</span></div><div><Boxes size={24} /><b>Inventori</b><span>Pantau pergerakan dan penyesuaian stok.</span></div><div><BarChart3 size={24} /><b>Laporan</b><span>Tinjau data operasional bisnis.</span></div></div></div>
        </section>

        <section className="neo-cta-panel"><div><h2>Mulai kelola operasional retail Anda.</h2><p>Buat akun Geraina POS atau tinjau paket yang tersedia.</p></div><div className="neo-cta"><Link to="/geraina/register" className="neo-button neo-primary">Mulai Gratis</Link><Link to="/geraina/pricing" className="neo-button">Lihat Harga</Link></div></section>
      </main>
      <footer className="neo-footer"><div className="neo-footer-inner"><div className="neo-footer-brand"><img src="/assets/brand/geraina-icon.png" alt="" /><span>© 2026 Geraina POS · PT DagangOS Digital Indonesia</span></div><div className="neo-footer-links"><Link to="/geraina/pricing">Harga</Link><a href="/sumber-daya">Kontak</a><a href="/">DagangOS</a></div></div></footer>
    </div>
  );
}
