import type { RotationalParams } from '../../types/simulation';
import type { RotationalDynamicsResult, RotationalSimulationState } from './types';

export const FIXED_PHYSICS_DT = 1 / 240; // 240 Hz deterministic fixed physics timestep
export const MAX_ACCUMULATOR_STEPS = 48; // prevents spiral of death on frame stalls
const MAX_SAFE_ALPHA = 1e12;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function getEffectiveForceDistance(params: RotationalParams): number {
  if (params.allowExternalApplication) {
    return params.forceDistance;
  }
  const maxRodDist = Math.max(0, params.rodLength - params.pivotOffset);
  return Math.min(maxRodDist, Math.max(0, params.forceDistance));
}

export function computeInstantaneousRotationalDynamics(
  params: RotationalParams,
  simState: RotationalSimulationState
): RotationalDynamicsResult {
  const L = params.rodLength;
  const mRod = params.rodMass;
  const mSphere = params.sphereMass;
  const pivotX = params.allowExternalApplication
    ? params.pivotOffset
    : Math.min(L, Math.max(0, params.pivotOffset));

  const isInputFinite =
    Number.isFinite(L) &&
    Number.isFinite(mRod) &&
    Number.isFinite(mSphere) &&
    Number.isFinite(params.forceMagnitude) &&
    Number.isFinite(params.forceAngle) &&
    Number.isFinite(params.forceDistance) &&
    Number.isFinite(simState.thetaRad) &&
    Number.isFinite(simState.omega);

  if (!isInputFinite || L <= 0 || mRod <= 0 || mSphere < 0) {
    return {
      mass: mRod,
      sphereMass: mSphere,
      length: L,
      forceMagnitude: params.forceMagnitude,
      forceAngleDeg: params.forceAngle,
      forceAngleRad: degToRad(params.forceAngle),
      forceDistance: params.forceDistance,
      pivotOffset: pivotX,
      effectiveLeverArm: 0,
      perpendicularDistance: 0,
      momentOfInertiaRod: 0,
      momentOfInertiaSphere: 0,
      totalMomentOfInertia: 0,
      appliedTorque: 0,
      gravityTorque: 0,
      dampingTorque: 0,
      netTorque: 0,
      angularAcceleration: 0,
      angularVelocity: simState.omega,
      angularDisplacementRad: 0,
      angularDisplacementDeg: 0,
      currentAngleRad: simState.thetaRad,
      currentAngleDeg: radToDeg(simState.thetaRad),
      gravityActive: params.gravityEnabled,
      dampingActive: params.dampingEnabled,
      isValid: false,
      warningMessage:
        L <= 0 || mRod <= 0
          ? 'Rod length and rod mass must be strictly positive (> 0).'
          : 'Invalid or non-finite physical parameter detected.',
    };
  }

  // Uniform rod moment of inertia about pivot:
  // I_cm = (1/12) m L^2; d_cm = (L/2 - pivotX); I_rod = I_cm + m d_cm^2
  // When pivotX = 0, I_rod = (1/12 + 1/4) m L^2 = (1/3) m L^2
  const dRodCm = L / 2 - pivotX;
  const momentOfInertiaRod = (1 / 12) * mRod * L * L + mRod * dRodCm * dRodCm;

  const dSphere = params.spherePosition - pivotX;
  const momentOfInertiaSphere = mSphere > 0 ? mSphere * dSphere * dSphere : 0;
  const totalMomentOfInertia = momentOfInertiaRod + momentOfInertiaSphere;

  const effectiveLeverArm = getEffectiveForceDistance(params);
  const forceAngleRad = degToRad(params.forceAngle);
  const rawSinForce = Math.sin(forceAngleRad);
  const cleanSinForce = Math.abs(rawSinForce) < 1e-12 ? 0 : rawSinForce;
  const perpendicularDistance = Math.abs(effectiveLeverArm * cleanSinForce);

  let extraAppliedTorque = 0;
  if (Array.isArray(params.extraForces)) {
    for (const ef of params.extraForces) {
      if (!Number.isFinite(ef.magnitude) || !Number.isFinite(ef.angle) || !Number.isFinite(ef.distance)) {
        continue;
      }
      const rEf = params.allowExternalApplication
        ? ef.distance
        : Math.min(Math.max(0, L - pivotX), Math.max(0, ef.distance));
      const sinEf = Math.sin(degToRad(ef.angle));
      const cleanSinEf = Math.abs(sinEf) < 1e-12 ? 0 : sinEf;
      extraAppliedTorque += rEf * ef.magnitude * cleanSinEf;
    }
  }

  const appliedTorque = effectiveLeverArm * params.forceMagnitude * cleanSinForce + extraAppliedTorque;

  const gravityTorque = params.gravityEnabled
    ? -(mRod * dRodCm + mSphere * dSphere) * params.gravity * Math.cos(simState.thetaRad)
    : 0;

  const dampingTorque = params.dampingEnabled ? -params.damping * simState.omega : 0;

  const netTorque = appliedTorque + gravityTorque + dampingTorque;

  let warningMessage: string | null = null;
  if (totalMomentOfInertia <= 1e-30 || !Number.isFinite(totalMomentOfInertia)) {
    return {
      mass: mRod,
      sphereMass: mSphere,
      length: L,
      forceMagnitude: params.forceMagnitude,
      forceAngleDeg: params.forceAngle,
      forceAngleRad,
      forceDistance: effectiveLeverArm,
      pivotOffset: pivotX,
      effectiveLeverArm,
      perpendicularDistance,
      momentOfInertiaRod,
      momentOfInertiaSphere,
      totalMomentOfInertia,
      appliedTorque,
      gravityTorque,
      dampingTorque,
      netTorque,
      angularAcceleration: 0,
      angularVelocity: simState.omega,
      angularDisplacementRad: simState.thetaRad - degToRad(params.initialAngle),
      angularDisplacementDeg: radToDeg(simState.thetaRad) - params.initialAngle,
      currentAngleRad: simState.thetaRad,
      currentAngleDeg: radToDeg(simState.thetaRad),
      gravityActive: params.gravityEnabled,
      dampingActive: params.dampingEnabled,
      isValid: false,
      warningMessage: 'Moment of inertia is too small for finite division (I ≈ 0).',
    };
  }

  const angularAcceleration = netTorque / totalMomentOfInertia;
  if (!Number.isFinite(angularAcceleration) || Math.abs(angularAcceleration) > MAX_SAFE_ALPHA) {
    warningMessage =
      'Angular acceleration exceeds reliable real-time numerical integration bounds (> 1e12 rad/s²).';
  }

  const theta0Rad = degToRad(params.initialAngle);
  const angularDisplacementRad = simState.thetaRad - theta0Rad;

  return {
    mass: mRod,
    sphereMass: mSphere,
    length: L,
    forceMagnitude: params.forceMagnitude,
    forceAngleDeg: params.forceAngle,
    forceAngleRad,
    forceDistance: effectiveLeverArm,
    pivotOffset: pivotX,
    effectiveLeverArm,
    perpendicularDistance,
    momentOfInertiaRod,
    momentOfInertiaSphere,
    totalMomentOfInertia,
    appliedTorque,
    gravityTorque,
    dampingTorque,
    netTorque,
    angularAcceleration,
    angularVelocity: simState.omega,
    angularDisplacementRad,
    angularDisplacementDeg: radToDeg(angularDisplacementRad),
    currentAngleRad: simState.thetaRad,
    currentAngleDeg: radToDeg(simState.thetaRad),
    gravityActive: params.gravityEnabled,
    dampingActive: params.dampingEnabled,
    isValid: warningMessage === null,
    warningMessage,
  };
}

