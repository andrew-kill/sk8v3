// Filtro facial Rufián (MindAR Face + Three.js).
// Gesto 1: subir las cejas → los ojos de la máscara se encienden en azul con sonido de carga tipo repulsor.
// Gesto 2: con la máscara encendida, abrir la boca → disparo de energía.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHelmet, createFaceMaskMaterial, createOccluderMaterial, createHeadOccluder, GLOW_COLOR } from './models/helmet.js';
import { SFX } from './sfx.js';
import { $, toast, setProgress } from './ui.js';

const params = new URLSearchParams(location.search);
const SIM = params.get('sim'); // modo de prueba sin gestos reales

let mindar = null, started = false;
let helmet = null, maskFace = null, occFace = null;
const timer = new THREE.Timer();

// ------------------------------------------------------------- estado del gesto
const G = {
  power: 0,            // 0..1 energía de los ojos
  raised: false,       // cejas arriba (con histéresis)
  baseline: 0.12,      // valor de reposo de las cejas (se adapta a cada persona)
  brow: 0, jaw: 0,
  phase: 'off',        // off | charging | on
  jawOpen: false,
  cooldown: 0,
  blastT: 1,           // 0..1 animación del disparo
  t: 0,
  hasFace: false,
};
let chargeSnd = null, humSnd = null;

function readBlendshapes() {
  const e = mindar?.getLatestEstimate?.();
  if (!e || !e.blendshapes) return null;
  const s = {};
  for (const c of e.blendshapes.categories) s[c.categoryName] = c.score;
  return s;
}

function updateGesture(dt) {
  let brow = 0, jaw = 0;
  if (SIM) {
    // ciclo automático para pruebas: 2.5 s cejas abajo, 3 s arriba, boca a los 2 s de encendido
    const c = G.t % 5.5;
    brow = c > 2.5 ? 0.7 : 0.05;
    jaw = c > 4.6 && c < 5.2 ? 0.7 : 0.02;
    if (SIM === 'on') { brow = 0.7; jaw = 0.02; }
  } else {
    const s = readBlendshapes();
    if (s) {
      const outer = ((s.browOuterUpLeft || 0) + (s.browOuterUpRight || 0)) / 2;
      brow = Math.max(s.browInnerUp || 0, outer);
      jaw = s.jawOpen || 0;
    }
  }
  G.brow = brow; G.jaw = jaw;
  // línea base adaptativa: baja rápido, sube muy lento
  if (G.hasFace) {
    const k = brow < G.baseline ? 0.15 : 0.003;
    G.baseline += (brow - G.baseline) * k;
    G.baseline = Math.min(G.baseline, 0.35);
  }
  const lift = brow - G.baseline;
  const wasRaised = G.raised;
  if (!G.raised && lift > 0.2) G.raised = true;
  else if (G.raised && lift < 0.1) G.raised = false;
  if (!G.hasFace) G.raised = false;

  // energía
  if (G.raised) G.power = Math.min(1, G.power + dt / 1.35);
  else G.power = Math.max(0, G.power - dt / 0.55);

  if (G.raised && !wasRaised) onRaise();
  if (!G.raised && wasRaised) onLower();
  if (G.phase === 'charging' && G.power >= 1) onFullyCharged();

  // disparo con la boca
  const open = jaw > 0.42;
  G.cooldown = Math.max(0, G.cooldown - dt);
  if (open && !G.jawOpen && G.phase === 'on' && G.cooldown === 0) blast();
  G.jawOpen = open;
}

function onRaise() {
  G.phase = 'charging';
  chargeSnd?.stop(0.05);
  // si ya quedaba energía, empezamos la carga más adelante para que el sonido coincida
  chargeSnd = SFX.play('charge', { volume: 0.95 });
  if (chargeSnd && G.power > 0.05) {
    chargeSnd.source.stop(); chargeSnd = null;
    const s = SFX.ctx.createBufferSource(); // reproducción desde la mitad
    const buf = SFX.buffers.charge;
    if (buf) {
      const gain = SFX.ctx.createGain(); gain.gain.value = 0.95;
      s.buffer = buf; s.connect(gain); gain.connect(SFX.master);
      s.start(0, G.power * buf.duration * 0.8);
      chargeSnd = { source: s, gain, stop: (f = 0.1) => { const t = SFX.ctx.currentTime; gain.gain.setTargetAtTime(0.0001, t, f / 3); s.stop(t + f + 0.05); } };
    }
  }
  $('g-brows').classList.add('active');
  setStatus('Cargando energía…', true);
  if (navigator.vibrate) navigator.vibrate(20);
}
function onFullyCharged() {
  G.phase = 'on';
  humSnd?.stop(0.05);
  humSnd = SFX.play('hum', { volume: 0.32, loop: true, fadeIn: 0.25 });
  $('g-mouth').classList.remove('locked');
  $('meter').classList.add('on');
  setStatus('Máscara encendida · abre la boca', true);
}
function onLower() {
  const wasOn = G.phase !== 'off';
  G.phase = 'off';
  chargeSnd?.stop(0.12); chargeSnd = null;
  humSnd?.stop(0.25); humSnd = null;
  if (wasOn && G.power > 0.25) SFX.play('off', { volume: 0.7 });
  $('g-brows').classList.remove('active');
  $('g-mouth').classList.add('locked');
  $('meter').classList.remove('on');
  setStatus('Sube las cejas para encender', true);
}

