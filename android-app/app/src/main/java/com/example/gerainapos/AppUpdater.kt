package com.example.gerainapos

import android.app.AlertDialog
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InterruptedIOException
import java.net.HttpURLConnection
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** User-approved updates for the APK distributed on dagangos.com, never a Play self-updater. */
class AppUpdater(private val activity: ComponentActivity, restoring: Boolean, private val notice: (String) -> Unit) {
    private val prefs = activity.getSharedPreferences("website-updates", 0)
    private val executor = Executors.newSingleThreadExecutor()
    private val directory = File(activity.cacheDir, "updates")
    private val signers by lazy {
        certificates(activity.packageManager.getPackageInfo(activity.packageName, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong())))
    }
    @Volatile private var closed = false
    private var busy = restoring && prefs.contains("pending")
    private var available: UpdateRelease? = null
    private var dialog: AlertDialog? = null
    private var cancellation: AtomicBoolean? = null
    @Volatile private var connection: HttpURLConnection? = null
    private val bannerText = TextView(activity).apply {
        textSize = 13f; setTextColor(Color.rgb(32, 71, 50))
    }
    val banner = LinearLayout(activity).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16), dp(5), dp(10), dp(5)); setBackgroundColor(Color.rgb(234, 243, 224))
        visibility = View.GONE
        addView(bannerText, LinearLayout.LayoutParams(0, -2, 1f))
        addView(Button(activity).apply {
            text = "Perbarui"; isAllCaps = false; contentDescription = "Perbarui Geraina"
            setTextColor(Color.rgb(32, 71, 50)); setOnClickListener { available?.let { offer(it) } }
        }, LinearLayout.LayoutParams(-2, dp(48)))
    }
    // Registered before STARTED. A settings round-trip can recreate the process; persist only our verified release.
    private val permission = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val pending = prefs.getString("pending", null)
        prefs.edit().remove("pending").apply()
        busy = false
        if (pending != null && activity.packageManager.canRequestPackageInstalls()) {
            runCatching { parse(pending).also(::validate) }.onSuccess { installVerified(it) }
                .onFailure { notice("Pembaruan perlu diunduh ulang. Periksa pembaruan kembali.") }
        } else notice("Pemasangan dibatalkan. Anda dapat mencoba lagi dari Periksa pembaruan.")
    }

    init {
        // A force-stop/new launch cannot deliver an old settings result. Don't leave the updater locked.
        if (!restoring) prefs.edit().remove("pending").apply()
        executor.execute {
            val pending = prefs.getString("pending", null)?.let { runCatching { fileFor(parse(it)).name }.getOrNull() }
            directory.listFiles()?.forEach { file ->
                val code = Regex("update-([0-9]+)-[a-f0-9]{64}\\.apk").matchEntire(file.name)?.groupValues?.get(1)?.toLongOrNull()
                val stalePart = file.name.endsWith(".part") && System.currentTimeMillis() - file.lastModified() > 86400000L
                if (file.name != pending && (code != null && code <= BuildConfig.VERSION_CODE || stalePart)) file.delete()
            }
        }
    }

    fun onResume() {
        if (closed || busy) return
        val cached = prefs.getString("available", null)
        if (available == null && cached != null) runCatching { parse(cached).also(::validate) }.getOrNull()?.let(::showAvailable)
        val elapsed = System.currentTimeMillis() - prefs.getLong("lastCheck", 0)
        if (elapsed < 0 || elapsed >= 24 * 60 * 60 * 1000L) check(manual = false)
    }

    fun check(manual: Boolean = true) {
        if (closed) return
        if (busy || dialog?.isShowing == true) { if (manual) notice("Selesaikan pemeriksaan atau pemasangan sebelumnya."); return }
        busy = true
        if (manual) notice("Memeriksa pembaruan Geraina…")
        executor.execute {
            val result = runCatching {
                val http = open(UpdatePolicy.MANIFEST_URL)
                try {
                    require(http.responseCode == 200)
                    val bytes = http.inputStream.use { input -> input.readNBytes(65537) }
                    require(bytes.size <= 65536)
                    parse(bytes.toString(Charsets.UTF_8)).also(::validate)
                } finally { http.disconnect(); connection = null }
            }
            ui {
                busy = false
                result.onSuccess { release ->
                    prefs.edit().putLong("lastCheck", System.currentTimeMillis()).apply()
                    if (release.versionCode > BuildConfig.VERSION_CODE) {
                        prefs.edit().putString("available", serialize(release)).apply()
                        showAvailable(release)
                        if (manual) offer(release)
                    } else {
                        available = null; banner.visibility = View.GONE
                        prefs.edit().remove("available").apply()
                        if (manual) AlertDialog.Builder(activity).setTitle("Geraina sudah terbaru")
                            .setMessage("Versi terpasang: ${BuildConfig.VERSION_NAME}. Belum ada pembaruan yang lebih baru untuk perangkat ini.")
                            .setPositiveButton("Tutup", null).show().also { dialog = it }
                    }
                }.onFailure {
                    // Failed automatic checks remain quiet and retry after 15 minutes, without blocking the POS.
                    prefs.edit().putLong("lastCheck", System.currentTimeMillis() - 24 * 60 * 60 * 1000L + 15 * 60 * 1000L).apply()
                    if (manual) AlertDialog.Builder(activity).setTitle("Pembaruan belum dapat diperiksa")
                        .setMessage("Periksa koneksi internet dan coba lagi. Aplikasi yang terpasang tetap dapat digunakan.")
                        .setPositiveButton("Coba lagi") { _, _ -> dialog = null; check() }
                        .setNegativeButton("Tutup", null).show().also { dialog = it }
                }
            }
        }
    }

    private fun showAvailable(release: UpdateRelease) {
        if (release.versionCode <= BuildConfig.VERSION_CODE) return
        available = release; bannerText.text = "Geraina ${release.version} tersedia"
        banner.visibility = View.VISIBLE
    }

    private fun offer(release: UpdateRelease) {
        if (closed || busy || dialog?.isShowing == true) return
        dialog = AlertDialog.Builder(activity).setTitle("Perbarui Geraina ke ${release.version}?")
            .setMessage("Unduhan resmi: ${"%.1f".format(release.bytes / 1048576.0)} MB.\n\nSelesaikan transaksi dan simpan pekerjaan yang sedang dibuka. Android akan meminta persetujuan pemasangan.\n\nAkun, pengaturan, dan transaksi offline yang sudah tersimpan dipertahankan. Jangan hapus aplikasi lama.")
            .setPositiveButton("Unduh pembaruan") { _, _ -> download(release) }
            .setNegativeButton("Nanti", null).show()
    }

    private fun download(release: UpdateRelease) {
        if (closed || busy) return
        busy = true
        val cancelled = AtomicBoolean(false); cancellation = cancelled
        val bar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100 }
        val label = TextView(activity).apply { text = "Menyiapkan unduhan…"; setTextColor(Color.rgb(32, 71, 50)); setPadding(0, 0, 0, dp(12)) }
        val body = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(16), dp(24), dp(16)); addView(label); addView(bar) }
        fun cancel() { cancelled.set(true); connection?.disconnect() }
        dialog = AlertDialog.Builder(activity).setTitle("Mengunduh Geraina ${release.version}").setView(body)
            .setNegativeButton("Batal") { _, _ -> cancel() }.setOnCancelListener { cancel() }.show()
        executor.execute {
            var partial: File? = null
            val result = runCatching {
                validate(release); require(release.versionCode > BuildConfig.VERSION_CODE)
                require(directory.isDirectory || directory.mkdirs())
                val destination = fileFor(release)
                if (!destination.exists()) {
                    partial = File(directory, "${UUID.randomUUID()}.part")
                    val http = open(UpdatePolicy.downloadUri(release).toString())
                    try {
                        require(http.responseCode == 200 && (http.contentLengthLong < 0 || http.contentLengthLong == release.bytes))
                        var total = 0L; var lastPercent = -1
                        http.inputStream.use { input -> FileOutputStream(partial).use { output ->
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                if (cancelled.get()) throw InterruptedIOException()
                                val count = input.read(buffer); if (count < 0) break
                                total += count; require(total <= release.bytes && total <= UpdatePolicy.MAX_APK_BYTES)
                                output.write(buffer, 0, count)
                                val percent = (total * 100 / release.bytes).toInt()
                                if (percent != lastPercent) { lastPercent = percent; ui { bar.progress = percent; label.text = "${percent}% · ${"%.1f".format(total / 1048576.0)} MB" } }
                            }
                            output.fd.sync()
                        } }
                        UpdatePolicy.verifyFile(partial, release)
                        require(partial.renameTo(destination))
                    } finally { http.disconnect(); connection = null }
                }
                if (cancelled.get()) throw InterruptedIOException()
                verifyApk(destination, release)
                destination
            }
            partial?.delete()
            ui {
                cancellation = null; busy = false; dialog?.dismiss(); dialog = null
                if (!cancelled.get()) result.onSuccess { requestInstall(release) }.onFailure {
                    fileFor(release).delete()
                    AlertDialog.Builder(activity).setTitle("Pembaruan tidak dapat disiapkan")
                        .setMessage("Unduhan gagal atau tidak lolos pemeriksaan keamanan. Periksa koneksi dan ruang penyimpanan, lalu coba lagi. Aplikasi lama tetap terpasang.")
                        .setPositiveButton("Tutup", null).show().also { dialog = it }
                }
            }
        }
    }

    private fun requestInstall(release: UpdateRelease) {
        if (activity.packageManager.canRequestPackageInstalls()) installVerified(release)
        else dialog = AlertDialog.Builder(activity).setTitle("Izinkan pembaruan Geraina")
            .setMessage("Android memerlukan izin pemasangan dari Geraina untuk memperbarui APK dari dagangos.com. Buka pengaturan, izinkan sumber ini, lalu kembali ke Geraina. Persetujuan pemasangan tetap ditampilkan oleh Android.")
            .setPositiveButton("Buka pengaturan") { _, _ ->
                prefs.edit().putString("pending", serialize(release)).apply()
                busy = true
                runCatching { permission.launch(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))) }
                    .onFailure { busy = false; prefs.edit().remove("pending").apply(); notice("Pengaturan pemasangan tidak tersedia atau dibatasi pada perangkat ini.") }
            }.setNegativeButton("Nanti", null).show()
    }

    private fun installVerified(release: UpdateRelease) {
        if (closed || busy) return
        busy = true
        executor.execute {
            val result = runCatching { validate(release); fileFor(release).also { verifyApk(it, release) } }
            ui {
                busy = false
                result.onSuccess { file ->
                    runCatching {
                        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", file)
                        activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "application/vnd.android.package-archive")
                            clipData = ClipData.newRawUri("Geraina update", uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        })
                    }.onFailure { notice("Pemasangan tidak tersedia atau dibatasi pada perangkat ini. Aplikasi lama tetap dapat digunakan.") }
                }.onFailure { notice("File pembaruan tidak valid. Periksa pembaruan dan unduh ulang.") }
            }
        }
    }

    private fun verifyApk(file: File, release: UpdateRelease) {
        UpdatePolicy.verifyFile(file, release)
        val info = activity.packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()))
            ?: error("APK tidak valid")
        UpdatePolicy.verifyArchive(release, BuildConfig.VERSION_CODE.toLong(), info.packageName, info.versionName,
            info.longVersionCode, info.applicationInfo?.minSdkVersion ?: 0, certificates(info), signers)
    }

    private fun validate(release: UpdateRelease) = UpdatePolicy.validate(release, activity.packageName, Build.VERSION.SDK_INT, Build.SUPPORTED_ABIS.toSet(), signers)
    private fun certificates(info: PackageInfo) = info.signingInfo?.apkContentsSigners?.map {
        UpdatePolicy.hex(MessageDigest.getInstance("SHA-256").digest(it.toByteArray()))
    }?.toSet() ?: emptySet()
    private fun fileFor(release: UpdateRelease) = File(directory, "update-${release.versionCode}-${release.sha256}.apk")
    private fun parse(raw: String): UpdateRelease {
        val json = JSONObject(raw)
        return UpdateRelease(json.getString("version"), json.getLong("versionCode"), json.getString("applicationId"),
            json.getString("downloadUrl"), json.getLong("bytes"), json.getString("sha256"), json.getInt("minimumSdk"),
            json.getJSONArray("supportedAbis").let { array -> (0 until array.length()).map { array.getString(it) }.toSet() }, json.getString("signingCertificateSha256"))
    }
    private fun serialize(release: UpdateRelease) = JSONObject().put("version", release.version).put("versionCode", release.versionCode)
        .put("applicationId", release.applicationId).put("downloadUrl", release.downloadUrl).put("bytes", release.bytes).put("sha256", release.sha256)
        .put("minimumSdk", release.minimumSdk).put("supportedAbis", org.json.JSONArray(release.supportedAbis.toList())).put("signingCertificateSha256", release.certificate).toString()
    private fun open(url: String): HttpURLConnection = (java.net.URI(url).toURL().openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false; connectTimeout = 10000; readTimeout = 15000; useCaches = false
        setRequestProperty("Accept-Encoding", "identity"); setRequestProperty("User-Agent", "Geraina/${BuildConfig.VERSION_NAME} Android")
        connection = this
    }
    private fun ui(action: () -> Unit) { activity.runOnUiThread { if (!closed && !activity.isFinishing && !activity.isDestroyed) action() } }
    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
    fun close() {
        closed = true; cancellation?.set(true); connection?.disconnect(); dialog?.dismiss(); executor.shutdownNow()
    }
}
