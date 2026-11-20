import React, { useEffect, useRef, useState } from 'react';
import { ThreeLabEngine } from '../scene/ThreeLabEngine';
import type {
  CameraPresetView,
  CameraProjection,
  LabEnvironmentSettings,
  LabSceneParams,
  PhysicsPresetId,
  PhysicsSnapshot,
  SceneToolMode,
  SelectablePartId,
} from '../types/simulation';
import type { RotationalSimulationState, VectorVisibilityFlags } from '../physics/engine/types';
import { OrientationGizmo } from './OrientationGizmo';
import { PhysicsDataPanel } from './PhysicsDataPanel';
import { SceneToolbar } from './SceneToolbar';
import { SimulationBar } from './SimulationBar';

interface PhysicsViewportProps {
  activePreset: PhysicsPresetId;
  params: LabSceneParams;
  environment: LabEnvironmentSettings;
  simTime: number;
  rotationalSimState: RotationalSimulationState;
  isPlaying: boolean;
  simSpeed: number;
  toolMode: SceneToolMode;
  selectedPart: SelectablePartId;
  cameraProjection: CameraProjection;
  cameraViewTrigger: { view: CameraPresetView; nonce: number };
  physicsSnapshot: PhysicsSnapshot;
  onSelectTool: (mode: SceneToolMode) => void;
  onSelectPart: (part: SelectablePartId) => void;
  onDragSpherePosition: (pos: number) => void;
  onDragForceAngle: (angleDeg: number) => void;
  onToggleGrid: () => void;
  onToggleAxes: () => void;
  onToggleVectors: () => void;
  onToggleVectorLayer: (key: keyof VectorVisibilityFlags) => void;
  onResetView: () => void;
  onToggleProjection: () => void;
  onSelectCameraPreset: (view: CameraPresetView) => void;
  onTogglePlay: () => void;
  onResetSim: () => void;
  onChangeSpeed: (speed: number) => void;
  onScrubTime: (time: number) => void;
}

export const PhysicsViewport: React.FC<PhysicsViewportProps> = ({
  activePreset,
  params,
  environment,
  simTime,
  rotationalSimState,
  isPlaying,
  simSpeed,
  toolMode,
  selectedPart,
  cameraProjection,
  cameraViewTrigger,
  physicsSnapshot,
  onSelectTool,
  onSelectPart,
  onDragSpherePosition,
  onDragForceAngle,
  onToggleGrid,
  onToggleAxes,
  onToggleVectors,
  onToggleVectorLayer,
  onResetView,
  onToggleProjection,
  onSelectCameraPreset,
  onTogglePlay,
  onResetSim,
  onChangeSpeed,
  onScrubTime,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ThreeLabEngine | null>(null);
  const [camQuat, setCamQuat] = useState<[number, number, number, number]>([0, 0, 0, 1]);
  const [dataCollapsed, setDataCollapsed] = useState<boolean>(false);
  const [contextLost, setContextLost] = useState<boolean>(false);

  const callbacksRef = useRef({
    onSelectPart,
    onDragSpherePosition,
    onDragForceAngle,
  });
  callbacksRef.current = {
    onSelectPart,
    onDragSpherePosition,
    onDragForceAngle,
  };

  // Mount Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new ThreeLabEngine(
      container,
      {
        preset: activePreset,
        params,
        environment,
        simTime,
        rotationalSimState,
        toolMode,
        projection: cameraProjection,
        selectedPart,
      },
      {
        onSelectPart: (part) => callbacksRef.current.onSelectPart(part),
        onDragSpherePosition: (pos) => callbacksRef.current.onDragSpherePosition(pos),
        onDragForceAngle: (angle) => callbacksRef.current.onDragForceAngle(angle),
        onCameraOrientation: (q) => setCamQuat(q),
        onContextStatus: (status) => setContextLost(status === 'lost'),
      }
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push reactive scene state to engine
  useEffect(() => {
    engineRef.current?.updateState({
      preset: activePreset,
      params,
      environment,
      simTime,
      rotationalSimState,
      toolMode,
      projection: cameraProjection,
      selectedPart,
    });
  }, [
    activePreset,
    params,
    environment,
    simTime,
    rotationalSimState,
    toolMode,
    cameraProjection,
    selectedPart,
  ]);

  // Camera view preset trigger
  useEffect(() => {
    if (cameraViewTrigger.nonce > 0) {
      engineRef.current?.setCameraPreset(cameraViewTrigger.view);
    }
  }, [cameraViewTrigger]);

  return (
    <div
      data-testid="physics-viewport"
      data-preset={activePreset}
      data-playing={isPlaying ? 'true' : 'false'}
      className="relative flex-1 min-h-0 w-full bg-[#080B11] overflow-hidden"
    >
      {/* Dedicated Empty WebGL Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {contextLost && (
        <div className="absolute inset-0 z-30 bg-[#080B11]/95 flex items-center justify-center p-6">
          <div className="bg-[#0D131F] border border-slate-800 rounded-lg px-5 py-4 text-xs text-slate-300">
            WebGL rendering context suspended. Reloading laboratory surface...
          </div>
        </div>
      )}

      {/* Top Floating Scene Toolbar & Orientation Gizmo Row */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto min-w-0 flex-1 flex">
          <SceneToolbar
            activePreset={activePreset}
            toolMode={toolMode}
            onSelectTool={onSelectTool}
            environment={environment}
            onToggleGrid={onToggleGrid}
            onToggleAxes={onToggleAxes}
            onToggleVectors={onToggleVectors}
            onToggleVectorLayer={onToggleVectorLayer}
            onResetView={onResetView}
            cameraProjection={cameraProjection}
            onToggleProjection={onToggleProjection}
            onSelectCameraPreset={onSelectCameraPreset}
          />
        </div>

        <div className="pointer-events-auto shrink-0">
          <OrientationGizmo
            cameraQuaternion={camQuat}
            onSnapAxis={(axis) => engineRef.current?.snapToAxis(axis)}
          />
        </div>
      </div>

      {/* Bottom-Left Physics Data Panel */}
      <div
        className="absolute bottom-16 left-3 z-10 pointer-events-auto hidden sm:flex flex-col justify-end overflow-hidden"
        style={{ maxHeight: 'calc(100% - 7.5rem)' }}
      >
        <PhysicsDataPanel
          collapsed={dataCollapsed}
          onToggleCollapse={() => setDataCollapsed((c) => !c)}
          snapshot={physicsSnapshot}
        />
      </div>

      {/* Bottom Centered Simulation Control Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full flex justify-center">
          <SimulationBar
            activePreset={activePreset}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onReset={onResetSim}
            simSpeed={simSpeed}
            onChangeSpeed={onChangeSpeed}
            simTime={simTime}
            loopDuration={environment.loopDuration}
            onScrubTime={onScrubTime}
          />
        </div>
      </div>
    </div>
  );
};
