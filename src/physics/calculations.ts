import type {
  BlockSurfaceParams,
  CollisionParams,
  LabSceneParams,
  OscillationParams,
  PhysicsPresetId,
  PhysicsSnapshot,
  PulleyParams,
  RollingParams,
  RotationalParams,
} from '../types/simulation';
import {
  computeInstantaneousRotationalDynamics,
  createInitialRotationalState,
  degToRad,
  radToDeg,
  simulateRotationalToTime,
} from './engine/rotationalDynamics';
import type { RotationalSimulationState } from './engine/types';
import { formatPhysicsNumber } from '../utils/numericInput';

export { degToRad, radToDeg };

export const SAMPLE_PHYSICS_QUESTION =
  'A uniform rod of length 2 m and mass 4 kg is hinged at one end. A force of 10 N is applied perpendicular to the rod at its free end.';

export const DEFAULT_SCENE_PARAMS: LabSceneParams = {
  rotational: {
    rodLength: 2.0,
    rodMass: 4.0,
    sphereMass: 0.0,
    spherePosition: 1.5,
    pivotOffset: 0.0,
    forceMagnitude: 10.0,
    forceAngle: 90,
    forceDistance: 2.0,
    allowExternalApplication: false,
    initialAngularVelocity: 0.0,
    initialAngle: 0,
    gravityEnabled: false,
    gravity: 9.81,
    dampingEnabled: false,
    damping: 0.05,
  },
  rolling: {
    inclineAngle: 22,
    cylinderMass: 3.0,
    cylinderRadius: 0.4,
    rampLength: 5.0,
    gravity: 9.81,
  },
  pulley: {
    massLeft: 3.0,
    massRight: 5.0,
    pulleyMass: 0.0,
    pulleyRadius: 0.35,
    gravity: 9.81,
  },
  collisions: {
    massA: 2.0,
    velocityA: 2.4,
    massB: 3.0,
    velocityB: -1.0,
    restitution: 1.0,
  },
  oscillations: {
    pendulumLength: 2.2,
    bobMass: 2.0,
    initialAmplitude: 25,
    gravity: 9.81,
    damping: 0.01,
  },
  block_surface: {
    mass: 5.0,
    appliedForce: 28.0,
    forceAngle: 30,
    muStatic: 0.4,
    muKinetic: 0.3,
    gravity: 9.81,
    initialVelocity: 0.0,
    frictionEnabled: true,
  },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildRotationalPhysicsSnapshot(
  params: RotationalParams,
  rotState: RotationalSimulationState
): PhysicsSnapshot {
  const details = computeInstantaneousRotationalDynamics(params, rotState);

  return {
    torque: details.netTorque,
    momentOfInertia: details.totalMomentOfInertia,
    angularAcceleration: details.angularAcceleration,
    forceMagnitude: details.forceMagnitude,
    currentAngleDeg: details.currentAngleDeg,
    currentAngleRad: details.currentAngleRad,
    angularVelocity: details.angularVelocity,
    rotationalDetails: details,
    primaryReadouts: [
      {
        id: 'torque',
        label: 'Net Torque (τ)',
        value: details.isValid ? formatPhysicsNumber(details.netTorque) : 'Undefined',
        unit: details.isValid ? 'N·m' : '',
        accent: 'cyan',
      },
      {
        id: 'inertia',
        label: 'Moment of Inertia (I)',
        value: details.isValid ? formatPhysicsNumber(details.totalMomentOfInertia) : 'Undefined',
        unit: details.isValid ? 'kg·m²' : '',
        accent: 'blue',
      },
      {
        id: 'alpha',
        label: 'Angular Accel (α)',
        value: details.isValid ? formatPhysicsNumber(details.angularAcceleration) : 'Undefined',
        unit: details.isValid ? 'rad/s²' : '',
        accent: 'violet',
      },
      {
        id: 'force',
        label: 'Force Magnitude (F)',
        value: formatPhysicsNumber(details.forceMagnitude),
        unit: 'N',
        accent: 'amber',
      },
      {
        id: 'angle',
        label: 'Angular Disp (Δθ)',
        value: formatPhysicsNumber(details.angularDisplacementDeg),
        unit: 'deg',
        accent: 'neutral',
      },
    ],
    kinematicState: {
      angleRad: details.currentAngleRad,
      angularVelocity: details.angularVelocity,
      linearProgress: 0,
      secondaryOffset: params.spherePosition - details.pivotOffset,
    },
  };
}

export function calculateRotationalPhysics(
  params: RotationalParams,
  simTime: number
): PhysicsSnapshot {
  const rotState =
    simTime <= 0
      ? createInitialRotationalState(params)
      : simulateRotationalToTime(params, simTime);
  return buildRotationalPhysicsSnapshot(params, rotState);
}

export function calculateRollingPhysics(
  params: RollingParams,
  simTime: number,
  loopDuration = 10
): PhysicsSnapshot {
  const theta = degToRad(clamp(params.inclineAngle, 1, 89));
  const m = Math.max(1e-9, params.cylinderMass);
  const R = Math.max(1e-9, params.cylinderRadius);
  const L = Math.max(1e-6, params.rampLength);

  const momentOfInertia = 0.5 * m * R * R;
  const linearAccel = (params.gravity * Math.sin(theta)) / 1.5;
  const angularAcceleration = linearAccel / R;
  const staticFriction = (1 / 3) * m * params.gravity * Math.sin(theta);
  const torque = staticFriction * R;

  const maxTravel = Math.max(0.2, L - R * 2.2);
  const timeToBottom = linearAccel > 0.001 ? Math.sqrt((2 * maxTravel) / linearAccel) : loopDuration;
  const cycleT = ((simTime % loopDuration) + loopDuration) % loopDuration;
  const activeT = Math.min(cycleT, timeToBottom);

  const s = 0.5 * linearAccel * activeT * activeT;
  const v = linearAccel * activeT;
  const rollAngleRad = s / R;

  return {
    torque,
    momentOfInertia,
    angularAcceleration,
    forceMagnitude: staticFriction,
    currentAngleDeg: radToDeg(rollAngleRad),
    currentAngleRad: rollAngleRad,
    angularVelocity: v / R,
    primaryReadouts: [
      { id: 'torque', label: 'Friction Torque (τ)', value: formatPhysicsNumber(torque), unit: 'N·m', accent: 'cyan' },
      { id: 'inertia', label: 'Moment of Inertia (I)', value: formatPhysicsNumber(momentOfInertia), unit: 'kg·m²', accent: 'blue' },
      { id: 'alpha', label: 'Angular Accel (α)', value: formatPhysicsNumber(angularAcceleration), unit: 'rad/s²', accent: 'violet' },
      { id: 'force', label: 'Static Friction (fₛ)', value: formatPhysicsNumber(staticFriction), unit: 'N', accent: 'amber' },
      { id: 'angle', label: 'Linear Accel (a)', value: formatPhysicsNumber(linearAccel), unit: 'm/s²', accent: 'neutral' },
    ],
    kinematicState: {
      angleRad: rollAngleRad,
      angularVelocity: v / R,
      linearProgress: clamp(s / maxTravel, 0, 1),
      secondaryOffset: s,
    },
  };
}

export function calculatePulleyPhysics(
  params: PulleyParams,
  simTime: number,
  loopDuration = 10
): PhysicsSnapshot {
  const m1 = Math.max(1e-9, params.massLeft);
  const m2 = Math.max(1e-9, params.massRight);
  const mp = Math.max(0, params.pulleyMass);
  const R = Math.max(1e-9, params.pulleyRadius);
  const g = Math.max(0, params.gravity);

  const momentOfInertia = 0.5 * mp * R * R;
  const denom = m1 + m2 + 0.5 * mp;
  const accel = ((m2 - m1) * g) / denom;
  const t1 = m1 * (g + accel);
  const t2 = m2 * (g - accel);
  const netTorque = (t2 - t1) * R;
  const angularAcceleration = accel / R;

  const maxDrop = 1.15;
  const cycleT = ((simTime % loopDuration) + loopDuration) % loopDuration;
  const maxT = Math.abs(accel) > 0.001 ? Math.sqrt((2 * maxDrop) / Math.abs(accel)) : loopDuration;
  const activeT = Math.min(cycleT, maxT);
  const displacement = clamp(0.5 * accel * activeT * activeT, -maxDrop, maxDrop);
  const angleRad = displacement / R;

  return {
    torque: netTorque,
    momentOfInertia,
    angularAcceleration,
    forceMagnitude: t2,
    currentAngleDeg: radToDeg(angleRad),
    currentAngleRad: angleRad,
    angularVelocity: (accel * activeT) / R,
    primaryReadouts: [
      { id: 'torque', label: 'Net Pulley Torque (τ)', value: formatPhysicsNumber(netTorque), unit: 'N·m', accent: 'cyan' },
      { id: 'inertia', label: 'Pulley Inertia (I)', value: formatPhysicsNumber(momentOfInertia), unit: 'kg·m²', accent: 'blue' },
      { id: 'alpha', label: 'Linear Accel (a)', value: formatPhysicsNumber(accel), unit: 'm/s²', accent: 'violet' },
      { id: 'force', label: 'Tension T₂ / T₁', value: `${formatPhysicsNumber(t2)} / ${formatPhysicsNumber(t1)}`, unit: 'N', accent: 'amber' },
      { id: 'angle', label: 'Displacement (Δy)', value: formatPhysicsNumber(displacement), unit: 'm', accent: 'neutral' },
    ],
    kinematicState: {
      angleRad,
      angularVelocity: (accel * activeT) / R,
      linearProgress: displacement,
      secondaryOffset: -displacement,
    },
  };
}

export function calculateCollisionPhysics(
  params: CollisionParams,
  simTime: number,
  loopDuration = 10
): PhysicsSnapshot {
  const m1 = Math.max(1e-9, params.massA);
  const m2 = Math.max(1e-9, params.massB);
  const u1 = params.velocityA;
  const u2 = params.velocityB;
  const e = clamp(params.restitution, 0, 1);

  const v1 = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / (m1 + m2);
  const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);

  const totalMomentum = m1 * u1 + m2 * u2;
  const keInitial = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const keFinal = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const keLoss = Math.max(0, keInitial - keFinal);

  const startX1 = -2.2;
  const startX2 = 2.2;
  const minDist = 0.85;
  const relApproach = u1 - u2;
  const tCollide = relApproach > 0.05 ? (startX2 - startX1 - minDist) / relApproach : 999;

  const cycleT = ((simTime % loopDuration) + loopDuration) % loopDuration;
  let x1: number;
  let x2: number;
  let collided = false;

  if (cycleT < tCollide) {
    x1 = startX1 + u1 * cycleT;
    x2 = startX2 + u2 * cycleT;
  } else {
    collided = true;
    const x1Col = startX1 + u1 * tCollide;
    const x2Col = startX2 + u2 * tCollide;
    const postT = cycleT - tCollide;
    x1 = clamp(x1Col + v1 * postT, -3.3, 3.3);
    x2 = clamp(x2Col + v2 * postT, -3.3, 3.3);
  }

  return {
    torque: totalMomentum,
    momentOfInertia: m1 + m2,
    angularAcceleration: v1,
    forceMagnitude: keLoss,
    currentAngleDeg: v2,
    currentAngleRad: 0,
    angularVelocity: collided ? v1 : u1,
    primaryReadouts: [
      { id: 'torque', label: 'Total Momentum (P)', value: formatPhysicsNumber(totalMomentum), unit: 'kg·m/s', accent: 'cyan' },
      { id: 'inertia', label: 'Post Velocity A (v₁)', value: formatPhysicsNumber(v1), unit: 'm/s', accent: 'blue' },
      { id: 'alpha', label: 'Post Velocity B (v₂)', value: formatPhysicsNumber(v2), unit: 'm/s', accent: 'violet' },
      { id: 'force', label: 'Energy Loss (ΔK)', value: formatPhysicsNumber(keLoss), unit: 'J', accent: 'amber' },
      { id: 'angle', label: 'Restitution (e)', value: formatPhysicsNumber(e), unit: '', accent: 'neutral' },
    ],
    kinematicState: {
      angleRad: 0,
      angularVelocity: collided ? v1 : u1,
      linearProgress: x1,
      secondaryOffset: x2,
      collisionOccurred: collided,
    },
  };
}

