// 탑 내부 타일과 소품. 16x16 격자. 맵 전체를 한 장의 배경으로 미리 그린다.
import { PixelCanvas, rng } from './canvas';
import { PAL } from './palette';

export const T = 16;

export type Theme = 'foyer' | 'gallery' | 'engine' | 'summit';

interface ThemeColors {
  wallTop: number;
  wallTopEdge: number;
  brick: number;
  brickDark: number;
  brickLit: number;
  mortar: number;
  floorA: number;
  floorB: number;
  floorSeam: number;
  floorLit: number;
  stoneA: number;
  stoneB: number;
}

export const THEMES: Record<Theme, ThemeColors> = {
  foyer: {
    wallTop: PAL.night,
    wallTopEdge: PAL.dslate,
    brick: PAL.slate,
    brickDark: PAL.dslate,
    brickLit: PAL.steel,
    mortar: PAL.night,
    floorA: PAL.brown,
    floorB: PAL.copper,
    floorSeam: PAL.dbrown,
    floorLit: PAL.tan,
    stoneA: PAL.dslate,
    stoneB: PAL.slate,
  },
  gallery: {
    wallTop: PAL.ink,
    wallTopEdge: PAL.night,
    brick: PAL.navy,
    brickDark: PAL.night,
    brickLit: PAL.blue,
    mortar: PAL.ink,
    floorA: PAL.dslate,
    floorB: PAL.slate,
    floorSeam: PAL.night,
    floorLit: PAL.steel,
    stoneA: PAL.dslate,
    stoneB: PAL.slate,
  },
  engine: {
    wallTop: PAL.dbrown,
    wallTopEdge: PAL.brown,
    brick: PAL.brown,
    brickDark: PAL.dbrown,
    brickLit: PAL.rust,
    mortar: PAL.ink,
    floorA: PAL.dslate,
    floorB: PAL.night,
    floorSeam: PAL.ink,
    floorLit: PAL.slate,
    stoneA: PAL.night,
    stoneB: PAL.dslate,
  },
  summit: {
    wallTop: PAL.night,
    wallTopEdge: PAL.dslate,
    brick: PAL.dslate,
    brickDark: PAL.night,
    brickLit: PAL.slate,
    mortar: PAL.ink,
    floorA: PAL.copper,
    floorB: PAL.brown,
    floorSeam: PAL.dbrown,
    floorLit: PAL.tan,
    stoneA: PAL.dslate,
    stoneB: PAL.slate,
  },
};

/** 벽으로 취급(시야를 막는) 문자. */
export const WALLISH = new Set(['#', 'W', 'G', 'P', 'X', '%', 'H']);

export function isWallChar(c: string | undefined): boolean {
  return c === undefined || WALLISH.has(c);
}

function wallTop(pc: PixelCanvas, x: number, y: number, th: ThemeColors, nb: { n: boolean; s: boolean; w: boolean; e: boolean }): void {
  pc.rect(x, y, T, T, th.wallTop);
  // 바닥과 닿는 가장자리에 테두리
  if (!nb.n) pc.hline(x, x + T - 1, y, th.wallTopEdge);
  if (!nb.w) pc.vline(x, y, y + T - 1, th.wallTopEdge);
  if (!nb.e) pc.vline(x + T - 1, y, y + T - 1, th.wallTopEdge);
  if (!nb.s) pc.hline(x, x + T - 1, y + T - 1, th.wallTopEdge);
}

function brickFace(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  pc.rect(x, y, T, T, th.brick);
  for (let row = 0; row < 4; row++) {
    const yy = y + row * 4;
    pc.hline(x, x + T - 1, yy + 3, th.mortar);
    const off = row % 2 === 0 ? 0 : 4;
    for (let bx = off; bx < T; bx += 8) pc.vline(x + bx, yy, yy + 2, th.mortar);
    // 벽돌마다 밝은 윗줄/어두운 점
    for (let bx = off - 8; bx < T; bx += 8) {
      const sx = Math.max(0, bx + 1);
      const ex = Math.min(T - 1, bx + 7);
      if (ex > sx) pc.hline(x + sx, x + ex, yy, th.brickLit);
      if (r() < 0.35) pc.set(x + Math.min(T - 1, Math.max(0, bx + 3 + Math.floor(r() * 3))), yy + 2, th.brickDark);
    }
  }
  // 아래쪽 걸레받이
  pc.hline(x, x + T - 1, y + T - 1, th.mortar);
}

