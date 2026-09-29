// 무기: 방향별로 새로 래스터화(회전 보간 없음). 손잡이(grip) 좌표를 함께 돌려준다.
import { CLEAR, PixelCanvas } from './canvas';
import { PAL } from './palette';
import type { EquipId } from '../data/equipment';

export type Orient = 'r' | 'ur' | 'u' | 'ul' | 'l' | 'dl' | 'd' | 'dr';
export const ORIENTS: readonly Orient[] = ['r', 'ur', 'u', 'ul', 'l', 'dl', 'd', 'dr'];

const VEC: Record<Orient, [number, number]> = {
  r: [1, 0],
  ur: [1, -1],
  u: [0, -1],
  ul: [-1, -1],
  l: [-1, 0],
  dl: [-1, 1],
  d: [0, 1],
  dr: [1, 1],
};

export interface WeaponSprite {
  pc: PixelCanvas;
  gx: number;
  gy: number;
}

const S = 56;
const C = 28;

function crop(pc: PixelCanvas, gx: number, gy: number): WeaponSprite {
  const b = pc.bounds();
  if (!b) return { pc: new PixelCanvas(1, 1), gx: 0, gy: 0 };
  const out = new PixelCanvas(b.w + 2, b.h + 2);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) out.set(x + 1, y + 1, pc.get(b.x + x, b.y + y));
  return { pc: out, gx: gx - b.x + 1, gy: gy - b.y + 1 };
}

/** 밝은 쪽 오프셋(좌상단 광원). */
function litOff(o: Orient): [number, number] {
  return o === 'u' || o === 'd' ? [-1, 0] : [0, -1];
}

function along(o: Orient, i: number): [number, number] {
  const [dx, dy] = VEC[o];
  return [C + dx * i, C + dy * i];
}

function perp(o: Orient): [number, number] {
  const [dx, dy] = VEC[o];
  return [-dy, dx];
}

function finish(pc: PixelCanvas): PixelCanvas {
  pc.outline(PAL.ink);
  return pc;
}

function drawSword(o: Orient): WeaponSprite {
  const pc = new PixelCanvas(S, S);
  const [lx, ly] = litOff(o);
  const [px, py] = perp(o);
  // 칼날(분침 모양): 가운데 은색, 밝은 가장자리 흰색, 어두운 쪽 강철색
  for (let i = 2; i <= 12; i++) {
    const [x, y] = along(o, i);
    pc.set(x, y, PAL.silver);
    if (i <= 11) pc.set(x + lx, y + ly, i < 9 ? PAL.white : PAL.silver);
    if (i >= 3 && i <= 10) pc.set(x - lx, y - ly, PAL.steel);
  }
  // 분침 끝의 잎 모양(넓어짐)
  for (const i of [8, 9]) {
    const [x, y] = along(o, i);
    pc.set(x + lx * 2, y + ly * 2, PAL.silver);
    pc.set(x - lx * 2, y - ly * 2, PAL.steel);
  }
  const [tx, ty] = along(o, 13);
  pc.set(tx, ty, PAL.white);
  // 코등이
  for (let k = -2; k <= 2; k++) {
    const [x, y] = along(o, 1);
    pc.set(x + px * k, y + py * k, Math.abs(k) === 2 ? PAL.yellow : PAL.gold);
  }
  // 손잡이·폼멜
  const [hx, hy] = along(o, 0);
  pc.set(hx, hy, PAL.brown);
  const [h2x, h2y] = along(o, -1);
  pc.set(h2x, h2y, PAL.dbrown);
  const [pmx, pmy] = along(o, -2);
  pc.set(pmx, pmy, PAL.gold);
  return crop(finish(pc), C, C);
}

function drawDagger(o: Orient): WeaponSprite {
  const pc = new PixelCanvas(S, S);
  const [lx, ly] = litOff(o);
  const [px, py] = perp(o);
  for (let i = 2; i <= 8; i++) {
    const [x, y] = along(o, i);
    pc.set(x, y, PAL.silver);
    if (i <= 6) pc.set(x + lx, y + ly, PAL.white);
  }
  const [tx, ty] = along(o, 9);
  pc.set(tx, ty, PAL.white);
  for (let k = -1; k <= 1; k++) {
    const [x, y] = along(o, 1);
    pc.set(x + px * k, y + py * k, PAL.gold);
  }
  const [hx, hy] = along(o, 0);
  pc.set(hx, hy, PAL.dbrown);
  // 초침 꼬리의 균형추(빨강 원)
  const [cx, cy] = along(o, -2);
  pc.disc(cx, cy, 1, PAL.red);
  pc.set(cx, cy, PAL.yellow);
  const [nx, ny] = along(o, -1);
  pc.set(nx, ny, PAL.crimson);
  return crop(finish(pc), C, C);
}

