// Musique d'ambiance generee en Web Audio : drone mineur + percussion martiale + motif rare.
// Demarrage a la premiere interaction utilisateur (politique d'autoplay).
class GameMusic {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.32;
    this.enabled = true;
    this.running = false;
    this.timer = null;
    this.beat = 0;
    this.nextTime = 0;
    this.bpm = 84;
    this.bassNotes = [55, 55, 65.41, 49]; // A1 A1 C2 G1
    this.leadNotes = [220, 246.94, 293.66, 329.63, 392]; // A3 B3 D4 E4 G4 (mineur)
    // motif de 32 doubles-croches (indices dans leadNotes, -1 = silence)
    this.motif = [0, -1, 2, -1, 4, 3, 2, -1, 0, -1, 3, 2, 1, -1, -1, -1,
                  0, -1, 2, 4, 3, -1, 2, -1, 1, 2, 1, -1, -1, -1, -1, -1];
  }

  ensure() {
    const Ctor = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return false;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      // filtre passe-bas global : adoucit le signal
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1600;
      this.filter.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  start() {
    if (this.running || !this.enabled) return false;
    if (!this.ensure()) return false;
    this.running = true;
    this.beat = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    this.timer = setInterval(() => this.schedule(), 40);
    return true;
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    return true;
  }

  setVolume(v) {
    const n = Number(v);
    this.volume = Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.32));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02);
    return this.volume;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.enabled) this.start(); else this.stop();
    return this.enabled;
  }

  schedule() {
    if (!this.ctx) return;
    const horizon = this.ctx.currentTime + 0.6;
    while (this.nextTime < horizon) {
      this.playBeat(this.beat, this.nextTime);
      this.nextTime += 60 / this.bpm / 2; // doubles (croches)
      this.beat += 1;
    }
  }

  playBeat(step, t) {
    // percussion martiale : grosse caisse sur les temps, caisse claire sur le 2e/4e temps
    if (step % 4 === 0) this.kick(t, 0.5);
    if (step % 4 === 2) this.hat(t, 0.16);
    // drone de basse : changement tous les 4 temps
    if (step % 8 === 0) this.bass(t, this.bassNotes[Math.floor(step / 8) % this.bassNotes.length], 60 / this.bpm * 1.9);
    // motif lead leger, une barre sur deux
    const bar = Math.floor(step / 16) % 2;
    if (bar === 1) {
      const idx = this.motif[step % 16];
      if (idx >= 0) this.lead(t, this.leadNotes[idx], 60 / this.bpm * 0.5);
    }
  }

  kick(t, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.filter);
    o.start(t); o.stop(t + 0.25);
  }

  hat(t, vol) {
    const b = this.ctx.createBuffer(1, 2200, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6200;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.filter);
    src.start(t); src.stop(t + 0.06);
  }

  bass(t, freq, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
    g.gain.setValueAtTime(0.2, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.filter);
    o.start(t); o.stop(t + dur + 0.05);
  }

  lead(t, freq, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    o.detune.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.03);
    g.gain.setValueAtTime(0.05, t + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.filter);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

const gameMusic = new GameMusic();