// ------------------------------------------------------------- efectos 3D extra
let particles = null, beams = [];
function buildFX(parent) {
  // partículas que se concentran en los ojos mientras carga
  const N = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 64;
  const x = dot.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(120,170,255,.9)'); gr.addColorStop(1, 'rgba(47,123,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false; particles.renderOrder = 12;
  particles.userData.seeds = Array.from({ length: N }, (_, i) => ({ eye: i % 2, life: Math.random(), dir: new THREE.Vector3().randomDirection(), r: 5 + Math.random() * 6 }));
  parent.add(particles);

  // anillos de onda del disparo
  for (const e of helmet.eyes) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.22, 64), new THREE.MeshBasicMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.copy(e); ring.renderOrder = 13;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.2, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: GLOW_COLOR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.x = Math.PI / 2; beam.renderOrder = 13;
    parent.add(ring, beam);
    beams.push({ ring, beam, origin: e.clone() });
  }
}

function updateFX(dt) {
  if (!particles) return;
  const charging = G.raised && G.power < 1;
  const p = particles.geometry.attributes.position;
  const seeds = particles.userData.seeds;
  particles.material.opacity += ((charging ? 1 : G.phase === 'on' ? 0.35 : 0) - particles.material.opacity) * Math.min(1, dt * 6);
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    s.life -= dt * (charging ? 1.6 : 0.8);
    if (s.life <= 0) { s.life = 1; s.dir.randomDirection(); s.dir.z = Math.abs(s.dir.z); s.r = 5 + Math.random() * 6; }
    const e = helmet.eyes[s.eye];
    const k = s.life * s.life;
    p.setXYZ(i, e.x + s.dir.x * s.r * k, e.y + s.dir.y * s.r * k, e.z + s.dir.z * s.r * k);
  }
  p.needsUpdate = true;

  G.blastT = Math.min(1, G.blastT + dt / 0.7);
  const b = G.blastT;
  for (const it of beams) {
    const visible = b < 1;
    it.ring.material.opacity = visible ? (1 - b) * 0.95 : 0;
    it.ring.scale.setScalar(1 + b * 9);
    it.ring.position.set(it.origin.x, it.origin.y, it.origin.z + b * 30);
    const len = 4 + b * 60;
    it.beam.scale.set(1 + b * 1.5, len, 1 + b * 1.5);
    it.beam.position.set(it.origin.x, it.origin.y, it.origin.z + len / 2);
    it.beam.material.opacity = visible ? Math.max(0, 1 - b * 1.4) * 0.8 : 0;
  }
}

function blast() {
  G.blastT = 0; G.cooldown = 0.9;
  G.power = 0.7; // retroceso: vuelve a cargar
  G.phase = 'charging';
  humSnd?.stop(0.1); humSnd = null;
  SFX.play('blast', { volume: 1 });
  const f = $('flash'); f.style.background = '#cfe0ff'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
  toast('¡Bum! Rufián no pide permiso', 1800);
}

