package com.android.island

import de.robv.android.xposed.IXposedHookLoadPackage
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage

/**
 * LSPosed Module entry point.
 * 'xposed_init' file isi class ko target karegi.
 */
class IslandHook : IXposedHookLoadPackage {

    @Throws(Throwable::class)
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // Sirf target package (SystemUI) ko filter karein
        if (lpparam.packageName != "com.android.systemui") {
            return
        }

        Logger.i("=== LSPosed Gateway Active: Entered target [com.android.systemui] ===")
        Logger.d("Process Name: ${lpparam.processName}")

        // Hooks loading wrapper
        try {
            Logger.i("Universal Device-Agnostic Statusbar Island hook starting...")
            
            // ⚠️ CRITICAL SAFETY: Non-AOSP ROMs or device-specific variations crash avoid karne ke liye
            // Class existence dynamically runtime pe check karein.
            val statusBarViewClass = XposedHelpers.findClassIfExists(
                "com.android.systemui.statusbar.phone.PhoneStatusBarView",
                lpparam.classLoader
            )
            
            if (statusBarViewClass != null) {
                Logger.i("Found PhoneStatusBarView. Injecting status bar pill engine...")
                XposedHelpers.findAndHookMethod(
                    statusBarViewClass,
                    "onAttachedToWindow",
                    object : XC_MethodHook() {
                        override fun afterHookedMethod(param: MethodHookParam) {
                            try {
                                val statusBarView = param.thisObject as android.view.ViewGroup
                                val context = statusBarView.context
                                Logger.d("PhoneStatusBarView onAttachedToWindow loaded. Initializing WindowManager IslandOverlay overlay...")
                                
                                statusBarView.post {
                                    try {
                                        // Instantiate the IslandOverlay helper
                                        val overlay = IslandOverlay(context)
                                        overlay.showIsland("Universal Island Active 🌴")
                                        Logger.i("WindowManager Floating Island overlay rendered successfully over statusbar!")
                                    } catch (ex: Throwable) {
                                        Logger.e("Failed to inject WindowManager IslandOverlay", ex)
                                    }
                                }
                            } catch (t: Throwable) {
                                Logger.e("Safe Hooking: PhoneStatusBarView.onAttachedToWindow crashed but swallowed!", t)
                            }
                        }
                    }
                )
            } else {
                Logger.e("PhoneStatusBarView Class not found on this device firmware. Attempting notification listener fallback.")
            }

            // Universal Interceptor for Notifications (Heads-Up) to trigger dynamic island updates
            val headsUpManagerClass = XposedHelpers.findClassIfExists(
                "com.android.systemui.statusbar.policy.HeadsUpManager",
                lpparam.classLoader
            )
            if (headsUpManagerClass != null) {
                Logger.i("Found HeadsUpManager. Listening to universal Heads-Up events to dispatch to overlay...")
                XposedHelpers.findAndHookMethod(
                    headsUpManagerClass,
                    "showNotification",
                    "com.android.systemui.statusbar.notification.collection.NotificationEntry",
                    object : XC_MethodHook() {
                        override fun afterHookedMethod(param: MethodHookParam) {
                            try {
                                val entry = param.args[0]
                                val sbn = XposedHelpers.getObjectField(entry, "mSbn")
                                val pkg = XposedHelpers.callMethod(sbn, "getPackageName") as String
                                
                                // Check if package is blacklisted using XSharedPreferences
                                val prefs = try {
                                    de.robv.android.xposed.XSharedPreferences("com.android.island", "island_settings")
                                } catch (e: Exception) {
                                    null
                                }
                                prefs?.reload()
                                val blacklistAppsStr = prefs?.getString("blacklist_apps", "com.android.settings,com.android.keyguard") ?: ""
                                val blacklistSet = blacklistAppsStr.split(",").map { it.trim() }.toSet()
                                if (blacklistSet.contains(pkg)) {
                                    Logger.d("Ignoring blacklisted app notification: $pkg")
                                    return
                                }
                                val notification = XposedHelpers.getObjectField(sbn, "notification") as? android.app.Notification
                                val extras = notification?.extras
                                
                                // 1. Extract Title and Body content safely
                                val title = extras?.getCharSequence("android.title")?.toString() ?: "Notification"
                                val text = extras?.getCharSequence("android.text")?.toString() 
                                    ?: extras?.getCharSequence("android.bigText")?.toString() 
                                    ?: "Touch to view alert details"
                                
                                Logger.i("Notification intercepted from: $pkg. Dispatching rich overlay notice!")
                                
                                val context = XposedHelpers.getObjectField(param.thisObject, "mContext") as? android.content.Context
                                if (context != null) {
                                    // 2. Load Album Art if present, else fallback to high-res package icon
                                    val largeIcon = extras?.getParcelable<android.graphics.Bitmap>("android.largeIcon") 
                                        ?: extras?.getParcelable<android.graphics.Bitmap>("android.picture")
                                    val appIcon = if (largeIcon != null) {
                                        android.graphics.drawable.BitmapDrawable(context.resources, largeIcon)
                                    } else {
                                        try {
                                            context.packageManager.getApplicationIcon(pkg)
                                        } catch (e: Exception) {
                                            null
                                        }
                                    }
                                    
                                    // 3. Extract ongoing and progress metadata (Android 15/16 style progress styles & ongoing flags)
                                    val isOngoing = if (notification != null) {
                                        val isOngoingFlag = (notification.flags and android.app.Notification.FLAG_ONGOING_EVENT) != 0
                                        val isForegroundFlag = (notification.flags and android.app.Notification.FLAG_FOREGROUND_SERVICE) != 0
                                        isOngoingFlag || isForegroundFlag
                                    } else {
                                        false
                                    }

                                    val progressMax = extras?.getInt("android.progressMax", 0) ?: 0
                                    val progressVal = extras?.getInt("android.progress", 0) ?: 0
                                    val progressPct = if (progressMax > 0) (progressVal * 100) / progressMax else -1
                                    
                                    // Detect if notification is music/media session related
                                    val isMediaSession = extras?.getParcelable<android.os.Parcelable>("android.mediaSession") != null
                                    val isMusicCategory = (notification?.category == "transport" || notification?.category == "service")
                                    val isMusicPkg = pkg.contains("spotify") || pkg.contains("music") || pkg.contains("youtube") || pkg.contains("soundcloud") || pkg.contains("walkman")
                                    val isMusic = isMediaSession || isMusicCategory || isMusicPkg
                                    
                                    // 4. Instantiate Overlay and dispatch via IslandNotificationInterface
                                    val overlay: IslandNotificationInterface = IslandOverlay(context)
                                    overlay.onNotificationReceived(appIcon, title, text, isOngoing, progressPct, isMusic)
                                }
                            } catch (t: Throwable) {
                                Logger.e("Safe Hooking: HeadsUpManager showNotification crashed but swallowed!", t)
                            }
                        }
                    }
                )
            }
        } catch (e: Exception) {
            Logger.e("Failed to initialize LSPosed hook gateway", e)
        }
    }
}