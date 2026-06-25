import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Eye, Code, Layers, MessageSquare, Terminal, RefreshCw, Sparkles, Activity, Maximize2 } from 'lucide-react';
import { GeneratorConfig } from '../types';

interface LifecycleVisualizerProps {
  config: GeneratorConfig;
}

interface Step {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  descHinglish: string;
  descEnglish: string;
  codeSnippet: string;
}

export const LifecycleVisualizer: React.FC<LifecycleVisualizerProps> = ({ config }) => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps: Step[] = [
    {
      id: 1,
      title: "Android Boot / Zygote",
      subtitle: "LSPosed Core Loading",
      icon: Cpu,
      descHinglish: "Device boot hote hi, Magisk/Zygisk background mein LSPosed framework ko inject karta hai. Ye core process system ke har app ke liye hook base ready karta hai.",
      descEnglish: "During device startup, Magisk/Zygisk injects the LSPosed framework into the zygote process. This sets up the hooks architecture for every application process that will be spawned later.",
      codeSnippet: "// System level injection (Handled by LSPosed system service)\nSystemServer.loadFramework(LSPOS_PATH);"
    },
    {
      id: 2,
      title: "Process Interception",
      subtitle: "Package Filter check",
      icon: Eye,
      descHinglish: `Jab System UI start hota hai (\`${config.targetPackage}\`), LSPosed use intercept karta hai aur humare module ke targeted package se match karta hai.`,
      descEnglish: `As soon as the target package (\`${config.targetPackage}\`) is spawned by the OS, LSPosed intercepts it and evaluates whether your module is configured to scope into this target process.`,
      codeSnippet: `if (lpparam.packageName != "${config.targetPackage}") {\n    return // Match nahi hua toh skip karein\n}`
    },
    {
      id: 3,
      title: "Declaration Loader",
      subtitle: "xposed_init parsing",
      icon: Layers,
      descHinglish: "LSPosed humare assets directory se 'xposed_init' file ko read karta hai. Is file mein likha fully-qualified class path use batata hai ki entry point kahan hai.",
      descEnglish: "LSPosed reads your compiled assets/xposed_init file. This file acts as a pointer containing the fully-qualified classpath to dynamically instantiate your module entry point.",
      codeSnippet: `# assets/xposed_init\n${config.packageName}.${config.className}`
    },
    {
      id: 4,
      title: "Gateway Entry",
      subtitle: "IXposedHookLoadPackage Call",
      icon: Code,
      descHinglish: `Instantiate karne ke baad, LSPosed '${config.className}.handleLoadPackage()' ko execute karta hai aur target ka ClassLoader pass karta hai.`,
      descEnglish: `Once instantiated, LSPosed triggers your entry point class's overridden 'handleLoadPackage()' method and passes the specific ClassLoader context of the target application.`,
      codeSnippet: `class ${config.className} : IXposedHookLoadPackage {\n    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {\n        // Your Gateway is now Open!\n    }\n}`
    },
    {
      id: 5,
      title: "Dynamic Hooking",
      subtitle: "Method Interception",
      icon: Terminal,
      descHinglish: "ClassLoader milne ke baad, hum targeted method (jaise PhoneStatusBarView) ko hook karte hain aur custom logic inject karte hain.",
      descEnglish: "Using the target's ClassLoader, you call 'findAndHookMethod' to override target functions, performing work either 'before' or 'after' the original method executes.",
      codeSnippet: `XposedHelpers.findAndHookMethod(\n    "com.android.systemui.statusbar.phone.PhoneStatusBarView",\n    lpparam.classLoader, "onAttachedToWindow",\n    object : XC_MethodHook() { ... }\n)`
    },
    {
      id: 6,
      title: "Double Logging System",
      subtitle: "Logcat + LSPosed View",
      icon: MessageSquare,
      descHinglish: `Humare Logger class se hum standard Android Logcat aur LSPosed internal UI log dono jagah '${config.loggerTag}' tag ke saath verify kar sakte hain.`,
      descEnglish: `Your logging helper relays execution statuses simultaneously to system-wide Android Logcat and LSPosed's internal manager log viewer under the '${config.loggerTag}' tag filter.`,
      codeSnippet: `Log.d("${config.loggerTag}", message)\nXposedBridge.log("[${config.loggerTag}] DEBUG: " + message)`
    },
    {
      id: 7,
      title: "Notch & Camera Detection",
      subtitle: "DisplayCutout API Query",
      icon: Eye,
      descHinglish: "Island container place karne se pehle, hum Android 14/15/16 DisplayCutout API call karke phone ke active notch ya camera hole ka exact coordinate Rect nikalte hain. Agar screen par notch absent hai, toh ye automatically center statusbar placement fallback execute karta hai.",
      descEnglish: "Before rendering the island, the module queries the Android 14/15/16 DisplayCutout API at runtime to fetch the exact bounding Rect of any physical notch or camera hole. If none is present, it uses computed center-aligned status bar fallback coordinates.",
      codeSnippet: "val notchRect = NotchDetector.getNotchBounds(context)\nval pillWidth = if (notchWidth > 0) (notchWidth * 1.45).toInt() else 260\nval pillMarginTop = if (notchRect.top > 0) notchRect.top + 5 else 12"
    },
    {
      id: 8,
      title: "The Overlay System",
      subtitle: "WindowManager Floating View",
      icon: Layers,
      descHinglish: "HyperOS specific system files modify karne ke bajaye, hum WindowManager service ka use karke custom View ko inject karte hain. TYPE_STATUS_BAR_PANEL aur FLAG_NOT_FOCUSABLE flags use karke hum overlay ko bilkul status bar ke level par touch pass-through ke saath draw karte hain.",
      descEnglish: "Instead of modifying ROM-specific system resources, the module instantiates a floating WindowManager overlay on top of the system bar. Using TYPE_STATUS_BAR_PANEL and FLAG_NOT_FOCUSABLE flags, the island draws perfectly layered, responsive, and accepts pass-through touches safely.",
      codeSnippet: "val params = WindowManager.LayoutParams(\n    pillWidth, pillHeight,\n    WindowManager.LayoutParams.TYPE_STATUS_BAR_PANEL,\n    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,\n    PixelFormat.TRANSLUCENT\n)\nwindowManager.addView(rootLayout, params)"
    },
    {
      id: 9,
      title: "Notification Interceptor",
      subtitle: "HeadsUpManager Hook & Interface",
      icon: MessageSquare,
      descHinglish: "Hamari dynamic island ko dynamic content fill karne ke liye hum AOSP HeadsUpManager ke showNotification method ko intercept karte hain. Yahan se App Icon, Title, aur Text nikaal kar standard interface se seedhe status bar Overlay View ko pass kiya jata hai.",
      descEnglish: "To feed dynamic notifications directly to the floating island, the module hooks into the AOSP HeadsUpManager's showNotification method. It extracts the high-resolution package icon, title text, and body message, dispatching them cleanly over a decoupled interface to the active WindowManager overlay.",
      codeSnippet: "XposedHelpers.findAndHookMethod(\n    \"com.android.systemui.statusbar.policy.HeadsUpManager\",\n    lpparam.classLoader,\n    \"showNotification\",\n    \"com.android.systemui.statusbar.notification.collection.NotificationEntry\",\n    object : XC_MethodHook() {\n        override fun afterHookedMethod(param: MethodHookParam) {\n            val title = extras.getCharSequence(\"android.title\")\n            val appIcon = context.packageManager.getApplicationIcon(pkg)\n            val overlay: IslandNotificationInterface = IslandOverlay(context)\n            overlay.onNotificationReceived(appIcon, title, text)\n        }\n    }\n)"
    },
    {
      id: 10,
      title: "Morphing & Animation",
      subtitle: "Fluid Spring ValueAnimator",
      icon: Sparkles,
      descHinglish: "Island ko highly dynamic feel dene ke liye, jab new notification aati hai toh hum ValueAnimator ke sath custom PathInterpolator (spring-like curve) use karke size ko smooth modify karte hain (Small se Expanded). 5 seconds ke inactive duration ke baad ye auto-shrink back transists hokar close ho jata hai.",
      descEnglish: "To create a highly natural mechanical response, incoming notifications trigger a ValueAnimator that scales the island boundaries from Collapsed state directly to Expanded. By using a custom PathInterpolator with spring physics curves, it behaves natively like premium dynamic elements, auto-shrinking securely after a 5-second idle delay.",
      codeSnippet: "val animator = ValueAnimator.ofFloat(0f, 1f).apply {\n    duration = 450\n    interpolator = PathInterpolator(0.25f, 1f, 0.2f, 1.15f)\n    addUpdateListener { anim ->\n        val fraction = anim.animatedValue as Float\n        params.width = (fromW + (toW - fromW) * fraction).toInt()\n        windowManager.updateViewLayout(view, params)\n    }\n}"
    },
    {
      id: 11,
      title: "Ongoing Activities",
      subtitle: "Android 15/16 Persistent Live State",
      icon: Activity,
      descHinglish: "Android 15/16 ke naye progress APIs aur ongoing notification flags ko hook karke hum download tasks ya active live timers detect karte hain. Jab tak ye 'Ongoing' tasks chalte hain, auto-dismiss feature bypass rehta hai aur Island ke andar ek custom animated ProgressBar update hota rehta hai.",
      descEnglish: "By intercepting the latest Android 15/16 progress APIs and ongoing notification builders, the module identifies background downloads, persistent countdown timers, or navigation alerts. It overrides and bypasses the auto-dismiss timer, keeping the island expanded with a dynamic inline progress indicator until explicitly dismissed or completed.",
      codeSnippet: "val isOngoing = (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0\nval progressMax = extras.getInt(\"android.progressMax\", 0)\nval progressVal = extras.getInt(\"android.progress\", 0)\nval progressPct = if (progressMax > 0) (progressVal * 100) / progressMax else -1\n\n// Bypass auto-dismiss and update custom statusbar progress bar\nval overlay = IslandOverlay(context)\noverlay.onNotificationReceived(appIcon, title, text, isOngoing, progressPct)"
    },
    {
      id: 12,
      title: "Interactive Touch",
      subtitle: "TransitionManager Gesture Morphing",
      icon: Maximize2,
      descHinglish: "Island view par single tap karne par TransitionManager bina jhatke ke layout ko smoothly expand karta hai aur quick actions (Reply/Mute) buttons show karta hai. Long press karne par associated app ko foreground mein launch kar deta hai.",
      descEnglish: "A single tap triggers a fluid TransitionManager delayed expansion to morph the overlay into 'Large' dimensions and reveal quick actions (Reply/Mute) buttons. A long press queries package launch intents to transition back to the main app interface smoothly.",
      codeSnippet: "rootLayout.setOnClickListener {\n    TransitionManager.beginDelayedTransition(rootLayout, AutoTransition())\n    isLargeState = !isLargeState\n    if (isLargeState) {\n        params.width = (notchWidth * 2.3).toInt()\n        params.height = notchHeight + 120\n        actionsLayout.visibility = View.VISIBLE\n    } else {\n        params.width = expandedWidth\n        params.height = expandedHeight\n        actionsLayout.visibility = View.GONE\n    }\n    windowManager.updateViewLayout(rootLayout, params)\n}"
    },
    {
      id: 13,
      title: "Notification Queue",
      subtitle: "Priority-based Alert Scheduler",
      icon: Layers,
      descHinglish: "Multiple overlapping alerts ko safety se handling karne ke liye humne java.util.PriorityQueue integrate kiya hai. Jab active alert screen par hota hai, tab incoming alerts queue mein hold rehte hain aur priority scoring (jaise Dialer/Calls sabse pehle, updates baad mein) ke bases par turn-by-turn display hote hain.",
      descEnglish: "To safely prevent overlay collisions during multiple alert bursts, a java.util.PriorityQueue manages execution pipelines. New alerts wait sequentially in the queue, with custom priority scores allowing critical phone calls to instantly bypass lower priority app updates, ensuring orderly delivery.",
      codeSnippet: "data class NotificationItem(val title: String, val priority: Int) : Comparable<NotificationItem> {\n    override fun compareTo(other: NotificationItem) = other.priority.compareTo(this.priority)\n}\n\nobject NotificationQueueManager {\n    private val queue = PriorityQueue<NotificationItem>()\n    private var isDisplaying = false\n\n    fun enqueue(item: NotificationItem, context: Context) {\n        queue.add(item)\n        processNext(context)\n    }\n}"
    }
  ];

  const currentStepData = steps.find(s => s.id === activeStep) || steps[0];
  const StepIcon = currentStepData.icon;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5" id="lifecycle-visualizer">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-850">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-slow" />
            LSPosed Hook Gateway Lifecycle
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Visual breakdown of how your module loads and instruments the SystemUI process.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {steps.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
                activeStep === s.id
                  ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20 scale-105'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
            >
              {s.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline Map */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          {steps.map(s => {
            const SIcon = s.icon;
            const isSelected = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  isSelected 
                    ? 'bg-zinc-800/80 border-l-4 border-emerald-500 shadow-md' 
                    : 'bg-transparent hover:bg-zinc-850/50'
                }`}
              >
                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <SIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-medium font-mono ${isSelected ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {s.id}. {s.title}
                  </div>
                  <div className="text-[10px] text-zinc-500">{s.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Panel */}
        <div className="lg:col-span-8 bg-zinc-950/80 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-500 uppercase font-bold">Phase {activeStep}</span>
                    <h4 className="text-sm font-semibold text-zinc-200">{currentStepData.title}</h4>
                  </div>
                </div>

                <div className="space-y-3 mt-3">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-400/80 uppercase font-mono tracking-wider block mb-1">Hindi Explanation:</span>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">{currentStepData.descHinglish}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-sky-400/80 uppercase font-mono tracking-wider block mb-1">English Explanation:</span>
                    <p className="text-xs text-zinc-400 leading-relaxed font-sans">{currentStepData.descEnglish}</p>
                  </div>
                </div>
              </div>

              {/* Live Code Snippet for the Phase */}
              <div className="mt-4 border-t border-zinc-850 pt-4">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase font-mono block mb-2">Associated Runtime Execution:</span>
                <pre className="text-[11px] font-mono bg-zinc-900/60 p-3 rounded border border-zinc-850 text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed">
                  {currentStepData.codeSnippet}
                </pre>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
