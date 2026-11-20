import * as THREE from 'three';
import type { LabMaterialLibrary } from './materials';
import { createAxisLabelSprite } from './materials';
import {
  mapForceToSceneArrowLength,
  mapRodLengthToScene,
  mapTorqueToSceneArrowLength,
} from './visualScale';
import type { VectorVisibilityFlags } from '../physics/engine/types';
import { getEffectiveForceDistance } from '../physics/engine/rotationalDynamics';
import type { LabSceneParams, PhysicsSnapshot, SelectablePartId } from '../types/simulation';

export interface RotationalRigHandles {
  root: THREE.Group;
  pedestalGroup: THREE.Group;
  rodPivotGroup: THREE.Group;
  rodBodyGroup: THREE.Group;
  rodMesh: THREE.Mesh;
  rodEndCapLeft: THREE.Mesh;
  rodEndCapRight: THREE.Mesh;
  sphereGroup: THREE.Group;
  sphereMesh: THREE.Mesh;
  forceArrowGroup: THREE.Group;
  forceShaft: THREE.Mesh;
  forceHead: THREE.Mesh;
  forceAngleArc: THREE.Line;
  leverArmGroup: THREE.Group;
  leverShaft: THREE.Mesh;
  leverHead: THREE.Mesh;
  perpGroup: THREE.Group;
  forceActionLine: THREE.Line;
  perpLine: THREE.Line;
  rightAngleMarker: THREE.Line;
  torqueArrowGroup: THREE.Group;
  torqueShaft: THREE.Mesh;
  torqueHead: THREE.Mesh;
  rotationArcGroup: THREE.Group;
  rotationArcLine: THREE.Line;
  rotationArcHead: THREE.Mesh;
  extraForceArrows: Array<{ group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh }>;
  interactables: THREE.Object3D[];
}

export interface RollingRigHandles {
  root: THREE.Group;
  rampGroup: THREE.Group;
  rampPlank: THREE.Mesh;
  rampWedge: THREE.Mesh;
  cylinderGroup: THREE.Group;
  normalArrow: THREE.Group;
  frictionArrow: THREE.Group;
  interactables: THREE.Object3D[];
}

export interface PulleyRigHandles {
  root: THREE.Group;
  wheelGroup: THREE.Group;
  massLeftGroup: THREE.Group;
  massRightGroup: THREE.Group;
  cableLeft: THREE.Mesh;
  cableRight: THREE.Mesh;
  tensionArrowLeft: THREE.Group;
  tensionArrowRight: THREE.Group;
  interactables: THREE.Object3D[];
}

export interface CollisionRigHandles {
  root: THREE.Group;
  gliderA: THREE.Group;
  gliderB: THREE.Group;
  velArrowA: THREE.Group;
  velArrowB: THREE.Group;
  interactables: THREE.Object3D[];
}

export interface OscillationRigHandles {
  root: THREE.Group;
  armGroup: THREE.Group;
  rodMesh: THREE.Mesh;
  bobGroup: THREE.Group;
  forceArrow: THREE.Group;
  interactables: THREE.Object3D[];
}

export interface BlockSurfaceRigHandles {
  root: THREE.Group;
  surfaceGroup: THREE.Group;
  treadGroup: THREE.Group;
  blockGroup: THREE.Group;
  blockBody: THREE.Mesh;
  pullArrow: { group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh };
  gravityArrow: { group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh };
  normalArrow: { group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh };
  frictionArrow: { group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh };
  angleArc: THREE.Line;
  interactables: THREE.Object3D[];
}

function tagSelectable(obj: THREE.Object3D, partId: SelectablePartId) {
  obj.traverse((child) => {
    child.userData.partId = partId;
  });
}

export function buildVectorArrow(
  material: THREE.Material,
  shaftRadius = 0.025,
  headRadius = 0.065,
  headHeight = 0.18
): { group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh } {
  const group = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1, 16);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, material);
  shaft.castShadow = true;

  const headGeo = new THREE.ConeGeometry(headRadius, headHeight, 18);
  headGeo.translate(0, headHeight / 2, 0);
  const head = new THREE.Mesh(headGeo, material);
  head.castShadow = true;

  group.add(shaft, head);
  return { group, shaft, head };
}

export function setVectorArrowLength(
  shaft: THREE.Mesh,
  head: THREE.Mesh,
  totalLength: number,
  headHeight = 0.18
) {
  const clamped = Math.max(0.22, totalLength);
  const shaftLen = Math.max(0.05, clamped - headHeight);
  shaft.scale.set(1, shaftLen, 1);
  head.position.set(0, shaftLen, 0);
}

