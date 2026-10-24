package com.example.gerainapos

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class BarcodeDecoderTest {
    @Test fun bundledModelReadsRetailBarcodeWithoutDownloadingAModel() {
        val code = "5901234123457"
        val left = listOf("0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011")
        fun invert(value: String) = value.map { if (it == '0') '1' else '0' }.joinToString("")
        val parity = "LGGLLG" // EAN-13 leading digit 5.
        val bits = "101" + code.substring(1,7).mapIndexed { i, digit -> if(parity[i] == 'L') left[digit.digitToInt()] else invert(left[digit.digitToInt()].reversed()) }.joinToString("") + "01010" + code.substring(7).map { invert(left[it.digitToInt()]) }.joinToString("") + "101"
        val bitmap = Bitmap.createBitmap((bits.length + 22) * 4, 280, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap); canvas.drawColor(Color.WHITE)
        val paint = Paint().apply { color = Color.BLACK }
        bits.forEachIndexed { index, bit -> if (bit == '1') canvas.drawRect(((index+11)*4).toFloat(),24f,((index+12)*4).toFloat(),256f,paint) }
        val scanner = BarcodeScanning.getClient()
        try {
            for (rotation in listOf(0,90)) {
                val results = Tasks.await(scanner.process(InputImage.fromBitmap(bitmap,rotation)),30,TimeUnit.SECONDS)
                assertTrue("EAN-13 is decoded at rotation $rotation", results.any { it.rawValue == code })
            }
        } finally { scanner.close(); bitmap.recycle() }
    }
}
