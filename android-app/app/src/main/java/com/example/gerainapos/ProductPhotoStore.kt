package com.example.gerainapos

import java.io.File

/** Only temporary camera captures are owned here; gallery originals are never copied or deleted. */
class ProductPhotoStore(cacheDir: File) {
    private val directory = File(cacheDir, "product-photos")
    private val namePattern = Regex("^capture-[A-Za-z0-9_-]{1,64}\\.jpg$")

    fun create(): File {
        check(directory.exists() || directory.mkdirs())
        prune()
        return File.createTempFile("capture-", ".jpg", directory)
    }

    fun file(name: String?): File? = name?.takeIf { namePattern.matches(it) }?.let {
        runCatching { File(directory, it).takeIf { file -> file.canonicalFile.parentFile == directory.canonicalFile } }.getOrNull()
    }

    fun release(name: String?) { runCatching { file(name)?.delete() } }

    fun prune(now: Long = System.currentTimeMillis()) {
        directory.listFiles()?.filter { it.isFile && namePattern.matches(it.name) && now - it.lastModified() > 60 * 60 * 1000L }
            ?.forEach { it.delete() }
    }
}
