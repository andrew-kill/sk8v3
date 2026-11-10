// Experiencia de realidad aumentada con seguimiento de imagen (MindAR + Three.js).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDeck, loadDeckTextures } from './models/deck.js';
import { SFX } from './sfx.js';
import { $, toast, setProgress, bindDialog, openDialog } from './ui.js';
import { DIALOG_ORDER } from './content.js';

const MARKER_IMG = 'assets/marker/target.jpg';
const MARKER_MIND = 'assets/marker/targets.mind';
const MARKER_ASPECT = 1920 / 1080; // alto / ancho del afiche
const params = new URLSearchParams(location.search);

let mindar = null;
let started = false;
let video = null;
let deck = null;
const clock = new THREE.Timer();
const state = { visible: false, appear: 0, flip: 0, flipping: false, t: 0 };
const clickables = [];
let hotspots = [];
let videoPanel = null;
let content = null;

bindDialog();

// ------------------------------------------------------------- utilidades de canvas
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const DISPLAY = (size, weight = 900, stretch = '62%') => `${weight} ${stretch === '62%' ? 'extra-condensed ' : ''}${size}px Archivo, Impact, sans-serif`;

function checkerRingTexture() {
  return canvasTexture(1024, 64, (x, w, h) => {
    const n = 48;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        x.fillStyle = (i + j) % 2 ? '#fff' : '#000';
        x.fillRect((i * w) / n, (j * h) / 2, w / n + 1, h / 2 + 1);
      }
    }
  });
}

function hotspotTexture(num, label) {
  return canvasTexture(512, 512, (x, w) => {
    x.clearRect(0, 0, w, w);
    // disco
    x.fillStyle = '#fff'; x.beginPath(); x.arc(256, 190, 150, 0, Math.PI * 2); x.fill();
    x.lineWidth = 14; x.strokeStyle = '#000'; x.stroke();
    x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = DISPLAY(170); x.fillText(num, 256, 200);
    // etiqueta
    x.font = DISPLAY(78, 900);
    const tw = x.measureText(label).width + 56;
    x.fillStyle = '#000'; x.fillRect(256 - tw / 2, 372, tw, 104);
    x.fillStyle = '#fff'; x.fillText(label, 256, 428);
  });
}

function videoLabelTexture(text) {
  return canvasTexture(1024, 128, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.textBaseline = 'middle';
    let size = 70; x.font = DISPLAY(size);
    while (x.measureText(text).width > w - 256 - 56 && size > 30) { size -= 2; x.font = DISPLAY(size); }
    x.fillText(text, 28, h / 2 + 4);
    // tablero a la derecha
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? '#fff' : '#000';
      x.fillRect(w - 256 + i * 32, j * 32 + 32, 32, 32);
    }
  });
}

// ------------------------------------------------------------- escena AR
async function buildContent(renderer) {
  const root = new THREE.Group();
  root.name = 'ContenidoAR';

  // Anillo de tablero sobre el papel
  const ringTex = checkerRingTexture();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.40, 0.46, 96, 1),
    new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide })
  );
  // re-mapeo UV del anillo para que el tablero siga la circunferencia
  const pos = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i));
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (a + Math.PI) / (Math.PI * 2), r > 0.43 ? 1 : 0);
  }
  ring.position.z = 0.004;
  root.add(ring);

  // Sombra suave bajo la tabla
  const shadowTex = canvasTexture(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.35), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.position.z = 0.002;
  root.add(shadow);

  // La tabla
  const loader = new THREE.TextureLoader();
  const tex = await loadDeckTextures(loader, renderer);
  deck = createDeck(tex);
  const deckPivot = new THREE.Group();
  deckPivot.name = 'PivoteTabla';
  deckPivot.position.set(0, 0, 0.22);
  deck.group.scale.setScalar(1.08);
  deckPivot.add(deck.group);
  root.add(deckPivot);
  deck.pivot = deckPivot;
  deck.group.userData.action = 'deck';
  clickables.push(deck.group);

  // Panel de video
  video = document.createElement('video');
  video.src = 'assets/video/rufian-clip.mp4';
  video.loop = true; video.muted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
  video.crossOrigin = 'anonymous'; video.preload = 'auto';
  const vTex = new THREE.VideoTexture(video); vTex.colorSpace = THREE.SRGBColorSpace;
  videoPanel = new THREE.Group();
  videoPanel.name = 'PanelVideo';
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.68), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ map: vTex, toneMapped: false }));
  screen.position.set(0, 0.06, 0.002);
  const labelMat = new THREE.MeshBasicMaterial({ map: videoLabelTexture('▶ TOCA PARA SONIDO'), toneMapped: false });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.065), labelMat);
  label.position.set(0, -0.265, 0.002);
  videoPanel.add(frame, screen, label);
  videoPanel.position.set(-0.4, 0.66, 0.1);
  videoPanel.rotation.y = 0.28;
  videoPanel.userData.action = 'video';
  videoPanel.userData.label = labelMat;
  root.add(videoPanel);
  clickables.push(videoPanel);

  // Tres botones 3D
  const labels = { concepto: 'CONCEPTO', tabla: 'LA TABLA', cultura: 'CULTURA' };
  hotspots = DIALOG_ORDER.map((key, i) => {
    const g = new THREE.Group();
    g.name = `Boton${i + 1}`;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: hotspotTexture(String(i + 1).padStart(2, '0'), labels[key]), transparent: true, toneMapped: false }));
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.088, 0.1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false }));
    pulse.position.set(0, 0.0385, -0.001);
    g.add(plate, pulse);
    g.position.set(0.48, 0.4 - i * 0.34, 0.14);
    g.rotation.y = -0.28;
    g.userData = { action: 'dialog', key, pulse, phase: i * 0.7 };
    root.add(g);
    clickables.push(g);
    return g;
  });

  // Luces + entorno para los metales
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  root.userData.env = env;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.2);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.6, 1, 1.6);
  root.add(hemi, key);

  root.scale.setScalar(0.001);
  return root;
}