function woodFloor(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  for (let row = 0; row < 4; row++) {
    const yy = y + row * 4;
    const base = (Math.floor(y / T) + row) % 2 === 0 ? th.floorA : th.floorB;
    pc.rect(x, yy, T, 4, base);
    pc.hline(x, x + T - 1, yy + 3, th.floorSeam);
    const seam = Math.floor(r() * 14) + 1;
    if (r() < 0.7) pc.vline(x + seam, yy, yy + 2, th.floorSeam);
    if (r() < 0.25) pc.set(x + Math.floor(r() * T), yy + 1, th.floorLit);
  }
}

function stoneFloor(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const c = (i + j) % 2 === 0 ? th.stoneA : th.stoneB;
      pc.rect(x + i * 8, y + j * 8, 8, 8, c);
      pc.hline(x + i * 8, x + i * 8 + 7, y + j * 8, th.floorLit === PAL.tan ? PAL.steel : th.floorLit);
      pc.hline(x + i * 8, x + i * 8 + 7, y + j * 8 + 7, PAL.night);
      if (r() < 0.3) pc.set(x + i * 8 + 2 + Math.floor(r() * 4), y + j * 8 + 3, PAL.night);
    }
}

function carpet(pc: PixelCanvas, x: number, y: number, nb: { w: boolean; e: boolean }): void {
  pc.rect(x, y, T, T, PAL.crimson);
  for (let j = 0; j < T; j += 2) pc.set(x + ((j * 3) % T), y + j, PAL.red);
  if (!nb.w) {
    pc.vline(x + 1, y, y + T - 1, PAL.gold);
    pc.vline(x, y, y + T - 1, PAL.brown);
  }
  if (!nb.e) {
    pc.vline(x + T - 2, y, y + T - 1, PAL.gold);
    pc.vline(x + T - 1, y, y + T - 1, PAL.brown);
  }
}

function pit(pc: PixelCanvas, x: number, y: number, r: () => number, northSolid: boolean): void {
  pc.rect(x, y, T, T, PAL.ink);
  if (r() < 0.5) {
    const cx = x + 4 + Math.floor(r() * 8);
    const cy = y + 4 + Math.floor(r() * 8);
    pc.ring(cx, cy, 3, PAL.night);
    pc.set(cx, cy, PAL.night);
  }
  if (northSolid) {
    pc.hline(x, x + T - 1, y, PAL.dslate);
    pc.hline(x, x + T - 1, y + 1, PAL.night);
  }
}

function windowFace(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  brickFace(pc, x, y, th, r);
  pc.rect(x + 3, y + 2, 10, 12, PAL.dslate);
  pc.rect(x + 4, y + 3, 8, 10, PAL.cyan);
  pc.rect(x + 4, y + 8, 8, 5, PAL.blue);
  pc.vline(x + 8, y + 3, y + 12, PAL.dslate);
  pc.hline(x + 4, x + 11, y + 7, PAL.dslate);
  pc.set(x + 5, y + 4, PAL.white);
  pc.set(x + 6, y + 4, PAL.white);
  // 멈춘 새 한 마리
  if (r() < 0.4) {
    pc.set(x + 10, y + 5, PAL.ink);
    pc.set(x + 9, y + 4, PAL.ink);
    pc.set(x + 11, y + 4, PAL.ink);
  }
  pc.hline(x + 2, x + 13, y + 14, PAL.steel);
}

function gearFace(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  brickFace(pc, x, y, th, r);
  const cx = x + 8;
  const cy = y + 7;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    pc.rect(Math.round(cx + Math.cos(a) * 6) - 1, Math.round(cy + Math.sin(a) * 6) - 1, 2, 2, PAL.brown);
  }
  pc.disc(cx, cy, 5, PAL.copper);
  pc.disc(cx, cy, 2, PAL.dbrown);
  pc.set(cx - 3, cy - 3, PAL.tan);
}

