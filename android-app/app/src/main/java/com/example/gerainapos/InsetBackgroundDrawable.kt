package com.example.gerainapos

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable

/** Paint behind the system navigation area, including transparent edge-to-edge bars. */
class InsetBackgroundDrawable : Drawable() {
    var bottomInset = 0
        set(value) { field = value; invalidateSelf() }
    private val paint = Paint().apply { color = Color.rgb(21, 63, 48) }
    override fun draw(canvas: Canvas) {
        canvas.drawColor(Color.WHITE)
        if (bottomInset > 0) canvas.drawRect(bounds.left.toFloat(), (bounds.bottom - bottomInset).toFloat(),
            bounds.right.toFloat(), bounds.bottom.toFloat(), paint)
    }
    override fun setAlpha(alpha: Int) { paint.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter }
    @Deprecated("Deprecated in Android")
    override fun getOpacity(): Int = PixelFormat.OPAQUE
}
