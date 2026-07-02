import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Store, Cake, Sparkles, LayoutGrid, Cpu, LineChart, Shield, Leaf, Utensils, ShieldCheck } from "lucide-react";

export default function DagangOS() {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-[hsl(var(--accent))/0.2] relative">
      {/* Navigation Header */}
      <header className="border-b border-[hsl(var(--border))] bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-xl font-extrabold flex items-center gap-2">
            <Leaf className="text-[hsl(var(--primary))]" size={24} />
            <span>DagangOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[hsl(var(--muted))]">
            <a href="#about" className="hover:text-[hsl(var(--foreground))] transition-colors">Tentang Kami</a>
            <a href="#products" className="hover:text-[hsl(var(--foreground))] transition-colors">Produk OS</a>
            <a href="#benefits" className="hover:text-[hsl(var(--foreground))] transition-colors">Keunggulan</a>
            <a
              href="https://wa.me/628999155182?text=Halo%20DagangOS%2C%20saya%20tertarik%20dengan%20sistem%20operasi%20bisnis%20Anda."
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
            >
              Hubungi Kami
            </a>
          </nav>
          <a href="#products" className="btn-primary text-xs font-semibold px-4 py-2">
            Jelajahi Produk
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden bg-gradient-to-b from-white to-[hsl(var(--background))] bg-grain">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] text-xs font-semibold mb-6 animate-fadeup">
            <Sparkles size={14} />
            <span>Sistem Operasi Dagang UMKM Indonesia</span>
          </div>
          
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1] text-balance">
            Satu Ekosistem Digital. <br />
            <span className="text-[hsl(var(--primary))]">Semua Jenis Usaha.</span>
          </h1>
          
          <p className="text-[hsl(var(--muted))] text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
            DagangOS menyediakan sistem operasi kasir, inventaris, dan keuangan terpadu yang disesuaikan khusus untuk keunikan bisnis retail, minimarket, serta industri food & beverage (F&B).
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="#products" className="btn-primary py-3 px-6 flex items-center gap-2">
              Lihat Produk <ArrowRight size={16} />
            </a>
            <a href="#benefits" className="btn-outline py-3 px-6">
              Mengapa DagangOS?
            </a>
          </div>
        </div>
      </section>

      {/* Bento Grid Products Portfolio */}
      <section id="products" className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="label-tiny">Portfolio Produk</span>
          <h2 className="font-display text-4xl font-extrabold mt-3">Ekosistem Dagang Kami</h2>
          <p className="text-[hsl(var(--muted))] mt-3 max-w-lg mx-auto text-sm md:text-base">
            Pilih sistem operasi khusus yang dirancang sesuai dengan alur operasional kategori bisnis Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8">
          {/* Active: Geraina POS */}
          <div className="card-surface p-8 flex flex-col justify-between border-2 border-[hsl(var(--primary))]/20 hover:border-[hsl(var(--primary))] hover:shadow-lg transition-all duration-300 relative bg-white">
            <span className="absolute top-4 right-4 pill pill-success">Tersedia</span>
            <div>
              <div className="w-12 h-12 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] mb-6">
                <Store size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-[hsl(var(--primary))]">Geraina POS</h3>
              <p className="text-xs text-[hsl(var(--muted))] mt-3 leading-relaxed">
                Sistem Kasir (POS) serbaguna untuk UMKM retail, minimarket, dan toko kelontong. Terintegrasi QRIS dinamis, struk PDF thermal, dan mutasi stok realtime.
              </p>
            </div>
            <Link to="/geraina" className="btn-primary w-full mt-8 py-2.5 flex items-center justify-center gap-2 text-xs">
              Kunjungi Web App <ArrowRight size={14} />
            </Link>
          </div>

          {/* Coming Soon: DapurOS */}
          <div className="card-surface p-8 flex flex-col justify-between bg-white/50 border-[hsl(var(--border))] opacity-90 hover:opacity-100 transition-all duration-300 relative">
            <span className="absolute top-4 right-4 pill pill-warning">Segera Hadir</span>
            <div>
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-6">
                <Utensils size={24} />
              </div>
              <h3 className="font-display text-xl font-bold text-amber-600">DapurOS</h3>
              <p className="text-xs text-[hsl(var(--muted))] mt-3 leading-relaxed">
                Sistem kasir meja, kitchen display (KDS), split-bill, dan menu digital QR self-order khusus kafe, restoran, dan industri F&B.
              </p>
            </div>
            <button disabled className="btn-outline w-full mt-8 py-2.5 text-[hsl(var(--muted))] cursor-not-allowed bg-[hsl(var(--secondary))]/20 border-[hsl(var(--border))]/55 text-xs">
              Hubungi Kami
            </button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-white border-y border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="label-tiny">Keunggulan</span>
            <h2 className="font-display text-4xl font-extrabold mt-3">Mengapa Menggunakan DagangOS?</h2>
            <p className="text-[hsl(var(--muted))] mt-3 max-w-lg mx-auto text-sm md:text-base">
              Kami membawa standar teknologi software enterprise global untuk mendampingi pertumbuhan bisnis lokal Anda.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Cpu size={28} />
              </div>
              <h3 className="font-display text-xl font-bold">Teknologi Modern</h3>
              <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">
                Menggunakan stack REST API FastAPI berkecepatan tinggi dengan antarmuka React premium yang responsive di desktop, tablet, maupun mobile.
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-50 text-[hsl(var(--accent))] flex items-center justify-center mx-auto">
                <LineChart size={28} />
              </div>
              <h3 className="font-display text-xl font-bold">Analisis Bisnis Terintegrasi</h3>
              <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">
                Laporan laba rugi terperinci, HPP otomatis, pengingat stok menipis, hingga perhitungan poin loyalitas keanggotaan pelanggan.
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Shield size={28} />
              </div>
              <h3 className="font-display text-xl font-bold">Keamanan & Skalabilitas</h3>
              <p className="text-sm text-[hsl(var(--muted))] leading-relaxed">
                Desain multi-tenant yang aman dengan enkripsi password bcrypt, integrasi webhook resmi Xendit, dan data-driven cloud backups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[hsl(var(--border))] bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-sm text-[hsl(var(--muted))] gap-6">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[hsl(var(--foreground))]">
            <Leaf className="text-[hsl(var(--primary))]" size={18} />
            <span>DagangOS Suite</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs font-semibold">
            <button 
              onClick={() => setIsTermsOpen(true)} 
              className="hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Syarat & Ketentuan
            </button>
            <a 
              href="https://wa.me/628999155182?text=Halo%20DagangOS%2C%20saya%20ingin%20konsultasi%20mengenai%20produk%20sistem%20operasi%20bisnis." 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-emerald-600 transition-colors text-emerald-600 font-bold"
            >
              Hubungi Kami (WhatsApp)
            </a>
          </div>
          <div>
            © 2026 DagangOS. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Terms & Conditions Modal */}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />

      {/* Floating WhatsApp Widget */}
      <FloatingWhatsApp />
    </div>
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
            <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">Syarat & Ketentuan DagangOS</h3>
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
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">1. Layanan DagangOS</h4>
            <p>
              DagangOS menyediakan ekosistem sistem operasi digital terpadu untuk pelaku UMKM retail, minimarket, serta industri food & beverage (F&B) di Indonesia. Layanan meliputi modul kasir pintar, manajemen inventaris stok, pembukuan keuangan, dan integrasi pembayaran.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">2. Pendaftaran & Akun</h4>
            <p>
              Pengguna wajib memberikan informasi yang akurat dan sah saat melakukan pendaftaran. Keamanan kredensial masuk sistem diatur oleh pemilik bisnis. DagangOS tidak bertanggung jawab atas kebocoran akun akibat kelalaian pemilik/karyawan toko.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">3. Kebijakan Transaksi & Pembayaran</h4>
            <p>
              Layanan kami menggunakan model subscription berbayar. Pelanggan wajib membayar biaya paket secara tepat waktu. Segala bentuk integrasi pembayaran pihak ketiga (seperti Xendit, Stripe, Midtrans) terikat pada syarat & ketentuan masing-masing payment gateway.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">4. Hak Kekayaan Intelektual</h4>
            <p>
              Seluruh kekayaan intelektual, desain, perangkat lunak, dan merek DagangOS dilindungi undang-undang. Pengguna dilarang menduplikasi, menyebarluaskan, atau memodifikasi sistem operasi DagangOS tanpa izin tertulis dari manajemen perusahaan kami.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-[hsl(var(--foreground))] text-base">5. Hukum & Domisili Hukum</h4>
            <p>
              Persetujuan ini diatur berdasarkan hukum yang berlaku di Negara Kesatuan Republik Indonesia. Setiap perselisihan hukum yang tidak dapat diselesaikan secara kekeluargaan akan diselesaikan melalui pengadilan negeri yang disepakati bersama.
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
      href="https://wa.me/628999155182?text=Halo%20DagangOS%2C%20saya%20tertarik%20dengan%20sistem%20operasi%20bisnis%20Anda."
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
