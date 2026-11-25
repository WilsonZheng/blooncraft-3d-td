// Procedural Web Audio API Music & SFX Synthesizer (Zero external audio files required)
// Features:
// 1. Master / BGM / SFX Mixer Buses + DynamicsCompressor (zero clipping under heavy cascades)
// 2. Adaptive Lookahead Step-Sequencer BGM with 3 Map Themes (Meadow / Volcano / Glacier)
//    & 4 Dynamic States (Build Calm -> Wave Groove -> Boss Battle -> Fever Overdrive)
// 3. Filtered White-Noise Buffer + Multi-Oscillator Signature SFX for all 8 Tower Archetypes

const MIDI_TO_HZ = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MAP_THEMES = {
  meadow: {
    bpm: 118,
    bass: [48, 48, 55, 55, 57, 57, 53, 55],
    bossBass: [45, 45, 57, 45, 48, 48, 50, 52],
    arp: [72, 76, 79, 84, 79, 76, 74, 79, 81, 84, 79, 76, 72, 76, 79, 76],
    bossLead: [69, 72, 76, 81, 79, 76, 74, 72, 69, 72, 76, 83, 81, 79, 76, 72],
    leadWave: 'triangle',
    bassWave: 'triangle'
  },
  volcano: {
    bpm: 126,
    bass: [38, 38, 38, 41, 43, 43, 39, 38],
    bossBass: [38, 50, 38, 50, 41, 53, 39, 51],
    arp: [62, 65, 69, 74, 70, 69, 65, 62, 63, 67, 70, 74, 69, 67, 65, 62],
    bossLead: [62, 62, 74, 70, 69, 65, 63, 62, 62, 65, 69, 75, 74, 70, 69, 65],
    leadWave: 'sawtooth',
    bassWave: 'sawtooth'
  },
  glacier: {
    bpm: 112,
    bass: [41, 41, 48, 48, 50, 50, 45, 48],
    bossBass: [41, 53, 41, 53, 45, 57, 43, 55],
    arp: [77, 81, 84, 88, 86, 84, 81, 79, 77, 81, 83, 88, 84, 81, 79, 76],
    bossLead: [74, 77, 81, 86, 84, 81, 79, 77, 74, 77, 81, 88, 86, 84, 81, 76],
    leadWave: 'sine',
    bassWave: 'triangle'
  }
};

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;

    this.muted = false;
    this.bgmEnabled = true;
    this.volumes = {
      master: 0.8,
      bgm: 0.42,
      sfx: 0.85
    };

    this.musicState = {
      mapId: 'meadow',
      waveActive: false,
      isBoss: false,
      fever: false
    };

    this._seqTimer = null;
    this._stepIdx = 0;
    this._nextNoteTime = 0;

    this.comboCount = 0;
    this.lastPopTime = 0;
    this._cooldowns = {};
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this._ensureSequencer();
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.16;
      this.compressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.compressor);

      this._buildNoiseBuffer();
      this._applyMixerGains();
      this._ensureSequencer();
    } catch {
      this.ctx = null;
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * 0.8);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _applyMixerGains() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, now, 0.03);
    this.bgmGain.gain.setTargetAtTime(this.bgmEnabled ? this.volumes.bgm : 0, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, now, 0.03);
  }

  setSettings({ master, bgm, sfx, muted, bgmEnabled } = {}) {
    if (typeof master === 'number') this.volumes.master = Math.max(0, Math.min(1, master));
    if (typeof bgm === 'number') this.volumes.bgm = Math.max(0, Math.min(1, bgm));
    if (typeof sfx === 'number') this.volumes.sfx = Math.max(0, Math.min(1, sfx));
    if (typeof muted === 'boolean') this.muted = muted;
    if (typeof bgmEnabled === 'boolean') this.bgmEnabled = bgmEnabled;
    this._applyMixerGains();
  }

  toggleMute() {
    this.muted = !this.muted;
    this._applyMixerGains();
    return this.muted;
  }

  setMusicContext({ mapId, waveActive, isBoss, fever } = {}) {
    if (mapId) this.musicState.mapId = mapId;
    if (typeof waveActive === 'boolean') this.musicState.waveActive = waveActive;
    if (typeof isBoss === 'boolean') this.musicState.isBoss = isBoss;
    if (typeof fever === 'boolean') this.musicState.fever = fever;
  }

  _ensureSequencer() {
    if (this._seqTimer || !this.ctx) return;
    this._nextNoteTime = this.ctx.currentTime + 0.06;
    this._seqTimer = setInterval(() => this._schedulerTick(), 50);
  }

  _schedulerTick() {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.bgmEnabled || this.volumes.bgm <= 0.01) {
      if (this.ctx) this._nextNoteTime = this.ctx.currentTime + 0.1;
      return;
    }
    const theme = MAP_THEMES[this.musicState.mapId] || MAP_THEMES.meadow;
    let bpm = theme.bpm;
    if (this.musicState.fever) bpm += 24;
    else if (this.musicState.isBoss) bpm += 14;
    else if (!this.musicState.waveActive) bpm -= 12;

    const sixteenthDur = 60 / bpm / 4;
    while (this._nextNoteTime < this.ctx.currentTime + 0.14) {
      this._scheduleStep(this._stepIdx, this._nextNoteTime, sixteenthDur, theme);
      this._nextNoteTime += sixteenthDur;
      this._stepIdx = (this._stepIdx + 1) % 16;
    }
  }

  _scheduleStep(step, t, dur, theme) {
    const { waveActive, isBoss, fever } = this.musicState;

    // 1. Sub-Bass / Synth Bassline (every 8th note in combat, quarter note in calm)
    const playBass = waveActive ? step % 2 === 0 : step % 4 === 0;
    if (playBass) {
      const bassArr = isBoss ? theme.bossBass : theme.bass;
      const midi = bassArr[Math.floor(step / 2) % bassArr.length];
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = theme.bassWave;
      osc.frequency.setValueAtTime(MIDI_TO_HZ(midi), t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(isBoss ? 520 : 340, t);
      const peak = waveActive ? 0.13 : 0.08;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * (waveActive ? 1.8 : 3.2));
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + dur * (waveActive ? 1.9 : 3.3));
    }

    // 2. Melodic Arpeggio / Boss Lead
    const playLead = fever || isBoss || waveActive ? true : step % 2 === 0;
    if (playLead) {
      const notes = isBoss ? theme.bossLead : theme.arp;
      const midi = notes[step % notes.length] + (fever && step % 2 === 1 ? 12 : 0);
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = isBoss ? 'sawtooth' : theme.leadWave;
      osc.frequency.setValueAtTime(MIDI_TO_HZ(midi), t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(isBoss ? 1950 : 1600, t);
      const peak = isBoss ? 0.068 : (waveActive ? 0.058 : 0.042);
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.45);
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + dur * 1.55);
    }

    // 3. Crisp Synthesized Drums during active combat
    if (waveActive) {
      // Kick on 0, 4, 8, 12 (plus syncopated 14 in Boss/Fever)
      if (step % 4 === 0 || ((isBoss || fever) && step === 14)) {
        const kOsc = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(135, t);
        kOsc.frequency.exponentialRampToValueAtTime(38, t + 0.09);
        kGain.gain.setValueAtTime(isBoss ? 0.18 : 0.13, t);
        kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        kOsc.connect(kGain);
        kGain.connect(this.bgmGain);
        kOsc.start(t);
        kOsc.stop(t + 0.11);
      }
      // Crisp Snare / Hi-hat noise on offbeats
      if (this.noiseBuffer && (step % 4 === 2 || ((isBoss || fever) && step % 2 === 1))) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(step === 4 || step === 12 ? 1800 : 5800, t);
        const nGain = this.ctx.createGain();
        const isSnare = step === 4 || step === 12;
        nGain.gain.setValueAtTime(isSnare ? 0.055 : 0.024, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + (isSnare ? 0.08 : 0.035));
        src.connect(hp);
        hp.connect(nGain);
        nGain.connect(this.bgmGain);
        src.start(t);
        src.stop(t + (isSnare ? 0.09 : 0.04));
      }
    }
  }

  canPlay() {
    if (this.muted || this.volumes.sfx <= 0.01) return false;
    if (!this.ctx) this.init();
    if (!this.ctx || this.ctx.state !== 'running') return false;
    return true;
  }

  _throttle(key, minGap) {
    const now = this.ctx.currentTime;
    if (now - (this._cooldowns[key] || 0) < minGap) return false;
    this._cooldowns[key] = now;
    return true;
  }

  _playFilteredNoise(duration, filterType, freq, q, peakGain, bus = this.sfxGain) {
    if (!this.noiseBuffer || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(freq, now);
    flt.Q.setValueAtTime(q, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peakGain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(flt);
    flt.connect(g);
    g.connect(bus || this.ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  playTowerShot(typeId, tier = 0) {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    const bus = this.sfxGain;

    switch (typeId) {
      case 'dart': {
        if (!this._throttle('shot_dart', 0.075)) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(tier >= 3 ? 620 : 510, now);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.045);
        g.gain.setValueAtTime(0.065, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(g);
        g.connect(bus);
        osc.start(now);
        osc.stop(now + 0.055);
        break;
      }
      case 'tack': {
        if (!this._throttle('shot_tack', 0.09)) return;
        if (tier >= 3) {
          this._playFilteredNoise(0.11, 'bandpass', 920, 1.4, 0.085, bus);
        } else {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(760, now);
          osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);
          g.gain.setValueAtTime(0.045, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
          osc.connect(g);
          g.connect(bus);
          osc.start(now);
          osc.stop(now + 0.05);
        }
        break;
      }
      case 'cannon': {
        if (!this._throttle('shot_cannon', 0.11)) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g);
        g.connect(bus);
        osc.start(now);
        osc.stop(now + 0.16);
        this._playFilteredNoise(0.09, 'lowpass', 620, 1.0, 0.09, bus);
        break;
      }
      case 'frost': {
        if (!this._throttle('shot_frost', 0.12)) return;
        [1318.5, 1760, 2349.3].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.018);
          g.gain.setValueAtTime(0.055, now + idx * 0.018);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.018 + 0.14);
          osc.connect(g);
          g.connect(bus);
          osc.start(now + idx * 0.018);
          osc.stop(now + idx * 0.018 + 0.15);
        });
        break;
      }
      case 'ninja': {
        if (!this._throttle('shot_ninja', 0.07)) return;
        this._playFilteredNoise(0.055, 'highpass', 3200, 1.8, 0.065, bus);
        break;
      }
      case 'sniper': {
        if (!this._throttle('shot_sniper', 0.08)) return;
        // Supersonic crack + high metallic shell ping!
        this._playFilteredNoise(0.11, 'bandpass', 1450, 0.9, 0.15, bus);
        const ping = this.ctx.createOscillator();
        const pg = this.ctx.createGain();
        ping.type = 'sine';
        ping.frequency.setValueAtTime(2480, now + 0.04);
        ping.frequency.exponentialRampToValueAtTime(1860, now + 0.14);
        pg.gain.setValueAtTime(0.045, now + 0.04);
        pg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        ping.connect(pg);
        pg.connect(bus);
        ping.start(now + 0.04);
        ping.stop(now + 0.16);
        break;
      }
      case 'tesla': {
        this.playZap();
        break;
      }
    }
  }

  playPop(isCeramic = false) {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.022) return;
    if (now - this.lastPopTime < 0.28) {
      this.comboCount = Math.min(24, this.comboCount + 1);
    } else {
      this.comboCount = 0;
    }
    this.lastPopTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pitchBoost = 1 + this.comboCount * 0.024;

    if (isCeramic) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340 * pitchBoost, now);
      osc.frequency.exponentialRampToValueAtTime(105, now + 0.075);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else {
      osc.type = 'sine';
      const base = 470 * pitchBoost + (Math.random() * 50 - 25);
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.95, now + 0.045);
      gain.gain.setValueAtTime(0.115, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playClang() {
    if (!this.canPlay() || !this._throttle('clang', 0.08)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1040, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.085);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playExplosion(scale = 1) {
    if (!this.canPlay() || !this._throttle('boom', 0.055)) return;
    const now = this.ctx.currentTime;
    const dur = Math.min(0.48, 0.24 * scale);

    // Sub-punch + filtered rumble noise
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145 / Math.sqrt(scale), now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);
    gain.gain.setValueAtTime(Math.min(0.24, 0.14 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.02);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.03);

    this._playFilteredNoise(dur, 'lowpass', 720, 0.8, Math.min(0.22, 0.13 * scale), this.sfxGain);
  }

  playZap() {
    if (!this.canPlay() || !this._throttle('zap', 0.065)) return;
    const now = this.ctx.currentTime;
    [980, 1240].forEach((startF, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(240 + i * 70, now + 0.085);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.095);
    });
  }

  playCoin() {
    if (!this.canPlay() || !this._throttle('coin', 0.045)) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.095, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.17);
    });
  }

  playPlace(isUpgrade = false) {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    const notes = isUpgrade ? [523.25, 659.25, 783.99, 1046.5] : [392, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.042);
      gain.gain.setValueAtTime(0.095, now + i * 0.042);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.042 + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.042);
      osc.stop(now + i * 0.042 + 0.15);
    });
  }

  playCardDraft(rarity = 'rare') {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    const notes =
      rarity === 'legendary'
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
        : rarity === 'epic'
        ? [440, 554.37, 659.25, 880]
        : [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = rarity === 'legendary' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.11, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.26);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.28);
    });
  }

  playFeverStart() {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.038);
      g.gain.setValueAtTime(0.09, now + i * 0.038);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.038 + 0.32);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.038);
      osc.stop(now + i * 0.038 + 0.34);
    });
  }

  playWaveStart(isBoss = false) {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    const notes = isBoss ? [220, 207.65, 196, 146.83] : [440, 554.37, 659.25];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBoss ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.09, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  }

  playUltimate(type = 'meteor') {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    if (type === 'meteor') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.54);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.6);
      this._playFilteredNoise(0.5, 'lowpass', 880, 0.9, 0.18, this.sfxGain);
    } else if (type === 'frostNova') {
      [1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.11, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.36);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.38);
      });
      this._playFilteredNoise(0.28, 'highpass', 3600, 1.5, 0.09, this.sfxGain);
    } else if (type === 'overclock') {
      const sweep = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      sweep.type = 'triangle';
      sweep.frequency.setValueAtTime(220, now);
      sweep.frequency.exponentialRampToValueAtTime(1046.5, now + 0.34);
      sGain.gain.setValueAtTime(0.15, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      sweep.connect(sGain);
      sGain.connect(this.sfxGain);
      sweep.start(now);
      sweep.stop(now + 0.4);
    }
  }
}
