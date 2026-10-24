package com.example.gerainapos

import java.util.Locale

object FilePickerPolicy {
    /** Android document providers use several different MIME names for CSV files. */
    fun mimeTypes(acceptTypes: Array<String>, fromExtension: (String) -> String?): List<String> {
        val accepted = acceptTypes.flatMap { it.split(',') }.map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }
        if (accepted.isEmpty() || "*/*" in accepted) return emptyList()
        val result = linkedSetOf<String>()
        for (type in accepted) {
            val mime = if (type.startsWith('.')) fromExtension(type.drop(1)) else type
            if (mime != null && Regex("^[a-z0-9.+_-]+/[a-z0-9.+_*-]+$").matches(mime)) result.add(mime)
            if (type == ".csv" || type in setOf("text/csv", "application/csv", "text/comma-separated-values")) {
                result.addAll(listOf("text/csv", "text/comma-separated-values", "application/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"))
            }
        }
        return result.toList()
    }
}
