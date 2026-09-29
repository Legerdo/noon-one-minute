// 적 전투 스프라이트. 부품마다 따로 명암·외곽선을 넣어 내부 구조가 읽히게 한다. 모두 왼쪽(플레이어)을 향한다.
import { PixelCanvas, linePoints, rng } from './canvas';
import { PAL } from './palette';
import type { EnemyId } from '../data/enemies';

type Draw = (p: PixelCanvas) => void;

function part(target: PixelCanvas, draw: Draw, opts: { shade?: boolean; skip?: number[]; outline?: boolean } = {}): void {
  const p = new PixelCanvas(target.w, target.h);
  draw(p);
  if (opts.shade !== false) p.shade(opts.skip ?? []);
  if (opts.outline !== false) p.outline(PAL.ink);
  target.blit(p, 0, 0);
}

export function gear(
  p: PixelCanvas,
  cx: number,
  cy: number,
  r: number,
  teeth: number,
  phase: number,
  body: number,
  hub: number = PAL.dbrown,
): void {
  for (let k = 0; k < teeth; k++) {
    const a = phase + (k * Math.PI * 2) / teeth;
    const tx = Math.round(cx + Math.cos(a) * (r + 1));
    const ty = Math.round(cy + Math.sin(a) * (r + 1));
    p.rect(tx - 1, ty - 1, 2, 2, body);
  }
  p.disc(cx, cy, r, body);
  if (r >= 4) p.disc(cx, cy, Math.max(1, Math.floor(r / 3)), hub);
}

function glowEye(p: PixelCanvas, x: number, y: number, c: number = PAL.hotred): void {
  p.set(x, y, c);
  p.set(x + 1, y, c);
  p.set(x, y - 1, PAL.white);
}

function rodPoint(px: number, py: number, len: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round(px + Math.sin(a) * len), Math.round(py + Math.cos(a) * len)];
}

export interface EnemyArt {
  w: number;
  h: number;
  /** 발/중심 기준점(스프라이트 origin, 0~1). */
  ox: number;
  oy: number;
  /** 피격 지점(프레임 좌표). */
  hit: [number, number];
  poses: Record<string, number>;
  draw(pose: string, frame: number): PixelCanvas;
}

// ─────────────────────────── 연습 인형 ───────────────────────────
function dummy(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(44, 56);
  const wob = pose === 'idle' ? [0, 1][f % 2] : 0;
  let arm: [number, number] = [5, 27];
  let tilt = 0;
  if (pose === 'poke') {
    arm = [0, 25];
    tilt = -2;
  } else if (pose === 'wind') {
    arm = [14, 8];
    tilt = 1;
  } else if (pose === 'swing') {
    arm = [1, 38];
    tilt = -3;
  } else if (pose === 'hurt') tilt = 3;
  const cx = 22 + tilt + wob;
  // 받침
  part(pc, (p) => {
    p.rect(12, 51, 20, 3, PAL.brown);
    p.rect(20, 49, 4, 2, PAL.brown);
  });
  // 기둥
  part(pc, (p) => p.thick(22, 50, cx, 32, 3, PAL.copper));
  // 뒤팔
  part(pc, (p) => p.thick(cx + 6, 25, cx + 13, 22, 2, PAL.tan), { shade: false });
  // 몸통(자루) + 과녁
  part(
    pc,
    (p) => {
      p.ellipse(cx, 31, 8, 9, PAL.tan);
      if (pose === 'brace') {
        p.disc(cx - 1, 31, 5, PAL.copper);
      } else {
        p.disc(cx - 1, 31, 5, PAL.red);
        p.disc(cx - 1, 31, 3, PAL.cream);
        p.disc(cx - 1, 31, 1, PAL.red);
      }
      p.set(cx + 4, 25, PAL.copper);
      p.set(cx + 5, 36, PAL.copper);
    },
    { skip: [PAL.red, PAL.cream] },
  );
  // 태엽 열쇠
  part(
    pc,
    (p) => {
      p.hline(cx + 8, cx + 10, 22, PAL.gold);
      p.ring(cx + 12, 20, 2, PAL.gold);
      p.ring(cx + 12, 24, 2, PAL.gold);
    },
    { shade: false },
  );
  // 머리
  part(
    pc,
    (p) => {
      p.disc(cx, 14, 6, PAL.tan);
      p.set(cx - 3, 13, PAL.brown);
      p.set(cx - 2, 12, PAL.brown);
      p.set(cx - 2, 14, PAL.brown);
      p.set(cx - 4, 12, PAL.brown);
      p.set(cx - 4, 14, PAL.brown);
      p.set(cx + 1, 13, PAL.brown);
      p.hline(cx - 3, cx, 17, PAL.brown);
      p.set(cx + 2, 10, PAL.copper);
      p.set(cx + 3, 11, PAL.copper);
    },
    { skip: [PAL.brown] },
  );
  // 앞팔(짚)
  part(pc, (p) => {
    p.thick(cx - 6, 25, arm[0] + 2, arm[1], 2, PAL.tan);
    p.set(arm[0], arm[1], PAL.yellow);
    p.set(arm[0] + 1, arm[1] - 1, PAL.gold);
    p.set(arm[0] + 1, arm[1] + 1, PAL.gold);
  });
  if (pose === 'brace') part(pc, (p) => p.thick(cx - 6, 29, cx + 3, 29, 2, PAL.tan));
  return pc;
}

