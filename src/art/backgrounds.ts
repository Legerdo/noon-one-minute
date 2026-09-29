// 전투 무대와 타이틀/엔딩 배경(480x270). 정적인 층만 그리고 움직이는 톱니·진자는 씬에서 따로 얹는다.
import { PixelCanvas, rng } from './canvas';
import { gear } from './enemies';
import { PAL } from './palette';
import type { Theme } from './tiles';

export const W = 480;
export const H = 270;
/** 전투 무대 바닥선(발 위치). */
export const STAGE_Y = 178;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function band(pc: PixelCanvas, y0: number, y1: number, a: number, b: number): void {
  // a → b 로 4x4 베이어 디더 전환(줄무늬 없이 고르게)
  const h = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0 + 0.5) / h;
    for (let x = 0; x < pc.w; x++) {
      const threshold = (BAYER4[(x % 4) + (y % 4) * 4] + 0.5) / 16;
      pc.set(x, y, t > threshold ? b : a);
    }
  }
}

function bricks(pc: PixelCanvas, y0: number, y1: number, base: number, mortar: number, lit: number, dark: number, seed: number): void {
  const r = rng(seed);
  pc.rect(0, y0, pc.w, y1 - y0, base);
  const bh = 8;
  for (let y = y0; y < y1; y += bh) {
    const row = Math.floor((y - y0) / bh);
    pc.hline(0, pc.w - 1, y + bh - 1, mortar);
    const off = row % 2 ? 8 : 0;
    for (let x = -off; x < pc.w; x += 16) {
      pc.vline(x, y, y + bh - 2, mortar);
      pc.hline(x + 1, x + 14, y, lit);
      if (r() < 0.3) pc.set(x + 3 + Math.floor(r() * 10), y + 3 + Math.floor(r() * 3), dark);
      if (r() < 0.12) pc.rect(x + 2, y + 2, 5, 3, dark);
    }
  }
}

function perspectiveFloor(pc: PixelCanvas, y0: number, a: number, b: number, line: number, lit: number, kind: 'plank' | 'check' | 'grate' | 'plate'): void {
  const vx = W / 2;
  const vy = y0 - 90;
  for (let y = y0; y < H; y++) {
    const depth = (y - vy) / (H - vy);
    const rowIdx = Math.floor(Math.log(y - vy) * 9);
    for (let x = 0; x < W; x++) {
      // 소실점 기준 세로 줄
      const u = (x - vx) / (y - vy);
      const col = Math.floor(u * 6);
      let c = (rowIdx + (kind === 'check' ? col : 0)) % 2 === 0 ? a : b;
      if (kind === 'grate' && (col + rowIdx) % 3 === 0) c = line;
      pc.set(x, y, c);
    }
    // 줄눈
    if (Math.floor(Math.log(y + 1 - vy) * 9) !== rowIdx) pc.hline(0, W - 1, y, line);
    void depth;
  }
  for (let k = -24; k <= 24; k++) {
    const x1 = vx + k * ((H - vy) / 6);
    pc.line(vx + (k * (y0 - vy)) / 6, y0, x1, H, line);
  }
  // 무대 앞선 하이라이트
  pc.hline(0, W - 1, y0, lit);
  pc.hline(0, W - 1, y0 + 1, line);
  if (kind === 'plate')
    for (let x = 12; x < W; x += 40) {
      pc.set(x, y0 + 6, lit);
      pc.set(x + 20, y0 + 20, lit);
    }
}

function pillar(pc: PixelCanvas, x: number, w: number, y0: number, y1: number, base: number, lit: number, dark: number): void {
  pc.rect(x, y0, w, y1 - y0, base);
  pc.vline(x, y0, y1 - 1, lit);
  pc.vline(x + 1, y0, y1 - 1, lit);
  pc.vline(x + w - 1, y0, y1 - 1, dark);
  pc.vline(x + w - 2, y0, y1 - 1, dark);
  pc.vline(x - 1, y0, y1 - 1, PAL.ink);
  pc.vline(x + w, y0, y1 - 1, PAL.ink);
}

function lampGlow(pc: PixelCanvas, cx: number, cy: number, r: number, col: number): void {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1) continue;
      const on = d < 0.45 || (d < 0.75 && (x + y) % 2 === 0) || (d < 1 && (x % 2 === 0 && y % 2 === 0));
      if (on && pc.get(x, y) !== PAL.ink) pc.set(x, y, col);
    }
}

