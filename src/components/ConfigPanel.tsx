import React, { useState } from 'react';
import { GeneratorConfig } from '../types';
import { Settings, HelpCircle, AlertTriangle, Check, ShieldCheck } from 'lucide-react';

interface ConfigPanelProps {
  config: GeneratorConfig;
  onChange: (newConfig: GeneratorConfig) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (field: keyof GeneratorConfig, value: any) => {
    let err = '';
    if (field === 'packageName') {
      const regex = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
      if (!value) {
        err = 'Package name is required';
      } else if (!regex.test(value)) {
        err = 'Must be lowercase with at least one dot (e.g., com.example.island)';
      }
    } else if (field === 'targetPackage') {
      if (!value) {
        err = 'Target package is required';
      } else if (value.includes(' ')) {
        err = 'Cannot contain spaces';
      }
    } else if (field === 'className') {
      const regex = /^[A-Z][a-zA-Z0-9_]*$/;
      if (!value) {
        err = 'Class name is required';
      } else if (!regex.test(value)) {
        err = 'Must be Alphanumeric starting with an Upper Case letter';
      }
    } else if (field === 'loggerTag') {
      if (!value) {
        err = 'Logger Tag is required';
      }
    } else if (field === 'moduleName') {
      if (!value) {
        err = 'Module title is required';
      }
    }

    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const handleTextChange = (field: keyof GeneratorConfig, value: string) => {
    const updated = { ...config, [field]: value };
    onChange(updated);
    validate(field, value);
  };

  const handleNumberChange = (field: keyof GeneratorConfig, value: number) => {
    const updated = { ...config, [field]: value };
    onChange(updated);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-full flex flex-col justify-between" id="config-panel">
      <div className="space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
          <Settings className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
            Gateway Configuration
          </h2>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 text-xs">
          {/* Module Package Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                Module Package Name
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-500">AndroidManifest & Namespace</span>
            </div>
            <input
              type="text"
              value={config.packageName}
              onChange={e => handleTextChange('packageName', e.target.value)}
              className={`w-full bg-zinc-950 border rounded p-2.5 text-zinc-200 font-mono focus:outline-none focus:ring-1 ${
                errors.packageName ? 'border-rose-500 focus:ring-rose-500' : 'border-zinc-800 focus:ring-emerald-500'
              }`}
              placeholder="com.android.island"
            />
            {errors.packageName ? (
              <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.packageName}
              </p>
            ) : (
              <p className="text-[10px] text-zinc-500 mt-1">
                Aapka local Java/Kotlin folder namespace.
              </p>
            )}
          </div>

          {/* Target Package */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-zinc-300">
                Target Package (Hook Target)
                <span className="text-rose-500">*</span>
              </label>
            </div>
            <input
              type="text"
              value={config.targetPackage}
              onChange={e => handleTextChange('targetPackage', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="com.android.systemui"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              SystemUI package name default targeted process.
            </p>
          </div>

          {/* Class Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-zinc-300">
                Xposed Class Name
                <span className="text-rose-500">*</span>
              </label>
            </div>
            <input
              type="text"
              value={config.className}
              onChange={e => handleTextChange('className', e.target.value)}
              className={`w-full bg-zinc-950 border rounded p-2.5 text-zinc-200 font-mono focus:outline-none focus:ring-1 ${
                errors.className ? 'border-rose-500 focus:ring-rose-500' : 'border-zinc-800 focus:ring-emerald-500'
              }`}
              placeholder="IslandHook"
            />
            {errors.className && (
              <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {errors.className}
              </p>
            )}
          </div>

          {/* Logger Tag */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-zinc-300">
                Logger Tag
                <span className="text-rose-500">*</span>
              </label>
            </div>
            <input
              type="text"
              value={config.loggerTag}
              onChange={e => handleTextChange('loggerTag', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Island-Log"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Adb logcat -s {config.loggerTag} ke liye output identifier.
            </p>
          </div>

          {/* Hook Example Selection */}
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Hook Example Template
            </label>
            <select
              value={config.hookExample}
              onChange={e => {
                const val = e.target.value as any;
                let desc = config.moduleDesc;
                if (val === 'universal_island') {
                  desc = 'Universal statusbar notification pill hook';
                } else if (val === 'hyper_island') {
                  desc = 'Xiaomi HyperOS Dynamic Island Reference Hook';
                }
                onChange({ ...config, hookExample: val, moduleDesc: desc });
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="universal_island">🌴 Universal AOSP Dynamic Island (All Devices)</option>
              <option value="hyper_island">⚡ HyperOS Reference (Xiaomi HyperIsland Hook)</option>
              <option value="statusbar">⏰ PhoneStatusBarView.onAttachedToWindow (Clock Hook)</option>
              <option value="volume">🔊 VolumeDialogImpl.showH (Volume Panel Hook)</option>
              <option value="simple">⬜ Blank Gateway / Custom Hooks Template</option>
            </select>
            <div className="mt-2 bg-zinc-950/40 p-2 rounded border border-zinc-850/60">
              {config.hookExample === 'universal_island' && (
                <p className="text-[10px] text-emerald-400 leading-normal">
                  <strong>Universal Mode:</strong> Works on all ROMs (Pixel, AOSP, Motorola, etc.). Checks for Class presence dynamically so it never soft-reboots or crashes SystemUI.
                </p>
              )}
              {config.hookExample === 'hyper_island' && (
                <p className="text-[10px] text-sky-400 leading-normal">
                  <strong>HyperOS Spec:</strong> Targets customized Xiaomi SystemUI elements. Uses Xiaomi-specific class identifiers (e.g., MiuiPhoneStatusBarView).
                </p>
              )}
              {config.hookExample === 'statusbar' && (
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Standard Clock placement or indicator interceptor helper on default AOSP-derived devices.
                </p>
              )}
              {config.hookExample === 'volume' && (
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Hooks deep inside the audio subsystem volume controls overlay.
                </p>
              )}
              {config.hookExample === 'simple' && (
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Plain implementation of the load package pipeline so you can specify your own.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Module Name */}
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Module App Title
              </label>
              <input
                type="text"
                value={config.moduleName}
                onChange={e => handleTextChange('moduleName', e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Island Module"
              />
            </div>

            {/* Min Xposed API Version */}
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Min API Version
              </label>
              <input
                type="number"
                value={config.minXposedVersion}
                onChange={e => handleNumberChange('minXposedVersion', parseInt(e.target.value) || 82)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Module Description */}
          <div>
            <label className="block font-semibold text-zinc-300 mb-1">
              Module UI Description
            </label>
            <input
              type="text"
              value={config.moduleDesc}
              onChange={e => handleTextChange('moduleDesc', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Describe your module..."
            />
          </div>
        </div>
      </div>

      {/* Dynamic Protip */}
      <div className="mt-6 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
        <div className="flex gap-2 items-start text-[11px] leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-emerald-400 block mb-0.5">Xposed Pro-Tip:</span>
            Always verify that <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-[10px]">compileOnly</code> scope is chosen for API dependency in <code className="text-zinc-300">build.gradle.kts</code> so you don't inflate the APK with duplicate standard classes!
          </div>
        </div>
      </div>
    </div>
  );
};
