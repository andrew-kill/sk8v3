// Casco Rufián modelado en Three.js: cráneo negro brillante con púas (como el ícono de la marca),
// máscara que se ajusta a la cara (malla facial) y lentes de malla blanca que se encienden en azul.
// Unidades: centímetros, en el espacio de la malla facial de MindAR/MediaPipe
// (+Y arriba, +Z hacia la cámara, el puente de la nariz está cerca de (0, 3, 5.3)).
import * as THREE from 'three';

export const GLOW_COLOR = new THREE.Color(0x2f7bff);

// ------------------------------------------------------------------ materiales
export function createShellMaterial() {
  // negro mate tipo goma/plástico satinado (sin brillo de "bomba")
  return new THREE.MeshStandardMaterial({
    color: 0x161616,
    roughness: 0.68,
    metalness: 0.0,
    envMapIntensity: 0.55,
  });
}

// ------------------------------------------------------------------ cráneo
const DOME = { cx: 0, cy: 3.4, cz: -3.6, rx: 9.6, ry: 10.6, rzFront: 8.5, rzBack: 11.0 };

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
  return 3.5 + (-7.5 - 3.5) * Math.pow(c, 0.9);
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
// Cuerno con perfil cóncavo (base ancha que se funde con el cráneo, punta fina) y curva hacia atrás.
function buildSpikeGeometry(length, radius, bend, flat = 0.9) {
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // base acampanada + cuerpo que se afina con curva cóncava
    const r = radius * 1.12 * (Math.pow(1 - t, 1.25) + 0.2 * Math.pow(1 - t, 6));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), t * length));
  }
  const g = new THREE.LatheGeometry(pts, 28);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / length;
    p.setX(i, p.getX(i) * flat);
    p.setZ(i, p.getZ(i) - bend * length * t * t);
  }
  g.computeVertexNormals();
  return g;
}

// theta (desde la cima), az (0 = frente), largo, radio base, curvatura, inclinación hacia atrás
// Corona simétrica: una púa central alta, dos laterales altas, dos en las sienes y un abanico en la nuca.
const SPIKES = [
  { th: 0.22, az: 0.0, len: 13.0, r: 3.9, bend: 0.22, tilt: 0.12 },
  { th: 0.62, az: 0.62, len: 10.0, r: 3.4, bend: 0.22, tilt: 0.18 },
  { th: 0.62, az: -0.62, len: 10.0, r: 3.4, bend: 0.22, tilt: 0.18 },
  { th: 1.05, az: 1.25, len: 7.5, r: 2.9, bend: 0.25, tilt: 0.35 },
  { th: 1.05, az: -1.25, len: 7.5, r: 2.9, bend: 0.25, tilt: 0.35 },
  { th: 0.70, az: Math.PI, len: 11.0, r: 3.6, bend: 0.12, tilt: 0.40 },
  { th: 0.95, az: 2.25, len: 9.0, r: 3.2, bend: 0.15, tilt: 0.45 },
  { th: 0.95, az: -2.25, len: 9.0, r: 3.2, bend: 0.15, tilt: 0.45 },
  { th: 1.35, az: Math.PI, len: 8.0, r: 3.0, bend: 0.10, tilt: 0.45 },
];

function placeSpike(mesh, s) {
  const base = domePoint(s.th, s.az, new THREE.Vector3(), -1.6);
  const n = domePoint(s.th, s.az, new THREE.Vector3(), 1).sub(domePoint(s.th, s.az, new THREE.Vector3(), 0)).normalize();
  const back = new THREE.Vector3(0, 0, -1);
  const dir = n.clone().lerp(back, s.tilt).normalize();
  let zAxis = new THREE.Vector3(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  if (zAxis.lengthSq() < 1e-4) zAxis.set(0, 1, 0);
  zAxis.normalize();
  const xAxis = new THREE.Vector3().crossVectors(dir, zAxis).normalize();
  zAxis = new THREE.Vector3().crossVectors(xAxis, dir).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, dir, zAxis));
  mesh.position.copy(base);
}

