package com.android.island

import android.util.Log
import de.robv.android.xposed.XposedBridge

/**
 * Custom Logger to print logs to both Android Logcat and LSPosed Manager.
 * 'Island-Log' ya aapka custom tag use karke easily filter karein: "adb logcat -s Island-Log"
 */
object Logger {
    private const val TAG = "Island-Log"

    // Logcat standard logging
    fun d(message: String) {
        Log.d(TAG, message)
        // LSPosed log manager file mein bhi likhega
        XposedBridge.log("[$TAG] DEBUG: $message")
    }

    fun e(message: String, throwable: Throwable? = null) {
        Log.e(TAG, message, throwable)
        XposedBridge.log("[$TAG] ERROR: $message ${throwable?.localizedMessage ?: ""}")
    }

    fun i(message: String) {
        Log.i(TAG, message)
        XposedBridge.log("[$TAG] INFO: $message")
    }
}