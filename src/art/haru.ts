// 주인공 하루: 탐험용 16x20 4방향, 전투용 48x48 포즈(몸통+팔+목도리). 무기는 별도 레이어.
import { PixelCanvas, linePoints } from './canvas';
import { PAL } from './palette';

// ───────────────────────── 탐험 스프라이트 ─────────────────────────
const OW_FRONT_TOP = [
  '................',
  '.....kkkkkk.....',
  '....krrcrrrk....',
  '...krcrrrrrrk...',
  '...krrrrrrrrk...',
  '..krrbrrrrbrrk..',
  '..krbffffffbrk..',
  '..kbffkffkffbk..',
  '..kbffkffkffbk..',
  '...kfFffffFfk...',
  '....kkffffkk....',
  '...kCRRRRRRCk...',
  '..kNCRRRRRRCNk..',
  '..kBNNNgNNNNNk..',
];
const OW_FRONT_ARMS = [
  ['.kfkNNNNNNgNkfk.', '.kfkrrrgrrrrkfk.', '..kkNNNNNNNNkk..'],
  ['.kkkNNNNNNgNkfk.', '.kfkrrrgrrrrkfk.', '..kkNNNNNNNNkk..'],
  ['.kfkNNNNNNgNkkk.', '.kfkrrrgrrrrkfk.', '..kkNNNNNNNNkk..'],
];
const OW_BACK_TOP = [
  '................',
  '.....kkkkkk.....',
  '....krrcrrrk....',
  '...krcrrrrrrk...',
  '...krrrrrrrrk...',
  '..krrrrrrrrrrk..',
  '..krrrcrrrrrrk..',
  '..kbrrrrrrrrbk..',
  '..kbbrrrrrrbbk..',
  '...kbbrrrrbbk...',
  '....kkbbbbkk....',
  '...kCRRRRRRCk...',
  '..kNCCRRRRCCNk..',
  '..kBNNCRRCNNNk..',
];
const OW_BACK_ARMS = [
  ['.kfkNNNCRNNNkfk.', '.kfkrrrCRrrrkfk.', '..kkNNNCNNNNkk..'],
  ['.kkkNNNCRNNNkfk.', '.kfkrrrCRrrrkfk.', '..kkNNNCNNNNkk..'],
  ['.kfkNNNCRNNNkkk.', '.kfkrrrCRrrrkfk.', '..kkNNNCNNNNkk..'],
];
const OW_LEGS = [
  ['...kddk..kddk...', '...kbbk..kbbk...', '...kkkk..kkkk...'],
  ['...kddk..kddk...', '...kbbk..kkkk...', '...kkkk.........'],
  ['...kddk..kddk...', '...kkkk..kbbk...', '.........kkkk...'],
];
const OW_SIDE_TOP = [
  '................',
  '......kkkkk.....',
  '....kkrrrrrk....',
  '...krrcrrrrrk...',
  '...krcrrrrrrrk..',
  '..krrrrrrrbrrk..',
  '..krrrrrbffbfk..',
  '..kbrrrbfffkfk..',
  '..kbbrbffffkfk..',
  '...kbbfFffffk...',
  '....kbkffffk....',
  '...kCRRRRRk.....',
];
const OW_SIDE_MID = [
  ['.kCCRRRRRRNk....', 'kCCkBNNNNgNk....', '.kk.kBNNfNNk....', '....krrgrrrk....', '....kNNNNNNk....'],
  ['.kCCRRRRRRNk....', 'kCkkBNNNNgNk....', '.k..kBNfNNNk....', '....krrgrrrk....', '....kNNNNNNk....'],
  ['..kCRRRRRRNk....', '.kCCkBNNNgNk....', 'kCk.kBNNNfNk....', '.k..krrgrrrk....', '....kNNNNNNk....'],
];
const OW_SIDE_LEGS = [
  ['....kddkddk.....', '....kbbkbbbk....', '....kkkkkkkk....'],
  ['...kddk.kddk....', '..kbbk...kbbk...', '..kkkk...kkkkk..'],
  ['....kddkddk.....', '....kbbkbbbk....', '....kkkkkkkk....'],
];

/** 탐험 프레임: dir(0=아래,1=위,2=오른쪽) × 3프레임(정지, 걸음A, 걸음B). 왼쪽은 오른쪽 반전. */
export function haruOverworld(): PixelCanvas[][] {
  const out: PixelCanvas[][] = [];
  const build = (top: string[], mid: string[], legs: string[], bob: number) => {
    const rows = [...top, ...mid, ...legs];
    const src = PixelCanvas.fromRows(rows);
    const pc = new PixelCanvas(16, 21);
    pc.blit(src, 0, 1 - bob);
    return pc;
  };
  out.push([0, 1, 2].map((f) => build(OW_FRONT_TOP, OW_FRONT_ARMS[f], OW_LEGS[f], f === 0 ? 0 : 1)));
  out.push([0, 1, 2].map((f) => build(OW_BACK_TOP, OW_BACK_ARMS[f], OW_LEGS[f], f === 0 ? 0 : 1)));
  out.push([0, 1, 2].map((f) => build(OW_SIDE_TOP, OW_SIDE_MID[f], OW_SIDE_LEGS[f], f === 1 ? 1 : 0)));
  return out;
}

