import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { DEFAULT_SCENE_PARAMS } from '../physics/calculations';
import type { VectorVisibilityFlags } from '../physics/engine/types';
import type {
  LabEnvironmentSettings,
  LabSceneParams,
  PhysicsPresetId,
  SelectablePartId,
} from '../types/simulation';
import { AdaptiveParamControl } from './AdaptiveParamControl';

interface InspectorPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activePreset: PhysicsPresetId;
  selectedPart: SelectablePartId;
  params: LabSceneParams;
  onUpdateParams: <K extends PhysicsPresetId>(
    preset: K,
    patch: Partial<LabSceneParams[K]>
  ) => void;
  environment: LabEnvironmentSettings;
  onUpdateEnvironment: (patch: Partial<LabEnvironmentSettings>) => void;
  onToggleVectorLayer: (key: keyof VectorVisibilityFlags) => void;
  hasQuestionBaseline?: boolean;
  onResetToQuestion?: () => void;
}

interface AccordionSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  open,
  onToggle,
  children,
}) => (
  <div className="border-b border-slate-800/80">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-medium text-slate-200 hover:bg-slate-800/40 transition-colors"
    >
      <span>{title}</span>
      {open ? (
        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      )}
    </button>
    {open && <div className="px-3.5 pb-3 pt-0.5 space-y-3">{children}</div>}
  </div>
);