export function buildLabStage(mats: LabMaterialLibrary): {
  stageGroup: THREE.Group;
  gridMajor: THREE.GridHelper;
  gridMinor: THREE.GridHelper;
  axesGroup: THREE.Group;
} {
  const stageGroup = new THREE.Group();

  // Machined optical bench floor slab seated just below y=0 so grids sit cleanly at y=0.004
  const benchGeo = new THREE.CylinderGeometry(7.2, 7.45, 0.16, 48);
  const benchMesh = new THREE.Mesh(benchGeo, mats.benchSurface);
  benchMesh.position.y = -0.085;
  benchMesh.receiveShadow = true;
  stageGroup.add(benchMesh);

  // Outer perimeter metallic bevel ring
  const rimGeo = new THREE.TorusGeometry(7.2, 0.045, 12, 64);
  rimGeo.rotateX(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, mats.anodizedBase);
  rimMesh.position.y = -0.005;
  stageGroup.add(rimMesh);

  // Standard and fine floor grids
  const gridMajor = new THREE.GridHelper(12, 12, 0x1e3a5f, 0x152236);
  gridMajor.position.y = 0.005;
  const gridMinor = new THREE.GridHelper(12, 24, 0x1b3454, 0x111c2d);
  gridMinor.position.y = 0.004;
  gridMinor.visible = false;
  stageGroup.add(gridMajor, gridMinor);

  // Coordinate Axes (X = Red, Y = Emerald, Z = Blue)
  const axesGroup = new THREE.Group();
  axesGroup.position.set(0, 0.01, 0);

  const axisDefs: Array<{
    label: string;
    hex: string;
    color: number;
    rot: [number, number, number];
    pos: [number, number, number];
  }> = [
    { label: 'X', hex: '#f87171', color: 0xef4444, rot: [0, 0, -Math.PI / 2], pos: [2.42, 0.08, 0] },
    { label: 'Y', hex: '#34d399', color: 0x10b981, rot: [0, 0, 0], pos: [0, 2.42, 0] },
    { label: 'Z', hex: '#60a5fa', color: 0x3b82f6, rot: [Math.PI / 2, 0, 0], pos: [0, 0.08, 2.42] },
  ];

  for (const def of axisDefs) {
    const mat = new THREE.MeshBasicMaterial({ color: def.color });
    const arrow = buildVectorArrow(mat, 0.012, 0.042, 0.14);
    setVectorArrowLength(arrow.shaft, arrow.head, 2.2, 0.14);
    arrow.group.rotation.set(...def.rot);
    axesGroup.add(arrow.group);

    const sprite = createAxisLabelSprite(def.label, def.hex);
    sprite.position.set(...def.pos);
    axesGroup.add(sprite);
  }

  stageGroup.add(axesGroup);
  return { stageGroup, gridMajor, gridMinor, axesGroup };
}

export function buildRotationalRig(mats: LabMaterialLibrary): RotationalRigHandles {
  const root = new THREE.Group();
  const pivotHeight = 1.65;

  // 1. Fixed Pivot Pedestal (Composite 7-part assembly grounded at y=0)
  const pedestalGroup = new THREE.Group();

  const contactDisc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), mats.contactShadow);
  contactDisc.rotation.x = -Math.PI / 2;
  contactDisc.position.y = 0.012;
  pedestalGroup.add(contactDisc);

  const basePlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.54, 0.12, 32),
    mats.anodizedBase
  );
  basePlinth.position.y = 0.06;
  basePlinth.castShadow = true;
  basePlinth.receiveShadow = true;
  pedestalGroup.add(basePlinth);

  const flangeRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.08, 24),
    mats.machinedBrass
  );
  flangeRing.position.y = 0.15;
  flangeRing.castShadow = true;
  pedestalGroup.add(flangeRing);

  // 4 mounting bolts around plinth
  const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    const bolt = new THREE.Mesh(boltGeo, mats.brushedSteel);
    bolt.position.set(Math.cos(ang) * 0.4, 0.125, Math.sin(ang) * 0.4);
    pedestalGroup.add(bolt);
  }

  // Twin vertical stanchion column
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.11, pivotHeight - 0.18, 24),
    mats.anodizedBase
  );
  column.position.set(0, 0.18 + (pivotHeight - 0.18) / 2, -0.14);
  column.castShadow = true;
  pedestalGroup.add(column);

  // Bearing housing + axle pin along Z at (0, pivotHeight, 0)
  const bearingHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.22, 24),
    mats.anodizedBase
  );
  bearingHousing.rotation.x = Math.PI / 2;
  bearingHousing.position.set(0, pivotHeight, -0.06);
  bearingHousing.castShadow = true;
  pedestalGroup.add(bearingHousing);

  const axlePin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.3, 24),
    mats.machinedBrass
  );
  axlePin.rotation.x = Math.PI / 2;
  axlePin.position.set(0, pivotHeight, 0.01);
  axlePin.castShadow = true;
  pedestalGroup.add(axlePin);

  tagSelectable(pedestalGroup, 'pivot');
  root.add(pedestalGroup);

  // 2. Rotating Rod Assembly pivoted at (0, pivotHeight, 0)
  const rodPivotGroup = new THREE.Group();
  rodPivotGroup.position.set(0, pivotHeight, 0.07);

  const rodBodyGroup = new THREE.Group();
  // Unit-length cylinder along X axis (scaled along X dynamically)
  const rodGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 24);
  rodGeo.rotateZ(-Math.PI / 2);
  rodGeo.translate(0.5, 0, 0);
  const rodMesh = new THREE.Mesh(rodGeo, mats.brushedSteel);
  rodMesh.castShadow = true;
  rodMesh.receiveShadow = true;

  const capGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.045, 20);
  capGeo.rotateZ(-Math.PI / 2);
  const rodEndCapLeft = new THREE.Mesh(capGeo, mats.machinedBrass);
  const rodEndCapRight = new THREE.Mesh(capGeo, mats.machinedBrass);
  rodEndCapLeft.castShadow = true;
  rodEndCapRight.castShadow = true;

  rodBodyGroup.add(rodMesh, rodEndCapLeft, rodEndCapRight);
  tagSelectable(rodBodyGroup, 'rod');
  rodPivotGroup.add(rodBodyGroup);

  // 3. Sliding Spherical Mass + Clamp Collar
  const sphereGroup = new THREE.Group();
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.11, 20),
    mats.machinedBrass
  );
  collar.rotation.z = Math.PI / 2;
  collar.castShadow = true;

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.08, 12),
    mats.anodizedBase
  );
  neck.position.y = 0.06;

  const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), mats.cyanAlloy);
  sphereMesh.position.y = 0.19;
  sphereMesh.castShadow = true;
  sphereMesh.receiveShadow = true;

  sphereGroup.add(collar, neck, sphereMesh);
  tagSelectable(sphereGroup, 'sphere');
  rodPivotGroup.add(sphereGroup);

  // 4. Applied Force Vector Arrow + Angle Arc at Application Point r
  const { group: forceArrowGroup, shaft: forceShaft, head: forceHead } = buildVectorArrow(
    mats.amberForce,
    0.024,
    0.068,
    0.18
  );
  tagSelectable(forceArrowGroup, 'force');
  rodPivotGroup.add(forceArrowGroup);

  const arcMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.78 });
  const forceAngleArc = new THREE.Line(new THREE.BufferGeometry(), arcMat);
  rodPivotGroup.add(forceAngleArc);

  // 5. Lever Arm Vector r (from pivot to force application point)
  const { group: leverArmGroup, shaft: leverShaft, head: leverHead } = buildVectorArrow(
    mats.cyanVector,
    0.017,
    0.052,
    0.15
  );
  leverArmGroup.position.set(0, 0, 0.088);
  rodPivotGroup.add(leverArmGroup);

  // 6. Perpendicular Distance r_perp & Force Line of Action + Right Angle Marker
  const perpGroup = new THREE.Group();
  const actionLineMat = new THREE.LineDashedMaterial({
    color: 0xf59e0b,
    dashSize: 0.09,
    gapSize: 0.06,
    transparent: true,
    opacity: 0.55,
  });
  const forceActionLine = new THREE.Line(new THREE.BufferGeometry(), actionLineMat);

  const perpLineMat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 0.08,
    gapSize: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  const perpLine = new THREE.Line(new THREE.BufferGeometry(), perpLineMat);

  const rightAngleMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.95,
  });
  const rightAngleMarker = new THREE.Line(new THREE.BufferGeometry(), rightAngleMat);

  perpGroup.add(forceActionLine, perpLine, rightAngleMarker);
  rodPivotGroup.add(perpGroup);

  root.add(rodPivotGroup);

  // 7. Torque Vector τ along Fixed Pivot Z-Axis (Right-Hand Rule)
  const { group: torqueArrowGroup, shaft: torqueShaft, head: torqueHead } = buildVectorArrow(
    mats.violetTorque,
    0.024,
    0.066,
    0.18
  );
  torqueArrowGroup.position.set(0, pivotHeight, 0.14);
  root.add(torqueArrowGroup);

  // 8. Instantaneous Rotation Direction Indicator (ω / α arc around pivot)
  const rotationArcGroup = new THREE.Group();
  rotationArcGroup.position.set(0, pivotHeight, 0.12);
  const rotArcMat = new THREE.LineBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.9,
  });
  const rotationArcLine = new THREE.Line(new THREE.BufferGeometry(), rotArcMat);
  const rotHeadGeo = new THREE.ConeGeometry(0.052, 0.13, 16);
  const rotationArcHead = new THREE.Mesh(rotHeadGeo, mats.emeraldArc);
  rotationArcGroup.add(rotationArcLine, rotationArcHead);
  root.add(rotationArcGroup);

  const extraForceArrows: Array<{ group: THREE.Group; shaft: THREE.Mesh; head: THREE.Mesh }> = [];
  for (let i = 0; i < 3; i++) {
    const extra = buildVectorArrow(mats.amberForce, 0.02, 0.056, 0.16);
    extra.group.visible = false;
    tagSelectable(extra.group, 'force');
    rodPivotGroup.add(extra.group);
    extraForceArrows.push(extra);
  }

  return {
    root,
    pedestalGroup,
    rodPivotGroup,
    rodBodyGroup,
    rodMesh,
    rodEndCapLeft,
    rodEndCapRight,
    sphereGroup,
    sphereMesh,
    forceArrowGroup,
    forceShaft,
    forceHead,
    forceAngleArc,
    leverArmGroup,
    leverShaft,
    leverHead,
    perpGroup,
    forceActionLine,
    perpLine,
    rightAngleMarker,
    torqueArrowGroup,
    torqueShaft,
    torqueHead,
    rotationArcGroup,
    rotationArcLine,
    rotationArcHead,
    extraForceArrows,
    interactables: [pedestalGroup, rodBodyGroup, sphereGroup, forceArrowGroup],
  };
}