// ------------------------------------------------------------- foto
async function capturePhoto() {
  if (!mindar) return;
  SFX.play('shutter', { volume: 0.9 });
  const f = $('flash'); f.style.background = '#fff'; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  const box = $('face');
  const W = box.clientWidth, H = box.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const v = mindar.video;
  const L = parseFloat(v.style.left) || 0, T = parseFloat(v.style.top) || 0;
  const VW = parseFloat(v.style.width) || W, VH = parseFloat(v.style.height) || H;
  x.save();
  if (v.style.transform.includes('-1')) { x.translate(L + VW, T); x.scale(-1, 1); x.drawImage(v, 0, 0, VW, VH); }
  else x.drawImage(v, L, T, VW, VH);
  x.restore();
  mindar.renderer.render(mindar.scene, mindar.camera);
  x.drawImage(mindar.renderer.domElement, L, T, VW, VH);
  // brillo de pantalla si está encendida
  if (G.power > 0.05) {
    const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(47,123,255,0)'); g.addColorStop(1, `rgba(47,123,255,${0.35 * G.power})`);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  // marca: tablero inferior + logo
  const cell = 12; const sy = H - cell * 2;
  for (let i = 0; i * cell < W; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#000'; x.fillRect(i * cell, sy + j * cell, cell, cell); }
  const logo = await loadImg('assets/brand/logo-blanco.png');
  const lw = Math.min(150, W * 0.38); const lh = lw * logo.height / logo.width;
  x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 8;
  x.drawImage(logo, 16, sy - lh - 14, lw, lh);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
  const url = URL.createObjectURL(blob);
  $('photo-img').src = url;
  $('photo-save').href = url;
  $('photo').hidden = false;
  $('photo-save').onclick = async (ev) => {
    const file = new File([blob], 'rufian-casco.jpg', { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      ev.preventDefault();
      try { await navigator.share({ files: [file], title: 'Rufián Magazine' }); } catch (e) { /* cancelado */ }
    }
  };
}
const imgCache = {};
function loadImg(src) {
  if (imgCache[src]) return imgCache[src];
  imgCache[src] = new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  return imgCache[src];
}
$('photo-close').addEventListener('click', () => { $('photo').hidden = true; SFX.play('click'); });
$('shutter').addEventListener('click', capturePhoto);
$('mute').addEventListener('click', () => {
  const m = !SFX.muted; SFX.setMuted(m);
  $('mute').setAttribute('aria-pressed', String(m)); $('mute').style.opacity = m ? 0.5 : 1;
  toast(m ? 'Sonido apagado' : 'Sonido encendido');
});

function setStatus(text, ok) {
  $('status-text').textContent = text;
  $('status').classList.toggle('ok', !!ok);
}

// ------------------------------------------------------------- bucle
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  G.t += dt;
  const has = !!maskFace?.visible;
  if (has !== G.hasFace) {
    G.hasFace = has;
    if (!has) { onLowerIfNeeded(); setStatus('Busca tu cara', false); }
    else setStatus(G.phase === 'on' ? 'Máscara encendida · abre la boca' : 'Sube las cejas para encender', true);
  }
  if (has) maskFace.geometry.computeVertexNormals();
  updateGesture(dt);
  helmet.setPower(G.power, G.t);
  updateFX(dt);
  $('meter').firstElementChild.style.width = `${Math.round(G.power * 100)}%`;
  $('vignette').style.opacity = String(G.power * 0.55 + (1 - G.blastT) * 0.6);
  mindar.renderer.render(mindar.scene, mindar.camera);
}
function onLowerIfNeeded() { if (G.raised) { G.raised = false; onLower(); } }

// ------------------------------------------------------------- inicio
async function start() {
  if (started) return;
  SFX.unlock();
  SFX.play('click');
  $('start').disabled = true;
  $('error').classList.remove('visible');
  try {
    setProgress(15, 'Cargando motor…');
    const { MindARThree } = await import('mindar-face-three');
    setProgress(35, 'Preparando el casco…');
    mindar = new MindARThree({ container: $('face'), uiLoading: 'no', uiScanning: 'no', uiError: 'no' });
    const { renderer, scene } = mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.4, 1, 1.2); scene.add(key);

    const lensMap = await new THREE.TextureLoader().loadAsync('assets/textures/lente-malla.jpg');
    helmet = createHelmet({ lensMap });

    // 1) oclusor con la forma exacta de la cara
    occFace = mindar.addFaceMesh();
    occFace.material = createOccluderMaterial();
    occFace.renderOrder = -2;
    scene.add(occFace);
    // 2) máscara negra que se ajusta a la cara (+ el casco como hijo, en el mismo espacio)
    maskFace = mindar.addFaceMesh();
    maskFace.material = createFaceMaskMaterial(helmet.shellMaterial);
    maskFace.add(helmet.group);
    maskFace.add(createHeadOccluder());
    scene.add(maskFace);
    buildFX(maskFace);

    setProgress(60, 'Abriendo cámara…');
    await mindar.start();
    renderer.setAnimationLoop(frame);
    started = true;
    setProgress(100, 'Listo');
    $('intro').style.display = 'none';
    $('status').hidden = false; $('filter-ui').hidden = false;
    toast('Mira a la cámara y sube las cejas', 3000);
    window.__face = { mindar, G, helmet, blast };
  } catch (err) {
    console.error(err);
    $('start').disabled = false;
    $('start-label').textContent = 'Reintentar';
    const denied = /permission|notallowed|denied/i.test(String(err?.name) + String(err?.message)) || !err;
    $('error').textContent = denied
      ? 'No pudimos abrir la cámara frontal. Revisa el permiso de cámara del navegador y vuelve a intentarlo.'
      : `No se pudo iniciar el filtro. Revisa la conexión (la primera carga descarga el modelo facial). ${err?.message || ''}`;
    $('error').classList.add('visible');
    try { mindar?.stop(); } catch (e) { /* nada */ }
    mindar = null;
  }
}

$('start').addEventListener('click', start);
window.addEventListener('pagehide', () => { try { mindar?.stop(); } catch (e) { /* nada */ } });
if (params.get('autostart') === '1') start();
