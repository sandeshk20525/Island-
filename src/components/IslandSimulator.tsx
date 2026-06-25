import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Wifi, 
  Battery, 
  Music, 
  Tv, 
  Bell, 
  Volume2, 
  ExternalLink,
  ShieldAlert,
  RotateCw,
  ShieldCheck,
  Smartphone,
  Settings
} from 'lucide-react';

interface Track {
  title: string;
  artist: string;
  albumArtColor: string;
  platform: 'Spotify' | 'YouTube Music';
  duration: string;
}

const PLAYLIST: Track[] = [
  {
    title: "Starboy",
    artist: "The Weeknd",
    albumArtColor: "from-purple-600 to-indigo-900",
    platform: "Spotify",
    duration: "3:50"
  },
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    albumArtColor: "from-amber-500 to-red-700",
    platform: "Spotify",
    duration: "3:20"
  },
  {
    title: "Shape of You",
    artist: "Ed Sheeran",
    albumArtColor: "from-sky-400 to-blue-700",
    platform: "Spotify",
    duration: "3:53"
  },
  {
    title: "Lofi Beats for Coding",
    artist: "YouTube Chill Station",
    albumArtColor: "from-pink-500 to-rose-700",
    platform: "YouTube Music",
    duration: "Live Stream"
  }
];

export interface MonetTheme {
  bg: string;
  title: string;
  content: string;
  accent: string;
  name: string;
  wallpaperClass: string;
}

export const MONET_PALETTES: Record<string, MonetTheme> = {
  blue: {
    bg: '#0a121e',
    title: '#a0c9ff',
    content: '#dce3e9',
    accent: '#3b82f6',
    name: 'Ocean Breeze (Blue)',
    wallpaperClass: 'from-blue-950/80 via-zinc-950 to-blue-900/40'
  },
  lavender: {
    bg: '#140f1a',
    title: '#ddb3ff',
    content: '#e6e1e5',
    accent: '#c084fc',
    name: 'Lilac Dusk (Lavender)',
    wallpaperClass: 'from-purple-950/80 via-zinc-950 to-fuchsia-900/30'
  },
  emerald: {
    bg: '#0a1810',
    title: '#86efac',
    content: '#e1f4e7',
    accent: '#34d399',
    name: 'Forest Canopy (Emerald)',
    wallpaperClass: 'from-emerald-950/80 via-zinc-950 to-teal-900/30'
  },
  crimson: {
    bg: '#1c0c0e',
    title: '#fca5a5',
    content: '#f4e2e2',
    accent: '#f87171',
    name: 'Rose Sunset (Crimson)',
    wallpaperClass: 'from-red-950/80 via-zinc-950 to-rose-900/30'
  },
  amber: {
    bg: '#1a120a',
    title: '#fde047',
    content: '#f4ece1',
    accent: '#fbbf24',
    name: 'Caramel Autumn (Amber)',
    wallpaperClass: 'from-amber-950/80 via-zinc-950 to-yellow-900/30'
  }
};

