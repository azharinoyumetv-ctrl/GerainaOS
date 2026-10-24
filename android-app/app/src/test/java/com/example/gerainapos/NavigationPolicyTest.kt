package com.example.gerainapos

import com.example.gerainapos.NavigationPolicy.Destination.*
import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {
    @Test fun productionRoutesStayInside() {
        for (path in listOf("/geraina/login", "/geraina/register", "/geraina/app/pos", "/geraina/app/payments/qris")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path"))
        }
    }
    @Test fun otherOriginsCannotAccessNativeFeatures() {
        for (url in listOf("https://dagangos.com.evil.test/geraina", "https://evil.test/geraina", "https://dagangos.com:8443/geraina", "https://dagangos.com/dapuros")) {
            assertEquals(url, EXTERNAL, NavigationPolicy.classify(url))
        }
        for (url in listOf("javascript:alert(1)", "file:///sdcard/token", "intent://test", "http://dagangos.com/geraina", "https://user@dagangos.com/geraina", "invalid url")) {
            assertEquals(url, BLOCKED, NavigationPolicy.classify(url))
        }
    }
    @Test fun subscriptionPaymentsAreBlockedWithoutBlockingPhysicalSales() {
        for (path in listOf("/geraina/pricing", "/geraina/checkout", "/geraina/app/settings/billing", "/geraina/%63heckout", "/geraina/app/../pricing")) {
            assertEquals(path, SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com$path"))
        }
        assertEquals(INTERNAL, NavigationPolicy.classify("https://dagangos.com/geraina/app/pos"))
    }
    @Test fun exportNamesCannotEscapeTheSelectedDirectory() {
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("../../invoice.pdf"))
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("C:\\private\\invoice.pdf"))
        assertEquals("geraina-export.pdf", NavigationPolicy.safeFilename("..."))
        assertEquals(120, NavigationPolicy.safeFilename("a".repeat(200)).length)
    }
}
