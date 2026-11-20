import type {
  BlockSurfaceParams,
  CollisionParams,
  LabSceneParams,
  OscillationParams,
  PhysicsPresetId,
  PulleyParams,
  RollingParams,
  RotationalParams,
} from '../types/simulation.ts';

export type AnalyzedSceneType =
  | 'rotational_dynamics'
  | 'pulley_system'
  | 'rolling_motion'
  | 'block_surface'
  | 'collision_1d'
  | 'oscillation'
  | 'unsupported';

export type EngineSupportStatus = 'full' | 'partial' | 'unsupported';

export type ValueSourceKind = 'explicit_text' | 'diagram' | 'calculated' | 'assumed';

export type SceneObjectType =
  | 'uniform_rod'
  | 'block'
  | 'sphere'
  | 'cylinder'
  | 'disc'
  | 'pulley'
  | 'string'
  | 'spring'
  | 'inclined_plane'
  | 'horizontal_surface'
  | 'wall'
  | 'hinge'
  | 'other';

export interface PhysicsSceneObject {
  id: string;
  name: string;
  type: SceneObjectType;
  mass?: number;
  length?: number;
  radius?: number;
  width?: number;
  height?: number;
  position: [number, number, number];
  orientationDeg?: number;
  hinged?: boolean;
  pivotOffset?: number;
  fixed?: boolean;
  frictionCoefficient?: number;
  springConstant?: number;
  initialVelocity?: number;
  initialAngularVelocity?: number;
  source: ValueSourceKind;
}

export interface PhysicsSceneForce {
  id: string;
  label: string;
  type:
    | 'applied_force'
    | 'gravity'
    | 'normal'
    | 'friction'
    | 'tension'
    | 'spring_force'
    | 'contact'
    | 'other';
  targetObjectId: string;
  magnitude?: number;
  angleDeg: number;
  applicationPointDescription: string;
  applicationDistance?: number;
  source: ValueSourceKind;
}

export interface PhysicsConnection {
  id: string;
  type:
    | 'fixed_hinge'
    | 'string_over_pulley'
    | 'rolling_contact'
    | 'surface_contact'
    | 'spring_attachment'
    | 'collision_pair'
    | 'other';
  objectIds: string[];
  description: string;
}

export interface ExtractedVariable {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  objectId?: string;
  source: ValueSourceKind;
  editable: boolean;
}

export interface PhysicsAssumption {
  id: string;
  statement: string;
  category: 'geometry' | 'constraint' | 'force' | 'initial_condition';
  enabled: boolean;
  editable: boolean;
  impactKey?: 'gravityEnabled' | 'dampingEnabled' | 'allowExternalApplication' | 'frictionEnabled';
  impactValue?: boolean;
}

export interface MissingInfoItem {
  id: string;
  field: string;
  prompt: string;
  critical: boolean;
  suggestedDefault?: number;
  unit?: string;
}

export interface AnalyzedPhysicsProblem {
  sceneType: AnalyzedSceneType;
  engineSupport: EngineSupportStatus;
  supportNote: string;
  title: string;
  summary: string;
  imageReadabilityError: string | null;
  diagramInsights: string[];
  objects: PhysicsSceneObject[];
  forces: PhysicsSceneForce[];
  connections: PhysicsConnection[];
  constraints: string[];
  equations: string[];
  unknowns: string[];
  extractedVariables: ExtractedVariable[];
  assumptions: PhysicsAssumption[];
  missingInformation: MissingInfoItem[];
  validationErrors: string[];
  simulationConfig: {
    preset: PhysicsPresetId | 'unsupported';
    rotationalParams?: Partial<RotationalParams>;
    rollingParams?: Partial<RollingParams>;
    pulleyParams?: Partial<PulleyParams>;
    collisionParams?: Partial<CollisionParams>;
    oscillationParams?: Partial<OscillationParams>;
    blockSurfaceParams?: Partial<BlockSurfaceParams>;
  };
}

