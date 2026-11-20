import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimulationPatchFromAnalysis,
  validateAndNormalizeAnalysis,
} from './sceneSchema';
import { DEFAULT_SCENE_PARAMS } from '../physics/calculations';

test('Test A: Rotational dynamics analysis normalizes and constructs hinged rod simulation patch', () => {
  const raw = {
    sceneType: 'rotational_dynamics',
    engineSupport: 'full',
    supportNote: 'Mapped to hinged rod engine.',
    title: 'Hinged Rod Torque',
    summary: 'Uniform 2 m rod of mass 4 kg hinged at one end with 10 N force at free end.',
    imageReadabilityError: null,
    diagramInsights: [],
    objects: [
      { id: 'rod_1', name: 'Uniform Rod', type: 'uniform_rod', mass: 4, length: 2, position: [0, 0, 0], hinged: true, pivotOffset: 0, source: 'explicit_text' },
      { id: 'hinge_1', name: 'Fixed Hinge', type: 'hinge', position: [0, 0, 0], fixed: true, source: 'explicit_text' },
    ],
    forces: [
      { id: 'f1', label: 'Applied Force', type: 'applied_force', targetObjectId: 'rod_1', magnitude: 10, angleDeg: 90, applicationPointDescription: 'Free end', applicationDistance: 2, source: 'explicit_text' },
    ],
    connections: [
      { id: 'c1', type: 'fixed_hinge', objectIds: ['rod_1', 'hinge_1'], description: 'Rod hinged at left end' },
    ],
    constraints: ['Rigid body fixed rotation about Z axis'],
    equations: ['τ = r · F · sin(θ)', 'α = τ / I'],
    unknowns: ['angular acceleration α'],
    extractedVariables: [
      { key: 'rodLength', label: 'Rod length', value: 2, unit: 'm', source: 'explicit_text', editable: true },
      { key: 'rodMass', label: 'Rod mass', value: 4, unit: 'kg', source: 'explicit_text', editable: true },
      { key: 'forceMagnitude', label: 'Applied force', value: 10, unit: 'N', source: 'explicit_text', editable: true },
      { key: 'forceAngle', label: 'Force angle', value: 90, unit: 'deg', source: 'explicit_text', editable: true },
      { key: 'forceDistance', label: 'Application distance', value: 2, unit: 'm', source: 'explicit_text', editable: true },
    ],
    assumptions: [
      { id: 'a1', statement: 'Neglect gravity unless specified', category: 'force', enabled: false, editable: true, impactKey: 'gravityEnabled', impactValue: true },
    ],
    missingInformation: [],
    simulationConfig: {
      preset: 'rotational',
      rotationalParams: { rodLength: 2, rodMass: 4, forceMagnitude: 10, forceAngle: 90, forceDistance: 2, gravityEnabled: false },
    },
  };

  const analysis = validateAndNormalizeAnalysis(raw);
  assert.equal(analysis.validationErrors.length, 0);
  const built = buildSimulationPatchFromAnalysis(analysis, DEFAULT_SCENE_PARAMS);
  assert.equal(built.validationError, null);
  assert.equal(built.preset, 'rotational');
  assert.equal(built.patch.rotational?.rodLength, 2);
  assert.equal(built.patch.rotational?.rodMass, 4);
  assert.equal(built.patch.rotational?.forceMagnitude, 10);
});

test('Test B: Atwood machine maps massless pulley and both block masses', () => {
  const analysis = validateAndNormalizeAnalysis({
    sceneType: 'pulley_system',
    engineSupport: 'full',
    title: 'Atwood Machine',
    summary: '3 kg and 5 kg blocks over ideal pulley.',
    extractedVariables: [
      { key: 'massLeft', label: 'Left mass', value: 3, unit: 'kg', source: 'explicit_text', editable: true },
      { key: 'massRight', label: 'Right mass', value: 5, unit: 'kg', source: 'explicit_text', editable: true },
      { key: 'pulleyMass', label: 'Pulley mass', value: 0, unit: 'kg', source: 'assumed', editable: true },
    ],
    simulationConfig: { preset: 'pulley' },
  });

  const built = buildSimulationPatchFromAnalysis(analysis, DEFAULT_SCENE_PARAMS);
  assert.equal(built.preset, 'pulley');
  assert.equal(built.patch.pulley?.massLeft, 3);
  assert.equal(built.patch.pulley?.massRight, 5);
  assert.equal(built.patch.pulley?.pulleyMass, 0);
});

