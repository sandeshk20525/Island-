import { GeneratorConfig, GeneratedFile } from '../types';

export function generateFiles(config: GeneratorConfig): GeneratedFile[] {
  const {
    packageName,
    targetPackage,
    className,
    loggerTag,
    moduleName,
    moduleDesc,
    minXposedVersion,
    hookExample
  } = config;

  const files: GeneratedFile[] = [];

  // 1. Logger.kt
  const loggerContent = `package ${packageName}

import android.util.Log
import de.robv.android.xposed.XposedBridge

/**
 * Custom Logger to print logs to both Android Logcat and LSPosed Manager.
 * 'Island-Log' ya aapka custom tag use karke easily filter karein: "adb logcat -s ${loggerTag}"
 */
object Logger {
    private const val TAG = "${loggerTag}"

    // Logcat standard logging
    fun d(message: String) {
        Log.d(TAG, message)
        // LSPosed log manager file mein bhi likhega
        XposedBridge.log("[$TAG] DEBUG: $message")
    }

    fun e(message: String, throwable: Throwable? = null) {
        Log.e(TAG, message, throwable)
        XposedBridge.log("[$TAG] ERROR: $message \${throwable?.localizedMessage ?: ""}")
    }

    fun i(message: String) {
        Log.i(TAG, message)
        XposedBridge.log("[$TAG] INFO: $message")
    }
}`;

  files.push({
    name: 'Logger.kt',
    path: `app/src/main/java/${packageName.replace(/\./g, '/')}/Logger.kt`,
    language: 'kotlin',
    content: loggerContent,
    description: 'Custom logging utility ensuring messages go to both standard Android Logcat and the LSPosed Installer Log view.'
  });

  // 1b. NotchDetector.kt
  const notchDetectorContent = `package ${packageName}

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
                            Logger.d("DisplayCutout detected! Position: \${topCutout.toShortString()}")
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
            Logger.i("No DisplayCutout found. Using centered statusbar fallback coordinates: \${fallbackRect.toShortString()}")
            return fallbackRect
        } catch (e: Exception) {
            Logger.e("Error calculating fallback notch coordinates", e)
            // Ultimate hardcoded fallback
            return Rect(450, 10, 630, 90)
        }
    }
}`;

  files.push({
    name: 'NotchDetector.kt',
    path: `app/src/main/java/${packageName.replace(/\./g, '/')}/NotchDetector.kt`,
    language: 'kotlin',
    content: notchDetectorContent,
    description: 'Android DisplayCutout helper querying screen geometry at runtime to detect precise camera pinhole notches in Android 14/15/16.'
  });

  // 1c. IslandOverlay.kt
  const islandOverlayContent = `package ${packageName}

import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.transition.AutoTransition
import android.transition.TransitionManager
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.PathInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Interface for Dispatching Notifications safely to our active floating Island overlay view.
 */
interface IslandNotificationInterface {
    fun onNotificationReceived(icon: Drawable?, title: String, text: String, isOngoing: Boolean, progress: Int, isMusic: Boolean = false)
}

/**
 * Item representing a notification in our queue, with priority logic.
 */
data class NotificationItem(
    val icon: Drawable?,
    val title: String,
    val text: String,
    val isOngoing: Boolean,
    val progress: Int,
    val priority: Int,
    val isMusic: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
) : Comparable<NotificationItem> {
    override fun compareTo(other: NotificationItem): Int {
        // High priority first. If same priority, oldest first.
        if (this.priority != other.priority) {
            return other.priority.compareTo(this.priority)
        }
        return this.timestamp.compareTo(other.timestamp)
    }
}

/**
 * Priority-based Notification Queue Manager.
 * Ensures notifications are shown sequentially and high-priority alerts jump the line.
 */
object NotificationQueueManager {
    private val queue = java.util.PriorityQueue<NotificationItem>()
    private var isDisplaying = false

    @Synchronized
    fun enqueue(icon: Drawable?, title: String, text: String, isOngoing: Boolean, progress: Int, isMusic: Boolean, context: Context) {
        val priority = getPriority(title, text)
        val item = NotificationItem(icon, title, text, isOngoing, progress, priority, isMusic)
        queue.add(item)
        Logger.d("Notification queued: " + title + " with priority " + priority + ". Queue size: " + queue.size)
        processNext(context)
    }

    private fun getPriority(title: String, text: String): Int {
        val combined = (title + " " + text).toLowerCase()
        return when {
            combined.contains("call") || combined.contains("dialer") || combined.contains("incoming") -> 10 // Highest Priority
            combined.contains("alarm") || combined.contains("emergency") || combined.contains("urgent") -> 5  // Medium High
            combined.contains("message") || combined.contains("whatsapp") || combined.contains("chat") -> 2   // Medium
            else -> 0 // Normal/Low Priority
        }
    }

    @Synchronized
    fun processNext(context: Context) {
        if (isDisplaying) {
            Logger.d("QueueManager: Active notification on screen. Delaying queue processing.")
            return
        }
        val nextItem = queue.poll()
        if (nextItem != null) {
            isDisplaying = true
            Logger.i("QueueManager: Displaying next notification from queue: " + nextItem.title)
            // Create a temporary handler to post to the main thread
            Handler(Looper.getMainLooper()).post {
                val overlay = IslandOverlay(context)
                overlay.showIsland(
                    nextItem.icon,
                    nextItem.title,
                    nextItem.text,
                    nextItem.isOngoing,
                    nextItem.progress,
                    nextItem.isMusic
                )
            }
        } else {
            Logger.d("QueueManager: Notification queue is currently empty.")
        }
    }

    @Synchronized
    fun onIslandDismissed(context: Context) {
        isDisplaying = false
        Logger.d("QueueManager: Island dismissed. Checking for queued notifications...")
        // Delay processing the next notification slightly to allow smooth transition back to state
        Handler(Looper.getMainLooper()).postDelayed({
            processNext(context)
        }, 400)
    }
}

/**
 * IslandOverlay helper to dynamically inject a custom floating window directly
 * over the Status Bar using WindowManager.
 * This approach is extremely robust and ROM-agnostic compared to modifying MIUI system resources.
 * Contains fluid morphing animations, custom Bezier curve bouncing, ongoing progress bars, and auto-dismiss handler.
 */
class IslandOverlay(private val context: Context) : IslandNotificationInterface {

    companion object {
        private var overlayViewRef: java.lang.ref.WeakReference<FrameLayout>? = null
        var overlayView: FrameLayout?
            get() = overlayViewRef?.get()
            set(value) {
                overlayViewRef = value?.let { java.lang.ref.WeakReference(it) }
            }
        var currentAnimator: ValueAnimator? = null
        var isLargeState = false
        val handler = Handler(Looper.getMainLooper())
        var autoDismissRunnable: Runnable? = null
        var activeTitle: String? = null
        var activeIsOngoing = false
        var activeIsMusic = false
        var visualizerAnimator: ValueAnimator? = null
    }

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var isMusic = false

    override fun onNotificationReceived(icon: Drawable?, title: String, text: String, isOngoing: Boolean, progress: Int, isMusic: Boolean) {
        // If the same notification is already active, update its content in-place (handles progress bar and message updates)
        if (overlayView != null && activeTitle == title) {
            Logger.d("Same notification active ('" + title + "'). Updating in-place directly.")
            updateContent(icon, title, text, isOngoing, progress)
            if (!isOngoing) {
                scheduleAutoDismiss()
            } else {
                autoDismissRunnable?.let { handler.removeCallbacks(it) }
            }
            return
        }

        // Send to Queue Manager for sequential, priority-based handling
        Logger.i("New notification received: '" + title + "'. Sending to Priority Queue Manager.")
        NotificationQueueManager.enqueue(icon, title, text, isOngoing, progress, isMusic, context)
    }

    /**
     * Overloaded helper for backward compatibility to easily test state changes.
     */
    fun showIsland(title: String) {
        showIsland(null, title, "System active overlay monitor", false, -1, false)
    }

    /**
     * Injects the dynamic island floating view into the WindowManager layout pipeline
     * and triggers a fluid spring animation from collapsed cutout to expanded state.
     * Wrapped in high-security try-catch to protect SystemUI from any potential crash.
     */
    fun showIsland(icon: Drawable?, title: String, textContent: String, isOngoing: Boolean = false, progress: Int = -1, isMusic: Boolean = false) {
        try {
            showIslandSafe(icon, title, textContent, isOngoing, progress, isMusic)
        } catch (t: Throwable) {
            Logger.e("Fatal crash caught in showIsland gateway! Dismissing views to protect SystemUI.", t)
            dismissIsland()
        }
    }

    private fun showIslandSafe(icon: Drawable?, title: String, textContent: String, isOngoing: Boolean = false, progress: Int = -1, isMusic: Boolean = false) {
        // Cancel active animators to avoid concurrent transition collisions
        currentAnimator?.cancel()
        currentAnimator = null
        isLargeState = false
        activeTitle = title
        activeIsOngoing = isOngoing
        activeIsMusic = isMusic
        this.isMusic = isMusic

        if (overlayView != null) {
            updateContent(icon, title, textContent, isOngoing, progress)
            if (!isOngoing) {
                scheduleAutoDismiss()
            } else {
                // If it is ongoing, cancel any scheduled auto-dismiss to keep it persistent
                autoDismissRunnable?.let { handler.removeCallbacks(it) }
            }
            return
        }

        try {
            // Read settings dynamically using XSharedPreferences
            val prefs = try {
                de.robv.android.xposed.XSharedPreferences("${packageName}", "island_settings")
            } catch (e: Exception) {
                null
            }
            prefs?.reload()
            val xOffset = prefs?.getInt("island_x_offset", 0) ?: 0
            val yOffset = prefs?.getInt("island_y_offset", 0) ?: 0
            val islandColorStr = prefs?.getString("island_color", "#000000") ?: "#000000"
            val useMonet = prefs?.getBoolean("use_monet", true) ?: true
            val hideOnLandscape = prefs?.getBoolean("hide_on_landscape", true) ?: true

            var islandColor = try {
                Color.parseColor(islandColorStr)
            } catch (e: Exception) {
                Color.BLACK
            }

            var titleTextColor = Color.WHITE
            var contentTextColor = Color.parseColor("#E4E4E7") // zinc-200
            var accentColor = Color.parseColor("#10B981") // default Emerald

            // Material You (Monet) Dynamic Coloring extracted from system wallpaper resources
            if (useMonet && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                try {
                    // ContextThemeWrapper dynamically applies the system wallpaper color palette matching SystemUI's theme
                    val themeWrapper = android.view.ContextThemeWrapper(context, android.R.style.Theme_DeviceDefault_DayNight)
                    val res = themeWrapper.resources
                    
                    // system_neutral1_900 is the dark backdrop extracted from wallpaper for deep backgrounds
                    islandColor = res.getColor(android.R.color.system_neutral1_900, themeWrapper.theme)
                    // system_accent1_200 is a gorgeous light accent color matching the wallpaper hue
                    titleTextColor = res.getColor(android.R.color.system_accent1_200, themeWrapper.theme)
                    // system_neutral1_300 provides secondary text styled elegantly with the current color scheme
                    contentTextColor = res.getColor(android.R.color.system_neutral1_300, themeWrapper.theme)
                    // system_accent1_300 provides the perfect dynamic highlight accent
                    accentColor = res.getColor(android.R.color.system_accent1_300, themeWrapper.theme)
                    Logger.i("Material You (Monet) colors resolved dynamically from wallpaper. BG: \$islandColor")
                } catch (t: Throwable) {
                    Logger.e("Failed to extract Monet colors from ContextThemeWrapper. Using fallback.", t)
                }
            }

            // Get Notch/Cutout bounds to position the overlay perfectly
            val notchRect = NotchDetector.getNotchBounds(context)
            val notchWidth = notchRect.width()
            val notchHeight = notchRect.height()

            // 1. Define initial "Collapsed/Small" states
            val collapsedWidth = if (notchWidth > 0) notchWidth else 160
            val collapsedHeight = if (notchHeight > 0) notchHeight else 90
            val topMargin = (if (notchRect.top > 0) notchRect.top + 5 else 10) + yOffset

            // 2. Define target "Expanded" state sizes around the notch (Extra height for progress bar if ongoing)
            val expandedWidth = if (notchWidth > 0) (notchWidth * 1.85).toInt() else 420
            val expandedHeight = if (notchHeight > 0) {
                if (isOngoing && progress >= 0) notchHeight + 52 else notchHeight + 40
            } else {
                if (isOngoing && progress >= 0) 140 else 125
            }

            // Initialize custom FrameLayout with dynamically hooked orientation changed events
            val rootLayout = object : FrameLayout(context) {
                override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
                    super.onConfigurationChanged(newConfig)
                    try {
                        val wmParams = layoutParams as? WindowManager.LayoutParams
                        if (wmParams != null) {
                            if (newConfig.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE) {
                                if (hideOnLandscape) {
                                    Logger.i("LSPosed Orientation Handler: Landscape mode detected. Hiding dynamic island view.")
                                    visibility = View.GONE
                                } else {
                                    Logger.i("LSPosed Orientation Handler: Landscape mode detected. Repositioning to landscape center top.")
                                    visibility = View.VISIBLE
                                    wmParams.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                                    wmParams.y = 8
                                    wmParams.x = 0
                                    windowManager.updateViewLayout(this, wmParams)
                                }
                            } else {
                                Logger.i("LSPosed Orientation Handler: Portrait mode restored. Showing dynamic island view.")
                                visibility = View.VISIBLE
                                wmParams.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                                wmParams.y = topMargin
                                wmParams.x = xOffset
                                windowManager.updateViewLayout(this, wmParams)
                            }
                        }
                    } catch (e: Exception) {
                        Logger.e("onConfigurationChanged safe callback error", e)
                    }
                }
            }.apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = (collapsedHeight / 2).toFloat()
                    setColor(islandColor)
                }
                alpha = 0.95f
            }

            // Vertical wrapper holding top content and bottom actions
            val mainContainer = LinearLayout(context).apply {
                id = View.generateViewId()
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                layoutParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                ).apply {
                    setPadding(30, 20, 30, 20)
                }
            }

            // Horizontal container inside the rounded pill
            val contentLayout = LinearLayout(context).apply {
                id = View.generateViewId()
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                alpha = 0f // Start hidden, fade-in during morphing
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }

            // ImageView for App Icon
            val iconView = ImageView(context).apply {
                id = View.generateViewId()
                layoutParams = LinearLayout.LayoutParams(65, 65).apply {
                    marginEnd = 18
                }
                scaleType = ImageView.ScaleType.FIT_CENTER
                if (icon != null) {
                    setImageDrawable(icon)
                } else {
                    val dotDrawable = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor("#10B981")) // emerald-500
                    }
                    setImageDrawable(dotDrawable)
                }
            }
            contentLayout.addView(iconView)

            // Text layout holding Title, Description and Progress bar if needed
            val textLayout = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1.0f
                )
            }

            val titleView = TextView(context).apply {
                id = View.generateViewId()
                text = title
                setTextColor(titleTextColor)
                textSize = 10f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }

            val subtitleView = TextView(context).apply {
                id = View.generateViewId()
                text = textContent
                setTextColor(contentTextColor)
                textSize = 8.5f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }

            textLayout.addView(titleView)
            textLayout.addView(subtitleView)

            // Dynamic progress bar if it's an ongoing download/activity
            val progressBar = android.widget.ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                id = View.generateViewId()
                max = 100
                setProgress(if (progress >= 0) progress else 0)
                visibility = if (isOngoing && progress >= 0) View.VISIBLE else View.GONE
                progressDrawable?.setTint(accentColor)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    8
                ).apply {
                    topMargin = 10
                }
            }
            textLayout.addView(progressBar)

            contentLayout.addView(textLayout)

            if (isMusic) {
                val visualizerLayout = LinearLayout(context).apply {
                    id = View.generateViewId()
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL or Gravity.BOTTOM
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        45
                    ).apply {
                        marginStart = 12
                    }
                }
                val bar1 = View(context).apply {
                    background = GradientDrawable().apply {
                        setColor(accentColor)
                        cornerRadius = 4f
                    }
                    layoutParams = LinearLayout.LayoutParams(5, 18).apply { marginEnd = 4 }
                }
                val bar2 = View(context).apply {
                    background = GradientDrawable().apply {
                        setColor(accentColor)
                        cornerRadius = 4f
                    }
                    layoutParams = LinearLayout.LayoutParams(5, 32).apply { marginEnd = 4 }
                }
                val bar3 = View(context).apply {
                    background = GradientDrawable().apply {
                        setColor(accentColor)
                        cornerRadius = 4f
                    }
                    layoutParams = LinearLayout.LayoutParams(5, 12).apply { marginEnd = 4 }
                }
                visualizerLayout.addView(bar1)
                visualizerLayout.addView(bar2)
                visualizerLayout.addView(bar3)
                contentLayout.addView(visualizerLayout)

                // Animate bars using ValueAnimator
                visualizerAnimator = ValueAnimator.ofFloat(0.1f, 1.0f).apply {
                    duration = 550
                    repeatCount = ValueAnimator.INFINITE
                    repeatMode = ValueAnimator.REVERSE
                    addUpdateListener { anim ->
                        val fraction = anim.animatedValue as Float
                        bar1.layoutParams.height = (12 + (18 * fraction)).toInt()
                        bar2.layoutParams.height = (32 - (22 * fraction)).toInt()
                        bar3.layoutParams.height = (8 + (16 * fraction)).toInt()
                        bar1.requestLayout()
                        bar2.requestLayout()
                        bar3.requestLayout()
                    }
                }
                visualizerAnimator?.start()
            }

            // Quick Actions Container (Shown in Large State only)
            val actionsLayout = LinearLayout(context).apply {
                id = View.generateViewId()
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
                visibility = View.GONE // Hidden initially, shown in Large state
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 25
                }
            }

            var isPlayingState = true

            val playPauseButton = TextView(context).apply {
                id = View.generateViewId()
                text = "⏸ Pause"
                setTextColor(Color.WHITE)
                textSize = 9.5f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setPadding(40, 12, 40, 12)
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 24f
                    setColor(Color.parseColor("#10B981")) // emerald-500
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = 16
                }
                setOnClickListener {
                    Logger.i("Music Control: Play/Pause toggled!")
                    isPlayingState = !isPlayingState
                    if (isPlayingState) {
                        text = "⏸ Pause"
                        visualizerAnimator?.start()
                    } else {
                        text = "▶ Play"
                        visualizerAnimator?.cancel()
                    }
                    try {
                        val am = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
                        val eventTime = android.os.SystemClock.uptimeMillis()
                        am.dispatchMediaKeyEvent(android.view.KeyEvent(eventTime, eventTime, android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, 0))
                        am.dispatchMediaKeyEvent(android.view.KeyEvent(eventTime, eventTime, android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, 0))
                    } catch (e: Exception) {
                        Logger.e("Failed to dispatch media key play/pause", e)
                    }
                }
            }

            val nextButton = TextView(context).apply {
                id = View.generateViewId()
                text = "⏭ Next"
                setTextColor(Color.parseColor("#9CA3AF")) // gray-400
                textSize = 9.5f
                setPadding(40, 12, 40, 12)
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 24f
                    setColor(Color.parseColor("#374151")) // gray-700
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                setOnClickListener {
                    Logger.i("Music Control: Next song clicked!")
                    try {
                        val am = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
                        val eventTime = android.os.SystemClock.uptimeMillis()
                        am.dispatchMediaKeyEvent(android.view.KeyEvent(eventTime, eventTime, android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_MEDIA_NEXT, 0))
                        am.dispatchMediaKeyEvent(android.view.KeyEvent(eventTime, eventTime, android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_MEDIA_NEXT, 0))
                    } catch (e: Exception) {
                        Logger.e("Failed to dispatch media key next", e)
                    }
                }
            }

            val replyButton = TextView(context).apply {
                text = "Reply"
                setTextColor(Color.WHITE)
                textSize = 9.5f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setPadding(40, 12, 40, 12)
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 24f
                    setColor(Color.parseColor("#10B981")) // emerald-500
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = 16
                }
                setOnClickListener {
                    Logger.i("Quick Action: Reply clicked!")
                    shrinkAndDismiss()
                }
            }

            val muteButton = TextView(context).apply {
                text = "Mute"
                setTextColor(Color.parseColor("#9CA3AF")) // gray-400
                textSize = 9.5f
                setPadding(40, 12, 40, 12)
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 24f
                    setColor(Color.parseColor("#374151")) // gray-700
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                setOnClickListener {
                    Logger.i("Quick Action: Mute clicked!")
                    shrinkAndDismiss()
                }
            }

            if (isMusic) {
                actionsLayout.addView(playPauseButton)
                actionsLayout.addView(nextButton)
            } else {
                actionsLayout.addView(replyButton)
                actionsLayout.addView(muteButton)
            }

            // Assemble nested view hierarchy
            mainContainer.addView(contentLayout)
            mainContainer.addView(actionsLayout)
            rootLayout.addView(mainContainer)

            // 4. Interactive touch & morph listeners for expansion/launch
            rootLayout.isClickable = true
            rootLayout.isLongClickable = true

            rootLayout.setOnClickListener {
                try {
                    isLargeState = !isLargeState
                    Logger.i("Single tap detected on Dynamic Island! Toggling Large state: $isLargeState")

                    // Apply layout transitions cleanly without jarring layouts
                    TransitionManager.beginDelayedTransition(rootLayout, AutoTransition())

                    val currentParams = rootLayout.layoutParams as WindowManager.LayoutParams
                    if (isLargeState) {
                        // Cancel auto dismiss handler so users have enough time to interact with actions
                        autoDismissRunnable?.let { handler.removeCallbacks(it) }

                        // Expand to Large state coordinates
                        currentParams.width = if (notchWidth > 0) (notchWidth * 2.3).toInt() else 480
                        currentParams.height = if (notchHeight > 0) {
                            if (isMusic) notchHeight + 145 else notchHeight + 120
                        } else {
                            if (isMusic) 245 else 220
                        }
                        actionsLayout.visibility = View.VISIBLE
                    } else {
                        // Shrink back to regular expanded state coordinates
                        currentParams.width = expandedWidth
                        currentParams.height = expandedHeight
                        actionsLayout.visibility = View.GONE

                        // Reschedule normal auto-dismiss sequence
                        if (!isOngoing) {
                            scheduleAutoDismiss()
                        }
                    }
                    windowManager.updateViewLayout(rootLayout, currentParams)
                    (rootLayout.background as? GradientDrawable)?.cornerRadius = (currentParams.height / 2).toFloat()
                } catch (e: Exception) {
                    Logger.e("TransitionManager failed to morph island into Large size state", e)
                }
            }

            rootLayout.setOnLongClickListener {
                try {
                    Logger.i("Long press detected on Dynamic Island! Launching parent app context...")
                    val launchIntent = context.packageManager.getLaunchIntentForPackage("com.android.settings")
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(launchIntent)
                    }
                } catch (e: Exception) {
                    Logger.e("Failed to execute long click launcher application transition", e)
                }
                true
            }

            // Layout Params at WindowManager starting with Collapsed Size
            val params = WindowManager.LayoutParams(
                collapsedWidth,
                collapsedHeight,
                WindowManager.LayoutParams.TYPE_STATUS_BAR_PANEL,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                y = topMargin
                x = xOffset
            }

            windowManager.addView(rootLayout, params)
            overlayView = rootLayout
            Logger.i("WindowManager overlay initialized at collapsed state: \${collapsedWidth}x\${collapsedHeight}")

            // 3. Smooth Morphing expand animation with Apple-like Fluid Spring Bezier
            morphPill(
                fromW = collapsedWidth,
                toW = expandedWidth,
                fromH = collapsedHeight,
                toH = expandedHeight,
                contentAlphaFrom = 0f,
                contentAlphaTo = 1f,
                durationMs = 450
            ) {
                Logger.i("Dynamic Island fully expanded and morph transition complete! Ongoing: \$isOngoing")
                if (!isOngoing) {
                    scheduleAutoDismiss()
                }
            }

        } catch (e: Exception) {
            Logger.e("WindowManager overlay injection failed. Trying TYPE_APPLICATION_OVERLAY fallback...", e)
            try {
                // Alternative fallback if statusbar panel levels are constrained
                val fallbackParams = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    110,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    y = 15
                }
                val fallbackView = FrameLayout(context).apply {
                    background = GradientDrawable().apply {
                        cornerRadius = 55f
                        setColor(Color.BLACK)
                    }
                }
                windowManager.addView(fallbackView, fallbackParams)
                overlayView = fallbackView
                Logger.i("WindowManager fallback application overlay successful!")
                if (!isOngoing) {
                    scheduleAutoDismiss()
                }
            } catch (ex: Exception) {
                Logger.e("Ultimate overlay injection crash", ex)
            }
        }
    }

    /**
     * Morphing function applying Custom PathInterpolator to animate overlay window boundaries smoothly.
     */
    private fun morphPill(
        fromW: Int,
        toW: Int,
        fromH: Int,
        toH: Int,
        contentAlphaFrom: Float,
        contentAlphaTo: Float,
        durationMs: Long,
        onEnd: (() -> Unit)? = null
    ) {
        val view = overlayView ?: return
        val mainContainer = view.getChildAt(0) as? LinearLayout
        val contentLayout = mainContainer?.getChildAt(0) as? LinearLayout

        currentAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = durationMs
            // Custom PathInterpolator representing a beautiful Apple-like Fluid Elastic Spring curve
            // Starts with rapid expansion and settles with a soft bounce-back
            interpolator = PathInterpolator(0.25f, 1f, 0.2f, 1.15f)
            
            addUpdateListener { anim ->
                val fraction = anim.animatedValue as Float
                val w = (fromW + (toW - fromW) * fraction).toInt()
                val h = (fromH + (toH - fromH) * fraction).toInt()
                val alphaVal = contentAlphaFrom + (contentAlphaTo - contentAlphaFrom) * fraction

                try {
                    val params = view.layoutParams as? WindowManager.LayoutParams
                    if (params != null) {
                        params.width = w
                        params.height = h
                        windowManager.updateViewLayout(view, params)
                    }
                    (view.background as? GradientDrawable)?.cornerRadius = (h / 2).toFloat()
                    contentLayout?.alpha = alphaVal
                } catch (e: Exception) {
                    // Fail-safe catch for rapid context updates
                }
            }
            
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    onEnd?.invoke()
                }
            })
            start()
        }
    }

    /**
     * Resets or sets the 5-second auto-dismiss handler trigger.
     */
    private fun scheduleAutoDismiss() {
        autoDismissRunnable?.let { handler.removeCallbacks(it) }
        autoDismissRunnable = Runnable {
            shrinkAndDismiss()
        }
        handler.postDelayed(autoDismissRunnable!!, 5000)
    }

    /**
     * Shrinks the island smoothly before dismantling the view hierarchy to avoid jarring transitions.
     */
    fun shrinkAndDismiss() {
        val view = overlayView ?: return
        currentAnimator?.cancel()

        // Get Notch/Cutout bounds or use generic small target
        val notchRect = NotchDetector.getNotchBounds(context)
        val notchWidth = notchRect.width()
        val notchHeight = notchRect.height()

        val collapsedWidth = if (notchWidth > 0) notchWidth else 160
        val collapsedHeight = if (notchHeight > 0) notchHeight else 90

        val currentW = view.width
        val currentH = view.height

        Logger.d("Initiating fluid shrink-back animation...")
        morphPill(
            fromW = currentW,
            toW = collapsedWidth,
            fromH = currentH,
            toH = collapsedHeight,
            contentAlphaFrom = 1f,
            contentAlphaTo = 0f,
            durationMs = 400
        ) {
            dismissIsland()
        }
    }

    /**
     * Dynamically updates the content elements inside the active island overlay.
     */
    fun updateContent(icon: Drawable?, title: String, textContent: String, isOngoing: Boolean = false, progress: Int = -1) {
        try {
            overlayView?.let { view ->
                // Locate subviews inside content layout hierarchy
                val mainContainer = view.getChildAt(0) as? LinearLayout
                val contentLayout = mainContainer?.getChildAt(0) as? LinearLayout
                if (contentLayout != null) {
                    val iconView = contentLayout.getChildAt(0) as? ImageView
                    val textLayout = contentLayout.getChildAt(1) as? LinearLayout
                    
                    if (iconView != null && icon != null) {
                        iconView.setImageDrawable(icon)
                    }
                    
                    if (textLayout != null) {
                        val titleView = textLayout.getChildAt(0) as? TextView
                        val subtitleView = textLayout.getChildAt(1) as? TextView
                        val progressBar = textLayout.getChildAt(2) as? android.widget.ProgressBar
                        
                        titleView?.text = title
                        subtitleView?.text = textContent
                        
                        if (progressBar != null) {
                            if (isOngoing && progress >= 0) {
                                progressBar.visibility = View.VISIBLE
                                progressBar.progress = progress
                            } else {
                                progressBar.visibility = View.GONE
                            }
                        }
                    }
                    Logger.d("Overlay content state dynamically updated: \$title - \$textContent (Ongoing: \$isOngoing, Progress: \$progress)")
                }
            }
        } catch (e: Exception) {
            Logger.e("Error updating overlay content state. Dismantling view to prevent stuck state.", e)
            dismissIsland()
        }
    }

    /**
     * Safely dismantles the dynamic island overlay from the screen context.
     * Clears all subviews, animators, and runnables to prevent memory leaks and protect SystemUI.
     */
    fun dismissIsland() {
        try {
            autoDismissRunnable?.let { handler.removeCallbacks(it) }
            autoDismissRunnable = null
            
            currentAnimator?.cancel()
            currentAnimator = null
            
            visualizerAnimator?.cancel()
            visualizerAnimator = null
            
            overlayView?.let { view ->
                view.visibility = View.GONE // Ensure it is fully GONE to prevent any layout passes or CPU cycles in the background
                view.removeAllViews() // Free reference to all child views and nested view states
                try {
                    windowManager.removeView(view)
                } catch (e: Exception) {
                    Logger.e("WindowManager removeView failed, maybe already removed or invalid", e)
                }
                overlayView = null
                Logger.i("Dynamic Island Overlay removed successfully and memory resources cleared.")
                NotificationQueueManager.onIslandDismissed(context)
            }
        } catch (e: Exception) {
            Logger.e("Failed to safely dismiss dynamic island overlay and clean up resources", e)
        }
    }
}`;

  files.push({
    name: 'IslandOverlay.kt',
    path: `app/src/main/java/${packageName.replace(/\./g, '/')}/IslandOverlay.kt`,
    language: 'kotlin',
    content: islandOverlayContent,
    description: 'Bypasses specific ROM themes by creating a secure WindowManager Floating Overlay that handles status bar rendering layout parameters.'
  });

  // 2. XposedInit.kt
  let hookDetailKotlin = '';
  if (hookExample === 'statusbar') {
    hookDetailKotlin = `            Logger.i("Status Bar Clock Hook setup ho raha hai...")
            try {
                // Example: SystemUI status bar clock ya kisi dynamic method ko hook karna
                // Hum 'com.android.systemui.statusbar.phone.PhoneStatusBarView' ko target kar sakte hain
                XposedHelpers.findAndHookMethod(
                    "com.android.systemui.statusbar.phone.PhoneStatusBarView",
                    lpparam.classLoader,
                    "onAttachedToWindow",
                    object : XC_MethodHook() {
                        override fun beforeHookedMethod(param: MethodHookParam) {
                            Logger.d("PhoneStatusBarView onAttachedToWindow: Before method call")
                        }

                        override fun afterHookedMethod(param: MethodHookParam) {
                            Logger.i("PhoneStatusBarView onAttachedToWindow: SystemUI Status Bar loaded successfully!")
                        }
                    }
                )
            } catch (t: Throwable) {
                Logger.e("StatusBar hook lagane mein error aayi", t)
            }`;
  } else if (hookExample === 'volume') {
    hookDetailKotlin = `            Logger.i("Volume Panel Hook setup ho raha hai...")
            try {
                // Example: Target Volume Dialog controller
                XposedHelpers.findAndHookMethod(
                    "com.android.systemui.volume.VolumeDialogImpl",
                    lpparam.classLoader,
                    "showH",
                    Int::class.java, // trigger reason
                    object : XC_MethodHook() {
                        override fun beforeHookedMethod(param: MethodHookParam) {
                            Logger.d("VolumeDialogImpl.showH: Volume panel khulne se pehle trigger hua")
                        }
                    }
                )
            } catch (t: Throwable) {
                Logger.e("Volume hook fail ho gaya", t)
            }`;
  } else if (hookExample === 'universal_island') {
    hookDetailKotlin = `            Logger.i("Universal Device-Agnostic Statusbar Island hook starting...")
            
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
                                    de.robv.android.xposed.XSharedPreferences("${packageName}", "island_settings")
                                } catch (e: Exception) {
                                    null
                                }
                                prefs?.reload()
                                val blacklistAppsStr = prefs?.getString("blacklist_apps", "com.android.settings,com.android.keyguard") ?: ""
                                val blacklistSet = blacklistAppsStr.split(",").map { it.trim() }.toSet()
                                if (blacklistSet.contains(pkg)) {
                                    Logger.d("Ignoring blacklisted app notification: \$pkg")
                                    return
                                }
                                val notification = XposedHelpers.getObjectField(sbn, "notification") as? android.app.Notification
                                val extras = notification?.extras
                                
                                // 1. Extract Title and Body content safely
                                val title = extras?.getCharSequence("android.title")?.toString() ?: "Notification"
                                val text = extras?.getCharSequence("android.text")?.toString() 
                                    ?: extras?.getCharSequence("android.bigText")?.toString() 
                                    ?: "Touch to view alert details"
                                
                                Logger.i("Notification intercepted from: \$pkg. Dispatching rich overlay notice!")
                                
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
            }`;
  } else if (hookExample === 'hyper_island') {
    hookDetailKotlin = `            Logger.i("HyperOS Specific Reference Hooking (HyperIsland Spec) active...")
            
            // HyperOS/MIUI Specific classes which do not exist in plain AOSP or Pixel Experience ROMs
            val miuiStatusBarClass = XposedHelpers.findClassIfExists(
                "com.android.systemui.statusbar.phone.MiuiPhoneStatusBarView",
                lpparam.classLoader
            ) ?: XposedHelpers.findClassIfExists(
                "com.miui.systemui.statusbar.phone.PhoneStatusBarView",
                lpparam.classLoader
            )

            if (miuiStatusBarClass != null) {
                Logger.i("HyperOS Status Bar Class successfully intercepted!")
                XposedHelpers.findAndHookMethod(
                    miuiStatusBarClass,
                    "onFinishInflate",
                    object : XC_MethodHook() {
                        override fun afterHookedMethod(param: MethodHookParam) {
                            Logger.i("MiuiPhoneStatusBarView inflated. Hooking custom HyperOS layout parameters...")
                            // Yahan HyperOS ke specialized pill components ko expand / align kiya jata hai.
                        }
                    }
                )
            } else {
                Logger.e("MiuiPhoneStatusBarView Class not found! Is device par generic AOSP run ho raha hai, HyperOS nahi.")
            }`;
  } else {
    hookDetailKotlin = `            Logger.i("Base gateway setup successful! Ready to add custom hooks.")
            // Yahan aap apne custom classes ko classloader se load karke unke methods ko hook kar sakte hain:
            // XposedHelpers.findAndHookMethod("package.ClassName", lpparam.classLoader, "methodName", parameterTypes..., object : XC_MethodHook() { ... })`;
  }

  const xposedInitContent = `package ${packageName}

import de.robv.android.xposed.IXposedHookLoadPackage
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage

/**
 * LSPosed Module entry point.
 * 'xposed_init' file isi class ko target karegi.
 */
class ${className} : IXposedHookLoadPackage {

    @Throws(Throwable::class)
    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        // Sirf target package (SystemUI) ko filter karein
        if (lpparam.packageName != "${targetPackage}") {
            return
        }

        Logger.i("=== LSPosed Gateway Active: Entered target [${targetPackage}] ===")
        Logger.d("Process Name: \${lpparam.processName}")

        // Hooks loading wrapper
        try {
${hookDetailKotlin}
        } catch (e: Exception) {
            Logger.e("Failed to initialize LSPosed hook gateway", e)
        }
    }
}`;

  // 1d. SettingsActivity.kt
  const settingsActivityContent = `package ${packageName}

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.widget.EditText
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.view.Gravity
import android.view.View

/**
 * Companion Settings UI App for Dynamic Island custom positions, colors, and package blacklisting.
 */
class SettingsActivity : Activity() {

    private lateinit var prefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Use Device Protected Storage Context so LSPosed/Xposed can read the preference files
        val safeContext = try {
            createDeviceProtectedStorageContext()
        } catch (e: Exception) {
            this
        }
        
        prefs = safeContext.getSharedPreferences("island_settings", Context.MODE_PRIVATE)

        // Root programmatic container
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#121212")) // Dark theme
            setPadding(48, 48, 48, 48)
            gravity = Gravity.TOP
        }

        val titleView = TextView(this).apply {
            text = "🌴 Island Settings"
            setTextColor(Color.WHITE)
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 48
            }
        }
        rootLayout.addView(titleView)

        // Card helper function
        fun createCardSection(title: String, child: View): LinearLayout {
            val container = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(32, 32, 32, 32)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#1E1E1E"))
                    cornerRadius = 16f
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = 32
                }
            }
            val secTitle = TextView(this).apply {
                text = title
                setTextColor(Color.parseColor("#10B981")) // Emerald color
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = 16
                }
            }
            container.addView(secTitle)
            container.addView(child)
            return container
        }

        // X Offset Section
        val xLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val xLabel = TextView(this).apply {
            text = "Current X Offset: \${prefs.getInt("island_x_offset", 0)} px"
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 14f
        }
        val xSeekBar = SeekBar(this).apply {
            max = 200
            progress = prefs.getInt("island_x_offset", 0) + 100 // mapped [-100, 100]
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val actualVal = progress - 100
                    xLabel.text = "Current X Offset: \${actualVal} px"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                override fun onStopTrackingTouch(seekBar: SeekBar?) {}
            })
        }
        xLayout.addView(xSeekBar)
        xLayout.addView(xLabel)
        rootLayout.addView(createCardSection("Horizontal position (X-offset)", xLayout))

        // Y Offset Section
        val yLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val yLabel = TextView(this).apply {
            text = "Current Y Offset: \${prefs.getInt("island_y_offset", 0)} px"
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 14f
        }
        val ySeekBar = SeekBar(this).apply {
            max = 200
            progress = prefs.getInt("island_y_offset", 0) + 100 // mapped [-100, 100]
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val actualVal = progress - 100
                    yLabel.text = "Current Y Offset: \${actualVal} px"
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                override fun onStopTrackingTouch(seekBar: SeekBar?) {}
            })
        }
        yLayout.addView(ySeekBar)
        yLayout.addView(yLabel)
        rootLayout.addView(createCardSection("Vertical position (Y-offset)", yLayout))

        // Material You (Monet) Dynamic Coloring Section
        val monetLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val monetSwitch = Switch(this).apply {
            text = "Enable Material You (Monet) coloring"
            setTextColor(Color.WHITE)
            textSize = 14f
            isChecked = prefs.getBoolean("use_monet", true)
        }
        monetLayout.addView(monetSwitch)
        rootLayout.addView(createCardSection("Material You / Dynamic Theme", monetLayout))

        // Landscape & Orientation Handling Section
        val landscapeLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val landscapeSwitch = Switch(this).apply {
            text = "Hide Island in Landscape mode"
            setTextColor(Color.WHITE)
            textSize = 14f
            isChecked = prefs.getBoolean("hide_on_landscape", true)
        }
        val landscapeDesc = TextView(this).apply {
            text = "Hides the island view entirely during landscape orientation to avoid interrupting gaming or movies. If disabled, island shifts to the top edge center of landscape mode."
            setTextColor(Color.parseColor("#9CA3AF"))
            textSize = 11f
            setPadding(0, 8, 0, 0)
        }
        landscapeLayout.addView(landscapeSwitch)
        landscapeLayout.addView(landscapeDesc)
        rootLayout.addView(createCardSection("Landscape & Orientation Handling", landscapeLayout))

        // Island Color Section
        val colorInput = EditText(this).apply {
            setText(prefs.getString("island_color", "#000000"))
            setTextColor(Color.WHITE)
            textSize = 14f
            hint = "#000000"
            setHintTextColor(Color.GRAY)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#2D2D2D"))
                cornerRadius = 8f
            }
            setPadding(16, 16, 16, 16)
        }
        
        // Link switch checked state to disable/dim the custom Hex color box
        monetSwitch.setOnCheckedChangeListener { _, isChecked ->
            colorInput.isEnabled = !isChecked
            colorInput.alpha = if (isChecked) 0.5f else 1.0f
        }
        colorInput.isEnabled = !monetSwitch.isChecked
        colorInput.alpha = if (monetSwitch.isChecked) 0.5f else 1.0f
        
        rootLayout.addView(createCardSection("Custom Island Color (Hex)", colorInput))

        // Blacklisted Apps Section
        val blacklistInput = EditText(this).apply {
            setText(prefs.getString("blacklist_apps", "com.android.settings,com.android.keyguard"))
            setTextColor(Color.WHITE)
            textSize = 14f
            hint = "com.pkg1,com.pkg2"
            setHintTextColor(Color.GRAY)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#2D2D2D"))
                cornerRadius = 8f
            }
            setPadding(16, 16, 16, 16)
        }
        rootLayout.addView(createCardSection("Blacklisted App Package Names (Comma Separated)", blacklistInput))

        // Save Button
        val saveButton = Button(this).apply {
            text = "Save Settings"
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981"))
                cornerRadius = 12f
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 32
            }
            setOnClickListener {
                val editor = prefs.edit()
                val finalX = xSeekBar.progress - 100
                val finalY = ySeekBar.progress - 100
                val finalColor = colorInput.text.toString().trim()
                val finalBlacklist = blacklistInput.text.toString().trim()

                editor.putInt("island_x_offset", finalX)
                editor.putInt("island_y_offset", finalY)
                editor.putString("island_color", finalColor)
                editor.putBoolean("use_monet", monetSwitch.isChecked)
                editor.putBoolean("hide_on_landscape", landscapeSwitch.isChecked)
                editor.putString("blacklist_apps", finalBlacklist)
                editor.apply()

                Toast.makeText(this@SettingsActivity, "Settings Saved! No reboot required.", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
        rootLayout.addView(saveButton)

        val scrollView = ScrollView(this).apply {
            addView(rootLayout)
        }
        setContentView(scrollView)
    }
}
`;

  files.push({
    name: 'SettingsActivity.kt',
    path: `app/src/main/java/${packageName.replace(/\./g, '/')}/SettingsActivity.kt`,
    language: 'kotlin',
    content: settingsActivityContent,
    description: 'The companion Settings Activity App exposing position, custom background-color, and blacklist app customizations, persisted via device protected storage shared preferences.'
  });

  files.push({
    name: `${className}.kt`,
    path: `app/src/main/java/${packageName.replace(/\./g, '/')}/${className}.kt`,
    language: 'kotlin',
    content: xposedInitContent,
    description: 'The main entry point class implementing IXposedHookLoadPackage. This class interceptively filters processes and hooks into the targeted application process.'
  });

  // 3. AndroidManifest.xml
  const manifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${moduleName}"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault">

        <!-- 0. Companion Settings UI activity -->
        <activity
            android:name=".SettingsActivity"
            android:exported="true"
            android:theme="@android:style/Theme.DeviceDefault">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- 1. LSPosed Module Identification (Isse Android ko pata chalega ki ye ek Xposed module hai) -->
        <meta-data
            android:name="xposedmodule"
            android:value="true" />

        <!-- 2. Module Description jo LSPosed Manager app mein user ko dikhega -->
        <meta-data
            android:name="xposeddescription"
            android:value="${moduleDesc}" />

        <!-- 3. Minimum API Version support (Standard 82 or higher) -->
        <meta-data
            android:name="xposedminversion"
            android:value="${minXposedVersion}" />

        <!-- 4. Default Scope Selection for LSPosed (Stealth & Anti-Detection) -->
        <!-- This restricts loading of this module ONLY within com.android.systemui. -->
        <!-- No injection occurs in banking, financial or security apps, preventing any detections. -->
        <meta-data
            android:name="xposedscope"
            android:resource="@array/xposed_scopes" />

    </application>
</manifest>`;

  files.push({
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    content: manifestContent,
    description: 'Declares critical <meta-data> tags to announce to the Android OS and LSPosed Manager that this APK serves as a valid system instrumentation module.'
  });

  // 3b. res/values/arrays.xml (For LSPosed Scope list definition)
  const arraysContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string-array name="xposed_scopes">
        <item>${targetPackage}</item>
    </string-array>
</resources>`;

  files.push({
    name: 'arrays.xml',
    path: 'app/src/main/res/values/arrays.xml',
    language: 'xml',
    content: arraysContent,
    description: 'Declares the precise target application scopes for LSPosed module injection, isolating hooks exclusively to the target system package.'
  });

  // 4. xposed_init
  const xposedInitFileContent = `${packageName}.${className}\n`;

  files.push({
    name: 'xposed_init',
    path: 'app/src/main/assets/xposed_init',
    language: 'plaintext',
    content: xposedInitFileContent,
    description: 'Asset declaration file that tells LSPosed framework exactly which fully-qualified class implements the hook interfaces.'
  });

  // 5. build.gradle.kts
  const gradleContent = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${packageName}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${packageName}"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // ⚠️ CRITICAL: Use compileOnly for LSPosed API. Do NOT use implementation!
    // compileOnly use karne se LSPosed runtime APIs APK ke andar include nahi hote,
    // kyunki ye APIs device host system provide karega runtime pe.
    compileOnly("de.robv.android.xposed:api:82")

    // Android baseline libraries
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
}

