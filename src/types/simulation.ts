import type {
  RotationalDynamicsResult,
  VectorVisibilityFlags,
} from '../physics/engine/types';

export type SidebarSection =
  | 'workspace'
  | 'mechanics'
  | 'rotational'
  | 'rolling'
  | 'pulley'
  | 'collisions'
  | 'oscillations'
  | 'experiments';

export type PhysicsPresetId =
  | 'rotational'
  | 'rolling'
  | 'pulley'
  | 'collisions'
  | 'oscillations'
  | 'block_surface';

export type SceneToolMode = 'select' | 'move' | 'rotate';

export type CameraProjection = 'perspective' | 'orthographic';

export type CameraPresetView = 'isometric' | 'front' | 'top' | 'side';

export type SelectablePartId =
  | 'rod'
  | 'pivot'
  | 'sphere'
  | 'force'
  | 'block'
  | 'surface'
  | 'pulley'
  | 'mass_left'
  | 'mass_right'
  | 'cylinder'
  | 'ramp'
  | 'system';

export interface ExtraRotationalForce {
  id: string;
  label: string;
  magnitude: number;
  angle: number;
  distance: number;
}

export interface RotationalParams {
  rodLength: number; // m (> 0)
  rodMass: number; // kg (> 0)
  sphereMass: number; // kg (>= 0)
  spherePosition: number; // m along rod from left end
  pivotOffset: number; // m from left end
  forceMagnitude: number; // N (signed or positive)
  forceAngle: number; // deg relative to position vector r
  forceDistance: number; // m from pivot (r)
  allowExternalApplication: boolean;
  initialAngularVelocity: number; // rad/s
  initialAngle: number; // deg
  gravityEnabled: boolean;
  gravity: number; // m/s^2
  dampingEnabled: boolean;
  damping: number; // N*m*s/rad
  extraForces?: ExtraRotationalForce[];
}

export interface RollingParams {
  inclineAngle: number; // deg
  cylinderMass: number; // kg
  cylinderRadius: number; // m
  rampLength: number; // m
  gravity: number; // m/s^2
}

export interface PulleyParams {
  massLeft: number; // kg
  massRight: number; // kg
  pulleyMass: number; // kg
  pulleyRadius: number; // m
  gravity: number; // m/s^2
}

export interface CollisionParams {
  massA: number; // kg
  velocityA: number; // m/s
  massB: number; // kg
  velocityB: number; // m/s
  restitution: number; // e (0 - 1)
}

export interface OscillationParams {
  pendulumLength: number; // m
  bobMass: number; // kg
  initialAmplitude: number; // deg
  gravity: number; // m/s^2
  damping: number;
}

export interface BlockSurfaceParams {
  mass: number; // kg (> 0)
  appliedForce: number; // N
  forceAngle: number; // deg above horizontal
  muStatic: number; // >= 0
  muKinetic: number; // >= 0
  gravity: number; // m/s^2 (>= 0)
  initialVelocity: number; // m/s
  frictionEnabled: boolean;
}

export interface BlockSurfaceDynamicsResult {
  mass: number;
  appliedForce: number;
  forceAngleDeg: number;
  fx: number;
  fy: number;
  weight: number;
  normalForce: number;
  frictionForce: number;
  maxStaticFriction: number;
  netForceX: number;
  accelerationX: number;
  velocityX: number;
  displacementX: number;
  isStaticEquilibrium: boolean;
  isLiftedOff: boolean;
}

export interface LabEnvironmentSettings {
  showGrid: boolean;
  showAxes: boolean;
  showForceVectors: boolean;
  vectorVisibility: VectorVisibilityFlags;
  vectorScale: number;
  gridDensity: 'standard' | 'fine';
  angleUnit: 'deg' | 'rad';
  loopDuration: number;
}

export interface LabSceneParams {
  rotational: RotationalParams;
  rolling: RollingParams;
  pulley: PulleyParams;
  collisions: CollisionParams;
  oscillations: OscillationParams;
  block_surface: BlockSurfaceParams;
}

export interface PhysicsReadoutItem {
  id: string;
  label: string;
  value: string;
  unit: string;
  accent?: 'cyan' | 'blue' | 'violet' | 'amber' | 'neutral';
}

export interface PhysicsSnapshot {
  torque: number; // N*m
  momentOfInertia: number; // kg*m^2
  angularAcceleration: number; // rad/s^2
  forceMagnitude: number; // N
  currentAngleDeg: number; // deg
  currentAngleRad: number; // rad
  angularVelocity: number; // rad/s
  rotationalDetails?: RotationalDynamicsResult;
  blockSurfaceDetails?: BlockSurfaceDynamicsResult;
  primaryReadouts: PhysicsReadoutItem[];
  kinematicState: {
    angleRad: number;
    angularVelocity: number;
    linearProgress: number;
    secondaryOffset: number;
    collisionOccurred?: boolean;
  };
}

export interface SavedExperiment {
  id: string;
  name: string;
  preset: PhysicsPresetId;
  params: LabSceneParams;
  environment: LabEnvironmentSettings;
  savedAt: string;
  notes?: string;
}

export interface WorkspaceSnapshot {
  workspaceName: string;
  activeSection: SidebarSection;
  activePreset: PhysicsPresetId;
  params: LabSceneParams;
  environment: LabEnvironmentSettings;
}
