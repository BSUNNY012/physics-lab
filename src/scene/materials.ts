import * as THREE from 'three';

export interface LabMaterialLibrary {
  anodizedBase: THREE.MeshStandardMaterial;
  brushedSteel: THREE.MeshPhysicalMaterial;
  machinedBrass: THREE.MeshStandardMaterial;
  cyanAlloy: THREE.MeshPhysicalMaterial;
  violetAlloy: THREE.MeshPhysicalMaterial;
  amberForce: THREE.MeshStandardMaterial;
  cyanVector: THREE.MeshStandardMaterial;
  violetTorque: THREE.MeshStandardMaterial;
  emeraldArc: THREE.MeshStandardMaterial;
  cableDark: THREE.MeshStandardMaterial;
  benchSurface: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function createBrushedRodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#a8b8cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fine brushed metal horizontal grain
    for (let y = 0; y < canvas.height; y += 2) {
      const alpha = 0.04 + ((y * 17) % 10) * 0.008;
      ctx.fillStyle = y % 4 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
      ctx.fillRect(0, y, canvas.width, 1);
    }

    // Precision ruler ticks along the rod
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 2;
    const steps = 20;
    for (let i = 1; i < steps; i++) {
      const x = (i / steps) * canvas.width;
      const tickH = i % 5 === 0 ? 32 : 16;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tickH);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createOpticalBenchBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#555555';
    for (let x = 16; x < 256; x += 32) {
      for (let y = 16; y < 256; y += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLabMaterials(maxAnisotropy: number): LabMaterialLibrary {
  const rodTex = createBrushedRodTexture();
  rodTex.anisotropy = maxAnisotropy;

  const benchBumpTex = createOpticalBenchBumpTexture();
  benchBumpTex.anisotropy = maxAnisotropy;

  const shadowTex = createContactShadowTexture();

  const anodizedBase = new THREE.MeshStandardMaterial({
    color: 0x1a2232,
    roughness: 0.58,
    metalness: 0.78,
  });

  const brushedSteel = new THREE.MeshPhysicalMaterial({
    color: 0xd9e4f2,
    map: rodTex,
    roughness: 0.24,
    metalness: 0.88,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  });

  const machinedBrass = new THREE.MeshStandardMaterial({
    color: 0xd4a34f,
    roughness: 0.28,
    metalness: 0.9,
  });

  const cyanAlloy = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    roughness: 0.22,
    metalness: 0.72,
    clearcoat: 0.45,
    clearcoatRoughness: 0.15,
  });

  const violetAlloy = new THREE.MeshPhysicalMaterial({
    color: 0x8b5cf6,
    roughness: 0.25,
    metalness: 0.68,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });

  const amberForce = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.2,
  });

  const cyanVector = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.2,
  });

  const violetTorque = new THREE.MeshStandardMaterial({
    color: 0xa78bfa,
    emissive: 0x7c3aed,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.25,
  });

  const emeraldArc = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x059669,
    emissiveIntensity: 0.38,
    roughness: 0.3,
    metalness: 0.2,
  });

  const cableDark = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.65,
    metalness: 0.45,
  });

  const benchSurface = new THREE.MeshStandardMaterial({
    color: 0x0f1521,
    roughness: 0.78,
    metalness: 0.25,
    bumpMap: benchBumpTex,
    bumpScale: 0.008,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  const allMaterials = [
    anodizedBase,
    brushedSteel,
    machinedBrass,
    cyanAlloy,
    violetAlloy,
    amberForce,
    cyanVector,
    violetTorque,
    emeraldArc,
    cableDark,
    benchSurface,
    contactShadow,
  ];
  const allTextures = [rodTex, benchBumpTex, shadowTex];

  return {
    anodizedBase,
    brushedSteel,
    machinedBrass,
    cyanAlloy,
    violetAlloy,
    amberForce,
    cyanVector,
    violetTorque,
    emeraldArc,
    cableDark,
    benchSurface,
    contactShadow,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}

export function createAxisLabelSprite(text: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 96, 96);
    ctx.font = '600 44px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colorHex;
    ctx.fillText(text, 48, 48);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.36, 0.36, 1);
  return sprite;
}
