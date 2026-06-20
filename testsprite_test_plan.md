# Rencana Pengujian AI TestSprite (Geraina POS)

Dokumen ini dirancang sebagai panduan bagi AI Agent TestSprite untuk melakukan pengujian otomatis (E2E) terhadap website dan aplikasi **Geraina POS by DagangOS**.

---

## 1. Konfigurasi Lingkungan Pengujian (Testing Environment)
*   **Frontend Web URL:** `http://localhost:3000`
*   **Backend API URL:** `http://localhost:8000`
*   **Bahasa Utama Aplikasi:** Bahasa Indonesia (ID)

---

## 2. Kredensial Pengujian (Test Credentials)

| Peran (Role) | Email | Kata Sandi (Password) | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Owner (Pemilik)** | `owner@geraina.com` | `geraina123` | Akses penuh (termasuk integrasi cloud & lisensi) |
| **Manager** | `manager@geraina.com` | `geraina123` | Manajemen produk, inventaris, pelanggan, staf, & laporan |
| **Cashier (Kasir)** | `cashier@geraina.com` | `geraina123` | Hanya layar POS kasir, tambah pelanggan, & riwayat sales |
| **Warehouse (Gudang)**| `warehouse@geraina.com` | `geraina123` | Hanya modul logistik, stok masuk, PO, & list supplier |

> **Catatan:** Akun `manager`, `cashier`, dan `warehouse` otomatis terbuat (seeded) ketika akun `owner` melakukan pendaftaran pertama kali di sistem.

---

## 3. Selektor Elemen Penting (`data-testid`)

Gunakan selektor `data-testid` berikut untuk interaksi yang stabil:

| Halaman / Elemen | Atribut `data-testid` | Deskripsi |
| :--- | :--- | :--- |
| **Navigasi Landing Page** | `landing-nav` | Header menu di halaman depan |
| **Tombol Mulai Gratis** | `nav-register-btn` | Tombol pendaftaran di landing page |
| **Formulir Login** | `login-form` | Container form login (`/login`) |
| **Halaman Dashboard** | `dashboard-page` | Container dashboard setelah login |
| **Menu Sidebar** | `app-sidebar` | Navigasi menu utama aplikasi |
| **Halaman POS** | `pos-page` | Layar transaksi kasir (`/app/pos`) |
| **Keranjang Belanja** | `pos-cart` | Panel keranjang belanja di sebelah kanan |
| **Tombol Bayar POS** | `checkout-btn` | Tombol penyelesaian transaksi kasir |
| **Dialog Struk** | `receipt-dialog` | Modal struk pop-up setelah checkout |
| **Unduh PDF Struk** | `receipt-pdf-thermal-btn` | Tombol cetak struk PDF format thermal 80mm |
| **Unduh PDF Invoice** | `receipt-pdf-invoice-btn` | Tombol cetak invoice PDF format A4 |
| **Daftar Pelanggan** | `customers-page` | Modul database pelanggan |
| **Daftar Produk** | `products-page` | Katalog produk |
| **Matriks Izin Akses** | `permissions-page` | Halaman pengaturan hak akses staf |

---

## 4. Skenario Pengujian Utama (E2E Test Flows)

### Skenario 1: Registrasi & Auto-Seeding (Pendaftaran Baru)
1.  Buka `http://localhost:3000/register`.
2.  Masukkan data:
    *   **Nama Toko:** `Toko Uji TestSprite`
    *   **Email:** `owner+test@geraina.com` (Gunakan email unik/random per run)
    *   **Password:** `geraina123`
3.  Klik tombol **Daftar Sekarang**.
4.  Verifikasi bahwa pengguna diarahkan ke halaman `/app/dashboard`.
5.  Verifikasi database produk telah ter-seed secara otomatis dengan minimal 6 produk bawaan (misal: "Es Kopi Susu Gula Aren").

### Skenario 2: Login Peran Kasir
1.  Buka `http://localhost:3000/login`.
2.  Masukkan email `cashier@geraina.com` dan password `geraina123`.
3.  Klik **Masuk**.
4.  Buka sidebar menu, verifikasi bahwa menu **Laporan**, **Integrasi**, dan **Pengaturan** **tidak muncul** karena peran Kasir tidak memilikinya.

### Skenario 3: Transaksi Penjualan Tunai (Cash POS Checkout)
1.  Buka `http://localhost:3000/app/pos` (Masuk sebagai Owner/Kasir).
2.  Pilih/klik minimal 2 produk untuk dimasukkan ke keranjang belanja (`data-testid="pos-cart"`).
3.  Ubah jumlah produk (tambah/kurang) dan masukkan diskon nominal (misal: `1000`).
4.  Pilih metode pembayaran **Tunai** (`data-testid="pm-cash"`).
5.  Input nominal uang diterima lebih besar dari total (misal: total Rp 40.000, bayar Rp 50.000).
6.  Verifikasi kembalian terhitung dengan benar.
7.  Klik **Bayar** (`data-testid="checkout-btn"`).
8.  Verifikasi pop-up dialog struk (`data-testid="receipt-dialog"`) muncul menampilkan nomor order, status **Lunas**, dan tombol cetak PDF.

### Skenario 4: Pembayaran QRIS Dinamis (Simulasi Webhook)
1.  Di halaman POS, isi keranjang lalu pilih metode pembayaran **QRIS** (`data-testid="pm-qris"`).
2.  Klik **Bayar**.
3.  Verifikasi QR Code SVG (`data-testid="qris-display"`) terbit di dialog struk.
4.  Verifikasi status struk adalah **Menunggu pembayaran…**.
5.  Klik tombol **Simulasi: tandai lunas** (`data-testid="receipt-simulate-paid"`) untuk memicu simulasi perubahan status webhook.
6.  Verifikasi status berubah menjadi **Lunas** secara realtime.

### Skenario 5: Manajemen Inventaris & Stok Menipis
1.  Buka `/app/products`.
2.  Klik **Produk Baru**. Isi nama, harga, stok, dan simpan. Verifikasi produk muncul di tabel.
3.  Buka `/app/inventory/low-stock` (Stok Menipis).
4.  Verifikasi produk dengan stok $\le 5$ terdaftar di sini dengan label peringatan berwarna merah.

---

## 5. File Template Impor Excel/CSV Produk
Jika TestSprite ingin menguji fitur **Bulk Import**, buat file `import_test.csv` dengan struktur berikut:
```csv
name,sku,price,cost,stock,category,unit,active
Kopi Susu Uji,KOPI-01,15000,6000,50,Minuman,cup,true
Roti Keju Uji,ROTI-01,12000,5000,30,Roti,pcs,true
```
Dokumen template ini dapat diunduh langsung di aplikasi melalui endpoint:
`http://localhost:8000/api/products/import-template.csv`
