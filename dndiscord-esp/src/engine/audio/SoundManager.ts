/**
 * SoundManager — Rich procedural audio engine for DnD tactical RPG
 *
 * Pure Web Audio API synthesis: zero files, zero API calls.
 */

// ============================================
// ADSR ENVELOPE
// ============================================
interface ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  peak?: number;
}

function applyEnvelope(p: AudioParam, t: number, e: ADSR, dur: number): void {
  const pk = e.peak ?? 1;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + e.attack);
  p.linearRampToValueAtTime(pk * e.sustain, t + e.attack + e.decay);
  const rs = t + dur - e.release;
  if (rs > t + e.attack + e.decay) p.setValueAtTime(pk * e.sustain, rs);
  p.linearRampToValueAtTime(0.001, t + dur);
}

// ============================================
// NOTE TABLE
// ============================================
const NF: Record<string, number> = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.5, B2: 123.5,
  C3: 130.8, D3: 146.8, Eb3: 155.6, E3: 164.8, F3: 174.6, 'F#3': 185.0, G3: 196.0,
  Ab3: 207.7, A3: 220.0, Bb3: 233.1, B3: 246.9,
  C4: 261.6, D4: 293.7, Eb4: 311.1, E4: 329.6, F4: 349.2, 'F#4': 370.0, G4: 392.0,
  Ab4: 415.3, A4: 440.0, Bb4: 466.2, B4: 493.9,
  C5: 523.3, D5: 587.3, Eb5: 622.3, E5: 659.3, F5: 698.5, G5: 784.0, A5: 880.0, B5: 987.8,
  C6: 1046.5,
};
function nf(n: string): number { return NF[n] ?? 440; }

// ============================================
// MAIN CLASS
// ============================================
export class SoundManager {
  private ctx: AudioContext;
  private master: GainNode;
  private ambientBus: GainNode;
  private sfxBus: GainNode;
  private uiBus: GainNode;
  private reverb: ConvolverNode;
  private reverbGain: GainNode;
  private dryGain: GainNode;

  private ambientTimers: number[] = [];
  private ambientSources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private ambientMisc: AudioNode[] = [];
  private ambientPlaying = false;
  private currentAmbient: 'menu' | 'exploration' | 'combat' | null = null;

  private _ambientVol = 0.3;
  private _sfxVol = 0.5;
  private _uiVol = 0.4;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.reverbIR(2.8, 0.55);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.85;
    this.dryGain.connect(this.master);

    this.ambientBus = this.gain(this._ambientVol);
    this.ambientBus.connect(this.dryGain);
    this.ambientBus.connect(this.reverb);

    this.sfxBus = this.gain(this._sfxVol);
    this.sfxBus.connect(this.dryGain);
    this.sfxBus.connect(this.reverb);

    this.uiBus = this.gain(this._uiVol);
    this.uiBus.connect(this.dryGain);
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // --- Volume ---
  set ambientVolume(v: number) {
    this._ambientVol = Math.max(0, Math.min(1, v));
    this.ambientBus.gain.setTargetAtTime(this._ambientVol, this.ctx.currentTime, 0.1);
  }
  get ambientVolume() { return this._ambientVol; }