// ─────────────────────────── 태엽 쥐 ───────────────────────────
function rat(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(44, 30);
  let ox = 0;
  let oy = 0;
  let crouch = 0;
  let stretch = 0;
  let mouth = false;
  let hurt = false;
  if (pose === 'idle') oy = [0, 0, 1, 1][f % 4];
  else if (pose === 'wind') {
    crouch = 1;
    oy = f % 2;
  } else if (pose === 'bite') {
    ox = -4;
    mouth = true;
  } else if (pose === 'dash') {
    ox = -8;
    stretch = 2;
    mouth = true;
  } else if (pose === 'hurt') {
    ox = 4;
    hurt = true;
  }
  const bx = 25 + ox;
  const by = 18 + oy + crouch;
  // 꼬리(태엽 스프링)
  part(
    pc,
    (p) => {
      p.line(bx + 9, by + 1, bx + 13, by - 2, PAL.steel);
      p.line(bx + 13, by - 2, bx + 12, by - 6, PAL.steel);
      p.set(bx + 11, by - 7, PAL.steel);
      p.set(bx + 10, by - 6, PAL.steel);
    },
    { shade: false },
  );
  // 바퀴
  part(
    pc,
    (p) => {
      p.disc(bx - 6, 25, 2, PAL.dslate);
      p.disc(bx + 5, 25, 2, PAL.dslate);
      p.set(bx - 6, 25, PAL.gold);
      p.set(bx + 5, 25, PAL.gold);
    },
    { shade: false },
  );
  // 몸
  part(pc, (p) => {
    p.ellipse(bx, by, 9 + stretch, 6 - crouch, PAL.slate);
    const hx = bx - 9 - stretch;
    p.disc(hx, by + 1, 5, PAL.slate);
    p.poly(
      [
        [hx - 3, by - 2],
        [hx - 9, by + 3],
        [hx - 3, by + 5],
      ],
      PAL.slate,
    );
    p.ellipse(bx - 1, by + 3, 6, 2, PAL.steel);
    p.set(bx + 2, by - 3, PAL.silver);
    p.set(bx + 6, by - 1, PAL.silver);
    p.set(bx - 2, by - 4, PAL.silver);
  });
  // 귀
  part(
    pc,
    (p) => {
      p.disc(bx - 7 - stretch, by - 6 + crouch, 3, PAL.slate);
      p.disc(bx - 7 - stretch, by - 6 + crouch, 1, PAL.pink);
    },
    { skip: [PAL.pink] },
  );
  // 태엽 열쇠
  part(
    pc,
    (p) => {
      const kx = bx + 3;
      const ky = by - 7 + crouch;
      p.vline(kx, ky, ky + 2, PAL.gold);
      const ph = pose === 'wind' ? f % 2 : [0, 0, 1, 1][f % 4];
      if (ph === 0) {
        p.ring(kx - 3, ky - 2, 2, PAL.gold);
        p.ring(kx + 3, ky - 2, 2, PAL.gold);
      } else {
        p.vline(kx, ky - 5, ky - 1, PAL.gold);
        p.ring(kx, ky - 4, 1, PAL.yellow);
      }
    },
    { shade: false },
  );
  // 얼굴
  const hx = bx - 9 - stretch;
  if (hurt) {
    pc.set(hx - 2, by - 1, PAL.ink);
    pc.set(hx - 1, by, PAL.ink);
    pc.set(hx - 2, by + 1, PAL.ink);
  } else glowEye(pc, hx - 2, by, pose === 'wind' || pose === 'dash' ? PAL.yellow : PAL.hotred);
  pc.set(hx - 9, by + 3, PAL.pink);
  pc.set(hx - 10, by + 3, PAL.ink);
  if (mouth) {
    pc.hline(hx - 8, hx - 4, by + 4, PAL.ink);
    pc.set(hx - 6, by + 5, PAL.white);
  }
  return pc;
}

// ─────────────────────────── 놋쇠 파수병 ───────────────────────────
function halberd(p: PixelCanvas, x0: number, y0: number, x1: number, y1: number): void {
  // 자루
  for (const [x, y] of linePoints(x0, y0, x1, y1)) p.set(x, y, PAL.brown);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  // 날의 옆 방향(자루의 왼쪽/위쪽)
  let vx = uy;
  let vy = -ux;
  if (vy > 0 || (vy === 0 && vx > 0)) {
    vx = -vx;
    vy = -vy;
  }
  const at = (a: number, b: number): [number, number] => [x1 - ux * a + vx * b, y1 - uy * a + vy * b];
  // 창끝
  p.poly([at(-4, 0), at(1, 1.6), at(1, -1.6)], PAL.silver);
  // 도끼날(초승달)
  p.poly([at(2, 0), at(3, 5), at(6, 7), at(9, 5), at(8, 0)], PAL.steel);
  const [ex, ey] = at(5, 5.5);
  p.set(Math.round(ex), Math.round(ey), PAL.white);
  // 술
  const [tx, ty] = at(9, -1.5);
  p.set(Math.round(tx), Math.round(ty), PAL.red);
  p.set(Math.round(tx), Math.round(ty) + 1, PAL.crimson);
}