function computeAlphaAt(
  params: RotationalParams,
  theta: number,
  omega: number,
  appliedTorque: number,
  inertia: number,
  gravityFactor: number
): number {
  const gTorque = params.gravityEnabled ? -gravityFactor * Math.cos(theta) : 0;
  const dTorque = params.dampingEnabled ? -params.damping * omega : 0;
  return (appliedTorque + gTorque + dTorque) / inertia;
}

/**
 * Advances rotational state using fixed-timestep RK4 integration with an accumulator.
 */
export function stepRotationalSimulation(
  params: RotationalParams,
  prev: RotationalSimulationState,
  elapsedRealDt: number,
  simSpeed: number
): RotationalSimulationState {
  const instant = computeInstantaneousRotationalDynamics(params, prev);
  if (!instant.isValid || !Number.isFinite(elapsedRealDt) || elapsedRealDt <= 0) {
    return {
      ...prev,
      alpha: instant.angularAcceleration,
    };
  }

  const scaledDt = Math.min(0.1, Math.max(0, elapsedRealDt)) * Math.max(0, simSpeed);
  let accumulator = prev.accumulator + scaledDt;
  let theta = prev.thetaRad;
  let omega = prev.omega;
  let simTime = prev.time;

  const inertia = instant.totalMomentOfInertia;
  const appliedTorque = instant.appliedTorque;
  const dRodCm = params.rodLength / 2 - instant.pivotOffset;
  const dSphere = params.spherePosition - instant.pivotOffset;
  const gravityFactor = (params.rodMass * dRodCm + params.sphereMass * dSphere) * params.gravity;

  let steps = 0;
  const h = FIXED_PHYSICS_DT;

  while (accumulator >= h && steps < MAX_ACCUMULATOR_STEPS) {
    // 4th-order Runge-Kutta (RK4) step for dθ/dt = ω, dω/dt = α(θ, ω)
    const k1Theta = omega;
    const k1Omega = computeAlphaAt(params, theta, omega, appliedTorque, inertia, gravityFactor);

    const k2Theta = omega + 0.5 * h * k1Omega;
    const k2Omega = computeAlphaAt(
      params,
      theta + 0.5 * h * k1Theta,
      k2Theta,
      appliedTorque,
      inertia,
      gravityFactor
    );

    const k3Theta = omega + 0.5 * h * k2Omega;
    const k3Omega = computeAlphaAt(
      params,
      theta + 0.5 * h * k2Theta,
      k3Theta,
      appliedTorque,
      inertia,
      gravityFactor
    );

    const k4Theta = omega + h * k3Omega;
    const k4Omega = computeAlphaAt(
      params,
      theta + h * k3Theta,
      k4Theta,
      appliedTorque,
      inertia,
      gravityFactor
    );

    const nextTheta = theta + (h / 6) * (k1Theta + 2 * k2Theta + 2 * k3Theta + k4Theta);
    const nextOmega = omega + (h / 6) * (k1Omega + 2 * k2Omega + 2 * k3Omega + k4Omega);

    if (!Number.isFinite(nextTheta) || !Number.isFinite(nextOmega)) {
      break;
    }

    theta = nextTheta;
    omega = nextOmega;
    simTime += h;
    accumulator -= h;
    steps++;
  }

  const finalAlpha = computeAlphaAt(params, theta, omega, appliedTorque, inertia, gravityFactor);

  return {
    time: simTime,
    thetaRad: theta,
    omega,
    alpha: finalAlpha,
    accumulator: steps >= MAX_ACCUMULATOR_STEPS ? 0 : accumulator,
  };
}