export function buildRollingRig(mats: LabMaterialLibrary): RollingRigHandles {
  const root = new THREE.Group();
  const rampGroup = new THREE.Group();

  const rampPlank = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1.3), mats.anodizedBase);
  rampPlank.castShadow = true;
  rampPlank.receiveShadow = true;

  const rampWedge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1, 1.1), mats.brushedSteel);
  rampWedge.castShadow = true;

  rampGroup.add(rampPlank, rampWedge);
  root.add(rampGroup);

  // Spoked solid cylinder assembly
  const cylinderGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.65, 32), mats.cyanAlloy);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 20), mats.machinedBrass);
  hub.rotation.x = Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.7), mats.anodizedBase);
  cylinderGroup.add(body, hub, spoke);
  root.add(cylinderGroup);

  const normal = buildVectorArrow(mats.violetAlloy, 0.02, 0.055, 0.15);
  const friction = buildVectorArrow(mats.amberForce, 0.02, 0.055, 0.15);
  root.add(normal.group, friction.group);

  tagSelectable(rampGroup, 'ramp');
  tagSelectable(cylinderGroup, 'cylinder');

  return {
    root,
    rampGroup,
    rampPlank,
    rampWedge,
    cylinderGroup,
    normalArrow: normal.group,
    frictionArrow: friction.group,
    interactables: [rampGroup, cylinderGroup],
  };
}