function sentry(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(52, 64);
  let ox = 0;
  let oy = 0;
  let hurt = false;
  let shaft: [number, number, number, number] = [12, 60, 12, 6];
  let hand: [number, number] = [13, 37];
  let steam = false;
  let eye: number = PAL.borange;
  switch (pose) {
    case 'idle':
      eye = f % 2 ? PAL.gold : PAL.borange;
      break;
    case 'aim':
      ox = -1;
      shaft = [44, 36, 2, 34];
      hand = [18, 35];
      eye = PAL.yellow;
      break;
    case 'raise':
      ox = 2;
      shaft = [26, 52, 42, 4];
      hand = [30, 30];
      eye = PAL.yellow;
      break;
    case 'slam':
      ox = -3;
      oy = 2;
      shaft = [34, 22, 3, 56];
      hand = [21, 38];
      break;
    case 'jab':
      ox = -4;
      shaft = [40, 34, -2, 33];
      hand = [16, 35];
      eye = PAL.yellow;
      break;
    case 'slump':
      oy = 2;
      shaft = [6, 60, 14, 12];
      hand = [13, 38];
      steam = true;
      eye = PAL.brown;
      break;
    case 'hurt':
      ox = 3;
      hurt = true;
      break;
  }
  const X = (x: number) => x + ox;
  const Y = (y: number) => y + oy;
  // 다리·발
  part(pc, (p) => {
    p.thick(X(22), Y(46), 20, 59, 2, PAL.dslate);
    p.thick(X(29), Y(46), 31, 59, 2, PAL.dslate);
    p.rect(16, 60, 7, 2, PAL.copper);
    p.rect(28, 60, 7, 2, PAL.copper);
  });
  // 뒤 어깨
  part(pc, (p) => p.disc(X(35), Y(28), 3, PAL.copper));
  // 허리판
  part(pc, (p) =>
    p.poly(
      [
        [X(17), Y(43)],
        [X(34), Y(43)],
        [X(36), Y(48)],
        [X(15), Y(48)],
      ],
      PAL.copper,
    ),
  );
  // 몸통(원통)
  part(
    pc,
    (p) => {
      p.rect(X(17), Y(26), 18, 18, PAL.copper);
      p.hline(X(17), X(34), Y(29), PAL.gold);
      p.hline(X(17), X(34), Y(41), PAL.gold);
      gear(p, X(26), Y(35), 3, 6, f * 0.3, PAL.gold, PAL.brown);
      for (let x = X(19); x <= X(33); x += 4) p.set(x, Y(27), PAL.cream);
    },
    { skip: [PAL.gold, PAL.cream, PAL.brown] },
  );
  // 목
  part(pc, (p) => p.rect(X(23), Y(22), 6, 4, PAL.dslate));
  // 투구(종 모양)
  part(
    pc,
    (p) => {
      p.poly(
        [
          [X(18), Y(23)],
          [X(18), Y(14)],
          [X(21), Y(9)],
          [X(31), Y(9)],
          [X(34), Y(14)],
          [X(34), Y(23)],
        ],
        PAL.copper,
      );
      p.disc(X(26), Y(10), 4, PAL.copper);
      p.hline(X(17), X(35), Y(22), PAL.gold);
    },
    { skip: [PAL.gold] },
  );
  // 투구 장식 깃
  part(
    pc,
    (p) => {
      const sway = pose === 'idle' ? f % 2 : 0;
      p.thick(X(26), Y(6), X(30 + sway), Y(2), 2, PAL.red);
      p.set(X(32 + sway), Y(2), PAL.red);
      p.set(X(31 + sway), Y(4), PAL.crimson);
    },
    { shade: false },
  );
  // 면갑 틈 + 눈
  pc.hline(X(18), X(28), Y(16), PAL.ink);
  pc.hline(X(18), X(27), Y(17), PAL.ink);
  if (hurt) {
    pc.set(X(20), Y(16), PAL.white);
    pc.set(X(21), Y(17), PAL.white);
  } else {
    pc.set(X(19), Y(16), eye);
    pc.set(X(20), Y(16), eye);
    pc.set(X(19), Y(17), eye);
  }
  // 할버드
  part(pc, (p) => halberd(p, X(shaft[0]), Y(shaft[1]), X(shaft[2]), Y(shaft[3])), { skip: [PAL.red, PAL.crimson] });
  // 앞 어깨 + 팔
  part(pc, (p) => {
    p.thick(X(17), Y(29), X(hand[0]), Y(hand[1]), 3, PAL.dslate);
    p.rect(X(hand[0]) - 1, Y(hand[1]) - 1, 3, 3, PAL.copper);
  });
  part(pc, (p) => p.disc(X(17), Y(28), 3, PAL.gold));
  if (steam) {
    const s = f % 2;
    pc.set(X(30), Y(4 - s), PAL.silver);
    pc.set(X(31), Y(3 - s), PAL.white);
    pc.set(X(33), Y(1 - s), PAL.silver);
  }
  return pc;
}