export const IslandSimulator: React.FC = () => {
  const [activeIsland, setActiveIsland] = useState<boolean>(false);
  const [islandState, setIslandState] = useState<'collapsed' | 'expanded' | 'large'>('collapsed');
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(35);
  const [simulationType, setSimulationType] = useState<'music' | 'normal'>('music');
  
  // Custom Dynamic Island Settings (Phase 10 Settings App Simulator)
  const [xOffset, setXOffset] = useState<number>(0);
  const [yOffset, setYOffset] = useState<number>(0);
  const [islandColor, setIslandColor] = useState<string>('#000000');
  const [useMonet, setUseMonet] = useState<boolean>(true);
  const [wallpaperPalette, setWallpaperPalette] = useState<'blue' | 'lavender' | 'emerald' | 'crimson' | 'amber'>('blue');
  const [blacklistInput, setBlacklistInput] = useState<string>('com.android.settings,com.android.keyguard');
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [hideOnLandscape, setHideOnLandscape] = useState<boolean>(true);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulatedCrash, setSimulatedCrash] = useState<boolean>(false);
  const [crashMessage, setCrashMessage] = useState<string | null>(null);

  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const currentTrack = PLAYLIST[currentTrackIndex];

  // Derive active style colors based on Material You (Monet) selection
  const currentMonetTheme = MONET_PALETTES[wallpaperPalette];
  const activeBgColor = useMonet ? currentMonetTheme.bg : islandColor;
  const activeTitleColor = useMonet ? currentMonetTheme.title : '#ffffff';
  const activeContentColor = useMonet ? currentMonetTheme.content : '#9ca3af';
  const activeAccentColor = useMonet ? currentMonetTheme.accent : '#10b981';

  // Derived orientation-sensitive coordinates for simulated screen
  const simX = deviceOrientation === 'landscape' ? 0 : xOffset;
  const simY = deviceOrientation === 'landscape' 
    ? (hideOnLandscape ? 0 : -6) // Shifted to top edge center in landscape orientation
    : yOffset;
  const showActiveIsland = activeIsland && !(deviceOrientation === 'landscape' && hideOnLandscape);

  // Auto-increment progress bar if playing music
  useEffect(() => {
    if (activeIsland && isPlaying && simulationType === 'music') {
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 1;
        });
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [activeIsland, isPlaying, simulationType]);

  const triggerMusicSimulation = (index: number) => {
    const track = PLAYLIST[index];
    const pkg = track.platform === 'Spotify' ? 'com.spotify' : 'com.google.android.apps.youtube.music';
    const blacklisted = blacklistInput.split(',').map(p => p.trim().toLowerCase());
    
    if (blacklisted.includes(pkg)) {
      setSimulationError(`Notification Blocked: '${pkg}' is blacklisted in Island Settings!`);
      setTimeout(() => setSimulationError(null), 3500);
      return;
    }

    setCurrentTrackIndex(index);
    setSimulationType('music');
    setIsPlaying(true);
    setProgress(Math.floor(Math.random() * 40) + 10);
    setActiveIsland(true);
    setIslandState('expanded');
  };

  const triggerNormalSimulation = () => {
    const pkg = 'com.whatsapp';
    const blacklisted = blacklistInput.split(',').map(p => p.trim().toLowerCase());
    
    if (blacklisted.includes(pkg)) {
      setSimulationError(`Notification Blocked: '${pkg}' is blacklisted in Island Settings!`);
      setTimeout(() => setSimulationError(null), 3500);
      return;
    }

    setSimulationType('normal');
    setActiveIsland(true);
    setIslandState('expanded');
    setProgress(-1);
  };

  const triggerCrashSimulation = () => {
    if (!activeIsland) {
      setSimulationType('normal');
      setActiveIsland(true);
      setIslandState('expanded');
    }
    
    setSimulatedCrash(true);
    setCrashMessage("NullPointerException inside visualizerAnimator frame tick callback: canvas.getWidth() on a null reference.");
    
    // Simulate safe dismantling after 3 seconds
    setTimeout(() => {
      setActiveIsland(false);
      setIslandState('collapsed');
      setSimulatedCrash(false);
      setCrashMessage(null);
    }, 3000);
  };

  const handleIslandClick = () => {
    if (islandState === 'expanded') {
      setIslandState('large');
    } else if (islandState === 'large') {
      setIslandState('expanded');
    }
  };

  const handleNextTrack = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering state toggle on click
    setCurrentTrackIndex(prev => (prev + 1) % PLAYLIST.length);
    setProgress(0);
    setIsPlaying(true);
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(prev => !prev);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6" id="island-simulator">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            SystemUI Dynamic Island Emulator (Phase 9)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Test and interact with the customized Xposed Dynamic Island overlay directly in your web preview.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-mono border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Virtual Hook Service Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Simulation Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">1. Simulate Active Media Sessions</span>
            <div className="grid grid-cols-1 gap-2">
              {PLAYLIST.map((track, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerMusicSimulation(idx)}
                  className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between group ${
                    activeIsland && simulationType === 'music' && currentTrackIndex === idx
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-zinc-100'
                      : 'bg-zinc-950/60 border-zinc-850 hover:bg-zinc-850/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md bg-gradient-to-tr ${track.albumArtColor} flex items-center justify-center text-zinc-100 font-bold text-xs`}>
                      {track.platform === 'Spotify' ? 'S' : 'Y'}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{track.title}</div>
                      <div className="text-[10px] opacity-70">{track.artist}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      {track.platform}
                    </span>
                    <Play className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">2. Simulate Standard Notification</span>
            <button
              onClick={triggerNormalSimulation}
              className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                activeIsland && simulationType === 'normal'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-zinc-100'
                  : 'bg-zinc-950/60 border-zinc-850 hover:bg-zinc-850/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-200">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold">Incoming WhatsApp Alert</div>
                  <div className="text-[10px] opacity-70">Rahul: "Oye, music controller check kar!"</div>
                </div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Normal</span>
            </button>
          </div>

          {/* 3. Programmatic Settings Customizer Section */}
          <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                3. Companion Settings App Emulator
              </span>
            </div>

            {/* X Offset Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Horizontal Position (X Offset)</span>
                <span className="font-mono text-emerald-400">{xOffset}px</span>
              </div>
              <input 
                type="range" 
                min="-60" 
                max="60" 
                value={xOffset} 
                onChange={(e) => setXOffset(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Y Offset Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Vertical Position (Y Offset)</span>
                <span className="font-mono text-emerald-400">{yOffset}px</span>
              </div>
              <input 
                type="range" 
                min="-10" 
                max="30" 
                value={yOffset} 
                onChange={(e) => setYOffset(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Material You (Monet) Settings */}
            <div className="bg-zinc-900/40 p-3 rounded border border-zinc-850/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-300">Material You Dynamic Theme (Monet)</span>
                <input 
                  type="checkbox"
                  checked={useMonet}
                  onChange={(e) => setUseMonet(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-500 bg-zinc-950 border-zinc-800 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                />
              </div>
              <p className="text-[9px] text-zinc-500 leading-normal">
                Enable monet engine to automatically extract matching background, title text, and accent colors from the active device wallpaper.
              </p>
              
              {useMonet && (
                <div className="space-y-1.5 pt-1.5 border-t border-zinc-850/50">
                  <span className="text-[9px] text-zinc-400 block font-mono">Active Wallpaper Scheme</span>
                  <div className="grid grid-cols-5 gap-1">
                    {(Object.keys(MONET_PALETTES) as Array<keyof typeof MONET_PALETTES>).map((key) => {
                      const active = wallpaperPalette === key;
                      const palette = MONET_PALETTES[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setWallpaperPalette(key)}
                          title={palette.name}
                          className={`h-7 rounded border flex items-center justify-center transition-all ${
                            active 
                              ? 'border-zinc-300 scale-105 shadow-md shadow-zinc-500/10' 
                              : 'border-zinc-850 hover:border-zinc-700'
                          }`}
                          style={{ backgroundColor: palette.bg }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: palette.accent }}>●</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-zinc-500 block text-right font-mono italic">
                    Theme: {MONET_PALETTES[wallpaperPalette].name}
                  </span>
                </div>
              )}
            </div>

            {/* Color Picker & Input */}
            <div className={`space-y-1.5 transition-all duration-300 ${useMonet ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Island Color</span>
                <span className="font-mono text-emerald-400">{islandColor}</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={islandColor} 
                  disabled={useMonet}
                  onChange={(e) => setIslandColor(e.target.value)}
                  className="w-8 h-8 bg-transparent border-0 cursor-pointer rounded overflow-hidden shrink-0"
                />
                <input 
                  type="text" 
                  value={islandColor} 
                  disabled={useMonet}
                  onChange={(e) => setIslandColor(e.target.value)}
                  placeholder="#000000"
                  className="w-full text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              {useMonet && (
                <p className="text-[8px] text-zinc-500 leading-none italic mt-1">
                  * Custom hex disabled. Monet is active.
                </p>
              )}
            </div>

            {/* Blacklist Apps */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Blacklisted Packages</span>
                <span className="text-[9px] text-zinc-500">(comma-separated)</span>
              </div>
              <input 
                type="text" 
                value={blacklistInput} 
                onChange={(e) => setBlacklistInput(e.target.value)}
                placeholder="com.android.settings"
                className="w-full text-xs px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-[9px] text-zinc-500 leading-normal">
                Try blacklisting <code className="text-emerald-400">com.whatsapp</code> or <code className="text-emerald-400">com.spotify</code> and run simulated alerts above to test module ignore filters!
              </p>
            </div>

            {/* Landscape & Orientation Handling */}
            <div className="bg-zinc-900/40 p-3 rounded border border-zinc-850/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-300">Landscape Mode Action</span>
                <div className="flex gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                  <button
                    onClick={() => setHideOnLandscape(true)}
                    className={`px-2.5 py-1 rounded text-[9px] font-mono transition-all ${
                      hideOnLandscape 
                        ? 'bg-emerald-500 text-zinc-950 font-bold' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Hide Island
                  </button>
                  <button
                    onClick={() => setHideOnLandscape(false)}
                    className={`px-2.5 py-1 rounded text-[9px] font-mono transition-all ${
                      !hideOnLandscape 
                        ? 'bg-emerald-500 text-zinc-950 font-bold' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Reposition
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-zinc-500 leading-normal">
                {hideOnLandscape 
                  ? "Island will automatically disappear when landscape is detected to avoid blocking video or games."
                  : "Island will dynamically reposition itself to the top-center edge of the landscape viewport."}
              </p>
            </div>
          </div>

          {/* Performance & Battery Optimizations */}
          <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                Performance & Battery Optimizations
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Island View State:</span>
                <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                  showActiveIsland 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {showActiveIsland ? 'Zinda (VISIBLE / Morphing)' : 'Idle (GONE / Released)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">CPU Overhead (Animations):</span>
                <span className={`font-mono font-semibold ${showActiveIsland ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {showActiveIsland ? '1.5% - 4.2% (Active Loop)' : '0% (Released / CPU Sleep)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Memory Leak Shield:</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  WeakReference Active
                </span>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 leading-normal">
              When idle, the companion view is completely destroyed (<code className="text-emerald-400">View.GONE</code>), freeing background layout passes and releasing animator loops from memory to achieve absolute 0% passive battery drain.
            </p>
          </div>

          {/* 4. SystemUI Stability & Crash Protection */}
          <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                4. SystemUI Crash Protection
              </span>
            </div>
            <p className="text-[9px] text-zinc-400 leading-normal">
              Test how the "Safe Hooking" try-catch shield prevents SystemUI crashes. If the Island view crashes, it is safely removed while the rest of the phone keeps running flawlessly.
            </p>
            <button
              onClick={triggerCrashSimulation}
              disabled={simulatedCrash}
              className={`w-full py-2 px-3 rounded text-xs font-mono font-medium transition-all ${
                simulatedCrash
                  ? 'bg-red-900/20 text-red-400 border border-red-900/30 cursor-not-allowed'
                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/35 hover:border-red-500/50'
              }`}
            >
              {simulatedCrash ? '⚠️ Catching Crash exception...' : '⚡ Trigger Simulated Island Crash'}
            </button>
          </div>

          {/* 5. Stealth Mode & Banking App Compatibility */}
          <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                5. Stealth & Banking Shield
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Target Isolation:</span>
                <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] font-bold">
                  com.android.systemui
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Banking Apps Guard:</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Stealth (No Injection)
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">LSPosed Scope Filter:</span>
                <span className="font-mono text-emerald-400">Declared in Manifest</span>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 leading-normal">
              By declaring the target package scope as <code className="text-emerald-400">com.android.systemui</code> in the <code className="text-emerald-400">AndroidManifest.xml</code> via LSPosed's <code className="text-emerald-400">xposedscope</code> array metadata, the module avoids process hooking in other apps entirely. This ensures that banking, financial, or security apps (such as Google Pay, PhonePe, and Paytm) never detect any modification hooks, preventing app crashes or root/Xposed warnings!
            </p>
          </div>

          {/* 6. Dual-Purpose APK Architecture */}
          <div className="bg-zinc-950/60 p-4 rounded-lg border border-zinc-850 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-850 pb-2">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-mono">
                6. Dual-Purpose Hybrid APK
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              <div className="flex justify-between items-center bg-zinc-900/40 p-2 rounded border border-zinc-850/60">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Normal App Mode (Settings UI)</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-bold">LAUNCHER Category</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/40 p-2 rounded border border-zinc-850/60">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Xposed Module Mode</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-bold">xposedmodule=true</span>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 leading-normal">
              A single APK acts as both a system modification hook and a user settings dashboard. Adding the <code className="text-emerald-400">LAUNCHER</code> category intent filter to <code className="text-emerald-400">SettingsActivity</code> allows users to click the app icon from their home screen. Simultaneously, declaring the metadata <code className="text-emerald-400">xposedmodule</code> allows LSPosed to read it as a background customization layer.
            </p>
          </div>

          {activeIsland && (
            <button
              onClick={() => {
                setActiveIsland(false);
                setIslandState('collapsed');
              }}
              className="w-full py-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-mono transition-colors"
            >
              Reset / Dismiss Virtual Overlay
            </button>
          )}
        </div>

        {/* Right Side: Visual Emulator Screen */}
        <div className="lg:col-span-7 flex flex-col justify-center items-center bg-zinc-950 rounded-xl border border-zinc-850 p-6 min-h-[340px] relative overflow-hidden">
          
          {/* Emulator Orientation Control Header */}
          <div className="w-full max-w-[420px] flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 font-mono">
              <RotateCw className={`w-3.5 h-3.5 text-emerald-400 ${deviceOrientation === 'landscape' ? 'rotate-90' : ''} transition-transform duration-500`} />
              DEVICE EMULATOR: {deviceOrientation.toUpperCase()}
            </span>
            <div className="flex gap-1.5 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                onClick={() => setDeviceOrientation('portrait')}
                className={`px-3 py-1 rounded text-[10px] font-medium font-mono transition-all ${
                  deviceOrientation === 'portrait' 
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Portrait
              </button>
              <button
                onClick={() => setDeviceOrientation('landscape')}
                className={`px-3 py-1 rounded text-[10px] font-medium font-mono transition-all ${
                  deviceOrientation === 'landscape' 
                    ? 'bg-zinc-800 text-emerald-400 font-semibold shadow' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Simulated Mobile Device frame with Orientation Adaptive Classes */}
          <div className={`transition-all duration-700 bg-zinc-900 border-zinc-800 shadow-2xl relative flex flex-col overflow-hidden ${
            deviceOrientation === 'portrait'
              ? 'w-[290px] h-[480px] rounded-[38px] border-[8px]'
              : 'w-full max-w-[420px] h-[280px] rounded-[32px] border-[6px]'
          }`}>
            {/* Status Bar */}
            <div className="bg-black/90 px-5 py-2 flex justify-between items-center text-[10px] text-zinc-400 font-mono select-none">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-zinc-500" />
                <span className="text-[9px]">5G</span>
                <Battery className="w-4.5 h-3 text-zinc-500" />
              </div>
            </div>

            {/* Display Area */}
            <div className={`flex-1 bg-gradient-to-b ${useMonet ? currentMonetTheme.wallpaperClass : 'from-zinc-950 to-zinc-900'} relative p-4 flex flex-col items-center transition-all duration-700`}>
              {/* Landscape auto-hide explanation toast */}
              {activeIsland && deviceOrientation === 'landscape' && hideOnLandscape && (
                <div className="absolute inset-x-4 top-4 bg-zinc-950/95 text-zinc-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-[9px] text-center z-30 shadow-lg font-mono flex items-center justify-center gap-1.5 animate-bounce">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Landscape mode: Island auto-hidden</span>
                </div>
              )}

              {/* Simulated Blacklist warning toast */}
              {simulationError && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-950/90 text-red-100 border border-red-800/40 px-3 py-2 rounded-lg text-[10px] text-center z-30 shadow-lg font-mono animate-pulse">
                  ⚠️ {simulationError}
                </div>
              )}

              {/* Simulated Crash Protection Overlay */}
              {simulatedCrash && (
                <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-sm flex flex-col justify-center p-5 z-40 text-left font-mono border border-red-900/40 rounded-b-[26px]">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs border-b border-zinc-850 pb-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />
                    <span>SYSTEMUI SHIELD ACTIVE</span>
                  </div>
                  <div className="text-[10px] text-zinc-300 space-y-1.5 leading-relaxed">
                    <p className="text-red-400 font-bold">&gt;&gt; Exception Caught: NullPointerException!</p>
                    <p className="text-zinc-500 text-[8.5px] leading-snug">{crashMessage}</p>
                    <p className="text-emerald-400 font-bold">&gt;&gt; LSPosed Gateway: Intercepted in try-catch.</p>
                    <p className="text-emerald-400 font-bold">&gt;&gt; Action: dismissIsland() called. Releasing all resources...</p>
                    <p className="text-emerald-500 font-bold">&gt;&gt; SystemUI Status: 100% stable, no freeze.</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-zinc-850 flex items-center justify-between text-[9px]">
                    <span className="text-zinc-500">LSPosed Safe Hook Protection</span>
                    <span className="text-emerald-400 animate-pulse font-bold">● ONLINE</span>
                  </div>
                </div>
              )}

              {/* Dynamic Island Overlay Container */}
              <div className="w-full flex justify-center z-20 absolute top-2 left-0 right-0 px-4">
                <AnimatePresence mode="wait">
                  {!showActiveIsland ? (
                    /* Default camera punch-hole cutout style */
                    <motion.div
                      key="collapsed"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        x: simX,
                        y: simY,
                        backgroundColor: activeBgColor
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="w-24 h-6 rounded-full flex items-center justify-center"
                    >
                      <div className="w-2 h-2 rounded-full bg-zinc-900/60 border border-zinc-800/40" />
                    </motion.div>
                  ) : (
                    /* Dynamic morphing island layout based on states */
                    <motion.div
                      key={islandState}
                      layoutId="island-overlay"
                      onClick={handleIslandClick}
                      className="text-zinc-200 rounded-[24px] shadow-2xl overflow-hidden cursor-pointer flex flex-col justify-between border border-zinc-800/20"
                      animate={{
                        width: islandState === 'expanded' ? 280 : islandState === 'large' ? 320 : 120,
                        height: islandState === 'expanded' ? 44 : islandState === 'large' ? (simulationType === 'music' ? 125 : 100) : 24,
                        padding: islandState === 'expanded' ? "8px 14px" : islandState === 'large' ? "14px 16px" : "0px",
                        borderRadius: islandState === 'large' ? 28 : 22,
                        x: simX,
                        y: simY,
                        backgroundColor: activeBgColor
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 26
                      }}
                    >
                      {/* Expanded Pill State */}
                      {islandState === 'expanded' && (
                        <div className="flex items-center justify-between w-full h-full text-left">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {simulationType === 'music' ? (
                              <>
                                {/* Album Art representation */}
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentTrack.albumArtColor} flex items-center justify-center shrink-0 shadow-inner overflow-hidden border border-zinc-800 animate-[spin_10s_linear_infinite] ${!isPlaying && 'paused'}`}>
                                  <Music className="w-3.5 h-3.5 text-zinc-100" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-bold truncate" style={{ color: activeTitleColor }}>{currentTrack.title}</div>
                                  <div className="text-[9px] truncate" style={{ color: activeContentColor }}>{currentTrack.artist}</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeAccentColor}20`, color: activeAccentColor }}>
                                  <Bell className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-bold truncate" style={{ color: activeTitleColor }}> राहुल (WhatsApp)</div>
                                  <div className="text-[9px] truncate" style={{ color: activeContentColor }}>Oye, code bundle check kar...</div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Music Audio Visualizer Right Side */}
                          {simulationType === 'music' && (
                            <div className="flex items-end gap-0.5 h-5 px-1 pb-0.5 shrink-0">
                              <motion.span 
                                animate={{ height: isPlaying ? [10, 18, 6, 12, 10] : 6 }} 
                                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                                className="w-[3px] rounded-full block" 
                                style={{ backgroundColor: activeAccentColor }}
                              />
                              <motion.span 
                                animate={{ height: isPlaying ? [16, 6, 20, 12, 16] : 10 }} 
                                transition={{ repeat: Infinity, duration: 0.5, ease: "linear", delay: 0.1 }}
                                className="w-[3px] rounded-full block" 
                                style={{ backgroundColor: activeAccentColor }}
                              />
                              <motion.span 
                                animate={{ height: isPlaying ? [8, 14, 8, 16, 8] : 4 }} 
                                transition={{ repeat: Infinity, duration: 0.7, ease: "linear", delay: 0.25 }}
                                className="w-[3px] rounded-full block" 
                                style={{ backgroundColor: activeAccentColor }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Large Action Controls State */}
                      {islandState === 'large' && (
                        <div className="flex flex-col justify-between h-full w-full">
                          {/* Top part: track and album art */}
                          <div className="flex items-center gap-3 text-left">
                            {simulationType === 'music' ? (
                              <>
                                <div className={`w-11 h-11 rounded-lg bg-gradient-to-tr ${currentTrack.albumArtColor} flex items-center justify-center shrink-0 shadow-lg border border-zinc-800`}>
                                  <Music className="w-5 h-5 text-zinc-100" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold truncate" style={{ color: activeTitleColor }}>{currentTrack.title}</div>
                                  <div className="text-[10px] truncate" style={{ color: activeContentColor }}>{currentTrack.artist}</div>
                                  <div className="text-[8px] mt-0.5 font-mono uppercase opacity-80" style={{ color: activeAccentColor }}>{currentTrack.platform} Live</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${activeAccentColor}20`, color: activeAccentColor }}>
                                  <Bell className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold" style={{ color: activeTitleColor }}>राहुल (WhatsApp)</div>
                                  <div className="text-[10px] leading-snug" style={{ color: activeContentColor }}>"Oye, music controller aur visualizer setup gazab lag raha hai!"</div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Middle: Progress Seek bar for music */}
                          {simulationType === 'music' && (
                            <div className="space-y-1 mt-2.5">
                              <div className="w-full bg-zinc-850 h-1 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: activeAccentColor }} />
                              </div>
                              <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                                <span style={{ color: activeContentColor }}>0:{progress < 10 ? `0${progress}` : progress}</span>
                                <span style={{ color: activeContentColor }}>{currentTrack.duration}</span>
                              </div>
                            </div>
                          )}

                          {/* Bottom controls */}
                          <div className="flex justify-center items-center gap-4 mt-2.5 border-t border-zinc-900 pt-2 shrink-0">
                            {simulationType === 'music' ? (
                              <>
                                <button
                                  onClick={handlePlayPause}
                                  className="w-14 py-1 text-zinc-950 rounded-full flex items-center justify-center gap-1 text-[10px] font-bold shadow-md transition-colors"
                                  style={{ backgroundColor: activeAccentColor }}
                                >
                                  {isPlaying ? (
                                    <>
                                      <Pause className="w-3 h-3 fill-zinc-950" />
                                      <span>Pause</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 fill-zinc-950" />
                                      <span>Play</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleNextTrack}
                                  className="w-14 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full flex items-center justify-center gap-1 text-[10px] font-bold transition-colors"
                                >
                                  <SkipForward className="w-3 h-3" />
                                  <span>Next</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveIsland(false); }}
                                  className="px-4 py-1 text-zinc-950 rounded-full text-[10px] font-bold shadow-md"
                                  style={{ backgroundColor: activeAccentColor }}
                                >
                                  Reply
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveIsland(false); }}
                                  className="px-4 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-full text-[10px]"
                                >
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Simulated home screen wallpaper content */}
              <div className="absolute inset-0 flex flex-col justify-end items-center p-6 text-center select-none pt-14">
                <div className="space-y-1.5 opacity-30">
                  <div className="text-[28px] font-light tracking-wide text-zinc-100 font-display">
                    Welcome
                  </div>
                  <div className="text-[10px] tracking-wider text-zinc-400 font-mono uppercase">
                    SystemUI Workspace active
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-[10px] text-zinc-500 font-mono text-center max-w-[340px]">
            💡 **Interactive Hint**: Island active hone par uspar **Click** karein taaki controls expand ho sakein.
          </div>
        </div>
      </div>
    </div>
  );
};
