package com.example.gerainapos

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceResponse

/** Package the actual UI so an authenticated cashier can restart without a network. */
class BundledFrontend(private val assets: AssetManager) {
    fun intercept(uri: Uri): WebResourceResponse? {
        if (uri.scheme != "https" || uri.host != "dagangos.com" || uri.port !in setOf(-1, 443)) return null
        val path = uri.path ?: return null
        if (path.contains("..") || path.contains('\\')) return null
        val asset = when {
            path == "/geraina/login" || path == "/geraina/register" || path.startsWith("/geraina/app/") || path == "/geraina/app" -> "frontend/index.html"
            path.startsWith("/geraina/static/") -> "frontend/" + path.removePrefix("/geraina/")
            path in setOf("/geraina/icon-192.png", "/geraina/icon-512.png", "/geraina/favicon.ico") -> "frontend/" + path.removePrefix("/geraina/")
            else -> return null
        }
        val mime = when (asset.substringAfterLast('.')) { "html" -> "text/html"; "js" -> "application/javascript"; "css" -> "text/css"; "png" -> "image/png"; "svg" -> "image/svg+xml"; "woff2" -> "font/woff2"; "ico" -> "image/x-icon"; else -> "application/octet-stream" }
        return runCatching { WebResourceResponse(mime, if (mime.startsWith("text/") || mime.contains("javascript")) "UTF-8" else null, 200, "OK", mapOf("Cache-Control" to "no-cache", "X-Content-Type-Options" to "nosniff"), assets.open(asset)) }.getOrNull()
    }
}