function drawHammer(o: Orient): WeaponSprite {
  const pc = new PixelCanvas(S, S);
  const [lx, ly] = litOff(o);
  // 자루
  for (let i = -3; i <= 9; i++) {
    const [x, y] = along(o, i);
    pc.set(x, y, PAL.copper);
    pc.set(x - lx, y - ly, PAL.brown);
  }
  const [pmx, pmy] = along(o, -4);
  pc.disc(pmx, pmy, 1, PAL.gold);
  // 머리: 방향에 맞춘 사각형을 다각형으로 채운다
  const [dx, dy] = VEC[o];
  const dl = Math.hypot(dx, dy);
  const ux = dx / dl;
  const uy = dy / dl;
  const vx = -uy;
  const vy = ux;
  const [bx, by] = along(o, 9);
  const L = 6;
  const Wd = 4.5;
  const head = new PixelCanvas(S, S);
  const corner = (a: number, b: number): [number, number] => [bx + 0.5 + ux * a + vx * b, by + 0.5 + uy * a + vy * b];
  head.poly([corner(-1, -Wd), corner(L, -Wd), corner(L, Wd), corner(-1, Wd)], PAL.copper);
  // 금띠 두 줄
  for (const a of [0.5, L - 1.5]) {
    for (let b = -Wd; b <= Wd; b += 0.5) {
      const [x, y] = corner(a, b);
      head.setIfFilled(Math.floor(x), Math.floor(y), PAL.gold);
    }
  }
  // 시침 문양(가운데 화살)
  const [ex, ey] = corner(L / 2 - 0.5, 0);
  head.setIfFilled(Math.floor(ex), Math.floor(ey), PAL.dbrown);
  head.shade([PAL.gold, PAL.dbrown]);
  pc.blit(head, 0, 0);
  return crop(finish(pc), C, C);
}

function drawAwl(o: Orient): WeaponSprite {
  const pc = new PixelCanvas(S, S);
  const [px, py] = perp(o);
  // 태엽 열쇠 손잡이
  const [kx, ky] = along(o, -3);
  pc.ring(kx, ky, 2, PAL.gold);
  pc.set(kx, ky, CLEAR);
  for (let i = -1; i <= 0; i++) {
    const [x, y] = along(o, i);
    pc.set(x, y, PAL.gold);
  }
  // 나선 송곳: 폭이 점점 좁아진다
  for (let i = 1; i <= 9; i++) {
    const [x, y] = along(o, i);
    const stripe = i % 2 === 0 ? PAL.silver : PAL.steel;
    pc.set(x, y, stripe);
    const half = i <= 3 ? 1 : i <= 6 ? 1 : 0;
    for (let k = 1; k <= half; k++) {
      pc.set(x + px * k, y + py * k, i % 2 === 0 ? PAL.steel : PAL.slate);
      pc.set(x - px * k, y - py * k, i % 2 === 0 ? PAL.white : PAL.silver);
    }
  }
  const [tx, ty] = along(o, 10);
  pc.set(tx, ty, PAL.white);
  return crop(finish(pc), C, C);
}

function drawWedge(o: Orient): WeaponSprite {
  const pc = new PixelCanvas(S, S);
  const [px, py] = perp(o);
  // 황동 머리
  for (let k = -2; k <= 2; k++) {
    const [x, y] = along(o, 0);
    pc.set(x + px * k, y + py * k, k === -2 ? PAL.yellow : PAL.gold);
  }
  const widths = [2, 2, 1, 1, 0];
  widths.forEach((wd, idx) => {
    const i = idx + 1;
    const [x, y] = along(o, i);
    for (let k = -wd; k <= wd; k++) {
      const col = k < 0 ? PAL.white : k === 0 ? PAL.cyan : PAL.blue;
      pc.set(x + px * k, y + py * k, col);
    }
  });
  const [tx, ty] = along(o, 6);
  pc.set(tx, ty, PAL.cyan);
  return crop(finish(pc), C, C);
}

/** 톱니 버클러 정면. */
export function drawBuckler(r = 6): WeaponSprite {
  const pc = new PixelCanvas(24, 24);
  const c = 12;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const x = Math.round(c + Math.cos(a) * (r + 1));
    const y = Math.round(c + Math.sin(a) * (r + 1));
    pc.rect(x - 1, y - 1, 2, 2, PAL.copper);
  }
  pc.disc(c, c, r, PAL.copper);
  pc.ring(c, c, r - 2, PAL.gold);
  pc.rect(c - 1, c - 1, 2, 2, PAL.yellow);
  pc.shade([PAL.gold, PAL.yellow]);
  pc.set(c - 1, c - 1, PAL.white);
  return crop(finish(pc), c, c);
}

/** 버클러를 옆으로 든 모습. */
function drawBucklerSide(): WeaponSprite {
  const pc = new PixelCanvas(12, 20);
  pc.rect(5, 3, 2, 13, PAL.copper);
  pc.set(5, 3, PAL.tan);
  pc.set(4, 5, PAL.copper);
  pc.set(4, 13, PAL.copper);
  pc.set(7, 9, PAL.gold);
  pc.set(6, 9, PAL.gold);
  return crop(finish(pc), 6, 9);
}

