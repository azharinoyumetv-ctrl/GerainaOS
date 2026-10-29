package com.example.gerainapos

import android.content.Intent
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Fixture transport lives exclusively in the test APK; runs against the signed production package. */
@RunWith(AndroidJUnit4::class)
class CompanionSessionTest {
    private val instrument = InstrumentationRegistry.getInstrumentation()
    private lateinit var scenario: ActivityScenario<MainActivity>
    private lateinit var web: WebView
    @Volatile private var authUnavailable=false
    private val fixture = """{"id":"android-fixture-owner","store_id":"android-fixture-store","email":"android-fixture@example.invalid","store_name":"geraina fixture","role":"Owner","plan":"business","current_module":"geraina","stores":[{"module":"geraina","store_id":"android-fixture-store"}]}"""
    private fun find(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) find(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun js(script: String): Any? {
        val latch=CountDownLatch(1);var result: Any?=null
        instrument.runOnMainSync { web.evaluateJavascript(script) { result=JSONTokener(it).nextValue();latch.countDown() } }
        check(latch.await(10,TimeUnit.SECONDS)) { "WebView callback timed out" }
        return result
    }
    private fun until(script: String) {
        val end=SystemClock.elapsedRealtime()+25000
        while(SystemClock.elapsedRealtime()<end) { if(js(script)==true)return;SystemClock.sleep(150) }
        error("Condition failed: $script; page="+js("document.body.innerText.slice(0,600)"))
    }
    private fun shell(command: String): String = android.os.ParcelFileDescriptor.AutoCloseInputStream(instrument.uiAutomation.executeShellCommand(command)).use { String(it.readBytes()) }
    private fun launch() {
        android.util.Log.i("CompanionTest", "launch start")
        scenario=ActivityScenario.launch(MainActivity::class.java)
        android.util.Log.i("CompanionTest", "launch returned")
        scenario.onActivity { activity ->
            web=find(activity.window.decorView) ?: error("Missing WebView")
            val original=web.webViewClient
            web.webViewClient=object:WebViewClient() {
                override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse? {
                    if(request.url.host=="dagangos.com" && request.url.path.orEmpty().startsWith("/api/")) {
                        if(authUnavailable && request.url.path=="/api/auth/me") return WebResourceResponse("application/json","UTF-8",503,"Unavailable",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream("{}".toByteArray()))
                        val body=when(request.url.path) {
                            "/api/auth/me" -> fixture
                            "/api/orders/stats" -> """{"today_sales":0,"today_orders":0,"week_sales":0,"month_sales":0,"product_count":0}"""
                            "/api/settings" -> """{"general":{"store_name":"geraina fixture"}}"""
                            else -> "[]"
                        }
                        return WebResourceResponse("application/json","UTF-8",200,"OK",mapOf("Cache-Control" to "no-store"),ByteArrayInputStream(body.toByteArray()))
                    }
                    return original.shouldInterceptRequest(view,request)
                }
                override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest)=original.shouldOverrideUrlLoading(view,request)
                override fun onPageStarted(view:WebView,url:String,favicon:android.graphics.Bitmap?)=original.onPageStarted(view,url,favicon)
                override fun onPageFinished(view:WebView,url:String)=original.onPageFinished(view,url)
            }
        }
        until("!!document.body")
        android.util.Log.i("CompanionTest", "transport attached")
        val saved=js("localStorage.getItem('geraina_user')")
        check(saved==null || saved==JSONObject.NULL || saved.toString().contains("android-fixture@example.invalid")) { "Refusing to replace a customer session" }
    }
    private fun seed() {
        android.util.Log.i("CompanionTest", "seed start")
        js("localStorage.setItem('geraina_token','geraina-native-fixture-token');localStorage.setItem('geraina_user',${JSONObject.quote(fixture)});localStorage.removeItem('geraina_signed_out');window.__oldFixtureDocument=true;true")
        instrument.runOnMainSync { web.loadUrl("https://dagangos.com/geraina/app/dashboard") }
        until("!window.__oldFixtureDocument && !!document.querySelector('[data-testid=app-layout]')")
        android.util.Log.i("CompanionTest", "seed returned")
    }
    @Test fun missingCompanionOffersDownloadBrowserAndCancel() {
        launch()
        try {
            seed()
            assertNull(instrument.targetContext.packageManager.getLaunchIntentForPackage(NavigationPolicy.COMPANION_PACKAGE))
            js("document.querySelector('[data-testid=odoo-ecosystem-switcher-btn]').click();true")
            until("!!document.querySelector('[data-testid=suite-tile-dapuros]')")
            js("document.querySelector('[data-testid=suite-tile-dapuros]').click();true")
            val dialogDeadline=SystemClock.elapsedRealtime()+15000
            var ui=instrument.uiAutomation.rootInActiveWindow
            while(SystemClock.elapsedRealtime()<dialogDeadline && (ui==null || ui.findAccessibilityNodeInfosByText("belum terpasang").isEmpty())) {
                SystemClock.sleep(200);ui=instrument.uiAutomation.rootInActiveWindow
            }
            assertNotNull("Missing-app dialog did not appear",ui)
            ui=ui!!
            assertTrue(ui.findAccessibilityNodeInfosByText("belum terpasang").isNotEmpty())
            for(label in listOf("UNDUH APLIKASI","BUKA DI BROWSER","BATAL")) assertTrue(label,ui.findAccessibilityNodeInfosByText(label).isNotEmpty())
            assertEquals("geraina-native-fixture-token",js("localStorage.getItem('geraina_token')"))
        } finally { scenario.close() }
    }
    @Test fun seedSession() {
        launch();try { seed();assertEquals("geraina-native-fixture-token",js("localStorage.getItem('geraina_token')")) } finally { scenario.close() }
    }
    @Test fun unavailableColdStartRetriesWithoutLosingSession() {
        launch()
        try {
            seed();authUnavailable=true
            js("localStorage.removeItem('geraina_user');window.__recoveryOldDocument=true;true")
            instrument.runOnMainSync { web.loadUrl("https://dagangos.com/geraina/app/dashboard") }
            until("!window.__recoveryOldDocument && !!document.querySelector('[data-testid=session-recovery]')")
            assertEquals("geraina-native-fixture-token",js("localStorage.getItem('geraina_token')"))
            assertTrue(js("!document.querySelector('[data-testid=app-layout]')")==true)
            authUnavailable=false
            js("document.querySelector('[data-testid=session-retry]').click();true")
            until("!!document.querySelector('[data-testid=app-layout]')")
            assertEquals("geraina",js("JSON.parse(localStorage.getItem('geraina_user')).current_module"))
            assertEquals("business",js("JSON.parse(localStorage.getItem('geraina_user')).plan"))
            val out=File(instrument.targetContext.getExternalFilesDir(null),"companion-verification/startup-recovery").apply { mkdirs() }
            File(out,"verification.json").writeText(JSONObject().put("status","passed").put("applicationId","com.dagangos.geraina").put("fixtureOnly",true).put("tokenRetained",true).put("retryValidatedOwnModule",true).put("planRetained","business").toString(2))
        } finally { scenario.close() }
    }
    @Test(timeout=180000) fun companionRoundTripPreservesSessionAndDocument() {
        launch()
        try {
            seed()
            js("window.__companionDocument='retained';document.querySelector('[data-testid=odoo-ecosystem-switcher-btn]').click();true")
            until("!!document.querySelector('[data-testid=suite-tile-dapuros]')")
            assertEquals("/dapuros/app/dashboard",js("document.querySelector('[data-testid=suite-tile-dapuros]').getAttribute('href')"))
            assertTrue(js("document.querySelector('[data-testid=suite-tile-dapuros]').textContent.includes('Buka aplikasi')")==true)
            js("document.querySelector('[data-testid=suite-tile-dapuros]').click();true")
            val deadline=SystemClock.elapsedRealtime()+15000
            var top=""
            while(SystemClock.elapsedRealtime()<deadline) {
                top=shell("dumpsys activity activities").lineSequence().firstOrNull { it.contains("topResumedActivity") }.orEmpty()
                if(top.contains("com.dagangos.dapuros/"))break
                SystemClock.sleep(200)
            }
            assertTrue("Expected installed companion app, found: $top",top.contains("com.dagangos.dapuros/"))
            instrument.targetContext.startActivity(instrument.targetContext.packageManager.getLaunchIntentForPackage("com.dagangos.geraina")!!.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            val returnDeadline=SystemClock.elapsedRealtime()+15000
            var focused=false
            while(SystemClock.elapsedRealtime()<returnDeadline) { instrument.runOnMainSync { focused=web.hasWindowFocus() };if(focused)break;SystemClock.sleep(150) }
            assertTrue("Source app did not resume",focused)
            until("!!document.querySelector('[data-testid=app-layout]')")
            assertEquals("retained",js("window.__companionDocument"))
            assertEquals("geraina-native-fixture-token",js("localStorage.getItem('geraina_token')"))
            assertEquals("geraina",js("JSON.parse(localStorage.getItem('geraina_user')).current_module"))
            assertEquals("business",js("JSON.parse(localStorage.getItem('geraina_user')).plan"))
            val profile=InstrumentationRegistry.getArguments().getString("profile") ?: "phone"
            val out=File(instrument.targetContext.getExternalFilesDir(null),"companion-verification/$profile").apply { mkdirs() }
            File(out,"verification.json").writeText(JSONObject().put("status","passed").put("applicationId","com.dagangos.geraina").put("targetPackage","com.dagangos.dapuros").put("profile",profile).put("fixtureOnly",true).put("sessionRetained",true).put("documentRetained",true).put("planRetained","business").put("foregroundActivity",top).toString(2))
        } finally { scenario.close() }
    }
}
