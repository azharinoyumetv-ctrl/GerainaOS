package com.example.gerainapos

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

class BarcodeScannerActivity : ComponentActivity() {
    private lateinit var preview: PreviewView
    private lateinit var status: TextView
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var scanner: BarcodeScanner
    @Volatile private var finished = false
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera() else { status.text = "Izin kamera ditolak. Tutup dan gunakan input barcode manual." }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(Color.rgb(20,36,27)), navigationBarStyle = SystemBarStyle.dark(Color.rgb(20,36,27)))
        fun dp(value: Int) = (resources.displayMetrics.density * value).toInt()
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(20, 36, 27)) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets -> val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()); view.setPadding(bars.left + dp(16), bars.top + dp(8), bars.right + dp(16), bars.bottom + dp(12)); insets }
        status = TextView(this).apply { text = "Arahkan kamera ke barcode produk"; textSize = 18f; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(8, 16, 8, 16) }
        root.addView(status)
        preview = PreviewView(this).apply { contentDescription = "Pratinjau kamera pemindai barcode" }
        root.addView(preview, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(Button(this).apply { text = "Tutup pemindai"; setOnClickListener { finish() } }, LinearLayout.LayoutParams(-1, dp(58)))
        setContentView(root)
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera() else permission.launch(Manifest.permission.CAMERA)
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun startCamera() {
        if (!::scanner.isInitialized) {
            scanner = runCatching { BarcodeScanning.getClient() }.getOrElse { status.text = "Pemindai belum dapat disiapkan. Gunakan input barcode manual."; return }
        }
        val provider = ProcessCameraProvider.getInstance(this)
        provider.addListener({
            if (isFinishing || isDestroyed) return@addListener
            runCatching {
                val cameraProvider = provider.get()
                val display = Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
                val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                analysis.setAnalyzer(executor) { image ->
                    val media = image.image
                    if (finished || media == null) image.close()
                    else scanner.process(InputImage.fromMediaImage(media, image.imageInfo.rotationDegrees))
                        .addOnSuccessListener { codes ->
                            val value = codes.firstOrNull { !it.rawValue.isNullOrBlank() && it.rawValue!!.length <= 256 }?.rawValue
                            if (value != null && !finished) { finished = true; setResult(RESULT_OK, Intent().putExtra("barcode", value)); finish() }
                        }.addOnFailureListener { status.text = "Barcode belum terbaca. Dekatkan kamera dan coba lagi." }
                        .addOnCompleteListener { image.close() }
                }
                cameraProvider.unbindAll()
                val selector = if (cameraProvider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
                cameraProvider.bindToLifecycle(this, selector, display, analysis)
                status.text = "Kamera siap · scan barcode produk"
            }.onFailure { status.text = "Kamera tidak dapat dibuka. Tutup dan gunakan input barcode manual." }
        }, ContextCompat.getMainExecutor(this))
    }

    override fun onDestroy() { finished = true; if (::scanner.isInitialized) scanner.close(); executor.shutdown(); super.onDestroy() }
}