function pipeFace(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  brickFace(pc, x, y, th, r);
  pc.rect(x, y + 5, T, 5, PAL.dslate);
  pc.hline(x, x + T - 1, y + 5, PAL.slate);
  pc.hline(x, x + T - 1, y + 6, PAL.steel);
  pc.hline(x, x + T - 1, y + 9, PAL.night);
  pc.rect(x + 6, y + 4, 3, 7, PAL.copper);
  pc.set(x + 6, y + 4, PAL.tan);
  if (r() < 0.5) {
    pc.set(x + 12, y + 10, PAL.rust);
    pc.set(x + 12, y + 11, PAL.orange);
  }
}

function crackedFace(pc: PixelCanvas, x: number, y: number, th: ThemeColors, r: () => number): void {
  brickFace(pc, x, y, th, r);
  const pts: [number, number][] = [
    [8, 1],
    [7, 4],
    [9, 7],
    [6, 10],
    [8, 13],
  ];
  for (let i = 0; i + 1 < pts.length; i++) pc.line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], PAL.ink);
  pc.line(x + 9, y + 7, x + 12, y + 8, PAL.ink);
  pc.line(x + 7, y + 4, x + 4, y + 3, PAL.ink);
  pc.set(x + 10, y + 12, th.brickDark);
  pc.set(x + 5, y + 12, th.brickDark);
}

function stairsUp(pc: PixelCanvas, x: number, y: number): void {
  pc.rect(x, y, T, T, PAL.night);
  for (let k = 0; k < 4; k++) {
    const yy = y + 12 - k * 4;
    pc.rect(x + 1, yy, 14, 3, k % 2 ? PAL.copper : PAL.brown);
    pc.hline(x + 1, x + 14, yy, PAL.tan);
  }
  pc.vline(x, y, y + T - 1, PAL.dbrown);
  pc.vline(x + T - 1, y, y + T - 1, PAL.dbrown);
}

function stairsDown(pc: PixelCanvas, x: number, y: number): void {
  pc.rect(x, y, T, T, PAL.ink);
  for (let k = 0; k < 4; k++) {
    const yy = y + k * 4;
    const inset = k;
    pc.rect(x + 1 + inset, yy, 14 - inset * 2, 3, k % 2 ? PAL.dslate : PAL.slate);
    pc.hline(x + 1 + inset, x + 14 - inset, yy, PAL.steel);
  }
}

export interface MapGrid {
  rows: readonly string[];
  theme: Theme;
  /** 엔티티 문자 아래의 바닥 문자. */
  floorUnder: Readonly<Record<string, string>>;
}

export function baseChar(grid: MapGrid, x: number, y: number): string | undefined {
  const row = grid.rows[y];
  if (row === undefined) return undefined;
  const c = row[x];
  if (c === undefined) return undefined;
  return grid.floorUnder[c] ?? c;
}

