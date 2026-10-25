package com.example.gerainapos

object BarcodeScanPolicy {
    fun allows(target: String, path: String): Boolean = when (target) {
        "pos" -> path.trimEnd('/') == "/geraina/app/pos"
        "product" -> path.trimEnd('/') == "/geraina/app/products"
        else -> false
    }
    fun canDeliver(target: String, sourcePath: String, currentPath: String, value: String?): Boolean =
        allows(target, sourcePath) && sourcePath == currentPath && !value.isNullOrBlank() && value.length <= 256
}