// ------------------------------------------------------------- interacción
const _v = new THREE.Vector3();
function screenPos(obj, rect) {
  obj.getWorldPosition(_v).project(mindar.camera);
  return { x: rect.left + (_v.x + 1) / 2 * rect.width, y: rect.top + (1 - _v.y) / 2 * rect.height, behind: _v.z > 1 };
}
let downAt = null;
function onDown(ev) { downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() }; }
function onUp(ev) {
  if (!downAt) return;
  const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
  downAt = null;
  if (moved > 25) return;
  onPointer(ev);
}
function onPointer(ev) {
  if (!mindar || !state.visible || !$('dialog').hidden) return;
  const canvas = mindar.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  const p = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(p, mindar.camera);
  const hits = ray.intersectObjects(clickables, true);
  let o = hits.length ? hits[0].object : null;
  while (o && !o.userData.action) o = o.parent;
  if (!o) {
    // tolerancia para dedos: el botón 3D más cercano en pantalla (radio ~45 px)
    let best = null, bestD = 45;
    for (const h of hotspots) {
      const sp = screenPos(h, rect);
      if (sp.behind) continue;
      const d = Math.hypot(sp.x - ev.clientX, sp.y - (ev.clientY + 0));
      if (d < bestD) { bestD = d; best = h; }
    }
    o = best;
  }
  if (!o) return;
  const { action, key } = o.userData;
  if (action === 'dialog') { bump(o); openDialog(key); }
  if (action === 'deck') nextGraphic();
  if (action === 'video') toggleVideoSound();
}

function bump(obj) { obj.userData.bump = 1; }

function nextGraphic() {
  if (!deck || state.flipping) return;
  state.flipping = true; state.flip = 0;
  SFX.play('click', { volume: 0.7, rate: 0.8 });
  setTimeout(() => {
    deck.setGraphic(deck.index + 1);
    toast(['01 · Calavera', '02 · Tablero', '03 · Mono'][deck.index]);
  }, 260);
}

function toggleVideoSound() {
  if (!video) return;
  video.muted = !video.muted;
  if (video.paused) video.play().catch(() => {});
  SFX.play('click', { volume: 0.5 });
  $('toggle-video').textContent = video.muted ? '▶ Sonido del video' : '■ Silenciar video';
  toast(video.muted ? 'Video en silencio' : 'Sonido del video activado');
}

$('next-graphic').addEventListener('click', () => {
  if (!state.visible) { toast('Primero apunta al afiche'); return; }
  nextGraphic();
});
$('toggle-video').addEventListener('click', toggleVideoSound);
$('mute').addEventListener('click', () => {
  const m = !SFX.muted; SFX.setMuted(m);
  if (video && m) video.muted = true;
  $('mute').setAttribute('aria-pressed', String(m));
  $('mute').style.opacity = m ? 0.5 : 1;
  toast(m ? 'Sonido apagado' : 'Sonido encendido');
});

// ------------------------------------------------------------- animación por cuadro
function easeOutBack(t) { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; }