/** 맵 전체 배경. 깨진 벽/문 같은 동적 요소는 별도 스프라이트. */
export function renderMap(grid: MapGrid, seed: number): PixelCanvas {
  const h = grid.rows.length;
  const w = Math.max(...grid.rows.map((r) => r.length));
  const pc = new PixelCanvas(w * T, h * T);
  const th = THEMES[grid.theme];
  const r = rng(seed);
  const at = (x: number, y: number) => baseChar(grid, x, y);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      const px = x * T;
      const py = y * T;
      if (c === undefined) continue;
      if (isWallChar(c)) {
        const below = at(x, y + 1);
        // 금 간 벽은 옆벽이어도 벽면을 보여 줘야 발견할 수 있다.
        const face = c === 'X' || (below !== undefined && !isWallChar(below) && below !== '~');
        if (face) {
          if (c === 'W') windowFace(pc, px, py, th, r);
          else if (c === 'G') gearFace(pc, px, py, th, r);
          else if (c === 'P') pipeFace(pc, px, py, th, r);
          else if (c === 'X') crackedFace(pc, px, py, th, r);
          else brickFace(pc, px, py, th, r);
        } else {
          wallTop(pc, px, py, th, {
            n: isWallChar(at(x, y - 1)),
            s: isWallChar(below),
            w: isWallChar(at(x - 1, y)),
            e: isWallChar(at(x + 1, y)),
          });
        }
        continue;
      }
      switch (c) {
        case ',':
          stoneFloor(pc, px, py, th, r);
          break;
        case '=':
          carpet(pc, px, py, { w: at(x - 1, y) === '=', e: at(x + 1, y) === '=' });
          break;
        case '~':
          pit(pc, px, py, r, !(at(x, y - 1) === '~'));
          break;
        case '^':
          stairsUp(pc, px, py);
          break;
        case 'v':
          stairsDown(pc, px, py);
          break;
        default:
          woodFloor(pc, px, py, th, r);
      }
      // 벽 바로 아래 바닥 그림자
      if (isWallChar(at(x, y - 1)) && c !== '^' && c !== '~') {
        for (let i = 0; i < T; i++) {
          pc.set(px + i, py, PAL.ink);
          if (i % 2 === 0) pc.set(px + i, py + 1, PAL.ink);
        }
      }
    }
  return pc;
}

// ───────────────────────── 소품 ─────────────────────────
export function chestSprite(open: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  if (open) {
    pc.rect(2, 3, 12, 4, PAL.brown);
    pc.rect(3, 4, 10, 3, PAL.dbrown);
    pc.rect(3, 6, 10, 2, PAL.gold);
  } else {
    pc.rect(2, 4, 12, 4, PAL.copper);
    pc.hline(2, 13, 4, PAL.tan);
  }
  pc.rect(2, 8, 12, 6, PAL.brown);
  pc.hline(2, 13, 8, PAL.gold);
  pc.vline(4, 4, 13, PAL.gold);
  pc.vline(11, 4, 13, PAL.gold);
  pc.rect(7, 8, 2, 3, open ? PAL.dbrown : PAL.yellow);
  pc.outline(PAL.ink);
  return pc;
}

export function workbenchSprite(f: number): PixelCanvas {
  const pc = new PixelCanvas(16, 20);
  // 램프 불빛
  pc.set(12, 1, f % 2 ? PAL.yellow : PAL.gold);
  pc.rect(11, 2, 3, 2, PAL.gold);
  pc.vline(12, 4, 7, PAL.slate);
  // 작업대
  pc.rect(1, 8, 14, 3, PAL.copper);
  pc.hline(1, 14, 8, PAL.tan);
  pc.rect(2, 11, 2, 7, PAL.brown);
  pc.rect(12, 11, 2, 7, PAL.brown);
  pc.hline(2, 13, 15, PAL.dbrown);
  // 톱니와 공구
  pc.disc(5, 6, 2, PAL.gold);
  pc.set(5, 6, PAL.dbrown);
  pc.rect(8, 6, 3, 2, PAL.steel);
  pc.outline(PAL.ink);
  return pc;
}

export function gateSprite(open: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  if (open) {
    pc.rect(0, 0, 2, 16, PAL.slate);
    pc.rect(14, 0, 2, 16, PAL.slate);
    pc.hline(0, 15, 0, PAL.steel);
  } else {
    pc.rect(0, 0, 16, 2, PAL.slate);
    for (let x = 1; x < 16; x += 3) pc.rect(x, 0, 2, 16, PAL.steel);
    pc.hline(0, 15, 7, PAL.slate);
    pc.rect(6, 6, 4, 4, PAL.gold);
    pc.set(7, 7, PAL.dbrown);
  }
  pc.outline(PAL.ink);
  return pc;
}

export function rubbleSprite(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(2, 11, 4, 3, PAL.slate);
  pc.rect(9, 12, 5, 2, PAL.dslate);
  pc.rect(6, 13, 3, 2, PAL.steel);
  pc.set(12, 10, PAL.slate);
  pc.outline(PAL.ink);
  return pc;
}