export function buildPulleyRig(mats: LabMaterialLibrary): PulleyRigHandles {
  const root = new THREE.Group();

  // Gantry frame
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.2), mats.anodizedBase);
  base.position.y = 0.05;
  base.receiveShadow = true;
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 16), mats.brushedSteel);
  postL.position.set(-0.9, 1.65, -0.25);
  const postR = postL.clone();
  postR.position.set(0.9, 1.65, -0.25);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.18), mats.anodizedBase);
  beam.position.set(0, 3.25, -0.25);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.35), mats.anodizedBase);
  bracket.position.set(0, 3.15, -0.05);
  root.add(base, postL, postR, beam, bracket);

  // Grooved pulley wheel
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, 3.05, 0.08);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.14, 32), mats.machinedBrass);
  wheel.rotation.x = Math.PI / 2;
  wheel.castShadow = true;
  const spokeA = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.16), mats.anodizedBase);
  const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.16), mats.anodizedBase);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 16), mats.brushedSteel);
  hub.rotation.x = Math.PI / 2;
  wheelGroup.add(wheel, spokeA, spokeB, hub);
  root.add(wheelGroup);

  const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
  const cableLeft = new THREE.Mesh(cableGeo, mats.cableDark);
  const cableRight = new THREE.Mesh(cableGeo, mats.cableDark);
  root.add(cableLeft, cableRight);

  const massLeftGroup = new THREE.Group();
  const blockL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mats.cyanAlloy);
  blockL.castShadow = true;
  massLeftGroup.add(blockL);

  const massRightGroup = new THREE.Group();
  const blockR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mats.violetAlloy);
  blockR.castShadow = true;
  massRightGroup.add(blockR);
  root.add(massLeftGroup, massRightGroup);

  const tL = buildVectorArrow(mats.amberForce, 0.018, 0.05, 0.14);
  const tR = buildVectorArrow(mats.amberForce, 0.018, 0.05, 0.14);
  setVectorArrowLength(tL.shaft, tL.head, 0.7, 0.14);
  setVectorArrowLength(tR.shaft, tR.head, 0.7, 0.14);
  root.add(tL.group, tR.group);

  tagSelectable(wheelGroup, 'pulley');
  tagSelectable(massLeftGroup, 'mass_left');
  tagSelectable(massRightGroup, 'mass_right');

  return {
    root,
    wheelGroup,
    massLeftGroup,
    massRightGroup,
    cableLeft,
    cableRight,
    tensionArrowLeft: tL.group,
    tensionArrowRight: tR.group,
    interactables: [wheelGroup, massLeftGroup, massRightGroup],
  };
}

export function buildCollisionRig(mats: LabMaterialLibrary): CollisionRigHandles {
  const root = new THREE.Group();

  // Air track rail
  const track = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 0.56), mats.anodizedBase);
  track.position.y = 0.22;
  track.receiveShadow = true;
  track.castShadow = true;
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 0.32), mats.brushedSteel);
  railTop.position.y = 0.34;
  const footL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.14, 16), mats.machinedBrass);
  footL.position.set(-2.8, 0.07, 0);
  const footR = footL.clone();
  footR.position.set(2.8, 0.07, 0);
  root.add(track, railTop, footL, footR);

  const gliderA = new THREE.Group();
  const bodyA = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.46), mats.cyanAlloy);
  bodyA.position.y = 0.56;
  bodyA.castShadow = true;
  const bumperA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), mats.machinedBrass);
  bumperA.rotation.z = Math.PI / 2;
  bumperA.position.set(0.36, 0.56, 0);
  gliderA.add(bodyA, bumperA);

  const gliderB = new THREE.Group();
  const bodyB = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.46), mats.violetAlloy);
  bodyB.position.y = 0.56;
  bodyB.castShadow = true;
  const bumperB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), mats.machinedBrass);
  bumperB.rotation.z = Math.PI / 2;
  bumperB.position.set(-0.36, 0.56, 0);
  gliderB.add(bodyB, bumperB);

  root.add(gliderA, gliderB);

  const vA = buildVectorArrow(mats.amberForce, 0.02, 0.055, 0.14);
  vA.group.rotation.z = -Math.PI / 2;
  const vB = buildVectorArrow(mats.amberForce, 0.02, 0.055, 0.14);
  vB.group.rotation.z = Math.PI / 2;
  root.add(vA.group, vB.group);

  tagSelectable(gliderA, 'mass_left');
  tagSelectable(gliderB, 'mass_right');

  return {
    root,
    gliderA,
    gliderB,
    velArrowA: vA.group,
    velArrowB: vB.group,
    interactables: [gliderA, gliderB],
  };
}

export function buildOscillationRig(mats: LabMaterialLibrary): OscillationRigHandles {
  const root = new THREE.Group();
  const topY = 3.4;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.72, 0.1, 32), mats.anodizedBase);
  base.position.y = 0.05;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, topY, 20), mats.brushedSteel);
  mast.position.set(0, topY / 2, -0.45);
  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.6), mats.anodizedBase);
  crossArm.position.set(0, topY, -0.2);
  const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16), mats.machinedBrass);
  pivotPin.rotation.x = Math.PI / 2;
  pivotPin.position.set(0, topY, 0.04);
  root.add(base, mast, crossArm, pivotPin);

  const armGroup = new THREE.Group();
  armGroup.position.set(0, topY, 0.06);

  const rodGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 14);
  rodGeo.translate(0, -0.5, 0);
  const rodMesh = new THREE.Mesh(rodGeo, mats.brushedSteel);

  const bobGroup = new THREE.Group();
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), mats.machinedBrass);
  bob.castShadow = true;
  bobGroup.add(bob);

  const fArrow = buildVectorArrow(mats.amberForce, 0.018, 0.05, 0.14);
  armGroup.add(rodMesh, bobGroup, fArrow.group);
  root.add(armGroup);

  tagSelectable(rodMesh, 'rod');
  tagSelectable(bobGroup, 'sphere');

  return {
    root,
    armGroup,
    rodMesh,
    bobGroup,
    forceArrow: fArrow.group,
    interactables: [rodMesh, bobGroup],
  };
}

