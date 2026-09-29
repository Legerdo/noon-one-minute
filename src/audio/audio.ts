// WebAudio 합성 효과음 + 작은 시퀀서 음악. 연출 전용: 전투 판정과 무관하다.
import { settings } from '../game/settings';

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

export function audioState(): string {
  return ctx ? ctx.state : 'none';
}

/** 사용자 입력 이후 호출(브라우저 자동재생 정책). 여러 번 불러도 안전. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.9;
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch (e) {
    console.warn('오디오 초기화 실패', e);
  }
}

export function applyVolumes(): void {
  if (!sfxBus || !musicBus) return;
  sfxBus.gain.value = settings.sfx;
  musicBus.gain.value = settings.music * 0.55;
}

interface ToneOpts {
  type?: Wave;
  f: number;
  f2?: number;
  dur: number;
  vol?: number;
  at?: number;
  attack?: number;
  bus?: 'sfx' | 'music';
  detune?: number;
}

function tone(o: ToneOpts): void {
  if (!ctx || !sfxBus || !musicBus) return;
  const t = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const v = o.vol ?? 0.2;
  const a = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(o.bus === 'music' ? musicBus : sfxBus);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  type?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  at?: number;
  bus?: 'sfx' | 'music';
}

function noise(o: NoiseOpts): void {
  if (!ctx || !noiseBuf || !sfxBus || !musicBus) return;
  const t = ctx.currentTime + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = o.type ?? 'bandpass';
  flt.frequency.setValueAtTime(o.f ?? 1200, t);
  if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t + o.dur);
  flt.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const v = o.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(o.bus === 'music' ? musicBus : sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + o.dur + 0.02);
}

const vary = (x: number, amt = 0.05) => x * (1 + (Math.random() * 2 - 1) * amt);

let tickFlip = false;

const SFX: Record<string, () => void> = {
  ui_move: () => tone({ type: 'square', f: 1760, dur: 0.03, vol: 0.05 }),
  ui_ok: () => {
    tone({ type: 'triangle', f: 660, dur: 0.06, vol: 0.14 });
    tone({ type: 'triangle', f: 990, dur: 0.08, vol: 0.12, at: 0.05 });
  },
  ui_cancel: () => tone({ type: 'triangle', f: 520, f2: 330, dur: 0.09, vol: 0.12 }),
  ui_deny: () => tone({ type: 'square', f: 150, dur: 0.14, vol: 0.08 }),
  tick: () => {
    tickFlip = !tickFlip;
    noise({ dur: 0.02, vol: 0.06, type: 'highpass', f: tickFlip ? 4200 : 2800, q: 2 });
  },
  commit: () => {
    noise({ dur: 0.05, vol: 0.12, type: 'bandpass', f: 1800, q: 3 });
    tone({ type: 'square', f: vary(220), f2: 330, dur: 0.07, vol: 0.06, at: 0.02 });
  },
  commit_guard: () => {
    tone({ type: 'triangle', f: vary(330), dur: 0.12, vol: 0.12 });
    noise({ dur: 0.08, vol: 0.1, type: 'bandpass', f: 900, q: 2 });
  },
  windup_heavy: () => {
    noise({ dur: 0.35, vol: 0.12, type: 'bandpass', f: 300, f2: 1400, q: 1.5 });
    tone({ type: 'sine', f: 70, f2: 130, dur: 0.35, vol: 0.12 });
  },
  swish: () => noise({ dur: 0.1, vol: 0.18, type: 'bandpass', f: vary(2600), f2: 900, q: 1.2 }),
  swish_heavy: () => noise({ dur: 0.22, vol: 0.28, type: 'bandpass', f: vary(900), f2: 220, q: 0.8 }),
  hit_blade: () => {
    for (const [f, v] of [
      [1250, 0.1],
      [1880, 0.07],
      [2790, 0.05],
    ])
      tone({ type: 'triangle', f: vary(f), dur: 0.18, vol: v });
    noise({ dur: 0.05, vol: 0.2, type: 'highpass', f: 2500 });
  },
  hit_light: () => {
    tone({ type: 'triangle', f: vary(1500), f2: 900, dur: 0.07, vol: 0.12 });
    noise({ dur: 0.035, vol: 0.18, type: 'highpass', f: 3500 });
  },
  hit_metal: () => {
    tone({ type: 'square', f: vary(380), f2: 250, dur: 0.12, vol: 0.08 });
    tone({ type: 'triangle', f: vary(620), dur: 0.16, vol: 0.08 });
    noise({ dur: 0.07, vol: 0.2, type: 'bandpass', f: 2200, q: 1 });
  },
  hit_heavy: () => {
    tone({ type: 'sine', f: 130, f2: 38, dur: 0.45, vol: 0.4 });
    noise({ dur: 0.3, vol: 0.35, type: 'lowpass', f: 900, f2: 120 });
    noise({ dur: 0.08, vol: 0.2, type: 'bandpass', f: 1600, q: 1 });
    tone({ type: 'square', f: vary(95), f2: 50, dur: 0.18, vol: 0.08 });
  },
  hurt: () => {
    tone({ type: 'sine', f: vary(200), f2: 70, dur: 0.14, vol: 0.28 });
    noise({ dur: 0.09, vol: 0.22, type: 'lowpass', f: 1200 });
  },
  hurt_big: () => {
    tone({ type: 'sine', f: 170, f2: 45, dur: 0.3, vol: 0.34 });
    noise({ dur: 0.2, vol: 0.3, type: 'lowpass', f: 1400, f2: 200 });
    tone({ type: 'square', f: 110, f2: 60, dur: 0.2, vol: 0.06 });
  },
  block_full: () => {
    tone({ type: 'sine', f: vary(1760, 0.02), dur: 0.5, vol: 0.14 });
    tone({ type: 'sine', f: vary(2640, 0.02), dur: 0.35, vol: 0.08 });
    tone({ type: 'triangle', f: 880, dur: 0.12, vol: 0.1 });
    noise({ dur: 0.03, vol: 0.14, type: 'highpass', f: 5000 });
  },
  block_partial: () => {
    tone({ type: 'triangle', f: vary(300), f2: 190, dur: 0.12, vol: 0.2 });
    noise({ dur: 0.08, vol: 0.2, type: 'bandpass', f: 900, q: 1.5 });
    tone({ type: 'sine', f: 1100, dur: 0.1, vol: 0.05 });
  },
  pierce: () => {
    noise({ dur: 0.04, vol: 0.22, type: 'highpass', f: 5200 });
    tone({ type: 'sine', f: 2300, f2: 1700, dur: 0.24, vol: 0.1 });
    tone({ type: 'sawtooth', f: 120, f2: 80, dur: 0.08, vol: 0.05 });
  },
  heal: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'sine', f, dur: 0.22, vol: 0.1, at: i * 0.06 }));
    noise({ dur: 0.4, vol: 0.03, type: 'highpass', f: 6000 });
  },
  delay: () => {
    tone({ type: 'sine', f: 950, f2: 260, dur: 0.3, vol: 0.14 });
    noise({ dur: 0.02, vol: 0.08, type: 'highpass', f: 2800, at: 0.05 });
    noise({ dur: 0.02, vol: 0.08, type: 'highpass', f: 4200, at: 0.13 });
    noise({ dur: 0.02, vol: 0.08, type: 'highpass', f: 2800, at: 0.21 });
  },
  delay_fail: () => tone({ type: 'square', f: 200, f2: 150, dur: 0.12, vol: 0.06 }),
  ko: () => {
    noise({ dur: 0.7, vol: 0.35, type: 'lowpass', f: 2400, f2: 90 });
    tone({ type: 'sine', f: 220, f2: 30, dur: 0.7, vol: 0.35 });
    [1300, 1900, 2500, 3100].forEach((f, i) => tone({ type: 'triangle', f: vary(f), dur: 0.12, vol: 0.05, at: 0.08 + i * 0.07 }));
  },
  enemy_intent: () => tone({ type: 'triangle', f: 520, f2: 700, dur: 0.06, vol: 0.06 }),
  danger: () => {
    tone({ type: 'square', f: 440, dur: 0.08, vol: 0.07 });
    tone({ type: 'square', f: 330, dur: 0.1, vol: 0.07, at: 0.1 });
  },
  step: () => noise({ dur: 0.03, vol: 0.05, type: 'lowpass', f: vary(700, 0.2) }),
  bump: () => tone({ type: 'triangle', f: 110, dur: 0.06, vol: 0.08 }),
  chest: () => {
    tone({ type: 'square', f: 220, f2: 160, dur: 0.15, vol: 0.05 });
    [784, 988, 1175].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.14, vol: 0.1, at: 0.15 + i * 0.07 }));
  },
  item: () => [587, 740, 880, 1175].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.18, vol: 0.12, at: i * 0.08 })),
  gear: () => {
    tone({ type: 'sine', f: 1320, dur: 0.18, vol: 0.12 });
    tone({ type: 'sine', f: 1980, dur: 0.22, vol: 0.08, at: 0.06 });
  },
  upgrade: () => {
    noise({ dur: 0.08, vol: 0.14, type: 'bandpass', f: 2400, q: 2 });
    [392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, dur: 0.12, vol: 0.05, at: 0.06 + i * 0.05 }));
  },
  door: () => noise({ dur: 0.45, vol: 0.2, type: 'lowpass', f: 400, f2: 120 }),
  wall_break: () => {
    for (let i = 0; i < 5; i++) noise({ dur: 0.12, vol: 0.25, type: 'lowpass', f: vary(900, 0.3), at: i * 0.06 });
    tone({ type: 'sine', f: 90, f2: 40, dur: 0.4, vol: 0.3 });
  },
  talk: () => tone({ type: 'square', f: vary(680, 0.08), dur: 0.025, vol: 0.03 }),
  bell: () => {
    for (const [f, v, d] of [
      [110, 0.25, 2.2],
      [221, 0.12, 1.8],
      [331, 0.08, 1.4],
      [587, 0.04, 1.0],
    ])
      tone({ type: 'sine', f, dur: d, vol: v, attack: 0.01 });
  },
  bolt: () => {
    noise({ dur: 0.18, vol: 0.18, type: 'bandpass', f: 1400, f2: 500, q: 2 });
    tone({ type: 'sawtooth', f: 700, f2: 380, dur: 0.16, vol: 0.05 });
  },
  sting: () => tone({ type: 'sawtooth', f: vary(1400, 0.1), f2: 900, dur: 0.05, vol: 0.05 }),
  storm: () => noise({ dur: 0.7, vol: 0.22, type: 'bandpass', f: 400, f2: 2400, q: 0.7 }),
  bite: () => noise({ dur: 0.05, vol: 0.2, type: 'bandpass', f: 3200, q: 2 }),
  steam: () => noise({ dur: 0.35, vol: 0.1, type: 'highpass', f: 3000 }),
  phase: () => {
    tone({ type: 'sawtooth', f: 80, f2: 160, dur: 0.6, vol: 0.12 });
    noise({ dur: 0.6, vol: 0.12, type: 'bandpass', f: 200, f2: 1600, q: 1 });
  },
};

export function sfx(name: keyof typeof SFX | string): void {
  if (!ctx || settings.sfx <= 0) return;
  SFX[name]?.();
}

// ───────────────────────── 음악 ─────────────────────────
interface Track {
  inst: 'lead' | 'bass' | 'pad' | 'bell' | 'hat' | 'kick' | 'snare';
  vol: number;
  /** 공백으로 구분한 음표. '.' 쉼, '-' 이음. 예: "A4 . C5 -" */
  notes: string;
}

