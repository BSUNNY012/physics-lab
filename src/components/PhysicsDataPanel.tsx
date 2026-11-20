import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import type { PhysicsSnapshot } from '../types/simulation';
import { formatPhysicsNumber } from '../utils/numericInput';

interface PhysicsDataPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  snapshot: PhysicsSnapshot;
}

const ACCENT_BAR: Record<string, string> = {
  cyan: 'text-cyan-300',
  blue: 'text-blue-300',
  violet: 'text-violet-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  neutral: 'text-slate-100',
};

export const PhysicsDataPanel: React.FC<PhysicsDataPanelProps> = ({
  collapsed,
  onToggleCollapse,
  snapshot,
}) => {
  const [showFormulas, setShowFormulas] = useState(false);
  const rot = snapshot.rotationalDetails;
  const blk = snapshot.blockSurfaceDetails;

  return (
    <section
      aria-label="Calculated Physics Telemetry"
      className="bg-[#0D131F]/95 border border-slate-800/90 rounded-lg shadow-lg overflow-hidden w-72 select-none flex flex-col max-h-full"
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-medium text-slate-200 hover:bg-slate-800/50 transition-colors shrink-0"
      >
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>Physics Data</span>
        </span>
        {collapsed ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 pt-1.5 border-t border-slate-800/70 space-y-1.5 flex-1 min-h-0 overflow-y-auto lab-scroll">
          {rot?.warningMessage && (
            <div
              role="alert"
              className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-snug"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{rot.warningMessage}</span>
            </div>
          )}

          {blk?.isLiftedOff && (
            <div
              role="alert"
              className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-snug"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Vertical pull F_y exceeds weight mg: block lifts off surface (N = 0).</span>
            </div>
          )}

          {rot ? (
            <>
              {/* Dynamic Computed Outputs (Primary) */}
              <div className="space-y-1">
                <div
                  data-testid="physics-readout-inertia"
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 truncate">Moment of Inertia (I)</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR.blue}`}>
                      {rot.isValid ? formatPhysicsNumber(rot.totalMomentOfInertia) : 'Undefined'}
                    </span>
                    {rot.isValid && <span className="text-[10px] text-slate-500 ml-1">kg·m²</span>}
                  </span>
                </div>

                <div
                  data-testid="physics-readout-torque"
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 truncate">Net Torque (τ)</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR.cyan}`}>
                      {rot.isValid ? formatPhysicsNumber(rot.netTorque) : 'Undefined'}
                    </span>
                    {rot.isValid && <span className="text-[10px] text-slate-500 ml-1">N·m</span>}
                  </span>
                </div>

                <div
                  data-testid="physics-readout-alpha"
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 truncate">Angular Accel (α)</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR.violet}`}>
                      {rot.isValid ? formatPhysicsNumber(rot.angularAcceleration) : 'Undefined'}
                    </span>
                    {rot.isValid && <span className="text-[10px] text-slate-500 ml-1">rad/s²</span>}
                  </span>
                </div>

                <div
                  data-testid="physics-readout-omega"
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 truncate">Angular Vel (ω)</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR.emerald}`}>
                      {formatPhysicsNumber(rot.angularVelocity)}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">rad/s</span>
                  </span>
                </div>

                <div
                  data-testid="physics-readout-angle"
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-slate-400 truncate">Angular Disp (Δθ)</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR.neutral}`}>
                      {formatPhysicsNumber(rot.angularDisplacementDeg)}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">deg</span>
                  </span>
                </div>
              </div>

              {/* System Parameters Summary */}
              <div className="pt-1.5 border-t border-slate-800/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">m</span>
                  <span className="font-mono-tabular text-slate-300">
                    {formatPhysicsNumber(rot.mass)} <span className="text-[10px] text-slate-500">kg</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">L</span>
                  <span className="font-mono-tabular text-slate-300">
                    {formatPhysicsNumber(rot.length)} <span className="text-[10px] text-slate-500">m</span>
                  </span>
                </div>
                <div
                  data-testid="physics-readout-force"
                  className="flex items-baseline justify-between gap-1"
                >
                  <span className="text-slate-500">F</span>
                  <span className="font-mono-tabular text-amber-300">
                    {formatPhysicsNumber(rot.forceMagnitude)} <span className="text-[10px] text-slate-500">N</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">θ_F</span>
                  <span className="font-mono-tabular text-slate-300">
                    {formatPhysicsNumber(rot.forceAngleDeg)} <span className="text-[10px] text-slate-500">deg</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">r</span>
                  <span className="font-mono-tabular text-cyan-300">
                    {formatPhysicsNumber(rot.effectiveLeverArm)} <span className="text-[10px] text-slate-500">m</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">r⊥</span>
                  <span className="font-mono-tabular text-sky-300">
                    {formatPhysicsNumber(rot.perpendicularDistance)} <span className="text-[10px] text-slate-500">m</span>
                  </span>
                </div>
              </div>

              {/* Active Physical Effects Indicator */}
              <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>
                  Gravity:{' '}
                  <span className={rot.gravityActive ? 'text-cyan-300' : 'text-slate-500'}>
                    {rot.gravityActive ? 'On' : 'Off'}
                  </span>
                </span>
                <span>
                  Damping:{' '}
                  <span className={rot.dampingActive ? 'text-cyan-300' : 'text-slate-500'}>
                    {rot.dampingActive ? 'On' : 'Off'}
                  </span>
                </span>
              </div>

              {/* Expandable Live Formula Substitution */}
              <div className="pt-1 border-t border-slate-800/70">
                <button
                  type="button"
                  onClick={() => setShowFormulas((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 transition-colors py-0.5"
                >
                  <span>Formulas &amp; Substitution</span>
                  {showFormulas ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {showFormulas && (
                  <div className="mt-1.5 space-y-1.5 text-[10px] font-mono text-slate-300 bg-[#080C14] border border-slate-800/80 rounded p-2">
                    <div>
                      <div className="text-slate-500">
                        {rot.pivotOffset === 0 && rot.sphereMass === 0
                          ? 'I = (1/3)·m·L²'
                          : 'I = (1/12)·m·L² + m·d² + m_s·r_s²'}
                      </div>
                      <div className="text-blue-300">
                        I = {formatPhysicsNumber(rot.totalMomentOfInertia)} kg·m²
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">τ_F = r · F · sin(θ_F)</div>
                      <div className="text-cyan-300">
                        = {formatPhysicsNumber(rot.effectiveLeverArm)} ·{' '}
                        {formatPhysicsNumber(rot.forceMagnitude)} · sin(
                        {formatPhysicsNumber(rot.forceAngleDeg)}°) ={' '}
                        {formatPhysicsNumber(rot.appliedTorque)} N·m
                      </div>
                    </div>
                    {rot.gravityActive && (
                      <div className="text-slate-400">
                        τ_g = {formatPhysicsNumber(rot.gravityTorque)} N·m
                      </div>
                    )}
                    {rot.dampingActive && (
                      <div className="text-slate-400">
                        τ_d = {formatPhysicsNumber(rot.dampingTorque)} N·m
                      </div>
                    )}
                    <div>
                      <div className="text-slate-500">α = τ_net / I</div>
                      <div className="text-violet-300">
                        = {formatPhysicsNumber(rot.netTorque)} /{' '}
                        {formatPhysicsNumber(rot.totalMomentOfInertia)} ={' '}
                        {rot.isValid ? formatPhysicsNumber(rot.angularAcceleration) : 'Undefined'}{' '}
                        rad/s²
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : blk ? (
            <>
              <div className="space-y-1">
                {snapshot.primaryReadouts.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`physics-readout-${item.id}`}
                    className="flex items-baseline justify-between gap-2 text-xs py-0.5"
                  >
                    <span className="text-slate-400 truncate">{item.label}</span>
                    <span className="font-mono-tabular shrink-0">
                      <span className={`font-semibold ${ACCENT_BAR[item.accent ?? 'neutral']}`}>
                        {item.value}
                      </span>
                      {item.unit && (
                        <span className="text-[10px] text-slate-500 ml-1">{item.unit}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-1.5 border-t border-slate-800/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">F_x</span>
                  <span className="font-mono-tabular text-amber-300">
                    {formatPhysicsNumber(blk.fx)} <span className="text-[10px] text-slate-500">N</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">F_y</span>
                  <span className="font-mono-tabular text-amber-300">
                    {formatPhysicsNumber(blk.fy)} <span className="text-[10px] text-slate-500">N</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">mg</span>
                  <span className="font-mono-tabular text-violet-300">
                    {formatPhysicsNumber(blk.weight)} <span className="text-[10px] text-slate-500">N</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-slate-500">f_max</span>
                  <span className="font-mono-tabular text-emerald-300">
                    {formatPhysicsNumber(blk.maxStaticFriction)}{' '}
                    <span className="text-[10px] text-slate-500">N</span>
                  </span>
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>
                  Regime:{' '}
                  <span className="text-cyan-300">
                    {blk.isLiftedOff
                      ? 'Lifted Off'
                      : blk.isStaticEquilibrium
                      ? 'Static Equilibrium'
                      : 'Kinetic Sliding'}
                  </span>
                </span>
                <span>Δx = {formatPhysicsNumber(blk.displacementX)} m</span>
              </div>

              <div className="pt-1 border-t border-slate-800/70">
                <button
                  type="button"
                  onClick={() => setShowFormulas((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 transition-colors py-0.5"
                >
                  <span>Formulas &amp; Substitution</span>
                  {showFormulas ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {showFormulas && (
                  <div className="mt-1.5 space-y-1.5 text-[10px] font-mono text-slate-300 bg-[#080C14] border border-slate-800/80 rounded p-2">
                    <div>
                      <div className="text-slate-500">N = max(0, m·g - F·sin(θ))</div>
                      <div className="text-cyan-300">
                        N = {formatPhysicsNumber(blk.normalForce)} N
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">a_x = (F·cos(θ) + f) / m</div>
                      <div className="text-violet-300">
                        = ({formatPhysicsNumber(blk.fx)} + {formatPhysicsNumber(blk.frictionForce)})
                        / {formatPhysicsNumber(blk.mass)} = {formatPhysicsNumber(blk.accelerationX)}{' '}
                        m/s²
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              {snapshot.primaryReadouts.map((item) => (
                <div
                  key={item.id}
                  data-testid={`physics-readout-${item.id}`}
                  className="flex items-baseline justify-between gap-2 text-xs py-0.5"
                >
                  <span className="text-slate-400 truncate">{item.label}</span>
                  <span className="font-mono-tabular shrink-0">
                    <span className={`font-semibold ${ACCENT_BAR[item.accent ?? 'neutral']}`}>
                      {item.value}
                    </span>
                    {item.unit && (
                      <span className="text-[10px] text-slate-500 ml-1">{item.unit}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