export function buildBlockSurfaceRig(mats: LabMaterialLibrary): BlockSurfaceRigHandles {
  const root = new THREE.Group();

  // Elevated laboratory bench track (y_top = 0.86) so downward gravity arrow clears the floor grid
  const surfaceGroup = new THREE.Group();
  const deckY = 0.72;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.16, 1.8), mats.anodizedBase);
  slab.position.y = deckY;
  slab.receiveShadow = true;
  slab.castShadow = true;

  const legGeo = new THREE.CylinderGeometry(0.08, 0.1, deckY - 0.08, 16);
  for (const lx of [-3.2, 3.2]) {
    for (const lz of [-0.65, 0.65]) {
      const leg = new THREE.Mesh(legGeo, mats.anodizedBase);
      leg.position.set(lx, (deckY - 0.08) / 2, lz);
      leg.castShadow = true;
      surfaceGroup.add(leg);
    }
  }

  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.04, 1.5), mats.brushedSteel);
  topPlate.position.y = deckY + 0.1;
  topPlate.receiveShadow = true;
  surfaceGroup.add(slab, topPlate);

  // Subtle machined friction grip ridges when rough surface is active
  const treadGroup = new THREE.Group();
  const ridgeGeo = new THREE.BoxGeometry(0.03, 0.015, 1.46);
  for (let x = -3.4; x <= 3.4; x += 0.34) {
    const ridge = new THREE.Mesh(ridgeGeo, mats.machinedBrass);
    ridge.position.set(x, deckY + 0.125, 0);
    treadGroup.add(ridge);
  }
  surfaceGroup.add(treadGroup);
  tagSelectable(surfaceGroup, 'surface');
  root.add(surfaceGroup);

  // Sliding block + brass tow hook
  const blockGroup = new THREE.Group();
  const blockBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.72), mats.cyanAlloy);
  blockBody.position.y = 0.31;
  blockBody.castShadow = true;
  blockBody.receiveShadow = true;

  const towLug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16), mats.machinedBrass);
  towLug.rotation.z = Math.PI / 2;
  towLug.position.set(0.51, 0.34, 0);

  blockGroup.add(blockBody, towLug);
  tagSelectable(blockGroup, 'block');
  root.add(blockGroup);

  // 4 Physical Forces: Pull F (amber), Gravity mg (violet), Normal N (cyan), Friction f (emerald)
  const pullArrow = buildVectorArrow(mats.amberForce, 0.024, 0.066, 0.18);
  tagSelectable(pullArrow.group, 'force');
  const gravityArrow = buildVectorArrow(mats.violetTorque, 0.02, 0.056, 0.16);
  const normalArrow = buildVectorArrow(mats.cyanVector, 0.02, 0.056, 0.16);
  const frictionArrow = buildVectorArrow(mats.emeraldArc, 0.02, 0.056, 0.16);

  const arcMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.78 });
  const angleArc = new THREE.Line(new THREE.BufferGeometry(), arcMat);

  root.add(pullArrow.group, gravityArrow.group, normalArrow.group, frictionArrow.group, angleArc);

  return {
    root,
    surfaceGroup,
    treadGroup,
    blockGroup,
    blockBody,
    pullArrow,
    gravityArrow,
    normalArrow,
    frictionArrow,
    angleArc,
    interactables: [blockGroup, surfaceGroup, pullArrow.group],
  };
}

const DEFAULT_VECTOR_VISIBILITY: VectorVisibilityFlags = {
  appliedForce: true,
  leverArm: true,
  perpendicularDistance: true,
  torqueVector: true,
  rotationDirection: true,
};