// ─────────────────────────── 진자 기사 ───────────────────────────
function knight(pose: string, f: number): PixelCanvas {
  // 진자검이 크게 휘둘러도 잘리지 않도록 여백(좌 12, 위 10)을 둔다.
  const pc = new PixelCanvas(88, 84);
  const BX = 12;
  const BY = 10;
  let ox = BX;
  let oy = BY;
  let hurt = false;
  // 진자검: 손 위치 + 각도(아래 = 0도, 양수 = 오른쪽/뒤)
  let hand: [number, number] = [22, 34];
  let ang = [-6, 0, 6, 0][f % 4];
  let len = 22;
  let glow: number = PAL.gold;
  switch (pose) {
    case 'ready':
      hand = [30, 32];
      ang = 135;
      break;
    case 'cut':
      ox += -3;
      hand = [16, 36];
      ang = -80;
      break;
    case 'guard':
      oy += 2;
      hand = [22, 28];
      ang = 0;
      len = 10;
      glow = PAL.cyan;
      break;
    case 'raise':
      ox += 2;
      hand = [34, 16];
      ang = 150;
      glow = PAL.yellow;
      break;
    case 'smash':
      ox += -4;
      oy += 3;
      hand = [18, 38];
      ang = -35;
      break;
    case 'slump':
      oy += 4;
      hand = [20, 42];
      ang = -12;
      len = 18;
      glow = PAL.brown;
      break;
    case 'hurt':
      ox += 4;
      hurt = true;
      ang = 20;
      break;
  }
  const X = (x: number) => x + ox;
  const Y = (y: number) => y + oy;
  // 땅에 붙은 발은 자세와 무관한 고정 좌표.
  const FX = (x: number) => x + BX;
  const FY = (y: number) => y + BY;
  // 망토
  part(pc, (p) => {
    p.poly(
      [
        [X(30), Y(24)],
        [X(46), Y(26)],
        [X(54), Y(60)],
        [X(50), Y(58)],
        [X(47), Y(62)],
        [X(43), Y(58)],
        [X(38), Y(60)],
      ],
      PAL.navy,
    );
    p.set(X(49), Y(56), PAL.night);
  });
  // 다리
  part(pc, (p) => {
    p.thick(X(38), Y(48), FX(46), FY(66), 4, PAL.slate);
    p.rect(FX(44), FY(67), 8, 3, PAL.dslate);
  });
  part(pc, (p) => {
    p.thick(X(29), Y(48), FX(23), FY(66), 4, PAL.steel);
    p.rect(FX(17), FY(67), 9, 3, PAL.slate);
    p.disc(X(26), Y(57), 2, PAL.silver);
  });
  // 뒤 어깨
  part(pc, (p) => p.disc(X(43), Y(27), 4, PAL.steel));
  // 몸통
  part(
    pc,
    (p) => {
      p.rect(X(24), Y(24), 20, 24, PAL.steel);
      p.rect(X(25), Y(23), 18, 1, PAL.steel);
      p.hline(X(24), X(43), Y(46), PAL.brown);
      p.rect(X(32), Y(45), 3, 3, PAL.gold);
    },
    { skip: [PAL.brown, PAL.gold] },
  );
  // 가슴 창 + 작은 진자
  part(
    pc,
    (p) => {
      p.disc(X(34), Y(34), 5, PAL.teal);
      const [bx, by] = rodPoint(X(34), Y(30), 6, [-25, 0, 25, 0][f % 4]);
      for (const [x, y] of linePoints(X(34), Y(30), bx, by)) p.set(x, y, PAL.gold);
      p.set(bx, by, PAL.yellow);
      p.set(bx + 1, by, PAL.gold);
      p.set(X(31), Y(31), PAL.cyan);
      p.set(X(32), Y(30), PAL.white);
    },
    { shade: false },
  );
  // 투구
  part(
    pc,
    (p) => {
      p.rect(X(27), Y(11), 14, 13, PAL.steel);
      p.rect(X(28), Y(10), 12, 1, PAL.steel);
      p.hline(X(27), X(40), Y(22), PAL.slate);
    },
    { skip: [PAL.slate] },
  );
  // 볏(분침 모양)
  part(
    pc,
    (p) => {
      p.vline(X(34), Y(3), Y(9), PAL.gold);
      p.set(X(33), Y(5), PAL.gold);
      p.set(X(35), Y(5), PAL.gold);
      p.set(X(34), Y(2), PAL.yellow);
    },
    { shade: false },
  );
  pc.hline(X(27), X(36), Y(16), PAL.ink);
  pc.hline(X(27), X(35), Y(17), PAL.ink);
  if (hurt) {
    pc.set(X(29), Y(16), PAL.white);
    pc.set(X(30), Y(17), PAL.white);
  } else {
    pc.set(X(28), Y(16), glow);
    pc.set(X(29), Y(16), glow);
  }
  // 진자검: 막대 + 원반 날
  const hx = X(hand[0]);
  const hy = Y(hand[1]);
  const [bx, by] = rodPoint(hx, hy, len, ang);
  part(
    pc,
    (p) => {
      p.thick(hx, hy, bx, by, 2, PAL.gold);
    },
    { shade: false },
  );
  part(
    pc,
    (p) => {
      p.disc(bx, by, 7, PAL.copper);
      p.ring(bx, by, 7, PAL.silver);
      p.disc(bx, by, 2, PAL.gold);
    },
    { skip: [PAL.silver, PAL.gold] },
  );
  pc.set(bx - 5, by - 3, PAL.white);
  // 앞 어깨 + 팔
  part(pc, (p) => p.thick(X(25), Y(28), hx, hy, 3, PAL.slate));
  part(pc, (p) => p.disc(X(25), Y(27), 5, PAL.silver));
  pc.rect(hx - 1, hy - 1, 3, 3, PAL.dslate);
  return pc;
}

// ─────────────────────────── 톱니 벌 ───────────────────────────
export function gearBee(f: number): PixelCanvas {
  const pc = new PixelCanvas(11, 11);
  part(
    pc,
    (p) => {
      if (f % 2 === 0) {
        p.ellipse(4, 2, 2, 1, PAL.silver);
        p.ellipse(7, 2, 2, 1, PAL.white);
      } else {
        p.ellipse(3, 4, 2, 1, PAL.silver);
        p.ellipse(8, 4, 2, 1, PAL.white);
      }
    },
    { shade: false },
  );
  part(pc, (p) => gear(p, 5, 6, 2, 6, f * 0.5, PAL.gold), { skip: [] });
  pc.set(3, 6, PAL.hotred);
  return pc;
}

export function queenGear(f: number, mood: 'calm' | 'angry' = 'calm'): PixelCanvas {
  const pc = new PixelCanvas(22, 22);
  part(pc, (p) => gear(p, 11, 11, 7, 10, f * 0.16, PAL.copper, PAL.brown));
  pc.disc(11, 11, 2, mood === 'angry' ? PAL.hotred : PAL.red);
  pc.set(10, 10, PAL.white);
  return pc;
}