export function battleBackground(theme: Theme): PixelCanvas {
  const pc = new PixelCanvas(W, H);
  const floorY = STAGE_Y - 26;
  if (theme === 'foyer') {
    bricks(pc, 0, floorY, PAL.dslate, PAL.night, PAL.slate, PAL.night, 11);
    // 창문 빛기둥
    for (const wx of [96, 360]) {
      pc.rect(wx, 30, 30, 50, PAL.night);
      pc.rect(wx + 2, 32, 26, 46, PAL.navy);
      pc.rect(wx + 4, 34, 22, 20, PAL.blue);
      pc.rect(wx + 4, 54, 22, 22, PAL.navy);
      pc.vline(wx + 15, 32, 77, PAL.night);
      pc.hline(wx + 2, wx + 27, 54, PAL.night);
      pc.set(wx + 6, 36, PAL.cyan);
      pc.set(wx + 7, 36, PAL.cyan);
    }
    pillar(pc, 40, 14, 0, floorY, PAL.brown, PAL.copper, PAL.dbrown);
    pillar(pc, 226, 14, 0, floorY, PAL.brown, PAL.copper, PAL.dbrown);
    pillar(pc, 426, 14, 0, floorY, PAL.brown, PAL.copper, PAL.dbrown);
    pc.rect(0, 0, W, 12, PAL.dbrown);
    pc.hline(0, W - 1, 12, PAL.brown);
    pc.hline(0, W - 1, 13, PAL.ink);
    lampGlow(pc, 233, 52, 26, PAL.copper);
    perspectiveFloor(pc, floorY, PAL.brown, PAL.dbrown, PAL.ink, PAL.copper, 'plank');
  } else if (theme === 'gallery') {
    bricks(pc, 0, floorY, PAL.night, PAL.ink, PAL.dslate, PAL.ink, 22);
    for (const wx of [30, 150, 290, 410]) {
      // 아치 창
      pc.rect(wx, 36, 40, 80, PAL.ink);
      pc.disc(wx + 20, 36, 20, PAL.ink);
      pc.rect(wx + 3, 38, 34, 76, PAL.navy);
      pc.disc(wx + 20, 38, 17, PAL.navy);
      pc.rect(wx + 6, 40, 28, 40, PAL.blue);
      pc.disc(wx + 20, 40, 14, PAL.blue);
      pc.vline(wx + 20, 22, 113, PAL.ink);
      pc.hline(wx + 3, wx + 36, 80, PAL.ink);
      pc.set(wx + 12, 30, PAL.cyan);
      pc.set(wx + 13, 29, PAL.cyan);
      // 빛 기둥(디더)
      for (let y = 116; y < floorY + 20; y++)
        for (let x = wx - 4 + Math.floor((y - 116) * 0.3); x < wx + 44 + Math.floor((y - 116) * 0.3); x++)
          if ((x + y) % 4 === 0 && pc.get(x, y) !== PAL.ink) pc.set(x, y, PAL.dslate);
    }
    pc.rect(0, 0, W, 10, PAL.ink);
    perspectiveFloor(pc, floorY, PAL.dslate, PAL.night, PAL.ink, PAL.slate, 'check');
  } else if (theme === 'engine') {
    bricks(pc, 0, floorY, PAL.dbrown, PAL.ink, PAL.brown, PAL.ink, 33);
    // 큰 배관
    for (const py of [40, 96]) {
      pc.rect(0, py, W, 14, PAL.dslate);
      pc.hline(0, W - 1, py, PAL.steel);
      pc.hline(0, W - 1, py + 1, PAL.slate);
      pc.hline(0, W - 1, py + 13, PAL.ink);
      for (let x = 20; x < W; x += 70) {
        pc.rect(x, py - 2, 8, 18, PAL.copper);
        pc.vline(x, py - 2, py + 15, PAL.tan);
        pc.set(x + 3, py + 6, PAL.rust);
      }
    }
    for (const px of [70, 250, 400]) {
      pc.rect(px, 0, 12, floorY, PAL.slate);
      pc.vline(px, 0, floorY - 1, PAL.steel);
      pc.vline(px + 11, 0, floorY - 1, PAL.dslate);
      // 압력계
      pc.disc(px + 6, 128, 7, PAL.copper);
      pc.disc(px + 6, 128, 5, PAL.cream);
      pc.line(px + 6, 128, px + 9, 125, PAL.red);
    }
    // 녹 얼룩
    const r = rng(7);
    for (let k = 0; k < 90; k++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * floorY);
      if (pc.get(x, y) !== PAL.ink) pc.set(x, y, r() < 0.5 ? PAL.rust : PAL.brown);
    }
    lampGlow(pc, 240, 70, 40, PAL.brown);
    perspectiveFloor(pc, floorY, PAL.night, PAL.ink, PAL.dslate, PAL.slate, 'grate');
  } else {
    // 꼭대기: 거대한 문자판 뒷면(유리) 너머의 하늘
    band(pc, 0, 60, PAL.navy, PAL.blue);
    band(pc, 60, 140, PAL.blue, PAL.cyan);
    pc.rect(0, 140, W, floorY - 140, PAL.cyan);
    const cx = 240;
    const cy = 96;
    pc.ring(cx, cy, 118, PAL.copper);
    pc.ring(cx, cy, 117, PAL.gold);
    pc.ring(cx, cy, 116, PAL.copper);
    for (let k = 0; k < 60; k++) {
      const a = (k * Math.PI) / 30;
      const r0 = k % 5 === 0 ? 100 : 108;
      for (let rr = r0; rr < 114; rr++) pc.set(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), PAL.dslate);
    }
    // 바늘(11:59, 안쪽에서 보면 좌우 반전)
    pc.thick(cx, cy, cx + 6, cy - 96, 3, PAL.night);
    pc.thick(cx, cy, cx + 3, cy - 64, 5, PAL.night);
    pc.disc(cx, cy, 7, PAL.night);
    // 구름(멈춤)
    for (const [x, y, s] of [
      [60, 30, 10],
      [400, 50, 14],
      [320, 20, 8],
    ]) {
      pc.disc(x, y, s, PAL.white);
      pc.disc(x + s, y + 2, s - 3, PAL.white);
      pc.disc(x - s, y + 3, s - 4, PAL.silver);
    }
    // 창살
    for (let x = 0; x < W; x += 60) pc.vline(x, 0, floorY, PAL.dslate);
    perspectiveFloor(pc, floorY, PAL.copper, PAL.brown, PAL.dbrown, PAL.tan, 'plate');
  }
  // 무대 가장자리 비네트(디더)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < 28; x++) {
      if ((x + y) % 2 === 0 && x < 14) pc.set(x, y, PAL.ink);
      if ((x + y) % 2 === 0 && x < 14) pc.set(W - 1 - x, y, PAL.ink);
      if ((x + y) % 4 === 0) {
        pc.set(x, y, PAL.ink);
        pc.set(W - 1 - x, y, PAL.ink);
      }
    }
  return pc;
}

