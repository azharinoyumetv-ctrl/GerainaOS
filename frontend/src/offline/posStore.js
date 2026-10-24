// IndexedDB commits a cash sale before checkout is acknowledged. Each replay keeps its UUID.
const DB_NAME = "geraina-pos-offline-v1";
let opened;
const event = () => window.dispatchEvent(new Event("geraina-offline-changed"));
export const offlineAvailable = () => window.GerainaDevice?.offline === true;
export const scopeFor = user => user?.id && user?.store_id ? `${user.id}:${user.store_id}` : null;

function database() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("cache", { keyPath: "key" });
      const sales = db.createObjectStore("sales", { keyPath: "key" });
      sales.createIndex("scope", "scope");
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opened = null; }; resolve(request.result); };
    request.onerror = () => { opened = null; reject(new Error("Penyimpanan perangkat tidak tersedia. Transaksi belum disimpan.")); };
  });
  return opened;
}

async function transact(stores, mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("Penyimpanan penuh atau transaksi lokal gagal. Jangan hapus data aplikasi."));
    action(tx, value => { result = value; });
  });
}

export async function cached(scope, name) {
  return transact(["cache"], "readonly", (tx, done) => {
    const request = tx.objectStore("cache").get(`${scope}:${name}`);
    request.onsuccess = () => done(request.result);
  });
}

export async function cache(scope, name, data) {
  await transact(["cache"], "readwrite", tx => tx.objectStore("cache").put({ key: `${scope}:${name}`, data, savedAt: new Date().toISOString() }));
}

export async function localSales(scope) {
  return transact(["sales"], "readonly", (tx, done) => {
    const request = tx.objectStore("sales").index("scope").getAll(scope);
    request.onsuccess = () => done(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });
}

const money = number => Math.round((Number(number) + Number.EPSILON) * 100) / 100;
export async function recordCashSale(user, payload) {
  const scope = scopeFor(user);
  if (!scope || !offlineAvailable()) throw new Error("Masuk ke toko untuk menyimpan transaksi.");
  if (payload.payment_method !== "cash") throw new Error("Pembayaran elektronik memerlukan koneksi.");
  const validMoney = value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e12;
  if (!payload.items?.length || payload.items.length > 500 || payload.items.some(item => typeof item.product_id !== "string" || !item.product_id || item.product_id.length > 200 || typeof item.name !== "string" || item.name.length > 200 || !validMoney(item.price) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000)) throw new Error("Produk atau jumlah transaksi tidak valid.");
  if (new Set(payload.items.map(item => item.product_id)).size !== payload.items.length) throw new Error("Produk duplikat dalam keranjang.");
  for (const [field, limit] of [["customer_name",200],["customer_phone",64],["customer_email",254],["note",1000]]) if (payload[field] != null && (typeof payload[field] !== "string" || payload[field].length > limit)) throw new Error("Data pelanggan atau catatan terlalu panjang. Periksa sebelum menyimpan.");
  if (![payload.discount, payload.tax_percent, payload.cash_received].every(validMoney) || Number(payload.tax_percent) > 100) throw new Error("Nominal pembayaran tidak valid.");
  const items = payload.items.map(item => { const price = money(item.price); return { ...item, price, subtotal: money(price * item.quantity) }; });
  const subtotal = money(items.reduce((sum, item) => sum + item.subtotal, 0));
  if (!validMoney(subtotal) || items.some(item => !validMoney(item.subtotal))) throw new Error("Nominal transaksi melebihi batas yang didukung.");
  const discount = money(payload.discount), tax = money((subtotal - discount) * payload.tax_percent / 100), total = money(subtotal - discount + tax);
  if (discount > subtotal || payload.cash_received < total) throw new Error("Periksa diskon dan jumlah uang tunai yang diterima.");
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const body = { ...payload, items, expected_store_id: user.store_id, expected_cashier_id: user.id, client_order_id: id, sold_at: createdAt };
  const reference = `OFF-${id.replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const settings = await cached(scope, "settings").catch(() => null);
  const order = { ...body, id, store_id: user.store_id, cashier_id: user.id, cashier_email: user.email, store_name: user.store_name, receipt_settings: settings?.data?.receipt, order_no: reference, offline_reference: reference, subtotal, tax_amount: tax, total, cash_received: money(payload.cash_received), change: money(payload.cash_received - total), payment_status: "paid", created_at: createdAt, sync_status: "pending" };
  const record = { key: `${scope}:${id}`, scope, body, order, createdAt, status: "pending", error: null };
  await transact(["sales", "cache"], "readwrite", tx => {
    const request = tx.objectStore("cache").get(`${scope}:products`);
    request.onsuccess = () => {
      if (request.result) {
        const snapshot = request.result;
        snapshot.data = snapshot.data.map(product => ({ ...product, stock: Number(product.stock || 0) - items.filter(item => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0) }));
        tx.objectStore("cache").put(snapshot);
      }
      tx.objectStore("sales").add(record);
    };
  });
  event();
  return record;
}

function sessionMatches(scope) {
  try {
    const user = JSON.parse(localStorage.getItem("geraina_user") || localStorage.getItem("dagangos_user") || "null");
    return scopeFor(user) === scope && Boolean(localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token"));
  } catch { return false; }
}

async function update(record) {
  await transact(["sales"], "readwrite", tx => tx.objectStore("sales").put(record));
  event();
}

const syncing = new Map();
export function synchronize(scope, api) {
  if (syncing.has(scope)) return syncing.get(scope);
  const task = (async () => {
    if (!sessionMatches(scope) || !navigator.onLine) return;
    // Web Locks also prevents two open windows from replaying simultaneously.
    const send = async () => {
      for (const record of (await localSales(scope)).reverse().filter(row => row.status !== "synced")) {
        if (!sessionMatches(scope)) break;
        try {
          const response = await api.post("/offline/orders", record.body, { timeout: 12000 });
          if (response.data.id !== record.body.client_order_id || response.data.store_id !== record.body.expected_store_id) throw new Error("Jawaban sinkronisasi tidak cocok. Transaksi lokal tetap disimpan.");
          await update({ ...record, status: "synced", error: null, order: { ...response.data, store_name: record.order.store_name, receipt_settings: record.order.receipt_settings, sync_status: "synced" } });
        } catch (error) {
          const code = error.response?.status;
          const detail = error.response?.data?.detail;
          const message = typeof detail === "string" ? detail : code === 401 ? "Masuk kembali ke akun yang sama untuk menyinkronkan." : "Belum tersinkron. Transaksi aman di perangkat; coba lagi saat koneksi tersedia.";
          await update({ ...record, status: code && code < 500 ? "attention" : "pending", error: message });
          // A timeout may mean the server committed. Replay the SAME ID later.
          break;
        }
      }
    };
    if (navigator.locks) await navigator.locks.request(`geraina-sales:${scope}`, send); else await send();
  })().finally(() => syncing.delete(scope));
  syncing.set(scope, task);
  return task;
}