// ─────────────────────────── 무쇠 거북 ───────────────────────────
function tortoise(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(80, 50);
  let ox = 0;
  let head: [number, number] | null = [9, 31];
  let legs = true;
  let spin = false;
  let mouth = false;
  let hurt = false;
  let smoke = f % 2;
  switch (pose) {
    case 'shell':
      head = null;
      break;
    case 'peek':
      head = [7, 29];
      break;
    case 'headbutt':
      ox = -6;
      head = [1, 34];
      mouth = true;
      break;
    case 'spin':
      ox = -3;
      legs = false;
      head = null;
      spin = true;
      break;
    case 'hurt':
      ox = 4;
      hurt = true;
      break;
    default:
      smoke = f % 2;
  }
  const X = (x: number) => x + ox;
  // 굴뚝 연기
  if (!spin) {
    part(
      pc,
      (p) => {
        p.disc(X(49 + smoke), 3 - smoke, 2, PAL.silver);
        p.disc(X(53 + smoke), 1, 1, PAL.steel);
      },
      { shade: false, outline: false },
    );
  }
  // 뒷다리
  if (legs) part(pc, (p) => p.ellipse(X(56), 42, 4, 5, PAL.slate));
  // 머리
  if (head) {
    const [hx, hy] = head;
    part(pc, (p) => {
      p.thick(X(18), 33, X(hx + 4), hy + 1, 5, PAL.slate);
      p.disc(X(hx), hy, 5, PAL.slate);
      if (mouth) p.rect(X(hx - 5), hy + 2, 5, 2, PAL.dslate);
    });
    if (hurt) {
      pc.set(X(hx - 2), hy - 2, PAL.ink);
      pc.set(X(hx - 1), hy - 1, PAL.ink);
    } else glowEye(pc, X(hx - 2), hy - 1, PAL.gold);
    pc.set(X(hx - 5), hy + 1, PAL.ink);
  }
  // 등껍질
  part(
    pc,
    (p) => {
      const cx = X(38);
      p.ellipse(cx, 33, 25, 19, PAL.dslate);
      p.rect(X(10), 34, 60, 20, -1);
      // 판 이음새
      const shift = spin ? (f % 2) * 4 : 0;
      for (let k = -2; k <= 2; k++) {
        const x = cx + k * 9 + shift;
        p.line(x, 17, x - (k > 0 ? -2 : 2), 33, PAL.night);
      }
      p.hline(X(18), X(58), 25, PAL.night);
      // 리벳
      for (let k = -3; k <= 3; k++) p.setIfFilled(cx + k * 7 + shift - 2, 21, PAL.silver);
      for (let k = -3; k <= 3; k++) p.setIfFilled(cx + k * 7 + shift + 1, 29, PAL.silver);
    },
    { skip: [PAL.night, PAL.silver] },
  );
  // 굴뚝
  if (!spin)
    part(pc, (p) => {
      p.rect(X(46), 8, 6, 8, PAL.slate);
      p.rect(X(45), 7, 8, 2, PAL.steel);
    });
  // 테두리(황동)
  part(
    pc,
    (p) => {
      p.rect(X(12), 33, 53, 4, PAL.copper);
      for (let x = X(14); x < X(64); x += 5) p.set(x, 34, PAL.gold);
    },
    { skip: [PAL.gold] },
  );
  // 앞다리
  if (legs) part(pc, (p) => p.ellipse(X(22), 42, 4, 5, PAL.slate));
  if (spin) {
    for (let k = 0; k < 3; k++) {
      const y = 22 + k * 7 + (f % 2) * 2;
      pc.hline(X(62), X(70), y, PAL.silver);
      pc.hline(X(4), X(10), y + 2, PAL.white);
    }
  }
  return pc;
}

