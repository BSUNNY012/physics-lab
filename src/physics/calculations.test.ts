import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBlockSurfacePhysics,
  calculateCollisionPhysics,
  calculatePhysicsSnapshot,
  calculatePulleyPhysics,
  calculateRollingPhysics,
  calculateRotationalPhysics,
  DEFAULT_SCENE_PARAMS,
  getSampleRotationalQuestionParams,
} from './calculations';

test('Sample JEE rotational problem computes exact textbook torque, inertia, and angular acceleration', () => {
  const sample = getSampleRotationalQuestionParams();
  const snap = calculateRotationalPhysics(sample, 0);

  // L = 2m, m = 4kg, F = 10N, angle = 90deg => tau = 20 N*m, I = 1/3 * 4 * 4 = 5.3333, alpha = 3.75 rad/s^2
  assert.ok(Math.abs(snap.torque - 20.0) < 1e-6);
  assert.ok(Math.abs(snap.momentOfInertia - 16 / 3) < 1e-6);
  assert.ok(Math.abs(snap.angularAcceleration - 3.75) < 1e-6);
  assert.equal(snap.currentAngleDeg, 0);
});

test('Rotational motion integrates angle and angular velocity smoothly over time', () => {
  const sample = getSampleRotationalQuestionParams();
  const snapAt2s = calculateRotationalPhysics(sample, 2.0);

  // With alpha = 3.75 rad/s^2 and omega0 = 0, at t = 2s: omega ~ 7.5 rad/s, theta ~ 0.5 * 3.75 * 4 = 7.5 rad
  assert.ok(Math.abs(snapAt2s.angularVelocity - 7.5) < 0.15);
  assert.ok(Math.abs(snapAt2s.currentAngleRad - 7.5) < 0.2);
});

test('Parallel axis theorem updates inertia and torque when pivot offset shifts', () => {
  const centered = {
    ...getSampleRotationalQuestionParams(),
    pivotOffset: 1.0, // center of 2m rod
  };
  const snap = calculateRotationalPhysics(centered, 0);

  // I_cm = (1/12) * 4 * 4 = 1.3333, rForce = 1m => tau = 10 N*m, alpha = 7.5 rad/s^2
  assert.ok(Math.abs(snap.momentOfInertia - 4 / 3) < 1e-6);
  assert.ok(Math.abs(snap.torque - 10.0) < 1e-6);
  assert.ok(Math.abs(snap.angularAcceleration - 7.5) < 1e-6);
});

test('Rolling cylinder on incline computes 2/3 g sin(theta) acceleration', () => {
  const snap = calculateRollingPhysics(
    {
      inclineAngle: 30,
      cylinderMass: 3,
      cylinderRadius: 0.5,
      rampLength: 5,
      gravity: 9.81,
    },
    0
  );
  // a = (2/3) * 9.81 * 0.5 = 3.27 m/s^2; alpha = a / R = 6.54 rad/s^2
  assert.ok(Math.abs(snap.angularAcceleration - 6.54) < 1e-3);
});

test('Atwood pulley system obeys Newton second law with pulley inertia', () => {
  const snap = calculatePulleyPhysics(
    {
      massLeft: 2,
      massRight: 4,
      pulleyMass: 2,
      pulleyRadius: 0.5,
      gravity: 10,
    },
    0
  );
  // a = (4 - 2)*10 / (2 + 4 + 1) = 20 / 7 = 2.8571 m/s^2; alpha = 5.714 rad/s^2
  assert.ok(Math.abs(snap.angularAcceleration - 40 / 7) < 1e-3);
});

test('1D elastic collision conserves momentum and swaps velocities for equal masses', () => {
  const snap = calculateCollisionPhysics(
    {
      massA: 2,
      velocityA: 3,
      massB: 2,
      velocityB: -1,
      restitution: 1,
    },
    5,
    10
  );
  assert.equal(snap.kinematicState.collisionOccurred, true);
  assert.ok(Math.abs(snap.angularAcceleration - -1) < 1e-6); // v1 = -1
  assert.ok(Math.abs(snap.currentAngleDeg - 3) < 1e-6); // v2 = 3
});

test('Atwood machine with ideal massless pulley computes exact acceleration and tension', () => {
  const snap = calculatePulleyPhysics(
    {
      massLeft: 3,
      massRight: 5,
      pulleyMass: 0,
      pulleyRadius: 0.35,
      gravity: 10,
    },
    0
  );
  // a = (5 - 3)*10 / (3 + 5) = 2.5 m/s^2; T = 3*(10+2.5) = 37.5 N
  assert.ok(Math.abs(snap.forceMagnitude - 37.5) < 1e-6);
  assert.ok(Math.abs(snap.angularAcceleration - 2.5 / 0.35) < 1e-4);
});

test('Block on rough horizontal surface resolves static equilibrium vs kinetic sliding and liftoff', () => {
  // Static equilibrium case: m=10kg, g=10, muS=0.5, F=20N @ 0 deg => f_max=50N => a=0
  const staticSnap = calculateBlockSurfacePhysics(
    {
      mass: 10,
      appliedForce: 20,
      forceAngle: 0,
      muStatic: 0.5,
      muKinetic: 0.3,
      gravity: 10,
      initialVelocity: 0,
      frictionEnabled: true,
    },
    1.0
  );
  assert.equal(staticSnap.blockSurfaceDetails?.isStaticEquilibrium, true);
  assert.equal(staticSnap.blockSurfaceDetails?.accelerationX, 0);
  assert.ok(Math.abs((staticSnap.blockSurfaceDetails?.frictionForce ?? 0) + 20) < 1e-6);

  // Kinetic sliding case: m=5kg, g=10, F=40N @ 30 deg, muS=0.4, muK=0.2
  // Fx = 34.641 N, Fy = 20 N, N = 50 - 20 = 30 N, f_k = -6 N => F_net = 28.641 N, a = 5.7282 m/s^2
  const slideSnap = calculateBlockSurfacePhysics(
    {
      mass: 5,
      appliedForce: 40,
      forceAngle: 30,
      muStatic: 0.4,
      muKinetic: 0.2,
      gravity: 10,
      initialVelocity: 0,
      frictionEnabled: true,
    },
    0
  );
  assert.equal(slideSnap.blockSurfaceDetails?.isStaticEquilibrium, false);
  assert.ok(Math.abs((slideSnap.blockSurfaceDetails?.normalForce ?? 0) - 30) < 1e-6);
  assert.ok(Math.abs((slideSnap.blockSurfaceDetails?.accelerationX ?? 0) - (40 * Math.cos(Math.PI / 6) - 6) / 5) < 1e-5);

  // Liftoff case: Fy > mg
  const liftSnap = calculateBlockSurfacePhysics(
    {
      mass: 2,
      appliedForce: 100,
      forceAngle: 60,
      muStatic: 0.4,
      muKinetic: 0.3,
      gravity: 10,
      initialVelocity: 0,
      frictionEnabled: true,
    },
    0
  );
  assert.equal(liftSnap.blockSurfaceDetails?.isLiftedOff, true);
  assert.equal(liftSnap.blockSurfaceDetails?.normalForce, 0);
});

test('calculatePhysicsSnapshot dispatches all presets without error', () => {
  const presets = ['rotational', 'rolling', 'pulley', 'collisions', 'oscillations', 'block_surface'] as const;
  for (const preset of presets) {
    const res = calculatePhysicsSnapshot(preset, DEFAULT_SCENE_PARAMS, 1.5, 10);
    assert.equal(res.primaryReadouts.length, 5);
  }
});
