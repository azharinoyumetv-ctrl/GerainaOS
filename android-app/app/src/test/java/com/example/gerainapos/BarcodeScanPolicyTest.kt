package com.example.gerainapos

import org.junit.Assert.*
import org.junit.Test

class BarcodeScanPolicyTest {
    @Test fun productAndCashierResultsReturnOnlyToTheirOriginatingScreen() {
        assertTrue(BarcodeScanPolicy.canDeliver("product", "/geraina/app/products", "/geraina/app/products", "8991234567890"))
        assertTrue(BarcodeScanPolicy.canDeliver("pos", "/geraina/app/pos", "/geraina/app/pos", "5901234123457"))
        assertFalse(BarcodeScanPolicy.canDeliver("pos", "/geraina/app/pos", "/geraina/app/products", "5901234123457"))
        assertFalse(BarcodeScanPolicy.canDeliver("product", "/geraina/app/pos", "/geraina/app/pos", "5901234123457"))
    }
    @Test fun unrelatedRoutesAndInvalidResultsAreRejected() {
        assertFalse(BarcodeScanPolicy.allows("product", "/geraina/app/products/categories"))
        assertFalse(BarcodeScanPolicy.allows("other", "/geraina/app/products"))
        for (value in listOf(null, "", " ", "x".repeat(257))) assertFalse(BarcodeScanPolicy.canDeliver("product", "/geraina/app/products", "/geraina/app/products", value))
    }
}
