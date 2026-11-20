import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { PhysicsPresetId } from '../types/simulation';

interface SimulationBarProps {
  activePreset: PhysicsPresetId;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  simSpeed: number;
  onChangeSpeed: (speed: number) => void;
  simTime: number;
  loopDuration: number;
  onScrubTime: (time: number) => void;
}

const SPEED_OPTIONS = [0.1, 0.25, 0.5, 1, 2, 5];

export const SimulationBar: React.FC<SimulationBarProps> = ({
  activePreset,
  isPlaying,
  onTogglePlay,
  onReset,
  simSpeed,
  onChangeSpeed,
  simTime,
  loopDuration,
  onScrubTime,
}) => {
  // For rotational RK4 simulation, allow continuous time progression beyond loopDuration
  const effectiveMax =
    activePreset === 'rotational'
      ? Math.max(loopDuration, Math.ceil((simTime + 2) / 10) * 10)
      : loopDuration;
  const clampedSliderVal = Math.min(effectiveMax, Math.max(0, simTime));

  return (
    <div
      role="region"
      aria-label="Simulation Playback Controls"
      className="bg-[#0D131F]/95 border border-slate-800/90 rounded-lg px-3 py-2 shadow-lg flex items-center gap-3 w-full max-w-2xl"
    >
      {/* Play / Pause & Reset */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          aria-label="Reset simulation"
          title="Reset simulation"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-[#131B2B] hover:bg-[#192438] border border-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Timeline Scrubber */}
      <div className="flex-1 min-w-[100px] flex items-center gap-2.5">
        <label htmlFor="sim-timeline-scrubber" className="sr-only">
          Simulation timeline
        </label>
        <input
          id="sim-timeline-scrubber"
          type="range"
          min={0}
          max={effectiveMax}
          step={0.02}
          value={clampedSliderVal}
          onChange={(e) => onScrubTime(Number(e.target.value))}
          className="lab-slider w-full"
        />
        <span
          data-testid="sim-time-readout"
          className="font-mono-tabular text-xs text-slate-200 w-16 text-right shrink-0"
        >
          {simTime.toFixed(2)} s
        </span>
      </div>

      {/* Speed Selector */}
      <div className="flex items-center gap-1.5 shrink-0 border-l border-slate-800 pl-2.5">
        <label htmlFor="sim-speed-select" className="text-[11px] text-slate-400 hidden sm:inline">
          Speed
        </label>
        <select
          id="sim-speed-select"
          aria-label="Simulation speed"
          value={simSpeed}
          onChange={(e) => onChangeSpeed(Number(e.target.value))}
          className="bg-[#121A29] border border-slate-700/80 rounded px-2 py-1 text-xs font-mono-tabular text-slate-200 outline-none focus:border-cyan-500/60 cursor-pointer"
        >
          {SPEED_OPTIONS.map((sp) => (
            <option key={sp} value={sp}>
              {sp}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
