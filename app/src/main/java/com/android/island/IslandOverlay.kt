package com.android.island

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
                de.robv.android.xposed.XSharedPreferences("com.android.island", "island_settings")
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
                    Logger.i("Material You (Monet) colors resolved dynamically from wallpaper. BG: $islandColor")
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
            Logger.i("WindowManager overlay initialized at collapsed state: ${collapsedWidth}x${collapsedHeight}")

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
                Logger.i("Dynamic Island fully expanded and morph transition complete! Ongoing: $isOngoing")
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
                    Logger.d("Overlay content state dynamically updated: $title - $textContent (Ongoing: $isOngoing, Progress: $progress)")
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
}