export const SCENE_ANALYZER_SAMPLES: Array<{
  id: string;
  label: string;
  text: string;
}> = [
  {
    id: 'test-a-rotational',
    label: 'Rod & Hinge',
    text: 'A uniform rod of length 2 m and mass 4 kg is hinged at one end. A force of 10 N acts perpendicular to the rod at its free end. Find its angular acceleration.',
  },
  {
    id: 'test-b-pulley',
    label: 'Atwood Pulley',
    text: 'Two masses of 3 kg and 5 kg are connected by a light inextensible string passing over an ideal fixed pulley. Find the acceleration of the blocks and the tension in the string.',
  },
  {
    id: 'test-c-rolling',
    label: 'Rolling Cylinder',
    text: 'A solid cylinder rolls without slipping down an inclined plane.',
  },
  {
    id: 'test-d-block',
    label: 'Rough Block Pull',
    text: 'A block rests on a rough horizontal surface and is pulled by an inclined force.',
  },
];

const VALID_SCENE_TYPES = new Set<AnalyzedSceneType>([
  'rotational_dynamics',
  'pulley_system',
  'rolling_motion',
  'block_surface',
  'collision_1d',
  'oscillation',
  'unsupported',
]);

const VALID_OBJECT_TYPES = new Set<SceneObjectType>([
  'uniform_rod',
  'block',
  'sphere',
  'cylinder',
  'disc',
  'pulley',
  'string',
  'spring',
  'inclined_plane',
  'horizontal_surface',
  'wall',
  'hinge',
  'other',
]);

const VALID_SOURCES = new Set<ValueSourceKind>([
  'explicit_text',
  'diagram',
  'calculated',
  'assumed',
]);

function asFiniteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.trim() : fallback;
}

function asBoolean(val: unknown, fallback = false): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

function sceneTypeToPreset(sceneType: AnalyzedSceneType): PhysicsPresetId | 'unsupported' {
  switch (sceneType) {
    case 'rotational_dynamics':
      return 'rotational';
    case 'pulley_system':
      return 'pulley';
    case 'rolling_motion':
      return 'rolling';
    case 'block_surface':
      return 'block_surface';
    case 'collision_1d':
      return 'collisions';
    case 'oscillation':
      return 'oscillations';
    default:
      return 'unsupported';
  }
}

