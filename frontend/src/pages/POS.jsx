import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api, { fmtIDR, downloadPdf } from "@/api/client";
import {
  Search, Plus, Minus, Trash2, X, Printer, Download, CheckCircle2,
  Banknote, QrCode, Smartphone, RefreshCw, Barcode, CreditCard, Landmark,
} from "lucide-react";

// Plain channel codes (no ID_ prefix) -- Xendit's v3 Payment Request API,
// confirmed against docs.xendit.co/docs/{ovo,dana,shopeepay-e-wallets-id,linkaja}.
const EWALLET_CHANNELS = [
  { code: "OVO", label: "OVO" },
  { code: "DANA", label: "DANA" },
  { code: "SHOPEEPAY", label: "ShopeePay" },
  { code: "LINKAJA", label: "LinkAja" },
];

function ReceiptDialog({ order, onClose }) {
  const [poll, setPoll] = useState(order);
  const [edcProcessing, setEdcProcessing] = useState(false);
  useEffect(() => {
    if (poll?.payment_status === "paid" || poll?.payment_method === "cash") return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/orders/${poll.id}`);
        setPoll(r.data);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[POS] poll order status failed", err);
        }
      }
    }, 3500);
    return () => clearInterval(t);
  }, [poll?.id, poll?.payment_status, poll?.payment_method]);

  const o = poll;
  const isPaid = o.payment_status === "paid";

  const simulatePaid = async () => {
    await api.post(`/orders/${o.id}/mark-paid`);
    const r = await api.get(`/orders/${o.id}`);
    setPoll(r.data);
  };

  const processEdc = async () => {
    setEdcProcessing(true);
    try {
      const r = await api.post(`/edc/orders/${o.id}/charge`);
      setPoll(r.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Gagal terhubung ke server.";
      alert(`Transaksi EDC gagal: ${msg}\n\nAnda masih bisa memproses kartu langsung di mesin EDC lalu tekan "Tandai sudah dibayar" di bawah setelah disetujui.`);
    } finally {
      setEdcProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" data-testid="receipt-dialog">
      <div className="card-surface bg-white w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="label-tiny">Struk</span>
            <p className="font-display text-xl font-bold" data-testid="receipt-order-no">{o.order_no}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2" data-testid="receipt-close"><X size={18} /></button>
        </div>

        <div className="text-center mb-4">
          {isPaid ? (
            <span className="pill pill-success" data-testid="receipt-status">
              <CheckCircle2 size={12} /> Lunas
            </span>
          ) : (
            <span className="pill pill-warning" data-testid="receipt-status">Menunggu pembayaran…</span>
          )}
        </div>

        {o.payment_method === "qris" && o.xendit_qr_string && !isPaid && (
          <div className="text-center mb-4" data-testid="qris-display">
            <div className="inline-block p-4 bg-white border border-[hsl(var(--border))] rounded-lg">
              <QRCodeSVG value={o.xendit_qr_string} size={200} level="M" />
            </div>
            <p className="text-xs text-[hsl(var(--muted))] mt-2">Scan QRIS untuk membayar</p>
          </div>
        )}

        {o.payment_method === "ewallet" && o.xendit_checkout_url && !isPaid && (
          <div className="text-center mb-4" data-testid="ewallet-display">
            <p className="text-sm mb-2">Lanjutkan pembayaran di:</p>
            <a href={o.xendit_checkout_url} target="_blank" rel="noreferrer" className="btn-accent" data-testid="ewallet-open-link">
              Buka {o.ewallet_channel}
            </a>
          </div>
        )}

        {o.payment_method === "doku" && o.doku_checkout_url && !isPaid && (
          <div className="text-center mb-4" data-testid="doku-display">
            <p className="text-sm mb-2">Lanjutkan pembayaran DOKU (VA/E-Wallet/Minimarket) di:</p>
            <a href={o.doku_checkout_url} target="_blank" rel="noreferrer" className="btn-accent" data-testid="doku-open-link">
              Buka Halaman Pembayaran DOKU
            </a>
          </div>
        )}

        {o.payment_method === "edc" && !isPaid && (
          <div className="text-center mb-4" data-testid="edc-display">
            <p className="text-xs text-[hsl(var(--muted))] mb-2">Gesek/tap kartu di mesin EDC, lalu tekan tombol di bawah untuk mencatat pembayaran.</p>
            <button onClick={processEdc} disabled={edcProcessing} className="btn-accent disabled:opacity-50" data-testid="edc-process-btn">
              <CreditCard size={15} /> {edcProcessing ? "Memproses…" : "Proses EDC"}
            </button>
          </div>
        )}
        {o.payment_method === "edc" && isPaid && o.edc_transaction_id && (
          <div className="text-center mb-4 text-xs text-[hsl(var(--muted))]" data-testid="edc-details">
            <p>Trx: {o.edc_transaction_id} {o.edc_approval_code ? `· Approval: ${o.edc_approval_code}` : ""}</p>
          </div>
        )}

        <div className="divide-y divide-[hsl(var(--border))] text-sm mb-3 max-h-48 overflow-y-auto">
          {o.items.map((it, i) => (
            <div key={`${it.product_id}-${i}`} className="py-2 flex justify-between" data-testid={`receipt-item-${i}`}>
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-xs text-[hsl(var(--muted))]">{it.quantity} × {fmtIDR(it.price)}</p>
              </div>
              <p className="font-display font-bold num-display">{fmtIDR(it.subtotal)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm pt-3 border-t border-[hsl(var(--border))]">
          <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Subtotal</span><span className="num-display">{fmtIDR(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Diskon</span><span className="num-display">-{fmtIDR(o.discount)}</span></div>}
          {o.tax_amount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">PPN {o.tax_percent}%</span><span className="num-display">{fmtIDR(o.tax_amount)}</span></div>}
          <div className="flex justify-between font-display text-lg font-bold text-[hsl(var(--primary))] mt-2">
            <span>TOTAL</span><span className="num-display" data-testid="receipt-total">{fmtIDR(o.total)}</span>
          </div>
          {o.payment_method === "cash" && o.cash_received != null && (
            <>
              <div className="flex justify-between text-xs text-[hsl(var(--muted))]"><span>Tunai</span><span className="num-display">{fmtIDR(o.cash_received)}</span></div>
              <div className="flex justify-between text-xs text-[hsl(var(--muted))]"><span>Kembalian</span><span className="num-display">{fmtIDR(o.change || 0)}</span></div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={() => downloadPdf(`/pdf/receipt/${o.id}`, `receipt-${o.order_no}.pdf`)} className="btn-outline" data-testid="receipt-pdf-thermal-btn">
            <Printer size={15} /> Struk PDF
          </button>
          <button onClick={() => downloadPdf(`/pdf/invoice/${o.id}`, `invoice-${o.order_no}.pdf`)} className="btn-outline" data-testid="receipt-pdf-invoice-btn">
            <Download size={15} /> Invoice A4
          </button>
        </div>

        {!isPaid && o.payment_method !== "cash" && (
          <button onClick={simulatePaid} className="btn-ghost w-full mt-2 text-xs" data-testid="receipt-mark-paid">
            <RefreshCw size={13} /> Tandai sudah dibayar
          </button>
        )}

        <button onClick={onClose} className="btn-primary w-full mt-3" data-testid="receipt-done-btn">Selesai</button>
      </div>
    </div>
  );
}

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [ewallet, setEwallet] = useState("ID_DANA");
  const [cashReceived, setCashReceived] = useState("");
  const [taxPercent, setTaxPercent] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [scannedProduct, setScannedProduct] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    api.get("/products/category-names").then((r) => {
      const names = (Array.isArray(r.data) ? r.data : [])
        .map((c) => (typeof c === "string" ? c : c?.name))
        .filter(Boolean);
      setCategories(names);
    }).catch(() => {});
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, []);

  // Keyboard barcode scanner hardware listener
  useEffect(() => {
    let chars = [];
    let lastTime = Date.now();

    const handleKeyDown = (e) => {
      // Ignore inputs inside active text fields like search or notes
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const now = Date.now();
      if (e.key.length > 1 && e.key !== "Enter") return;

      // Reset sequence if delay between keypresses is too long (typing vs scanner hardware)
      if (now - lastTime > 50) {
        chars = [];
      }
      lastTime = now;

      if (e.key === "Enter") {
        if (chars.length > 0) {
          const barcode = chars.join("").trim();
          const matched = products.find(p => p.sku === barcode || p.id === barcode);
          if (matched) {
            addToCart(matched);
            setScannedProduct(matched);
            const t = setTimeout(() => setScannedProduct(null), 3000);
            e.preventDefault();
          }
        }
        chars = [];
      } else {
        chars.push(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);

  const filtered = useMemo(() => {
    let arr = products;
    if (activeCat !== "all") arr = arr.filter((p) => p.category === activeCat);
    if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()));
    return arr;
  }, [products, activeCat, q]);

  const addToCart = (p) => {
    setCart((c) => {
      const i = c.findIndex((it) => it.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1, subtotal: (copy[i].quantity + 1) * copy[i].price };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: 1, subtotal: p.price }];
    });
  };

  const handleManualBarcodeScan = (e) => {
    e.preventDefault();
    if (!barcodeInput) return;
    const matched = products.find(p => p.sku?.toLowerCase() === barcodeInput.toLowerCase() || p.id === barcodeInput);
    if (matched) {
      addToCart(matched);
      setScannedProduct(matched);
      setTimeout(() => setScannedProduct(null), 3000);
    } else {
      alert("Produk dengan SKU/Barcode ini tidak ditemukan.");
    }
    setBarcodeInput("");
  };

  const setQty = (idx, qty) => {
    setCart((c) => {
      if (qty <= 0) return c.filter((_, i) => i !== idx);
      const copy = [...c];
      copy[idx] = { ...copy[idx], quantity: qty, subtotal: qty * copy[idx].price };
      return copy;
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = Math.max(0, (subtotal - discount)) * (taxPercent / 100);
  const total = Math.max(0, subtotal - discount) + taxAmount;
  const change = parseFloat(cashReceived || 0) - total;

  const clearCart = () => { setCart([]); setCashReceived(""); setDiscount(0); setSelectedCustomerId(""); };

  // Keypad numerik untuk input nominal tunai manual (layar sentuh)
  const keypadPress = (k) => {
    setCashReceived((prev) => {
      const cur = String(prev || "");
      if (k === "back") return cur.slice(0, -1);
      return cur + k;
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        items: cart,
        payment_method: paymentMethod,
        ewallet_channel: paymentMethod === "ewallet" ? ewallet : undefined,
        discount: parseFloat(discount) || 0,
        tax_percent: parseFloat(taxPercent) || 0,
        cash_received: paymentMethod === "cash" ? parseFloat(cashReceived) : undefined,
      };
      // Attach selected customer info
      const selCust = customers.find(c => c.id === selectedCustomerId);
      if (selCust) {
        payload.customer_name = selCust.name;
        payload.customer_phone = selCust.phone || undefined;
        payload.customer_email = selCust.email || undefined;
      }
      const r = await api.post("/orders", payload);
      setReceipt(r.data);
      clearCart();
    } catch (e) {
      alert(e?.response?.data?.detail || "Gagal checkout");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="grid grid-cols-12 h-full relative" data-testid="pos-page">
      {/* Left: products */}
      <div className="col-span-12 lg:col-span-8 p-4 sm:p-6 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <span className="label-tiny">Kasir</span>
            <h1 className="font-display text-2xl font-bold mt-1">Point of Sale</h1>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
              <input className="input-field pl-9 w-full" placeholder="Cari produk…"
                     value={q} onChange={(e) => setQ(e.target.value)} data-testid="pos-search" />
            </div>
            {/* Manual Barcode Input (Allows simulating scanning manually) */}
            <form onSubmit={handleManualBarcodeScan} className="relative w-full sm:w-64 flex items-center">
              <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
              <input className="input-field pl-9 pr-14 w-full" placeholder="Scan SKU / Barcode…"
                     value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} data-testid="pos-barcode-input" />
              <button type="submit" className="absolute right-1 px-2 py-1 bg-[hsl(var(--primary))] text-white rounded text-xs font-semibold hover:bg-[hsl(var(--primary))]/80 transition-colors">
                Scan
              </button>
            </form>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto" data-testid="pos-categories">
          <button onClick={() => setActiveCat("all")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${activeCat === "all" ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))]"}`}
                  data-testid="cat-all">Semua</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${activeCat === c ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))]"}`}
                    data-testid={`cat-${c}`}>{c}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="pos-product-grid">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => addToCart(p)}
                    className="card-surface p-3 text-left hover:border-[hsl(var(--primary))] hover:shadow-sm transition-all flex flex-col justify-between"
                    data-testid={`pos-product-${p.id}`}>
              <div>
                {/* Product Image */}
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover rounded-md mb-2 bg-[hsl(var(--secondary))]" />
                ) : (
                  <div className="w-full h-32 bg-[hsl(var(--secondary))] flex flex-col items-center justify-center rounded-md mb-2 text-[hsl(var(--muted))] text-xs font-semibold gap-1">
                    <Barcode size={24} className="stroke-[1.5]" />
                    <span>Tanpa Gambar</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mt-1">
                  <span className="pill pill-muted text-[9px] px-1 py-0.5">{p.category}</span>
                  <span className="text-[10px] text-[hsl(var(--muted))]">Stok {p.stock}</span>
                </div>
                <p className="font-display font-bold mt-1.5 text-sm leading-snug line-clamp-2">{p.name}</p>
                {p.sku && <p className="text-[10px] text-[hsl(var(--muted))] mt-0.5">SKU: {p.sku}</p>}
              </div>
              <p className="num-display font-display text-base font-bold text-[hsl(var(--primary))] mt-2">{fmtIDR(p.price)}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-center text-[hsl(var(--muted))] py-10" data-testid="pos-no-products">Tidak ada produk.</p>}
        </div>
      </div>

      {/* Right: cart */}
      <aside className="col-span-12 lg:col-span-4 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col" data-testid="pos-cart">
        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Keranjang ({cart.length})</h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="btn-ghost text-xs text-[hsl(var(--destructive))]" data-testid="pos-clear-cart">
              <Trash2 size={13} /> Bersihkan
            </button>
          )}
        </div>

        {/* In-checkout Customer Selector */}
        <div className="px-4 pt-3 pb-2 border-b border-[hsl(var(--border))]" data-testid="pos-customer-selector">
          <label className="label-tiny mb-1 block">Pelanggan</label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="input-field py-1.5 text-sm w-full"
            data-testid="pos-customer-dropdown"
          >
            <option value="">— Tanpa Pelanggan —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
            ))}
          </select>
          {selectedCustomerId && (
            <p className="text-xs text-[hsl(var(--success))] mt-1 font-semibold" data-testid="pos-selected-customer">
              ✓ {customers.find(c => c.id === selectedCustomerId)?.name}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 && (
            <p className="text-sm text-center text-[hsl(var(--muted))] py-10" data-testid="cart-empty">
              Keranjang kosong. Klik produk atau scan barcode untuk menambah.
            </p>
          )}
          {cart.map((it, idx) => (
            <div key={it.product_id} className="card-surface p-3 mb-2" data-testid={`cart-item-${idx}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm leading-tight">{it.name}</p>
                <p className="font-display font-bold num-display text-sm">{fmtIDR(it.subtotal)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-[hsl(var(--muted))]">{fmtIDR(it.price)} ea</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(idx, it.quantity - 1)} className="w-8 h-8 sm:w-7 sm:h-7 rounded-md border border-[hsl(var(--border))] grid place-items-center" data-testid={`cart-dec-${idx}`}><Minus size={12} /></button>
                  <span className="num-display font-semibold text-sm w-6 text-center" data-testid={`cart-qty-${idx}`}>{it.quantity}</span>
                  <button onClick={() => setQty(idx, it.quantity + 1)} className="w-8 h-8 sm:w-7 sm:h-7 rounded-md border border-[hsl(var(--border))] grid place-items-center" data-testid={`cart-inc-${idx}`}><Plus size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[hsl(var(--border))] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="label-tiny">Diskon (Rp)</label>
              <input className="input-field mt-1 py-2 text-sm" type="number" value={discount}
                     onChange={(e) => setDiscount(e.target.value)} data-testid="cart-discount" />
            </div>
            <div>
              <label className="label-tiny">PPN (%)</label>
              <input className="input-field mt-1 py-2 text-sm" type="number" value={taxPercent}
                     onChange={(e) => setTaxPercent(e.target.value)} data-testid="cart-tax" />
            </div>
          </div>

          <div className="space-y-1 text-sm pt-1">
            <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Subtotal</span><span className="num-display">{fmtIDR(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Diskon</span><span className="num-display">-{fmtIDR(discount)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">PPN</span><span className="num-display">{fmtIDR(taxAmount)}</span></div>}
            <div className="flex justify-between font-display text-xl font-extrabold text-[hsl(var(--primary))] pt-1">
              <span>TOTAL</span><span className="num-display" data-testid="cart-total">{fmtIDR(total)}</span>
            </div>
          </div>

          <div>
            <label className="label-tiny mb-2 block">Metode Pembayaran</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => setPaymentMethod("cash")}
                      className={`p-2.5 rounded-md text-xs font-semibold border transition-colors ${paymentMethod === "cash" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                      data-testid="pm-cash"><Banknote size={14} className="mx-auto mb-1" />Tunai</button>
              <button onClick={() => setPaymentMethod("qris")}
                      className={`p-2.5 rounded-md text-xs font-semibold border transition-colors ${paymentMethod === "qris" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                      data-testid="pm-qris"><QrCode size={14} className="mx-auto mb-1" />QRIS</button>
              <button onClick={() => setPaymentMethod("ewallet")}
                      className={`p-2.5 rounded-md text-xs font-semibold border transition-colors ${paymentMethod === "ewallet" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                      data-testid="pm-ewallet"><Smartphone size={14} className="mx-auto mb-1" />E-Wallet</button>
              <button onClick={() => setPaymentMethod("edc")}
                      className={`p-2.5 rounded-md text-xs font-semibold border transition-colors ${paymentMethod === "edc" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                      data-testid="pm-edc"><CreditCard size={14} className="mx-auto mb-1" />Kartu (EDC)</button>
              <button onClick={() => setPaymentMethod("doku")}
                      className={`p-2.5 rounded-md text-xs font-semibold border transition-colors ${paymentMethod === "doku" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                      data-testid="pm-doku"><Landmark size={14} className="mx-auto mb-1" />DOKU (VA)</button>
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div data-testid="pm-cash-details">
              <label className="label-tiny">Diterima Tunai (Rp)</label>
              <input className="input-field mt-1 py-2 text-sm" type="number" value={cashReceived}
                     onChange={(e) => setCashReceived(e.target.value)} placeholder={total.toFixed(0)} data-testid="cart-cash-received" />
              {cashReceived && (
                <p className={`text-xs mt-1 ${change >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`} data-testid="cart-change">
                  {change >= 0 ? `Kembalian: ${fmtIDR(change)}` : `Kurang: ${fmtIDR(-change)}`}
                </p>
              )}
              {/* Keypad numerik */}
              <div className="grid grid-cols-3 gap-1.5 mt-2" data-testid="cash-keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"].map((k) => (
                  <button key={k} type="button" onClick={() => keypadPress(k)}
                          className="py-2.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-sm font-bold hover:bg-[hsl(var(--secondary))]"
                          data-testid={`keypad-${k}`}>
                    {k === "back" ? "⌫" : k}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <button type="button" onClick={() => setCashReceived(String(Math.ceil(total)))}
                        className="py-2 rounded-md text-xs font-bold border border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10" data-testid="keypad-exact">
                  Uang Pas
                </button>
                <button type="button" onClick={() => setCashReceived("")}
                        className="py-2 rounded-md text-xs font-bold border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]" data-testid="keypad-clear">
                  Hapus
                </button>
              </div>
            </div>
          )}

          {paymentMethod === "ewallet" && (
            <div data-testid="pm-ewallet-details">
              <label className="label-tiny">Pilih E-Wallet</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {EWALLET_CHANNELS.map((c) => (
                  <button key={c.code} onClick={() => setEwallet(c.code)}
                          className={`p-2 rounded-md text-xs font-semibold border ${ewallet === c.code ? "bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))]" : "border-[hsl(var(--border))]"}`}
                          data-testid={`ew-${c.code}`}>{c.label}</button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={checkout}
            disabled={submitting || cart.length === 0 || (paymentMethod === "cash" && (parseFloat(cashReceived || 0) < total))}
            className="btn-primary w-full"
            data-testid="checkout-btn"
          >
            {submitting ? "Memproses…" : `Bayar ${fmtIDR(total)}`}
          </button>
        </div>
      </aside>

      {receipt && <ReceiptDialog order={receipt} onClose={() => setReceipt(null)} />}

      {/* Floating Scanned Barcode Overlay */}
      {scannedProduct && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm lg:left-72 z-[100] animate-bounce bg-white border-2 border-[hsl(var(--success))] p-4 rounded-xl shadow-2xl flex items-center gap-4" data-testid="scanned-overlay">
          {scannedProduct.image_url ? (
            <img src={scannedProduct.image_url} alt={scannedProduct.name} className="w-16 h-16 object-cover rounded-md border border-[hsl(var(--border))]" />
          ) : (
            <div className="w-16 h-16 bg-[hsl(var(--secondary))] flex flex-col items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted))]">
              <Barcode size={24} className="stroke-[1.5]" />
            </div>
          )}
          <div className="flex-1">
            <span className="pill pill-success text-[9px] px-1.5 py-0.5 inline-block font-semibold">Barcode Discan</span>
            <p className="font-bold text-sm leading-tight mt-1 text-[hsl(var(--foreground))]">{scannedProduct.name}</p>
            {scannedProduct.sku && <p className="text-[10px] text-[hsl(var(--muted))]">SKU: {scannedProduct.sku}</p>}
            <p className="font-display font-extrabold text-[hsl(var(--primary))] text-sm mt-1">{fmtIDR(scannedProduct.price)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
