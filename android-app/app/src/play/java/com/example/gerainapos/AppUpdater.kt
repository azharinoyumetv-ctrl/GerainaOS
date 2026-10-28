package com.example.gerainapos

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.LinearLayout
import androidx.activity.ComponentActivity

/** Play manages installation; this build cannot download or install APKs. */
class AppUpdater(private val activity: ComponentActivity, restoring: Boolean, private val notice: (String) -> Unit) {
    val banner = LinearLayout(activity).apply { visibility = View.GONE }
    fun onResume() = Unit
    fun close() = Unit
    fun check(manual: Boolean = true) {
        if (!manual || activity.isFinishing || activity.isDestroyed) return
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${activity.packageName}")))
        } catch (_: ActivityNotFoundException) {
            notice("Google Play belum dapat dibuka. Periksa pembaruan melalui aplikasi Google Play.")
        }
    }
}
