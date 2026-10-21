// Musique d'ambiance generee en Web Audio, sans fichier externe et sans
// dependance a un autre exercice.
// - volume reglable en direct (gain maitre, 0 a 1)
// - demarrage a la premiere interaction utilisateur (politique d'autoplay)
// - stop() coupe tout le mix : gain maitre a 0 + planification arretee,
//   chaque oscillateur est auto-arrete apres sa duree (sources liberees)
class GameMusic {
  constructor(volume = 0.5) {
    this.ctx = null;
    this.master = null;
    this.volume = GameMusic.clamp01(volume);
    this.running = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 96;
    this.scale = [220, 246.94, 261.63, 293.66, 329.63, 392, 440];
    this.melody = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 5, 7, 5, 4, 2];
    this.bass = [55, 73.42];
  }
  static clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
  ensureContext() {
    const AudioCtor = (typeof window !== 'undefined') &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtor) return false;
    if (!this.ctx) {
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  setVolume(value) {
    this.volume = GameMusic.clamp01(value);
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    return this.volume;
  }
  start() {
    if (this.running) return false;
    if (!this.ensureContext()) return false;
    this.running = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
    return true;
  }
  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    return true;
  }
  schedule() {
    if (!this.running || !this.ctx || !this.master) return;
    const stepDuration = 60 / this.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, stepDuration);
      this.nextTime += stepDuration;
      this.step++;
    }
  }
  playStep(step, time, stepDuration) {
    const index = step % 16;
    if (index % 4 === 0) this.note(this.bass[Math.floor(step / 4) % 2], time, stepDuration * 1.8, 'triangle', 0.45);
    this.note(this.scale[this.melody[index]] * 2, time, stepDuration * 0.9, 'square', 0.1);
  }
  note(frequency, time, duration, type, peak) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    return osc;
  }
  playLaser() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }
  playExplosion() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  playRescue() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.note(587.33, now, 0.1, 'sine', 0.2);
    this.note(880, now + 0.08, 0.18, 'triangle', 0.25);
  }
  playEvacuate() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.note(440, now, 0.08, 'triangle', 0.2);
    this.note(554.37, now + 0.07, 0.08, 'triangle', 0.2);
    this.note(659.25, now + 0.14, 0.2, 'sine', 0.3);
  }
}

const gameMusic = new GameMusic(0.5);
