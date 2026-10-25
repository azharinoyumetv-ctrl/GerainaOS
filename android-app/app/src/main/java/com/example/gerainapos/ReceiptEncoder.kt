package com.example.gerainapos

import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.RoundingMode
import java.nio.charset.Charset
import java.text.NumberFormat
import java.util.Locale

data class ReceiptLine(val name: String, val quantity: Int, val price: Double, val subtotal: Double)
data class ThermalReceipt(val store: String, val reference: String, val date: String, val items: List<ReceiptLine>,
    val subtotal: Double, val discount: Double, val tax: Double, val total: Double, val cash: Double, val change: Double,
    val pending: Boolean, val footer: String = "Terima kasih", val paymentMethod: String = "cash",
    val paymentStatus: String = "paid", val manualBankConfirmed: Boolean = false)

object ReceiptEncoder {
    private fun clean(value: String) = value.replace(Regex("[\\p{Cntrl}]"), " ").trim()
    private fun rupiah(value: Double): String {
        require(value.isFinite() && value >= 0 && value <= 1e12)
        val format = NumberFormat.getNumberInstance(Locale.forLanguageTag("id-ID")).apply { minimumFractionDigits = 0; maximumFractionDigits = 2 }
        return "Rp " + format.format(BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP))
    }
    fun encode(receipt: ThermalReceipt, columns: Int): ByteArray {
        require(columns in setOf(32, 48)); require(receipt.items.size in 1..500)
        val charset = runCatching { Charset.forName("IBM437") }.getOrDefault(Charsets.US_ASCII)
        val output = ByteArrayOutputStream()
        fun command(vararg bytes: Int) { output.write(bytes.map { it.toByte() }.toByteArray()) }
        fun line(text: String = "") { output.write((clean(text) + "\n").toByteArray(charset)) }
        fun wrapped(text: String) { clean(text).take(1000).chunked(columns).forEach { line(it) } }
        fun amount(label: String, value: Double) { val right = rupiah(value); line(label.take((columns - right.length - 1).coerceAtLeast(0)).padEnd((columns - right.length).coerceAtLeast(0)) + right) }
        command(27, 64); command(27, 116, 0); command(27, 97, 1); command(27, 69, 1)
        wrapped(receipt.store); command(27, 69, 0); wrapped(receipt.reference); wrapped(receipt.date)
        if (receipt.pending) wrapped("MENUNGGU SINKRONISASI")
        command(27, 97, 0); line("-".repeat(columns))
        receipt.items.forEach { item -> require(item.quantity in 1..100000); wrapped(item.name); wrapped("${item.quantity} x ${rupiah(item.price)}"); amount("", item.subtotal) }
        line("-".repeat(columns)); amount("Subtotal", receipt.subtotal)
        if (receipt.discount > 0) amount("Diskon", receipt.discount)
        if (receipt.tax > 0) amount("Pajak", receipt.tax)
        command(27, 69, 1); amount("TOTAL", receipt.total); command(27, 69, 0)
        if (receipt.paymentMethod == "cash") {
            amount("Tunai", receipt.cash); amount("Kembalian", receipt.change)
        } else {
            val method = when (receipt.paymentMethod) { "qris_bank" -> "QRIS bank"; "qris" -> "QRIS"; "ewallet" -> "E-Wallet"; "edc" -> "Kartu EDC"; "doku" -> "DOKU"; else -> "Non-tunai" }
            wrapped("Pembayaran: $method")
            wrapped(when (receipt.paymentStatus) {
                "pending" -> "MENUNGGU PEMBAYARAN"
                "paid" -> if (receipt.paymentMethod == "qris_bank") {
                    if (receipt.manualBankConfirmed) "LUNAS - KONFIRMASI STAF" else "LUNAS - PERIKSA CATATAN"
                } else "LUNAS"
                else -> "STATUS: ${receipt.paymentStatus.uppercase(Locale.ROOT)}"
            })
        }
        line("-".repeat(columns)); command(27, 97, 1); wrapped(receipt.footer); command(27, 97, 0)
        line(); line(); line(); // No automatic cut/drawer commands: not all printers support them.
        return output.toByteArray()
    }
}