// ───────────────────────── 전투 스프라이트 ─────────────────────────
const HEAD = [
  '....kkkkk....',
  '..kkrrrrrkk..',
  '.krrrcrrrrrk.',
  'krrrcrrrrcrrk',
  'krrcrrrrrrrrk',
  'krrrrrrrbrrbk',
  'krrrrrbffbffk',
  'kbrrrbffffkfk',
  '.kbrbfffffkfk',
  '.kbbfFfffffk.',
  '..kbfFFffffk.',
  '...kkffffkk..',
];
const COAT = [
  '...kRRRRk...',
  '..kCRRRRRk..',
  '.kNCRRRRCNk.',
  'kBNNCRRCNNNk',
  'kBNNNCCNNgNk',
  'kBNNNNNNNNNk',
  'kBNNNNNNNgNk',
  'kBNNNNNNNNNk',
  'krrrrrgrrrrk',
  'kBNNNNNNNgNk',
  'kdNNNNNNNNdk',
  '.kdNNNNNNdk.',
];
const BOOT = ['kbbk.', 'kbrbk', 'kkkkk'];

type P = readonly [number, number];

export type BodyPose =
  | 'idle0'
  | 'idle1'
  | 'idle2'
  | 'idle3'
  | 'ready'
  | 'readyLow'
  | 'windup'
  | 'windupHi'
  | 'strike'
  | 'slam'
  | 'guard'
  | 'drink'
  | 'cast'
  | 'hurt'
  | 'kneel'
  | 'cheer';

interface PoseSpec {
  /** 코트 좌상단(프레임 좌표). */
  coat: P;
  head: P;
  hurt?: boolean;
  legs: [P[], P[]]; // [뒷다리, 앞다리] 관절 목록(엉덩이→무릎→발목)
  backArm: P[];
  frontArm: P[];
  scarf: number;
  /** 앞손 위치 = 무기 잡는 점. */
  hand: P;
}

export const BODY_FRAME = 48;
/** 발 기준점(스프라이트 origin). */
export const BODY_ORIGIN: P = [20, 46];

function pose(
  dx: number,
  dy: number,
  o: {
    head?: P;
    hurt?: boolean;
    legs?: [P[], P[]];
    backHand?: P;
    backElbow?: P;
    frontHand: P;
    frontElbow?: P;
    scarf?: number;
  },
): PoseSpec {
  const cx = 14 + dx;
  const cy = 29 + dy;
  const rel = (p: P): P => [cx + p[0], cy + p[1]];
  // 다리는 발이 땅에 붙어 있도록 기본 코트 위치(14,29) 기준으로 둔다.
  const base = (list: P[]): P[] => list.map((p) => [p[0] + 14, p[1] + 29] as P);
  const src = o.legs ?? LEGS_STAND;
  const legs: [P[], P[]] = [base(src[0]), base(src[1])];
  const fs = rel([8, 3]);
  const bs = rel([3, 3]);
  const fh = rel(o.frontHand);
  const bh = rel(o.backHand ?? [2, 9]);
  return {
    coat: [cx, cy],
    head: o.head ? rel(o.head) : rel([0, -11]),
    hurt: o.hurt,
    legs,
    backArm: o.backElbow ? [bs, rel(o.backElbow), bh] : [bs, bh],
    frontArm: o.frontElbow ? [fs, rel(o.frontElbow), fh] : [fs, fh],
    scarf: o.scarf ?? 0,
    hand: fh,
  };
}

// 다리 좌표는 (14,29) 기준 상대값.
const LEGS_STAND: [P[], P[]] = [
  [
    [4, 11],
    [4, 15],
  ],
  [
    [8, 11],
    [8, 15],
  ],
];
const LEGS_LUNGE: [P[], P[]] = [
  [
    [5, 11],
    [2, 13],
    [0, 15],
  ],
  [
    [9, 11],
    [12, 13],
    [12, 15],
  ],
];
const LEGS_BRACE: [P[], P[]] = [
  [
    [4, 11],
    [2, 13],
    [2, 15],
  ],
  [
    [8, 11],
    [10, 13],
    [10, 15],
  ],
];
const LEGS_KNEEL: [P[], P[]] = [
  [
    [4, 13],
    [2, 16],
    [-2, 15],
  ],
  [
    [8, 13],
    [12, 12],
    [12, 15],
  ],
];

