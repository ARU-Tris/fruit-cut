export class FruitAudio {
  constructor() {
    try { this.muted = localStorage.getItem('fruit-cut-muted') === 'true'; } catch { this.muted = false; }
    this.volume = 0.38;
    this.lastImpact = 0;
  }

  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.output = this.context.createGain(); this.output.gain.value = this.volume;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -16; compressor.ratio.value = 5;
      this.output.connect(compressor); compressor.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i=0; i<data.length; i++) data[i] = Math.random()*2-1;
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  toggle() {
    this.unlock(); this.muted = !this.muted;
    try { localStorage.setItem('fruit-cut-muted', String(this.muted)); } catch { /* Storage is optional. */ }
    return this.muted;
  }

  noiseBurst(duration, frequency, gain, delay = 0, type = 'bandpass') {
    if (!this.context || this.muted || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource(); source.buffer = this.noise;
    const filter = this.context.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.7;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, now); envelope.gain.exponentialRampToValueAtTime(Math.max(gain,0.0002), now+0.009);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now+duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.output);
    source.start(now, Math.random()*0.5); source.stop(now+duration+0.01);
  }

  tone(frequency, duration, gain, end = frequency) {
    if (!this.context || this.muted || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator(); oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency,now); oscillator.frequency.exponentialRampToValueAtTime(end, now+duration);
    const envelope = this.context.createGain(); envelope.gain.setValueAtTime(gain,now); envelope.gain.exponentialRampToValueAtTime(0.0001,now+duration);
    oscillator.connect(envelope); envelope.connect(this.output); oscillator.start(now); oscillator.stop(now+duration);
  }

  slice(count=1, mark=false) {
    this.noiseBurst(mark ? 0.14 : 0.24, mark ? 3000 : 1850, mark ? 0.17 : 0.38);
    this.noiseBurst(0.12,650,mark ? 0.06 : 0.23,0.025);
    if (!mark) { this.tone(190,0.19,0.18,64); if (count>2) this.noiseBurst(0.38,3800,0.19,0.06); }
  }

  impact(piece) {
    if (!this.context || this.context.currentTime-this.lastImpact<0.07) return;
    const speed = Math.abs(piece.body.linvel().y);
    if (speed<0.3) return;
    this.lastImpact = this.context.currentTime;
    this.tone(100+Math.random()*35,0.13,Math.min(0.13,speed*0.022),45);
    this.noiseBurst(0.09,450,Math.min(0.14,speed*0.02));
  }

  sweep() { this.noiseBurst(0.48,1600,0.24,0,'highpass'); }
}
