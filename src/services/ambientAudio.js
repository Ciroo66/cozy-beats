/**
 * Ambient Sound Synthesizer using Web Audio API.
 * Generates 100% offline procedural cozy sounds:
 * - Rain on Window
 * - Vinyl Dust Crackle
 * - Warm Fireplace Crackle
 * - Night Summer Breeze
 */

class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.sounds = {
      rain: { active: false, volume: 0.4, nodes: [] },
      vinyl: { active: false, volume: 0.35, nodes: [] },
      fireplace: { active: false, volume: 0.3, nodes: [] },
      breeze: { active: false, volume: 0.25, nodes: [] }
    };
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Create White/Pink Noise Buffer
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    // Pink noise filter algorithm (Paul Kellet's method)
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // Start Rain Sound
  startRain() {
    this.initContext();
    const noiseBuffer = this.createNoiseBuffer();
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Lowpass filter for muffled cozy rain against window
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sounds.rain.volume, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noiseSource.start();

    this.sounds.rain.nodes = [noiseSource, filter, gain];
    this.sounds.rain.active = true;
  }

  // Start Vinyl Record Dust & Crackle
  startVinyl() {
    this.initContext();
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Occasional random sharp crackle ticks
      if (Math.random() < 0.0006) {
        data[i] = (Math.random() * 2 - 1) * 0.8;
      } else if (Math.random() < 0.003) {
        data[i] = (Math.random() * 2 - 1) * 0.2;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.015; // gentle surface hiss
      }
    }

    const crackleSource = this.ctx.createBufferSource();
    crackleSource.buffer = buffer;
    crackleSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sounds.vinyl.volume, this.ctx.currentTime);

    crackleSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    crackleSource.start();

    this.sounds.vinyl.nodes = [crackleSource, filter, gain];
    this.sounds.vinyl.active = true;
  }

  // Start Fireplace crackle
  startFireplace() {
    this.initContext();
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < 0.001) {
        data[i] = (Math.random() * 2 - 1) * 0.9;
      } else if (Math.random() < 0.01) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.03;
      }
    }

    const fireSource = this.ctx.createBufferSource();
    fireSource.buffer = buffer;
    fireSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sounds.fireplace.volume, this.ctx.currentTime);

    fireSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    fireSource.start();

    this.sounds.fireplace.nodes = [fireSource, filter, gain];
    this.sounds.fireplace.active = true;
  }

  // Start Warm Breeze
  startBreeze() {
    this.initContext();
    const noiseBuffer = this.createNoiseBuffer();
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    // Subtle LFO modulation for swaying wind
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(100, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.sounds.breeze.volume, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noiseSource.start();

    this.sounds.breeze.nodes = [noiseSource, filter, gain, lfo, lfoGain];
    this.sounds.breeze.active = true;
  }

  stopSound(name) {
    if (this.sounds[name] && this.sounds[name].active) {
      try {
        this.sounds[name].nodes.forEach(node => {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        });
      } catch (err) {
        console.warn('Error stopping node', err);
      }
      this.sounds[name].nodes = [];
      this.sounds[name].active = false;
    }
  }

  setVolume(name, volume) {
    if (this.sounds[name]) {
      this.sounds[name].volume = volume;
      const gainNode = this.sounds[name].nodes[2];
      if (gainNode && this.ctx) {
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      }
    }
  }

  toggleSound(name) {
    if (this.sounds[name].active) {
      this.stopSound(name);
      return false;
    } else {
      switch (name) {
        case 'rain': this.startRain(); break;
        case 'vinyl': this.startVinyl(); break;
        case 'fireplace': this.startFireplace(); break;
        case 'breeze': this.startBreeze(); break;
      }
      return true;
    }
  }

  stopAll() {
    Object.keys(this.sounds).forEach(name => this.stopSound(name));
  }
}

export const ambientEngine = new AmbientSoundEngine();