/** 움직이는 배경 톱니 프레임(어두운 실루엣). */
export function bgGear(r: number, frames: number, col: number): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  const teeth = Math.max(8, Math.round(r / 2.2));
  for (let f = 0; f < frames; f++) {
    const S = r * 2 + 6;
    const pc = new PixelCanvas(S, S);
    const phase = (f / frames) * ((Math.PI * 2) / teeth);
    gear(pc, S >> 1, S >> 1, r, teeth, phase, col, PAL.ink);
    // 바퀴살
    for (let k = 0; k < 4; k++) {
      const a = phase + (k * Math.PI) / 2;
      pc.line(S >> 1, S >> 1, Math.round((S >> 1) + Math.cos(a) * (r - 3)), Math.round((S >> 1) + Math.sin(a) * (r - 3)), PAL.ink);
    }
    pc.disc(S >> 1, S >> 1, Math.max(2, Math.floor(r / 5)), col);
    out.push(pc);
  }
  return out;
}

/** 타이틀/엔딩: 정오 직전의 시계탑. */
export function towerScene(noon: boolean): PixelCanvas {
  const pc = new PixelCanvas(W, H);
  if (noon) {
    band(pc, 0, 70, PAL.blue, PAL.cyan);
    band(pc, 70, 170, PAL.cyan, PAL.cream);
    pc.rect(0, 170, W, 100, PAL.cream);
  } else {
    band(pc, 0, 80, PAL.navy, PAL.blue);
    band(pc, 80, 170, PAL.blue, PAL.cyan);
    pc.rect(0, 170, W, 100, PAL.cyan);
  }
  // 구름
  const clouds: [number, number, number][] = [
    [70, 60, 12],
    [150, 40, 9],
    [390, 70, 14],
    [440, 30, 8],
  ];
  for (const [x, y, s] of clouds) {
    pc.disc(x, y, s, PAL.white);
    pc.disc(x + s, y + 3, s - 3, PAL.white);
    pc.disc(x - s, y + 4, s - 4, noon ? PAL.cream : PAL.silver);
    pc.hline(x - s * 2, x + s * 2, y + s - 2, noon ? PAL.cream : PAL.silver);
  }
  // 먼 산
  for (let x = 0; x < W; x++) {
    const hgt = 30 + Math.round(Math.sin(x * 0.02) * 10 + Math.sin(x * 0.053) * 6);
    pc.vline(x, H - 70 - hgt, H - 70, noon ? PAL.steel : PAL.slate);
  }
  // 시계탑
  const tx = 300;
  const tw = 90;
  pc.rect(tx, 70, tw, H - 70, PAL.dslate);
  pc.rect(tx + 4, 70, 10, H - 70, PAL.slate);
  pc.vline(tx + tw - 1, 70, H - 1, PAL.night);
  pc.poly(
    [
      [tx - 8, 72],
      [tx + tw / 2, 18],
      [tx + tw + 8, 72],
    ],
    PAL.crimson,
  );
  pc.poly(
    [
      [tx - 8, 72],
      [tx + tw / 2, 18],
      [tx + tw / 2, 72],
    ],
    PAL.red,
  );
  pc.hline(tx - 8, tx + tw + 8, 72, PAL.ink);
  pc.vline(tx + tw / 2, 6, 18, PAL.dslate);
  pc.rect(tx + tw / 2 - 1, 4, 3, 3, PAL.gold);
  // 문자판
  const cx = tx + tw / 2;
  const cy = 118;
  pc.disc(cx, cy, 34, PAL.gold);
  pc.disc(cx, cy, 31, PAL.copper);
  pc.disc(cx, cy, 29, PAL.cream);
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 - Math.PI / 2;
    for (let r = k % 3 === 0 ? 22 : 25; r <= 27; r++) pc.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), PAL.dbrown);
  }
  // 바늘: 11:59 / 12:00
  const minute = noon ? 0 : -6;
  const hourDeg = noon ? 0 : -0.5;
  const handLine = (deg: number, len: number, w: number, c: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    pc.thick(cx, cy, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), w, c);
  };
  handLine(minute, 25, 2, PAL.ink);
  handLine(hourDeg, 16, 3, PAL.dbrown);
  pc.disc(cx, cy, 2, PAL.gold);
  // 창문
  for (let y = 170; y < H - 20; y += 30) {
    pc.rect(cx - 6, y, 12, 16, PAL.ink);
    pc.rect(cx - 5, y + 1, 10, 14, noon ? PAL.yellow : PAL.navy);
    pc.vline(cx, y + 1, y + 14, PAL.ink);
  }
  // 마을 지붕 실루엣
  const r = rng(99);
  let x = 0;
  while (x < W) {
    const w = 26 + Math.floor(r() * 26);
    const h = 30 + Math.floor(r() * 30);
    if (x + w < tx - 4 || x > tx + tw + 4) {
      pc.rect(x, H - h, w, h, PAL.night);
      pc.poly(
        [
          [x - 2, H - h],
          [x + w / 2, H - h - 14],
          [x + w + 2, H - h],
        ],
        PAL.dbrown,
      );
      for (let wy = H - h + 8; wy < H - 8; wy += 12)
        for (let wx = x + 5; wx < x + w - 5; wx += 10) pc.rect(wx, wy, 3, 4, noon ? PAL.yellow : PAL.gold);
    }
    x += w + 4;
  }
  // 멈춘 새
  if (!noon)
    for (const [bx, by] of [
      [120, 100],
      [134, 92],
      [210, 60],
    ]) {
      pc.set(bx, by, PAL.ink);
      pc.set(bx - 1, by - 1, PAL.ink);
      pc.set(bx + 1, by - 1, PAL.ink);
      pc.set(bx - 2, by - 1, PAL.ink);
      pc.set(bx + 2, by - 1, PAL.ink);
    }
  return pc;
}
