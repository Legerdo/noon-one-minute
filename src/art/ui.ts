// UI 아트: 패널(9-slice), 아이콘, 커서, 타임라인 마커.
import { CLEAR, PixelCanvas } from './canvas';
import { gear } from './enemies';
import { PAL } from './palette';

export function panelTex(kind: 'brass' | 'steel' | 'dark' | 'slot' | 'slotSel' | 'slotOff'): PixelCanvas {
  const S = 24;
  const pc = new PixelCanvas(S, S);
  const style = {
    brass: { fill: PAL.night, lit: PAL.gold, dark: PAL.copper, inner: PAL.dbrown, rivet: PAL.yellow },
    steel: { fill: PAL.night, lit: PAL.silver, dark: PAL.slate, inner: PAL.ink, rivet: PAL.white },
    dark: { fill: PAL.ink, lit: PAL.dslate, dark: PAL.night, inner: PAL.ink, rivet: PAL.slate },
    slot: { fill: PAL.night, lit: PAL.slate, dark: PAL.dslate, inner: PAL.ink, rivet: PAL.slate },
    slotSel: { fill: PAL.dslate, lit: PAL.yellow, dark: PAL.gold, inner: PAL.brown, rivet: PAL.white },
    slotOff: { fill: PAL.ink, lit: PAL.dslate, dark: PAL.night, inner: PAL.ink, rivet: PAL.night },
  }[kind];
  pc.rect(0, 0, S, S, PAL.ink);
  pc.rect(1, 1, S - 2, S - 2, style.dark);
  pc.hline(1, S - 2, 1, style.lit);
  pc.vline(1, 1, S - 2, style.lit);
  pc.rect(2, 2, S - 4, S - 4, style.inner);
  pc.rect(3, 3, S - 6, S - 6, style.fill);
  // 모서리 리벳
  for (const [x, y] of [
    [3, 3],
    [S - 4, 3],
    [3, S - 4],
    [S - 4, S - 4],
  ])
    pc.set(x, y, style.rivet);
  // 모서리 둥글게
  for (const [x, y] of [
    [0, 0],
    [S - 1, 0],
    [0, S - 1],
    [S - 1, S - 1],
  ])
    pc.set(x, y, CLEAR);
  return pc;
}

const ICONS: Record<string, string[]> = {
  atk: [
    '......kkk',
    '.....kwik',
    '....kwik.',
    '...kwik..',
    'kk.kik...',
    'kgkik....',
    '.kgk.....',
    'kbkgk....',
    'kkk.k....',
  ],
  def: [
    '.kkkkkkk.',
    'kiiiiiiek',
    'kiYiiieek',
    'kiiiiieek',
    'kiiiiieek',
    '.kiiieek.',
    '.kkieeek.',
    '..kkeek..',
    '....kk...',
  ],
  wait: [
    'kkkkkkkkk',
    'kgggggggk',
    '.kmmmmmk.',
    '..kmmmk..',
    '...kmk...',
    '..kkmkk..',
    '.kttmttk.',
    'kgggggggk',
    'kkkkkkkkk',
  ],
  heal: [
    '...kkk...',
    '...kGk...',
    '...kGk...',
    'kkkkGkkkk',
    'kGGGwGGGk',
    'kkkkGkkkk',
    '...kGk...',
    '...kGk...',
    '...kkk...',
  ],
  pierce: [
    '.........',
    '......k..',
    '.....kPk.',
    'kkkkkkPPk',
    'PPPPPPPwk',
    'kkkkkkPPk',
    '.....kPk.',
    '......k..',
    '.........',
  ],
  delay: [
    '..kkkkk..',
    '.kYYYYYk.',
    'kYwwkwwYk',
    'kYwwkwwYk',
    'kYwwkkkYk',
    'kYwwwwwYk',
    'kYwwwwwYk',
    '.kYYYYYk.',
    '..kkkkk..',
  ],
  hp: [
    '.kk...kk.',
    'kRRk.kRRk',
    'kRwRkRRRk',
    'kRRRRRRRk',
    '.kRRRRRk.',
    '..kRRRk..',
    '...kRk...',
    '....k....',
    '.........',
  ],
  warn: [
    '....k....',
    '...kyk...',
    '...kyk...',
    '..kykyk..',
    '..kykyk..',
    '.kyyyyyk.',
    '.kyykyyk.',
    'kyyyyyyyk',
    'kkkkkkkkk',
  ],
  cursor: ['kk.....', 'kgk....', 'kygk...', 'kyygk..', 'kygk...', 'kgk....', 'kk.....'],
  cursorDown: ['kkkkkkk', 'kyyyygk', '.kyygk.', '..kgk..', '...k...'],
  uses: ['.kkk.', 'kGGGk', 'kGwGk', 'kGGGk', '.kkk.'],
  usesOff: ['.kkk.', 'kdddk', 'kdddk', 'kdddk', '.kkk.'],
  lock: ['.kkk.', 'k...k', 'kkkkk', 'kgggk', 'kgkgk', 'kgggk', 'kkkkk'],
};

export function icon(name: string): PixelCanvas {
  if (name === 'gear') {
    const pc = new PixelCanvas(9, 9);
    gear(pc, 4, 4, 2, 6, 0.3, PAL.gold, PAL.dbrown);
    pc.set(4, 4, PAL.dbrown);
    pc.set(3, 3, PAL.yellow);
    pc.outline(PAL.ink);
    return pc;
  }
  const rows = ICONS[name];
  if (!rows) throw new Error(`아이콘 없음: ${name}`);
  return PixelCanvas.fromRows(rows);
}

export const ICON_NAMES = [...Object.keys(ICONS), 'gear'];

/** 타임라인 플레이어 마커(하루 얼굴). ghost = 미리보기(점선 투명). */
export function playerMarker(ghost: boolean): PixelCanvas {
  const rows = [
    '...kkkkk...',
    '..krrcrrk..',
    '.krrrrrrrk.',
    '.krbffbfrk.',
    '.kbfkffkfk.',
    '.kbfkffkfk.',
    '..kffffffk.',
    '..kkRRRkk..',
    '...kRRRk...',
    '....kkk....',
  ];
  const pc = PixelCanvas.fromRows(rows);
  if (ghost) {
    for (let y = 0; y < pc.h; y++)
      for (let x = 0; x < pc.w; x++) {
        const v = pc.get(x, y);
        if (v === CLEAR) continue;
        if (v === PAL.ink) pc.set(x, y, PAL.cyan);
        else if ((x + y) % 2 === 0) pc.set(x, y, CLEAR);
      }
  }
  return pc;
}

export function enemyMarker(): PixelCanvas {
  const pc = new PixelCanvas(11, 11);
  gear(pc, 5, 5, 3, 7, 0.2, PAL.crimson, PAL.dbrown);
  pc.set(4, 5, PAL.hotred);
  pc.set(5, 5, PAL.hotred);
  pc.set(4, 4, PAL.white);
  pc.outline(PAL.ink);
  return pc;
}

/** 톱니 입자 모양 타이틀 장식. */
export function titleGear(r: number, phase: number, col: number): PixelCanvas {
  const S = r * 2 + 6;
  const pc = new PixelCanvas(S, S);
  gear(pc, S >> 1, S >> 1, r, Math.max(6, Math.round(r * 0.8)), phase, col, PAL.ink);
  return pc;
}