test('Test C & D: Rolling missing info and Block on rough surface with toggleable friction', () => {
  const rollingAnalysis = validateAndNormalizeAnalysis({
    sceneType: 'rolling_motion',
    engineSupport: 'partial',
    title: 'Rolling Cylinder',
    summary: 'Solid cylinder rolling down incline.',
    extractedVariables: [
      { key: 'inclineAngle', label: 'Incline angle', value: 30, unit: 'deg', source: 'assumed', editable: true },
      { key: 'cylinderMass', label: 'Cylinder mass', value: 2, unit: 'kg', source: 'assumed', editable: true },
    ],
    missingInformation: [
      { id: 'm1', field: 'inclineAngle', prompt: 'Incline angle was not specified.', critical: false, suggestedDefault: 30, unit: 'deg' },
    ],
    simulationConfig: { preset: 'rolling' },
  });
  assert.equal(rollingAnalysis.missingInformation.length, 1);
  const rollingBuilt = buildSimulationPatchFromAnalysis(rollingAnalysis, DEFAULT_SCENE_PARAMS);
  assert.equal(rollingBuilt.preset, 'rolling');
  assert.equal(rollingBuilt.patch.rolling?.inclineAngle, 30);

  const blockAnalysis = validateAndNormalizeAnalysis({
    sceneType: 'block_surface',
    engineSupport: 'partial',
    title: 'Block on Rough Surface',
    summary: 'Block pulled by inclined force on rough surface.',
    extractedVariables: [
      { key: 'mass', label: 'Block mass', value: 6, unit: 'kg', source: 'assumed', editable: true },
      { key: 'appliedForce', label: 'Pull force', value: 35, unit: 'N', source: 'assumed', editable: true },
      { key: 'forceAngle', label: 'Force angle', value: 25, unit: 'deg', source: 'assumed', editable: true },
      { key: 'muStatic', label: 'Static friction', value: 0.4, unit: '', source: 'assumed', editable: true },
    ],
    assumptions: [
      { id: 'f_on', statement: 'Surface is rough (friction active)', category: 'force', enabled: true, editable: true, impactKey: 'frictionEnabled', impactValue: true },
    ],
    simulationConfig: { preset: 'block_surface' },
  });
  const blockBuilt = buildSimulationPatchFromAnalysis(blockAnalysis, DEFAULT_SCENE_PARAMS);
  assert.equal(blockBuilt.preset, 'block_surface');
  assert.equal(blockBuilt.patch.block_surface?.mass, 6);
  assert.equal(blockBuilt.patch.block_surface?.frictionEnabled, true);
});

test('Rejects invalid physical geometry and unsupported physics systems safely', () => {
  const invalidGeom = validateAndNormalizeAnalysis({
    sceneType: 'rotational_dynamics',
    engineSupport: 'full',
    extractedVariables: [
      { key: 'rodMass', label: 'Rod mass', value: -4, unit: 'kg', source: 'explicit_text', editable: true },
    ],
  });
  assert.ok(invalidGeom.validationErrors.length > 0);
  const builtInvalid = buildSimulationPatchFromAnalysis(invalidGeom, DEFAULT_SCENE_PARAMS);
  assert.ok(builtInvalid.validationError !== null);

  const unsupported = validateAndNormalizeAnalysis({
    sceneType: 'unsupported',
    engineSupport: 'unsupported',
    supportNote: 'Quantum wavefunctions cannot be mapped to rigid body dynamics.',
  });
  assert.equal(unsupported.engineSupport, 'unsupported');
  const builtUnsupported = buildSimulationPatchFromAnalysis(unsupported, DEFAULT_SCENE_PARAMS);
  assert.ok(builtUnsupported.validationError !== null);
});
