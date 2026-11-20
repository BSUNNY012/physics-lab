import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { calculatePhysicsSnapshot, clamp } from '../physics/calculations';
import type {
  CameraPresetView,
  CameraProjection,
  LabEnvironmentSettings,
  LabSceneParams,
  PhysicsPresetId,
  SceneToolMode,
  SelectablePartId,
} from '../types/simulation';
import type { RotationalSimulationState } from '../physics/engine/types';
import { getEffectiveForceDistance } from '../physics/engine/rotationalDynamics';
import { mapRodLengthToScene } from './visualScale';
import {
  buildBlockSurfaceRig,
  buildCollisionRig,
  buildLabStage,
  buildOscillationRig,
  buildPulleyRig,
  buildRollingRig,
  buildRotationalRig,
  updateBlockSurfaceRig,
  updateCollisionRig,
  updateOscillationRig,
  updatePulleyRig,
  updateRollingRig,
  updateRotationalRig,
} from './buildLaboratoryObjects';
import { createLabMaterials } from './materials';

export interface LabEngineCallbacks {
  onSelectPart: (part: SelectablePartId) => void;
  onDragSpherePosition: (pos: number) => void;
  onDragForceAngle: (angleDeg: number) => void;
  onCameraOrientation: (quaternionArray: [number, number, number, number]) => void;
  onContextStatus?: (status: 'ok' | 'lost') => void;
}

export interface LabEngineState {
  preset: PhysicsPresetId;
  params: LabSceneParams;
  environment: LabEnvironmentSettings;
  simTime: number;
  rotationalSimState?: RotationalSimulationState;
  toolMode: SceneToolMode;
  projection: CameraProjection;
  selectedPart: SelectablePartId;
}

