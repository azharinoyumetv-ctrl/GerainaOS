package com.example.gerainapos

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import androidx.core.graphics.PathParser

/** Small, consistent outline icons for the app's native navigation. */
class GerainaIconDrawable(name: String, color: Int) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        style = Paint.Style.STROKE
        strokeWidth = 1.7f
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val path = PathParser.createPathFromPathData(when (name) {
        "dashboard" -> "M3,10 L12,3 L21,10 L21,21 L15,21 L15,14 L9,14 L9,21 L3,21 Z"
        "pos" -> "M3,3 L5,3 L7.5,15 L18.5,15 L20.5,7 L6,7 M9,19 A1,1 0,1 0,9.01 19 M18,19 A1,1 0,1 0,18.01 19"
        "products" -> "M12,3 L21,8 L12,13 L3,8 Z M3,8 L3,18 L12,23 L21,18 L21,8 M12,13 L12,23 M7.5,5.5 L16.5,10.5"
        "reports" -> "M4,3 L4,20 L21,20 M8,15 L8,11 M13,15 L13,6 M18,15 L18,9"
        "menu" -> "M3,3 L10,3 L10,10 L3,10 Z M14,3 L21,3 L21,10 L14,10 Z M3,14 L10,14 L10,21 L3,21 Z M14,14 L21,14 L21,21 L14,21 Z"
        "drawer" -> "M4,6 L20,6 M4,12 L20,12 M4,18 L20,18"
        else -> "M5,12 L5.1,12 M12,12 L12.1,12 M19,12 L19.1,12"
    })

    override fun draw(canvas: Canvas) {
        val saved = canvas.save()
        canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
        canvas.scale(bounds.width() / 24f, bounds.height() / 24f)
        canvas.drawPath(path, paint)
        canvas.restoreToCount(saved)
    }
    override fun setAlpha(alpha: Int) { paint.alpha = alpha; invalidateSelf() }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter; invalidateSelf() }
    @Deprecated("Deprecated in Android")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
