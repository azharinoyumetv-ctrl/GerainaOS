// Decode locally: the uploaded picture never leaves the device.
export async function readBankQrisImage(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error("Pilih gambar PNG, JPG, atau WebP berukuran maksimal 5 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Gambar tidak dapat dibaca.")); image.src = url; });
    if (!image.width || !image.height || image.width * image.height > 24000000) throw new Error("Ukuran gambar terlalu besar. Gunakan gambar QRIS yang dipotong lebih dekat.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import("jsqr");
    const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
    if (!result?.data?.startsWith("000201") || new TextEncoder().encode(result.data).length > 2048) throw new Error("QRIS tidak terbaca atau terlalu besar. Pilih gambar QRIS asli dari bank, dengan seluruh kode terlihat jelas.");
    return result.data;
  } finally { URL.revokeObjectURL(url); }
}

export const bankQrisError = (error, fallback) => typeof error?.response?.data?.detail === "string" ? error.response.data.detail : fallback;

export function pendingBankKey(scope) { return scope ? `geraina:bank-qris:pending:${scope}` : null; }
export function rememberBankPayment(scope, order) {
  const key = pendingBankKey(scope);
  if (!key || order.payment_method !== "qris_bank") return;
  try {
    if (order.payment_status === "pending") localStorage.setItem(key, order.id);
    else if (localStorage.getItem(key) === order.id) localStorage.removeItem(key);
  } catch { /* The server's Penjualan history remains the source of truth. */ }
}
