// Casco Rufián modelado en Three.js: cráneo negro brillante con púas (como el ícono de la marca),
// máscara que se ajusta a la cara (malla facial) y lentes de malla blanca que se encienden en azul.
// Unidades: centímetros, en el espacio de la malla facial de MindAR/MediaPipe
// (+Y arriba, +Z hacia la cámara, el puente de la nariz está cerca de (0, 3, 5.3)).
import * as THREE from 'three';

export const GLOW_COLOR = new THREE.Color(0x2f7bff);

// ------------------------------------------------------------------ materiales
export function createShellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.1,
  });
}

// ------------------------------------------------------------------ cráneo
const DOME = { cx: 0, cy: 3.6, cz: -3.6, rx: 9.7, ry: 10.4, rzFront: 9.8, rzBack: 11.0 };

function domePoint(theta, az, out = new THREE.Vector3(), inflate = 0) {
  const rz = Math.cos(az) >= 0 ? DOME.rzFront : DOME.rzBack;
  out.set(
    DOME.cx + (DOME.rx + inflate) * Math.sin(theta) * Math.sin(az),
    DOME.cy + (DOME.ry + inflate) * Math.cos(theta),
    DOME.cz + (rz + inflate) * Math.sin(theta) * Math.cos(az)
  );
  return out;
}

// altura del borde inferior según el ángulo (0 = frente, PI = nuca)
function cutHeight(az) {
  const c = (1 - Math.cos(az)) / 2;
  return 6.4 + (-7.5 - 6.4) * Math.pow(c, 0.78);
}
function thetaMax(az) {
  const v = (cutHeight(az) - DOME.cy) / DOME.ry;
  return Math.min(Math.acos(Math.max(-1, Math.min(1, v))), Math.PI * 0.8);
}

function buildDomeGeometry(na = 96, nt = 40) {
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= na; i++) {
    const az = -Math.PI + (i / na) * Math.PI * 2;
    const tm = thetaMax(az);
    for (let j = 0; j <= nt; j++) {
      const th = 0.0001 + (j / nt) * tm;
      domePoint(th, az, p);
      pos.push(p.x, p.y, p.z);
      uv.push(i / na, 1 - j / nt);
    }
  }
  const row = nt + 1;
  for (let i = 0; i < na; i++) {
    for (let j = 0; j < nt; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// reborde (tubo) siguiendo el borde inferior del cráneo: le da grosor al casco
function buildRimGeometry() {
  const pts = [];
  const n = 100, a0 = 1.05; // sin reborde en la frente (ahí la máscara continúa el casco)
  for (let i = 0; i <= n; i++) {
    const az = a0 + (i / n) * (Math.PI * 2 - 2 * a0);
    pts.push(domePoint(thetaMax(az), az, new THREE.Vector3(), -0.25));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false);
  const g = new THREE.TubeGeometry(curve, 200, 0.45, 10, false);
  return g;
}

// ------------------------------------------------------------------ púas
// Cono curvado: base en el cráneo, se inclina hacia atrás como en el ícono.
function buildSpikeGeometry(length, radius, bend, flat = 0.8) {
  const g = new THREE.ConeGeometry(radius, length, 24, 16, true);
  g.translate(0, length / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / length;
    p.setX(i, p.getX(i) * flat);
    p.setZ(i, p.getZ(i) - bend * length * t * t); // curva hacia -Z local (atrás)
  }
  g.computeVertexNormals();
  return g;
}

// theta (desde la cima), az (0 = frente), largo, radio base, curvatura, inclinación extra hacia atrás
const SPIKES = [
  { th: 0.20, az: 0.0, len: 12.5, r: 3.3, bend: 0.32, tilt: 0.30 },
  { th: 0.58, az: 0.85, len: 10.5, r: 3.0, bend: 0.30, tilt: 0.30 },
  { th: 0.58, az: -0.85, len: 10.5, r: 3.0, bend: 0.30, tilt: 0.30 },
  { th: 0.98, az: 1.6, len: 8.5, r: 2.6, bend: 0.28, tilt: 0.55 },
  { th: 0.98, az: -1.6, len: 8.5, r: 2.6, bend: 0.28, tilt: 0.55 },
  { th: 0.80, az: Math.PI, len: 10.5, r: 3.1, bend: 0.20, tilt: 0.35 },
  { th: 1.15, az: 2.45, len: 8.0, r: 2.6, bend: 0.22, tilt: 0.45 },
  { th: 1.15, az: -2.45, len: 8.0, r: 2.6, bend: 0.22, tilt: 0.45 },
  { th: 1.55, az: Math.PI, len: 7.0, r: 2.4, bend: 0.15, tilt: 0.40 },
];

function placeSpike(mesh, s) {
  const base = domePoint(s.th, s.az, new THREE.Vector3(), -1.2);
  // normal aproximada de la superficie
  const n = domePoint(s.th, s.az, new THREE.Vector3(), 1).sub(domePoint(s.th, s.az, new THREE.Vector3(), 0)).normalize();
  const back = new THREE.Vector3(0, 0, -1);
  const dir = n.clone().lerp(back, s.tilt).normalize();
  // ejes locales: Y = dirección de la púa, Z local = "hacia adelante" (la curva va hacia -Z local = atrás)
  let zAxis = new THREE.Vector3(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  if (zAxis.lengthSq() < 1e-4) zAxis.set(0, 1, 0);
  zAxis.normalize();
  const xAxis = new THREE.Vector3().crossVectors(dir, zAxis).normalize();
  zAxis = new THREE.Vector3().crossVectors(xAxis, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, dir, zAxis);
  mesh.quaternion.setFromRotationMatrix(m);
  mesh.position.copy(base);
}

// ------------------------------------------------------------------ lentes
// Forma "ojo enojado" del ícono: borde superior recto que baja hacia la nariz, base redondeada.
function eyeShape(side) {
  // side = -1 (ojo izquierdo en pantalla), +1 (derecho). Coordenadas en cm.
  const s = new THREE.Shape();
  const inner = { x: side * 0.85, y: 3.15 };
  const outer = { x: side * 6.0, y: 5.05 };
  s.moveTo(inner.x, inner.y);
  s.lineTo(outer.x, outer.y);
  // curva inferior: de afuera hacia adentro pasando por abajo
  const cx = side * 3.5, bottom = 0.95;
  s.bezierCurveTo(side * 6.7, 3.0, side * 5.3, bottom, cx, bottom);
  s.bezierCurveTo(side * 1.8, bottom, side * 0.5, 2.0, inner.x, inner.y);
  return s;
}

// profundidad aproximada de la cara en la zona de los ojos (cm)
function eyeDepth(x, y) {
  const ax = Math.abs(x);
  return 4.95 - 0.075 * Math.pow(Math.max(0, ax - 0.9), 2) - 0.04 * Math.max(0, 3 - y) ** 2;
}

function wrapToFace(geo, lift) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, p.getZ(i) + eyeDepth(x, y) + lift);
  }
  geo.computeVertexNormals();
  return geo;
}

