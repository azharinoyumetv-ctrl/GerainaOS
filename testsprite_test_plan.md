# Rencana Pengujian AI TestSprite (Geraina POS)

Dokumen ini dirancang sebagai panduan bagi AI Agent TestSprite untuk melakukan pengujian otomatis (E2E) terhadap website dan aplikasi **Geraina POS by DagangOS**.

---

## 1. Konfigurasi Lingkungan Pengujian (Testing Environment)

### Lingkungan Lokal (Localhost)
*   **Frontend Web URL:** `http://localhost:3000`
*   **Backend API URL:** `http://localhost:8000`

### Lingkungan Live (Production)
*   **Frontend Web URL:** `https://gerainaos.pages.dev`
*   **Backend API URL:** `https://geraina-os.vercel.app/api`

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
| **Formulir Login** | `login-form` | Container form login (`/geraina/login`) |
| **Halaman Dashboard** | `dashboard-page` | Container dashboard setelah login |
| **Menu Sidebar** | `app-sidebar` | Navigasi menu utama aplikasi |
| **Halaman POS** | `pos-page` | Layar transaksi kasir (`/geraina/app/pos`) |
| **Keranjang Belanja** | `pos-cart` | Panel keranjang belanja di sebelah kanan |
| **Tombol Bayar POS** | `checkout-btn` | Tombol penyelesaian transaksi kasir |
| **Dialog Struk** | `receipt-dialog` | Modal struk pop-up setelah checkout |
| **Unduh PDF Struk** | `receipt-pdf-thermal-btn` | Tombol cetak struk PDF format thermal 80mm |
| **Unduh PDF Invoice** | `receipt-pdf-invoice-btn` | Tombol cetak invoice PDF format A4 |
| **Daftar Pelanggan** | `customers-page` | Modul database pelanggan |
| **Formulir Pelanggan** | `customer-form` | Form tambah/edit pelanggan |
| **Tombol Submit Pelanggan**| `customer-submit` | Tombol submit form pelanggan |
| **Tabel Pelanggan** | `customers-list` | Tabel database pelanggan |
| **Daftar Produk** | `products-page` | Katalog produk |
| **Matriks Izin Akses** | `permissions-page` | Halaman pengaturan hak akses staf |
| **Halaman Harga (Pricing)**| `pricing-page` | Halaman daftar paket langganan |
| **Card Paket Langganan** | `pricing-card-[tier]` | Card paket langganan (misal: `pricing-card-pro`) |
| **CTA Upgrade Paket** | `pricing-cta-[tier]` | Tombol upgrade pada card paket (misal: `pricing-cta-pro`) |
| **Toggle Tagihan** | `billing-toggle` | Toggle siklus tagihan (bulanan / tahunan) |
| **Section Add-ons** | `addons-section` | Kontainer daftar add-ons harga |
| **Detail Add-on** | `addon-[addon_id]` | Kontainer informasi item add-on (misal: `addon-extra_device`) |
| **Manajemen Cabang** | `branches-page` | Halaman manajemen outlet cabang |
| **Tabel Cabang** | `branches-list` | Tabel daftar cabang retail |
| **Manajemen Supplier** | `suppliers-page` | Halaman manajemen supplier |
| **Formulir Supplier** | `supplier-form` | Form tambah/edit supplier |
| **Tombol Submit Supplier**| `supplier-submit` | Tombol submit form supplier |
| **Tabel Supplier** | `suppliers-list` | Tabel database supplier |
| **Halaman PO** | `purchase-orders-page`| Halaman order pembelian (PO) |
| **Tabel Daftar PO** | `po-list` | Tabel daftar PO |
| **Halaman Penerimaan Barang**| `goods-receiving-page`| Halaman penerimaan barang dari supplier |
| **Tabel Penerimaan Barang**| `receiving-list` | Tabel riwayat penerimaan barang |
| **Halaman Membership** | `membership-page` | Halaman manajemen tier keanggotaan |
| **Formulir Membership** | `membership-form` | Form tambah/edit keanggotaan |
| **Tombol Submit Membership**| `membership-submit` | Tombol submit form keanggotaan |
| **Tabel Membership** | `membership-list` | Tabel daftar keanggotaan/tier |
| **Halaman Loyalitas** | `loyalty-page` | Halaman program poin loyalitas pelanggan |
| **Halaman Piutang** | `receivables-page` | Halaman Piutang Usaha |
| **Tabel Piutang** | `receivables-list` | Tabel daftar piutang usaha |
| **Halaman Utang** | `payables-page` | Halaman Utang Usaha |
| **Tabel Utang** | `payables-list` | Tabel daftar utang usaha |
| **Halaman Laporan** | `reports-page` | Halaman modul laporan bisnis |
| **Halaman Konfigurasi Bayar**| `payment-config-page` | Halaman konfigurasi payment channel |
| **Halaman Integrasi** | `integrations-page` | Halaman konfigurasi integrasi eksternal |
| **Halaman Staf & Karyawan** | `staff-page` | Halaman manajemen staf/karyawan |
| **Tabel Staf & Karyawan** | `staff-list` | Tabel daftar staf |
| **Halaman Peran Staf** | `roles-page` | Halaman manajemen peran staf |
| **Halaman Absensi** | `attendance-page` | Halaman absensi staf |
| **Halaman Kategori Produk**| `categories-page` | Halaman manajemen kategori produk |
| **Formulir Kategori** | `category-form` | Form tambah/edit kategori produk |
| **Tombol Submit Kategori** | `category-submit` | Tombol submit form kategori |
| **Tabel Kategori** | `categories-list` | Tabel daftar kategori produk |
| **Halaman Merek Produk** | `brands-page` | Halaman manajemen merek produk |
| **Formulir Merek** | `brand-form` | Form tambah/edit merek produk |
| **Tombol Submit Merek** | `brand-submit` | Tombol submit form merek |
| **Tabel Merek** | `brands-list` | Tabel daftar merek produk |
| **Halaman Satuan Produk** | `units-page` | Halaman manajemen satuan produk |
| **Formulir Satuan** | `unit-form` | Form tambah/edit satuan produk |
| **Tombol Submit Satuan** | `unit-submit` | Tombol submit form satuan |
| **Tabel Satuan** | `units-list` | Tabel daftar satuan produk |
| **Halaman Penyesuaian Stok**| `stock-adjustment-page`| Halaman penyesuaian stok manual |
| **Formulir Penyesuaian** | `adjustment-form` | Form penyesuaian stok |
| **Tombol Submit Penyesuaian**| `adjustment-submit` | Tombol submit penyesuaian stok |
| **Tabel Penyesuaian** | `adjustment-list` | Tabel riwayat penyesuaian stok |
| **Halaman Transfer Stok** | `stock-transfer-page` | Halaman transfer stok antar cabang |
| **Formulir Transfer** | `transfer-form` | Form transfer stok |
| **Tabel Transfer** | `transfer-list` | Tabel riwayat transfer stok |

