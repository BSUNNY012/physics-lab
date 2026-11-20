import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SCENE_PARAMS,
  getSampleRotationalQuestionParams,
  SAMPLE_PHYSICS_QUESTION,
} from '../physics/calculations';
import {
  createInitialRotationalState,
  simulateRotationalToTime,
  stepRotationalSimulation,
} from '../physics/engine/rotationalDynamics';
import type {
  RotationalSimulationState,
  VectorVisibilityFlags,
} from '../physics/engine/types';
import type { AnalyzedPhysicsProblem } from '../ai/sceneSchema';
import type {
  CameraPresetView,
  CameraProjection,
  LabEnvironmentSettings,
  LabSceneParams,
  PhysicsPresetId,
  RotationalParams,
  SavedExperiment,
  SceneToolMode,
  SelectablePartId,
  SidebarSection,
  WorkspaceSnapshot,
} from '../types/simulation';

export interface QuestionBaseline {
  title: string;
  questionText: string;
  preset: PhysicsPresetId;
  params: LabSceneParams;
  analysis: AnalyzedPhysicsProblem;
}

const STORAGE_EXPERIMENTS_KEY = 'physics_lab_saved_experiments_v1';
const STORAGE_WORKSPACE_KEY = 'physics_lab_active_workspace_v1';

export const DEFAULT_VECTOR_VISIBILITY: VectorVisibilityFlags = {
  appliedForce: true,
  leverArm: true,
  perpendicularDistance: true,
  torqueVector: true,
  rotationDirection: true,
};

export const DEFAULT_ENVIRONMENT: LabEnvironmentSettings = {
  showGrid: true,
  showAxes: true,
  showForceVectors: true,
  vectorVisibility: { ...DEFAULT_VECTOR_VISIBILITY },
  vectorScale: 1.0,
  gridDensity: 'standard',
  angleUnit: 'deg',
  loopDuration: 10,
};

function normalizeRotationalParams(raw?: Partial<RotationalParams>): RotationalParams {
  return {
    ...DEFAULT_SCENE_PARAMS.rotational,
    ...(raw ?? {}),
    forceDistance:
      raw?.forceDistance !== undefined
        ? raw.forceDistance
        : raw?.rodLength ?? DEFAULT_SCENE_PARAMS.rotational.forceDistance,
  };
}

function normalizeSceneParams(raw?: Partial<LabSceneParams>): LabSceneParams {
  return {
    rotational: normalizeRotationalParams(raw?.rotational),
    rolling: { ...DEFAULT_SCENE_PARAMS.rolling, ...(raw?.rolling ?? {}) },
    pulley: { ...DEFAULT_SCENE_PARAMS.pulley, ...(raw?.pulley ?? {}) },
    collisions: { ...DEFAULT_SCENE_PARAMS.collisions, ...(raw?.collisions ?? {}) },
    oscillations: { ...DEFAULT_SCENE_PARAMS.oscillations, ...(raw?.oscillations ?? {}) },
    block_surface: { ...DEFAULT_SCENE_PARAMS.block_surface, ...(raw?.block_surface ?? {}) },
  };
}

function normalizeEnvironment(raw?: Partial<LabEnvironmentSettings>): LabEnvironmentSettings {
  return {
    ...DEFAULT_ENVIRONMENT,
    ...(raw ?? {}),
    vectorVisibility: {
      ...DEFAULT_VECTOR_VISIBILITY,
      ...(raw?.vectorVisibility ?? {}),
    },
  };
}

const SEED_EXPERIMENTS: SavedExperiment[] = [
  {
    id: 'exp-jee-rod-sample',
    name: 'JEE Hinged Rod Torque',
    preset: 'rotational',
    params: {
      ...DEFAULT_SCENE_PARAMS,
      rotational: getSampleRotationalQuestionParams(),
    },
    environment: DEFAULT_ENVIRONMENT,
    savedAt: '2026-11-18T10:30:00Z',
    notes: SAMPLE_PHYSICS_QUESTION,
  },
  {
    id: 'exp-rolling-incline',
    name: 'Cylinder on 30° Incline',
    preset: 'rolling',
    params: {
      ...DEFAULT_SCENE_PARAMS,
      rolling: {
        ...DEFAULT_SCENE_PARAMS.rolling,
        inclineAngle: 30,
        cylinderMass: 4.0,
      },
    },
    environment: DEFAULT_ENVIRONMENT,
    savedAt: '2026-11-18T11:15:00Z',
    notes: 'Solid cylinder rolling without slipping down a 30° plane.',
  },
];

function cloneSnapshot(snap: WorkspaceSnapshot): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snap)) as WorkspaceSnapshot;
}

