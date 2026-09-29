// 타격감 연출용 스프라이트: 궤적, 불꽃, 방패 섬광, 지연 고리, 입자.
import { PixelCanvas } from './canvas';
import { PAL } from './palette';

function arc(pc: PixelCanvas, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, col: number, dither = -1): void {
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d < r0 || d > r1) continue;
      const a = Math.atan2(dy, dx);
      const TAU = Math.PI * 2;
      const delta = (((a - a0) % TAU) + TAU) % TAU;
      if (delta > a1 - a0) continue;
      if (dither >= 0 && (x + y + dither) % 2 === 0) continue;
      pc.set(x, y, col);
    }
}

/** 베기 궤적(오른쪽을 향한 위→아래 호). frame 0~2. */
export function slashArc(f: number, big: boolean): PixelCanvas {
  const S = big ? 48 : 32;
  const pc = new PixelCanvas(S, S);
  const c = S / 2;
  const R = big ? 21 : 14;
  const a0 = -Math.PI * 0.55;
  const a1 = Math.PI * 0.45;
  const w = [4, 3, 2][f];
  arc(pc, c - 4, c, R - w, R, a0, a1, f === 2 ? PAL.silver : PAL.white, f === 2 ? 0 : -1);
  if (f < 2) arc(pc, c - 4, c, R - w - 2, R - w, a0 + 0.3, a1, big ? PAL.gold : PAL.silver, f === 1 ? 1 : -1);
  if (big && f === 0) arc(pc, c - 4, c, R + 1, R + 2, a0 + 0.5, a1 - 0.2, PAL.borange);
  return pc;
}

/** 찌르기 궤적. */
export function thrustStreak(f: number, col: number = PAL.white): PixelCanvas {
  const pc = new PixelCanvas(28, 7);
  const len = [26, 18][f];
  for (let x = 0; x < len; x++) {
    const t = x / len;
    pc.set(27 - x, 3, col);
    if (t < 0.5) {
      pc.set(27 - x, 2, PAL.silver);
      pc.set(27 - x, 4, PAL.silver);
    }
    if (t < 0.15) {
      pc.set(27 - x, 1, PAL.silver);
      pc.set(27 - x, 5, PAL.silver);
    }
  }
  return pc;
}

/** 타격 불꽃(별). */
export function sparkStar(f: number, hot: boolean): PixelCanvas {
  const pc = new PixelCanvas(15, 15);
  const c = 7;
  const r = [6, 5, 3][f];
  const core = hot ? [PAL.white, PAL.yellow, PAL.borange][f] : [PAL.white, PAL.silver, PAL.steel][f];
  const edge = hot ? [PAL.yellow, PAL.borange, PAL.rust][f] : [PAL.silver, PAL.steel, PAL.slate][f];
  for (let i = -r; i <= r; i++) {
    pc.set(c + i, c, Math.abs(i) < r - 1 ? core : edge);
    pc.set(c, c + i, Math.abs(i) < r - 1 ? core : edge);
  }
  const d = Math.max(1, r - 2);
  for (let i = -d; i <= d; i++) {
    pc.set(c + i, c + i, edge);
    pc.set(c + i, c - i, edge);
  }
  pc.rect(c - 1, c - 1, 3, 3, core);
  return pc;
}

/** 방패 섬광(육각). full = 완전 방어. */
export function blockFlash(f: number, full: boolean): PixelCanvas {
  const pc = new PixelCanvas(24, 28);
  const col = full ? [PAL.white, PAL.cyan, PAL.blue][f] : [PAL.silver, PAL.steel, PAL.slate][f];
  const inner = full ? [PAL.cyan, PAL.blue, PAL.navy][f] : [PAL.steel, PAL.slate, PAL.dslate][f];
  const s = [11, 10, 9][f];
  const cx = 12;
  const cy = 14;
  const pts: [number, number][] = [
    [cx, cy - s],
    [cx + s - 2, cy - s / 2],
    [cx + s - 2, cy + s / 2],
    [cx, cy + s],
    [cx - s + 2, cy + s / 2],
    [cx - s + 2, cy - s / 2],
  ];
  for (let i = 0; i < 6; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % 6];
    pc.line(x0, y0, x1, y1, col);
  }
  if (f === 0) {
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = pts[i];
      pc.line(cx + (x0 - cx) * 0.7, cy + (y0 - cy) * 0.7, cx + (pts[(i + 1) % 6][0] - cx) * 0.7, cy + (pts[(i + 1) % 6][1] - cy) * 0.7, inner);
    }
  }
  return pc;
}

/** 퍼지는 고리. */
export function ringBurst(f: number, col: number, S = 24): PixelCanvas {
  const pc = new PixelCanvas(S, S);
  const r = Math.round(3 + f * (S / 2 - 4) / 3);
  pc.ring(S / 2, S / 2, r, col);
  if (f < 2) pc.ring(S / 2, S / 2, Math.max(1, r - 1), col);
  return pc;
}