---

## 4. Skenario Pengujian Utama (E2E Test Flows)

### Skenario 1: Registrasi & Auto-Seeding (Pendaftaran Baru)
1.  Buka `http://localhost:3000/geraina/register`.
2.  Masukkan data:
    *   **Nama Toko:** `Toko Uji TestSprite`
    *   **Email:** `owner+test@geraina.com` (Gunakan email unik/random per run)
    *   **Password:** `geraina123`
3.  Klik tombol **Daftar Sekarang**.
4.  Verifikasi bahwa pengguna diarahkan ke halaman `/geraina/app/dashboard`.
5.  Verifikasi database produk telah ter-seed secara otomatis dengan minimal 6 produk bawaan (misal: "Es Kopi Susu Gula Aren").

### Skenario 2: Login Peran Kasir
1.  Buka `http://localhost:3000/geraina/login`.
2.  Masukkan email `cashier@geraina.com` dan password `geraina123`.
3.  Klik **Masuk**.
4.  Buka sidebar menu, verifikasi bahwa menu **Laporan**, **Integrasi**, dan **Pengaturan** **tidak muncul** karena peran Kasir tidak memilikinya.

### Skenario 3: Transaksi Penjualan Tunai (Cash POS Checkout)
1.  Buka `http://localhost:3000/geraina/app/pos` (Masuk sebagai Owner/Kasir).
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
1.  Buka `/geraina/app/products`.
2.  Klik **Produk Baru**. Isi nama, harga, stok, dan simpan. Verifikasi produk muncul di tabel.
3.  Buka `/geraina/app/inventory/low-stock` (Stok Menipis).
4.  Verifikasi produk dengan stok $\le 5$ terdaftar di sini dengan label peringatan berwarna merah.

### Skenario 6: Pemilihan Paket Langganan (5 Pricing Tiers), Upgrade, & Add-ons
1.  Buka `/geraina/pricing` (Bisa diakses dari landing page atau menu lisensi).
2.  Verifikasi elemen kontainer utama `data-testid="pricing-page"` termuat.
3.  Verifikasi 5 card plan berikut terdisplay:
    *   **Free Trial:** `data-testid="pricing-card-trial"`
    *   **Starter:** `data-testid="pricing-card-starter"`
    *   **Pro:** `data-testid="pricing-card-pro"`
    *   **Business:** `data-testid="pricing-card-business"`
    *   **Multi-Branch:** `data-testid="pricing-card-multibranch"`