const POSES: Record<BodyPose, PoseSpec> = {
  idle0: pose(0, 0, { legs: LEGS_STAND, frontHand: [10, 9], frontElbow: [10, 6], scarf: 0 }),
  idle1: pose(0, 0, { legs: LEGS_STAND, frontHand: [10, 9], frontElbow: [10, 6], scarf: 1 }),
  idle2: pose(0, 1, { legs: LEGS_STAND, frontHand: [10, 9], frontElbow: [10, 6], scarf: 2 }),
  idle3: pose(0, 1, { legs: LEGS_STAND, frontHand: [10, 9], frontElbow: [10, 6], scarf: 3 }),
  ready: pose(0, 1, { legs: LEGS_BRACE, frontHand: [13, 5], frontElbow: [11, 7], backHand: [5, 8], scarf: 1 }),
  readyLow: pose(0, 1, { legs: LEGS_BRACE, frontHand: [14, 7], frontElbow: [11, 7], backHand: [6, 8], scarf: 2 }),
  windup: pose(-1, 1, {
    legs: LEGS_BRACE,
    head: [0, -11],
    frontHand: [4, -5],
    frontElbow: [6, 0],
    backHand: [0, 7],
    scarf: 2,
  }),
  windupHi: pose(-2, 2, {
    legs: LEGS_BRACE,
    head: [0, -11],
    frontHand: [2, -8],
    frontElbow: [5, -2],
    backHand: [-1, 6],
    scarf: 3,
  }),
  strike: pose(3, 2, { legs: LEGS_LUNGE, head: [1, -11], frontHand: [18, 4], frontElbow: [13, 4], backHand: [0, 6], scarf: 0 }),
  slam: pose(3, 3, {
    legs: LEGS_LUNGE,
    head: [2, -10],
    frontHand: [16, 9],
    frontElbow: [13, 6],
    backHand: [1, 8],
    scarf: 1,
  }),
  guard: pose(0, 2, { legs: LEGS_BRACE, frontHand: [12, 5], frontElbow: [11, 8], backHand: [5, 7], scarf: 3 }),
  drink: pose(0, 0, { legs: LEGS_STAND, head: [0, -11], frontHand: [11, -2], frontElbow: [12, 4], scarf: 0 }),
  cast: pose(1, 1, { legs: LEGS_BRACE, frontHand: [17, 0], frontElbow: [12, 3], backHand: [2, 7], scarf: 2 }),
  hurt: pose(-3, 1, {
    legs: LEGS_BRACE,
    head: [-2, -11],
    hurt: true,
    frontHand: [4, 3],
    frontElbow: [7, 6],
    backHand: [-2, 4],
    scarf: 3,
  }),
  kneel: pose(0, 4, { legs: LEGS_KNEEL, head: [1, -10], hurt: true, frontHand: [12, 9], frontElbow: [11, 6], scarf: 0 }),
  cheer: pose(0, 0, { legs: LEGS_STAND, frontHand: [10, -9], frontElbow: [10, -3], backHand: [1, 9], scarf: 1 }),
};

function limb(target: PixelCanvas, pts: readonly P[], width: number, color: number, shadeColor: number, end?: number): void {
  const tmp = new PixelCanvas(target.w, target.h);
  for (let i = 0; i + 1 < pts.length; i++) tmp.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], width, color);
  // 아랫면 음영: 각 점 아래쪽 픽셀을 어둡게
  for (let y = tmp.h - 1; y >= 0; y--)
    for (let x = 0; x < tmp.w; x++) if (tmp.get(x, y) === color && tmp.get(x, y + 1) === -1) tmp.set(x, y, shadeColor);
  if (end != null) {
    const last = pts[pts.length - 1];
    tmp.rect(last[0], last[1], 2, 2, end);
  }
  tmp.outline(PAL.ink);
  target.blit(tmp, 0, 0);
}

function scarfTail(target: PixelCanvas, root: P, phase: number): void {
  const tmp = new PixelCanvas(target.w, target.h);
  const wave = [0, 1, 1, 0][phase % 4];
  const wave2 = [1, 0, -1, 0][phase % 4];
  const pts: P[] = [
    [root[0], root[1]],
    [root[0] - 3, root[1] + 1 + wave],
    [root[0] - 7, root[1] + 1 + wave2],
    [root[0] - 10, root[1] + 3 + wave],
  ];
  for (let i = 0; i + 1 < pts.length; i++) tmp.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, PAL.red);
  // 끝 갈래
  const e = pts[pts.length - 1];
  tmp.set(e[0] - 1, e[1] + 1, PAL.red);
  tmp.set(e[0] - 1, e[1] - 1 + (phase % 2), PAL.crimson);
  // 아랫면 음영
  for (let y = tmp.h - 1; y >= 0; y--)
    for (let x = 0; x < tmp.w; x++) if (tmp.get(x, y) === PAL.red && tmp.get(x, y + 1) === -1) tmp.set(x, y, PAL.crimson);
  tmp.outline(PAL.ink);
  target.blit(tmp, 0, 0);
}

