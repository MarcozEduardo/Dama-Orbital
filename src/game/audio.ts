// ─────────────────────────────────────────────────────────────
//  SFX sintetizado (Web Audio API) com MIXER de verdade:
//  · limitador de vozes (nunca satura o buffer)
//  · throttle por tag (explosão simultânea toca UMA vez só)
//  · ducking/sidechain (o estouro abaixa o resto por um instante)
//  · barramentos separados: FX curtos x loops (giro)
// ─────────────────────────────────────────────────────────────

const MAX_VOICES = 14;

class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private voices = 0;
  private last: Record<string, number> = {};
  private _muted = false;
  private baseVol = 0.42;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        // master → compressor → saída (evita clipping quando tudo dispara junto)
        this.comp = this.ctx.createDynamicsCompressor();
        this.comp.threshold.value = -16;
        this.comp.knee.value = 22;
        this.comp.ratio.value = 8;
        this.comp.attack.value = 0.004;
        this.comp.release.value = 0.18;
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : this.baseVol;
        this.bus = this.ctx.createGain();
        this.bus.gain.value = 1;
        this.bus.connect(this.master);
        this.master.connect(this.comp);
        this.comp.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  setMuted(m: boolean) {
    this._muted = m;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(m ? 0 : this.baseVol, this.ctx.currentTime, 0.02);
  }

  get muted() {
    return this._muted;
  }

  unlock() {
    this.ensure();
  }

  /** só deixa passar se já se passou `gap` ms desde o último som dessa tag */
  private gate(tag: string, gap: number): boolean {
    const now = performance.now();
    if (this.last[tag] && now - this.last[tag] < gap) return false;
    this.last[tag] = now;
    return true;
  }

  /** abaixa tudo por um instante (sidechain) para o impacto respirar */
  private duck(amount = 0.5, hold = 0.09, release = 0.3) {
    const ctx = this.ensure();
    if (!ctx || !this.bus) return;
    const t = ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(amount, t + 0.02);
    this.bus.gain.setValueAtTime(amount, t + hold);
    this.bus.gain.linearRampToValueAtTime(1, t + hold + release);
  }

  private claim(dur: number): boolean {
    if (this.voices >= MAX_VOICES) return false;
    this.voices++;
    window.setTimeout(() => this.voices--, Math.min(2000, dur * 1000 + 60));
    return true;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    vol = 0.16,
    slideTo?: number,
    delay = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.bus || !this.claim(dur + delay)) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.22, fFrom = 1400, fTo = 160, delay = 0, q = 0.7) {
    const ctx = this.ensure();
    if (!ctx || !this.bus || !this.claim(dur + delay)) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = "lowpass";
    flt.Q.value = q;
    flt.frequency.setValueAtTime(fFrom, t0);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(flt);
    flt.connect(gain);
    gain.connect(this.bus);
    src.start(t0);
  }

  // ── UI ─────────────────────────────────────────────
  select() {
    if (!this.gate("sel", 45)) return;
    this.tone(540, 0.07, "square", 0.1, 720);
  }
  click() {
    if (!this.gate("clk", 40)) return;
    this.tone(220, 0.05, "square", 0.08, 180);
  }
  denied() {
    if (!this.gate("den", 120)) return;
    this.tone(95, 0.09, "square", 0.13, 80);
    this.tone(80, 0.1, "square", 0.13, 70, 0.09);
  }
  blip(pitch = 1) {
    if (!this.gate("blip", 22)) return;
    this.tone(620 * pitch, 0.028, "square", 0.03);
  }

  // ── MOVIMENTO ──────────────────────────────────────
  move() {
    if (!this.gate("mv", 80)) return;
    this.tone(340, 0.13, "triangle", 0.16, 170);
    this.noise(0.08, 0.045, 900, 300);
  }
  thrust() {
    if (!this.gate("thr", 140)) return;
    this.noise(0.34, 0.07, 380, 2600, 0, 2.5);
    this.tone(120, 0.3, "sawtooth", 0.045, 220);
  }

  // ── MIRA / SCANNER ─────────────────────────────────
  /** a mira varrendo e cravando no alvo */
  lockOn(index = 0) {
    if (!this.gate("lock", 90)) return;
    const p = Math.min(index, 5);
    this.tone(1250 + p * 130, 0.1, "square", 0.075, 2050 + p * 150);
    this.noise(0.14, 0.05, 2600, 6200, 0.02, 3);
    this.tone(2100 + p * 160, 0.07, "sine", 0.055, undefined, 0.11);
  }
  /** varredura geral antes da barragem */
  scan() {
    if (!this.gate("scan", 300)) return;
    this.noise(0.5, 0.07, 600, 5400, 0, 3.2);
    this.tone(420, 0.46, "sine", 0.05, 1750);
    [0, 1, 2].forEach((i) => this.tone(1500 + i * 260, 0.05, "square", 0.04, undefined, 0.1 + i * 0.11));
  }

  // ── ARMAS ──────────────────────────────────────────
  launch(i = 0) {
    if (!this.gate("lnc", 55)) return;
    this.noise(0.4, 0.13, 2600, 300, i * 0.015, 1.6);
    this.tone(760, 0.28, "sawtooth", 0.06, 180, i * 0.015);
  }

  /**
   * Explosão. Se várias caírem juntas, só a PRIMEIRA toca por inteiro —
   * as seguintes viram eco distante. Nada de lameira sonora.
   */
  boom(power = 1) {
    if (this.gate("boom", 130)) {
      this.duck(0.45, 0.08, 0.34);
      const v = Math.min(0.34, 0.2 * power);
      this.noise(0.48, v, 1600, 60, 0, 0.9);
      this.tone(120, 0.32, "sawtooth", 0.18, 32);
      this.tone(62, 0.4, "square", 0.16, 26, 0.02);
      this.noise(0.45, 0.06, 6000, 2600, 0.05, 1.2);
    } else {
      // eco: baixo, abafado e fora de fase — dá sensação de barragem
      this.noise(0.3, 0.06, 700, 90, 0.03, 0.8);
      this.tone(84, 0.22, "sawtooth", 0.05, 30, 0.04);
    }
  }

  sizzle() {
    if (!this.gate("siz", 200)) return;
    this.noise(0.45, 0.055, 5200, 1800, 0, 1.4);
  }

  capture(combo = 1) {
    if (!this.gate("cap", 90)) return;
    const base = 392 * Math.pow(1.059, Math.min(combo - 1, 6) * 2);
    [0, 4, 7].forEach((st, i) =>
      this.tone(base * Math.pow(2, st / 12), 0.09, "square", 0.075, undefined, 0.03 + i * 0.055),
    );
  }

  // ── GIRO DA PLATAFORMA ─────────────────────────────
  /**
   * Plataforma industrial girando: RAAAM · RAAAM · RAM ... TIIISSS
   * 3 arrancadas do motor + freio longo chiando no fim.
   */
  platformSpin(durMs = 3800) {
    const ctx = this.ensure();
    if (!ctx || !this.bus) return;
    const d = durMs / 1000;

    // ── 3 tempos do motor (raaam · raaam · ram) ──
    const beats: Array<[number, number, number]> = [
      [0.02, d * 0.3, 0.11], // raaaam (longo)
      [d * 0.33, d * 0.27, 0.1], // raaam
      [d * 0.62, d * 0.14, 0.075], // ram (curto)
    ];
    for (const [at, len, vol] of beats) {
      this.tone(42, len, "sawtooth", vol, 78, at);
      this.tone(84, len * 0.9, "triangle", vol * 0.55, 140, at + 0.02);
      this.noise(len * 0.8, vol * 0.4, 260, 900, at, 1.4);
    }

    // ── rangido contínuo do trilho ──
    const t0 = ctx.currentTime + 0.1;
    const grindDur = d * 0.74;
    if (this.claim(grindDur)) {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(196, t0);
      osc.frequency.linearRampToValueAtTime(248, t0 + grindDur * 0.6);
      osc.frequency.linearRampToValueAtTime(172, t0 + grindDur);
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(6, t0);
      lfo.frequency.linearRampToValueAtTime(13, t0 + grindDur);
      lfoGain.gain.value = 30;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      flt.type = "bandpass";
      flt.frequency.value = 1050;
      flt.Q.value = 6;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.042, t0 + 0.22);
      gain.gain.setValueAtTime(0.042, t0 + grindDur * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0006, t0 + grindDur);
      osc.connect(flt);
      flt.connect(gain);
      gain.connect(this.bus);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + grindDur + 0.05);
      lfo.stop(t0 + grindDur + 0.05);
    }

    // ── FREIO: tiiisssss (ruído agudo longo, subindo e sumindo) ──
    const brakeAt = d * 0.62;
    const brakeDur = d * 0.34;
    this.noise(brakeDur, 0.075, 3200, 8200, brakeAt, 4.5);
    this.noise(brakeDur * 0.7, 0.045, 5600, 2400, brakeAt + brakeDur * 0.25, 3);
    // guincho metálico do freio agarrando
    this.tone(2150, brakeDur * 0.55, "sawtooth", 0.026, 3050, brakeAt + 0.05);
    this.tone(1580, brakeDur * 0.45, "sine", 0.022, 2400, brakeAt + brakeDur * 0.3);

    // ── trava final: TCHUNK ──
    this.tone(66, 0.24, "square", 0.14, 30, d * 0.955);
    this.noise(0.26, 0.1, 1700, 110, d * 0.955, 0.9);
  }

  /** faísca solitária embaixo da plataforma */
  sparkTick() {
    if (!this.gate("spk", 105)) return;
    this.noise(0.07, 0.045, 7000, 2600, 0, 2.4);
    this.tone(2400 + Math.random() * 1400, 0.045, "square", 0.02);
  }

  // ── EVENTOS ────────────────────────────────────────
  crown() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.14, "triangle", 0.15, undefined, i * 0.09),
    );
    this.tone(1567.98, 0.3, "sine", 0.09, undefined, 0.38);
    this.noise(0.25, 0.035, 8000, 5000, 0.36);
  }
  holo() {
    this.noise(0.4, 0.09, 400, 4200, 0, 2.2);
    this.tone(180, 0.34, "sine", 0.08, 1400);
    this.tone(1320, 0.18, "square", 0.06, 1980, 0.3);
  }
  disintegrate() {
    this.noise(0.6, 0.08, 5200, 700, 0, 1.1);
    [1568, 1318, 1046, 880].forEach((f, i) => this.tone(f, 0.12, "sine", 0.045, undefined, i * 0.06));
  }
  beep(high = false) {
    this.tone(high ? 880 : 440, high ? 0.34 : 0.14, "square", 0.14);
    if (high) this.tone(1320, 0.3, "square", 0.07, undefined, 0.02);
  }
  fight() {
    this.duck(0.6, 0.05, 0.3);
    [523, 659, 880, 1046].forEach((f, i) =>
      this.tone(f, 0.5 - i * 0.06, "square", 0.12, undefined, i * 0.05),
    );
    this.noise(0.7, 0.14, 3000, 200, 0, 0.8);
    this.tone(80, 0.6, "sawtooth", 0.14, 40);
  }
  /** sirene de rendição: duas notas alternando, tipo alarme de base */
  siren(cycles = 3) {
    const ctx = this.ensure();
    if (!ctx || !this.bus) return;
    for (let i = 0; i < cycles; i++) {
      const at = i * 0.86;
      this.tone(620, 0.42, "sawtooth", 0.085, 880, at);
      this.tone(880, 0.42, "sawtooth", 0.085, 620, at + 0.43);
      this.tone(310, 0.42, "square", 0.035, 440, at);
      this.tone(440, 0.42, "square", 0.035, 310, at + 0.43);
    }
  }

  /** pano da bandeira batendo no vento */
  flagWave() {
    if (!this.gate("flag", 90)) return;
    this.noise(0.22, 0.045, 1800, 500, 0, 1.1);
    this.noise(0.18, 0.03, 900, 2200, 0.14, 1.4);
  }

  /** rufar grave anunciando a execução */
  doom() {
    this.duck(0.55, 0.1, 0.5);
    this.tone(58, 0.9, "sawtooth", 0.14, 34);
    this.tone(29, 1.1, "square", 0.1, 20, 0.05);
    this.noise(1.1, 0.06, 400, 90, 0, 0.7);
  }

  win() {
    const mel = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    mel.forEach((f, i) => this.tone(f, 0.16, "square", 0.11, undefined, i * 0.13));
    mel.forEach((f, i) => this.tone(f / 2, 0.2, "triangle", 0.09, undefined, i * 0.13));
    this.noise(0.9, 0.045, 7000, 3000, 0.2);
  }
}

export const sfx = new Synth();
