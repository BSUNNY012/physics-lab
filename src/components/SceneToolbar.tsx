import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Axis3d,
  Camera,
  ChevronDown,
  Grid3x3,
  MousePointer,
  Move,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import type { VectorVisibilityFlags } from '../physics/engine/types';
import type {
  CameraPresetView,
  CameraProjection,
  LabEnvironmentSettings,
  PhysicsPresetId,
  SceneToolMode,
} from '../types/simulation';

interface SceneToolbarProps {
  activePreset: PhysicsPresetId;
  toolMode: SceneToolMode;
  onSelectTool: (mode: SceneToolMode) => void;
  environment: LabEnvironmentSettings;
  onToggleGrid: () => void;
  onToggleAxes: () => void;
  onToggleVectors: () => void;
  onToggleVectorLayer: (key: keyof VectorVisibilityFlags) => void;
  onResetView: () => void;
  cameraProjection: CameraProjection;
  onToggleProjection: () => void;
  onSelectCameraPreset: (view: CameraPresetView) => void;
}

const VECTOR_ITEMS: Array<{ key: keyof VectorVisibilityFlags; label: string; dot: string }> = [
  { key: 'appliedForce', label: 'Applied Force (F)', dot: 'bg-amber-400' },
  { key: 'leverArm', label: 'Lever Arm (r)', dot: 'bg-cyan-400' },
  { key: 'perpendicularDistance', label: 'Perpendicular Arm (r⊥)', dot: 'bg-sky-400' },
  { key: 'torqueVector', label: 'Torque Vector (τ)', dot: 'bg-violet-400' },
  { key: 'rotationDirection', label: 'Rotation Arc (ω/α)', dot: 'bg-emerald-400' },
];

export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  activePreset,
  toolMode,
  onSelectTool,
  environment,
  onToggleGrid,
  onToggleAxes,
  onToggleVectors,
  onToggleVectorLayer,
  onResetView,
  cameraProjection,
  onToggleProjection,
  onSelectCameraPreset,
}) => {
  const [vectorMenuOpen, setVectorMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!vectorMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVectorMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [vectorMenuOpen]);

  const toolButtonClass = (active: boolean) =>
    `inline-flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
      active
        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
    }`;

  return (
    <div
      role="toolbar"
      aria-label="3D Scene Toolbar"
      className="relative flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-[#0D131F]/95 border border-slate-800/90 shadow-lg flex-nowrap max-w-full"
    >
      {/* Manipulation Tools */}
      <button
        type="button"
        onClick={() => onSelectTool('select')}
        aria-pressed={toolMode === 'select'}
        title="Select object in 3D scene"
        className={toolButtonClass(toolMode === 'select')}
      >
        <MousePointer className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">Select</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectTool('move')}
        aria-pressed={toolMode === 'move'}
        title="Move sphere mass along rod"
        className={toolButtonClass(toolMode === 'move')}
      >
        <Move className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">Move</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectTool('rotate')}
        aria-pressed={toolMode === 'rotate'}
        title="Rotate force vector angle"
        className={toolButtonClass(toolMode === 'rotate')}
      >
        <RotateCw className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">Rotate</span>
      </button>

      <div className="w-px h-4 bg-slate-800 mx-0.5 shrink-0" aria-hidden="true" />

      {/* Visibility Toggles */}
      <button
        type="button"
        onClick={onToggleGrid}
        aria-pressed={environment.showGrid}
        title="Toggle floor grid"
        className={toolButtonClass(environment.showGrid)}
      >
        <Grid3x3 className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={onToggleAxes}
        aria-pressed={environment.showAxes}
        title="Toggle X/Y/Z axes"
        className={toolButtonClass(environment.showAxes)}
      >
        <Axis3d className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Axes</span>
      </button>

      <div ref={menuRef} className="relative flex items-center shrink-0">
        <button
          type="button"
          onClick={onToggleVectors}
          aria-pressed={environment.showForceVectors}
          title="Toggle all scientific vectors"
          className={toolButtonClass(environment.showForceVectors)}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Vectors</span>
        </button>
        {activePreset === 'rotational' && (
          <button
            type="button"
            onClick={() => setVectorMenuOpen((o) => !o)}
            aria-label="Vector overlay layers"
            aria-expanded={vectorMenuOpen}
            title="Toggle individual vector layers"
            className={`p-1 rounded text-[11px] transition-colors shrink-0 ${
              vectorMenuOpen
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}

        {vectorMenuOpen && activePreset === 'rotational' && (
          <div
            role="menu"
            aria-label="Vector Visibility Layers"
            className="absolute top-full left-0 mt-1.5 w-52 bg-[#0D131F] border border-slate-800 rounded-lg shadow-xl p-2 space-y-1.5 z-30"
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
              Vector Overlays
            </div>
            {VECTOR_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 px-1 py-0.5 rounded hover:bg-slate-800/50 text-[11px] text-slate-200 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <input
                  type="checkbox"
                  checked={environment.vectorVisibility[item.key]}
                  onChange={() => onToggleVectorLayer(item.key)}
                  className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer shrink-0"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-800 mx-0.5 shrink-0" aria-hidden="true" />

      {/* Camera Controls */}
      <button
        type="button"
        onClick={onResetView}
        aria-label="Reset View"
        title="Reset camera view"
        className={toolButtonClass(false)}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Reset</span>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <Camera className="w-3.5 h-3.5 text-slate-400 ml-0.5 hidden 2xl:block" aria-hidden="true" />
        <select
          aria-label="Camera view preset"
          defaultValue="isometric"
          onChange={(e) => onSelectCameraPreset(e.target.value as CameraPresetView)}
          className="bg-[#121A29] border border-slate-700/80 rounded px-1.5 py-1 text-[11px] text-slate-200 outline-none focus:border-cyan-500/60 cursor-pointer"
        >
          <option value="isometric">Isometric</option>
          <option value="front">Front (XY)</option>
          <option value="top">Top (XZ)</option>
          <option value="side">Side (YZ)</option>
        </select>

        <button
          type="button"
          onClick={onToggleProjection}
          title="Switch Perspective / Orthographic camera"
          className="px-1.5 py-1 rounded text-[11px] font-mono-tabular font-medium bg-[#121A29] hover:bg-[#192338] text-slate-200 border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
        >
          {cameraProjection === 'perspective' ? 'Persp' : 'Ortho'}
        </button>
      </div>
    </div>
  );
};