4.  Ubah toggle tagihan bulanan ke tahunan menggunakan `data-testid="billing-toggle"` (dan tombol `data-testid="billing-yearly"`). Verifikasi harga terhitung ulang (misal: Starter menjadi Rp 990.000/tahun).
5.  Verifikasi section add-ons `data-testid="addons-section"` muncul di bagian bawah dan menampilkan item berikut:
    *   Extra device (`data-testid="addon-extra_device"`)
    *   Extra branch (`data-testid="addon-extra_branch"`)
    *   Remote setup (`data-testid="addon-remote_setup"`)
    *   Product import setup (`data-testid="addon-import_setup"`)
    *   On-site setup (`data-testid="addon-onsite_setup"`)
6.  Klik tombol upgrade paket Pro (`data-testid="pricing-cta-pro"`) saat login sebagai Owner.
7.  Verifikasi perubahan paket berhasil dan tombol berubah status menjadi **Paket Aktif** secara otomatis.

### Skenario 7: Manajemen Sub-Modul Produk (Kategori, Merek, Satuan)
1.  Buka `/geraina/app/products/categories` (Kategori).
2.  Tambah kategori baru (Nama: `Minuman Dingin`, Deskripsi: `Kopi & Teh Es`) menggunakan form `data-testid="category-form"`, input name `data-testid="category-name-input"`, input desc `data-testid="category-desc-input"`, klik submit `data-testid="category-submit"`.
3.  Verifikasi kategori terdaftar di list tabel `data-testid="categories-list"`.
4.  Lakukan hal serupa di `/geraina/app/products/brands` untuk menambah Merek baru (form `data-testid="brand-form"`, input name `data-testid="brand-name-input"`, input desc `data-testid="brand-desc-input"`, submit `data-testid="brand-submit"`). Verifikasi terdaftar di tabel `data-testid="brands-list"`.
5.  Lakukan hal serupa di `/geraina/app/products/units` untuk menambah Satuan baru (form `data-testid="unit-form"`, input name `data-testid="unit-name-input"`, input symbol `data-testid="unit-symbol-input"`, submit `data-testid="unit-submit"`). Verifikasi terdaftar di tabel `data-testid="units-list"`.

### Skenario 8: Manajemen Multi-Cabang Outlet
1.  Buka `/geraina/app/branches` (Cabang).
2.  Verifikasi halaman cabang `data-testid="branches-page"` dimuat.
3.  Masukkan detail cabang baru:
    *   **Nama Cabang:** `Geraina Outlet Bandung`
    *   **No Telepon:** `022-720011`
    *   **Alamat:** `Jl. Dago No. 120, Kota Bandung`
4.  Klik submit dan verifikasi cabang baru sukses ditambahkan dan terdaftar di tabel `data-testid="branches-list"`.

### Skenario 9: Manajemen Supplier & Logistik
1.  Buka `/geraina/app/suppliers` (Supplier).
2.  Verifikasi halaman supplier `data-testid="suppliers-page"` dimuat.
3.  Gunakan form `data-testid="supplier-form"` untuk mengisi data supplier baru:
    *   **Nama Supplier:** `PT Distribusi Nusantara`
    *   **No Telepon:** `081122334455`
    *   **Alamat:** `Kawasan Industri Cikarang Blok B3`
4.  Klik submit `data-testid="supplier-submit"` dan verifikasi supplier muncul di tabel daftar `data-testid="suppliers-list"`.

### Skenario 10: Alur Penerbitan Purchase Order (PO)
1.  Buka `/geraina/app/purchase/orders` (Order Pembelian).
2.  Verifikasi kontainer `data-testid="purchase-orders-page"` dimuat.
3.  Pilih supplier `PT Distribusi Nusantara` dari dropdown.
4.  Pilih produk (misal: "Es Kopi Susu Gula Aren"), isi Qty = `100`, Harga Beli = `6000`, lalu klik **Tambah ke Daftar PO**.
5.  Klik **Kirim PO**.
6.  Verifikasi nomor PO (format `PO-YYYYMMDD-XXX`) terdaftar di tabel `data-testid="po-list"` dengan status **Ordered**.

