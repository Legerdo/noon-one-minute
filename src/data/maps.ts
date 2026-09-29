// 탑의 층 구성. 문자 격자 + 엔티티 범례. 벽/바닥 규칙은 art/tiles와 world 이동 판정이 공유한다.
import type { Theme } from '../art/tiles';
import type { Reward } from '../game/progress';
import type { EnemyId } from './enemies';

export type MapId = 'f1' | 'f2' | 'f3' | 'f4';

export type Entity =
  | { kind: 'enemy'; enemy: EnemyId }
  | { kind: 'chest'; id: string; reward: Reward; msg: string }
  | { kind: 'bench'; id: string }
  | { kind: 'npc'; who: 'grandpa' }
  | { kind: 'door'; msg: string };

export interface Exit {
  to: MapId;
  x: number;
  y: number;
  facing: 'up' | 'down';
}

export interface MapDef {
  id: MapId;
  name: string;
  theme: Theme;
  music: string;
  rows: readonly string[];
  /** 엔티티 문자 → 정의(아래 바닥은 floorUnder). */
  legend: Readonly<Record<string, Entity>>;
  floorUnder: Readonly<Record<string, string>>;
  exits: Readonly<Record<string, Exit>>;
  /** 부술 수 있는 벽(X) 좌표 → id. */
  walls: Readonly<Record<string, string>>;
  /** 숨은 통로 영역: 들어가면 지붕이 걷힌다. */
  secret?: { x: number; y: number; w: number; h: number };
  /** 밟으면 한 번 나오는 대사 키. */
  triggers: Readonly<Record<string, string>>;
  /** 벽 장식(움직이는 진자·시계·증기). */
  decor: readonly { kind: 'pendulum' | 'clock' | 'steam' | 'crate'; x: number; y: number }[];
  start: { x: number; y: number };
}

