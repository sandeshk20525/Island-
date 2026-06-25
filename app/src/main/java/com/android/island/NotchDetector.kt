package com.android.island

import android.content.Context
import android.graphics.Rect
import android.view.DisplayCutout
import android.view.WindowInsets
import android.view.WindowManager

/**
 * DisplayCutout API (Android 14/15/16 compatible) helper to dynamically fetch
 * the Notch or Camera Hole coordinates.
 * Falls back safely to a default centered position in the status bar if no cutout is found.
 */
object NotchDetector {

    /**
     * Notch ya camera hole ki position detect karne ke liye use hota hai.
     * Returns the bounding [Rect] of the top cutout, or a calculated default [Rect] if not found.
     */
    fun getNotchBounds(context: Context): Rect {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            try {
                val windowMetrics = wm.currentWindowMetrics
                val windowInsets = windowMetrics.windowInsets
                val displayCutout: DisplayCutout? = windowInsets.displayCutout
                
                if (displayCutout != null) {
                    val cutouts = displayCutout.boundingRects
                    if (cutouts.isNotEmpty()) {
                        // Sabse pehla top-cutout bounding box select karein
                        val topCutout = cutouts.firstOrNull { it.top == 0 || it.bottom < 150 }
                        if (topCutout != null) {
                            Logger.d("DisplayCutout detected! Position: ${topCutout.toShortString()}")
                            return topCutout
                        }
                    }
                }
            } catch (t: Throwable) {
                Logger.e("DisplayCutout access error", t)
            }
        }
        
        // Fallback: Agar display cutout nahi milta to Screen Dimension nikaal ke default center status bar position calculate karein
        try {
            val windowMetrics = wm.currentWindowMetrics
            val screenWidth = windowMetrics.bounds.width()
            
            // Get standard status bar height from android system resources
            val resourceId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
            val statusBarHeight = if (resourceId > 0) {
                context.resources.getDimensionPixelSize(resourceId)
            } else {
                // Default fallback height
                110 
            }
            
            // Assume 180px default width for fallback pill centered in status bar
            val pillWidth = 180
            val left = (screenWidth - pillWidth) / 2
            val right = left + pillWidth
            val top = 10
            val bottom = statusBarHeight - 10
            
            val fallbackRect = Rect(left, top, right, bottom)
            Logger.i("No DisplayCutout found. Using centered statusbar fallback coordinates: ${fallbackRect.toShortString()}")
            return fallbackRect
        } catch (e: Exception) {
            Logger.e("Error calculating fallback notch coordinates", e)
            // Ultimate hardcoded fallback
            return Rect(450, 10, 630, 90)
        }
    }
}