export function calculateOscillationPhysics(
  params: OscillationParams,
  simTime: number
): PhysicsSnapshot {
  const L = Math.max(1e-6, params.pendulumLength);
  const m = Math.max(1e-9, params.bobMass);
  const g = Math.max(1e-6, params.gravity);
  const theta0 = degToRad(params.initialAmplitude);

  const omegaN = Math.sqrt(g / L);
  const period = (2 * Math.PI) / omegaN;
  const decay = Math.exp(-params.damping * simTime * 0.5);
  const angleRad = theta0 * decay * Math.cos(omegaN * simTime);
  const angularVelocity = -theta0 * omegaN * decay * Math.sin(omegaN * simTime);
  const restoringForce = m * g * Math.sin(angleRad);
  const torque = -m * g * L * Math.sin(angleRad);
  const momentOfInertia = m * L * L;
  const angularAcceleration = torque / momentOfInertia;

  return {
    torque,
    momentOfInertia,
    angularAcceleration,
    forceMagnitude: Math.abs(restoringForce),
    currentAngleDeg: radToDeg(angleRad),
    currentAngleRad: angleRad,
    angularVelocity,
    primaryReadouts: [
      { id: 'torque', label: 'Restoring Torque (τ)', value: formatPhysicsNumber(torque), unit: 'N·m', accent: 'cyan' },
      { id: 'inertia', label: 'Moment of Inertia (I)', value: formatPhysicsNumber(momentOfInertia), unit: 'kg·m²', accent: 'blue' },
      { id: 'alpha', label: 'Angular Accel (α)', value: formatPhysicsNumber(angularAcceleration), unit: 'rad/s²', accent: 'violet' },
      { id: 'force', label: 'Time Period (T)', value: formatPhysicsNumber(period), unit: 's', accent: 'amber' },
      { id: 'angle', label: 'Current Angle (θ)', value: formatPhysicsNumber(radToDeg(angleRad)), unit: 'deg', accent: 'neutral' },
    ],
    kinematicState: {
      angleRad,
      angularVelocity,
      linearProgress: 0,
      secondaryOffset: 0,
    },
  };
}