export const MAPS: Readonly<Record<MapId, MapDef>> = {
  f1: {
    id: 'f1',
    name: '1층 · 태엽 현관',
    theme: 'foyer',
    music: 'foyer',
    rows: [
      '##############################',
      '###########WWG#^#GWW##########',
      '###########,,,,s,,,,##########',
      '###########,,,,,,,,a##########',
      '###########,,,,,,,,,##########',
      '###############,##############',
      '##WGWWGW##WWGW#r#WGWW#########',
      '##.......#.....,.....#GWWG####',
      '##.b...c.#....===....#....####',
      '##.......#....===....#..k.####',
      '##..d.........===....X....####',
      '##.......#....===....#....####',
      '##.......#....===....#########',
      '##########....===....#########',
      '##############===#############',
      '##############=o=#############',
      '##############################',
    ],
    legend: {
      s: { kind: 'enemy', enemy: 'sentry' },
      r: { kind: 'enemy', enemy: 'rat' },
      d: { kind: 'enemy', enemy: 'dummy' },
      a: { kind: 'chest', id: 'f1_sword', reward: { gears: 0, equip: 'sword' }, msg: '분침 장검을 얻었다!' },
      c: { kind: 'chest', id: 'f1_kit', reward: { gears: 0, equips: ['dagger', 'buckler'] }, msg: '초침 단검과 톱니 버클러를 얻었다!' },
      k: { kind: 'chest', id: 'f1_secret', reward: { gears: 2, heart: true }, msg: '태엽 심장과 톱니 2개를 얻었다! 최대 체력 +5' },
      b: { kind: 'bench', id: 'f1_bench' },
      o: { kind: 'door', msg: '문 밖의 마을은 정오 1분 전에 멈춰 있다. 지금은 나갈 수 없다.' },
    },
    floorUnder: { s: ',', r: ',', d: '.', a: ',', c: '.', k: '.', b: '.', o: '=' },
    exits: { '15,1': { to: 'f2', x: 14, y: 13, facing: 'up' } },
    walls: { '21,10': 'f1_wall' },
    triggers: { '15,13': 'f1_intro' },
    decor: [
      { kind: 'clock', x: 8, y: 7 },
      { kind: 'crate', x: 8, y: 12 },
      { kind: 'crate', x: 2, y: 12 },
      { kind: 'clock', x: 20, y: 7 },
    ],
    start: { x: 15, y: 13 },
  },
  f2: {
    id: 'f2',
    name: '2층 · 진자 회랑',
    theme: 'gallery',
    music: 'gallery',
    rows: [
      '##############################',
      '##########GWW#^#WWG###########',
      '##########,,,,s,,,,###########',
      '##########,,,,,,,,,###########',
      '##########,,,,,,,,,###########',
      '##############,###############',
      '#######GWWGWW#k#WWGWWG########',
      '#######,,,,,,,,,,,,,,,########',
      '#######,,,,,,,,,,,,,,,##GWG###',
      '###GWG#,,,,,,,,,,,,,,,##.b.###',
      '###n..X,,,,,,,,,,,,,,,,,...###',
      '#######,,,,,,,,,,,,,,,##...###',
      '#######,a,,,,,,,,,,,,,##...###',
      '#######,,,,,,,,,,,,,,,########',
      '##############v###############',
      '##############################',
    ],
    legend: {
      s: { kind: 'enemy', enemy: 'swarm' },
      k: { kind: 'enemy', enemy: 'knight' },
      a: { kind: 'chest', id: 'f2_hammer', reward: { gears: 0, equip: 'hammer' }, msg: '시침 대망치를 얻었다!' },
      n: { kind: 'chest', id: 'f2_niche', reward: { gears: 1 }, msg: '톱니 1개를 얻었다!' },
      b: { kind: 'bench', id: 'f2_bench' },
    },
    floorUnder: { s: ',', k: ',', a: ',', n: '.', b: '.' },
    exits: {
      '14,1': { to: 'f3', x: 14, y: 13, facing: 'up' },
      '14,14': { to: 'f1', x: 15, y: 2, facing: 'down' },
    },
    walls: { '6,10': 'f2_wall' },
    triggers: { '14,13': 'f2_intro' },
    decor: [
      { kind: 'pendulum', x: 9, y: 6 },
      { kind: 'pendulum', x: 19, y: 6 },
      { kind: 'pendulum', x: 11, y: 6 },
      { kind: 'pendulum', x: 17, y: 6 },
    ],
    start: { x: 14, y: 13 },
  },
  f3: {
    id: 'f3',
    name: '3층 · 녹슨 기관실',
    theme: 'engine',
    music: 'engine',
    rows: [
      '##############################',
      '##########PPP#^#PPP###########',
      '##########,,,,h,,,,###########',
      '##########,,,,,,,,,###########',
      '##############,###############',
      '#######PPGPPP#,#PPGPPP########',
      '###k..%,,,,,,,,,,,,,,c########',
      '#######,,,,,,,,,,,,,,,########',
      '#######,,,,,,,,,,,,,,,########',
      '##############T###############',
      '#######PPGPPPP,PPGPPP##PGP####',
      '#######,,,,,,,,,,,,,,##.b.####',
      '#######a,,,,,,,,,,,,,,,...####',
      '#######,,,,,,,,,,,,,,##...####',
      '##############v###############',
      '##############################',
    ],
    legend: {
      h: { kind: 'enemy', enemy: 'hexer' },
      T: { kind: 'enemy', enemy: 'tortoise' },
      a: { kind: 'chest', id: 'f3_awl', reward: { gears: 1, equip: 'awl' }, msg: '태엽 송곳과 톱니 1개를 얻었다!' },
      c: { kind: 'chest', id: 'f3_tonic', reward: { gears: 0, equip: 'tonic' }, msg: '모래시계 약을 얻었다!' },
      k: { kind: 'chest', id: 'f3_secret', reward: { gears: 1, heart: true }, msg: '태엽 심장과 톱니 1개를 얻었다! 최대 체력 +5' },
      b: { kind: 'bench', id: 'f3_bench' },
    },
    floorUnder: { h: ',', T: ',', a: ',', c: ',', k: '.', b: '.' },
    exits: {
      '14,1': { to: 'f4', x: 14, y: 14, facing: 'up' },
      '14,14': { to: 'f2', x: 14, y: 2, facing: 'down' },
    },
    walls: {},
    secret: { x: 3, y: 6, w: 4, h: 1 },
    triggers: { '14,13': 'f3_intro', '7,6': 'f3_draft' },
    decor: [
      { kind: 'steam', x: 9, y: 5 },
      { kind: 'steam', x: 18, y: 10 },
      { kind: 'steam', x: 7, y: 5 },
    ],
    start: { x: 14, y: 13 },
  },
  f4: {
    id: 'f4',
    name: '꼭대기 · 대시계 문자판',
    theme: 'summit',
    music: 'summit',
    rows: [
      '##############################',
      '##############################',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~~~~~~~~~~~######',
      '######~~~~~~~~,~~~~~~~~~######',
      '######,,,,,,,~B~,,,,,,,,######',
      '######,,,,,,,,,,,,,,,,,,######',
      '######,,,,,,,,,,,,,,,,,,######',
      '######,,,,,,,,,,,,,,,g,,######',
      '######,b,,,,,,,,,,,,,,,,######',
      '######,,,,,,,,,,,,,,,,,,######',
      '##############v###############',
      '##############################',
    ],
    legend: {
      B: { kind: 'enemy', enemy: 'boss' },
      g: { kind: 'npc', who: 'grandpa' },
      b: { kind: 'bench', id: 'f4_bench' },
    },
    floorUnder: { B: ',', g: ',', b: ',' },
    exits: { '14,15': { to: 'f3', x: 14, y: 2, facing: 'down' } },
    walls: {},
    triggers: { '14,14': 'f4_intro' },
    decor: [],
    start: { x: 14, y: 14 },
  },
};

export const ENEMY_THEME: Record<EnemyId, Theme> = {
  dummy: 'foyer',
  rat: 'foyer',
  sentry: 'foyer',
  knight: 'gallery',
  swarm: 'gallery',
  tortoise: 'engine',
  hexer: 'engine',
  boss: 'summit',
};

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export interface Placed {
  x: number;
  y: number;
  ch: string;
  e: Entity;
}

export function entitiesOf(m: MapDef): Placed[] {
  const out: Placed[] = [];
  m.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const e = m.legend[row[x]];
      if (e) out.push({ x, y, ch: row[x], e });
    }
  });
  return out;
}
