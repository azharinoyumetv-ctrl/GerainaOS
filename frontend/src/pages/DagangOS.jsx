import { Link } from "react-router-dom";
import { ArrowRight, Store, Cake, Sparkles, LayoutGrid, Cpu, LineChart, Shield, Leaf, Utensils } from "lucide-react";

export default function DagangOS() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-[hsl(var(--accent))/0.2]">
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
      <footer className="py-12 border-t border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-sm text-[hsl(var(--muted))] gap-4">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[hsl(var(--foreground))]">
            <Leaf className="text-[hsl(var(--primary))]" size={18} />
            <span>DagangOS Suite</span>
          </div>
          <div>
            © 2026 DagangOS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
