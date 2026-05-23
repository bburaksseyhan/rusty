import { midiToHz } from "../utils/math.js";

// ============================================================
//  Audio — procedural Web Audio engine.
//
//  Zero external assets — all music + SFX is synthesized live:
//    - Pad chord cycle + sub-bass + sparse FM bell melody
//    - Subliminal mechanical hum (faraway PC fan)
//    - Metallic footsteps, jump whoosh, landing thud, hit clunk,
//      collect sparkle
// ============================================================

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.reverb = null;
    this.started = false;
    this.musicPlaying = false;
    this._lastStep = 0;
    this._musicTimers = [];
    this._crtHumOsc  = null;
    this._crtHumLfo  = null;
    this._crtHumGain = null;
    this._crtHumHzOsc  = null;
    this._crtHumHzGain = null;
  }

  /** Browsers require AudioContext creation inside a user gesture. */
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.005;
    comp.release.value = 0.18;
    this.master.connect(comp).connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.reverb = this._buildReverb();
    this.musicGain.connect(this.reverb.input);
    this.reverb.output.connect(this.master);

    this.started = true;
  }

  /**
   * Tıklama/dokunma olayının içinde senkron çağırın (iOS zorunluluğu).
   */
  initFromGesture() {
    this.init();
    this._playSilentPing();
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /**
   * Mobil Safari/Chrome: bağlam "suspended" kalır; resume() + sessiz
   * buffer iOS'ta ses motorunu gerçekten açar.
   */
  async unlock() {
    if (!this.ctx) this.init();
    if (!this.ctx) return false;

    this._playSilentPing();

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }

    return this.ctx.state === "running";
  }

  isRunning() {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  /** iOS — Web Audio kilidini kırmak için tek örnek çalar. */
  _playSilentPing() {
    if (!this.ctx) return;
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      src.stop(this.ctx.currentTime + 0.001);
    } catch {
      /* ignore */
    }
  }

  pause() {
    if (this.ctx) void this.ctx.suspend().catch(() => {});
  }
  resume() {
    if (!this.ctx) return;
    void this.unlock();
  }

  // ----------------------------------------------------------
  //  Music
  // ----------------------------------------------------------
  startMusic() {
    if (!this.started || this.musicPlaying) return;
    if (!this.isRunning()) return;
    this.musicPlaying = true;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.0, now);
    this.musicGain.gain.linearRampToValueAtTime(0.55, now + 6.0);

    this._playPad();
    this._playBass();
    this._scheduleMelody();
    this._playHum();
  }

  stopMusic() {
    if (!this.musicPlaying) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(0.0, now + 1.4);
    this._musicTimers.forEach(clearTimeout);
    this._musicTimers = [];
    this.musicPlaying = false;
  }

  _playPad() {
    const chords = [
      [45, 48, 52, 55, 59], // Am9
      [41, 48, 53, 57, 60], // Fmaj7
      [36, 43, 48, 52, 55], // Cmaj7
      [43, 50, 55, 59, 62], // G6sus
    ];
    const chordDur = 8.0;
    const total = chords.length * chordDur;

    const bus = this.ctx.createGain();
    bus.gain.value = 0.18;
    bus.connect(this.musicGain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;
    filter.connect(bus);

    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 700;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const loop = () => {
      const now = this.ctx.currentTime;
      chords.forEach((chord, i) => {
        const t0 = now + i * chordDur;
        chord.forEach((semi) => {
          this._padVoice(midiToHz(semi + 12), t0, chordDur, filter);
          this._padVoice(midiToHz(semi + 12) * 1.005, t0, chordDur, filter);
        });
      });
      this._musicTimers.push(setTimeout(loop, total * 1000 - 200));
    };
    loop();
  }

  _padVoice(freq, t0, dur, dest) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.06, t0 + 2.5);
    env.gain.linearRampToValueAtTime(0.045, t0 + dur - 0.5);
    env.gain.linearRampToValueAtTime(0.0, t0 + dur);
    osc.connect(env).connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  _playBass() {
    const notes = [33, 29, 24, 31];
    const chordDur = 8.0;
    const total = notes.length * chordDur;

    const bus = this.ctx.createGain();
    bus.gain.value = 0.32;
    bus.connect(this.musicGain);

    const loop = () => {
      const now = this.ctx.currentTime;
      notes.forEach((n, i) => {
        const t0 = now + i * chordDur;
        const osc = this.ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = midiToHz(n + 12);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(0.5, t0 + 0.8);
        env.gain.linearRampToValueAtTime(0.0, t0 + chordDur);
        osc.connect(env).connect(bus);
        osc.start(t0);
        osc.stop(t0 + chordDur + 0.1);
      });
      this._musicTimers.push(setTimeout(loop, total * 1000 - 200));
    };
    loop();
  }

  _scheduleMelody() {
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const root = 69;
    const tick = () => {
      if (!this.musicPlaying) return;
      const semi = root + scale[Math.floor(Math.random() * scale.length)] - 12;
      this._bell(midiToHz(semi), 0.06 + Math.random() * 0.05);
      const next = 2000 + Math.random() * 4000;
      this._musicTimers.push(setTimeout(tick, next));
    };
    this._musicTimers.push(setTimeout(tick, 6000));
  }

  _bell(freq, amp = 0.08) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = amp;
    bus.connect(this.musicGain);

    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = freq;
    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    modulator.frequency.value = freq * 2.01;
    const modGain = ctx.createGain();
    modGain.gain.value = freq * 1.5;
    modulator.connect(modGain).connect(carrier.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);

    carrier.connect(env).connect(bus);
    carrier.start(t0);
    modulator.start(t0);
    carrier.stop(t0 + 1.9);
    modulator.stop(t0 + 1.9);
  }

  _playHum() {
    const ctx = this.ctx;
    const hum = ctx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 58;
    const hum2 = ctx.createOscillator();
    hum2.type = "sawtooth";
    hum2.frequency.value = 87;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    hum.connect(lp);
    hum2.connect(lp);
    lp.connect(g).connect(this.musicGain);
    hum.start();
    hum2.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
  }

  // ----------------------------------------------------------
  //  SFX
  // ----------------------------------------------------------
  footstep(speed = 1.0) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (t - this._lastStep < 0.18) return;
    this._lastStep = t;

    const dur = 0.09;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 + Math.random() * 1000;
    bp.Q.value = 1.6;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.35 * Math.min(1, speed), t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(bp).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);

    // wooden thump under
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const f0 = 110 + Math.random() * 30;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.08);

    const oenv = this.ctx.createGain();
    oenv.gain.setValueAtTime(0, t);
    oenv.gain.linearRampToValueAtTime(0.12, t + 0.005);
    oenv.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(oenv).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  jump() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.18);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;

    osc.connect(lp).connect(env).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  land() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.18);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(lp).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.2);
  }

  collect() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const env = this.ctx.createGain();
      const ts = t + i * 0.06;
      env.gain.setValueAtTime(0, ts);
      env.gain.linearRampToValueAtTime(0.18, ts + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, ts + 0.35);
      osc.connect(env).connect(this.sfxGain);
      osc.start(ts);
      osc.stop(ts + 0.4);
    });
  }

  /**
   * Short "vocoder" blip used while the robot is "speaking".
   * Called per visible character to mimic typewriter robot speech.
   */
  robotBlip(pitch = 1.0) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const dur = 0.045;

    const osc = this.ctx.createOscillator();
    osc.type = "square";
    const f0 = 320 * pitch;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + dur);

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700;
    bp.Q.value = 4.2;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.09, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(bp).connect(env).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  // ----------------------------------------------------------
  //  Emotional SFX — procedurally synthesized, no assets.
  // ----------------------------------------------------------

  /**
   * Wonder chime — bright discovery sound.
   * Played when Rusty encounters something new or curious.
   */
  wonder() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [1046, 1318, 1568, 2093].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + i * 0.07 + 0.3);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, t + i * 0.07);
      env.gain.linearRampToValueAtTime(0.10, t + i * 0.07 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.55);
      osc.connect(env).connect(this.sfxGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.6);
    });
  }

  /**
   * Memory reveal — slow, melancholic swell.
   * Played when Rusty discovers a memory fragment.
   */
  memoryReveal() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Low pad chord — Am with sadness
    [[220, 0.0], [261, 0.05], [330, 0.12], [440, 0.22]].forEach(([f, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const vibGain = ctx.createGain();
      vibGain.gain.value = f * 0.008;
      vibrato.connect(vibGain).connect(osc.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + delay);
      env.gain.linearRampToValueAtTime(0.07, t + delay + 0.8);
      env.gain.linearRampToValueAtTime(0.04, t + delay + 2.5);
      env.gain.linearRampToValueAtTime(0.0,  t + delay + 3.5);
      osc.connect(env).connect(this.sfxGain);
      osc.start(t + delay);
      vibrato.start(t + delay);
      osc.stop(t + delay + 3.6);
      vibrato.stop(t + delay + 3.6);
    });

    // Tiny sparkle on top
    setTimeout(() => this._bell(1760, 0.06), 800);
    setTimeout(() => this._bell(2093, 0.04), 1400);
  }

  /**
   * Fear ambience — short cold drone with flutter.
   * Played when entering a dark or threatening area.
   */
  fearAmbience() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(72, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 1.4);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;

    // Tremolo LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9 + Math.random() * 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.12, t + 0.4);
    env.gain.linearRampToValueAtTime(0.0,  t + 1.6);

    lfoGain.connect(env.gain);
    osc.connect(lp).connect(env).connect(this.sfxGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1.8);
    lfo.stop(t + 1.8);
  }

  /**
   * Heartbeat — low mechanical pulse for tension / low battery.
   * @param {number} bpm  Default 58 (slow, tense)
   */
  heartbeat(bpm = 58) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const beat = 60 / bpm;
    // Two-thump pattern: lub–dub
    [0, beat * 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(52 + (offset > 0 ? 8 : 0), t + offset);
      osc.frequency.exponentialRampToValueAtTime(28, t + offset + 0.18);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + offset);
      env.gain.linearRampToValueAtTime(0.3, t + offset + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.20);
      osc.connect(env).connect(this.sfxGain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    });
  }

  /**
   * Hope swell — warm ascending harmonic.
   * Played after emotional milestones (completing a section, etc.)
   */
  hopeSwell() {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Rising Cmaj7 arpeggio
    [261, 329, 392, 494, 659].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const env = ctx.createGain();
      const ts = t + i * 0.12;
      env.gain.setValueAtTime(0, ts);
      env.gain.linearRampToValueAtTime(0.09, ts + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, ts + 1.4 - i * 0.05);
      osc.connect(env).connect(this.sfxGain);
      osc.start(ts);
      osc.stop(ts + 1.5);
    });
  }

  /**
   * Kablo sıyırma / takma — kısa metalik çıtırtı.
   */
  crtCableSnap() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1200, t);
    bp.Q.value = 2.4;

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.06);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.38, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(bp).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.18);

    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.045);
    const ev = this.ctx.createGain();
    ev.gain.setValueAtTime(0.1, t);
    ev.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(ev).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Tek seferlik statik tısırtısı. */
  crtStaticClick() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.035);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.5, t + 0.001);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
    src.connect(hp).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.07);
  }

  crtBootStart() {
    if (!this.started) return;
    this._crtBootStop();
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const hum = ctx.createOscillator();
    hum.type = "triangle";
    hum.frequency.value = 48;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.6;
    const lGain = ctx.createGain();
    lGain.gain.value = 3.8;
    lfo.connect(lGain).connect(hum.frequency);

    const hz = ctx.createOscillator();
    hz.type = "sine";
    hz.frequency.value = 8420;

    const gHz = ctx.createGain();
    gHz.gain.setValueAtTime(0.0, t);
    gHz.gain.linearRampToValueAtTime(0.024, t + 3.8);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.052, t + 3.2);
    g.gain.linearRampToValueAtTime(0.088, t + 11);

    hum.connect(g).connect(this.sfxGain);
    hz.connect(gHz).connect(this.sfxGain);

    hum.start(t);
    lfo.start(t);
    hz.start(t);

    this._crtHumOsc  = hum;
    this._crtHumLfo  = lfo;
    this._crtHumGain = g;
    this._crtHumHzOsc = hz;
    this._crtHumHzGain = gHz;
  }

  crtBootFinish() {
    this._crtBootStop();
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 220;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.085, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(env).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  _crtBootStop() {
    if (!this.ctx) return;
    try {
      this._crtHumHzOsc?.stop(this.ctx.currentTime + 0.02);
      this._crtHumOsc?.stop(this.ctx.currentTime + 0.02);
      this._crtHumLfo?.stop(this.ctx.currentTime + 0.02);
      this._crtHumHzOsc = null;
      this._crtHumOsc = null;
      this._crtHumLfo = null;
      this._crtHumGain = null;
      this._crtHumHzGain = null;
    } catch {
      /* no-op */
    }
  }

  hit() {
    if (!this.started) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 320;
    bp.Q.value = 1.0;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.7, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.24);

    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const oe = this.ctx.createGain();
    oe.gain.setValueAtTime(0, t);
    oe.gain.linearRampToValueAtTime(0.3, t + 0.005);
    oe.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(oe).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  // ----------------------------------------------------------
  //  Internals
  // ----------------------------------------------------------
  _noiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _buildReverb() {
    const input = this.ctx.createGain();
    const output = this.ctx.createGain();
    output.gain.value = 0.22;

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2800;
    lp.connect(output);

    [0.071, 0.097, 0.127, 0.181].forEach((time) => {
      const d = this.ctx.createDelay(0.5);
      d.delayTime.value = time;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.45;
      input.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(lp);
    });

    return { input, output };
  }
}
