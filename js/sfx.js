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

class SoundBank {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.loading = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
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