function update() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  state.t += dt;
  if (!content) return;
  // aparición
  const target = state.visible ? 1 : 0;
  state.appear += (target - state.appear) * Math.min(1, dt * (state.visible ? 3.2 : 8));
  const s = state.visible ? Math.max(0.001, easeOutBack(Math.min(1, state.appear))) : Math.max(0.001, state.appear);
  content.scale.setScalar(s);

  if (deck) {
    const p = deck.pivot;
    // giro lento sobre el eje largo + flotación
    let spin = state.t * 0.55;
    let pop = 0;
    if (state.flipping) {
      state.flip += dt / 0.55;
      const f = Math.min(1, state.flip);
      spin += f * Math.PI * 2;      // kickflip
      pop = Math.sin(f * Math.PI) * 0.18;
      if (f >= 1) { state.flipping = false; state.t += Math.PI * 2 / 0.55; }
    }
    deck.group.rotation.y = spin;
    p.position.z = 0.22 + Math.sin(state.t * 1.6) * 0.025 + pop;
    p.rotation.x = Math.sin(state.t * 0.7) * 0.12;
    p.rotation.z = Math.sin(state.t * 0.5) * 0.06;
  }
  content.children.forEach((c) => {
    if (c.isMesh && c.geometry.type === 'RingGeometry') c.rotation.z -= dt * 0.25;
  });
  for (const h of hotspots) {
    const u = h.userData;
    const k = (state.t * 1.1 + u.phase) % 1.6;
    u.pulse.scale.setScalar(1 + k * 0.5);
    u.pulse.material.opacity = Math.max(0, 0.85 - k * 0.6);
    u.bump = Math.max(0, (u.bump || 0) - dt * 4);
    h.scale.setScalar(1 + Math.sin(u.bump * Math.PI) * 0.18);
    h.position.z = 0.14 + Math.sin(state.t * 2 + u.phase) * 0.01;
  }
}

// ------------------------------------------------------------- marcador
async function getTargetSrc() {
  // 1) archivo .mind precompilado (rápido). 2) si no existe, compilar la imagen en el navegador.
  try {
    const r = await fetch(MARKER_MIND, { method: 'HEAD' });
    if (r.ok) return MARKER_MIND;
  } catch (e) { /* sigue */ }
  setProgress(30, 'Analizando el afiche…');
  const { Compiler } = await import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
  const img = new Image(); img.src = MARKER_IMG; await img.decode();
  const compiler = new Compiler();
  await compiler.compileImageTargets([img], (p) => setProgress(30 + p * 0.4, 'Analizando el afiche…'));
  const buf = await compiler.exportData();
  return URL.createObjectURL(new Blob([buf]));
}

async function start() {
  if (started) return;
  SFX.unlock();
  SFX.play('click');
  const btn = $('start');
  btn.disabled = true;
  $('error').classList.remove('visible');
  try {
    setProgress(10, 'Cargando motor AR…');
    const { MindARThree } = await import('mindar-image-three');
    setProgress(25, 'Preparando marcador…');
    const targetSrc = await getTargetSrc();
    setProgress(72, 'Abriendo cámara…');
    await document.fonts.load(DISPLAY(60)).catch(() => {});

    mindar = new MindARThree({
      container: $('ar'),
      imageTargetSrc: targetSrc,
      filterMinCF: 0.0001,
      filterBeta: 0.001,
      warmupTolerance: 3,
      missTolerance: 8,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no',
    });
    const { renderer, scene, camera } = mindar;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    content = await buildContent(renderer);
    scene.environment = content.userData.env;
    const anchor = mindar.addAnchor(0);
    // centramos el contenido sobre la mitad inferior de la ilustración (el logo queda libre arriba)
    content.position.set(0, -0.1, 0);
    anchor.group.add(content);

    anchor.onTargetFound = () => {
      state.visible = true;
      SFX.play('found', { volume: 0.8 });
      video.play().catch(() => {});
      $('status').classList.add('ok');
      $('status-text').textContent = 'Afiche detectado · toca para explorar';
      if (navigator.vibrate) navigator.vibrate(30);
    };
    anchor.onTargetLost = () => {
      state.visible = false;
      video.pause();
      $('status').classList.remove('ok');
      $('status-text').textContent = 'Busca el afiche Rufián';
    };

    setProgress(85, 'Abriendo cámara…');
    await mindar.start();
    renderer.setAnimationLoop(() => { update(); renderer.render(scene, camera); });
    started = true;
    setProgress(100, 'Listo');
    $('intro').hidden = true; $('intro').style.display = 'none';
    $('status').hidden = false; $('dock').hidden = false;
    // MindAR pone una capa CSS3D encima del canvas: escuchamos en el contenedor completo
    $('ar').addEventListener('pointerdown', onDown);
    $('ar').addEventListener('pointerup', onUp);
    toast('Apunta la cámara al afiche Rufián', 3200);
    window.__ar = { mindar, state, deck, content };
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    $('start-label').textContent = 'Reintentar';
    const denied = /permission|notallowed|denied/i.test(String(err?.name) + String(err?.message));
    $('error').textContent = denied
      ? 'No tenemos permiso para usar la cámara. Actívalo en la configuración del navegador y vuelve a intentarlo.'
      : `No se pudo iniciar la experiencia. Revisa la conexión y que el navegador permita la cámara (se necesita HTTPS). ${err?.message || ''}`;
    $('error').classList.add('visible');
    try { mindar?.stop(); } catch (e) { /* nada */ }
    mindar = null;
  }
}

$('start').addEventListener('click', start);
document.addEventListener('visibilitychange', () => { if (document.hidden && video) video.pause(); else if (state.visible) video?.play().catch(() => {}); });
window.addEventListener('pagehide', () => { try { mindar?.stop(); } catch (e) { /* nada */ } });
if (params.get('autostart') === '1') start();
