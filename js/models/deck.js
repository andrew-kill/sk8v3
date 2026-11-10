// Tabla de skate Rufián modelada en Three.js (formato clásico "popsicle").
// Unidades: largo de la tabla = 1. Eje Y = largo (nariz en +Y), eje X = ancho,
// +Z = cara de la lija. La gráfica va en la cara inferior (-Z).
import * as THREE from 'three';

const L = 1.0;          // largo
const WIDTH = 0.255;    // ancho
const T = 0.016;        // grosor
const R = WIDTH / 2;    // radio de nariz y cola
const KICK_START = L / 2 - 0.17;
const KICK_RISE = 0.07;
const CONCAVE = 0.009;

function halfWidth(s) {
  const d = Math.abs(s) - (L / 2 - R);
  if (d <= 0) return WIDTH / 2;
  return (WIDTH / 2) * Math.sqrt(Math.max(0, 1 - (d / R) ** 2));
}
function kick(s) {
  const t = Math.max(0, (Math.abs(s) - KICK_START) / (L / 2 - KICK_START));
  return KICK_RISE * t ** 1.8;
}
// posición de un punto de la superficie media; v en [-1,1] a lo ancho
function surface(s, v) {
  return new THREE.Vector3(v * halfWidth(s), s, kick(s) + CONCAVE * v * v);
}

function buildDeckGeometries(nu = 120, nv = 18) {
  const top = { pos: [], uv: [], idx: [] };
  const bot = { pos: [], uv: [], idx: [] };
  const ss = [];
  for (let i = 0; i <= nu; i++) {
    const w = (i / nu) * 2 - 1;
    ss.push((L / 2) * Math.sin((Math.PI / 2) * w)); // más resolución en los extremos
  }
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      const p = surface(ss[i], v);
      const vt = (ss[i] + L / 2) / L;
      top.pos.push(p.x, p.y, p.z + T / 2); top.uv.push((v + 1) / 2, vt);
      bot.pos.push(p.x, p.y, p.z - T / 2); bot.uv.push(1 - (v + 1) / 2, vt);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      top.idx.push(a, b, d, a, d, c);
      bot.idx.push(a, d, b, a, c, d);
    }
  }
  // canto (madera): contorno = borde v=+1 subiendo y v=-1 bajando
  const outline = [];
  for (let i = 0; i <= nu; i++) outline.push(surface(ss[i], 1));
  for (let i = nu; i >= 0; i--) outline.push(surface(ss[i], -1));
  const edge = { pos: [], uv: [], idx: [] };
  outline.forEach((p, k) => {
    edge.pos.push(p.x, p.y, p.z + T / 2, p.x, p.y, p.z - T / 2);
    edge.uv.push(k / outline.length, 1, k / outline.length, 0);
  });
  for (let k = 0; k < outline.length - 1; k++) {
    const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
    edge.idx.push(a, b, d, a, d, c);
  }
  const make = (g) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    return geo;
  };
  return { top: make(top), bottom: make(bot), edge: make(edge) };
}

function plyTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64;
  const x = c.getContext('2d');
  const tones = ['#e7d3ad', '#0d0d0d', '#e7d3ad', '#f2f2f2', '#e7d3ad', '#0d0d0d', '#e7d3ad'];
  tones.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, (i * 64) / tones.length, 8, 64 / tones.length + 1); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTruck(metal, dark) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.008), metal);
  base.position.z = -0.004; g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.026, 0.05, 20), metal);
  body.rotation.x = Math.PI / 2; body.position.z = -0.03; g.add(body);
  const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 16), dark);
  bush.rotation.x = Math.PI / 2; bush.position.set(0, 0.012, -0.022); g.add(bush);
  const hanger = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.15, 6, 16), metal);
  hanger.rotation.z = Math.PI / 2; hanger.position.z = -0.055; g.add(hanger);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.27, 10), metal);
  axle.rotation.z = Math.PI / 2; axle.position.z = -0.055; g.add(axle);
  return g;
}

function buildWheel(white, dark) {
  // perfil redondeado (LatheGeometry gira alrededor de Y)
  const pts = [];
  const r = 0.031, w = 0.034;
  pts.push(new THREE.Vector2(0.011, -w / 2));
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    pts.push(new THREE.Vector2(r - 0.006 + Math.cos(a) * 0.006, (w / 2 - 0.006) * Math.sin(a) + Math.sin(a) * 0.006));
  }
  pts.push(new THREE.Vector2(0.011, w / 2));
  const wheel = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), white);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, w * 0.92, 20), dark);
  const g = new THREE.Group(); g.add(wheel, hub);
  g.rotation.z = Math.PI / 2;
  return g;
}

/**
 * Crea la tabla completa. `graphics` es una lista de texturas para la cara inferior.
 * Devuelve { group, setGraphic(i), materials }.
 */
export function createDeck({ graphics = [], grip = null } = {}) {
  const geos = buildDeckGeometries();
  const gripMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grip, roughness: 0.96, metalness: 0 });
  const printMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: graphics[0] || null, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: plyTexture(), roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dbde, metalness: 1, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.55 });

  const group = new THREE.Group();
  group.name = 'TablaRufian';
  const board = new THREE.Group(); board.name = 'Tabla';
  const top = new THREE.Mesh(geos.top, gripMat); top.name = 'Lija';
  const bottom = new THREE.Mesh(geos.bottom, printMat); bottom.name = 'Grafica';
  const edge = new THREE.Mesh(geos.edge, edgeMat); edge.name = 'Canto';
  board.add(top, bottom, edge);
  group.add(board);

  for (const sy of [-1, 1]) {
    const y = sy * 0.215;
    const truck = buildTruck(metal, dark);
    truck.position.set(0, y, -T / 2);
    group.add(truck);
    for (const sx of [-1, 1]) {
      const wheel = buildWheel(white, dark);
      wheel.position.set(sx * 0.118, y, -T / 2 - 0.055);
      group.add(wheel);
    }
  }
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  let current = 0;
  return {
    group,
    materials: { gripMat, printMat },
    get index() { return current; },
    setGraphic(i) {
      if (!graphics.length) return;
      current = ((i % graphics.length) + graphics.length) % graphics.length;
      printMat.map = graphics[current];
      printMat.needsUpdate = true;
    },
  };
}

export function loadDeckTextures(loader, renderer, base = '') {
  const files = ['deck-01-calavera.jpg', 'deck-02-checker.jpg', 'deck-03-mono.jpg'];
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  const prep = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso); return t; };
  return Promise.all([
    ...files.map((f) => loader.loadAsync(`${base}assets/textures/${f}`).then(prep)),
    loader.loadAsync(`${base}assets/textures/grip.jpg`).then(prep),
  ]).then((all) => ({ graphics: all.slice(0, 3), grip: all[3] }));
}