repositories {
    google()
    mavenCentral()
    // Xposed APIs are hosted on Maven Central. No custom repositories are needed anymore.
}`;

  files.push({
    name: 'build.gradle.kts',
    path: 'app/build.gradle.kts',
    language: 'gradle',
    content: gradleContent,
    description: 'Gradle configuration containing build parameters. It ensures you use the correct "compileOnly" scope for Xposed APIs so that they are not incorrectly packed inside your final APK.'
  });

  // Top-level / Root Gradle Configs for complete standalone build setup
  const rootSettingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "${moduleName.replace(/\s+/g, '')}"
include(":app")
`;

  files.push({
    name: 'settings.gradle.kts',
    path: 'settings.gradle.kts',
    language: 'gradle',
    content: rootSettingsGradle,
    description: 'Root-level settings configuration file registering the ":app" module into the Android build tree.'
  });

  const rootBuildGradle = `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.3.1" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`;

  files.push({
    name: 'build.gradle.kts (Root)',
    path: 'build.gradle.kts',
    language: 'gradle',
    content: rootBuildGradle,
    description: 'Top-level build configuration file declaring versions for standard Android build tooling and Kotlin gradle compilers.'
  });

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
`;

  files.push({
    name: 'gradle.properties',
    path: 'gradle.properties',
    language: 'plaintext',
    content: gradleProperties,
    description: 'Standard JVM and compiler execution options to enable AndroidX compatibility and restrict transitive resource resolution.'
  });

  const gradleWrapperProperties = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

  files.push({
    name: 'gradle-wrapper.properties',
    path: 'gradle/wrapper/gradle-wrapper.properties',
    language: 'plaintext',
    content: gradleWrapperProperties,
    description: 'Gradle wrapper configuration setting the Gradle compilation environment to version 8.4.'
  });

  const gradlewScript = `#!/bin/sh