/** 종루 대방패 정면(문짝 + 종 문양). */
export function drawTower(w = 14, h = 22): WeaponSprite {
  const pc = new PixelCanvas(w + 4, h + 4);
  const x0 = 2;
  const y0 = 2;
  pc.rect(x0, y0 + 2, w, h - 2, PAL.brown);
  pc.rect(x0 + 1, y0 + 1, w - 2, 1, PAL.brown);
  pc.rect(x0 + 2, y0, w - 4, 1, PAL.brown);
  // 널빤지 줄눈
  for (let x = x0 + 3; x < x0 + w - 1; x += 3) pc.vline(x, y0 + 2, y0 + h - 1, PAL.dbrown);
  // 쇠띠
  const bands = [y0 + Math.round(h * 0.22), y0 + Math.round(h * 0.78)];
  for (const by of bands) {
    pc.hline(x0, x0 + w - 1, by, PAL.slate);
    for (let x = x0 + 1; x < x0 + w - 1; x += 4) pc.set(x, by, PAL.silver);
  }
  // 종 문양
  const cx = x0 + Math.floor(w / 2);
  const cy = y0 + Math.floor(h / 2);
  pc.rect(cx - 2, cy - 2, 4, 4, PAL.gold);
  pc.rect(cx - 3, cy + 1, 6, 2, PAL.gold);
  pc.set(cx - 1, cy - 3, PAL.gold);
  pc.set(cx, cy - 3, PAL.gold);
  pc.set(cx - 1, cy + 3, PAL.yellow);
  pc.set(cx - 2, cy - 1, PAL.yellow);
  pc.shade([PAL.slate, PAL.silver, PAL.dbrown, PAL.gold, PAL.yellow]);
  return crop(finish(pc), cx, cy);
}

function drawTowerSide(): WeaponSprite {
  const pc = new PixelCanvas(10, 28);
  pc.rect(4, 2, 3, 22, PAL.brown);
  pc.vline(4, 2, 23, PAL.copper);
  pc.set(5, 6, PAL.slate);
  pc.set(5, 19, PAL.slate);
  pc.set(6, 6, PAL.slate);
  pc.set(6, 19, PAL.slate);
  return crop(finish(pc), 5, 12);
}

/** 모래시계 약. tipped = 마실 때 기울임. */
export function drawTonic(tipped = false): WeaponSprite {
  const rows = ['kkkkk', 'kgggk', 'kwYYk', '.kYk.', '.kGk.', 'kwGGk', 'kGGGk', 'kgggk', 'kkkkk'];
  let pc = PixelCanvas.fromRows(rows);
  if (tipped) pc = pc.rotatedCW().rotatedCW().rotatedCW();
  return { pc, gx: Math.floor(pc.w / 2), gy: Math.floor(pc.h / 2) };
}

type Drawer = (o: Orient) => WeaponSprite;
const DRAW: Partial<Record<EquipId, Drawer>> = {
  sword: drawSword,
  dagger: drawDagger,
  hammer: drawHammer,
  awl: drawAwl,
  wedge: drawWedge,
};

export type WeaponView = Orient | 'front' | 'side' | 'tip';

/** 장비별로 필요한 모습 전부. */
export function weaponSprites(id: EquipId): Partial<Record<WeaponView, WeaponSprite>> {
  const out: Partial<Record<WeaponView, WeaponSprite>> = {};
  const d = DRAW[id];
  if (d) for (const o of ORIENTS) out[o] = d(o);
  if (id === 'buckler') {
    out.front = drawBuckler();
    out.side = drawBucklerSide();
  }
  if (id === 'tower') {
    out.front = drawTower();
    out.side = drawTowerSide();
  }
  if (id === 'tonic') {
    out.side = drawTonic(false);
    out.tip = drawTonic(true);
  }
  return out;
}

/** UI 아이콘(16x16 안에 들어가게). */
export function weaponIcon(id: EquipId): PixelCanvas {
  let s: WeaponSprite;
  switch (id) {
    case 'sword':
      s = drawSword('ur');
      break;
    case 'dagger':
      s = drawDagger('ur');
      break;
    case 'hammer':
      s = drawHammer('ur');
      break;
    case 'awl':
      s = drawAwl('ur');
      break;
    case 'wedge':
      s = drawWedge('ur');
      break;
    case 'buckler':
      s = drawBuckler(5);
      break;
    case 'tower':
      s = drawTower(9, 12);
      break;
    case 'tonic':
      s = drawTonic(false);
      break;
  }
  const N = 20;
  const out = new PixelCanvas(N, N);
  const src = s.pc;
  const ox = Math.floor((N - src.w) / 2);
  const oy = Math.floor((N - src.h) / 2);
  out.blit(src, ox, oy);
  return out;
}
