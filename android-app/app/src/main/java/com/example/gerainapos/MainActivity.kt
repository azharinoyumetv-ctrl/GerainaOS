package com.example.gerainapos

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.SystemClock
import android.print.PrintManager
import android.util.Base64
import android.view.Gravity
import android.text.TextUtils
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private lateinit var subtitle: TextView
    private lateinit var pageTitle: TextView
    private lateinit var brandIcon: ImageView
    private lateinit var navigationBar: LinearLayout
    private lateinit var drawerButton: FrameLayout
    private val navigationItems = linkedMapOf<String, Pair<FrameLayout, TextView>>()
    private var authenticatedScreen = false
    private var keyboardVisible = false
    private var wideNavigation = false
    private var exitBackAt = 0L
    private val screenBackground = InsetBackgroundDrawable()
    private val io = Executors.newSingleThreadExecutor()
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var lastPage = NavigationPolicy.START_URL
    private var pageFailed = false
    private var failedPageUrl: String? = null
    private var exportInProgress = false
    private var nativeFeaturesReady = false
    private var barcodeTarget = "pos"
    private var barcodeOriginPath = ""
    private var scannerOpen = false
    private lateinit var receiptPrinter: ThermalPrinterController
    private val bundledFrontend by lazy { BundledFrontend(assets) }
    private val pendingExport get() = File(cacheDir, "pending-export")

    private val selectFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }
    private val scanBarcode = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        scannerOpen = false
        val value = result.data?.getStringExtra("barcode")
        if (result.resultCode == RESULT_OK && authenticatedScreen && BarcodeScanPolicy.canDeliver(barcodeTarget, barcodeOriginPath, Uri.parse(lastPage).path.orEmpty(), value)) {
            val detail = JSONObject().put("value", value).put("target", barcodeTarget)
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('geraina-barcode',{detail:$detail}))", null)
        }
    }
    private val saveFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        exportInProgress = false
        val uri = result.data?.data
        if (result.resultCode == RESULT_OK && uri != null && pendingExport.exists()) {
            io.execute {
                val saved = runCatching {
                    contentResolver.openOutputStream(uri, "w")!!.use { output ->
                        pendingExport.inputStream().use { it.copyTo(output) }
                    }
                }.isSuccess
                pendingExport.delete()
                runOnUiThread { notice(if (saved) "File berhasil disimpan." else "File tidak dapat disimpan. Coba lagi.") }
            }
        } else pendingExport.delete()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        barcodeTarget = savedInstanceState?.getString("barcodeTarget") ?: "pos"
        barcodeOriginPath = savedInstanceState?.getString("barcodeOriginPath") ?: ""
        scannerOpen = savedInstanceState?.getBoolean("scannerOpen") ?: false
        receiptPrinter = ThermalPrinterController(this, ::notice)
        // A force-stopped app cannot receive the old document-picker result.
        // Retain the file across rotation, but discard it on a fresh launch.
        if (savedInstanceState == null) pendingExport.delete()
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(Color.WHITE, Color.WHITE),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT))
        buildScreen()
        configureWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (keyboardVisible) {
                    exitBackAt = 0L
                    WindowCompat.getInsetsController(window, webView).hide(WindowInsetsCompat.Type.ime())
                    return
                }
                val now = SystemClock.elapsedRealtime()
                if (exitBackAt != 0L && now - exitBackAt <= 2000L) {
                    finishAndRemoveTask()
                    return
                }
                webView.evaluateJavascript("window.GerainaMobile?.back?.() || false") { handled ->
                    if (handled == "true") { exitBackAt = 0L; return@evaluateJavascript }
                    exitBackAt = SystemClock.elapsedRealtime()
                    if (authenticatedScreen && !lastPage.endsWith("/app/dashboard"))
                        navigate("${NavigationPolicy.ORIGIN}/geraina/app/dashboard")
                    else if (!authenticatedScreen && lastPage != NavigationPolicy.START_URL)
                        navigate(NavigationPolicy.START_URL)
                    notice("Tekan kembali sekali lagi untuk keluar.")
                }
            }
        })
        val supported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (!supported) {
            showError("Perbarui Android System WebView atau Chrome untuk menjalankan Geraina POS dengan aman.")
            return
        }
        installNativeFeatures()
        nativeFeaturesReady = true
        val restored = savedInstanceState?.getBundle("webState")?.let { webView.restoreState(it) }
        if (restored == null) webView.loadUrl(NavigationPolicy.START_URL)
    }

    private fun buildScreen() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = screenBackground
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            screenBackground.bottomInset = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
            keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            if (::navigationBar.isInitialized) navigationBar.visibility =
                if (authenticatedScreen && !keyboardVisible && !wideNavigation) View.VISIBLE else View.GONE
            insets
        }
        val toolbar = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(7), dp(12), dp(7))
            setBackgroundColor(Color.WHITE)
        }
        drawerButton = FrameLayout(this).apply {
            contentDescription = "Buka navigasi"
            isClickable = true; isFocusable = true; visibility = View.GONE
            addView(ImageView(this@MainActivity).apply {
                setImageDrawable(GerainaIconDrawable("drawer", Color.rgb(53, 100, 67)))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            setOnClickListener { exitBackAt = 0L; webView.evaluateJavascript("window.GerainaMobile?.openMenu?.()", null) }
        }
        toolbar.addView(drawerButton, LinearLayout.LayoutParams(dp(44), dp(44)))
        brandIcon = ImageView(this).apply {
            setImageResource(R.drawable.geraina_logo)
            contentDescription = null
        }
        toolbar.addView(brandIcon, LinearLayout.LayoutParams(dp(29), dp(29)))
        val titleGroup = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), 0, 0, 0)
            pageTitle = TextView(this@MainActivity).apply {
                text = "geraina."; textSize = 22f; setTextColor(Color.rgb(32, 71, 50))
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                letterSpacing = -0.03f
                maxLines = 1; ellipsize = TextUtils.TruncateAt.END
            }
            addView(pageTitle)
            subtitle = TextView(this@MainActivity).apply {
                text = "Kasir & operasional toko"; textSize = 11f; setTextColor(Color.rgb(100, 116, 92))
                maxLines = 1; ellipsize = TextUtils.TruncateAt.END
            }
            addView(subtitle)
        }
        toolbar.addView(titleGroup, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        toolbar.addView(FrameLayout(this).apply {
            contentDescription = "Menu aplikasi"
            isClickable = true; isFocusable = true
            background = rounded(Color.rgb(236, 242, 232), 24)
            addView(ImageView(this@MainActivity).apply {
                setImageDrawable(GerainaIconDrawable("more", Color.rgb(53, 100, 67)))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            setOnClickListener { exitBackAt = 0L; showMenu(it) }
        }, LinearLayout.LayoutParams(dp(44), dp(44)))
        root.addView(toolbar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)))
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100; progressTintList = android.content.res.ColorStateList.valueOf(Color.rgb(77, 122, 65))
        }
        root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(2)))
        val content = FrameLayout(this).apply { setBackgroundColor(Color.rgb(246, 248, 245)) }
        webView = WebView(this).apply { setBackgroundColor(Color.rgb(246, 248, 245)) }
        content.addView(webView, FrameLayout.LayoutParams(-1, -1))
        errorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setPadding(dp(28), dp(28), dp(28), dp(28))
            setBackgroundColor(Color.rgb(246, 248, 245)); visibility = View.GONE
            addView(TextView(this@MainActivity).apply {
                text = "Geraina belum dapat dibuka"; textSize = 23f; gravity = Gravity.CENTER
                setTextColor(Color.rgb(32, 71, 50)); setTypeface(typeface, Typeface.BOLD)
            })
            addView(TextView(this@MainActivity).apply {
                tag = "message"; textSize = 15f; gravity = Gravity.CENTER
                setPadding(0, dp(14), 0, dp(24)); setTextColor(Color.rgb(71, 85, 105))
            })
            addView(Button(this@MainActivity).apply {
                text = "Coba lagi"; isAllCaps = false; textSize = 15f
                setTextColor(Color.WHITE); background = rounded(Color.rgb(36, 82, 56), 16)
                setOnClickListener { navigate(lastPage, forceReload = true) }
            }, LinearLayout.LayoutParams(dp(180), dp(50)))
        }
        content.addView(errorPanel, FrameLayout.LayoutParams(-1, -1))
        root.addView(content, LinearLayout.LayoutParams(-1, 0, 1f))
        navigationBar = LinearLayout(this).apply {
            gravity = Gravity.CENTER; setPadding(dp(5), dp(6), dp(5), dp(5))
            setBackgroundColor(Color.WHITE); visibility = View.GONE
        }
        for ((label, route) in listOf("Dasbor" to "dashboard", "Kasir" to "pos", "Produk" to "products", "Laporan" to "reports")) {
            val item = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
                isClickable = true; isFocusable = true; contentDescription = label
            }
            val iconFrame = FrameLayout(this).apply {
                addView(ImageView(this@MainActivity).apply {
                    setImageDrawable(GerainaIconDrawable(route, Color.rgb(151, 163, 144)))
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER))
            }
            item.addView(iconFrame, LinearLayout.LayoutParams(dp(48), dp(30)))
            val labelView = TextView(this).apply {
                text = label; textSize = 10f; gravity = Gravity.CENTER
                setTextColor(Color.rgb(137, 151, 130))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            item.addView(labelView, LinearLayout.LayoutParams(-1, dp(20)))
            navigationItems[route] = iconFrame to labelView
            item.setOnClickListener {
                exitBackAt = 0L
                navigate("${NavigationPolicy.ORIGIN}/geraina/app/${if (route == "reports") "reports/sales" else route}")
            }
            navigationBar.addView(item, LinearLayout.LayoutParams(0, dp(54), 1f))
        }
        root.addView(navigationBar, LinearLayout.LayoutParams(-1, dp(68)))
        setContentView(root)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = false
        }
    }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
    }

    private fun updateShell(path: String, store: String, authenticated: Boolean, wide: Boolean) {
        if (NavigationPolicy.classify("${NavigationPolicy.ORIGIN}$path") != NavigationPolicy.Destination.INTERNAL) return
        authenticatedScreen = authenticated && path.startsWith("/geraina/app/")
        wideNavigation = wide && authenticatedScreen
        val section = path.removePrefix("/geraina/app/").substringBefore('/')
        pageTitle.text = when (section) {
            "dashboard" -> "geraina."
            "pos" -> "Kasir"
            "products" -> "Produk"
            "reports", "sales" -> "Laporan"
            "inventory" -> "Inventaris"
            "customers" -> "Pelanggan"
            "settings" -> "Pengaturan"
            else -> "geraina."
        }
        drawerButton.visibility = if (authenticatedScreen && !wideNavigation) View.VISIBLE else View.GONE
        brandIcon.visibility = if (!authenticatedScreen || (wideNavigation && section == "dashboard")) View.VISIBLE else View.GONE
        subtitle.text = if (authenticatedScreen) store.take(64).ifBlank { "Toko Anda" } else "Kasir & operasional toko"
        navigationBar.visibility = if (authenticatedScreen && !keyboardVisible && !wideNavigation) View.VISIBLE else View.GONE
        for ((route, views) in navigationItems) {
            val selected = section == route || (route == "reports" && section == "sales")
            val color = if (selected) Color.rgb(56, 105, 59) else Color.rgb(100, 116, 92)
            views.first.background = if (selected) rounded(Color.rgb(231, 240, 223), 12) else null
            (views.first.getChildAt(0) as ImageView).setImageDrawable(GerainaIconDrawable(route, color))
            views.second.setTextColor(color)
            views.second.setTypeface(null, if (selected) Typeface.BOLD else Typeface.NORMAL)
            (views.first.parent as View).isSelected = selected
        }
        if (authenticatedScreen) lastPage = "${NavigationPolicy.ORIGIN}$path"
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            useWideViewPort = true
            loadWithOverviewMode = true
            userAgentString += " GerainaAndroid/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return if (request.method == "GET") bundledFrontend.intercept(request.url) else null
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                return when (NavigationPolicy.classify(request.url.toString())) {
                    NavigationPolicy.Destination.INTERNAL -> { failedPageUrl = null; false }
                    else -> { navigate(request.url.toString()); true }
                }
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                if (BuildConfig.DEBUG) android.util.Log.d("GerainaWebView", "page started")
                if (NavigationPolicy.classify(url) != NavigationPolicy.Destination.INTERNAL) {
                    view.stopLoading(); navigate(url); return
                }
                lastPage = url
                // Some WebViews deliver a main-frame HTTP error before page-start.
                // Preserve that error instead of immediately hiding its retry screen.
                if (failedPageUrl == url) return
                pageFailed = false
                errorPanel.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }
            override fun onPageFinished(view: WebView, url: String) {
                if (BuildConfig.DEBUG) android.util.Log.d("GerainaWebView", "page finished, failed=$pageFailed")
                if (!pageFailed) {
                    progress.visibility = View.INVISIBLE
                    webView.evaluateJavascript("window.GerainaMobile?.sync?.()", null)
                }
                CookieManager.getInstance().flush()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    failedPageUrl = request.url.toString()
                    showError("Periksa koneksi internet Anda, lalu coba lagi. Transaksi baru memerlukan koneksi.")
                }
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (BuildConfig.DEBUG) android.util.Log.d("GerainaWebView", "HTTP ${response.statusCode}, main frame=${request.isForMainFrame}")
                if (request.isForMainFrame && response.statusCode >= 400) {
                    failedPageUrl = request.url.toString()
                    showError("Layanan sedang tidak tersedia. Silakan coba lagi.")
                }
            }
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                recreate()
                return true
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, value: Int) { progress.progress = value }
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                if (NavigationPolicy.classify(view.url.orEmpty()) != NavigationPolicy.Destination.INTERNAL) return false
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    val mimeTypes = FilePickerPolicy.mimeTypes(params.acceptTypes) {
                        MimeTypeMap.getSingleton().getMimeTypeFromExtension(it)
                    }
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = mimeTypes.singleOrNull() ?: "*/*"
                        if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    }
                    selectFile.launch(intent); true
                } catch (_: ActivityNotFoundException) {
                    callback.onReceiveValue(null); fileCallback = null
                    notice("Tidak ada aplikasi pemilih file."); true
                }
            }
        }
        webView.setDownloadListener { url, _, _, _, _ ->
            if (NavigationPolicy.classify(webView.url.orEmpty()) == NavigationPolicy.Destination.INTERNAL) {
                val quoted = JSONObject.quote(url)
                webView.evaluateJavascript("""
                    (async () => {
                      try {
                        const url = $quoted;
                        if (!url.startsWith('blob:') && new URL(url).origin !== location.origin) return;
                        const blob = await (await fetch(url, {credentials: 'include'})).blob();
                        if (blob.size > ${NavigationPolicy.MAX_DOWNLOAD_BYTES}) { GerainaNative.postMessage('{"type":"downloadTooLarge"}'); return; }
                        const reader = new FileReader();
                        reader.onload = () => GerainaNative.postMessage(JSON.stringify({type:'download', name:'geraina-export.pdf', data:reader.result}));
                        reader.readAsDataURL(blob);
                      } catch { GerainaNative.postMessage('{"type":"downloadError"}'); }
                    })();
                """.trimIndent(), null)
            }
        }
    }

    private fun installNativeFeatures() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return
        WebViewCompat.addWebMessageListener(webView, "GerainaNative", setOf(NavigationPolicy.ORIGIN)) {
                _, message, origin, isMainFrame, _ ->
            if (isMainFrame && origin.toString().trimEnd('/') == NavigationPolicy.ORIGIN) {
                runOnUiThread { handleMessage(message.data.orEmpty()) }
            }
        }
        val script = assets.open("android-bridge.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(webView, script, setOf(NavigationPolicy.ORIGIN))
        val appInfo = JSONObject().put("versionName", BuildConfig.VERSION_NAME).put("versionCode", BuildConfig.VERSION_CODE)
            .put("androidVersion", Build.VERSION.RELEASE).put("model", "${Build.MANUFACTURER} ${Build.MODEL}".take(100))
        val deviceScript = "window.__gerainaAppInfo=$appInfo;\n" + assets.open("device-features.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(webView, deviceScript, setOf(NavigationPolicy.ORIGIN))
        val supportScript = assets.open("mobile-support.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(webView, supportScript, setOf(NavigationPolicy.ORIGIN))
        val css = assets.open("mobile-support.css").bufferedReader().use { it.readText() } + "\n" +
            assets.open("mobile-ui.css").bufferedReader().use { it.readText() }
        val mobileScript = assets.open("mobile-ui.js").bufferedReader().use { it.readText() }
            .replace("__GERAINA_MOBILE_STYLE__", JSONObject.quote(css))
        WebViewCompat.addDocumentStartJavaScript(webView, mobileScript, setOf(NavigationPolicy.ORIGIN))
    }

    private fun handleMessage(raw: String) {
        if (raw.length > NavigationPolicy.MAX_DOWNLOAD_BYTES * 4 / 3 + 4096) {
            notice("File terlalu besar. Batas unduhan adalah 10 MB."); return
        }
        val message = runCatching { JSONObject(raw) }.getOrNull() ?: return
        when (message.optString("type")) {
            "print" -> printPage()
            "open" -> navigate(message.optString("url"))
            "subscription" -> showSubscriptionNotice()
            "navigation" -> webView.evaluateJavascript("window.GerainaMobile?.sync?.()", null)
            "interaction" -> exitBackAt = 0L
            "scanBarcode" -> {
                val target = message.optString("target", "pos")
                val path = Uri.parse(lastPage).path.orEmpty()
                if (authenticatedScreen && !scannerOpen && BarcodeScanPolicy.allows(target, path)) {
                    barcodeTarget = target; barcodeOriginPath = path; scannerOpen = true
                    scanBarcode.launch(Intent(this, BarcodeScannerActivity::class.java))
                }
            }
            "configurePrinter" -> if (authenticatedScreen) receiptPrinter.configure()
            "testPrinter" -> if (authenticatedScreen) receiptPrinter.sample()
            "printReceipt" -> if (authenticatedScreen) message.optJSONObject("order")?.let { receiptPrinter.print(it, subtitle.text.toString()) }
            "shell" -> updateShell(message.optString("path"), message.optString("store"), message.optBoolean("authenticated"), message.optBoolean("wideNavigation"))
            "download" -> saveDownload(message.optString("name"), message.optString("data"))
            "downloadTooLarge" -> notice("File terlalu besar. Batas unduhan adalah 10 MB.")
            "downloadError" -> notice("Unduhan gagal. Silakan coba lagi.")
        }
    }

    private fun saveDownload(filename: String, data: String) {
        if (exportInProgress || pendingExport.exists()) { notice("Selesaikan penyimpanan file sebelumnya terlebih dahulu."); return }
        val match = Regex("^data:([^;,]*)(?:;[^,]*)?;base64,(.+)$", RegexOption.DOT_MATCHES_ALL).matchEntire(data)
        if (match == null) { notice("Format unduhan tidak didukung."); return }
        val bytes = runCatching { Base64.decode(match.groupValues[2], Base64.DEFAULT) }.getOrNull() ?: return
        if (bytes.size > NavigationPolicy.MAX_DOWNLOAD_BYTES) { notice("Batas unduhan adalah 10 MB."); return }
        val mime = match.groupValues[1].ifBlank { "application/octet-stream" }
        exportInProgress = true
        io.execute {
            val saved = runCatching { pendingExport.writeBytes(bytes) }.isSuccess
            runOnUiThread {
                if (saved && !isFinishing && !isDestroyed) {
                    try {
                        saveFile.launch(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE); type = mime
                            putExtra(Intent.EXTRA_TITLE, NavigationPolicy.safeFilename(filename))
                        })
                    } catch (_: ActivityNotFoundException) {
                        exportInProgress = false; pendingExport.delete(); notice("Tidak ada aplikasi penyimpan file.")
                    }
                } else { exportInProgress = false; pendingExport.delete(); notice("Unduhan tidak dapat disiapkan.") }
            }
        }
    }

    private fun navigate(url: String, forceReload: Boolean = false) {
        when (NavigationPolicy.classify(url)) {
            NavigationPolicy.Destination.INTERNAL -> {
                if (!nativeFeaturesReady) {
                    showError("Perbarui Android System WebView atau Chrome untuk menjalankan Geraina POS dengan aman.")
                    return
                }
                failedPageUrl = null
                errorPanel.visibility = View.GONE
                if (!forceReload && authenticatedScreen && Uri.parse(url).path.orEmpty().startsWith("/geraina/app/")) {
                    webView.evaluateJavascript("window.GerainaRouter?.navigate(${JSONObject.quote(url)}) === true") { handled ->
                        if (handled != "true" && !isFinishing && !isDestroyed) webView.loadUrl(url)
                    }
                } else webView.loadUrl(url)
            }
            NavigationPolicy.Destination.EXTERNAL -> {
                try {
                    startActivity(Intent(if (url.startsWith("mailto:")) Intent.ACTION_SENDTO else Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: ActivityNotFoundException) { notice("Tidak ada aplikasi untuk membuka tautan ini.") }
            }
            NavigationPolicy.Destination.SUBSCRIPTION -> showSubscriptionNotice()
            NavigationPolicy.Destination.BLOCKED -> notice("Tautan ini tidak dapat dibuka.")
        }
    }

    private fun showSubscriptionNotice() {
        AlertDialog.Builder(this).setTitle("Langganan Geraina")
            .setMessage("Versi ini menggunakan akses yang sudah tersedia pada akun Anda. Pembelian atau perubahan paket tidak tersedia di aplikasi Android.")
            .setPositiveButton("Mengerti", null).show()
    }

    private fun showMenu(anchor: View) {
        PopupMenu(this, anchor).apply {
            listOf("Muat ulang", "Printer struk", "Cetak contoh printer", "Cetak halaman", "Chat bantuan", "Privasi", "Minta penghapusan akun", "Bantuan", "Tentang Geraina").forEach { menu.add(it) }
            setOnMenuItemClickListener {
                when (it.title.toString()) {
                    "Muat ulang" -> if (nativeFeaturesReady) { failedPageUrl = null; webView.reload() } else notice("Perbarui Android System WebView atau Chrome terlebih dahulu.")
                    "Cetak halaman" -> printPage()
                    "Printer struk" -> if (authenticatedScreen) receiptPrinter.configure() else notice("Masuk ke toko terlebih dahulu.")
                    "Cetak contoh printer" -> if (authenticatedScreen) receiptPrinter.sample() else notice("Masuk ke toko terlebih dahulu.")
                    "Chat bantuan" -> webView.evaluateJavascript("window.GerainaMobile?.openSupport?.() || false") { opened ->
                        if (opened != "true") notice("Chat belum tersedia. Gunakan Bantuan untuk menghubungi dukungan.")
                    }
                    "Privasi" -> navigate("https://dagangos.com/kebijakan-privasi")
                    "Minta penghapusan akun" -> requestDeletion()
                    "Bantuan" -> navigate("mailto:contact@dagangos.com")
                    "Tentang Geraina" -> AlertDialog.Builder(this@MainActivity).setTitle("Geraina POS ${BuildConfig.VERSION_NAME}")
                        .setMessage("Kasir, produk, inventori, dan laporan toko Anda.\n\nPT DagangOS Digital Indonesia\n\nSetelah masuk dan mengunduh katalog, pembayaran tunai dapat dicatat offline dan disinkronkan saat tersambung. Pembayaran elektronik memerlukan internet.\n\nPrinter struk ESC/POS: Bluetooth Classic atau USB printer-class. Dukungan perangkat mengikuti protokol printer.")
                        .setPositiveButton("Tutup", null).show()
                }
                true
            }
            show()
        }
    }

    private fun requestDeletion() {
        AlertDialog.Builder(this).setTitle("Minta penghapusan akun")
            .setMessage("Kirim permintaan penghapusan akun dan data Geraina POS ke contact@dagangos.com dari email akun Anda. Sertakan nama toko. Dukungan akan memverifikasi kepemilikan akun; data yang wajib disimpan dapat dipertahankan sesuai kebijakan privasi.\n\nTombol berikut membuka draf email. Permintaan baru dikirim setelah Anda menekan Kirim di aplikasi email.")
            .setPositiveButton("Buka draf email") { _, _ ->
                val subject = Uri.encode("Permintaan penghapusan akun Geraina POS")
                val body = Uri.encode("Saya meminta penghapusan akun Geraina POS dan data terkait.\nEmail akun: \nNama toko: \n\nMohon verifikasi kepemilikan akun dan konfirmasikan proses penghapusan.")
                navigate("mailto:contact@dagangos.com?subject=$subject&body=$body")
            }.setNegativeButton("Batal", null).show()
    }

    private fun printPage() {
        if (pageFailed || NavigationPolicy.classify(webView.url.orEmpty()) != NavigationPolicy.Destination.INTERNAL) return
        val manager = getSystemService(PRINT_SERVICE) as PrintManager
        manager.print("Geraina POS", webView.createPrintDocumentAdapter("Geraina POS"), null)
    }

    private fun showError(message: String) {
        pageFailed = true
        errorPanel.findViewWithTag<TextView>("message").text = message
        errorPanel.visibility = View.VISIBLE; progress.visibility = View.INVISIBLE
        subtitle.text = "Koneksi belum tersedia"
    }
    private fun notice(message: String) {
        if (!isFinishing && !isDestroyed) Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString("barcodeTarget", barcodeTarget)
        outState.putString("barcodeOriginPath", barcodeOriginPath)
        outState.putBoolean("scannerOpen", scannerOpen)
        if (::webView.isInitialized) outState.putBundle("webState", Bundle().also { webView.saveState(it) })
        super.onSaveInstanceState(outState)
    }
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (::webView.isInitialized) webView.invalidate()
    }
    override fun onPause() {
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }
    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }
    override fun onDestroy() {
        if (::receiptPrinter.isInitialized) receiptPrinter.close()
        fileCallback?.onReceiveValue(null); fileCallback = null
        if (::webView.isInitialized) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        io.shutdown()
        super.onDestroy()
    }
}