export function validateAndNormalizeAnalysis(
  raw: unknown,
  originalQuestionText = ''
): AnalyzedPhysicsProblem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI response could not be parsed into a valid structured physics scene.');
  }
  const obj = raw as Record<string, unknown>;

  const rawSceneType = asString(obj.sceneType, 'unsupported') as AnalyzedSceneType;
  const sceneType: AnalyzedSceneType = VALID_SCENE_TYPES.has(rawSceneType)
    ? rawSceneType
    : 'unsupported';

  const preset = sceneTypeToPreset(sceneType);
  const rawSupport = asString(obj.engineSupport) as EngineSupportStatus;
  let engineSupport: EngineSupportStatus =
    rawSupport === 'full' || rawSupport === 'partial' || rawSupport === 'unsupported'
      ? rawSupport
      : preset === 'unsupported'
      ? 'unsupported'
      : 'full';

  if (preset === 'unsupported') {
    engineSupport = 'unsupported';
  }

  const imageReadabilityError =
    typeof obj.imageReadabilityError === 'string' && obj.imageReadabilityError.trim() !== ''
      ? obj.imageReadabilityError.trim()
      : null;

  const diagramInsights = Array.isArray(obj.diagramInsights)
    ? obj.diagramInsights.map((d) => asString(d)).filter(Boolean)
    : [];

  const objects: PhysicsSceneObject[] = Array.isArray(obj.objects)
    ? obj.objects
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => {
          const rawType = asString(item.type, 'other') as SceneObjectType;
          const posArr = Array.isArray(item.position) ? item.position : [0, 0, 0];
          const src = asString(item.source, 'explicit_text') as ValueSourceKind;
          return {
            id: asString(item.id, `obj_${idx + 1}`),
            name: asString(item.name, `Object ${idx + 1}`),
            type: VALID_OBJECT_TYPES.has(rawType) ? rawType : 'other',
            mass: asFiniteNumber(item.mass),
            length: asFiniteNumber(item.length),
            radius: asFiniteNumber(item.radius),
            width: asFiniteNumber(item.width),
            height: asFiniteNumber(item.height),
            position: [
              asFiniteNumber(posArr[0]) ?? 0,
              asFiniteNumber(posArr[1]) ?? 0,
              asFiniteNumber(posArr[2]) ?? 0,
            ],
            orientationDeg: asFiniteNumber(item.orientationDeg),
            hinged: asBoolean(item.hinged, false),
            pivotOffset: asFiniteNumber(item.pivotOffset),
            fixed: asBoolean(item.fixed, false),
            frictionCoefficient: asFiniteNumber(item.frictionCoefficient),
            springConstant: asFiniteNumber(item.springConstant),
            initialVelocity: asFiniteNumber(item.initialVelocity),
            initialAngularVelocity: asFiniteNumber(item.initialAngularVelocity),
            source: VALID_SOURCES.has(src) ? src : 'explicit_text',
          };
        })
    : [];

  const forces: PhysicsSceneForce[] = Array.isArray(obj.forces)
    ? obj.forces
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => {
          const src = asString(item.source, 'explicit_text') as ValueSourceKind;
          const allowedForceTypes = new Set<PhysicsSceneForce['type']>([
            'applied_force',
            'gravity',
            'normal',
            'friction',
            'tension',
            'spring_force',
            'contact',
            'other',
          ]);
          const rawForceType = asString(item.type, 'applied_force') as PhysicsSceneForce['type'];
          return {
            id: asString(item.id, `force_${idx + 1}`),
            label: asString(item.label, `Force ${idx + 1}`),
            type: allowedForceTypes.has(rawForceType) ? rawForceType : 'other',
            targetObjectId: asString(item.targetObjectId, objects[0]?.id ?? 'obj_1'),
            magnitude: asFiniteNumber(item.magnitude),
            angleDeg: asFiniteNumber(item.angleDeg) ?? 0,
            applicationPointDescription: asString(
              item.applicationPointDescription,
              'Center of mass'
            ),
            applicationDistance: asFiniteNumber(item.applicationDistance),
            source: VALID_SOURCES.has(src) ? src : 'explicit_text',
          };
        })
    : [];

  const connections: PhysicsConnection[] = Array.isArray(obj.connections)
    ? obj.connections
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => {
          const allowedConn = new Set<PhysicsConnection['type']>([
            'fixed_hinge',
            'string_over_pulley',
            'rolling_contact',
            'surface_contact',
            'spring_attachment',
            'collision_pair',
            'other',
          ]);
          const rawConn = asString(item.type, 'other') as PhysicsConnection['type'];
          return {
            id: asString(item.id, `conn_${idx + 1}`),
            type: allowedConn.has(rawConn) ? rawConn : 'other',
            objectIds: Array.isArray(item.objectIds)
              ? item.objectIds.map((id) => asString(id)).filter(Boolean)
              : [],
            description: asString(item.description, 'Physical constraint'),
          };
        })
    : [];

  const constraints = Array.isArray(obj.constraints)
    ? obj.constraints.map((c) => asString(c)).filter(Boolean)
    : [];

  const equations = Array.isArray(obj.equations)
    ? obj.equations.map((e) => asString(e)).filter(Boolean)
    : [];

  const unknowns = Array.isArray(obj.unknowns)
    ? obj.unknowns.map((u) => asString(u)).filter(Boolean)
    : [];

  const extractedVariables: ExtractedVariable[] = Array.isArray(obj.extractedVariables)
    ? obj.extractedVariables
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => {
          const src = asString(item.source, 'assumed') as ValueSourceKind;
          const numVal = asFiniteNumber(item.value);
          return {
            key: asString(item.key, `var_${idx + 1}`),
            label: asString(item.label, `Variable ${idx + 1}`),
            value: numVal !== undefined ? numVal : null,
            unit: asString(item.unit, ''),
            objectId: asString(item.objectId) || undefined,
            source: VALID_SOURCES.has(src) ? src : 'assumed',
            editable: asBoolean(item.editable, true),
          };
        })
    : [];

  const assumptions: PhysicsAssumption[] = Array.isArray(obj.assumptions)
    ? obj.assumptions
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => {
          const cat = asString(item.category, 'constraint') as PhysicsAssumption['category'];
          const validCat = new Set(['geometry', 'constraint', 'force', 'initial_condition']);
          const rawImpact = asString(item.impactKey);
          const validImpact = new Set([
            'gravityEnabled',
            'dampingEnabled',
            'allowExternalApplication',
            'frictionEnabled',
          ]);
          return {
            id: asString(item.id, `assumption_${idx + 1}`),
            statement: asString(item.statement, 'Standard rigid-body idealization'),
            category: validCat.has(cat) ? cat : 'constraint',
            enabled: asBoolean(item.enabled, true),
            editable: asBoolean(item.editable, true),
            impactKey: validImpact.has(rawImpact)
              ? (rawImpact as PhysicsAssumption['impactKey'])
              : undefined,
            impactValue:
              typeof item.impactValue === 'boolean' ? item.impactValue : undefined,
          };
        })
    : [];

  const missingInformation: MissingInfoItem[] = Array.isArray(obj.missingInformation)
    ? obj.missingInformation
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item, idx) => ({
          id: asString(item.id, `missing_${idx + 1}`),
          field: asString(item.field, `Parameter ${idx + 1}`),
          prompt: asString(item.prompt, 'Specify missing physical value'),
          critical: asBoolean(item.critical, false),
          suggestedDefault: asFiniteNumber(item.suggestedDefault),
          unit: asString(item.unit) || undefined,
        }))
    : [];

  const validationErrors: string[] = [];

  // Physical sanity & geometry checks
  for (const scObj of objects) {
    if (scObj.mass !== undefined && scObj.mass <= 0 && scObj.type !== 'pulley' && scObj.type !== 'string') {
      validationErrors.push(`Object "${scObj.name}" has non-positive mass (${scObj.mass} kg).`);
    }
    if (scObj.length !== undefined && scObj.length <= 0) {
      validationErrors.push(`Object "${scObj.name}" has non-positive length (${scObj.length} m).`);
    }
    if (scObj.radius !== undefined && scObj.radius <= 0) {
      validationErrors.push(`Object "${scObj.name}" has non-positive radius (${scObj.radius} m).`);
    }
  }

  for (const v of extractedVariables) {
    if (
      v.value !== null &&
      (v.key.toLowerCase().includes('mass') ||
        v.key.toLowerCase().includes('length') ||
        v.key.toLowerCase().includes('radius')) &&
      v.key !== 'pulleyMass' &&
      v.key !== 'sphereMass' &&
      v.value <= 0
    ) {
      validationErrors.push(`${v.label} must be strictly positive (got ${v.value} ${v.unit}).`);
    }
  }

  if (imageReadabilityError) {
    validationErrors.push(imageReadabilityError);
  }

  const rawSimCfg =
    obj.simulationConfig && typeof obj.simulationConfig === 'object'
      ? (obj.simulationConfig as Record<string, unknown>)
      : {};

  const normalized: AnalyzedPhysicsProblem = {
    sceneType,
    engineSupport: validationErrors.length > 0 && engineSupport === 'full' ? 'partial' : engineSupport,
    supportNote: asString(
      obj.supportNote,
      preset === 'unsupported'
        ? 'This physical system is not yet supported by the deterministic physics solver.'
        : 'Mapped to deterministic 3D physics engine.'
    ),
    title: asString(
      obj.title,
      originalQuestionText.slice(0, 48).trim() || 'Analyzed Physics Simulation'
    ),
    summary: asString(obj.summary, 'Physical configuration extracted from problem statement.'),
    imageReadabilityError,
    diagramInsights,
    objects,
    forces,
    connections,
    constraints,
    equations,
    unknowns,
    extractedVariables,
    assumptions,
    missingInformation,
    validationErrors,
    simulationConfig: {
      preset,
      rotationalParams:
        rawSimCfg.rotationalParams && typeof rawSimCfg.rotationalParams === 'object'
          ? (rawSimCfg.rotationalParams as Partial<RotationalParams>)
          : undefined,
      rollingParams:
        rawSimCfg.rollingParams && typeof rawSimCfg.rollingParams === 'object'
          ? (rawSimCfg.rollingParams as Partial<RollingParams>)
          : undefined,
      pulleyParams:
        rawSimCfg.pulleyParams && typeof rawSimCfg.pulleyParams === 'object'
          ? (rawSimCfg.pulleyParams as Partial<PulleyParams>)
          : undefined,
      collisionParams:
        rawSimCfg.collisionParams && typeof rawSimCfg.collisionParams === 'object'
          ? (rawSimCfg.collisionParams as Partial<CollisionParams>)
          : undefined,
      oscillationParams:
        rawSimCfg.oscillationParams && typeof rawSimCfg.oscillationParams === 'object'
          ? (rawSimCfg.oscillationParams as Partial<OscillationParams>)
          : undefined,
      blockSurfaceParams:
        rawSimCfg.blockSurfaceParams && typeof rawSimCfg.blockSurfaceParams === 'object'
          ? (rawSimCfg.blockSurfaceParams as Partial<BlockSurfaceParams>)
          : undefined,
    },
  };

  return normalized;
}