export function updateRotationalRig(
  rig: RotationalRigHandles,
  params: LabSceneParams['rotational'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number,
  vectorVisibility: VectorVisibilityFlags = DEFAULT_VECTOR_VISIBILITY
) {
  const safeRodLen = Number.isFinite(params.rodLength) && params.rodLength > 0 ? params.rodLength : 2.0;
  const L_vis = mapRodLengthToScene(safeRodLen);
  const scaleRatio = L_vis / safeRodLen;

  const pivotPhys = params.allowExternalApplication
    ? params.pivotOffset
    : Math.min(safeRodLen * 0.5, Math.max(0, params.pivotOffset));
  const pivotX_vis = Math.max(-L_vis, Math.min(L_vis, pivotPhys * scaleRatio));

  const spherePhys = Math.min(safeRodLen, Math.max(0, params.spherePosition));
  const sphereX_vis = Math.min(L_vis - 0.05, Math.max(0.06, spherePhys * scaleRatio));

  // Position rod body relative to pivot at local x=0
  rig.rodBodyGroup.position.x = -pivotX_vis;
  rig.rodMesh.scale.set(L_vis, 1, 1);
  rig.rodEndCapLeft.position.set(0, 0, 0);
  rig.rodEndCapRight.position.set(L_vis, 0, 0);

  // Rotate around Z axis by computed theta
  const thetaRad = Number.isFinite(snapshot.kinematicState.angleRad)
    ? snapshot.kinematicState.angleRad
    : 0;
  rig.rodPivotGroup.rotation.z = thetaRad;

  // Position sliding sphere along rod
  const hasSphere = Number.isFinite(params.sphereMass) && params.sphereMass > 1e-12;
  rig.sphereGroup.visible = hasSphere;
  if (hasSphere) {
    rig.sphereGroup.position.set(sphereX_vis - pivotX_vis, 0, 0);
    const sScale = 0.72 + Math.min(0.65, Math.log10(1 + params.sphereMass) * 0.45);
    rig.sphereMesh.scale.setScalar(sScale);
  }

  // Effective lever arm distance r from pivot
  const rPhys = getEffectiveForceDistance(params);
  const rawRVis = rPhys * scaleRatio;
  const r_vis = Math.max(-5.0, Math.min(5.0, Number.isFinite(rawRVis) ? rawRVis : L_vis));

  const angleRad = (params.forceAngle * Math.PI) / 180;
  const forceSign = params.forceMagnitude >= 0 ? 1 : -1;
  const hasForceMag = Number.isFinite(params.forceMagnitude) && Math.abs(params.forceMagnitude) > 1e-15;

  // 1. Applied Force Vector at r_vis
  const showApplied = showVectors && vectorVisibility.appliedForce && hasForceMag;
  rig.forceArrowGroup.visible = showApplied;
  rig.forceAngleArc.visible = showApplied && Math.abs(params.forceAngle) > 0.5;

  if (showApplied) {
    rig.forceArrowGroup.position.set(r_vis, 0, 0.02);
    const dirAngle = forceSign >= 0 ? angleRad : angleRad + Math.PI;
    rig.forceArrowGroup.rotation.z = dirAngle - Math.PI / 2;

    const arrowLen = mapForceToSceneArrowLength(params.forceMagnitude, vectorScale);
    setVectorArrowLength(rig.forceShaft, rig.forceHead, arrowLen, 0.18);

    const pts: THREE.Vector3[] = [];
    const arcR = 0.3;
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * angleRad;
      pts.push(new THREE.Vector3(r_vis + Math.cos(a) * arcR, Math.sin(a) * arcR, 0.03));
    }
    rig.forceAngleArc.geometry.dispose();
    rig.forceAngleArc.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  // 2. Lever Arm Vector r from pivot (0,0) to (r_vis, 0)
  const absRVis = Math.abs(r_vis);
  const showLever = showVectors && vectorVisibility.leverArm && absRVis >= 0.05;
  rig.leverArmGroup.visible = showLever;
  if (showLever) {
    rig.leverArmGroup.position.set(0, 0, 0.088);
    rig.leverArmGroup.rotation.z = r_vis >= 0 ? -Math.PI / 2 : Math.PI / 2;
    const headH = Math.min(0.15, absRVis * 0.35);
    const shaftLen = Math.max(0.01, absRVis - headH);
    rig.leverShaft.scale.set(1, shaftLen, 1);
    rig.leverHead.scale.set(1, headH / 0.15, 1);
    rig.leverHead.position.set(0, shaftLen, 0);
  }

  // 3. Perpendicular Distance r_perp = r * sin(theta_F) & Line of Action
  const sinF = Math.sin(angleRad);
  const cosF = Math.cos(angleRad);
  const perpMagVis = Math.abs(r_vis * sinF);
  const showPerp =
    showVectors && vectorVisibility.perpendicularDistance && hasForceMag && perpMagVis >= 0.04;
  rig.perpGroup.visible = showPerp;

  if (showPerp) {
    // Closest point P_perp from origin (0,0) onto force line through (r_vis, 0) in direction u=(cosF, sinF)
    const px = r_vis * sinF * sinF;
    const py = -r_vis * sinF * cosF;
    const zPlane = 0.092;

    rig.perpLine.geometry.dispose();
    rig.perpLine.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, zPlane),
      new THREE.Vector3(px, py, zPlane),
    ]);
    rig.perpLine.computeLineDistances();

    // Extend line of action slightly past P_perp for clarity
    const ux = r_vis - px;
    const uy = -py;
    const uLen = Math.hypot(ux, uy) || 1;
    const extX = px - (ux / uLen) * 0.28;
    const extY = py - (uy / uLen) * 0.28;

    rig.forceActionLine.geometry.dispose();
    rig.forceActionLine.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(r_vis, 0, zPlane),
      new THREE.Vector3(extX, extY, zPlane),
    ]);
    rig.forceActionLine.computeLineDistances();

    // Right-angle corner marker at P_perp
    const markerSize = Math.min(0.11, perpMagVis * 0.35, uLen * 0.35);
    const nPerpX = -px / (Math.hypot(px, py) || 1);
    const nPerpY = -py / (Math.hypot(px, py) || 1);
    const nLineX = ux / uLen;
    const nLineY = uy / uLen;

    const p1 = new THREE.Vector3(px + nPerpX * markerSize, py + nPerpY * markerSize, zPlane);
    const p2 = new THREE.Vector3(
      px + (nPerpX + nLineX) * markerSize,
      py + (nPerpY + nLineY) * markerSize,
      zPlane
    );
    const p3 = new THREE.Vector3(px + nLineX * markerSize, py + nLineY * markerSize, zPlane);

    rig.rightAngleMarker.geometry.dispose();
    rig.rightAngleMarker.geometry = new THREE.BufferGeometry().setFromPoints([p1, p2, p3]);
  }

  // 4. Net Torque Vector along Z-axis (Right-Hand Rule)
  const netTorque = snapshot.rotationalDetails?.netTorque ?? snapshot.torque;
  const torqueLen = mapTorqueToSceneArrowLength(netTorque, vectorScale);
  const showTorque = showVectors && vectorVisibility.torqueVector && torqueLen > 0.05;
  rig.torqueArrowGroup.visible = showTorque;
  if (showTorque) {
    // Arrow default is +Y; rotate +PI/2 around X for +Z (CCW torque), -PI/2 for -Z (CW torque)
    rig.torqueArrowGroup.rotation.x = netTorque >= 0 ? Math.PI / 2 : -Math.PI / 2;
    setVectorArrowLength(rig.torqueShaft, rig.torqueHead, torqueLen, 0.18);
  }

  // 5. Instantaneous Rotation Direction Indicator (ω or α)
  const omega = snapshot.angularVelocity;
  const alpha = snapshot.angularAcceleration;
  const dirMetric = Math.abs(omega) > 1e-4 ? omega : Math.abs(alpha) > 1e-9 ? alpha : 0;
  const showRotArc = showVectors && vectorVisibility.rotationDirection && Math.abs(dirMetric) > 0;
  rig.rotationArcGroup.visible = showRotArc;

  if (showRotArc) {
    const dir = dirMetric >= 0 ? 1 : -1;
    const arcRadius = 0.44;
    const startAngle = thetaRad + dir * 0.25;
    const sweep = dir * 1.15;
    const endAngle = startAngle + sweep;
    const arcPts: THREE.Vector3[] = [];
    const segs = 22;
    for (let i = 0; i <= segs; i++) {
      const a = startAngle + (i / segs) * sweep;
      arcPts.push(new THREE.Vector3(Math.cos(a) * arcRadius, Math.sin(a) * arcRadius, 0));
    }
    rig.rotationArcLine.geometry.dispose();
    rig.rotationArcLine.geometry = new THREE.BufferGeometry().setFromPoints(arcPts);

    rig.rotationArcHead.position.set(
      Math.cos(endAngle) * arcRadius,
      Math.sin(endAngle) * arcRadius,
      0
    );
    // Tangent along CCW is (-sin, cos), CW is (sin, -cos); Cone points +Y by default
    const tangentAngle = endAngle + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    rig.rotationArcHead.rotation.z = tangentAngle - Math.PI / 2;
  }

  // 6. Optional Secondary Forces on Rod (for multi-force questions)
  const extraForces = params.extraForces ?? [];
  for (let i = 0; i < rig.extraForceArrows.length; i++) {
    const slot = rig.extraForceArrows[i];
    const ef = extraForces[i];
    if (!ef || !showVectors || !vectorVisibility.appliedForce || Math.abs(ef.magnitude) <= 1e-15) {
      slot.group.visible = false;
      continue;
    }
    const rEfPhys = params.allowExternalApplication
      ? ef.distance
      : Math.min(Math.max(0, safeRodLen - pivotPhys), Math.max(0, ef.distance));
    const rEfVis = Math.max(-5.0, Math.min(5.0, rEfPhys * scaleRatio));
    const efAngleRad = (ef.angle * Math.PI) / 180;
    const efDir = ef.magnitude >= 0 ? efAngleRad : efAngleRad + Math.PI;

    slot.group.visible = true;
    slot.group.position.set(rEfVis, 0, 0.02);
    slot.group.rotation.z = efDir - Math.PI / 2;
    setVectorArrowLength(slot.shaft, slot.head, mapForceToSceneArrowLength(ef.magnitude, vectorScale), 0.16);
  }
}

