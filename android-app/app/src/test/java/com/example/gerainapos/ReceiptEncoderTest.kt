package com.example.gerainapos

import org.junit.Assert.*
import org.junit.Test

class ReceiptEncoderTest {
    private fun receipt(name: String = "Kopi Susu") = ThermalReceipt("Toko Geraina", "OFF-123", "2026-10-25", listOf(ReceiptLine(name, 2, 12500.0, 25000.0)), 25000.0, 1000.0, 2400.0, 26400.0, 30000.0, 3600.0, true)
    @Test fun cashReceiptHasAmountsAndPendingReference() {
        val bytes = ReceiptEncoder.encode(receipt(), 32)
        val text = bytes.toString(Charsets.US_ASCII)
        assertTrue(text.contains("Rp 26.400")); assertTrue(text.contains("Rp 3.600")); assertTrue(text.contains("OFF-123")); assertTrue(text.contains("MENUNGGU SINKRONISASI"))
        assertArrayEquals(byteArrayOf(27,64),bytes.take(2).toByteArray())
    }
    @Test fun productTextCannotInjectPrinterCommands() {
        val safe = ReceiptEncoder.encode(receipt("Kopi\u001b\u0040\n\u0007 Susu"),32).toString(Charsets.US_ASCII)
        assertFalse(safe.contains("Kopi\u001b")); assertFalse(safe.contains('\u0007'))
    }
    @Test fun longNamesAreWrappedForBothPaperWidths() {
        for (columns in listOf(32,48)) {
            val bytes = ReceiptEncoder.encode(receipt("Produk ".repeat(20)),columns)
            val text = bytes.toString(Charsets.US_ASCII).replace(Regex("\u001b."), "").replace("\u0000", "").replace("\u0001", "")
            assertTrue(text.contains("Produk")); assertTrue(bytes.size < 4096)
        }
    }
    @Test(expected = IllegalArgumentException::class) fun invalidMoneyCannotBePrinted() { ReceiptEncoder.encode(receipt().copy(total=Double.NaN),32) }
    @Test fun fractionalAmountsDoNotCreateAnExtraRupiahOnPaper() {
        val text = ReceiptEncoder.encode(receipt().copy(total=199.5,cash=200.0,change=0.5),32).toString(Charsets.US_ASCII)
        assertTrue(text.contains("Rp 199,5")); assertTrue(text.contains("Rp 0,5"))
    }
    @Test fun pendingBankQrisIsNeverPrintedAsCashOrPaid() {
        for (columns in listOf(32,48)) {
            val text = ReceiptEncoder.encode(receipt().copy(pending=false,paymentMethod="qris_bank",paymentStatus="pending"),columns).toString(Charsets.US_ASCII)
            assertTrue(text.contains("Pembayaran: QRIS bank")); assertTrue(text.contains("MENUNGGU PEMBAYARAN"))
            assertFalse(text.contains("Tunai")); assertFalse(text.contains("Kembalian")); assertFalse(text.contains("LUNAS"))
        }
    }
    @Test fun paidBankQrisIdentifiesManualStaffConfirmation() {
        val text = ReceiptEncoder.encode(receipt().copy(pending=false,paymentMethod="qris_bank",paymentStatus="paid",manualBankConfirmed=true),32).toString(Charsets.US_ASCII)
        assertTrue(text.contains("LUNAS - KONFIRMASI STAF")); assertFalse(text.contains("Tunai"))
    }
}
