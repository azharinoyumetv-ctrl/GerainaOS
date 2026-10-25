package com.example.gerainapos

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.security.MessageDigest

class UpdatePolicyTest {
    private val cert = "a".repeat(64)
    private val release = UpdateRelease("1.2.3", 8, "com.dagangos.geraina", "/downloads/geraina/Geraina-POS-1.2.3.apk", 3,
        UpdatePolicy.hex(MessageDigest.getInstance("SHA-256").digest(byteArrayOf(1, 2, 3))), 34, setOf("arm64-v8a", "x86_64"), cert)
    private fun validate(value: UpdateRelease) = UpdatePolicy.validate(value, release.applicationId, 36, setOf("arm64-v8a"), setOf(cert))
    private fun rejected(action: () -> Unit) { assertThrows(IllegalArgumentException::class.java, action) }

    @Test fun acceptsOnlyOfficialVersionedHttpsDownload() {
        validate(release)
        assertEquals("https://dagangos.com/downloads/geraina/Geraina-POS-1.2.3.apk", UpdatePolicy.downloadUri(release).toString())
        for (url in listOf("https://evil.example/a.apk", "http://dagangos.com/downloads/geraina/Geraina-POS-1.2.3.apk",
            "//evil.example/a.apk", "https://dagangos.com@evil.example/a.apk", "/downloads/geraina/../a.apk",
            "${release.downloadUrl}?token=x", "${release.downloadUrl}#x", "https://dagangos.com:444${release.downloadUrl}",
            "/downloads/geraina/Geraina-POS-1.2.2.apk")) rejected { validate(release.copy(downloadUrl = url)) }
    }
    @Test fun rejectsWrongAppSignerUnsupportedOsAndArchitecture() {
        rejected { validate(release.copy(applicationId = "com.other")) }
        rejected { validate(release.copy(certificate = "b".repeat(64))) }
        rejected { validate(release.copy(minimumSdk = 37)) }
        rejected { validate(release.copy(supportedAbis = setOf("x86"))) }
    }
    @Test fun rejectsMalformedMetadataAndUnboundedDownloads() {
        for (size in listOf(0L, -1L, UpdatePolicy.MAX_APK_BYTES + 1)) rejected { validate(release.copy(bytes = size)) }
        for (name in listOf("../../x", "1.2.3-beta", "", "1.2")) rejected { validate(release.copy(version = name)) }
        rejected { validate(release.copy(sha256 = "invalid")) }
        rejected { validate(release.copy(versionCode = 0)) }
    }
    @Test fun rejectsTruncatedAndTamperedFiles() {
        val file = File.createTempFile("geraina-update", ".apk")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3)); UpdatePolicy.verifyFile(file, release)
            file.writeBytes(byteArrayOf(1, 2)); rejected { UpdatePolicy.verifyFile(file, release) }
            file.writeBytes(byteArrayOf(1, 2, 4)); rejected { UpdatePolicy.verifyFile(file, release) }
        } finally { file.delete() }
    }
    @Test fun installedArchiveMustMatchMetadataAndCurrentSigningKeyAndBeNewer() {
        fun verify(code: Long = 8, installed: Long = 7, app: String = release.applicationId, version: String = "1.2.3", sdk: Int = 34, signer: Set<String> = setOf(cert)) =
            UpdatePolicy.verifyArchive(release, installed, app, version, code, sdk, signer, setOf(cert))
        verify()
        rejected { verify(installed = 8) }; rejected { verify(installed = 9) }; rejected { verify(code = 9) }
        rejected { verify(app = "com.other") }; rejected { verify(version = "1.2.2") }; rejected { verify(sdk = 35) }
        rejected { verify(signer = setOf("b".repeat(64))) }; rejected { verify(signer = emptySet()) }
    }
}