function loadSavedExperiments(): SavedExperiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_EXPERIMENTS_KEY);
    if (!raw) return SEED_EXPERIMENTS;
    const parsed = JSON.parse(raw) as SavedExperiment[];
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_EXPERIMENTS;
    return parsed.map((exp) => ({
      ...exp,
      params: normalizeSceneParams(exp.params),
      environment: normalizeEnvironment(exp.environment),
    }));
  } catch {
    return SEED_EXPERIMENTS;
  }
}

export function useLabStore() {
  const [workspaceName, setWorkspaceName] = useState<string>('Untitled Simulation');
  const [activeSection, setActiveSection] = useState<SidebarSection>('rotational');
  const [activePreset, setActivePreset] = useState<PhysicsPresetId>('rotational');
  const [params, setParams] = useState<LabSceneParams>(() =>
    JSON.parse(JSON.stringify(DEFAULT_SCENE_PARAMS)) as LabSceneParams
  );
  const [environment, setEnvironment] = useState<LabEnvironmentSettings>(() =>
    normalizeEnvironment(DEFAULT_ENVIRONMENT)
  );

  const [toolMode, setToolMode] = useState<SceneToolMode>('select');
  const [selectedPart, setSelectedPart] = useState<SelectablePartId>('rod');
  const [cameraProjection, setCameraProjection] = useState<CameraProjection>('perspective');
  const [cameraViewTrigger, setCameraViewTrigger] = useState<{
    view: CameraPresetView;
    nonce: number;
  }>({ view: 'isometric', nonce: 0 });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [simTime, setSimTime] = useState<number>(0);
  const [rotationalSimState, setRotationalSimState] = useState<RotationalSimulationState>(() =>
    createInitialRotationalState(DEFAULT_SCENE_PARAMS.rotational)
  );

  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[]>(loadSavedExperiments);
  const [questionBaseline, setQuestionBaseline] = useState<QuestionBaseline | null>(null);

  const [historyPast, setHistoryPast] = useState<WorkspaceSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<WorkspaceSnapshot[]>([]);

  const rotParamsRef = useRef(params.rotational);
  rotParamsRef.current = params.rotational;

  const rotStateRef = useRef(rotationalSimState);
  rotStateRef.current = rotationalSimState;

  const simTimeRef = useRef(simTime);
  simTimeRef.current = simTime;

  const currentSnapshot = useCallback(
    (): WorkspaceSnapshot => ({
      workspaceName,
      activeSection,
      activePreset,
      params,
      environment,
    }),
    [workspaceName, activeSection, activePreset, params, environment]
  );

  const pushHistory = useCallback(() => {
    const snap = cloneSnapshot(currentSnapshot());
    setHistoryPast((prev) => [...prev.slice(-24), snap]);
    setHistoryFuture([]);
    setIsSaved(false);
  }, [currentSnapshot]);

  const applySnapshot = useCallback((snap: WorkspaceSnapshot) => {
    const safeParams = normalizeSceneParams(snap.params);
    const safeEnv = normalizeEnvironment(snap.environment);
    setWorkspaceName(snap.workspaceName);
    setActiveSection(snap.activeSection);
    setActivePreset(snap.activePreset);
    setParams(safeParams);
    setEnvironment(safeEnv);
    setRotationalSimState((prev) =>
      simTimeRef.current <= 0
        ? createInitialRotationalState(safeParams.rotational)
        : prev
    );
    setIsSaved(false);
  }, []);

  const undo = useCallback(() => {
    setHistoryPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setHistoryFuture((fut) => [cloneSnapshot(currentSnapshot()), ...fut.slice(0, 24)]);
      applySnapshot(previous);
      return prev.slice(0, -1);
    });
  }, [applySnapshot, currentSnapshot]);

  const redo = useCallback(() => {
    setHistoryFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setHistoryPast((prev) => [...prev.slice(-24), cloneSnapshot(currentSnapshot())]);
      applySnapshot(next);
      return fut.slice(1);
    });
  }, [applySnapshot, currentSnapshot]);

  const updatePresetParams = useCallback(
    <K extends PhysicsPresetId>(
      preset: K,
      updater: Partial<LabSceneParams[K]> | ((prev: LabSceneParams[K]) => LabSceneParams[K]),
      recordHistory = true
    ) => {
      if (recordHistory) pushHistory();
      else setIsSaved(false);
      setParams((prev) => {
        const nextSection =
          typeof updater === 'function' ? updater(prev[preset]) : { ...prev[preset], ...updater };
        if (preset === 'rotational' && simTimeRef.current <= 0) {
          setRotationalSimState(createInitialRotationalState(nextSection as RotationalParams));
        }
        return {
          ...prev,
          [preset]: nextSection,
        };
      });
    },
    [pushHistory]
  );

  const updateEnvironment = useCallback(
    (patch: Partial<LabEnvironmentSettings>, recordHistory = true) => {
      if (recordHistory) pushHistory();
      else setIsSaved(false);
      setEnvironment((prev) => ({
        ...prev,
        ...patch,
        vectorVisibility: patch.vectorVisibility
          ? { ...prev.vectorVisibility, ...patch.vectorVisibility }
          : prev.vectorVisibility,
      }));
    },
    [pushHistory]
  );

  const toggleVectorVisibility = useCallback(
    (key: keyof VectorVisibilityFlags) => {
      pushHistory();
      setEnvironment((prev) => ({
        ...prev,
        vectorVisibility: {
          ...prev.vectorVisibility,
          [key]: !prev.vectorVisibility[key],
        },
      }));
    },
    [pushHistory]
  );

  const defaultSelectedPartForPreset = (preset: PhysicsPresetId): SelectablePartId => {
    switch (preset) {
      case 'rotational':
        return 'rod';
      case 'rolling':
        return 'cylinder';
      case 'pulley':
        return 'pulley';
      case 'block_surface':
        return 'block';
      default:
        return 'system';
    }
  };

  const selectSidebarSection = useCallback(
    (section: SidebarSection) => {
      pushHistory();
      setActiveSection(section);
      if (
        section === 'rotational' ||
        section === 'rolling' ||
        section === 'pulley' ||
        section === 'collisions' ||
        section === 'oscillations'
      ) {
        setActivePreset(section);
        setSelectedPart(defaultSelectedPartForPreset(section));
        setSimTime(0);
        setIsPlaying(false);
        setRotationalSimState(createInitialRotationalState(rotParamsRef.current));
      } else if (section === 'mechanics') {
        setActivePreset('block_surface');
        setSelectedPart('block');
        setSimTime(0);
        setIsPlaying(false);
      } else if (section === 'workspace') {
        setActivePreset('rotational');
        setSelectedPart('rod');
      }
    },
    [pushHistory]
  );

  const renameWorkspace = useCallback(
    (nextName: string) => {
      const trimmed = nextName.trim() || 'Untitled Simulation';
      if (trimmed !== workspaceName) {
        pushHistory();
        setWorkspaceName(trimmed);
      }
    },
    [pushHistory, workspaceName]
  );

  const saveWorkspace = useCallback(() => {
    const now = new Date().toISOString();
    try {
      const snap = currentSnapshot();
      localStorage.setItem(STORAGE_WORKSPACE_KEY, JSON.stringify(snap));

      const expName = snap.workspaceName || 'Untitled Simulation';
      setSavedExperiments((prev) => {
        const existingIdx = prev.findIndex(
          (e) => e.name.toLowerCase() === expName.toLowerCase() && e.preset === snap.activePreset
        );
        const newEntry: SavedExperiment = {
          id: existingIdx >= 0 ? prev[existingIdx].id : `exp-${Date.now()}`,
          name: expName,
          preset: snap.activePreset,
          params: JSON.parse(JSON.stringify(snap.params)) as LabSceneParams,
          environment: normalizeEnvironment(snap.environment),
          savedAt: now,
        };
        const nextList =
          existingIdx >= 0
            ? prev.map((item, idx) => (idx === existingIdx ? newEntry : item))
            : [newEntry, ...prev];
        localStorage.setItem(STORAGE_EXPERIMENTS_KEY, JSON.stringify(nextList));
        return nextList;
      });
    } catch {
      // Ignore storage quota errors
    }
    setIsSaved(true);
    setLastSavedAt(now);
  }, [currentSnapshot]);

  const loadExperiment = useCallback(
    (experiment: SavedExperiment) => {
      pushHistory();
      const safeParams = normalizeSceneParams(experiment.params);
      setWorkspaceName(experiment.name);
      setActivePreset(experiment.preset);
      setActiveSection(
        experiment.preset === 'block_surface' ? 'mechanics' : experiment.preset
      );
      setParams(safeParams);
      setEnvironment(normalizeEnvironment(experiment.environment));
      setSimTime(0);
      setIsPlaying(false);
      setRotationalSimState(createInitialRotationalState(safeParams.rotational));
      setIsSaved(true);
    },
    [pushHistory]
  );

  const deleteExperiment = useCallback((id: string) => {
    setSavedExperiments((prev) => {
      const next = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_EXPERIMENTS_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const loadSampleRotationalProblem = useCallback(() => {
    pushHistory();
    const sample = getSampleRotationalQuestionParams();
    setActivePreset('rotational');
    setActiveSection('rotational');
    setWorkspaceName('JEE Hinged Rod Analysis');
    setParams((prev) => ({
      ...prev,
      rotational: sample,
    }));
    setSimTime(0);
    setIsPlaying(false);
    setRotationalSimState(createInitialRotationalState(sample));
  }, [pushHistory]);

  const resetAllDefaults = useCallback(() => {
    pushHistory();
    setWorkspaceName('Untitled Simulation');
    setActivePreset('rotational');
    setActiveSection('rotational');
    const freshParams = JSON.parse(JSON.stringify(DEFAULT_SCENE_PARAMS)) as LabSceneParams;
    setParams(freshParams);
    setEnvironment(normalizeEnvironment(DEFAULT_ENVIRONMENT));
    setSimTime(0);
    setIsPlaying(false);
    setRotationalSimState(createInitialRotationalState(freshParams.rotational));
  }, [pushHistory]);

  const resetSimulation = useCallback(() => {
    setIsPlaying(false);
    setSimTime(0);
    setRotationalSimState(createInitialRotationalState(rotParamsRef.current));
  }, []);

  const scrubSimulationTime = useCallback(
    (targetTime: number) => {
      const safeTime = Math.max(0, targetTime);
      setIsPlaying(false);
      setSimTime(safeTime);
      if (activePreset === 'rotational') {
        setRotationalSimState(simulateRotationalToTime(rotParamsRef.current, safeTime));
      }
    },
    [activePreset]
  );

  const triggerCameraView = useCallback((view: CameraPresetView) => {
    setCameraViewTrigger((prev) => ({ view, nonce: prev.nonce + 1 }));
  }, []);

  const applyAnalyzedScene = useCallback(
    (
      analysis: AnalyzedPhysicsProblem,
      preset: PhysicsPresetId,
      patch: Partial<LabSceneParams>,
      questionText: string
    ) => {
      pushHistory();
      const baseFresh = JSON.parse(JSON.stringify(DEFAULT_SCENE_PARAMS)) as LabSceneParams;
      const merged = normalizeSceneParams({
        ...baseFresh,
        ...patch,
      });
      const baselineTitle = analysis.title || 'AI Physics Simulation';
      setWorkspaceName(baselineTitle);
      setActivePreset(preset);
      setActiveSection(preset === 'block_surface' ? 'mechanics' : preset);
      setSelectedPart(defaultSelectedPartForPreset(preset));
      setParams(merged);
      setSimTime(0);
      setIsPlaying(false);
      setRotationalSimState(createInitialRotationalState(merged.rotational));
      setQuestionBaseline({
        title: baselineTitle,
        questionText,
        preset,
        params: JSON.parse(JSON.stringify(merged)) as LabSceneParams,
        analysis,
      });
      setIsSaved(false);
      setCameraViewTrigger((prev) => ({ view: 'isometric', nonce: prev.nonce + 1 }));
    },
    [pushHistory]
  );

  const resetToQuestionValues = useCallback(() => {
    if (!questionBaseline) return;
    pushHistory();
    const restored = normalizeSceneParams(
      JSON.parse(JSON.stringify(questionBaseline.params)) as LabSceneParams
    );
    setWorkspaceName(questionBaseline.title);
    setActivePreset(questionBaseline.preset);
    setActiveSection(
      questionBaseline.preset === 'block_surface' ? 'mechanics' : questionBaseline.preset
    );
    setSelectedPart(defaultSelectedPartForPreset(questionBaseline.preset));
    setParams(restored);
    setSimTime(0);
    setIsPlaying(false);
    setRotationalSimState(createInitialRotationalState(restored.rotational));
    setIsSaved(false);
    setCameraViewTrigger((prev) => ({ view: 'isometric', nonce: prev.nonce + 1 }));
  }, [pushHistory, questionBaseline]);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      if (activePreset === 'rotational') {
        const nextRot = stepRotationalSimulation(
          rotParamsRef.current,
          rotStateRef.current,
          dt,
          simSpeed
        );
        rotStateRef.current = nextRot;
        setRotationalSimState(nextRot);
        setSimTime(nextRot.time);
      } else {
        setSimTime((prev) => (prev + dt * simSpeed) % environment.loopDuration);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, simSpeed, activePreset, environment.loopDuration]);

  return {
    workspaceName,
    renameWorkspace,
    activeSection,
    activePreset,
    selectSidebarSection,
    params,
    updatePresetParams,
    environment,
    updateEnvironment,
    toggleVectorVisibility,
    toolMode,
    setToolMode,
    selectedPart,
    setSelectedPart,
    cameraProjection,
    setCameraProjection,
    cameraViewTrigger,
    triggerCameraView,
    isPlaying,
    setIsPlaying,
    simSpeed,
    setSimSpeed,
    simTime,
    setSimTime,
    rotationalSimState,
    resetSimulation,
    scrubSimulationTime,
    isSaved,
    lastSavedAt,
    saveWorkspace,
    savedExperiments,
    loadExperiment,
    deleteExperiment,
    loadSampleRotationalProblem,
    resetAllDefaults,
    questionBaseline,
    applyAnalyzedScene,
    resetToQuestionValues,
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,
    undo,
    redo,
  };
}
