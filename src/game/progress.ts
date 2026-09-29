// 진행·성장·보상의 순수 트랜잭션. 모든 함수는 새 SaveData를 돌려주며 멱등이다 (DESIGN_LOCK §11~§13).
import { ALL_EQUIP, EQUIP, LOADOUT_SIZE, MAX_LEVEL, UPGRADE_COST, type EquipId } from '../data/equipment';
import { ENEMIES, type EnemyId } from '../data/enemies';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface SaveData {
  version: 1;
  map: string;
  x: number;
  y: number;
  facing: Dir;
  owned: EquipId[];
  levels: Partial<Record<EquipId, number>>;
  loadout: EquipId[];
  gears: number;
  maxHp: number;
  defeated: string[];
  chests: string[];
  walls: string[];
  flags: string[];
  playTime: number;
  battles: number;
  losses: number;
}

export const BASE_HP = 40;
export const HEART_HP = 5;

export interface Reward {
  gears: number;
  equip?: EquipId;
  /** 한 번에 여러 장비(시작 공구함). */
  equips?: EquipId[];
  heart?: boolean;
}

export function newGame(map: string, x: number, y: number): SaveData {
  return {
    version: 1,
    map,
    x,
    y,
    facing: 'up',
    owned: [],
    levels: {},
    loadout: [],
    gears: 0,
    maxHp: BASE_HP,
    defeated: [],
    chests: [],
    walls: [],
    flags: [],
    playTime: 0,
    battles: 0,
    losses: 0,
  };
}

export function hasFlag(s: SaveData, f: string): boolean {
  return s.flags.includes(f);
}

export function withFlag(s: SaveData, f: string): SaveData {
  return s.flags.includes(f) ? s : { ...s, flags: [...s.flags, f] };
}

export function levelOf(s: SaveData, id: EquipId): number {
  return s.levels[id] ?? 1;
}

function addEquip(s: SaveData, id: EquipId): SaveData {
  if (s.owned.includes(id)) return s;
  const owned = [...s.owned, id];
  const loadout = s.loadout.length < LOADOUT_SIZE ? [...s.loadout, id] : s.loadout;
  return { ...s, owned, loadout };
}

function applyReward(s: SaveData, r: Reward): SaveData {
  let n: SaveData = { ...s, gears: s.gears + Math.max(0, r.gears) };
  if (r.equip) n = addEquip(n, r.equip);
  for (const e of r.equips ?? []) n = addEquip(n, e);
  if (r.heart) n = { ...n, maxHp: n.maxHp + HEART_HP };
  return n;
}

/** 첫 승리 보상은 적 ID당 1회. 이미 처치했으면 보상 없음. */
export function grantVictory(s: SaveData, enemyId: EnemyId): { save: SaveData; reward: Reward | null } {
  const counted = { ...s, battles: s.battles + 1 };
  const def = ENEMIES[enemyId];
  // 연습 인형: 보상은 없지만 첫 승리로 태엽 쥐와 싸울 자격(dummy_done)을 얻는다.
  if (enemyId === 'dummy') return { save: withFlag(counted, 'dummy_done'), reward: null };
  if (s.defeated.includes(enemyId)) return { save: counted, reward: null };
  const reward: Reward = { gears: def.reward.gears, equip: def.reward.equip };
  const next = applyReward({ ...counted, defeated: [...counted.defeated, enemyId] }, reward);
  return { save: next, reward };
}

export function recordDefeat(s: SaveData): SaveData {
  return { ...s, battles: s.battles + 1, losses: s.losses + 1 };
}

/** 상자는 한 번만 열린다. */
export function openChest(s: SaveData, chestId: string, contents: Reward): { save: SaveData; reward: Reward | null } {
  if (s.chests.includes(chestId)) return { save: s, reward: null };
  const next = applyReward({ ...s, chests: [...s.chests, chestId] }, contents);
  return { save: next, reward: contents };
}

export function breakWall(s: SaveData, wallId: string): SaveData {
  return s.walls.includes(wallId) ? s : { ...s, walls: [...s.walls, wallId] };
}

export function upgradeCost(s: SaveData, id: EquipId): number | null {
  const lv = levelOf(s, id);
  if (lv >= MAX_LEVEL) return null;
  return UPGRADE_COST[lv] ?? null;
}

export type TxResult = { ok: true; save: SaveData } | { ok: false; reason: string };

export function upgradeEquip(s: SaveData, id: EquipId): TxResult {
  if (!s.owned.includes(id)) return { ok: false, reason: '가지고 있지 않은 장비' };
  const cost = upgradeCost(s, id);
  if (cost == null) return { ok: false, reason: '이미 최대 강화' };
  if (s.gears < cost) return { ok: false, reason: '톱니가 부족하다' };
  return { ok: true, save: { ...s, gears: s.gears - cost, levels: { ...s.levels, [id]: levelOf(s, id) + 1 } } };
}

export function validateLoadout(s: SaveData, ids: readonly EquipId[]): string | null {
  if (ids.length === 0) return '장비를 하나 이상 챙겨야 한다';
  if (ids.length > LOADOUT_SIZE) return `최대 ${LOADOUT_SIZE}개까지`;
  if (new Set(ids).size !== ids.length) return '같은 장비는 한 번만';
  if (ids.some((id) => !s.owned.includes(id))) return '없는 장비';
  if (!ids.some((id) => EQUIP[id].kind === 'attack')) return '공격 장비가 하나는 있어야 한다';
  return null;
}

export function setLoadout(s: SaveData, ids: readonly EquipId[]): TxResult {
  const reason = validateLoadout(s, ids);
  if (reason) return { ok: false, reason };
  return { ok: true, save: { ...s, loadout: [...ids] } };
}

/** 저장 데이터 복구: 형식이 틀리면 null, 값은 안전하게 정리. */
export function sanitizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || typeof o.map !== 'string') return null;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : d);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const isEquip = (x: string): x is EquipId => (ALL_EQUIP as readonly string[]).includes(x);
  const owned = [...new Set(strs(o.owned).filter(isEquip))];
  const levels: Partial<Record<EquipId, number>> = {};
  if (o.levels && typeof o.levels === 'object') {
    for (const [k, v] of Object.entries(o.levels as Record<string, unknown>)) {
      if (isEquip(k)) levels[k] = Math.max(1, Math.min(MAX_LEVEL, num(v, 1)));
    }
  }
  const loadout = [...new Set(strs(o.loadout).filter(isEquip))].filter((id) => owned.includes(id)).slice(0, LOADOUT_SIZE);
  const facing = (['up', 'down', 'left', 'right'] as const).includes(o.facing as Dir) ? (o.facing as Dir) : 'down';
  return {
    version: 1,
    map: o.map,
    x: num(o.x, 0),
    y: num(o.y, 0),
    facing,
    owned,
    levels,
    loadout,
    gears: Math.max(0, num(o.gears, 0)),
    maxHp: Math.max(BASE_HP, num(o.maxHp, BASE_HP)),
    defeated: [...new Set(strs(o.defeated))],
    chests: [...new Set(strs(o.chests))],
    walls: [...new Set(strs(o.walls))],
    flags: [...new Set(strs(o.flags))],
    playTime: Math.max(0, num(o.playTime, 0)),
    battles: Math.max(0, num(o.battles, 0)),
    losses: Math.max(0, num(o.losses, 0)),
  };
}