interface Song {
  bpm: number;
  /** 한 박을 몇 칸으로 나눌지. */
  div: number;
  tracks: Track[];
  loop: boolean;
}

const NOTE: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freq(n: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  if (!m) return 0;
  let semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semi / 12);
}

const SONGS: Record<string, Song> = {
  title: {
    bpm: 84,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'bell', vol: 0.09, notes: 'E5 . A5 . C6 . B5 . A5 . E5 . G5 - - . F5 . E5 . D5 . E5 - - - . . . .' },
      { inst: 'bass', vol: 0.12, notes: 'A2 - - - - - - - F2 - - - - - - - C3 - - - - - - - E2 - - - - - - -' },
      { inst: 'hat', vol: 0.03, notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .' },
    ],
  },
  foyer: {
    bpm: 96,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'lead', vol: 0.05, notes: 'C5 . E5 . G5 . E5 . F5 . A5 . G5 - - . E5 . D5 . C5 . D5 . E5 - - . G4 . A4 . C5 . D5 - - - . . . .' },
      { inst: 'bass', vol: 0.12, notes: 'C3 . G2 . C3 . G2 . F2 . C3 . F2 . C3 . A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 .' },
      { inst: 'hat', vol: 0.035, notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .' },
    ],
  },
  gallery: {
    bpm: 88,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'bell', vol: 0.07, notes: 'D5 . . F5 . . A5 . G5 . . E5 . . C5 . D5 . . F5 . . A5 . C6 - - B5 . A5 . .' },
      { inst: 'pad', vol: 0.05, notes: 'D4 - - - - - - - C4 - - - - - - - Bb3 - - - - - - - A3 - - - - - - -' },
      { inst: 'bass', vol: 0.11, notes: 'D2 . . D2 . . A2 . C2 . . C2 . . G2 . Bb1 . . Bb1 . . F2 . A1 . . A1 . . E2 .' },
      { inst: 'hat', vol: 0.03, notes: 'x . . x . . x . x . . x . . x . x . . x . . x . x . . x . . x .' },
    ],
  },
  engine: {
    bpm: 104,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'lead', vol: 0.045, notes: 'E4 . G4 . B4 . A4 G4 E4 . D4 . E4 - - . E4 . G4 . B4 . D5 C5 B4 . A4 . B4 - - .' },
      { inst: 'bass', vol: 0.13, notes: 'E2 E2 . E2 E3 . E2 . C2 C2 . C2 C3 . C2 . D2 D2 . D2 D3 . D2 . B1 B1 . B1 B2 . B1 .' },
      { inst: 'kick', vol: 0.12, notes: 'x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . x .' },
      { inst: 'hat', vol: 0.04, notes: '. . x . . . x . . . x . . . x . . . x . . . x . . . x . . . x .' },
    ],
  },
  summit: {
    bpm: 80,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'pad', vol: 0.06, notes: 'A3 - - - - - - - G3 - - - - - - - F3 - - - - - - - E3 - - - - - - -' },
      { inst: 'bell', vol: 0.06, notes: 'E5 . . . A5 . . . D5 . . . G5 . . . C5 . . . F5 . . . B4 - - - E5 - - -' },
      { inst: 'hat', vol: 0.03, notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .' },
    ],
  },
  battle: {
    bpm: 132,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'lead', vol: 0.05, notes: 'A4 . C5 . E5 . D5 C5 B4 . G4 . A4 - - . A4 . C5 . F5 . E5 D5 E5 . G5 . E5 - - .' },
      { inst: 'bass', vol: 0.13, notes: 'A2 A2 . A2 A3 . A2 . G2 G2 . G2 G3 . G2 . F2 F2 . F2 F3 . F2 . E2 E2 . E2 E3 . E2 .' },
      { inst: 'kick', vol: 0.13, notes: 'x . . . x . . . x . . . x . . . x . . . x . . . x . . . x . x x' },
      { inst: 'snare', vol: 0.06, notes: '. . . . x . . . . . . . x . . . . . . . x . . . . . . . x . . .' },
      { inst: 'hat', vol: 0.03, notes: 'x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x' },
    ],
  },
  boss: {
    bpm: 144,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'lead', vol: 0.05, notes: 'D5 . D5 F5 . E5 D5 . C5 . A4 . C5 D5 - . D5 . D5 F5 . G5 A5 . Bb5 . A5 . G5 E5 - .' },
      { inst: 'bass', vol: 0.14, notes: 'D2 D2 D3 D2 D2 D3 D2 D3 C2 C2 C3 C2 C2 C3 C2 C3 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2 A1 A1 A2 A1 C2 C3 E2 A2' },
      { inst: 'kick', vol: 0.14, notes: 'x . . x x . . . x . . x x . . . x . . x x . . . x . x . x x x x' },
      { inst: 'snare', vol: 0.07, notes: '. . . . x . . . . . . . x . . . . . . . x . . . . . . . x . x .' },
      { inst: 'bell', vol: 0.05, notes: 'D4 - - - - - - - . . . . . . . . A3 - - - - - - - . . . . . . . .' },
    ],
  },
  victory: {
    bpm: 150,
    div: 2,
    loop: false,
    tracks: [
      { inst: 'lead', vol: 0.07, notes: 'C5 E5 G5 C6 - . G5 C6 - - - . . . . .' },
      { inst: 'bass', vol: 0.12, notes: 'C3 . G2 . C3 - . G2 C3 - - - . . . .' },
    ],
  },
  defeat: {
    bpm: 90,
    div: 2,
    loop: false,
    tracks: [
      { inst: 'lead', vol: 0.06, notes: 'E5 - D5 - C5 - B4 - A4 - - - . . . .' },
      { inst: 'bass', vol: 0.1, notes: 'A2 - - - F2 - - - E2 - - - A1 - - -' },
    ],
  },
  ending: {
    bpm: 92,
    div: 2,
    loop: true,
    tracks: [
      { inst: 'bell', vol: 0.08, notes: 'G5 . E5 . C5 . E5 . F5 . A5 . G5 - - . E5 . G5 . C6 . B5 . A5 . F5 . G5 - - .' },
      { inst: 'bass', vol: 0.11, notes: 'C3 - G2 - C3 - G2 - F2 - C3 - F2 - C3 - A2 - E3 - F2 - C3 - G2 - D3 - G2 - B2 -' },
      { inst: 'pad', vol: 0.04, notes: 'E4 - - - - - - - F4 - - - - - - - E4 - - - - - - - D4 - - - - - - -' },
      { inst: 'hat', vol: 0.03, notes: 'x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x . x .' },
    ],
  },
};