// ─────────────────────────── 녹 주술사 ───────────────────────────
function hexer(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(56, 66);
  let oy = [0, -1, -2, -1][f % 4];
  let ox = 0;
  let frontHand: [number, number] = [14, 34];
  let backHand: [number, number] = [36, 34];
  let staffTip: [number, number] = [10, 12];
  let aura = false;
  let glowCol: number = PAL.orange;
  let hurt = false;
  switch (pose) {
    case 'cast':
      frontHand = [8, 28];
      staffTip = [2, 22];
      glowCol = PAL.borange;
      break;
    case 'shoot':
      ox = -2;
      frontHand = [6, 30];
      staffTip = [0, 30];
      glowCol = PAL.yellow;
      break;
    case 'veil':
      frontHand = [22, 32];
      backHand = [28, 32];
      staffTip = [30, 6];
      aura = true;
      break;
    case 'raise':
      oy -= 2;
      frontHand = [16, 14];
      backHand = [34, 14];
      staffTip = [14, 0];
      glowCol = PAL.yellow;
      break;
    case 'hurt':
      ox = 4;
      hurt = true;
      break;
  }
  const X = (x: number) => x + ox + 4;
  const Y = (y: number) => y + oy + 4;
  // 인형 줄
  const strings: [number, number][] = [
    [24, 10],
    [frontHand[0], frontHand[1]],
    [backHand[0], backHand[1]],
  ];
  for (const [sx, sy] of strings) {
    for (let y = 0; y < Y(sy); y += 1) if ((y + f) % 3 !== 0) pc.set(X(sx), y, PAL.slate);
  }
  if (aura) {
    part(
      pc,
      (p) => {
        p.ring(X(24), Y(32), 22, PAL.orange);
        p.ring(X(24), Y(32), 21, PAL.rust);
      },
      { shade: false, outline: false },
    );
  }
  // 뒷팔
  part(pc, (p) => {
    p.thick(X(31), Y(22), X(backHand[0]), Y(backHand[1]), 2, PAL.brown);
    p.disc(X(backHand[0]), Y(backHand[1]), 1, PAL.tan);
  });
  // 로브
  part(
    pc,
    (p) => {
      p.poly(
        [
          [X(24), Y(14)],
          [X(33), Y(20)],
          [X(37), Y(50)],
          [X(33), Y(56)],
          [X(29), Y(52)],
          [X(25), Y(57)],
          [X(21), Y(52)],
          [X(16), Y(56)],
          [X(11), Y(50)],
          [X(15), Y(20)],
        ],
        PAL.rust,
      );
      p.line(X(24), Y(24), X(22), Y(52), PAL.brown);
      p.line(X(16), Y(24), X(13), Y(48), PAL.orange);
      for (let x = X(13); x <= X(35); x += 3) p.setIfFilled(x, Y(49), PAL.orange);
    },
    { skip: [PAL.brown, PAL.orange] },
  );
  // 두건
  part(pc, (p) => {
    p.disc(X(24), Y(15), 8, PAL.plum);
    p.rect(X(16), Y(17), 17, 6, -1);
  });
  // 시계 가면
  part(
    pc,
    (p) => {
      p.disc(X(24), Y(17), 6, PAL.cream);
      p.ring(X(24), Y(17), 6, PAL.gold);
      p.vline(X(24), Y(12), Y(17), PAL.brown);
      p.line(X(24), Y(17), X(22), Y(14), PAL.brown);
      p.set(X(21), Y(18), PAL.ink);
      p.set(X(27), Y(18), PAL.ink);
      p.set(X(21), Y(19), hurt ? PAL.ink : glowCol);
      p.set(X(27), Y(19), hurt ? PAL.ink : glowCol);
      if (hurt) p.line(X(26), Y(12), X(28), Y(21), PAL.white);
    },
    { shade: false },
  );
  // 지팡이
  part(
    pc,
    (p) => {
      for (const [x, y] of linePoints(X(frontHand[0]), Y(frontHand[1]) + 8, X(staffTip[0]), Y(staffTip[1]))) p.set(x, y, PAL.brown);
    },
    { shade: false },
  );
  part(pc, (p) => gear(p, X(staffTip[0]), Y(staffTip[1]), 3, 7, f * 0.4, PAL.rust, PAL.brown));
  pc.set(X(staffTip[0]), Y(staffTip[1]), glowCol);
  // 앞팔
  part(pc, (p) => {
    p.thick(X(17), Y(22), X(frontHand[0]), Y(frontHand[1]), 2, PAL.rust);
    p.disc(X(frontHand[0]), Y(frontHand[1]), 1, PAL.tan);
  });
  return pc;
}