export function calculateBlockSurfacePhysics(
  params: BlockSurfaceParams,
  simTime: number,
  loopDuration = 10
): PhysicsSnapshot {
  const m = Math.max(1e-9, params.mass);
  const F = params.appliedForce;
  const thetaRad = degToRad(params.forceAngle);
  const g = Math.max(0, params.gravity);
  const muS = Math.max(0, params.muStatic);
  const muK = Math.max(0, params.muKinetic);
  const v0 = params.initialVelocity;

  const fx = F * Math.cos(thetaRad);
  const fy = F * Math.sin(thetaRad);
  const weight = m * g;
  const isLiftedOff = fy > weight + 1e-9;
  const normalForce = Math.max(0, weight - fy);
  const maxStaticFriction = params.frictionEnabled ? muS * normalForce : 0;

  let frictionForce = 0; // signed along X
  let isStaticEquilibrium = false;

  if (params.frictionEnabled && normalForce > 0) {
    if (Math.abs(v0) < 1e-6 && Math.abs(fx) <= maxStaticFriction + 1e-12) {
      isStaticEquilibrium = true;
      frictionForce = -fx;
    } else {
      const motionDir = Math.abs(v0) >= 1e-6 ? Math.sign(v0) : Math.sign(fx);
      frictionForce = -motionDir * muK * normalForce;
    }
  }

  const netForceX = isStaticEquilibrium ? 0 : fx + frictionForce;
  const accelerationX = netForceX / m;

  const activeT = simTime <= 0 ? 0 : Math.min(simTime, loopDuration);
  let velocityX = v0 + accelerationX * activeT;
  let displacementX = v0 * activeT + 0.5 * accelerationX * activeT * activeT;

  // If moving initially against kinetic friction and no driving force, stop smoothly at rest
  if (
    params.frictionEnabled &&
    !isStaticEquilibrium &&
    Math.abs(v0) > 1e-6 &&
    Math.sign(v0) !== Math.sign(velocityX) &&
    Math.abs(fx) <= maxStaticFriction
  ) {
    const tStop = Math.abs(v0 / accelerationX);
    if (activeT >= tStop) {
      velocityX = 0;
      displacementX = v0 * tStop + 0.5 * accelerationX * tStop * tStop;
      isStaticEquilibrium = true;
      frictionForce = -fx;
    }
  }

  return {
    torque: normalForce,
    momentOfInertia: m,
    angularAcceleration: accelerationX,
    forceMagnitude: F,
    currentAngleDeg: params.forceAngle,
    currentAngleRad: thetaRad,
    angularVelocity: velocityX,
    blockSurfaceDetails: {
      mass: m,
      appliedForce: F,
      forceAngleDeg: params.forceAngle,
      fx,
      fy,
      weight,
      normalForce,
      frictionForce,
      maxStaticFriction,
      netForceX,
      accelerationX,
      velocityX,
      displacementX,
      isStaticEquilibrium,
      isLiftedOff,
    },
    primaryReadouts: [
      { id: 'alpha', label: 'Acceleration (aₓ)', value: formatPhysicsNumber(accelerationX), unit: 'm/s²', accent: 'violet' },
      { id: 'torque', label: 'Normal Reaction (N)', value: formatPhysicsNumber(normalForce), unit: 'N', accent: 'cyan' },
      { id: 'force', label: 'Friction (f)', value: formatPhysicsNumber(Math.abs(frictionForce)), unit: 'N', accent: 'amber' },
      { id: 'inertia', label: 'Net Force (F_net)', value: formatPhysicsNumber(netForceX), unit: 'N', accent: 'blue' },
      { id: 'angle', label: 'Velocity (vₓ)', value: formatPhysicsNumber(velocityX), unit: 'm/s', accent: 'neutral' },
    ],
    kinematicState: {
      angleRad: thetaRad,
      angularVelocity: velocityX,
      linearProgress: clamp(-0.55 + displacementX, -3.1, 3.1),
      secondaryOffset: displacementX,
    },
  };
}

