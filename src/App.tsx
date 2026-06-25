/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { GeneratorConfig } from './types';
import { generateFiles } from './utils/codeGenerator';
import { ConfigPanel } from './components/ConfigPanel';
import { CodeViewer } from './components/CodeViewer';
import { LifecycleVisualizer } from './components/LifecycleVisualizer';
import { IslandSimulator } from './components/IslandSimulator';
import {
  Terminal,
  Cpu,
  Layers,
  BookOpen,
  Download,
  Check,
  ShieldCheck,
  AlertTriangle,
  Github,
  Zap,
  Info
} from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<GeneratorConfig>({
    packageName: 'com.android.island',
    targetPackage: 'com.android.systemui',
    className: 'IslandHook',
    loggerTag: 'Island-Log',
    moduleName: 'Island Module',
    moduleDesc: 'Universal statusbar notification pill hook',
    minXposedVersion: 82,
    hookExample: 'universal_island'
  });

  const [copiedAll, setCopiedAll] = useState(false);

  const generatedFiles = useMemo(() => {
    return generateFiles(config);
  }, [config]);

  const handleCopyAll = async () => {
    try {
      const allText = generatedFiles
        .map(f => `=== FILE: ${f.name} (Path: ${f.path}) ===\n\n${f.content}`)
        .join('\n\n' + '='.repeat(40) + '\n\n');
      
      await navigator.clipboard.writeText(allText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Failed to copy all files', err);
    }
  };

  const downloadBundle = () => {
    // Generate a single combined text file of all module configurations
    const instructionsHeader = `=== LSPosed Boilerplate Code Bundle ===\nGenerated at: ${new Date().toISOString()}\nModule: ${config.moduleName}\nPackage: ${config.packageName}\n\n`;
    const filesText = generatedFiles
      .map(f => `--- START FILE: ${f.name} --- \nTarget Path: ${f.path}\n\n${f.content}\n--- END FILE: ${f.name} ---`)
      .join('\n\n');
    
    const element = document.createElement('a');
    const file = new Blob([instructionsHeader + filesText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${config.className}_LSPosed_Bundle.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Decorative subtle ambient lights */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[350px] bg-sky-500/5 rounded-full filter blur-[110px] pointer-events-none" />

      {/* Main Header Bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center glow-accent shadow-emerald-500/20">
              <Terminal className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold font-display tracking-tight text-zinc-100 sm:text-base">
                  LSPosed Gateway Generator
                </h1>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono font-semibold border border-emerald-500/20">
                  Kotlin v1.9+
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">
                Boilerplate engine for SystemUI hook modules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Bundle!</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy Code Bundle</span>
                </>
              )}
            </button>
            
            <button
              onClick={downloadBundle}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded text-xs font-bold flex items-center gap-1.5 glow-btn transition-transform active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Bundle</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        
        {/* Conceptual Hero Alert / Guide Hook */}
        <div className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-4 flex flex-col md:flex-row items-start gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-6 translate-y-6">
            <Cpu className="w-48 h-48 text-emerald-400" />
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold font-display text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              SystetmUI Entry Gateway (com.android.systemui)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-4xl">
              Kisi bhi custom Android feature ko status bar, notification shader ya custom volume dialog panel ke sath hook karne ke liye, aapka module <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-emerald-400">com.android.systemui</code> package ko target karta hai. LSPosed runtime pe handleLoadPackage intercept karega aur aapke classes ko load karke secure system hooks execute karega.
            </p>
          </div>
        </div>

        {/* Configuration + Workspace Editor Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Configuration Panel */}
          <div className="lg:col-span-4">
            <ConfigPanel config={config} onChange={setConfig} />
          </div>

          {/* Right Workspace Code Editor Panel */}
          <div className="lg:col-span-8 flex flex-col">
            <CodeViewer files={generatedFiles} />
          </div>
        </div>

        {/* Interactive Virtual Dynamic Island Simulator */}
        <div className="mt-8">
          <IslandSimulator />
        </div>

        {/* LSPosed Lifecycle Pipeline Visualizer */}
        <div className="mt-8">
          <LifecycleVisualizer config={config} />
        </div>

        {/* Setup requirements & Troubleshooting notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Requirements & Installation guide (Hinglish/English) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-850">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Installation & Activation Steps</h4>
            </div>
            
            <ul className="space-y-3.5 text-xs text-zinc-400 leading-relaxed list-none pl-0">
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                <div>
                  <span className="font-semibold text-zinc-300 block mb-0.5">Android Studio project path banayein</span>
                  Generated files ko target paths ke according copy-paste karein. <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-zinc-300 text-[10px]">assets/xposed_init</code> file ko manually <code className="text-zinc-300">src/main/assets</code> folder mein load karein.
                </div>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                <div>
                  <span className="font-semibold text-zinc-300 block mb-0.5">Build and Install APK</span>
                  Apna target APK assemble karein aur test device pe install karein jisme root aur LSPosed manager successfully configured ho.
                </div>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                <div>
                  <span className="font-semibold text-zinc-300 block mb-0.5">LSPosed Manager me Module Enable karein</span>
                  LSPosed Manager app open karein, "Modules" block mein jaake aapke module (<span className="text-emerald-400">{config.moduleName}</span>) ko enable karke, target checkboxes me <code className="text-zinc-300">{config.targetPackage}</code> process ko select karein.
                </div>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                <div>
                  <span className="font-semibold text-zinc-300 block mb-0.5">SystemUI kill karein ya Reboot karein</span>
                  System hooks load karne ke liye device reboot karein, ya fir command execute karke SystemUI ko force restart karein: <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-emerald-400 text-[10px]">adb shell pkill com.android.systemui</code>.
                </div>
              </li>
            </ul>
          </div>

          {/* Debugging & Troubleshooting logs panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-850">
              <Info className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Troubleshooting & Log Verification</h4>
            </div>

            <div className="space-y-4 text-xs text-zinc-400 leading-relaxed">
              <div>
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Logger Tag active verification
                </span>
                <p>
                  Aap logcat logs ko monitor karke handleLoadPackage launch check kar sakte hain:
                </p>
                <pre className="mt-2 p-2 bg-zinc-950 rounded font-mono text-[10px] text-emerald-300 select-all border border-zinc-850">
                  adb logcat -s {config.loggerTag}
                </pre>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                <span className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Important Security Warning
                </span>
                <p className="text-[11px]">
                  LSPosed hook development ke waqt SystemUI crash ho sakta hai agar hook details mein class mismatch ho. Backup recovery ke liye Magisk Safe Mode ya LSPosed recovery zip ready rakhein taaki bootloops se bacha ja sake.
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 mt-16 py-6 bg-zinc-950/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <div>
            &copy; 2026 LSPosed Module Boilerplate Generator. Built with premium Kotlin guidelines.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-zinc-300 transition-colors">Documentation</span>
            <span>&bull;</span>
            <span className="hover:text-zinc-300 transition-colors">Xposed API Spec</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