// ------------------------------------------------------------------ lentes
// Las lentes son otra copia de la malla facial: el shader solo deja la forma de "ojo enojado"
// (definida en coordenadas UV de la cara), así se ajustan a cualquier rostro y quedan separadas.
export function createLensMaterial(lensMap) {
  if (lensMap) {
    lensMap.wrapS = lensMap.wrapT = THREE.RepeatWrapping;
    lensMap.repeat.set(16, 16);
    lensMap.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf2f2f2, map: lensMap, roughness: 0.6, metalness: 0,
    emissive: GLOW_COLOR.clone(), emissiveIntensity: 0, emissiveMap: lensMap,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLensUv;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += normalize(objectNormal) * 0.75;
        // aplanar la cuenca del ojo: la lente no se hunde, queda como una pieza rígida
        // la lente es una pieza rígida curva (como un visor), no sigue cejas ni párpados
        float ax = max(0.0, abs(transformed.x) - 1.4);
        float zPlane = 5.55 - 0.09 * ax * ax;
        transformed.z = max(zPlane, transformed.z + 0.15);
        vLensUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLensUv;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 lp = vLensUv;
        if (lp.x > 0.5) lp.x = 1.0 - lp.x;
        vec2 lq = (lp - vec2(0.300, 0.664)) / vec2(0.152, 0.102);
        float le = dot(lq, lq);
        vec2 la = vec2(0.452, 0.622), lb = vec2(0.160, 0.746);
        vec2 ld = normalize(lb - la);
        float lside = dot(lp - la, vec2(-ld.y, ld.x)); // > 0 debajo de la línea superior
        if (le > 1.0 || lside < 0.0 || lp.x > 0.436) discard;
        float lrim = step(0.86, le) + step(lside, 0.008) + step(0.428, lp.x);`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (lrim > 0.0) diffuseColor.rgb = vec3(0.03);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (lrim > 0.0) totalEmissiveRadiance *= 0.15;');
  };
  mat.customProgramCacheKey = () => 'rufian-lens';
  return mat;
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
export function createHelmet({ lensMaterial = null } = {}) {
  const group = new THREE.Group();
  group.name = 'CascoRufian';
  const shell = createShellMaterial();

  const dome = new THREE.Mesh(buildDomeGeometry(), shell);
  dome.name = 'Craneo';
  group.add(dome);

  const spikes = new THREE.Group(); spikes.name = 'Puas';
  SPIKES.forEach((s, i) => {
    const m = new THREE.Mesh(buildSpikeGeometry(s.len, s.r, s.bend), shell);
    m.name = `Pua${i + 1}`;
    placeSpike(m, s);
    spikes.add(m);
  });
  group.add(spikes);

  // posiciones de los ojos (se actualizan cada cuadro con los puntos reales de la cara)
  const eyes = [new THREE.Vector3(-3.3, 2.8, 5.6), new THREE.Vector3(3.3, 2.8, 5.6)];
  const lensMats = [lensMaterial];

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

  function setEyes(l, r) {
    [l, r].forEach((e, i) => {
      eyes[i].copy(e);
      glows[i].position.copy(e);
      streaks[i].position.copy(e).add(new THREE.Vector3(0, 0, 0.4));
      lights[i].position.copy(e).add(new THREE.Vector3(0, 0.5, 1.5));
    });
  }

  function setPower(power, time = 0) {
    const flicker = power > 0.02 ? 0.92 + 0.08 * Math.sin(time * 37) * Math.sin(time * 11.3) : 1;
    const p = power * flicker;
    lensMats.forEach((m) => {
      if (!m) return;
      m.emissiveIntensity = p * 3.2;
      m.color.setRGB(0.95 - p * 0.55, 0.95 - p * 0.35, 0.95);
    });
    glows.forEach((g) => { g.material.opacity = Math.min(1, p * 1.1); g.scale.setScalar(5 + p * 6); });
    streaks.forEach((s) => { s.material.opacity = Math.max(0, p - 0.35) * 1.4; s.scale.set(10 + p * 14, 1.6 + p, 1); });
    lights.forEach((l) => { l.intensity = p * 220; });
  }
  setPower(0);

  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return { group, setPower, setEyes, eyes, shellMaterial: shell, lensMats };
}

// ------------------------------------------------------------------ máscara facial
// Material para la malla facial: la infla unos milímetros y recorta boca y mentón por UV.
export function createFaceMaskMaterial(shell = createShellMaterial()) {
  const mat = shell.clone();
  mat.side = THREE.FrontSide;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uInflate = { value: 0.35 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uInflate;\nvarying vec2 vMaskUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(objectNormal) * uInflate;\nvMaskUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMaskUv;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float du = abs(vMaskUv.x - 0.5);
        float vcut = 0.452 - 0.2 * du - 3.1 * pow(max(0.0, du - 0.2), 2.0);
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
  m.scale.set(6.2, 7.0, 7.4);
  m.position.set(0, -0.8, -4.2);
  m.renderOrder = -1;
  m.name = 'OclusorCabeza';
  return m;
}

// Centro de cada ojo a partir de los puntos de la malla facial (índices de MediaPipe).
const EYE_IDS = [[33, 133, 159, 145], [263, 362, 386, 374]];
export function eyeCentersFrom(getPoint, out = [new THREE.Vector3(), new THREE.Vector3()]) {
  EYE_IDS.forEach((ids, k) => {
    out[k].set(0, 0, 0);
    ids.forEach((i) => { const p = getPoint(i); out[k].x += p[0] / 4; out[k].y += p[1] / 4; out[k].z += p[2] / 4; });
    out[k].z = Math.max(out[k].z + 1.3, 5.55 - 0.09 * Math.max(0, Math.abs(out[k].x) - 1.4) ** 2 + 0.4);
  });
  return out;
}

// ------------------------------------------------------------------ casco editado en el editor de Three.js
// Si existe editor/casco-rufian.json (proyecto o escena exportada desde threejs.org/editor),
// se usan su cráneo y sus púas en lugar del modelo generado por código.
// La careta y las lentes siguen saliendo de la malla facial (se deforman con cada cara).
export async function applyEditedHelmet(helmet, url = 'editor/casco-rufian.json') {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return false;
    const json = await res.json();
    const loader = new THREE.ObjectLoader();
    const root = await loader.parseAsync(json.scene || json.object ? (json.scene || json) : json);
    const casco = root.getObjectByName('CascoRufian') || root;
    casco.updateMatrixWorld(true);
    const pieces = [];
    casco.children.forEach((c) => {
      if (c.name === 'Brillo' || c.isLight || c.isCamera) return;
      pieces.push(c);
    });
    if (!pieces.length) return false;
    // quitar el cráneo y las púas generados por código
    ['Craneo', 'Reborde', 'Puas'].forEach((n) => { const o = helmet.group.getObjectByName(n); if (o) o.removeFromParent(); });
    const wrap = new THREE.Group();
    wrap.name = 'CascoEditado';
    if (casco !== root) wrap.matrix.copy(casco.matrix); // respeta si moviste/escalaste el grupo completo
    wrap.matrixAutoUpdate = false;
    pieces.forEach((p) => wrap.add(p));
    // material: el del editor (si cambiaste color/rugosidad) se usa también en la careta
    let edited = null;
    wrap.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; edited ||= o.material; } });
    if (edited && helmet.shellMaterial) {
      ['color', 'emissive'].forEach((k) => edited[k] && helmet.shellMaterial[k]?.copy(edited[k]));
      ['roughness', 'metalness', 'envMapIntensity'].forEach((k) => { if (typeof edited[k] === 'number') helmet.shellMaterial[k] = edited[k]; });
      wrap.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) o.material.envMapIntensity = helmet.shellMaterial.envMapIntensity; });
    }
    helmet.group.add(wrap);
    console.info('Rufián: casco cargado desde', url);
    return true;
  } catch (e) {
    console.warn('No se pudo cargar el casco del editor; se usa el modelo por código.', e);
    return false;
  }
}

// ------------------------------------------------------------------ unión careta ↔ casco
// Franja que se recalcula cada cuadro: va desde el borde superior de la malla facial
// (sien → frente → sien) hasta la superficie del cráneo, para que careta y casco sean una sola pieza.
const OVAL_TOP = [172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397];
export function createFaceBridge(material) {
  const n = OVAL_TOP.length;
  const rows = 4; // filas intermedias para que la curva sea suave
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * (rows + 1) * 3), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let r = 0; r < rows; r++) {
      const a = r * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'UnionCaretaCasco';
  mesh.frustumCulled = false;
  const mat = material.clone(); mat.side = THREE.DoubleSide; mesh.material = mat;
  const p = new THREE.Vector3(), nrm = new THREE.Vector3(), out = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Vector3();
  const center = new THREE.Vector3(DOME.cx, DOME.cy, DOME.cz);
  function update(posAttr, normAttr, inflate = 0.3) {
    const pos = geo.attributes.position;
    for (let i = 0; i < n; i++) {
      const k = OVAL_TOP[i];
      p.fromBufferAttribute(posAttr, k);
      if (normAttr) { nrm.fromBufferAttribute(normAttr, k); p.addScaledVector(nrm, inflate); }
      // punto del cráneo en la misma dirección desde su centro (elipsoide), un poco hacia adentro
      dir.copy(p).sub(center);
      const rz = dir.z >= 0 ? DOME.rzFront : DOME.rzBack;
      const s = 1 / Math.sqrt((dir.x / DOME.rx) ** 2 + (dir.y / DOME.ry) ** 2 + (dir.z / rz) ** 2);
      out.copy(center).addScaledVector(dir, s * 0.985);
      // si el cráneo queda por fuera de la cara (sienes), lo empujamos un poco hacia atrás
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        q.copy(p).lerp(out, t);
        // abombado suave para que no sea una pared recta
        q.addScaledVector(nrm, Math.sin(t * Math.PI) * 0.15);
        pos.setXYZ(r * n + i, q.x, q.y, q.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // primera fila con las mismas normales de la careta: sin línea de luz en la unión
    if (normAttr) {
      const nb = geo.attributes.normal, tmp = new THREE.Vector3(), own = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        tmp.fromBufferAttribute(normAttr, OVAL_TOP[i]);
        for (let r = 0; r <= 1; r++) {
          own.fromBufferAttribute(nb, r * n + i).lerp(tmp, r === 0 ? 1 : 0.5).normalize();
          nb.setXYZ(r * n + i, own.x, own.y, own.z);
        }
      }
      nb.needsUpdate = true;
    }
  }
  return { mesh, update };
}