const DEFAULT_TARGET = new THREE.Vector3(0.8, 1.4, 0);
const DEFAULT_CAM_POS = new THREE.Vector3(3.6, 2.75, 4.9);

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class ThreeLabEngine {
  private container: HTMLElement;
  private callbacks: LabEngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private perspCamera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls: OrbitControls;
  private envTexture: THREE.Texture;

  private materials: ReturnType<typeof createLabMaterials>;
  private stage: ReturnType<typeof buildLabStage>;
  private rotationalRig: ReturnType<typeof buildRotationalRig>;
  private rollingRig: ReturnType<typeof buildRollingRig>;
  private pulleyRig: ReturnType<typeof buildPulleyRig>;
  private collisionRig: ReturnType<typeof buildCollisionRig>;
  private oscillationRig: ReturnType<typeof buildOscillationRig>;
  private blockSurfaceRig: ReturnType<typeof buildBlockSurfaceRig>;

  private state: LabEngineState;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private scratchVec = new THREE.Vector3();
  private scratchTarget = new THREE.Vector3();

  private activeDragMode: 'none' | 'sphere' | 'force' = 'none';
  private cameraTransition: {
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  } = {
    active: false,
    targetPos: DEFAULT_CAM_POS.clone(),
    targetLook: DEFAULT_TARGET.clone(),
  };

  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private disposed = false;
  private lastClockTime = performance.now();

  constructor(
    container: HTMLElement,
    initialState: LabEngineState,
    callbacks: LabEngineCallbacks
  ) {
    this.container = container;
    this.state = initialState;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const aspect = width / height;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'physics-webgl-canvas');

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    container.appendChild(this.renderer.domElement);

    // Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b11);
    this.scene.fog = new THREE.FogExp2(0x080b11, 0.032);

    // Procedural Studio IBL
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // Cameras
    this.perspCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 120);
    this.perspCamera.position.copy(DEFAULT_CAM_POS);

    const frustum = 5.4;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      120
    );
    this.orthoCamera.position.copy(DEFAULT_CAM_POS);
    this.activeCamera =
      initialState.projection === 'orthographic' ? this.orthoCamera : this.perspCamera;

    // OrbitControls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 18.0;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener('start', this.handleControlsStart);
    this.controls.addEventListener('change', this.handleControlsChange);
    this.controls.update();

    // 3-Point Laboratory Lighting
    const hemi = new THREE.HemisphereLight(0x60a5fa, 0x0b1220, 0.95);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.25);
    keyLight.position.set(5.5, 8.5, 5.0);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    const d = 6;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-6, 4.5, -5);
    this.scene.add(rimLight);

    // Materials & Laboratory Objects
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.materials = createLabMaterials(maxAniso);
    this.stage = buildLabStage(this.materials);
    this.scene.add(this.stage.stageGroup);

    this.rotationalRig = buildRotationalRig(this.materials);
    this.rollingRig = buildRollingRig(this.materials);
    this.pulleyRig = buildPulleyRig(this.materials);
    this.collisionRig = buildCollisionRig(this.materials);
    this.oscillationRig = buildOscillationRig(this.materials);
    this.blockSurfaceRig = buildBlockSurfaceRig(this.materials);

    this.scene.add(
      this.rotationalRig.root,
      this.rollingRig.root,
      this.pulleyRig.root,
      this.collisionRig.root,
      this.oscillationRig.root,
      this.blockSurfaceRig.root
    );

    // Pointer Interaction Listeners
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    // ResizeObserver
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.applyStateToScene();
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.activeCamera);
    }
    this.emitOrientation();
    this.requestRender();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextStatus?.('lost');
  };

  private handleContextRestored = () => {
    this.callbacks.onContextStatus?.('ok');
    this.requestRender();
  };

  private handleControlsStart = () => {
    this.cameraTransition.active = false;
  };

  private handleControlsChange = () => {
    this.emitOrientation();
    this.requestRender();
  };

  private emitOrientation() {
    const q = this.activeCamera.quaternion;
    this.callbacks.onCameraOrientation([q.x, q.y, q.z, q.w]);
  }

  public updateState(next: LabEngineState) {
    const projectionChanged = next.projection !== this.state.projection;
    this.state = next;

    if (projectionChanged) {
      this.switchProjection(next.projection);
    }

    this.applyStateToScene();
    this.requestRender();
  }

  private switchProjection(projection: CameraProjection) {
    const prevCam = this.activeCamera;
    const nextCam = projection === 'orthographic' ? this.orthoCamera : this.perspCamera;

    nextCam.position.copy(prevCam.position);
    nextCam.quaternion.copy(prevCam.quaternion);

    if (nextCam instanceof THREE.OrthographicCamera) {
      const dist = prevCam.position.distanceTo(this.controls.target);
      const frustum = Math.max(2.5, dist * 0.82);
      const aspect = Math.max(
        0.5,
        this.container.clientWidth / Math.max(1, this.container.clientHeight)
      );
      nextCam.left = (-frustum * aspect) / 2;
      nextCam.right = (frustum * aspect) / 2;
      nextCam.top = frustum / 2;
      nextCam.bottom = -frustum / 2;
      nextCam.zoom = 1;
    }

    nextCam.updateProjectionMatrix();
    this.activeCamera = nextCam;
    this.controls.object = nextCam;
    this.controls.update();
    this.emitOrientation();
  }

  public setCameraPreset(view: CameraPresetView) {
    const visualRodLen = mapRodLengthToScene(this.state.params.rotational.rodLength);
    let target = new THREE.Vector3(0, 1.3, 0);
    if (this.state.preset === 'rotational') {
      target = new THREE.Vector3(visualRodLen * 0.42, 1.45, 0);
    } else if (this.state.preset === 'pulley') {
      target = new THREE.Vector3(0, 1.85, 0);
    } else if (this.state.preset === 'block_surface') {
      target = new THREE.Vector3(0, 1.15, 0);
    } else if (this.state.preset === 'rolling') {
      target = new THREE.Vector3(0, 1.2, 0);
    }

    const pos = new THREE.Vector3();
    switch (view) {
      case 'isometric':
        pos.copy(target).add(new THREE.Vector3(2.9, 1.45, 4.9));
        break;
      case 'front':
        pos.copy(target).add(new THREE.Vector3(0, 0.15, 5.8));
        break;
      case 'top':
        pos.copy(target).add(new THREE.Vector3(0, 6.2, 0.01));
        break;
      case 'side':
        pos.copy(target).add(new THREE.Vector3(5.8, 0.25, 0));
        break;
    }

    this.cameraTransition.targetLook.copy(target);
    this.cameraTransition.targetPos.copy(pos);
    this.cameraTransition.active = true;
    this.requestRender();
  }

  public snapToAxis(axis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z') {
    const target = this.controls.target.clone();
    const dist = Math.max(3.5, this.activeCamera.position.distanceTo(target));
    const dir = new THREE.Vector3(
      axis === 'x' ? 1 : axis === '-x' ? -1 : 0,
      axis === 'y' ? 1 : axis === '-y' ? -1 : 0,
      axis === 'z' ? 1 : axis === '-z' ? -1 : 0
    );
    if (axis === 'y' || axis === '-y') dir.z = 0.01;
    this.cameraTransition.targetLook.copy(target);
    this.cameraTransition.targetPos.copy(target).addScaledVector(dir, dist);
    this.cameraTransition.active = true;
    this.requestRender();
  }

  private applyStateToScene() {
    const { preset, params, environment, simTime, rotationalSimState } = this.state;

    // Grid & Axes visibility
    const showGrid = environment.showGrid;
    this.stage.gridMajor.visible = showGrid && environment.gridDensity === 'standard';
    this.stage.gridMinor.visible = showGrid && environment.gridDensity === 'fine';
    this.stage.axesGroup.visible = environment.showAxes;

    // Active rig visibility
    this.rotationalRig.root.visible = preset === 'rotational';
    this.rollingRig.root.visible = preset === 'rolling';
    this.pulleyRig.root.visible = preset === 'pulley';
    this.collisionRig.root.visible = preset === 'collisions';
    this.oscillationRig.root.visible = preset === 'oscillations';
    this.blockSurfaceRig.root.visible = preset === 'block_surface';

    const snapshot = calculatePhysicsSnapshot(
      preset,
      params,
      simTime,
      environment.loopDuration,
      rotationalSimState
    );

    switch (preset) {
      case 'rotational':
        updateRotationalRig(
          this.rotationalRig,
          params.rotational,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale,
          environment.vectorVisibility
        );
        break;
      case 'rolling':
        updateRollingRig(
          this.rollingRig,
          params.rolling,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale
        );
        break;
      case 'pulley':
        updatePulleyRig(
          this.pulleyRig,
          params.pulley,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale
        );
        break;
      case 'collisions':
        updateCollisionRig(
          this.collisionRig,
          params.collisions,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale
        );
        break;
      case 'oscillations':
        updateOscillationRig(
          this.oscillationRig,
          params.oscillations,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale
        );
        break;
      case 'block_surface':
        updateBlockSurfaceRig(
          this.blockSurfaceRig,
          params.block_surface,
          snapshot,
          environment.showForceVectors,
          environment.vectorScale
        );
        break;
    }
  }

  private updatePointerNdc(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getActiveInteractables(): THREE.Object3D[] {
    switch (this.state.preset) {
      case 'rotational':
        return this.rotationalRig.interactables;
      case 'rolling':
        return this.rollingRig.interactables;
      case 'pulley':
        return this.pulleyRig.interactables;
      case 'collisions':
        return this.collisionRig.interactables;
      case 'oscillations':
        return this.oscillationRig.interactables;
      case 'block_surface':
        return this.blockSurfaceRig.interactables;
    }
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.updatePointerNdc(e);
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);
    const hits = this.raycaster.intersectObjects(this.getActiveInteractables(), true);
    if (hits.length === 0) return;

    const partId = (hits[0].object.userData.partId as SelectablePartId | undefined) ?? 'system';
    this.callbacks.onSelectPart(partId);

    if (this.state.preset !== 'rotational') return;

    if (this.state.toolMode === 'move' && partId === 'sphere') {
      this.activeDragMode = 'sphere';
      this.controls.enabled = false;
    } else if (this.state.toolMode === 'rotate' && (partId === 'force' || partId === 'rod')) {
      this.activeDragMode = 'force';
      this.controls.enabled = false;
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.activeDragMode === 'none') return;
    this.updatePointerNdc(e);
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);

    // Intersect XY plane at pivot z=0.07
    this.dragPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1.65, 0.07)
    );
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchVec)) return;

    // Convert world point to rodPivotGroup local coordinates
    this.rotationalRig.rodPivotGroup.worldToLocal(this.scratchVec);
    const rotParams = this.state.params.rotational;
    const safeRodLen = Math.max(1e-9, rotParams.rodLength);
    const L_vis = mapRodLengthToScene(safeRodLen);
    const scaleRatio = L_vis / safeRodLen;

    if (this.activeDragMode === 'sphere') {
      const physX = this.scratchVec.x / scaleRatio + rotParams.pivotOffset;
      const nextPos = clamp(physX, safeRodLen * 0.05, safeRodLen * 0.96);
      this.callbacks.onDragSpherePosition(Number(nextPos.toPrecision(4)));
    } else if (this.activeDragMode === 'force') {
      const r_vis = getEffectiveForceDistance(rotParams) * scaleRatio;
      const dx = this.scratchVec.x - r_vis;
      const dy = this.scratchVec.y;
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < -180) deg += 360;
      const clampedDeg = clamp(Math.round(deg), -180, 180);
      this.callbacks.onDragForceAngle(clampedDeg);
    }
  };

  private handlePointerUp = () => {
    if (this.activeDragMode !== 'none') {
      this.activeDragMode = 'none';
      this.controls.enabled = true;
    }
  };

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    const frustum =
      this.orthoCamera.top - this.orthoCamera.bottom || 5.4;
    this.orthoCamera.left = (-frustum * aspect) / 2;
    this.orthoCamera.right = (frustum * aspect) / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.requestRender();
  }

  private afterDraw(cb: () => void, fastYield = false) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const delay = fastYield ? 8 : 80;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, delay);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, this.renderDirty ? 8 : delay);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private requestRender() {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;

      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastClockTime) / 1000);
      this.lastClockTime = now;

      let needsFollowUp = false;
      if (this.cameraTransition.active) {
        const lambda = 9;
        this.activeCamera.position.x = THREE.MathUtils.damp(
          this.activeCamera.position.x,
          this.cameraTransition.targetPos.x,
          lambda,
          dt
        );
        this.activeCamera.position.y = THREE.MathUtils.damp(
          this.activeCamera.position.y,
          this.cameraTransition.targetPos.y,
          lambda,
          dt
        );
        this.activeCamera.position.z = THREE.MathUtils.damp(
          this.activeCamera.position.z,
          this.cameraTransition.targetPos.z,
          lambda,
          dt
        );

        this.controls.target.x = THREE.MathUtils.damp(
          this.controls.target.x,
          this.cameraTransition.targetLook.x,
          lambda,
          dt
        );
        this.controls.target.y = THREE.MathUtils.damp(
          this.controls.target.y,
          this.cameraTransition.targetLook.y,
          lambda,
          dt
        );
        this.controls.target.z = THREE.MathUtils.damp(
          this.controls.target.z,
          this.cameraTransition.targetLook.z,
          lambda,
          dt
        );

        const posDist = this.activeCamera.position.distanceTo(this.cameraTransition.targetPos);
        const lookDist = this.controls.target.distanceTo(this.cameraTransition.targetLook);
        if (posDist < 0.015 && lookDist < 0.015) {
          this.activeCamera.position.copy(this.cameraTransition.targetPos);
          this.controls.target.copy(this.cameraTransition.targetLook);
          this.cameraTransition.active = false;
        } else {
          needsFollowUp = true;
        }
        this.emitOrientation();
      }

      if (this.controls.update()) {
        this.emitOrientation();
      }

      this.renderer.render(this.scene, this.activeCamera);

      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty || needsFollowUp) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) {
        this.afterDraw(done, !needsFollowUp);
      } else {
        done();
      }
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.removeEventListener('start', this.handleControlsStart);
    this.controls.removeEventListener('change', this.handleControlsChange);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      } else if (obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });

    this.materials.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