const VECTOR_LAYERS: Array<{ key: keyof VectorVisibilityFlags; label: string; color: string }> = [
  { key: 'appliedForce', label: 'Applied Force (F)', color: 'bg-amber-400' },
  { key: 'leverArm', label: 'Lever Arm (r)', color: 'bg-cyan-400' },
  { key: 'perpendicularDistance', label: 'Perp Distance (r⊥)', color: 'bg-sky-400' },
  { key: 'torqueVector', label: 'Torque Vector (τ)', color: 'bg-violet-400' },
  { key: 'rotationDirection', label: 'Rotation Arc (ω/α)', color: 'bg-emerald-400' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  collapsed,
  onToggleCollapse,
  activePreset,
  selectedPart,
  params,
  onUpdateParams,
  environment,
  onUpdateEnvironment,
  onToggleVectorLayer,
  hasQuestionBaseline = false,
  onResetToQuestion,
}) => {
  const [sectionsOpen, setSectionsOpen] = useState({
    geometry: true,
    forces: true,
    motion: true,
    environment: false,
  });

  const toggleSection = (key: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rot = params.rotational;
  const roll = params.rolling;
  const pul = params.pulley;
  const col = params.collisions;
  const osc = params.oscillations;
  const blk = params.block_surface;

  const defRot = DEFAULT_SCENE_PARAMS.rotational;
  const defRoll = DEFAULT_SCENE_PARAMS.rolling;
  const defPul = DEFAULT_SCENE_PARAMS.pulley;
  const defCol = DEFAULT_SCENE_PARAMS.collisions;
  const defOsc = DEFAULT_SCENE_PARAMS.oscillations;
  const defBlk = DEFAULT_SCENE_PARAMS.block_surface;

  const maxRodForceDist = Math.max(0, rot.rodLength - rot.pivotOffset);
  const isForceDistClampedToRod =
    !rot.allowExternalApplication && rot.forceDistance > maxRodForceDist + 1e-12;

  return (
    <aside
      aria-label="Object Properties Inspector"
      className={`shrink-0 bg-[#0B101A] border-l border-slate-800/90 flex flex-col transition-[width] duration-200 ease-out z-20 ${
        collapsed ? 'w-11' : 'w-80'
      }`}
    >
      {/* Inspector Header */}
      <div className="h-10 px-2.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand inspector' : 'Collapse inspector'}
          title={collapsed ? 'Expand inspector' : 'Collapse inspector'}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {!collapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0 ml-2">
            <span className="text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 truncate">
              <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Object Properties</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400/80 capitalize shrink-0">
              {selectedPart.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {!collapsed && hasQuestionBaseline && onResetToQuestion && (
        <div className="px-3.5 py-2 border-b border-slate-800/80 bg-cyan-500/5 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 truncate">Question Baseline Active</span>
          <button
            type="button"
            onClick={onResetToQuestion}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Question</span>
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="flex-1 overflow-y-auto lab-scroll">
          {/* GEOMETRY SECTION */}
          <AccordionSection
            title="Geometry"
            open={sectionsOpen.geometry}
            onToggle={() => toggleSection('geometry')}
          >
            {activePreset === 'rotational' && (
              <>
                <AdaptiveParamControl
                  id="param-rod-length"
                  label="Rod length (L)"
                  value={rot.rodLength}
                  defaultValue={defRot.rodLength}
                  unit="m"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('rotational', { rodLength: val })}
                />
                <AdaptiveParamControl
                  id="param-rod-mass"
                  label="Rod mass (m)"
                  value={rot.rodMass}
                  defaultValue={defRot.rodMass}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('rotational', { rodMass: val })}
                />
                <AdaptiveParamControl
                  id="param-sphere-mass"
                  label="Sphere mass"
                  value={rot.sphereMass}
                  defaultValue={defRot.sphereMass}
                  unit="kg"
                  allowZero={true}
                  supportsLog
                  onChange={(val) => onUpdateParams('rotational', { sphereMass: val })}
                />
                <AdaptiveParamControl
                  id="param-sphere-pos"
                  label="Sphere position"
                  value={rot.spherePosition}
                  defaultValue={defRot.spherePosition}
                  unit="m"
                  allowZero={true}
                  fixedMin={0}
                  fixedMax={Math.max(0.1, rot.rodLength)}
                  disabled={rot.sphereMass <= 0}
                  onChange={(val) => onUpdateParams('rotational', { spherePosition: val })}
                />
              </>
            )}

            {activePreset === 'rolling' && (
              <>
                <AdaptiveParamControl
                  id="param-incline-angle"
                  label="Incline angle"
                  value={roll.inclineAngle}
                  defaultValue={defRoll.inclineAngle}
                  unit="deg"
                  allowZero={false}
                  fixedMin={1}
                  fixedMax={85}
                  defaultStep={1}
                  onChange={(val) => onUpdateParams('rolling', { inclineAngle: val })}
                />
                <AdaptiveParamControl
                  id="param-cylinder-mass"
                  label="Cylinder mass"
                  value={roll.cylinderMass}
                  defaultValue={defRoll.cylinderMass}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('rolling', { cylinderMass: val })}
                />
                <AdaptiveParamControl
                  id="param-cylinder-radius"
                  label="Cylinder radius"
                  value={roll.cylinderRadius}
                  defaultValue={defRoll.cylinderRadius}
                  unit="m"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('rolling', { cylinderRadius: val })}
                />
                <AdaptiveParamControl
                  id="param-ramp-length"
                  label="Ramp length"
                  value={roll.rampLength}
                  defaultValue={defRoll.rampLength}
                  unit="m"
                  allowZero={false}
                  minPositive={1e-6}
                  supportsLog
                  onChange={(val) => onUpdateParams('rolling', { rampLength: val })}
                />
              </>
            )}

            {activePreset === 'pulley' && (
              <>
                <AdaptiveParamControl
                  id="param-mass-left"
                  label="Left mass (m₁)"
                  value={pul.massLeft}
                  defaultValue={defPul.massLeft}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('pulley', { massLeft: val })}
                />
                <AdaptiveParamControl
                  id="param-mass-right"
                  label="Right mass (m₂)"
                  value={pul.massRight}
                  defaultValue={defPul.massRight}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('pulley', { massRight: val })}
                />
                <AdaptiveParamControl
                  id="param-pulley-mass"
                  label="Pulley mass"
                  value={pul.pulleyMass}
                  defaultValue={defPul.pulleyMass}
                  unit="kg"
                  allowZero={true}
                  supportsLog
                  onChange={(val) => onUpdateParams('pulley', { pulleyMass: val })}
                />
                <AdaptiveParamControl
                  id="param-pulley-radius"
                  label="Pulley radius"
                  value={pul.pulleyRadius}
                  defaultValue={defPul.pulleyRadius}
                  unit="m"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('pulley', { pulleyRadius: val })}
                />
              </>
            )}

            {activePreset === 'collisions' && (
              <>
                <AdaptiveParamControl
                  id="param-mass-a"
                  label="Glider A mass"
                  value={col.massA}
                  defaultValue={defCol.massA}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('collisions', { massA: val })}
                />
                <AdaptiveParamControl
                  id="param-mass-b"
                  label="Glider B mass"
                  value={col.massB}
                  defaultValue={defCol.massB}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('collisions', { massB: val })}
                />
              </>
            )}

            {activePreset === 'oscillations' && (
              <>
                <AdaptiveParamControl
                  id="param-pendulum-length"
                  label="String length"
                  value={osc.pendulumLength}
                  defaultValue={defOsc.pendulumLength}
                  unit="m"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('oscillations', { pendulumLength: val })}
                />
                <AdaptiveParamControl
                  id="param-bob-mass"
                  label="Bob mass"
                  value={osc.bobMass}
                  defaultValue={defOsc.bobMass}
                  unit="kg"
                  allowZero={false}
                  minPositive={1e-12}
                  supportsLog
                  onChange={(val) => onUpdateParams('oscillations', { bobMass: val })}
                />
              </>
            )}

            {activePreset === 'block_surface' && (
              <AdaptiveParamControl
                id="param-block-mass"
                label="Block mass (m)"
                value={blk.mass}
                defaultValue={defBlk.mass}
                unit="kg"
                allowZero={false}
                minPositive={1e-12}
                supportsLog
                onChange={(val) => onUpdateParams('block_surface', { mass: val })}
              />
            )}
          </AccordionSection>

          {/* FORCES SECTION */}
          <AccordionSection
            title="Forces"
            open={sectionsOpen.forces}
            onToggle={() => toggleSection('forces')}
          >
            {activePreset === 'rotational' && (
              <>
                <AdaptiveParamControl
                  id="param-force-mag"
                  label="Force magnitude (F)"
                  value={rot.forceMagnitude}
                  defaultValue={defRot.forceMagnitude}
                  unit="N"
                  allowNegative={true}
                  allowZero={true}
                  onChange={(val) => onUpdateParams('rotational', { forceMagnitude: val })}
                />
                <AdaptiveParamControl
                  id="param-force-angle"
                  label="Force angle (θ_F)"
                  value={rot.forceAngle}
                  defaultValue={defRot.forceAngle}
                  unit="deg"
                  allowNegative={true}
                  fixedMin={-180}
                  fixedMax={180}
                  defaultStep={1}
                  onChange={(val) => onUpdateParams('rotational', { forceAngle: val })}
                />
                <div className="space-y-1.5">
                  <AdaptiveParamControl
                    id="param-force-dist"
                    label="App. distance (r)"
                    value={rot.forceDistance}
                    defaultValue={rot.rodLength}
                    unit="m"
                    allowNegative={rot.allowExternalApplication}
                    allowZero={true}
                    fixedMin={rot.allowExternalApplication ? undefined : 0}
                    fixedMax={rot.allowExternalApplication ? undefined : maxRodForceDist}
                    supportsLog={!rot.allowExternalApplication}
                    onChange={(val) => onUpdateParams('rotational', { forceDistance: val })}
                  />
                  {isForceDistClampedToRod && (
                    <p className="text-[10px] font-mono text-amber-400/90 leading-tight">
                      Effective r clamped to rod tip ({maxRodForceDist.toPrecision(4)} m) unless external point is enabled.
                    </p>
                  )}
                  <label className="flex items-center justify-between gap-2 text-[11px] text-slate-400 cursor-pointer pt-0.5">
                    <span>Allow external application point</span>
                    <input
                      type="checkbox"
                      checked={rot.allowExternalApplication}
                      onChange={(e) =>
                        onUpdateParams('rotational', {
                          allowExternalApplication: e.target.checked,
                        })
                      }
                      className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="pt-1 border-t border-slate-800/70 space-y-2">
                  <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                    <span>Include Gravity (g)</span>
                    <input
                      type="checkbox"
                      aria-label="Include Gravity"
                      checked={rot.gravityEnabled}
                      onChange={(e) =>
                        onUpdateParams('rotational', { gravityEnabled: e.target.checked })
                      }
                      className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                  <AdaptiveParamControl
                    id="param-gravity-rot"
                    label="Gravity (g)"
                    value={rot.gravity}
                    defaultValue={defRot.gravity}
                    unit="m/s²"
                    allowZero={true}
                    supportsLog
                    disabled={!rot.gravityEnabled}
                    onChange={(val) => onUpdateParams('rotational', { gravity: val })}
                  />
                </div>

                {rot.extraForces && rot.extraForces.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-800/70 space-y-1">
                    <div className="text-[11px] font-medium text-slate-300">
                      Additional Forces ({rot.extraForces.length})
                    </div>
                    {rot.extraForces.map((ef) => (
                      <div
                        key={ef.id}
                        className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#080C14] border border-slate-800/80 rounded px-2 py-1"
                      >
                        <span className="truncate">{ef.label}</span>
                        <span className="text-amber-300 shrink-0">
                          {ef.magnitude} N @ {ef.angle}° (r={ef.distance} m)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activePreset === 'rolling' && (
              <AdaptiveParamControl
                id="param-gravity-roll"
                label="Gravity"
                value={roll.gravity}
                defaultValue={defRoll.gravity}
                unit="m/s²"
                allowZero={true}
                supportsLog
                onChange={(val) => onUpdateParams('rolling', { gravity: val })}
              />
            )}

            {activePreset === 'pulley' && (
              <AdaptiveParamControl
                id="param-gravity-pulley"
                label="Gravity"
                value={pul.gravity}
                defaultValue={defPul.gravity}
                unit="m/s²"
                allowZero={true}
                supportsLog
                onChange={(val) => onUpdateParams('pulley', { gravity: val })}
              />
            )}

            {activePreset === 'collisions' && (
              <AdaptiveParamControl
                id="param-restitution"
                label="Restitution (e)"
                value={col.restitution}
                defaultValue={defCol.restitution}
                unit=""
                allowZero={true}
                fixedMin={0}
                fixedMax={1}
                defaultStep={0.05}
                onChange={(val) => onUpdateParams('collisions', { restitution: val })}
              />
            )}

            {activePreset === 'oscillations' && (
              <AdaptiveParamControl
                id="param-gravity-osc"
                label="Gravity"
                value={osc.gravity}
                defaultValue={defOsc.gravity}
                unit="m/s²"
                allowZero={false}
                minPositive={1e-6}
                supportsLog
                onChange={(val) => onUpdateParams('oscillations', { gravity: val })}
              />
            )}

            {activePreset === 'block_surface' && (
              <>
                <AdaptiveParamControl
                  id="param-block-force"
                  label="Pull force (F)"
                  value={blk.appliedForce}
                  defaultValue={defBlk.appliedForce}
                  unit="N"
                  allowNegative={true}
                  allowZero={true}
                  onChange={(val) => onUpdateParams('block_surface', { appliedForce: val })}
                />
                <AdaptiveParamControl
                  id="param-block-angle"
                  label="Pull angle (θ_F)"
                  value={blk.forceAngle}
                  defaultValue={defBlk.forceAngle}
                  unit="deg"
                  allowNegative={true}
                  fixedMin={-89}
                  fixedMax={89}
                  defaultStep={1}
                  onChange={(val) => onUpdateParams('block_surface', { forceAngle: val })}
                />
                <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer pt-0.5">
                  <span>Rough Surface Friction</span>
                  <input
                    type="checkbox"
                    aria-label="Rough Surface Friction"
                    checked={blk.frictionEnabled}
                    onChange={(e) =>
                      onUpdateParams('block_surface', { frictionEnabled: e.target.checked })
                    }
                    className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                <AdaptiveParamControl
                  id="param-mu-static"
                  label="Static coeff (μ_s)"
                  value={blk.muStatic}
                  defaultValue={defBlk.muStatic}
                  unit=""
                  allowZero={true}
                  fixedMin={0}
                  fixedMax={2}
                  defaultStep={0.05}
                  disabled={!blk.frictionEnabled}
                  onChange={(val) => onUpdateParams('block_surface', { muStatic: val })}
                />
                <AdaptiveParamControl
                  id="param-mu-kinetic"
                  label="Kinetic coeff (μ_k)"
                  value={blk.muKinetic}
                  defaultValue={defBlk.muKinetic}
                  unit=""
                  allowZero={true}
                  fixedMin={0}
                  fixedMax={2}
                  defaultStep={0.05}
                  disabled={!blk.frictionEnabled}
                  onChange={(val) => onUpdateParams('block_surface', { muKinetic: val })}
                />
                <AdaptiveParamControl
                  id="param-gravity-block"
                  label="Gravity (g)"
                  value={blk.gravity}
                  defaultValue={defBlk.gravity}
                  unit="m/s²"
                  allowZero={true}
                  supportsLog
                  onChange={(val) => onUpdateParams('block_surface', { gravity: val })}
                />
              </>
            )}
          </AccordionSection>

          {/* MOTION SECTION */}
          <AccordionSection
            title="Motion"
            open={sectionsOpen.motion}
            onToggle={() => toggleSection('motion')}
          >
            {activePreset === 'rotational' && (
              <>
                <AdaptiveParamControl
                  id="param-pivot-pos"
                  label="Pivot offset"
                  value={rot.pivotOffset}
                  defaultValue={defRot.pivotOffset}
                  unit="m"
                  allowNegative={rot.allowExternalApplication}
                  allowZero={true}
                  fixedMin={rot.allowExternalApplication ? undefined : 0}
                  fixedMax={rot.allowExternalApplication ? undefined : rot.rodLength * 0.5}
                  onChange={(val) => onUpdateParams('rotational', { pivotOffset: val })}
                />
                <AdaptiveParamControl
                  id="param-omega"
                  label="Initial ω₀"
                  value={rot.initialAngularVelocity}
                  defaultValue={defRot.initialAngularVelocity}
                  unit="rad/s"
                  allowNegative={true}
                  allowZero={true}
                  onChange={(val) =>
                    onUpdateParams('rotational', { initialAngularVelocity: val })
                  }
                />
                <AdaptiveParamControl
                  id="param-init-angle"
                  label="Initial angle θ₀"
                  value={rot.initialAngle}
                  defaultValue={defRot.initialAngle}
                  unit="deg"
                  allowNegative={true}
                  fixedMin={-180}
                  fixedMax={180}
                  defaultStep={1}
                  onChange={(val) => onUpdateParams('rotational', { initialAngle: val })}
                />

                <div className="pt-1 border-t border-slate-800/70 space-y-2">
                  <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                    <span>Include Bearing Damping</span>
                    <input
                      type="checkbox"
                      aria-label="Include Bearing Damping"
                      checked={rot.dampingEnabled}
                      onChange={(e) =>
                        onUpdateParams('rotational', { dampingEnabled: e.target.checked })
                      }
                      className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>
                  <AdaptiveParamControl
                    id="param-damping"
                    label="Damping coeff (c)"
                    value={rot.damping}
                    defaultValue={defRot.damping}
                    unit="N·m·s"
                    allowZero={true}
                    supportsLog
                    disabled={!rot.dampingEnabled}
                    onChange={(val) => onUpdateParams('rotational', { damping: val })}
                  />
                </div>
              </>
            )}

            {activePreset === 'collisions' && (
              <>
                <AdaptiveParamControl
                  id="param-vel-a"
                  label="Initial velocity A"
                  value={col.velocityA}
                  defaultValue={defCol.velocityA}
                  unit="m/s"
                  allowNegative={true}
                  allowZero={true}
                  onChange={(val) => onUpdateParams('collisions', { velocityA: val })}
                />
                <AdaptiveParamControl
                  id="param-vel-b"
                  label="Initial velocity B"
                  value={col.velocityB}
                  defaultValue={defCol.velocityB}
                  unit="m/s"
                  allowNegative={true}
                  allowZero={true}
                  onChange={(val) => onUpdateParams('collisions', { velocityB: val })}
                />
              </>
            )}

            {activePreset === 'oscillations' && (
              <>
                <AdaptiveParamControl
                  id="param-osc-amp"
                  label="Initial amplitude"
                  value={osc.initialAmplitude}
                  defaultValue={defOsc.initialAmplitude}
                  unit="deg"
                  allowZero={true}
                  fixedMin={0}
                  fixedMax={60}
                  defaultStep={1}
                  onChange={(val) => onUpdateParams('oscillations', { initialAmplitude: val })}
                />
                <AdaptiveParamControl
                  id="param-osc-damping"
                  label="Air damping"
                  value={osc.damping}
                  defaultValue={defOsc.damping}
                  unit=""
                  allowZero={true}
                  supportsLog
                  onChange={(val) => onUpdateParams('oscillations', { damping: val })}
                />
              </>
            )}

            {activePreset === 'block_surface' && (
              <AdaptiveParamControl
                id="param-block-v0"
                label="Initial velocity (v₀)"
                value={blk.initialVelocity}
                defaultValue={defBlk.initialVelocity}
                unit="m/s"
                allowNegative={true}
                allowZero={true}
                onChange={(val) => onUpdateParams('block_surface', { initialVelocity: val })}
              />
            )}

            {(activePreset === 'rolling' || activePreset === 'pulley') && (
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Motion is computed directly from Newton&apos;s second law and rotational inertia
                using the playback timeline below.
              </p>
            )}
          </AccordionSection>

          {/* ENVIRONMENT & VECTORS SECTION */}
          <AccordionSection
            title="Environment & Vectors"
            open={sectionsOpen.environment}
            onToggle={() => toggleSection('environment')}
          >
            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Coordinate Floor Grid</span>
                <input
                  type="checkbox"
                  checked={environment.showGrid}
                  onChange={(e) => onUpdateEnvironment({ showGrid: e.target.checked })}
                  className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">X / Y / Z Axes</span>
                <input
                  type="checkbox"
                  checked={environment.showAxes}
                  onChange={(e) => onUpdateEnvironment({ showAxes: e.target.checked })}
                  className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-300">Show Scientific Vectors</span>
                <input
                  type="checkbox"
                  checked={environment.showForceVectors}
                  onChange={(e) =>
                    onUpdateEnvironment({ showForceVectors: e.target.checked })
                  }
                  className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                />
              </label>

              {activePreset === 'rotational' && (
                <div className="pl-2.5 border-l border-slate-800 space-y-1.5 pt-0.5">
                  {VECTOR_LAYERS.map((layer) => (
                    <label
                      key={layer.key}
                      className={`flex items-center justify-between cursor-pointer text-[11px] ${
                        environment.showForceVectors ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${layer.color}`} />
                        <span>{layer.label}</span>
                      </span>
                      <input
                        type="checkbox"
                        disabled={!environment.showForceVectors}
                        checked={environment.vectorVisibility[layer.key]}
                        onChange={() => onToggleVectorLayer(layer.key)}
                        className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}

              <AdaptiveParamControl
                id="env-vector-scale"
                label="Vector scale"
                value={environment.vectorScale}
                defaultValue={1.0}
                unit="x"
                allowZero={false}
                fixedMin={0.4}
                fixedMax={2.5}
                defaultStep={0.1}
                onChange={(val) => onUpdateEnvironment({ vectorScale: val })}
              />
            </div>
          </AccordionSection>
        </div>
      )}
    </aside>
  );
};
