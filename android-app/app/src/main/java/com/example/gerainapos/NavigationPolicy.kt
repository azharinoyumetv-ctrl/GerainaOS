package com.example.gerainapos

import java.net.URI
import java.util.Locale

object NavigationPolicy {
    const val ORIGIN = "https://dagangos.com"
    const val START_URL = "$ORIGIN/geraina/login"
    const val MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
    enum class Destination { INTERNAL, EXTERNAL, SUBSCRIPTION, BLOCKED }

    fun classify(url: String): Destination {
        val uri = runCatching { URI(url) }.getOrNull() ?: return Destination.BLOCKED
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        if (scheme in setOf("mailto", "tel")) return Destination.EXTERNAL
        if (scheme != "https" || uri.rawUserInfo != null) return Destination.BLOCKED
        if (uri.host?.lowercase(Locale.ROOT) != "dagangos.com" || uri.port !in setOf(-1, 443)) {
            return if (uri.host.isNullOrBlank()) Destination.BLOCKED else Destination.EXTERNAL
        }
        val path = uri.normalize().path.orEmpty().trimEnd('/').lowercase(Locale.ROOT)
        if (path in setOf("/geraina/app/settings/billing", "/geraina/app/billing")) return Destination.INTERNAL
        if (path.split('/').any { it in setOf("pricing", "checkout", "order", "billing") }) return Destination.SUBSCRIPTION
        return if (path == "/geraina" || path.startsWith("/geraina/")) Destination.INTERNAL else Destination.EXTERNAL
    }

    fun safeFilename(name: String): String = name.substringAfterLast('/').substringAfterLast('\\')
        .replace(Regex("[^\\p{L}\\p{N} ._()-]"), "_")
        .trim().trimStart('.').take(120).ifBlank { "geraina-export.pdf" }
}