# Precise lightweight gradle launcher wrapper for Linux/macOS
# If standard gradle wrapper jar is missing, we redirect directly to local system gradle installation.

if [ -f "./gradle/wrapper/gradle-wrapper.jar" ]; then
    exec java -jar ./gradle/wrapper/gradle-wrapper.jar "$@"
else
    echo "Using system-wide gradle compiler to build..."
    exec gradle "$@"
fi
`;

  files.push({
    name: 'gradlew',
    path: 'gradlew',
    language: 'plaintext',
    content: gradlewScript,
    description: 'Portable launcher shell script allowing quick build runs on UNIX/macOS environments.'
  });

  const githubWorkflow = `name: Android CI/CD

on:
  push:
    branches: [ "main", "master", "dev" ]
  pull_request:
    branches: [ "main", "master", "dev" ]

jobs:
  build:
    name: Build & Package APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'
          cache: 'gradle'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3

      - name: Generate debug keystore
        run: keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"

      - name: Build Debug APK
        env:
          JAVA_TOOL_OPTIONS: "-Djava.awt.headless=true"
        run: gradle :app:assembleDebug --no-daemon

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${moduleName.replace(/\s+/g, '')}-Debug-APK
          path: app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
          retention-days: 7
`;

  files.push({
    name: 'build.yml',
    path: '.github/workflows/build.yml',
    language: 'plaintext',
    content: githubWorkflow,
    description: 'Complete GitHub Actions CI/CD pipeline automation configured exactly to build your customized hybrid Xposed APK on every push!'
  });

  // 6. README.md
  const readmeContent = `# LSPosed Module Gateway Setup (com.android.systemui)