export function calculatePhysicsSnapshot(
  preset: PhysicsPresetId,
  params: LabSceneParams,
  simTime: number,
  loopDuration = 10,
  rotationalSimState?: RotationalSimulationState
): PhysicsSnapshot {
  switch (preset) {
    case 'rotational':
      return rotationalSimState
        ? buildRotationalPhysicsSnapshot(params.rotational, rotationalSimState)
        : calculateRotationalPhysics(params.rotational, simTime);
    case 'rolling':
      return calculateRollingPhysics(params.rolling, simTime, loopDuration);
    case 'pulley':
      return calculatePulleyPhysics(params.pulley, simTime, loopDuration);
    case 'collisions':
      return calculateCollisionPhysics(params.collisions, simTime, loopDuration);
    case 'oscillations':
      return calculateOscillationPhysics(params.oscillations, simTime);
    case 'block_surface':
      return calculateBlockSurfacePhysics(params.block_surface, simTime, loopDuration);
  }
}

export function getSampleRotationalQuestionParams(): RotationalParams {
  return {
    rodLength: 2.0,
    rodMass: 4.0,
    sphereMass: 0.0,
    spherePosition: 1.0,
    pivotOffset: 0.0,
    forceMagnitude: 10.0,
    forceAngle: 90,
    forceDistance: 2.0,
    allowExternalApplication: false,
    initialAngularVelocity: 0.0,
    initialAngle: 0,
    gravityEnabled: false,
    gravity: 9.81,
    dampingEnabled: false,
    damping: 0.05,
  };
}