export function createInitialRotationalState(
  params: RotationalParams
): RotationalSimulationState {
  const thetaRad = degToRad(Number.isFinite(params.initialAngle) ? params.initialAngle : 0);
  const omega = Number.isFinite(params.initialAngularVelocity)
    ? params.initialAngularVelocity
    : 0;
  const base: RotationalSimulationState = {
    time: 0,
    thetaRad,
    omega,
    alpha: 0,
    accumulator: 0,
  };
  const snap = computeInstantaneousRotationalDynamics(params, base);
  return {
    ...base,
    alpha: snap.angularAcceleration,
  };
}

/**
 * Deterministic evaluation at arbitrary time t (used when scrubbing timeline from t=0).
 */
export function simulateRotationalToTime(
  params: RotationalParams,
  targetTime: number
): RotationalSimulationState {
  let state = createInitialRotationalState(params);
  const clampedTarget = Math.max(0, Math.min(120, targetTime));
  const totalSteps = Math.round(clampedTarget / FIXED_PHYSICS_DT);
  const chunk = 24;
  let remaining = totalSteps;
  while (remaining > 0) {
    const stepsNow = Math.min(chunk, remaining);
    state = stepRotationalSimulation(params, state, stepsNow * FIXED_PHYSICS_DT, 1);
    remaining -= stepsNow;
  }
  return state;
}
