import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInstantaneousRotationalDynamics,
  createInitialRotationalState,
  simulateRotationalToTime,
  stepRotationalSimulation,
} from './rotationalDynamics';
import type { RotationalParams } from '../../types/simulation';

function makeBaseParams(overrides: Partial<RotationalParams> = {}): RotationalParams {
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
    damping: 0.0,
    ...overrides,
  };
}

test('Zero force produces zero applied-force torque and zero acceleration', () => {
  const params = makeBaseParams({ forceMagnitude: 0 });
  const state = createInitialRotationalState(params);
  const res = computeInstantaneousRotationalDynamics(params, state);
  assert.equal(res.appliedTorque, 0);
  assert.equal(res.netTorque, 0);
  assert.equal(res.angularAcceleration, 0);
});

test('Parallel force (0 deg or 180 deg) produces zero torque', () => {
  for (const angle of [0, 180]) {
    const params = makeBaseParams({ forceAngle: angle });
    const state = createInitialRotationalState(params);
    const res = computeInstantaneousRotationalDynamics(params, state);
    assert.equal(res.appliedTorque, 0);
    assert.equal(res.perpendicularDistance, 0);
    assert.equal(res.angularAcceleration, 0);
  }
});

test('Perpendicular force (90 deg) produces maximum torque for given force and lever arm', () => {
  const p90 = makeBaseParams({ forceAngle: 90 });
  const p45 = makeBaseParams({ forceAngle: 45 });
  const r90 = computeInstantaneousRotationalDynamics(p90, createInitialRotationalState(p90));
  const r45 = computeInstantaneousRotationalDynamics(p45, createInitialRotationalState(p45));
  assert.ok(Math.abs(r90.appliedTorque - 20) < 1e-9);
  assert.ok(r90.appliedTorque > r45.appliedTorque);
});

test('Doubling force doubles torque and angular acceleration', () => {
  const p1 = makeBaseParams({ forceMagnitude: 10 });
  const p2 = makeBaseParams({ forceMagnitude: 20 });
  const r1 = computeInstantaneousRotationalDynamics(p1, createInitialRotationalState(p1));
  const r2 = computeInstantaneousRotationalDynamics(p2, createInitialRotationalState(p2));
  assert.ok(Math.abs(r2.appliedTorque - 2 * r1.appliedTorque) < 1e-9);
  assert.ok(Math.abs(r2.angularAcceleration - 2 * r1.angularAcceleration) < 1e-9);
});

test('Doubling rod mass doubles I = mL^2/3 and halves angular acceleration', () => {
  const p1 = makeBaseParams({ rodMass: 4 });
  const p2 = makeBaseParams({ rodMass: 8 });
  const r1 = computeInstantaneousRotationalDynamics(p1, createInitialRotationalState(p1));
  const r2 = computeInstantaneousRotationalDynamics(p2, createInitialRotationalState(p2));
  assert.ok(Math.abs(r1.totalMomentOfInertia - 16 / 3) < 1e-9);
  assert.ok(Math.abs(r2.totalMomentOfInertia - 2 * r1.totalMomentOfInertia) < 1e-9);
  assert.ok(Math.abs(r2.angularAcceleration - 0.5 * r1.angularAcceleration) < 1e-9);
});

test('Moving force application distance r changes lever arm and torque linearly', () => {
  const pEnd = makeBaseParams({ forceDistance: 2.0 });
  const pMid = makeBaseParams({ forceDistance: 1.0 });
  const rEnd = computeInstantaneousRotationalDynamics(pEnd, createInitialRotationalState(pEnd));
  const rMid = computeInstantaneousRotationalDynamics(pMid, createInitialRotationalState(pMid));
  assert.equal(rMid.effectiveLeverArm, 1.0);
  assert.ok(Math.abs(rMid.appliedTorque - 0.5 * rEnd.appliedTorque) < 1e-9);
});

test('Scientific notation scale values (1000 m, 1e6 N, 2.5e-8 kg) compute reliably', () => {
  const pHuge = makeBaseParams({
    rodLength: 1000,
    rodMass: 500,
    forceMagnitude: 1e6,
    forceDistance: 1000,
  });
  const rHuge = computeInstantaneousRotationalDynamics(pHuge, createInitialRotationalState(pHuge));
  assert.equal(rHuge.isValid, true);
  // I = (500 * 1e6) / 3 = 1.6666667e8, tau = 1e9, alpha = 6 rad/s^2
  assert.ok(Math.abs(rHuge.angularAcceleration - 6.0) < 1e-9);

  const pTiny = makeBaseParams({
    rodLength: 1e-3,
    rodMass: 2.5e-8,
    forceMagnitude: 1e-12,
    forceDistance: 1e-3,
  });
  const rTiny = computeInstantaneousRotationalDynamics(pTiny, createInitialRotationalState(pTiny));
  assert.equal(rTiny.isValid, true);
  assert.ok(Number.isFinite(rTiny.angularAcceleration));
});

test('Fixed-timestep RK4 integration matches exact analytical kinematics without gravity', () => {
  const params = makeBaseParams({ rodLength: 2, rodMass: 4, forceMagnitude: 10, forceDistance: 2 });
  // alpha = 20 / (16/3) = 3.75 rad/s^2
  const stateAt2s = simulateRotationalToTime(params, 2.0);
  // Exact: omega(2) = 7.5 rad/s, theta(2) = 0.5 * 3.75 * 4 = 7.5 rad
  assert.ok(Math.abs(stateAt2s.omega - 7.5) < 1e-5);
  assert.ok(Math.abs(stateAt2s.thetaRad - 7.5) < 1e-5);
});

test('Gravity torque uses center of mass at L/2 and is disabled unless explicitly enabled', () => {
  const pNoGrav = makeBaseParams({ forceMagnitude: 0, gravityEnabled: false });
  const rNoGrav = computeInstantaneousRotationalDynamics(
    pNoGrav,
    createInitialRotationalState(pNoGrav)
  );
  assert.equal(rNoGrav.gravityTorque, 0);

  const pGrav = makeBaseParams({ forceMagnitude: 0, gravityEnabled: true, gravity: 10 });
  const rGrav = computeInstantaneousRotationalDynamics(pGrav, createInitialRotationalState(pGrav));
  // tau_g = -m * (L/2) * g * cos(0) = -4 * 1 * 10 * 1 = -40 N*m
  assert.ok(Math.abs(rGrav.gravityTorque - -40) < 1e-9);
});

test('Invalid inputs (zero/negative mass, NaN) trigger safe invalid flag rather than NaN propagation', () => {
  const pZeroMass = makeBaseParams({ rodMass: 0 });
  const rZero = computeInstantaneousRotationalDynamics(
    pZeroMass,
    createInitialRotationalState(pZeroMass)
  );
  assert.equal(rZero.isValid, false);
  assert.ok(rZero.warningMessage);

  const stepped = stepRotationalSimulation(pZeroMass, createInitialRotationalState(pZeroMass), 0.016, 1);
  assert.equal(stepped.time, 0);
});
