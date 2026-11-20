import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { LabEnvironmentSettings } from '../types/simulation';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  environment: LabEnvironmentSettings;
  onUpdateEnvironment: (patch: Partial<LabEnvironmentSettings>) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  environment,
  onUpdateEnvironment,
  onResetDefaults,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    >
      <div className="bg-[#0E1420] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 id="settings-modal-title" className="font-display text-sm font-semibold text-slate-100">
            Laboratory Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-slate-200">Floor Grid Density</div>
              <div className="text-slate-500">Coordinate spacing on optical bench</div>
            </div>
            <select
              aria-label="Floor grid density"
              value={environment.gridDensity}
              onChange={(e) =>
                onUpdateEnvironment({
                  gridDensity: e.target.value as 'standard' | 'fine',
                })
              }
              className="bg-[#141D2E] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
            >
              <option value="standard">Standard (1.0 m)</option>
              <option value="fine">Fine (0.5 m)</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-slate-200">Angle Display Units</div>
              <div className="text-slate-500">Units used in inspector and readouts</div>
            </div>
            <select
              aria-label="Angle display units"
              value={environment.angleUnit}
              onChange={(e) =>
                onUpdateEnvironment({
                  angleUnit: e.target.value as 'deg' | 'rad',
                })
              }
              className="bg-[#141D2E] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
            >
              <option value="deg">Degrees (deg)</option>
              <option value="rad">Radians (rad)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="settings-vector-scale" className="font-medium text-slate-200">
                Vector Arrow Scale
              </label>
              <span className="font-mono-tabular text-cyan-300">
                {environment.vectorScale.toFixed(2)}x
              </span>
            </div>
            <input
              id="settings-vector-scale"
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={environment.vectorScale}
              onChange={(e) =>
                onUpdateEnvironment({ vectorScale: Number(e.target.value) })
              }
              className="lab-slider w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="settings-loop-duration" className="font-medium text-slate-200">
                Cycle Duration
              </label>
              <span className="font-mono-tabular text-cyan-300">
                {environment.loopDuration} s
              </span>
            </div>
            <input
              id="settings-loop-duration"
              type="range"
              min={4}
              max={20}
              step={1}
              value={environment.loopDuration}
              onChange={(e) =>
                onUpdateEnvironment({ loopDuration: Number(e.target.value) })
              }
              className="lab-slider w-full"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-[#0A0F18] border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onResetDefaults();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Workspace Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