// ─────────────────────────── 녹슨 대진자 ───────────────────────────
function boss(pose: string, f: number): PixelCanvas {
  const pc = new PixelCanvas(136, 150);
  const C = { x: 68, y: 48 };
  let ang = [-7, -3, 3, 7, 3, -3][f % 6];
  let eye: 'open' | 'closed' | 'red' | 'dark' = 'open';
  let guardGears = false;
  let steam = false;
  let bell = false;
  let spray = false;
  let handsA = [-6, -1];
  let rim: number = PAL.gold;
  switch (pose) {
    case 'pull':
      ang = 40;
      break;
    case 'swing':
      ang = -48;
      break;
    case 'guard':
      ang = 0;
      eye = 'closed';
      guardGears = true;
      break;
    case 'raise':
      ang = 72;
      eye = 'red';
      break;
    case 'quake':
      ang = -12;
      eye = 'red';
      break;
    case 'frenzy':
      ang = [-16, 14][f % 2];
      handsA = [f % 2 ? 120 : 250, f % 2 ? 300 : 40];
      eye = 'red';
      break;
    case 'overheat':
      ang = 0;
      steam = true;
      rim = PAL.borange;
      eye = 'red';
      break;
    case 'bell':
      ang = [-3, 3][f % 2];
      bell = true;
      eye = 'dark';
      break;
    case 'burst':
      ang = -8;
      spray = true;
      eye = 'red';
      break;
    case 'hurt':
      ang = 18;
      eye = 'closed';
      break;
  }
  // 뒤 톱니
  part(pc, (p) => gear(p, 22, 34, 16, 12, f * 0.13, PAL.brown, PAL.dbrown));
  part(pc, (p) => gear(p, 114, 64, 13, 10, -f * 0.16, PAL.copper, PAL.brown));
  part(pc, (p) => gear(p, 104, 18, 8, 8, f * 0.22, PAL.brown, PAL.dbrown));
  // 진자
  const pivot = { x: C.x, y: C.y + 30 };
  const [bx, by] = rodPoint(pivot.x, pivot.y, 46, ang);
  part(
    pc,
    (p) => {
      p.thick(pivot.x, pivot.y, bx, by, 3, PAL.copper);
    },
    { skip: [] },
  );
  if (bell) {
    part(
      pc,
      (p) => {
        p.poly(
          [
            [bx - 5, by - 12],
            [bx + 5, by - 12],
            [bx + 8, by + 4],
            [bx + 13, by + 10],
            [bx - 13, by + 10],
            [bx - 8, by + 4],
          ],
          PAL.plum,
        );
        p.disc(bx, by - 12, 4, PAL.plum);
        p.hline(bx - 12, bx + 12, by + 8, PAL.magenta);
        p.disc(bx, by + 12, 2, PAL.gold);
      },
      { skip: [PAL.magenta, PAL.gold] },
    );
  } else {
    part(
      pc,
      (p) => {
        p.disc(bx, by, 14, PAL.copper);
        p.ring(bx, by, 11, PAL.gold);
        p.disc(bx, by, 4, PAL.gold);
        // 녹
        p.setIfFilled(bx + 6, by + 8, PAL.rust);
        p.setIfFilled(bx + 7, by + 7, PAL.rust);
        p.setIfFilled(bx + 5, by + 9, PAL.brown);
        p.setIfFilled(bx - 8, by + 6, PAL.rust);
      },
      { skip: [PAL.gold, PAL.rust] },
    );
    pc.set(bx - 7, by - 7, PAL.white);
    pc.set(bx - 6, by - 8, PAL.white);
  }
  // 시계 테두리
  part(
    pc,
    (p) => {
      p.disc(C.x, C.y, 36, rim);
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        p.set(Math.round(C.x + Math.cos(a) * 34), Math.round(C.y + Math.sin(a) * 34), PAL.brown);
      }
    },
    { skip: [PAL.brown] },
  );
  // 문자판
  part(
    pc,
    (p) => {
      p.disc(C.x, C.y, 31, eye === 'dark' ? PAL.dslate : PAL.cream);
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6 - Math.PI / 2;
        const r0 = k % 3 === 0 ? 23 : 25;
        for (let r = r0; r <= 28; r++) p.set(Math.round(C.x + Math.cos(a) * r), Math.round(C.y + Math.sin(a) * r), PAL.brown);
      }
      // 녹: 아래쪽에서 번져 올라오는 불규칙한 얼룩(작은 원 여러 개의 합)
      const r = rng(77);
      const blobs: [number, number, number][] = [];
      for (let k = 0; k < 26; k++) {
        const a = Math.PI * (0.15 + r() * 0.7);
        const d = 12 + r() * 18;
        blobs.push([Math.round(C.x + Math.cos(a) * d * (r() < 0.5 ? -1 : 1)), Math.round(C.y + Math.sin(a) * d), 1 + Math.floor(r() * 3)]);
      }
      blobs.push([C.x - 22, C.y - 8, 2], [C.x - 20, C.y - 12, 1], [C.x + 18, C.y - 18, 1]);
      const mask = new PixelCanvas(p.w, p.h);
      for (const [x, y, rr] of blobs) mask.disc(x, y, rr, PAL.rust);
      for (let yy = 0; yy < p.h; yy++)
        for (let xx = 0; xx < p.w; xx++) {
          if (mask.get(xx, yy) === -1 || p.get(xx, yy) === -1) continue;
          const edge = mask.get(xx - 1, yy) === -1 || mask.get(xx + 1, yy) === -1 || mask.get(xx, yy - 1) === -1;
          p.set(xx, yy, edge ? ((xx + yy) % 2 ? PAL.orange : PAL.tan) : (xx * 7 + yy * 3) % 5 === 0 ? PAL.brown : PAL.rust);
        }
      // 금
      p.line(C.x + 6, C.y - 30, C.x + 12, C.y - 16, PAL.white);
      p.line(C.x + 12, C.y - 16, C.x + 22, C.y - 12, PAL.white);
      p.line(C.x + 12, C.y - 16, C.x + 10, C.y - 6, PAL.silver);
    },
    { shade: false },
  );
  // 시곗바늘
  const hand = (deg: number, len: number, c: number, w: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    const ex = Math.round(C.x + Math.cos(a) * len);
    const ey = Math.round(C.y + Math.sin(a) * len);
    pc.thick(C.x, C.y, ex, ey, w, c);
  };
  hand(handsA[0], 24, PAL.dbrown, 2);
  hand(handsA[1], 15, PAL.ink, 3);
  // 눈
  if (eye === 'closed') {
    pc.hline(C.x - 7, C.x + 7, C.y, PAL.ink);
    pc.set(C.x - 8, C.y - 1, PAL.ink);
    pc.set(C.x + 8, C.y - 1, PAL.ink);
  } else {
    // 녹의 눈: 붉게 빛나는 홍채 + 세로 동공, 눈가의 녹빛 핏줄
    const iris = eye === 'dark' ? PAL.magenta : eye === 'red' ? PAL.hotred : PAL.red;
    pc.ellipse(C.x, C.y, 10, 6, eye === 'dark' ? PAL.night : PAL.cream);
    pc.ellipse(C.x, C.y, 9, 5, eye === 'dark' ? PAL.night : PAL.white);
    pc.disc(C.x - 1, C.y, 4, iris);
    pc.disc(C.x - 1, C.y, 2, eye === 'red' ? PAL.red : PAL.crimson);
    pc.vline(C.x - 1, C.y - 3, C.y + 3, PAL.ink);
    pc.set(C.x - 3, C.y - 2, PAL.white);
    pc.set(C.x - 4, C.y - 2, PAL.white);
    if (eye !== 'dark') {
      pc.line(C.x + 5, C.y - 3, C.x + 8, C.y - 2, PAL.pink);
      pc.line(C.x + 5, C.y + 3, C.x + 8, C.y + 2, PAL.pink);
      pc.line(C.x - 7, C.y + 3, C.x - 9, C.y + 1, PAL.pink);
    }
    const lid = new PixelCanvas(pc.w, pc.h);
    lid.ellipse(C.x, C.y, 10, 6, PAL.ink);
    lid.ellipse(C.x, C.y, 9, 5, -1);
    pc.blit(lid, 0, 0);
    // 무거운 눈꺼풀(위쪽 두 줄)
    pc.hline(C.x - 8, C.x + 8, C.y - 6, PAL.ink);
    pc.hline(C.x - 6, C.x + 6, C.y - 7, PAL.dbrown);
  }
  // 테두리 위로 부러진 톱니 가시(왕관처럼)
  for (const a of [-2.2, -1.85, -1.57, -1.29, -0.94]) {
    const bx0 = Math.round(C.x + Math.cos(a) * 35);
    const by0 = Math.round(C.y + Math.sin(a) * 35);
    const bx1 = Math.round(C.x + Math.cos(a) * 42);
    const by1 = Math.round(C.y + Math.sin(a) * 42);
    pc.thick(bx0, by0, bx1, by1, 2, a === -1.57 ? PAL.rust : PAL.brown);
    pc.set(bx1, by1, PAL.orange);
  }
  // 녹 촛농: 테두리 아래로 흘러내리는 줄기(프레임마다 한 픽셀씩 자라며 떨어진다)
  part(
    pc,
    (p) => {
      const drips: [number, number, number][] = [
        [C.x - 20, C.y + 30, 7],
        [C.x - 9, C.y + 34, 5],
        [C.x + 7, C.y + 34, 9],
        [C.x + 19, C.y + 28, 6],
        [C.x + 27, C.y + 20, 4],
      ];
      drips.forEach(([x, y, len], i) => {
        const l = len + ((f + i) % 3);
        p.rect(x, y, 2, l, i % 2 ? PAL.brown : PAL.rust);
        p.set(x, y + l, PAL.orange);
        p.set(x + 1, y + l, PAL.rust);
      });
    },
    { skip: [PAL.orange] },
  );
  if (guardGears) {
    part(pc, (p) => gear(p, C.x - 20, C.y + 6, 13, 10, f * 0.3, PAL.gold, PAL.brown));
    part(pc, (p) => gear(p, C.x + 8, C.y + 12, 11, 9, -f * 0.3, PAL.copper, PAL.brown));
  }
  if (steam) {
    for (let k = 0; k < 5; k++) {
      const sx = C.x - 30 + k * 15 + (f % 2) * 2;
      const sy = C.y - 38 - ((k * 3 + f) % 4);
      pc.disc(sx, sy, 2, PAL.silver);
      pc.set(sx - 1, sy - 1, PAL.white);
    }
  }
  if (spray) {
    for (let k = 0; k < 7; k++) {
      const sy = C.y - 6 + k * 3;
      pc.hline(C.x - 44 - (k % 3) * 4, C.x - 36, sy, k % 2 ? PAL.rust : PAL.orange);
    }
  }
  return pc;
}

