package com.example.gerainapos

import java.io.File
import java.net.URI
import java.security.MessageDigest

data class UpdateRelease(
    val version: String, val versionCode: Long, val applicationId: String,
    val downloadUrl: String, val bytes: Long, val sha256: String,
    val minimumSdk: Int, val supportedAbis: Set<String>, val certificate: String
)

/** Website distribution only. The website cannot change the installed app's signing identity. */
object UpdatePolicy {
    const val ORIGIN = "https://dagangos.com"
    const val MANIFEST_URL = "$ORIGIN/downloads/geraina/latest.json"
    const val MAX_APK_BYTES = 100L * 1024 * 1024
    private val hashPattern = Regex("[a-f0-9]{64}")

    fun validate(release: UpdateRelease, packageName: String, sdk: Int, abis: Set<String>, signers: Set<String>) {
        require(release.applicationId == packageName) { "Identitas aplikasi tidak cocok." }
        require(Regex("[0-9]{1,5}\\.[0-9]{1,5}\\.[0-9]{1,5}").matches(release.version) && release.versionCode > 0)
        require(release.bytes in 1..MAX_APK_BYTES && hashPattern.matches(release.sha256)) { "Informasi unduhan tidak valid." }
        require(release.minimumSdk in 34..sdk && release.supportedAbis.intersect(abis).isNotEmpty()) { "Pembaruan belum mendukung perangkat ini." }
        require(hashPattern.matches(release.certificate) && signers == setOf(release.certificate)) { "Sertifikat pembaruan tidak cocok." }
        downloadUri(release)
    }

    fun downloadUri(release: UpdateRelease): URI {
        val expectedPath = "/downloads/geraina/Geraina-POS-${release.version}.apk"
        val uri = URI(release.downloadUrl).let { if (!it.isAbsolute) URI(ORIGIN).resolve(it) else it }
        require(uri.scheme == "https" && uri.host == "dagangos.com" && uri.port in setOf(-1, 443) &&
            uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null && uri.rawPath == expectedPath) { "Sumber unduhan tidak valid." }
        return uri
    }

    fun verifyFile(file: File, release: UpdateRelease) {
        require(file.length() == release.bytes) { "Unduhan belum lengkap. Silakan coba lagi." }
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) }
        }
        require(hex(digest.digest()) == release.sha256) { "Pemeriksaan unduhan gagal. Silakan unduh ulang." }
    }

    fun verifyArchive(release: UpdateRelease, installedCode: Long, packageName: String?, version: String?,
                      versionCode: Long, minimumSdk: Int, signers: Set<String>, installedSigners: Set<String>) {
        require(packageName == release.applicationId && version == release.version && versionCode == release.versionCode &&
            versionCode > installedCode && minimumSdk == release.minimumSdk && signers == installedSigners &&
            signers == setOf(release.certificate)) { "File pembaruan tidak cocok dengan aplikasi resmi." }
    }

    fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
}