### Skenario 11: Alur Penerimaan Barang (Goods Receiving) & Penambahan Stok
1.  Buka `/geraina/app/purchase/receiving` (Penerimaan Barang).
2.  Verifikasi kontainer `data-testid="goods-receiving-page"` dimuat.
3.  Cari PO tertunda dengan nomor yang diterbitkan pada Skenario 10.
4.  Klik tombol **Terima Barang** untuk PO tersebut.
5.  Verifikasi pop-up konfirmasi berhasil muncul, nomor tanda terima `GR-YYYYMMDD-XXX` tercatat di tabel riwayat penerimaan barang `data-testid="receiving-list"`, dan status PO berubah menjadi **Received** (Diterima).
6.  Buka `/geraina/app/products` atau ringkasan stok `/geraina/app/inventory/overview` untuk memverifikasi bahwa stok fisik produk tersebut otomatis bertambah 100 unit.

### Skenario 12: Manajemen Pelanggan & Tingkat Keanggotaan (Membership)
1.  Buka `/geraina/app/customers` (Daftar Pelanggan).
2.  Verifikasi kontainer `data-testid="customers-page"` dimuat.
3.  Gunakan form `data-testid="customer-form"` untuk mengisi data pelanggan baru:
    *   **Nama Lengkap:** `Rian Hidayat`
    *   **No Telepon:** `081299887766`
    *   **Email:** `rian@gmail.com`
    *   **Keanggotaan (Tier):** `Bronze`
    *   **Poin Loyalitas:** `100`
    *   **Catatan:** `Pelanggan reguler` (`data-testid="customer-notes"`)
4.  Klik submit `data-testid="customer-submit"` dan verifikasi pelanggan muncul di database tabel `data-testid="customers-list"`.
5.  Buka `/geraina/app/customers/membership` (Keanggotaan) dan verifikasi tier diskon/manfaat untuk tier keanggotaan ter display di `data-testid="membership-page"` dan list `data-testid="membership-list"`.

### Skenario 13: Pengaturan Hak Akses Staf & Matriks Izin
1.  Buka `/geraina/app/staff/management` (Manajemen Staf).
2.  Verifikasi halaman staf `data-testid="staff-page"` dimuat.
3.  Verifikasi daftar staf terdaftar di tabel `data-testid="staff-list"`.
4.  Buka `/geraina/app/staff/permissions` (Izin Akses).
5.  Ubah matriks perizinan untuk salah satu peran (misalnya: beri akses "Laporan" kepada peran "Manager" atau batasi hak tertentu).
6.  Verifikasi perubahan hak akses tersimpan ke database.

### Skenario 14: Manajemen Piutang & Utang Usaha (Debt Management)
1.  Buka `/geraina/app/debt/receivable` (Piutang Usaha).
2.  Verifikasi kontainer `data-testid="receivables-page"` dimuat, menampilkan daftar piutang dari pelanggan yang membeli dengan sistem jatuh tempo.
3.  Buka `/geraina/app/debt/payable` (Utang Usaha).
4.  Verifikasi kontainer `data-testid="payables-page"` dimuat, menampilkan kewajiban pembayaran faktur belanja ke supplier (`data-testid="payables-list"`).

### Skenario 15: Konfigurasi Saluran Pembayaran (Payment Gateway Config)
1.  Buka `/geraina/app/payments/qris` (Konfigurasi Pembayaran QRIS).
2.  Verifikasi kontainer `data-testid="payment-config-page"` dimuat.
3.  Simulasi pengaktifan integrasi Xendit QRIS (aktifkan toggle switch, masukkan API Key/Merchant ID dummy).
4.  Klik simpan pengaturan dan verifikasi status integrasi aktif secara realtime.

### Skenario 16: Pemantauan Laporan Keuangan & Laba Rugi
1.  Buka `/geraina/app/reports/profit` (Laporan Laba Rugi).
2.  Verifikasi kontainer `data-testid="reports-page"` dimuat.
3.  Verifikasi ringkasan Total Pendapatan, HPP (Harga Pokok Penjualan), Biaya Operasional, dan Laba Bersih terhitung secara dinamis.
4.  Verifikasi chart visualisasi pendapatan bulanan ter-render dengan benar.

### Skenario 17: Simulasi Webhook Pembayaran Eksternal
1.  Buka `/geraina/app/integrations/xendit` (Integrasi Xendit).
2.  Verifikasi kontainer `data-testid="integrations-page"` dimuat.
3.  Cari simulator webhook di bagian bawah (`data-testid="webhook-simulator-xendit"`).
4.  Masukkan referensi ID transaksi POS (misalnya nomor order atau ID pembayaran) ke input `data-testid="sim-ref-id"`.
5.  Klik tombol **Trigger Simulation** (`data-testid="sim-trigger-btn"`).
6.  Verifikasi status respon sukses (`data-testid="sim-status"` menampilkan status terkirim dan lunas di POS realtime).

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
