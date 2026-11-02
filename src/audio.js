// Web Audio wrapper. Static, fan hum and kitchen clatter have no source file, so they are synthesised.
export class Audio {
  constructor(manifest, base = 'assets/sfx/') {
    this.manifest = manifest;
    this.base = base;
    this.buffers = {};
    this.loops = {};
    this.ctx = null;
  }

  async load(onProgress) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    await Promise.all(Object.entries(this.manifest).map(async ([key, file]) => {
      try {
        const res = await fetch(this.base + file);
        this.buffers[key] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch (err) {
        console.warn('Could not load sound', key, err);
      }
      onProgress();
    }));
    this.noise = this.makeNoise();
  }

  unlock() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  makeNoise() {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  play(key, { vol = 1, rate = 1, loop = false } = {}) {
    const buf = this.buffers[key];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(this.master);
    src.start();
    return { src, gain };
  }

  loop(key, vol = 1) {
    if (!this.loops[key]) this.loops[key] = this.play(key, { vol, loop: true });
    else this.loops[key].gain.gain.value = vol;
  }

  stop(key) {
    const h = this.loops[key];
    if (!h) return;
    try { h.src.stop(); } catch (_) { /* already stopped */ }
    delete this.loops[key];
  }

  stopAll() { Object.keys(this.loops).forEach((k) => this.stop(k)); }

  // Filtered noise loop: 'static' (bright) or 'fan' (low hum).
  noiseLoop(key, vol, freq, type = 'lowpass') {
    if (this.loops[key]) { this.loops[key].gain.gain.value = vol; return; }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.loops[key] = { src, gain };
  }

  blip(vol = 0.25, dur = 0.12) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(gain).connect(this.master);
    src.start(t, Math.random(), dur);
  }

  // Pots and pans for Chica in the kitchen.
  clatter() {
    for (let i = 0; i < 5; i++) {
      const t = this.ctx.currentTime + i * 0.17 + Math.random() * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 500 + Math.random() * 1400;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.13);
    }
  }
}