let current: { name: string; timer: number; next: number; step: number } | null = null;

function playNote(tr: Track, n: string, when: number, len: number): void {
  if (!ctx) return;
  const at = Math.max(0, when - ctx.currentTime);
  switch (tr.inst) {
    case 'hat':
      noise({ dur: 0.03, vol: tr.vol, type: 'highpass', f: 7000, at, bus: 'music' });
      break;
    case 'snare':
      noise({ dur: 0.12, vol: tr.vol, type: 'bandpass', f: 1800, q: 0.7, at, bus: 'music' });
      break;
    case 'kick':
      tone({ type: 'sine', f: 120, f2: 45, dur: 0.14, vol: tr.vol * 2.2, at, bus: 'music' });
      break;
    case 'lead':
      tone({ type: 'square', f: freq(n), dur: len * 0.95, vol: tr.vol, at, bus: 'music', attack: 0.01 });
      break;
    case 'bass':
      tone({ type: 'triangle', f: freq(n), dur: len * 0.9, vol: tr.vol, at, bus: 'music', attack: 0.01 });
      break;
    case 'pad':
      tone({ type: 'triangle', f: freq(n), dur: len, vol: tr.vol, at, bus: 'music', attack: Math.min(0.3, len / 3) });
      tone({ type: 'sine', f: freq(n) * 2, dur: len, vol: tr.vol * 0.5, at, bus: 'music', attack: Math.min(0.3, len / 3), detune: 6 });
      break;
    case 'bell':
      tone({ type: 'sine', f: freq(n), dur: Math.max(0.5, len * 1.6), vol: tr.vol, at, bus: 'music' });
      tone({ type: 'sine', f: freq(n) * 3.01, dur: 0.25, vol: tr.vol * 0.25, at, bus: 'music' });
      break;
  }
}

