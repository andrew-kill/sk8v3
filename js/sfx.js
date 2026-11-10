// Gestor de efectos de sonido con Web Audio (baja latencia y bucles sin cortes).
// Los navegadores móviles exigen un toque del usuario antes de reproducir audio:
// llama a SFX.unlock() dentro de un evento de clic.

const FILES = {
  click: 'assets/sfx/ui-click.mp3',
  open: 'assets/sfx/ui-abrir.mp3',
  found: 'assets/sfx/marcador-detectado.mp3',
  shutter: 'assets/sfx/obturador.mp3',
  charge: 'assets/sfx/repulsor-carga.mp3',
  hum: 'assets/sfx/repulsor-zumbido.mp3',
  off: 'assets/sfx/repulsor-apagado.mp3',
  blast: 'assets/sfx/repulsor-disparo.mp3',
};

// medio segundo de silencio (WAV 8 kHz) generado al vuelo
const SILENT_WAV = (() => {
  const n = 4000, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
})();

class SoundBank {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.loading = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
    // iPhone: por defecto Web Audio respeta el interruptor de silencio y la cámara puede
    // "interrumpir" el audio. Pedimos sesión de reproducción y reproducimos un audio HTML
    // silencioso en bucle (truco conocido para que el sonido salga aunque esté en silencio).
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* nada */ }
    if (!this.keepAlive) {
      this.keepAlive = new Audio(SILENT_WAV);
      this.keepAlive.loop = true;
      this.keepAlive.setAttribute('playsinline', '');
      this.keepAlive.volume = 0.01;
    }
    this.keepAlive.play().catch(() => {});
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.loading) this.loading = this.preload();
  }

  async preload(names = Object.keys(FILES)) {
    await Promise.all(names.map(async (name) => {
      if (this.buffers[name]) return;
      try {
        const res = await fetch(FILES[name]);
        const data = await res.arrayBuffer();
        this.buffers[name] = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
      } catch (e) {
        console.warn('No se pudo cargar el sonido', name, e);
      }
    }));
  }

  // Reproduce un sonido. Devuelve un control { stop(fade), gain } o null.
  play(name, { volume = 1, loop = false, fadeIn = 0, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return null;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    const buffer = this.buffers[name];
    if (!buffer) { this.loading?.then(() => {}); return null; }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = loop; src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + fadeIn);
    } else {
      gain.gain.value = volume;
    }
    src.connect(gain); gain.connect(this.master);
    src.start();
    return {
      gain,
      source: src,
      stop: (fade = 0.15) => {
        const t = this.ctx.currentTime;
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
          src.stop(t + fade + 0.02);
        } catch (e) { /* ya detenido */ }
      },
    };
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }
}

export const SFX = new SoundBank();

// Cualquier toque reactiva el audio si el navegador lo suspendió (p. ej. al abrir la cámara).
['touchend', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, () => {
  if (SFX.ctx && SFX.ctx.state !== 'running') SFX.ctx.resume().catch(() => {});
  SFX.keepAlive?.paused && SFX.keepAlive.play().catch(() => {});
}, { passive: true }));