export function updateRollingRig(
  rig: RollingRigHandles,
  params: LabSceneParams['rolling'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number
) {
  const theta = (params.inclineAngle * Math.PI) / 180;
  const L_phys = Math.max(1e-6, params.rampLength);
  const R_phys = Math.max(1e-6, params.cylinderRadius);
  const L = Math.max(3.6, Math.min(6.0, 3.2 + Math.log10(1 + L_phys) * 2.2));
  const R = Math.max(0.28, Math.min(0.68, 0.24 + Math.log10(1 + R_phys * 5) * 0.35));
  const scaleRatio = L / L_phys;

  rig.rampPlank.scale.set(L, 1, 1);
  const rampHeight = Math.sin(theta) * L;
  const centerX = 0;
  const centerY = rampHeight * 0.5 + 0.08;

  rig.rampPlank.position.set(centerX, centerY, 0);
  rig.rampPlank.rotation.z = -theta;

  const leftX = -Math.cos(theta) * (L * 0.4);
  const undersideY = centerY - leftX * Math.tan(theta) - 0.045 / Math.cos(theta);
  const leftH = Math.max(0.08, undersideY);
  rig.rampWedge.scale.set(1, leftH, 1);
  rig.rampWedge.position.set(leftX, leftH / 2, 0);

  // Cylinder rolls down from top-left to bottom-right along ramp
  const s = snapshot.kinematicState.secondaryOffset * scaleRatio;
  const startS = -L * 0.5 + R * 1.1;
  const posAlong = Math.min(L * 0.5 - R * 1.1, startS + s);

  const cx = Math.cos(theta) * posAlong + Math.sin(theta) * (R + 0.04);
  const cy = centerY - Math.sin(theta) * posAlong + Math.cos(theta) * (R + 0.04);

  rig.cylinderGroup.position.set(cx, cy, 0);
  rig.cylinderGroup.scale.set(R, R, 1);
  rig.cylinderGroup.rotation.z = -snapshot.kinematicState.angleRad;

  rig.normalArrow.visible = showVectors;
  rig.frictionArrow.visible = showVectors;
  if (showVectors) {
    rig.normalArrow.position.set(cx, cy, 0);
    rig.normalArrow.rotation.z = -theta;
    rig.normalArrow.scale.setScalar(0.8 * vectorScale);

    rig.frictionArrow.position.set(cx - Math.sin(theta) * R, cy - Math.cos(theta) * R, 0);
    rig.frictionArrow.rotation.z = Math.PI / 2 - theta;
    rig.frictionArrow.scale.setScalar(0.65 * vectorScale);
  }
}

export function updatePulleyRig(
  rig: PulleyRigHandles,
  params: LabSceneParams['pulley'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number
) {
  const R_phys = Math.max(1e-6, params.pulleyRadius);
  const R = Math.max(0.32, Math.min(0.75, 0.24 + Math.log10(1 + R_phys * 4) * 0.35));
  const pulleyY = 3.05;
  rig.wheelGroup.scale.set(R, R, 1);
  rig.wheelGroup.rotation.z = -snapshot.kinematicState.angleRad;

  const disp = snapshot.kinematicState.linearProgress; // positive => right goes down, left goes up
  const baseDrop = 1.65;
  const leftY = pulleyY - (baseDrop - disp);
  const rightY = pulleyY - (baseDrop + disp);

  rig.massLeftGroup.position.set(-R, leftY, 0.08);
  rig.massLeftGroup.scale.setScalar(0.72 + Math.min(0.38, Math.log10(1 + Math.max(0, params.massLeft)) * 0.3));

  rig.massRightGroup.position.set(R, rightY, 0.08);
  rig.massRightGroup.scale.setScalar(0.72 + Math.min(0.38, Math.log10(1 + Math.max(0, params.massRight)) * 0.3));

  const lenL = Math.max(0.2, pulleyY - leftY);
  rig.cableLeft.scale.set(1, lenL, 1);
  rig.cableLeft.position.set(-R, leftY + lenL / 2, 0.08);

  const lenR = Math.max(0.2, pulleyY - rightY);
  rig.cableRight.scale.set(1, lenR, 1);
  rig.cableRight.position.set(R, rightY + lenR / 2, 0.08);

  rig.tensionArrowLeft.visible = showVectors;
  rig.tensionArrowRight.visible = showVectors;
  if (showVectors) {
    rig.tensionArrowLeft.position.set(-R, leftY + 0.25, 0.16);
    rig.tensionArrowLeft.scale.setScalar(0.85 * vectorScale);
    rig.tensionArrowRight.position.set(R, rightY + 0.25, 0.16);
    rig.tensionArrowRight.scale.setScalar(0.85 * vectorScale);
  }
}

export function updateCollisionRig(
  rig: CollisionRigHandles,
  params: LabSceneParams['collisions'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number
) {
  const x1 = snapshot.kinematicState.linearProgress;
  const x2 = snapshot.kinematicState.secondaryOffset;

  rig.gliderA.position.x = x1;
  rig.gliderA.scale.setScalar(0.78 + Math.min(0.45, Math.log10(1 + Math.max(0, params.massA)) * 0.35));

  rig.gliderB.position.x = x2;
  rig.gliderB.scale.setScalar(0.78 + Math.min(0.45, Math.log10(1 + Math.max(0, params.massB)) * 0.35));

  rig.velArrowA.visible = showVectors;
  rig.velArrowB.visible = showVectors;
  if (showVectors) {
    rig.velArrowA.position.set(x1, 0.92, 0);
    rig.velArrowA.scale.setScalar(0.75 * vectorScale);
    rig.velArrowB.position.set(x2, 0.92, 0);
    rig.velArrowB.scale.setScalar(0.75 * vectorScale);
  }
}

export function updateOscillationRig(
  rig: OscillationRigHandles,
  params: LabSceneParams['oscillations'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number
) {
  const L = Math.max(0.6, Math.min(3.4, params.pendulumLength));
  rig.armGroup.rotation.z = snapshot.kinematicState.angleRad;
  rig.rodMesh.scale.set(1, L, 1);
  rig.bobGroup.position.set(0, -L, 0);
  rig.bobGroup.scale.setScalar(0.75 + Math.min(0.45, Math.log10(1 + Math.max(0, params.bobMass)) * 0.35));

  rig.forceArrow.visible = showVectors;
  if (showVectors) {
    rig.forceArrow.position.set(0, -L, 0.08);
    const dir = snapshot.torque >= 0 ? -Math.PI / 2 : Math.PI / 2;
    rig.forceArrow.rotation.z = dir;
    rig.forceArrow.scale.setScalar(Math.min(1.4, 0.4 + Math.log10(1 + Math.abs(snapshot.torque)) * 0.35) * vectorScale);
  }
}

export function updateBlockSurfaceRig(
  rig: BlockSurfaceRigHandles,
  params: LabSceneParams['block_surface'],
  snapshot: PhysicsSnapshot,
  showVectors: boolean,
  vectorScale: number
) {
  const details = snapshot.blockSurfaceDetails;
  const blockX = snapshot.kinematicState.linearProgress;
  const mScale = 0.85 + Math.min(0.42, Math.log10(1 + Math.max(0, params.mass)) * 0.25);
  const blockTopY = 0.84;

  rig.treadGroup.visible = params.frictionEnabled;
  rig.blockGroup.position.set(blockX, blockTopY + (details?.isLiftedOff ? 0.35 : 0), 0);
  rig.blockGroup.scale.setScalar(mScale);

  const blockCenterY = blockTopY + (details?.isLiftedOff ? 0.35 : 0) + 0.31 * mScale;
  const towX = blockX + 0.51 * mScale;
  const towY = blockTopY + (details?.isLiftedOff ? 0.35 : 0) + 0.34 * mScale;

  const hasApplied = showVectors && Math.abs(params.appliedForce) > 1e-12;
  rig.pullArrow.group.visible = hasApplied;
  rig.angleArc.visible = hasApplied && Math.abs(params.forceAngle) > 0.5;

  if (hasApplied) {
    const angleRad = (params.forceAngle * Math.PI) / 180;
    const dir = params.appliedForce >= 0 ? angleRad : angleRad + Math.PI;
    rig.pullArrow.group.position.set(towX, towY, 0.05);
    rig.pullArrow.group.rotation.z = dir - Math.PI / 2;
    setVectorArrowLength(
      rig.pullArrow.shaft,
      rig.pullArrow.head,
      mapForceToSceneArrowLength(params.appliedForce, vectorScale),
      0.18
    );

    const pts: THREE.Vector3[] = [];
    const arcR = 0.34;
    const segs = 16;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * angleRad;
      pts.push(new THREE.Vector3(towX + Math.cos(a) * arcR, towY + Math.sin(a) * arcR, 0.05));
    }
    rig.angleArc.geometry.dispose();
    rig.angleArc.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }

  const weight = details?.weight ?? params.mass * params.gravity;
  const showWeight = showVectors && weight > 1e-12;
  rig.gravityArrow.group.visible = showWeight;
  if (showWeight) {
    rig.gravityArrow.group.position.set(blockX, blockCenterY, 0.38);
    rig.gravityArrow.group.rotation.z = Math.PI; // -Y downward
    setVectorArrowLength(
      rig.gravityArrow.shaft,
      rig.gravityArrow.head,
      mapForceToSceneArrowLength(weight, vectorScale) * 0.85,
      0.16
    );
  }

  const normal = details?.normalForce ?? weight;
  const showNormal = showVectors && normal > 1e-12;
  rig.normalArrow.group.visible = showNormal;
  if (showNormal) {
    rig.normalArrow.group.position.set(blockX - 0.14, blockTopY, 0.38);
    rig.normalArrow.group.rotation.z = 0; // +Y upward from contact face
    setVectorArrowLength(
      rig.normalArrow.shaft,
      rig.normalArrow.head,
      mapForceToSceneArrowLength(normal, vectorScale) * 0.85,
      0.16
    );
  }

  const friction = details?.frictionForce ?? 0;
  const showFriction = showVectors && Math.abs(friction) > 1e-12;
  rig.frictionArrow.group.visible = showFriction;
  if (showFriction) {
    rig.frictionArrow.group.position.set(blockX, blockTopY + 0.04, 0.39);
    // friction > 0 points +X (-PI/2), friction < 0 points -X (+PI/2)
    rig.frictionArrow.group.rotation.z = friction >= 0 ? -Math.PI / 2 : Math.PI / 2;
    setVectorArrowLength(
      rig.frictionArrow.shaft,
      rig.frictionArrow.head,
      mapForceToSceneArrowLength(Math.abs(friction), vectorScale) * 0.8,
      0.16
    );
  }
}
