package com.example.gerainapos

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ProductPhotoStoreTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun generatedCapturesCanBeReadAndReleased() {
        val store = ProductPhotoStore(temporary.root)
        val file = store.create().apply { writeText("fixture") }
        assertEquals(file, store.file(file.name))
        store.release(file.name)
        assertFalse(file.exists())
    }

    @Test fun cleanupCannotTouchOtherCacheFilesOrEscapeTheCaptureDirectory() {
        val store = ProductPhotoStore(temporary.root)
        val outside = File(temporary.root, "capture-private.jpg").apply { writeText("keep") }
        for (name in listOf("../capture-private.jpg", "/capture-private.jpg", "capture-other/../../capture-private.jpg", "not-a-capture.jpg", "capture-" + "a".repeat(2000) + ".jpg")) {
            assertNull(store.file(name)); store.release(name)
        }
        assertTrue(outside.exists())
    }

    @Test fun staleAbandonedCapturesExpireButRecentSelectionsStayReadable() {
        val store = ProductPhotoStore(temporary.root)
        val stale = store.create().apply { setLastModified(System.currentTimeMillis() - 61 * 60 * 1000L) }
        val recent = store.create().apply { writeText("recent") }
        store.prune()
        assertFalse(stale.exists()); assertTrue(recent.exists())
    }
}