export const ENEMY_ART: Record<EnemyId, EnemyArt> = {
  dummy: {
    w: 44,
    h: 56,
    ox: 0.5,
    oy: 1,
    hit: [20, 30],
    poses: { idle: 2, poke: 1, brace: 1, wind: 1, swing: 1, hurt: 1 },
    draw: dummy,
  },
  rat: {
    w: 44,
    h: 30,
    ox: 0.5,
    oy: 1,
    hit: [18, 18],
    poses: { idle: 4, wind: 2, bite: 1, dash: 1, hurt: 1 },
    draw: rat,
  },
  sentry: {
    w: 52,
    h: 64,
    ox: 0.5,
    oy: 1,
    hit: [24, 32],
    poses: { idle: 2, aim: 1, raise: 1, slam: 1, jab: 1, slump: 2, hurt: 1 },
    draw: sentry,
  },
  knight: {
    w: 88,
    h: 84,
    ox: 46 / 88,
    oy: 1,
    hit: [46, 44],
    poses: { idle: 4, ready: 1, cut: 1, guard: 1, raise: 1, smash: 1, slump: 1, hurt: 1 },
    draw: knight,
  },
  swarm: {
    w: 22,
    h: 22,
    ox: 0.5,
    oy: 0.5,
    hit: [11, 11],
    poses: { idle: 4 },
    draw: (_p, f) => queenGear(f),
  },
  tortoise: {
    w: 80,
    h: 50,
    ox: 0.5,
    oy: 1,
    hit: [36, 28],
    poses: { idle: 2, shell: 2, peek: 1, headbutt: 1, spin: 2, hurt: 1 },
    draw: tortoise,
  },
  hexer: {
    w: 56,
    h: 66,
    ox: 0.5,
    oy: 1,
    hit: [28, 30],
    poses: { idle: 4, cast: 1, shoot: 1, veil: 2, raise: 1, hurt: 1 },
    draw: hexer,
  },
  boss: {
    w: 136,
    h: 150,
    ox: 0.5,
    oy: 1,
    hit: [68, 50],
    poses: { idle: 6, pull: 1, swing: 1, guard: 2, raise: 1, quake: 1, frenzy: 2, overheat: 2, bell: 2, burst: 1, hurt: 1 },
    draw: boss,
  },
};

/** 행동 → (준비 자세, 실행 자세). */
export const ACTION_POSE: Record<EnemyId, Record<string, [string, string]>> = {
  dummy: { poke: ['idle', 'poke'], brace: ['brace', 'brace'], big: ['wind', 'swing'] },
  rat: { gnaw: ['idle', 'bite'], wind: ['wind', 'wind'], dash: ['wind', 'dash'] },
  sentry: { aim: ['aim', 'aim'], slam: ['raise', 'slam'], breathe: ['slump', 'slump'], jab: ['aim', 'jab'] },
  knight: { cut: ['ready', 'cut'], guard: ['guard', 'guard'], great: ['raise', 'smash'], tired: ['slump', 'slump'] },
  swarm: { sting: ['idle', 'idle'], scatter: ['idle', 'idle'], storm: ['idle', 'idle'], regroup: ['idle', 'idle'] },
  tortoise: { shell: ['shell', 'shell'], headbutt: ['peek', 'headbutt'], peek: ['peek', 'peek'], spin: ['shell', 'spin'] },
  hexer: { rust: ['cast', 'cast'], bolt: ['idle', 'shoot'], veil: ['veil', 'veil'], rain: ['raise', 'raise'] },
  boss: {
    swing: ['pull', 'swing'],
    guard: ['guard', 'guard'],
    quake: ['raise', 'quake'],
    frenzy: ['frenzy', 'frenzy'],
    overheat: ['overheat', 'overheat'],
    bell: ['bell', 'bell'],
    burst: ['idle', 'burst'],
  },
};