export function signSprite(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(2, 3, 12, 7, PAL.copper);
  pc.hline(2, 13, 3, PAL.tan);
  pc.hline(4, 11, 5, PAL.dbrown);
  pc.hline(4, 9, 7, PAL.dbrown);
  pc.rect(7, 10, 2, 5, PAL.brown);
  pc.outline(PAL.ink);
  return pc;
}

export function heartSprite(f: number): PixelCanvas {
  const pc = new PixelCanvas(14, 14);
  const y = 2 + [0, 1, 1, 0][f % 4];
  pc.disc(4, y + 3, 3, PAL.red);
  pc.disc(9, y + 3, 3, PAL.red);
  pc.poly(
    [
      [1, y + 4],
      [12, y + 4],
      [7, y + 10],
      [6, y + 10],
    ],
    PAL.red,
  );
  pc.set(3, y + 2, PAL.pink);
  pc.set(4, y + 1, PAL.white);
  pc.rect(6, y + 3, 2, 2, PAL.gold);
  pc.set(6, y + 3, PAL.yellow);
  pc.outline(PAL.ink);
  return pc;
}

export function gearPickup(f: number): PixelCanvas {
  const pc = new PixelCanvas(12, 12);
  const a = f * 0.4;
  for (let k = 0; k < 6; k++) {
    const t = a + (k * Math.PI) / 3;
    pc.rect(Math.round(6 + Math.cos(t) * 4) - 1, Math.round(6 + Math.sin(t) * 4) - 1, 2, 2, PAL.gold);
  }
  pc.disc(6, 6, 3, PAL.gold);
  pc.set(6, 6, PAL.dbrown);
  pc.set(5, 4, PAL.yellow);
  pc.outline(PAL.ink);
  return pc;
}

export function clockProp(f: number): PixelCanvas {
  // 괘종시계(벽 앞 장식). 16x32
  const pc = new PixelCanvas(16, 32);
  pc.rect(3, 2, 10, 28, PAL.brown);
  pc.rect(4, 3, 8, 8, PAL.cream);
  pc.ring(8, 7, 3, PAL.dbrown);
  pc.vline(8, 4, 7, PAL.ink);
  pc.line(8, 7, 7, 5, PAL.ink);
  pc.rect(5, 13, 6, 14, PAL.dbrown);
  const sw = [-1, 0, 1, 0][f % 4];
  pc.vline(8 + sw, 13, 22, PAL.gold);
  pc.disc(8 + sw, 23, 2, PAL.gold);
  pc.hline(2, 13, 2, PAL.copper);
  pc.hline(2, 13, 29, PAL.copper);
  pc.outline(PAL.ink);
  return pc;
}

export function crateSprite(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(1, 2, 14, 13, PAL.copper);
  pc.frame(1, 2, 14, 13, PAL.brown);
  pc.line(2, 3, 13, 13, PAL.brown);
  pc.hline(1, 14, 2, PAL.tan);
  pc.outline(PAL.ink);
  return pc;
}

export function pendulumDecor(f: number): PixelCanvas {
  // 벽에 걸린 커다란 진자(회랑 장식) 16x40
  const pc = new PixelCanvas(24, 40);
  const ang = [-14, -7, 0, 7, 14, 7, 0, -7][f % 8];
  const a = (ang * Math.PI) / 180;
  const ex = Math.round(12 + Math.sin(a) * 26);
  const ey = Math.round(2 + Math.cos(a) * 26);
  pc.line(12, 2, ex, ey, PAL.gold);
  pc.disc(ex, ey + 3, 4, PAL.copper);
  pc.set(ex - 2, ey + 1, PAL.tan);
  pc.rect(10, 0, 5, 3, PAL.slate);
  pc.outline(PAL.ink);
  return pc;
}

export function steamVent(f: number): PixelCanvas {
  const pc = new PixelCanvas(12, 16);
  pc.rect(3, 13, 6, 3, PAL.slate);
  const k = f % 3;
  pc.disc(6, 10 - k * 2, 2 + (k === 2 ? 1 : 0), PAL.silver);
  pc.disc(5 + k, 5 - k, 1 + (k > 0 ? 1 : 0), PAL.white);
  return pc;
}