/**
 * Reconstructs clean preset parameter patches from the analyzed problem's
 * confirmed/edited extractedVariables & toggled assumptions.
 */
export function buildSimulationPatchFromAnalysis(
  analysis: AnalyzedPhysicsProblem,
  baseParams: LabSceneParams
): {
  preset: PhysicsPresetId;
  patch: Partial<LabSceneParams>;
  validationError: string | null;
} {
  const preset = analysis.simulationConfig.preset;
  if (preset === 'unsupported') {
    return {
      preset: 'rotational',
      patch: {},
      validationError: analysis.supportNote || 'Unsupported physical system.',
    };
  }

  const varMap = new Map<string, number>();
  for (const v of analysis.extractedVariables) {
    if (v.value !== null && Number.isFinite(v.value)) {
      varMap.set(v.key, v.value);
    }
  }

  const assumptionFlags: Partial<Record<NonNullable<PhysicsAssumption['impactKey']>, boolean>> = {};
  for (const a of analysis.assumptions) {
    if (a.impactKey) {
      assumptionFlags[a.impactKey] = a.enabled ? (a.impactValue ?? true) : !(a.impactValue ?? true);
    }
  }

  if (preset === 'rotational') {
    const seed = analysis.simulationConfig.rotationalParams ?? {};
    const rodLength = varMap.get('rodLength') ?? seed.rodLength ?? baseParams.rotational.rodLength;
    const rodMass = varMap.get('rodMass') ?? seed.rodMass ?? baseParams.rotational.rodMass;
    const sphereMass = varMap.get('sphereMass') ?? seed.sphereMass ?? 0;
    const spherePosition =
      varMap.get('spherePosition') ?? seed.spherePosition ?? rodLength * 0.75;
    const pivotOffset = varMap.get('pivotOffset') ?? seed.pivotOffset ?? 0;
    const forceMagnitude =
      varMap.get('forceMagnitude') ?? seed.forceMagnitude ?? baseParams.rotational.forceMagnitude;
    const forceAngle =
      varMap.get('forceAngle') ?? seed.forceAngle ?? baseParams.rotational.forceAngle;
    const forceDistance =
      varMap.get('forceDistance') ?? seed.forceDistance ?? Math.max(0, rodLength - pivotOffset);
    const initialAngularVelocity =
      varMap.get('initialAngularVelocity') ?? seed.initialAngularVelocity ?? 0;
    const initialAngle = varMap.get('initialAngle') ?? seed.initialAngle ?? 0;
    const gravity = varMap.get('gravity') ?? seed.gravity ?? 9.81;
    const damping = varMap.get('damping') ?? seed.damping ?? 0.05;

    if (rodLength <= 0 || rodMass <= 0) {
      return {
        preset: 'rotational',
        patch: {},
        validationError: 'Rod length and rod mass must both be positive (> 0).',
      };
    }

    // Check if there are multiple applied forces extracted in analysis.forces
    const appliedForces = analysis.forces.filter(
      (f) => f.type === 'applied_force' && f.magnitude !== undefined && Number.isFinite(f.magnitude)
    );
    const extraForces =
      appliedForces.length > 1
        ? appliedForces.slice(1).map((ef, idx) => ({
            id: ef.id || `extra_force_${idx + 1}`,
            label: ef.label || `Force ${idx + 2}`,
            magnitude: ef.magnitude ?? 0,
            angle: ef.angleDeg ?? 90,
            distance: ef.applicationDistance ?? rodLength,
          }))
        : seed.extraForces;

    return {
      preset: 'rotational',
      patch: {
        rotational: {
          ...baseParams.rotational,
          ...seed,
          rodLength,
          rodMass,
          sphereMass: Math.max(0, sphereMass),
          spherePosition,
          pivotOffset,
          forceMagnitude,
          forceAngle,
          forceDistance,
          allowExternalApplication:
            assumptionFlags.allowExternalApplication ?? seed.allowExternalApplication ?? false,
          initialAngularVelocity,
          initialAngle,
          gravityEnabled: assumptionFlags.gravityEnabled ?? seed.gravityEnabled ?? false,
          gravity,
          dampingEnabled: assumptionFlags.dampingEnabled ?? seed.dampingEnabled ?? false,
          damping,
          extraForces,
        },
      },
      validationError: null,
    };
  }

  if (preset === 'pulley') {
    const seed = analysis.simulationConfig.pulleyParams ?? {};
    const massLeft = varMap.get('massLeft') ?? seed.massLeft ?? 3.0;
    const massRight = varMap.get('massRight') ?? seed.massRight ?? 5.0;
    const pulleyMass = varMap.get('pulleyMass') ?? seed.pulleyMass ?? 0.0;
    const pulleyRadius = varMap.get('pulleyRadius') ?? seed.pulleyRadius ?? 0.35;
    const gravity = varMap.get('gravity') ?? seed.gravity ?? 9.81;

    if (massLeft <= 0 || massRight <= 0 || pulleyRadius <= 0) {
      return {
        preset: 'pulley',
        patch: {},
        validationError: 'Block masses and pulley radius must be positive (> 0).',
      };
    }

    return {
      preset: 'pulley',
      patch: {
        pulley: {
          ...baseParams.pulley,
          ...seed,
          massLeft,
          massRight,
          pulleyMass: Math.max(0, pulleyMass),
          pulleyRadius,
          gravity,
        },
      },
      validationError: null,
    };
  }

  if (preset === 'rolling') {
    const seed = analysis.simulationConfig.rollingParams ?? {};
    const inclineAngle = varMap.get('inclineAngle') ?? seed.inclineAngle ?? 30;
    const cylinderMass = varMap.get('cylinderMass') ?? seed.cylinderMass ?? 2.0;
    const cylinderRadius = varMap.get('cylinderRadius') ?? seed.cylinderRadius ?? 0.4;
    const rampLength = varMap.get('rampLength') ?? seed.rampLength ?? 5.0;
    const gravity = varMap.get('gravity') ?? seed.gravity ?? 9.81;

    if (cylinderMass <= 0 || cylinderRadius <= 0 || rampLength <= 0) {
      return {
        preset: 'rolling',
        patch: {},
        validationError: 'Cylinder mass, radius, and ramp length must be positive (> 0).',
      };
    }

    return {
      preset: 'rolling',
      patch: {
        rolling: {
          ...baseParams.rolling,
          ...seed,
          inclineAngle,
          cylinderMass,
          cylinderRadius,
          rampLength,
          gravity,
        },
      },
      validationError: null,
    };
  }

  if (preset === 'block_surface') {
    const seed = analysis.simulationConfig.blockSurfaceParams ?? {};
    const mass = varMap.get('mass') ?? varMap.get('blockMass') ?? seed.mass ?? 5.0;
    const appliedForce =
      varMap.get('appliedForce') ?? varMap.get('forceMagnitude') ?? seed.appliedForce ?? 25.0;
    const forceAngle =
      varMap.get('forceAngle') ?? seed.forceAngle ?? 30;
    const muStatic =
      varMap.get('muStatic') ?? varMap.get('frictionCoefficient') ?? seed.muStatic ?? 0.4;
    const muKinetic =
      varMap.get('muKinetic') ??
      varMap.get('frictionCoefficient') ??
      seed.muKinetic ??
      Math.min(muStatic, 0.3);
    const gravity = varMap.get('gravity') ?? seed.gravity ?? 9.81;
    const initialVelocity = varMap.get('initialVelocity') ?? seed.initialVelocity ?? 0.0;

    if (mass <= 0) {
      return {
        preset: 'block_surface',
        patch: {},
        validationError: 'Block mass must be positive (> 0).',
      };
    }

    return {
      preset: 'block_surface',
      patch: {
        block_surface: {
          ...baseParams.block_surface,
          ...seed,
          mass,
          appliedForce,
          forceAngle,
          muStatic: Math.max(0, muStatic),
          muKinetic: Math.max(0, muKinetic),
          gravity: Math.max(0, gravity),
          initialVelocity,
          frictionEnabled: assumptionFlags.frictionEnabled ?? seed.frictionEnabled ?? true,
        },
      },
      validationError: null,
    };
  }

  if (preset === 'collisions') {
    const seed = analysis.simulationConfig.collisionParams ?? {};
    const massA = varMap.get('massA') ?? seed.massA ?? 2.0;
    const massB = varMap.get('massB') ?? seed.massB ?? 3.0;
    const velocityA = varMap.get('velocityA') ?? seed.velocityA ?? 2.4;
    const velocityB = varMap.get('velocityB') ?? seed.velocityB ?? -1.0;
    const restitution = varMap.get('restitution') ?? seed.restitution ?? 1.0;

    if (massA <= 0 || massB <= 0) {
      return {
        preset: 'collisions',
        patch: {},
        validationError: 'Colliding body masses must be positive (> 0).',
      };
    }

    return {
      preset: 'collisions',
      patch: {
        collisions: {
          ...baseParams.collisions,
          ...seed,
          massA,
          massB,
          velocityA,
          velocityB,
          restitution,
        },
      },
      validationError: null,
    };
  }

  // oscillations
  const seed = analysis.simulationConfig.oscillationParams ?? {};
  const pendulumLength = varMap.get('pendulumLength') ?? seed.pendulumLength ?? 2.0;
  const bobMass = varMap.get('bobMass') ?? seed.bobMass ?? 1.0;
  const initialAmplitude = varMap.get('initialAmplitude') ?? seed.initialAmplitude ?? 15;
  const gravity = varMap.get('gravity') ?? seed.gravity ?? 9.81;
  const damping = varMap.get('damping') ?? seed.damping ?? 0;

  if (pendulumLength <= 0 || bobMass <= 0) {
    return {
      preset: 'oscillations',
      patch: {},
      validationError: 'Pendulum length and bob mass must be positive (> 0).',
    };
  }

  return {
    preset: 'oscillations',
    patch: {
      oscillations: {
        ...baseParams.oscillations,
        ...seed,
        pendulumLength,
        bobMass,
        initialAmplitude,
        gravity,
        damping,
      },
    },
    validationError: null,
  };
}