function lensUV(geo, side) {
  // UV planos para la textura de malla
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) * side) / 6;
    uv[i * 2 + 1] = p.getY(i) / 6;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(160,200,255,.9)');
  g.addColorStop(0.45, 'rgba(47,123,255,.35)');
  g.addColorStop(1, 'rgba(47,123,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(47,123,255,0)'); g.addColorStop(0.5, 'rgba(210,230,255,1)'); g.addColorStop(1, 'rgba(47,123,255,0)');
  x.fillStyle = g;
  const v = x.createLinearGradient(0, 0, 0, 64);
  x.fillRect(0, 26, 512, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Crea el casco. `lensMap` = textura de malla para las lentes.
 * Devuelve { group, setPower(0..1, time), eyes: [Vector3, Vector3], shellMaterial }
 */
export function createHelmet({ lensMap = null } = {}) {
  const group = new THREE.Group();
  group.name = 'CascoRufian';
  const shell = createShellMaterial();

  const dome = new THREE.Mesh(buildDomeGeometry(), shell);
  dome.name = 'Craneo';
  const rim = new THREE.Mesh(buildRimGeometry(), shell);
  rim.name = 'Reborde';
  group.add(dome, rim);

  const spikes = new THREE.Group(); spikes.name = 'Puas';
  SPIKES.forEach((s, i) => {
    const m = new THREE.Mesh(buildSpikeGeometry(s.len, s.r, s.bend), shell);
    m.name = `Pua${i + 1}`;
    placeSpike(m, s);
    spikes.add(m);
  });
  group.add(spikes);

  // Lentes + marco
  if (lensMap) { lensMap.wrapS = lensMap.wrapT = THREE.RepeatWrapping; lensMap.colorSpace = THREE.SRGBColorSpace; }
  const eyes = [];
  const lensMats = [];
  const lensGroup = new THREE.Group(); lensGroup.name = 'Lentes';
  for (const side of [-1, 1]) {
    const shape = eyeShape(side);
    const lensGeo = new THREE.ShapeGeometry(shape, 24);
    lensUV(lensGeo, side);
    wrapToFace(lensGeo, 1.15);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xf2f2f2, map: lensMap, roughness: 0.55, metalness: 0,
      emissive: GLOW_COLOR.clone(), emissiveIntensity: 0, emissiveMap: lensMap,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
    });
    lensMats.push(lensMat);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.name = side < 0 ? 'LenteIzq' : 'LenteDer';
    lens.renderOrder = 3;

    // marco: la forma ampliada con un hueco del tamaño de la lente
    const outer = new THREE.Shape(eyeShape(side).getPoints(48).map((p) => {
      const c = new THREE.Vector2(side * 3.5, 2.9);
      return p.clone().sub(c).multiplyScalar(1.09).add(c);
    }));
    outer.holes.push(new THREE.Path(eyeShape(side).getPoints(48)));
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.12, bevelSegments: 3, curveSegments: 24 });
    wrapToFace(frameGeo, 0.8);
    const frame = new THREE.Mesh(frameGeo, shell);
    frame.name = side < 0 ? 'MarcoIzq' : 'MarcoDer';
    frame.renderOrder = 2;
    lensGroup.add(frame, lens);
    eyes.push(new THREE.Vector3(side * 3.4, 2.75, eyeDepth(side * 3.4, 2.75) + 1.6));
  }
  group.add(lensGroup);

  // Brillo (sprites aditivos) + luces azules
  const glowTex = glowTexture();
  const streakTex = streakTexture();
  const fx = new THREE.Group(); fx.name = 'Brillo';
  const glows = [], streaks = [], lights = [];
  eyes.forEach((e) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    sp.position.copy(e); sp.scale.setScalar(7); sp.renderOrder = 10;
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    st.position.copy(e).add(new THREE.Vector3(0, 0, 0.4)); st.scale.set(16, 2, 1); st.renderOrder = 11;
    const light = new THREE.PointLight(GLOW_COLOR, 0, 18, 1.6);
    light.position.copy(e).add(new THREE.Vector3(0, 0.5, 1.5));
    fx.add(sp, st, light);
    glows.push(sp); streaks.push(st); lights.push(light);
  });
  group.add(fx);

  function setPower(power, time = 0) {
    const flicker = power > 0.02 ? 0.92 + 0.08 * Math.sin(time * 37) * Math.sin(time * 11.3) : 1;
    const p = power * flicker;
    lensMats.forEach((m) => {
      m.emissiveIntensity = p * 3.2;
      m.color.setRGB(0.95 - p * 0.55, 0.95 - p * 0.35, 0.95);
    });
    glows.forEach((g) => { g.material.opacity = Math.min(1, p * 1.1); g.scale.setScalar(5 + p * 6); });
    streaks.forEach((s) => { s.material.opacity = Math.max(0, p - 0.35) * 1.4; s.scale.set(10 + p * 14, 1.6 + p, 1); });
    lights.forEach((l) => { l.intensity = p * 220; });
  }
  setPower(0);

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { group, setPower, eyes, shellMaterial: shell, lensMats };
}

// ------------------------------------------------------------------ máscara facial
// Material para la malla facial: la infla unos milímetros y recorta boca y mentón por UV.
export function createFaceMaskMaterial(shell = createShellMaterial()) {
  const mat = shell.clone();
  mat.side = THREE.FrontSide;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInflate = { value: 0.55 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uInflate;\nvarying vec2 vMaskUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(objectNormal) * uInflate;\nvMaskUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMaskUv;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float du = vMaskUv.x - 0.5;
        float vcut = 0.372 - 1.35 * du * du;
        if (vMaskUv.y < vcut) discard;`);
  };
  mat.customProgramCacheKey = () => 'rufian-face-mask';
  return mat;
}

// Oclusor (escribe profundidad pero no color) para que el contenido detrás de la cabeza no se vea.
export function createOccluderMaterial() {
  return new THREE.MeshBasicMaterial({ colorWrite: false });
}
export function createHeadOccluder() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), createOccluderMaterial());
  m.scale.set(7.2, 8.6, 8.2);
  m.position.set(0, 1.6, -3.6);
  m.renderOrder = -1;
  m.name = 'OclusorCabeza';
  return m;
}