export function playMusic(name: string): void {
  if (current?.name === name) return;
  stopMusic();
  const song = SONGS[name];
  if (!song || !ctx) {
    current = { name, timer: 0, next: 0, step: 0 };
    return;
  }
  const parsed = song.tracks.map((t) => t.notes.split(/\s+/).filter(Boolean));
  const steps = Math.max(...parsed.map((p) => p.length));
  const stepDur = 60 / song.bpm / song.div;
  const state = { name, timer: 0, next: ctx.currentTime + 0.08, step: 0 };
  current = state;
  const schedule = () => {
    if (!ctx || current !== state) return;
    while (state.next < ctx.currentTime + 0.25) {
      if (!song.loop && state.step >= steps) {
        return;
      }
      const s = state.step % steps;
      song.tracks.forEach((tr, i) => {
        const tok = parsed[i][s % parsed[i].length];
        if (!tok || tok === '.' || tok === '-') return;
        let len = 1;
        while (parsed[i][(s + len) % parsed[i].length] === '-' && len < 16) len++;
        playNote(tr, tok, state.next, len * stepDur);
      });
      state.step++;
      state.next += stepDur;
    }
  };
  schedule();
  state.timer = window.setInterval(schedule, 60);
}

export function stopMusic(): void {
  if (current) window.clearInterval(current.timer);
  current = null;
}

export function currentMusic(): string | null {
  return current?.name ?? null;
}

/** 오디오가 늦게 풀렸을 때 같은 곡을 다시 시작. */
export function resumeMusic(): void {
  if (current && current.timer === 0) {
    const n = current.name;
    current = null;
    playMusic(n);
  }
}