const headPc = PixelCanvas.fromRows(HEAD);
const headHurtPc = (() => {
  const h = headPc.clone();
  h.set(10, 7, PAL.skin);
  h.set(10, 8, PAL.ink);
  h.set(9, 8, PAL.ink);
  return h;
})();
const coatPc = PixelCanvas.fromRows(COAT);
const bootPc = PixelCanvas.fromRows(BOOT);

export function haruBody(p: BodyPose, blink = false): PixelCanvas {
  const s = POSES[p];
  const pc = new PixelCanvas(BODY_FRAME, BODY_FRAME);
  // 뒤쪽 레이어: 목도리 꼬리, 뒷팔, 뒷다리
  scarfTail(pc, [s.coat[0] + 3, s.coat[1] + 1], s.scarf);
  limb(pc, s.backArm, 2, PAL.night, PAL.ink, PAL.skinsh);
  drawLeg(pc, s.legs[0], true);
  drawLeg(pc, s.legs[1], false);
  pc.blit(coatPc, s.coat[0], s.coat[1]);
  pc.blit(s.hurt || blink ? headHurtPc : headPc, s.head[0], s.head[1]);
  limb(pc, s.frontArm, 2, PAL.navy, PAL.night, PAL.skin);
  return pc;
}

function drawLeg(pc: PixelCanvas, pts: readonly P[], back: boolean): void {
  const tmp = new PixelCanvas(pc.w, pc.h);
  const col = back ? PAL.night : PAL.dslate;
  for (let i = 0; i + 1 < pts.length; i++) tmp.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, col);
  const a = pts[pts.length - 1];
  tmp.blit(bootPc, a[0] - 1, a[1]);
  if (back) tmp.replace(PAL.brown, PAL.dbrown);
  tmp.outline(PAL.ink);
  pc.blit(tmp, 0, 0);
}

export function bodyHand(p: BodyPose): P {
  return POSES[p].hand;
}

export const ALL_POSES = Object.keys(POSES) as BodyPose[];

/** 똑딱이(회중시계 동료) 12x14, 4프레임(부유·초침 회전). */
export function ttokttagi(frame: number): PixelCanvas {
  const pc = new PixelCanvas(14, 16);
  const bob = [0, 1, 1, 0][frame % 4];
  const y = 3 + bob;
  // 고리
  pc.ring(7, y - 1, 1, PAL.gold);
  pc.disc(7, y + 6, 5, PAL.gold);
  pc.disc(7, y + 6, 4, PAL.cream);
  pc.ring(7, y + 6, 4, PAL.copper);
  // 눈
  pc.set(5, y + 5, PAL.ink);
  pc.set(9, y + 5, PAL.ink);
  pc.set(5, y + 6, PAL.ink);
  pc.set(9, y + 6, PAL.ink);
  // 볼
  pc.set(4, y + 8, PAL.pink);
  pc.set(10, y + 8, PAL.pink);
  // 초침(돌아감)
  const hands: P[] = [
    [0, -3],
    [2, -2],
    [3, 0],
    [2, 2],
  ];
  const h = hands[frame % 4];
  const pts = linePoints(7, y + 7, 7 + h[0], y + 7 + h[1]);
  for (const [x, yy] of pts) pc.set(x, yy, PAL.red);
  pc.set(7, y + 7, PAL.ink);
  // 하이라이트
  pc.set(4, y + 3, PAL.white);
  pc.set(5, y + 2, PAL.yellow);
  pc.outline(PAL.ink);
  return pc;
}

/** 보름 할아버지(엔딩/대진자 속) 16x20: 흰 수염, 둥근 안경, 갈색 조끼. */
export function grandpa(sleeping: boolean): PixelCanvas {
  const rows = [
    '................',
    '.....kkkkkk.....',
    '....kiiiiiik....',
    '...kiwiiiiiik...',
    '...kffffffffk...',
    '..kfFkkffkkFfk..',
    '..kfkYkffkYkfk..',
    '..kffkkffkkffk..',
    '...kfwwwwwwfk...',
    '...kwwwwwwwwk...',
    '....kwwwwwwk....',
    '...kcrkwwkrck...',
    '..kcrrrkkrrrck..',
    '..kfkrrggrrkfk..',
    '..kkkrrrrrrkkk..',
    '....kddddddk....',
    '....kddkkddk....',
    '....kbbk.kbbk...',
    '....kkkk.kkkk...',
    '................',
  ];
  const pc = PixelCanvas.fromRows(rows);
  if (sleeping) {
    pc.set(6, 6, PAL.ink);
    pc.set(10, 6, PAL.ink);
  }
  return pc;
}
