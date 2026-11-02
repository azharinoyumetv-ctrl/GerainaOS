package com.example.gerainapos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FilePickerPolicyTest {
    @Test fun imageUploadUsesGalleryAndCaptureUsesCamera() {
        assertEquals(FilePickerPolicy.Source.GALLERY, FilePickerPolicy.source(listOf("image/*"), false, false))
        assertEquals(FilePickerPolicy.Source.CAMERA, FilePickerPolicy.source(listOf("image/jpeg"), false, true))
        assertEquals(FilePickerPolicy.Source.GALLERY, FilePickerPolicy.source(listOf("image/png", "image/jpeg"), false, false))
    }

    @Test fun importsAndMixedOrMultipleUploadsKeepDocumentPicker() {
        for (types in listOf(emptyList(), listOf("text/csv"), listOf("image/jpeg", "application/pdf"))) {
            assertEquals(FilePickerPolicy.Source.DOCUMENTS, FilePickerPolicy.source(types, false, true))
        }
        assertEquals(FilePickerPolicy.Source.DOCUMENTS, FilePickerPolicy.source(listOf("image/*"), true, false))
    }
    private val knownTypes = mapOf("csv" to "text/csv", "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xls" to "application/vnd.ms-excel")

    @Test fun commaSeparatedExtensionsProduceMimeNamesForAndroidProviders() {
        val types = FilePickerPolicy.mimeTypes(arrayOf(".csv,.xlsx,.xls")) { knownTypes[it] }
        assertTrue(types.contains("text/comma-separated-values"))
        assertTrue(types.contains("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        assertTrue(types.contains("application/vnd.ms-excel"))
        assertTrue(types.none { it.startsWith('.') || ',' in it })
    }

    @Test fun csvMimeIncludesProvidersThatReportGenericTextOrBinary() {
        val types = FilePickerPolicy.mimeTypes(arrayOf("text/csv")) { null }
        assertTrue(types.containsAll(listOf("text/plain", "application/octet-stream")))
        assertEquals(types.size, types.distinct().size)
    }

    @Test fun anyTypeAndUnknownExtensionsDoNotCreateInvalidIntentTypes() {
        assertTrue(FilePickerPolicy.mimeTypes(arrayOf("*/*")) { null }.isEmpty())
        assertTrue(FilePickerPolicy.mimeTypes(arrayOf(".unregistered")) { null }.isEmpty())
        assertEquals(listOf("image/*"), FilePickerPolicy.mimeTypes(arrayOf("IMAGE/*")) { null })
    }
}