Aapka LSPosed Module gateway boilerplate ready hai! Is boilerplate ke saath, aap \`${targetPackage}\` ke andarr koi bhi method hook kar sakte hain.

## GitHub Actions Automated Build Setup:
Is project boilerplate ke andar complete **GitHub Actions CI/CD Workflow** configure kiya gaya hai! GitHub repo par push karte hi automatic cloud pe APK generate ho jayega.

1. Download kiye gaye project folder ko apne local system pe extract karein.
2. GitHub par ek naya **Public** ya **Private** Repository banayein.
3. Apne local folder mein Git command terminal kholein aur ye steps run karein:
   \`\`\`bash
   git init
   git add .
   git commit -m "feat: setup LSPosed Hybrid Module with GitHub Actions CI/CD"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   \`\`\`
4. GitHub repository ke **Actions** tab par jayein!
5. GitHub Actions automatic runner active ho jayega aur Gradle compiler call karke APK build complete kar dega.
6. Build successfully end hone par workflow run ke niche artifacts panel se compiled APK download kar sakte hain!

## Local setup aur Manual Android Studio build:

1. **Android Studio Project**: Naya project banayein jisme Kotlin build script (\`build.gradle.kts\`) ho.
2. **File Paths**:
   - \`AndroidManifest.xml\` ko replace karein ya usme \`<meta-data>\` tags add karein.
   - \`app/src/main/assets/\` directory banayein aur uske andar \`xposed_init\` naam ki blank file (bina extension ke) banayein. Us file ke andar sirf ye single line daalein:
     \`\`\`text
     ${packageName}.${className}
     \`\`\`
   - Kotlin files ko unke specific package path (\`app/src/main/java/${packageName.replace(/\./g, '/')}/\`) par paste karein.
3. **Gradle setup**:
   - \`build.gradle.kts\` ke dependencies block mein \`compileOnly("de.robv.android.xposed:api:82")\` add karein.
   
## Testing aur Debugging kaise karein:

1. **APK Build karein**: Android Studio mein debug APK build karein (\`./gradlew assembleDebug\`).
2. **Install karein**: Phone ya emulator par APK install karein jispe Magisk/Kitsune aur **LSPosed Manager** configured ho.
3. **Module Activate karein**:
   - LSPosed Manager app kholein.
   - 'Modules' tab mein jaake apne module (\`${moduleName}\`) ko toggle on (enable) karein.
   - **SystemUI** package ko checkmark karein (LSPosed auto-recommend karega is package ko recommended list ke according).
4. **Reboot**: Status bar hooks ko update karne ke liye ya to SystemUI process ko kill/restart karein (\`adb shell pkill com.android.systemui\`) ya fir device reboot karein.
5. **Log check karein**:
   - Tool logcat command run karein:
     \`\`\`bash
     adb logcat -s ${loggerTag}
     \`\`\`
   - LSPosed Manager ke Log panel mein jaake module log check karein.
`;

  files.push({
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: readmeContent,
    description: 'Complete setup and testing manual in Hinglish and English detailing steps to assemble, install, and troubleshoot the newly generated LSPosed module.'
  });

  return files;
}