  set sfxVolume(v: number) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    this.sfxBus.gain.setTargetAtTime(this._sfxVol, this.ctx.currentTime, 0.1);
  }
  get sfxVolume() { return this._sfxVol; }

  set uiVolume(v: number) {
    this._uiVol = Math.max(0, Math.min(1, v));
    this.uiBus.gain.setTargetAtTime(this._uiVol, this.ctx.currentTime, 0.1);
  }
  get uiVolume() { return this._uiVol; }

  // ============================================
  // LOW-LEVEL HELPERS
  // ============================================
  private gain(v = 1): GainNode { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  private reverbIR(dur: number, decay: number): AudioBuffer {
    const r = this.ctx.sampleRate, len = Math.floor(r * dur);
    const buf = this.ctx.createBuffer(2, len, r);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 3);
    }
    return buf;
  }

  private white(dur: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private pink(dur: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  private bp(freq: number, q = 1): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; return f;
  }
  private lp(freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; return f;
  }
  private hp(freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; f.Q.value = q; return f;
  }

  private note(freq: number, t: number, dur: number, dest: AudioNode,
    type: OscillatorType = 'sine',
    env: ADSR = { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.15, peak: 0.2 }
  ): OscillatorNode {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    applyEnvelope(g.gain, t, env, dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.01);
    return o;
  }

  private chord(notes: string[], t: number, dur: number, dest: AudioNode,
    type: OscillatorType = 'sine', env?: ADSR, detune = 3): void {
    notes.forEach((n, i) => {
      const o = this.note(nf(n), t, dur, dest, type,
        env ?? { attack: 0.08, decay: 0.3, sustain: 0.4, release: 0.5, peak: 0.12 / notes.length });
      o.detune.value = (i - notes.length / 2) * detune;
    });
  }

  private arp(notes: string[], t: number, dur: number, gap: number, dest: AudioNode,
    type: OscillatorType = 'sine', env?: ADSR): void {
    notes.forEach((n, i) => {
      this.note(nf(n), t + i * gap, dur, dest, type,
        env ?? { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2, peak: 0.15 });
    });
  }

  private noiseBurst(t: number, dur: number, vol: number, dest: AudioNode, filter?: BiquadFilterNode): void {
    const s = this.ctx.createBufferSource(); s.buffer = this.white(dur);
    const g = this.gain(0);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    if (filter) { s.connect(filter).connect(g).connect(dest); }
    else { s.connect(g).connect(dest); }
    s.start(t);
  }

  // Distortion curve helper
  private distort(amount = 4): WaveShaperNode {
    const ws = this.ctx.createWaveShaper();
    const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) c[i] = Math.tanh(((i / 128) - 1) * amount);
    ws.curve = c;
    return ws;
  }

  // ============================================
  // AMBIENT MUSIC
  // ============================================
  startAmbient(mode: 'menu' | 'exploration' | 'combat'): void {
    if (this.currentAmbient === mode && this.ambientPlaying) return;
    this.stopAmbient();
    this.currentAmbient = mode;
    this.ambientPlaying = true;
    const now = this.ctx.currentTime;
    this.ambientBus.gain.setValueAtTime(0, now);
    this.ambientBus.gain.linearRampToValueAtTime(this._ambientVol, now + 2.5);
    if (mode === 'menu') this.loopMenu();
    else if (mode === 'exploration') this.loopExplore();
    else this.loopCombat();
  }

  stopAmbient(): void {
    this.ambientTimers.forEach(t => clearTimeout(t));
    this.ambientTimers = [];
    this.ambientSources.forEach(s => { try { s.stop(); s.disconnect(); } catch { /* */ } });
    this.ambientSources = [];
    this.ambientMisc.forEach(n => { try { n.disconnect(); } catch { /* */ } });
    this.ambientMisc = [];
    this.ambientPlaying = false;
    this.currentAmbient = null;
  }

  // ---------- MENU ----------
  private loopMenu(): void {
    const bpm = 48, beat = 60 / bpm, bar = beat * 4;
    const chords = [['A3','C4','E4'],['F3','A3','C4'],['C3','E3','G3'],['G3','B3','D4']];
    const arps = [
      ['A3','C4','E4','A4','E4','C4'],['F3','A3','C4','F4','C4','A3'],
      ['C3','E3','G3','C4','G3','E3'],['G3','B3','D4','G4','D4','B3']
    ];
    const mel = [['E5','C5'],['A4','F4'],['G4','E4'],['D5','B4']];
    const loop = bar * 4;
    const sched = () => {
      if (!this.ambientPlaying || this.currentAmbient !== 'menu') return;
      const now = this.ctx.currentTime;
      const pad = this.lp(750, 0.7); pad.connect(this.ambientBus); this.ambientMisc.push(pad);
      chords.forEach((ch, i) => this.chord(ch, now + i * bar, bar * 0.92, pad, 'triangle',
        { attack: 0.6, decay: 0.4, sustain: 0.45, release: 1.2, peak: 0.07 }));
      const ahp = this.hp(250); ahp.connect(this.ambientBus); this.ambientMisc.push(ahp);
      arps.forEach((ns, i) => this.arp(ns, now + i * bar + beat * 0.25, beat * 0.7, beat * 0.5, ahp, 'sine',
        { attack: 0.008, decay: 0.12, sustain: 0.15, release: 0.25, peak: 0.09 }));
      mel.forEach((pair, i) => pair.forEach((n, j) => {
        if (NF[n]) {
          this.note(nf(n), now + i * bar + j * beat * 2, beat * 1.6, this.ambientBus, 'sine',
            { attack: 0.08, decay: 0.2, sustain: 0.25, release: 0.5, peak: 0.055 });
          const o2 = this.note(nf(n) * 1.003, now + i * bar + j * beat * 2, beat * 1.6, this.ambientBus, 'sine',
            { attack: 0.08, decay: 0.2, sustain: 0.25, release: 0.5, peak: 0.035 });
          o2.detune.value = 5;
        }
      }));
      chords.forEach((ch, i) => {
        const root = ch[0].replace(/\d/, '2');
        if (NF[root]) this.note(nf(root), now + i * bar, bar * 0.85, this.ambientBus, 'sine',
          { attack: 0.4, decay: 0.3, sustain: 0.45, release: 0.6, peak: 0.055 });
      });
      const ns = this.ctx.createBufferSource(); ns.buffer = this.pink(loop + 1);
      const ng = this.gain(0.01); const nlp = this.lp(450);
      ns.connect(nlp).connect(ng).connect(this.ambientBus);
      ns.start(now); this.ambientSources.push(ns); this.ambientMisc.push(ng, nlp);
      this.ambientTimers.push(window.setTimeout(() => sched(), (loop - 0.5) * 1000));
    };
    sched();
  }

  // ---------- EXPLORATION ----------
  private loopExplore(): void {
    const bpm = 56, beat = 60 / bpm, bar = beat * 4;
    const chords = [['D3','F3','A3'],['Bb3','D4','F4'],['G3','Bb3','D4'],['A3','C4','E4']];
    const mels: (string | null)[][] = [
      ['D4',null,'F4','A4'],['Bb4',null,'A4','G4'],['G4','Bb4',null,'A4'],['E4',null,'C4','D4']
    ];
    const loop = bar * 4;
    const sched = () => {
      if (!this.ambientPlaying || this.currentAmbient !== 'exploration') return;
      const now = this.ctx.currentTime;
      const pad = this.lp(550, 1.2); pad.connect(this.ambientBus); this.ambientMisc.push(pad);
      chords.forEach((ch, i) => {
        this.chord(ch, now + i * bar, bar * 0.9, pad, 'triangle',
          { attack: 0.7, decay: 0.5, sustain: 0.4, release: 1.0, peak: 0.065 });
        const low = ch[0].replace(/\d/, '2');
        if (NF[low]) this.note(nf(low), now + i * bar, bar * 0.85, pad, 'sine',
          { attack: 0.5, decay: 0.3, sustain: 0.5, release: 0.7, peak: 0.05 });
      });
      mels.forEach((b, bi) => b.forEach((n, ni) => {
        if (n && NF[n]) {
          const t = now + bi * bar + ni * beat;
          this.note(nf(n), t, beat * 0.85, this.ambientBus, 'sine',
            { attack: 0.04, decay: 0.15, sustain: 0.2, release: 0.3, peak: 0.07 });
          this.note(nf(n) * 2.001, t, beat * 0.6, this.ambientBus, 'sine',
            { attack: 0.06, decay: 0.1, sustain: 0.1, release: 0.2, peak: 0.02 });
        }
      }));
      const rm = this.ctx.createBufferSource(); rm.buffer = this.pink(loop + 1);
      const rg = this.gain(0.018); const rlp = this.lp(180);
      rm.connect(rlp).connect(rg).connect(this.ambientBus);
      rm.start(now); this.ambientSources.push(rm); this.ambientMisc.push(rg, rlp);
      for (let i = 0; i < 6; i++) {
        const t = now + Math.random() * loop;
        const dr = this.ctx.createOscillator(); dr.type = 'sine';
        dr.frequency.value = 2000 + Math.random() * 2000;
        const dg = this.gain(0);
        dg.gain.setValueAtTime(0, t);
        dg.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.02, t + 0.002);
        dg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        dr.connect(dg).connect(this.ambientBus); dr.start(t); dr.stop(t + 0.1);
      }
      this.ambientTimers.push(window.setTimeout(() => sched(), (loop - 0.5) * 1000));
    };
    sched();
  }

  // ---------- COMBAT ----------
  private loopCombat(): void {
    const bpm = 105, beat = 60 / bpm, bar = beat * 4;
    const chords = [['E3','G3','B3'],['C3','E3','G3'],['D3','F3','A3'],['B2','D3','F3']];
    const loop = bar * 4;
    const sched = () => {
      if (!this.ambientPlaying || this.currentAmbient !== 'combat') return;
      const now = this.ctx.currentTime;
      for (let b = 0; b < 4; b++) {
        const bs = now + b * bar;
        this.kick(bs); this.kick(bs + beat * 2);
        this.snare(bs + beat); this.snare(bs + beat * 3);
        for (let i = 0; i < 8; i++) this.hihat(bs + i * beat * 0.5, i % 2 === 0 ? 0.035 : 0.018);
        if (b === 3) { this.tom(bs + beat * 3, 120); this.tom(bs + beat * 3.25, 100); this.tom(bs + beat * 3.5, 80); this.tom(bs + beat * 3.75, 65); }
      }
      const clp = this.lp(1100, 1.5); clp.connect(this.ambientBus); this.ambientMisc.push(clp);
      chords.forEach((ch, i) => this.chord(ch, now + i * bar, bar * 0.82, clp, 'sawtooth',
        { attack: 0.04, decay: 0.2, sustain: 0.32, release: 0.25, peak: 0.05 }, 6));
      chords.forEach((ch, bi) => {
        const rf = nf(ch[0]) * 0.5;
        for (let i = 0; i < 8; i++) {
          const t = now + bi * bar + i * beat * 0.5;
          this.note(rf, t, beat * 0.35, this.ambientBus, 'sawtooth',
            { attack: 0.008, decay: 0.04, sustain: 0.35, release: 0.08, peak: i % 4 === 0 ? 0.065 : 0.04 });
        }
      });
      for (let bi = 2; bi < 4; bi++) {
        chords[bi].forEach(n => { if (!NF[n]) return;
          for (let i = 0; i < 16; i++) {
            const t = now + bi * bar + i * beat * 0.25;
            this.note(nf(n) * 2, t, beat * 0.18, this.ambientBus, 'sine',
              { attack: 0.003, decay: 0.015, sustain: 0.25, release: 0.04, peak: 0.02 });
          }
        });
      }
      [0, 2].forEach(bi => {
        const t = now + bi * bar;
        this.chord(chords[bi], t, beat * 0.6, this.ambientBus, 'square',
          { attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.15, peak: 0.03 }, 8);
      });
      this.ambientTimers.push(window.setTimeout(() => sched(), (loop - 0.4) * 1000));
    };
    sched();
  }

  // ============================================
  // PERCUSSION (for combat music)
  // ============================================
  private kick(t: number): void {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.14);
    const g = this.gain(0); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.ambientBus); o.start(t); o.stop(t + 0.28);
    this.noiseBurst(t, 0.01, 0.1, this.ambientBus, this.hp(3000));
  }
  private snare(t: number): void {
    this.noiseBurst(t, 0.16, 0.16, this.ambientBus, this.hp(1800));
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 210;
    const g = this.gain(0); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this.ambientBus); o.start(t); o.stop(t + 0.07);
  }
  private hihat(t: number, vol = 0.03): void {
    this.noiseBurst(t, 0.04, vol, this.ambientBus, this.bp(9000, 1.5));
  }
  private tom(t: number, f: number): void {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.2);
    const g = this.gain(0); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.ambientBus); o.start(t); o.stop(t + 0.22);
  }

  // ============================================
  // COMBAT SFX
  // ============================================

  /** Sword slash — swoosh + metallic clang + body thud + armor rattle */
  playSwordHit(): void {
    this.resume();
    const now = this.ctx.currentTime;

    // Fast swoosh (rising bandpass sweep)
    const sw = this.ctx.createBufferSource(); sw.buffer = this.white(0.25);
    const swg = this.gain(0); swg.gain.setValueAtTime(0.28, now); swg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const swf = this.bp(400, 1.2);
    swf.frequency.setValueAtTime(400, now); swf.frequency.exponentialRampToValueAtTime(6000, now + 0.1);
    sw.connect(swf).connect(swg).connect(this.sfxBus); sw.start(now);

    // Metal clang (inharmonic partials — bell-like)
    [1900, 2850, 3700, 4500, 5800].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f + (Math.random() - 0.5) * 50;
      const g = this.gain(0); const t = now + 0.03;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08 / (i + 1), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12 + i * 0.045);
      o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.3);
    });

    // Body thud (low sweep)
    const th = this.ctx.createOscillator(); th.type = 'sine';
    th.frequency.setValueAtTime(120, now + 0.035); th.frequency.exponentialRampToValueAtTime(35, now + 0.2);
    const tg = this.gain(0); tg.gain.setValueAtTime(0.22, now + 0.035); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    th.connect(tg).connect(this.sfxBus); th.start(now + 0.035); th.stop(now + 0.25);

    // Armor rattle (short noise flutter)
    for (let i = 0; i < 4; i++) {
      const t = now + 0.06 + i * 0.025;
      this.noiseBurst(t, 0.015, 0.06 - i * 0.012, this.sfxBus, this.bp(3500 + i * 800, 2));
    }
  }

  /** Shield bash — heavy thud + wooden crack + bass boom */
  playShieldBash(): void {
    this.resume();
    const now = this.ctx.currentTime;

    // Heavy thunk
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    const g = this.gain(0); g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g).connect(this.sfxBus); o.start(now); o.stop(now + 0.25);

    // Wooden crack
    this.noiseBurst(now + 0.01, 0.04, 0.25, this.sfxBus, this.bp(1200, 3));
    // Secondary crack
    this.noiseBurst(now + 0.03, 0.025, 0.12, this.sfxBus, this.bp(2500, 2));

    // Bass boom
    const sub = this.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 40;
    const sg = this.gain(0); sg.gain.setValueAtTime(0.2, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sub.connect(sg).connect(this.sfxBus); sub.start(now); sub.stop(now + 0.35);

    // Rattle
    this.noiseBurst(now + 0.05, 0.08, 0.08, this.sfxBus, this.bp(4000, 5));
  }

  /** Arrow shot — bow twang + whoosh + thud impact */
  playArrowShot(): void {
    this.resume();
    const now = this.ctx.currentTime;

    // Bow string twang (plucked string simulation)
    const tw = this.ctx.createOscillator(); tw.type = 'triangle';
    tw.frequency.setValueAtTime(220, now); tw.frequency.exponentialRampToValueAtTime(85, now + 0.35);
    const tg = this.gain(0); tg.gain.setValueAtTime(0.2, now); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    tw.connect(tg).connect(this.sfxBus); tw.start(now); tw.stop(now + 0.35);
    // String overtone
    const ov = this.ctx.createOscillator(); ov.type = 'sine';
    ov.frequency.setValueAtTime(660, now); ov.frequency.exponentialRampToValueAtTime(250, now + 0.2);
    const og = this.gain(0); og.gain.setValueAtTime(0.1, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    ov.connect(og).connect(this.sfxBus); ov.start(now); ov.stop(now + 0.25);

    // Arrow whoosh (narrowing bandpass sweep — Doppler-ish)
    const ws = this.ctx.createBufferSource(); ws.buffer = this.white(0.35);
    const wg = this.gain(0);
    wg.gain.setValueAtTime(0, now + 0.05);
    wg.gain.linearRampToValueAtTime(0.22, now + 0.12);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    const wf = this.bp(500, 0.8);
    wf.frequency.setValueAtTime(500, now + 0.05);
    wf.frequency.exponentialRampToValueAtTime(4500, now + 0.2);
    wf.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
    ws.connect(wf).connect(wg).connect(this.sfxBus); ws.start(now + 0.05);

    // Impact thud (arrow sticking into target)
    const imp = this.ctx.createOscillator(); imp.type = 'sine';
    imp.frequency.setValueAtTime(90, now + 0.3); imp.frequency.exponentialRampToValueAtTime(35, now + 0.42);
    const ig = this.gain(0); ig.gain.setValueAtTime(0.22, now + 0.3); ig.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    imp.connect(ig).connect(this.sfxBus); imp.start(now + 0.3); imp.stop(now + 0.45);

    // Wood snap on impact
    this.noiseBurst(now + 0.3, 0.02, 0.15, this.sfxBus, this.bp(2200, 4));
    // Arrow vibration after impact
    const vib = this.ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 350;
    vib.frequency.setValueAtTime(350, now + 0.32); vib.frequency.exponentialRampToValueAtTime(180, now + 0.55);
    const vg = this.gain(0); vg.gain.setValueAtTime(0.04, now + 0.32); vg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    vib.connect(vg).connect(this.sfxBus); vib.start(now + 0.32); vib.stop(now + 0.6);
  }

  /** Claw attack — swiping whoosh + tearing sound + fleshy thud */
  playClawAttack(): void {
    this.resume();
    const now = this.ctx.currentTime;

    // Fast swipe (high-pass noise sweep)
    const sw = this.ctx.createBufferSource(); sw.buffer = this.white(0.15);
    const sg = this.gain(0); sg.gain.setValueAtTime(0.2, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    const sf = this.hp(2000);
    sf.frequency.setValueAtTime(2000, now); sf.frequency.exponentialRampToValueAtTime(6000, now + 0.08);
    sw.connect(sf).connect(sg).connect(this.sfxBus); sw.start(now);

    // Tearing scrape (3 quick noise flicks)
    for (let i = 0; i < 3; i++) {
      const t = now + 0.02 + i * 0.03;
      this.noiseBurst(t, 0.02, 0.14 - i * 0.03, this.sfxBus, this.bp(4000 + i * 1200, 5));
    }

    // Fleshy thud
    const th = this.ctx.createOscillator(); th.type = 'sine';
    th.frequency.setValueAtTime(95, now + 0.08); th.frequency.exponentialRampToValueAtTime(28, now + 0.2);
    const tg = this.gain(0); tg.gain.setValueAtTime(0.18, now + 0.08); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    th.connect(tg).connect(this.sfxBus); th.start(now + 0.08); th.stop(now + 0.25);
  }

  // ---------- SPELL CASTS (per damage type) ----------

  playSpellCast(damageType: string): void {
    this.resume();
    const now = this.ctx.currentTime;
    const t = damageType.toLowerCase();
    if (t === 'fire') this.castFire(now);
    else if (t === 'ice') this.castIce(now);
    else if (t === 'lightning') this.castLightning(now);
    else if (t === 'holy') this.castHoly(now);
    else if (t === 'dark') this.castDark(now);
    else this.castGeneric(now);
  }

  private castFire(now: number): void {
    // Charging swirl
    const swirl = this.ctx.createOscillator(); swirl.type = 'sawtooth';
    swirl.frequency.setValueAtTime(50, now); swirl.frequency.exponentialRampToValueAtTime(400, now + 0.25);
    const sg = this.gain(0); sg.gain.setValueAtTime(0, now); sg.gain.linearRampToValueAtTime(0.09, now + 0.15);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    const slp = this.lp(600); swirl.connect(slp).connect(sg).connect(this.sfxBus);
    swirl.start(now); swirl.stop(now + 0.35);

    // FIREBALL EXPLOSION — big noise burst with rising then falling filter
    const fb = this.ctx.createBufferSource(); fb.buffer = this.white(1.2);
    const fg = this.gain(0); fg.gain.setValueAtTime(0, now + 0.2);
    fg.gain.linearRampToValueAtTime(0.28, now + 0.28);
    fg.gain.setValueAtTime(0.28, now + 0.35);
    fg.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    const fbp = this.bp(800, 2.5);
    fbp.frequency.setValueAtTime(800, now + 0.2);
    fbp.frequency.linearRampToValueAtTime(4000, now + 0.35);
    fbp.frequency.exponentialRampToValueAtTime(400, now + 1.1);
    fb.connect(fbp).connect(fg).connect(this.sfxBus); fb.start(now + 0.2);

    // Deep boom
    const boom = this.ctx.createOscillator(); boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now + 0.25); boom.frequency.exponentialRampToValueAtTime(20, now + 0.7);
    const bg = this.gain(0); bg.gain.setValueAtTime(0.25, now + 0.25); bg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    boom.connect(bg).connect(this.sfxBus); boom.start(now + 0.25); boom.stop(now + 0.75);

    // Crackle tail
    const crk = this.ctx.createBufferSource(); crk.buffer = this.white(0.8);
    const cg = this.gain(0); cg.gain.setValueAtTime(0.08, now + 0.35); cg.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    const cbp = this.bp(3000, 4);
    crk.connect(cbp).connect(cg).connect(this.sfxBus); crk.start(now + 0.35);

    // Rising fire whoosh
    this.note(200, now + 0.2, 0.35, this.sfxBus, 'sine',
      { attack: 0.01, decay: 0.06, sustain: 0.3, release: 0.2, peak: 0.12 });
  }

  private castIce(now: number): void {
    // Crystalline shimmer cascade
    [2200, 2800, 3400, 4200, 5000, 5800].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f + (Math.random() - 0.5) * 80;
      const g = this.gain(0); const d = i * 0.035;
      g.gain.setValueAtTime(0, now + d); g.gain.linearRampToValueAtTime(0.07, now + d + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + d);
      o.connect(g).connect(this.sfxBus); o.start(now + d); o.stop(now + 0.65);
    });
    // Ice cracking
    this.noiseBurst(now + 0.12, 0.05, 0.18, this.sfxBus, this.hp(4500));
    this.noiseBurst(now + 0.18, 0.03, 0.1, this.sfxBus, this.hp(5500));
    // Deep freeze impact
    const fr = this.ctx.createOscillator(); fr.type = 'sine';
    fr.frequency.setValueAtTime(75, now + 0.08); fr.frequency.exponentialRampToValueAtTime(25, now + 0.45);
    const fg = this.gain(0); fg.gain.setValueAtTime(0.15, now + 0.08); fg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    fr.connect(fg).connect(this.sfxBus); fr.start(now + 0.08); fr.stop(now + 0.5);
    // Wind howl
    const wn = this.ctx.createBufferSource(); wn.buffer = this.pink(0.7);
    const wg = this.gain(0); wg.gain.setValueAtTime(0, now); wg.gain.linearRampToValueAtTime(0.06, now + 0.15);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    const wf = this.bp(600, 6); wn.connect(wf).connect(wg).connect(this.sfxBus); wn.start(now);
  }

  private castLightning(now: number): void {
    // Electric crackles
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.04 + Math.random() * 0.02;
      this.noiseBurst(t, 0.035, 0.3 - i * 0.04, this.sfxBus, this.bp(2500 + Math.random() * 4000, 5));
    }
    // Electric buzz (distorted sawtooth)
    const bz = this.ctx.createOscillator(); bz.type = 'sawtooth'; bz.frequency.value = 55;
    const bg = this.gain(0); bg.gain.setValueAtTime(0.14, now); bg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bz.connect(this.distort(6)).connect(bg).connect(this.sfxBus); bz.start(now); bz.stop(now + 0.45);
    // ZAP (fast frequency sweep)
    const zp = this.ctx.createOscillator(); zp.type = 'square';
    zp.frequency.setValueAtTime(4000, now); zp.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    const zg = this.gain(0); zg.gain.setValueAtTime(0.08, now); zg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    zp.connect(zg).connect(this.sfxBus); zp.start(now); zp.stop(now + 0.2);
    // Thunder rumble
    const th = this.ctx.createBufferSource(); th.buffer = this.pink(0.7);
    const tg = this.gain(0); tg.gain.setValueAtTime(0.22, now + 0.05); tg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    th.connect(this.lp(350)).connect(tg).connect(this.sfxBus); th.start(now + 0.05);
  }

  private castHoly(now: number): void {
    // Angelic choir chord (layered, detuned)
    ['C5','E5','G5','C6'].forEach((n, i) => {
      const t = now + i * 0.06;
      this.note(nf(n), t, 1.0, this.sfxBus, 'sine', { attack: 0.08, decay: 0.2, sustain: 0.45, release: 0.4, peak: 0.09 });
      this.note(nf(n) * 1.004, t, 1.0, this.sfxBus, 'sine', { attack: 0.08, decay: 0.2, sustain: 0.45, release: 0.4, peak: 0.055 });
    });
    // Shimmer dust
    const sh = this.ctx.createBufferSource(); sh.buffer = this.white(1.2);
    const sg = this.gain(0); sg.gain.setValueAtTime(0, now); sg.gain.linearRampToValueAtTime(0.04, now + 0.2);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    sh.connect(this.hp(6500)).connect(sg).connect(this.sfxBus); sh.start(now);
    // Rising harp glissando
    ['C4','E4','G4','C5','E5'].forEach((n, i) => {
      this.note(nf(n), now + 0.05 + i * 0.06, 0.3, this.sfxBus, 'triangle',
        { attack: 0.005, decay: 0.06, sustain: 0.15, release: 0.12, peak: 0.06 });
    });
  }

  private castDark(now: number): void {
    // Deep growl
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(42, now); o.frequency.linearRampToValueAtTime(22, now + 0.9);
    const g = this.gain(0); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.18, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    o.connect(this.lp(180)).connect(g).connect(this.sfxBus); o.start(now); o.stop(now + 0.95);
    // Dissonant tritone
    this.note(nf('E3'), now + 0.08, 0.65, this.sfxBus, 'sawtooth', { attack: 0.04, decay: 0.12, sustain: 0.25, release: 0.3, peak: 0.06 });
    this.note(nf('Bb3'), now + 0.08, 0.65, this.sfxBus, 'sawtooth', { attack: 0.04, decay: 0.12, sustain: 0.25, release: 0.3, peak: 0.06 });
    // Ghost whisper
    const wp = this.ctx.createBufferSource(); wp.buffer = this.pink(0.9);
    const wg = this.gain(0); wg.gain.setValueAtTime(0, now); wg.gain.linearRampToValueAtTime(0.08, now + 0.2);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    wp.connect(this.bp(700, 7)).connect(wg).connect(this.sfxBus); wp.start(now);
    // Demonic rumble
    const rm = this.ctx.createBufferSource(); rm.buffer = this.pink(0.6);
    const rg = this.gain(0); rg.gain.setValueAtTime(0.1, now + 0.1); rg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    rm.connect(this.lp(120)).connect(rg).connect(this.sfxBus); rm.start(now + 0.1);
  }

  private castGeneric(now: number): void {
    // Magic sparkle sweep
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(280, now); o.frequency.exponentialRampToValueAtTime(1300, now + 0.2);
    o.frequency.exponentialRampToValueAtTime(550, now + 0.55);
    const g = this.gain(0); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.18, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o.connect(g).connect(this.sfxBus); o.start(now); o.stop(now + 0.6);
    this.note(900, now + 0.03, 0.4, this.sfxBus, 'triangle', { attack: 0.015, decay: 0.1, sustain: 0.15, release: 0.15, peak: 0.08 });
    this.note(1350, now + 0.06, 0.3, this.sfxBus, 'sine', { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.1, peak: 0.04 });
    // Additional arcane whoosh
    const wh = this.ctx.createBufferSource(); wh.buffer = this.white(0.3);
    const whg = this.gain(0); whg.gain.setValueAtTime(0.08, now + 0.05); whg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    const whf = this.bp(1500, 3);
    whf.frequency.setValueAtTime(1500, now + 0.05); whf.frequency.exponentialRampToValueAtTime(5000, now + 0.15);
    wh.connect(whf).connect(whg).connect(this.sfxBus); wh.start(now + 0.05);
  }

  /** Damage impact — heavy thud + crunchy noise */
  playImpact(): void {
    this.resume();
    const now = this.ctx.currentTime;
    // Body thump
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(125, now); o.frequency.exponentialRampToValueAtTime(28, now + 0.16);
    const g = this.gain(0); g.gain.setValueAtTime(0.38, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.connect(g).connect(this.sfxBus); o.start(now); o.stop(now + 0.22);
    // Crack
    this.noiseBurst(now, 0.07, 0.22, this.sfxBus, this.bp(1500, 0.8));
    // Sub
    const sub = this.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 45;
    const sg = this.gain(0); sg.gain.setValueAtTime(0.14, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    sub.connect(sg).connect(this.sfxBus); sub.start(now); sub.stop(now + 0.3);
    // Crunch
    this.noiseBurst(now + 0.02, 0.03, 0.12, this.sfxBus, this.bp(3500, 3));
  }

  /** Unit death — dramatic descend + death rattle */
  playDeath(): void {
    this.resume();
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, now); o.frequency.exponentialRampToValueAtTime(55, now + 1.1);
    const g = this.gain(0); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.13, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    const flp = this.lp(2200); flp.frequency.setValueAtTime(2200, now); flp.frequency.exponentialRampToValueAtTime(120, now + 1.1);
    o.connect(flp).connect(g).connect(this.sfxBus); o.start(now); o.stop(now + 1.15);
    // Rattle
    const r = this.ctx.createBufferSource(); r.buffer = this.pink(0.9);
    const rg = this.gain(0); rg.gain.setValueAtTime(0, now + 0.15); rg.gain.linearRampToValueAtTime(0.09, now + 0.25);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    const rbp = this.bp(1100, 3); rbp.frequency.setValueAtTime(1100, now + 0.15); rbp.frequency.exponentialRampToValueAtTime(180, now + 0.9);
    r.connect(rbp).connect(rg).connect(this.sfxBus); r.start(now + 0.15);
    // Sad chord
    ['E3','G3','B3'].forEach(n => this.note(nf(n), now + 0.04, 0.85, this.sfxBus, 'triangle',
      { attack: 0.02, decay: 0.2, sustain: 0.18, release: 0.4, peak: 0.05 }));
  }

  // ============================================
  // MOVEMENT SFX
  // ============================================

  /** Double footstep with armor jingle */
  playFootstep(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.step(now);
    this.step(now + 0.17);
    // Light armor jingle between steps
    this.noiseBurst(now + 0.09, 0.03, 0.025, this.sfxBus, this.bp(6000, 6));
  }

  private step(t: number): void {
    const n = this.ctx.createBufferSource(); n.buffer = this.white(0.06);
    const g = this.gain(0); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    n.connect(this.lp(550 + Math.random() * 250)).connect(g).connect(this.sfxBus); n.start(t);
    // Thump
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(75 + Math.random() * 25, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.1);
    const og = this.gain(0); og.gain.setValueAtTime(0.1, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.sfxBus); o.start(t); o.stop(t + 0.1);
    // Ground scrape
    this.noiseBurst(t + 0.025, 0.02, 0.04, this.sfxBus, this.hp(1800));
  }

  // ============================================
  // DICE ROLLING
  // ============================================

  /** Realistic dice roll — multiple bouncing clacks that slow down */
  playDiceRoll(): void {
    this.resume();
    const now = this.ctx.currentTime;
    // Initial throw swoosh
    const sw = this.ctx.createBufferSource(); sw.buffer = this.white(0.18);
    const sg = this.gain(0); sg.gain.setValueAtTime(0.12, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    sw.connect(this.bp(1200, 1)).connect(sg).connect(this.uiBus); sw.start(now);

    // Multiple bounce clacks — faster at start, slowing down (like a real d20 tumbling)
    const bounces = [0.12, 0.22, 0.30, 0.37, 0.43, 0.48, 0.53, 0.57, 0.61, 0.65, 0.69, 0.74, 0.80, 0.88, 0.98, 1.1, 1.25];
    bounces.forEach((offset, i) => {
      const t = now + offset;
      const vol = 0.18 - i * 0.008; // Getting quieter
      if (vol <= 0.01) return;
      const baseF = 3000 + Math.random() * 2500 - i * 80;

      // Hard click (dice hitting surface)
      this.noiseBurst(t, 0.008 + Math.random() * 0.006, vol, this.uiBus, this.bp(baseF, 8));

      // Tonal ping (plastic/resin resonance)
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = 1800 + Math.random() * 1500;
      const og = this.gain(0); og.gain.setValueAtTime(vol * 0.35, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.connect(og).connect(this.uiBus); o.start(t); o.stop(t + 0.04);
    });

    // Table surface resonance (subtle low rumble during first bounces)
    const rm = this.ctx.createBufferSource(); rm.buffer = this.pink(0.5);
    const rg = this.gain(0); rg.gain.setValueAtTime(0.04, now + 0.12); rg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    rm.connect(this.lp(200)).connect(rg).connect(this.uiBus); rm.start(now + 0.12);

    // Final settle — one last definitive clack
    const ft = now + 1.35;
    this.noiseBurst(ft, 0.012, 0.14, this.uiBus, this.bp(3800, 6));
    const fo = this.ctx.createOscillator(); fo.type = 'sine'; fo.frequency.value = 2200;
    const fg = this.gain(0); fg.gain.setValueAtTime(0.06, ft); fg.gain.exponentialRampToValueAtTime(0.001, ft + 0.05);
    fo.connect(fg).connect(this.uiBus); fo.start(ft); fo.stop(ft + 0.06);
  }

  // ============================================
  // ANIMAL CROSSING–STYLE BABBLE VOICE
  // ============================================

  /** Plays a cute babble voice for a text message — syllable count based on text length */
  playBabbleVoice(text: string, pitch: 'low' | 'mid' | 'high' = 'mid'): void {
    this.resume();
    const now = this.ctx.currentTime;

    // Base frequency range by "voice type"
    const baseFreqs = {
      low: [120, 160, 140, 130, 155, 145, 135, 150],
      mid: [220, 260, 240, 250, 230, 270, 245, 255],
      high: [330, 380, 350, 360, 340, 370, 355, 365],
    };
    const freqs = baseFreqs[pitch];

    // Calculate syllable count from text (roughly 1 syllable per 2–3 chars, max ~20)
    const syllables = Math.min(Math.max(Math.ceil(text.length / 2.5), 2), 22);
    const syllableDur = 0.065;
    const gap = 0.03;
    const wordGap = 0.09;

    let t = now;
    let charIndex = 0;

    for (let i = 0; i < syllables; i++) {
      // Pick frequency based on character (deterministic per character for consistency)
      const ch = text.charCodeAt(charIndex % text.length) || 65;
      const f = freqs[ch % freqs.length] + (ch % 30) - 15;
      charIndex += 2;

      // Slight randomization for natural feel
      const fVar = f * (0.95 + Math.random() * 0.1);
      const durVar = syllableDur * (0.8 + Math.random() * 0.4);

      // Main vowel tone
      const o = this.ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(fVar, t);
      o.frequency.linearRampToValueAtTime(fVar * (0.9 + Math.random() * 0.2), t + durVar);
      const g = this.gain(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.008);
      g.gain.setValueAtTime(0.11, t + durVar * 0.6);
      g.gain.linearRampToValueAtTime(0.001, t + durVar);
      // Lowpass to soften square wave — like a tiny mouth
      const flp = this.lp(fVar * 3);
      o.connect(flp).connect(g).connect(this.uiBus);
      o.start(t); o.stop(t + durVar + 0.01);

      // Formant layer (higher, softer — gives "voice" texture)
      const f2 = this.ctx.createOscillator(); f2.type = 'sine';
      f2.frequency.value = fVar * 2.5 + (ch % 200);
      const fg = this.gain(0);
      fg.gain.setValueAtTime(0, t);
      fg.gain.linearRampToValueAtTime(0.04, t + 0.006);
      fg.gain.exponentialRampToValueAtTime(0.001, t + durVar * 0.7);
      f2.connect(fg).connect(this.uiBus);
      f2.start(t); f2.stop(t + durVar + 0.01);

      // Advance time
      t += durVar + gap;
      // Add word gap at spaces (or roughly every 4-5 syllables)
      if (text[charIndex - 1] === ' ' || (i > 0 && i % 4 === 0)) {
        t += wordGap;
      }
    }
  }

  // ============================================
  // UI SFX
  // ============================================

  /** Turn start bell */
  playTurnStart(): void {
    this.resume();
    const now = this.ctx.currentTime;
    ['C5','E5'].forEach((n, i) => {
      const t = now + i * 0.11;
      this.note(nf(n), t, 0.4, this.uiBus, 'sine', { attack: 0.004, decay: 0.08, sustain: 0.3, release: 0.2, peak: 0.22 });
      this.note(nf(n) * 2, t, 0.3, this.uiBus, 'sine', { attack: 0.004, decay: 0.06, sustain: 0.12, release: 0.15, peak: 0.07 });
    });
  }

  /** New round fanfare */
  playNewRound(): void {
    this.resume();
    const now = this.ctx.currentTime;
    ['G4','B4','D5','G5'].forEach((n, i) => {
      const t = now + i * 0.085;
      this.note(nf(n), t, 0.35, this.uiBus, 'triangle', { attack: 0.004, decay: 0.07, sustain: 0.35, release: 0.12, peak: 0.18 });
    });
    ['G4','B4','D5'].forEach(n =>
      this.note(nf(n), now + 0.34, 0.55, this.uiBus, 'sine', { attack: 0.03, decay: 0.1, sustain: 0.25, release: 0.25, peak: 0.07 }));
  }

  /** Tile/unit select — satisfying click + high chime */
  playSelect(): void {
    this.resume();
    const now = this.ctx.currentTime;
    // Click pop
    this.noiseBurst(now, 0.008, 0.12, this.uiBus, this.bp(4000, 5));
    // Chime
    this.note(1200, now + 0.005, 0.1, this.uiBus, 'sine', { attack: 0.002, decay: 0.025, sustain: 0.12, release: 0.05, peak: 0.14 });
    this.note(1800, now + 0.02, 0.07, this.uiBus, 'sine', { attack: 0.002, decay: 0.015, sustain: 0.06, release: 0.035, peak: 0.07 });
  }

  /** In-game hover — very soft */
  playHover(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.note(1500, now, 0.04, this.uiBus, 'sine', { attack: 0.002, decay: 0.01, sustain: 0.05, release: 0.02, peak: 0.05 });
  }

  /** Victory fanfare — triumphant brass + ascending arpeggio */
  playVictory(): void {
    this.resume();
    const now = this.ctx.currentTime;
    ['C5','E5','G5','C6'].forEach((n, i) => {
      const t = now + i * 0.14;
      this.note(nf(n), t, 0.5, this.uiBus, 'sine', { attack: 0.008, decay: 0.1, sustain: 0.45, release: 0.25, peak: 0.22 });
      this.note(nf(n) * 1.002, t, 0.5, this.uiBus, 'sine', { attack: 0.008, decay: 0.1, sustain: 0.45, release: 0.25, peak: 0.13 });
    });
    const ft = now + 0.56;
    ['C4','E4','G4','C5'].forEach(n =>
      this.note(nf(n), ft, 1.6, this.uiBus, 'triangle', { attack: 0.1, decay: 0.3, sustain: 0.35, release: 0.65, peak: 0.08 }));
    // Brass stab
    this.chord(['C4','E4','G4'], ft, 0.4, this.uiBus, 'sawtooth',
      { attack: 0.01, decay: 0.08, sustain: 0.2, release: 0.15, peak: 0.04 }, 5);
  }

  /** Defeat dirge */
  playDefeat(): void {
    this.resume();
    const now = this.ctx.currentTime;
    ['E4','Eb4','C4','A3'].forEach((n, i) => {
      const t = now + i * 0.24;
      this.note(nf(n), t, 0.65, this.uiBus, 'sawtooth', { attack: 0.025, decay: 0.12, sustain: 0.2, release: 0.3, peak: 0.08 });
    });
    this.note(nf('A2'), now + 0.5, 1.6, this.uiBus, 'sine', { attack: 0.2, decay: 0.3, sustain: 0.35, release: 0.55, peak: 0.1 });
    const ns = this.ctx.createBufferSource(); ns.buffer = this.pink(2.2);
    const ng = this.gain(0); ng.gain.setValueAtTime(0, now + 0.5); ng.gain.linearRampToValueAtTime(0.05, now + 1.2);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 2.1);
    ns.connect(this.lp(380)).connect(ng).connect(this.uiBus); ns.start(now + 0.5);
  }

  /** Menu button hover — warm dull tick */
  playMenuHover(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.noiseBurst(now, 0.006, 0.06, this.uiBus, this.bp(3500, 8));
    this.note(850, now, 0.05, this.uiBus, 'sine', { attack: 0.003, decay: 0.015, sustain: 0.06, release: 0.025, peak: 0.06 });
  }

  /** Menu button click — snappy pop + tone */
  playMenuClick(): void {
    this.resume();
    const now = this.ctx.currentTime;
    // Pop
    this.noiseBurst(now, 0.008, 0.1, this.uiBus, this.bp(4500, 6));
    // Tones
    this.note(650, now + 0.005, 0.08, this.uiBus, 'sine', { attack: 0.003, decay: 0.02, sustain: 0.12, release: 0.04, peak: 0.11 });
    this.note(950, now + 0.03, 0.06, this.uiBus, 'sine', { attack: 0.003, decay: 0.015, sustain: 0.08, release: 0.03, peak: 0.07 });
  }

  /** Page transition / navigate — elegant sweep */
  playPageTransition(): void {
    this.resume();
    const now = this.ctx.currentTime;
    // Rising shimmer
    const sh = this.ctx.createBufferSource(); sh.buffer = this.white(0.25);
    const sg = this.gain(0); sg.gain.setValueAtTime(0.06, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const sf = this.hp(3000);
    sf.frequency.setValueAtTime(3000, now); sf.frequency.exponentialRampToValueAtTime(8000, now + 0.15);
    sh.connect(sf).connect(sg).connect(this.uiBus); sh.start(now);
    // Chime pair
    this.note(nf('E5'), now + 0.03, 0.2, this.uiBus, 'sine', { attack: 0.005, decay: 0.04, sustain: 0.2, release: 0.1, peak: 0.09 });
    this.note(nf('G5'), now + 0.08, 0.2, this.uiBus, 'sine', { attack: 0.005, decay: 0.04, sustain: 0.2, release: 0.1, peak: 0.07 });
  }

  /** Toggle on sound */
  playToggleOn(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.note(600, now, 0.08, this.uiBus, 'sine', { attack: 0.003, decay: 0.02, sustain: 0.1, release: 0.04, peak: 0.1 });
    this.note(900, now + 0.04, 0.06, this.uiBus, 'sine', { attack: 0.003, decay: 0.015, sustain: 0.08, release: 0.03, peak: 0.08 });
  }

  /** Toggle off sound */
  playToggleOff(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.note(900, now, 0.08, this.uiBus, 'sine', { attack: 0.003, decay: 0.02, sustain: 0.1, release: 0.04, peak: 0.1 });
    this.note(600, now + 0.04, 0.06, this.uiBus, 'sine', { attack: 0.003, decay: 0.015, sustain: 0.08, release: 0.03, peak: 0.08 });
  }

  /** Error / invalid action sound */
  playError(): void {
    this.resume();
    const now = this.ctx.currentTime;
    this.note(350, now, 0.12, this.uiBus, 'square', { attack: 0.003, decay: 0.02, sustain: 0.15, release: 0.06, peak: 0.09 });
    this.note(280, now + 0.1, 0.12, this.uiBus, 'square', { attack: 0.003, decay: 0.02, sustain: 0.15, release: 0.06, peak: 0.09 });
  }

  /** Notification / popup appear */
  playNotification(): void {
    this.resume();
    const now = this.ctx.currentTime;
    ['E5','G5','B5'].forEach((n, i) => {
      this.note(nf(n), now + i * 0.06, 0.18, this.uiBus, 'sine',
        { attack: 0.004, decay: 0.04, sustain: 0.15, release: 0.08, peak: 0.12 });
    });
  }

  // ============================================
  // CLEANUP
  // ============================================
  dispose(): void {
    this.stopAmbient();
    this.ctx.close();
  }
}
