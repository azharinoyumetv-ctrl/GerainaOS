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
        for (path in listOf("/geraina/pricing", "/geraina/checkout", "/geraina/app/settings/billing/checkout", "/geraina/%63heckout", "/geraina/app/../pricing")) {
            assertEquals(path, SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com$path", false))
        }
        assertEquals(INTERNAL, NavigationPolicy.classify("https://dagangos.com/geraina/app/pos"))
    }
    @Test fun websiteBuildAllowsOnlyGerainaSubscriptionPagesInside() {
        for (path in listOf("/geraina/pricing", "/geraina/checkout", "/geraina/order?receipt=test", "/geraina/%63heckout", "/geraina/app/../pricing")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path", true))
        }
        assertEquals(EXTERNAL, NavigationPolicy.classify("https://checkout.xendit.co/web/test", true))
        assertEquals(SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com/dapuros/pricing", true))
        assertEquals(SUBSCRIPTION, NavigationPolicy.classify("https://dagangos.com/geraina/app/settings/billing/checkout", true))
    }
    @Test fun accountStatusOverviewsRemainAvailable() {
        for (path in listOf("/geraina/app/settings/billing", "/geraina/app/settings/billing/", "/geraina/app/billing", "/geraina/app/settings/%62illing")) {
            assertEquals(path, INTERNAL, NavigationPolicy.classify("https://dagangos.com$path"))
        }
    }
    @Test fun exportNamesCannotEscapeTheSelectedDirectory() {
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("../../invoice.pdf"))
        assertEquals("invoice.pdf", NavigationPolicy.safeFilename("C:\\private\\invoice.pdf"))
        assertEquals("geraina-export.pdf", NavigationPolicy.safeFilename("..."))
        assertEquals(120, NavigationPolicy.safeFilename("a".repeat(200)).length)
    }
    @Test fun onlySubscriptionCheckoutReturnsToBilling() {
        for (path in listOf("/geraina/pricing", "/geraina/checkout", "/geraina/order?receipt=fixture")) {
            assertEquals(NavigationPolicy.BILLING_URL, NavigationPolicy.subscriptionReturnUrl("https://dagangos.com$path", "https://checkout.xendit.co/web/fixture"))
        }
        for (source in listOf("https://dagangos.com/geraina/app/pos", "https://dagangos.com/geraina/app/about", "https://evil.test/geraina/checkout", "http://dagangos.com/geraina/checkout")) {
            assertEquals(null, NavigationPolicy.subscriptionReturnUrl(source, "https://checkout.xendit.co/web/fixture"))
        }
        for (destination in listOf("https://checkout.xendit.co.evil.test/web/fixture", "https://evil.test/", "http://checkout.xendit.co/web/fixture", "https://user@checkout.xendit.co/web/fixture", "https://checkout.xendit.co:8443/web/fixture")) {
            assertEquals(null, NavigationPolicy.subscriptionReturnUrl("https://dagangos.com/geraina/checkout", destination))
        }
    }
}