/** 지연: 거꾸로 도는 시계 고리. */
export function delayRing(f: number): PixelCanvas {
  const pc = new PixelCanvas(22, 22);
  const c = 11;
  pc.ring(c, c, 9, PAL.cyan);
  pc.ring(c, c, 8, PAL.blue);
  const a = -(f * Math.PI) / 2 - Math.PI / 2;
  const ex = Math.round(c + Math.cos(a) * 6);
  const ey = Math.round(c + Math.sin(a) * 6);
  pc.line(c, c, ex, ey, PAL.white);
  pc.set(c, c, PAL.cyan);
  // 반시계 화살
  const aa = a - 0.9;
  const ax = Math.round(c + Math.cos(aa) * 9);
  const ay = Math.round(c + Math.sin(aa) * 9);
  pc.rect(ax - 1, ay - 1, 3, 3, PAL.white);
  return pc;
}

export function dustPuff(f: number): PixelCanvas {
  const pc = new PixelCanvas(10, 10);
  const r = [2, 3, 4][f];
  pc.disc(5, 5, r, f === 2 ? PAL.slate : PAL.steel);
  if (f < 2) pc.disc(4, 4, Math.max(1, r - 2), PAL.silver);
  if (f === 2) pc.dither(0, 0, 10, 10, PAL.dslate);
  return pc;
}

export function shard(kind: 'brass' | 'steel' | 'rust' | 'wood'): PixelCanvas {
  const pc = new PixelCanvas(4, 4);
  const [a, b] =
    kind === 'brass'
      ? [PAL.gold, PAL.copper]
      : kind === 'steel'
        ? [PAL.silver, PAL.slate]
        : kind === 'rust'
          ? [PAL.orange, PAL.rust]
          : [PAL.tan, PAL.brown];
  pc.set(0, 0, a);
  pc.set(1, 0, a);
  pc.set(0, 1, a);
  pc.set(1, 1, b);
  pc.set(2, 1, b);
  pc.set(1, 2, b);
  return pc;
}

export function mote(col: number, size = 2): PixelCanvas {
  const pc = new PixelCanvas(size, size);
  pc.rect(0, 0, size, size, col);
  return pc;
}

export function sparkle(f: number): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  const col = [PAL.white, PAL.yellow, PAL.green][f % 3];
  pc.set(2, 0, col);
  pc.set(2, 4, col);
  pc.set(0, 2, col);
  pc.set(4, 2, col);
  pc.set(2, 2, PAL.white);
  if (f === 0) {
    pc.set(2, 1, col);
    pc.set(2, 3, col);
    pc.set(1, 2, col);
    pc.set(3, 2, col);
  }
  return pc;
}

export function pierceStreak(f: number): PixelCanvas {
  const pc = new PixelCanvas(30, 9);
  const col = [PAL.pink, PAL.magenta][f];
  pc.hline(0, 24, 4, col);
  pc.hline(4, 22, 3, PAL.plum);
  pc.hline(4, 22, 5, PAL.plum);
  pc.line(24, 1, 29, 4, PAL.white);
  pc.line(24, 7, 29, 4, PAL.white);
  pc.hline(25, 28, 4, PAL.white);
  return pc;
}

export function rustBolt(f: number): PixelCanvas {
  const pc = new PixelCanvas(14, 7);
  pc.disc(3, 3, 2, f % 2 ? PAL.orange : PAL.borange);
  pc.set(3, 3, PAL.yellow);
  for (let x = 5; x < 14; x++) if ((x + f) % 2 === 0) pc.set(x, 3, PAL.rust);
  pc.hline(5, 9, 2, PAL.orange);
  pc.hline(5, 9, 4, PAL.brown);
  return pc;
}

export function koStar(f: number): PixelCanvas {
  const pc = new PixelCanvas(40, 40);
  const c = 20;
  const r = [18, 14, 9][f];
  const cols = [PAL.white, PAL.yellow, PAL.borange];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const len = k % 2 === 0 ? r : Math.round(r * 0.55);
    pc.line(c, c, Math.round(c + Math.cos(a) * len), Math.round(c + Math.sin(a) * len), cols[f]);
  }
  pc.disc(c, c, [5, 4, 2][f], PAL.white);
  return pc;
}

export function bellWave(f: number): PixelCanvas {
  const S = 64;
  const pc = new PixelCanvas(S, S);
  const r = 8 + f * 7;
  pc.ring(S / 2, S / 2, r, f < 2 ? PAL.magenta : PAL.plum);
  if (f < 3) pc.ring(S / 2, S / 2, r - 2, PAL.plum);
  return pc;
}

export function stormSwirl(f: number): PixelCanvas {
  const S = 48;
  const pc = new PixelCanvas(S, S);
  for (let k = 0; k < 3; k++) {
    const a0 = f * 0.9 + (k * Math.PI * 2) / 3;
    arc(pc, S / 2, S / 2, 14 + k * 3, 16 + k * 3, a0, a0 + 1.6, k === 1 ? PAL.gold : PAL.silver);
  }
  return pc;
}
