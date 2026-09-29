// 플레이어 장비 = 전투 행동. 선형 업그레이드가 아니라 서로 다른 문제 해결 역할 (DESIGN_LOCK §11).
import type { ActionDef, ActionKind } from '../core/types';

export type EquipId = 'dagger' | 'sword' | 'hammer' | 'buckler' | 'tower' | 'awl' | 'tonic' | 'wedge';

export const ALL_EQUIP: readonly EquipId[] = ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl', 'tonic', 'wedge'];

export const LOADOUT_SIZE = 5;
export const MAX_LEVEL = 3;
/** UPGRADE_COST[L] = Lv L → L+1 비용(톱니). */
export const UPGRADE_COST: Readonly<Record<number, number>> = { 1: 1, 2: 2 };

type Stat = 'effect' | 'defense' | 'wait' | 'delay' | 'uses';

export interface UpgradeStep {
  stat: Stat;
  value: number;
  note: string;
}

export interface EquipDef {
  id: EquipId;
  name: string;
  /** 슬롯에 들어가는 짧은 이름. */
  short: string;
  /** 한 단어 역할. */
  role: string;
  desc: string;
  kind: ActionKind;
  effect: number;
  defense: number;
  wait: number;
  pierce?: boolean;
  delay?: number;
  uses?: number;
  /** Lv2, Lv3에서 바뀌는 값(누적). */
  upgrades: readonly [UpgradeStep, UpgradeStep];
}

export const EQUIP: Readonly<Record<EquipId, EquipDef>> = {
  dagger: {
    id: 'dagger',
    name: '초침 단검',
    short: '단검',
    role: '빠른 찌르기',
    desc: '가장 짧은 틈에도 들어가는 가벼운 칼. 방어가 단단한 상대에겐 튕긴다.',
    kind: 'attack',
    effect: 4,
    defense: 1,
    wait: 2,
    upgrades: [
      { stat: 'effect', value: 5, note: '위력 4→5' },
      { stat: 'effect', value: 6, note: '위력 5→6' },
    ],
  },
  sword: {
    id: 'sword',
    name: '분침 장검',
    short: '장검',
    role: '균형',
    desc: '휘두르는 동안에도 칼날로 받아낸다. 어디서나 무난한 기본기.',
    kind: 'attack',
    effect: 9,
    defense: 5,
    wait: 4,
    upgrades: [
      { stat: 'defense', value: 7, note: '방어 5→7' },
      { stat: 'effect', value: 11, note: '위력 9→11' },
    ],
  },
  hammer: {
    id: 'hammer',
    name: '시침 대망치',
    short: '대망치',
    role: '중량 일격',
    desc: '준비가 길고 그동안 무방비. 적의 긴 동작 사이에 떨어뜨리면 판을 뒤집는다.',
    kind: 'attack',
    effect: 22,
    defense: 2,
    wait: 9,
    upgrades: [
      { stat: 'wait', value: 8, note: '대기 9→8' },
      { stat: 'effect', value: 27, note: '위력 22→27' },
    ],
  },
  buckler: {
    id: 'buckler',
    name: '톱니 버클러',
    short: '버클러',
    role: '빠른 방어',
    desc: '짧게 들고 금방 내린다. 위험한 한 방만 넘기고 다음 수로.',
    kind: 'guard',
    effect: 0,
    defense: 9,
    wait: 2,
    upgrades: [
      { stat: 'defense', value: 11, note: '방어 9→11' },
      { stat: 'defense', value: 13, note: '방어 11→13' },
    ],
  },
  tower: {
    id: 'tower',
    name: '종루 대방패',
    short: '대방패',
    role: '철벽',
    desc: '종탑의 문짝을 뜯어 만든 방패. 무엇이든 막지만 오래 들고 있어야 한다.',
    kind: 'guard',
    effect: 0,
    defense: 20,
    wait: 6,
    upgrades: [
      { stat: 'wait', value: 5, note: '대기 6→5' },
      { stat: 'defense', value: 25, note: '방어 20→25' },
    ],
  },
  awl: {
    id: 'awl',
    name: '태엽 송곳',
    short: '송곳',
    role: '관통',
    desc: '태엽의 힘으로 틈을 비집는다. 상대의 방어를 무시한다.',
    kind: 'attack',
    effect: 8,
    defense: 0,
    wait: 5,
    pierce: true,
    upgrades: [
      { stat: 'effect', value: 10, note: '위력 8→10' },
      { stat: 'wait', value: 4, note: '대기 5→4' },
    ],
  },
  tonic: {
    id: 'tonic',
    name: '모래시계 약',
    short: '모래약',
    role: '회복',
    desc: '마시는 데 시간이 걸린다. 다 마시면 체력을 되찾는다. 전투당 사용 횟수 제한.',
    kind: 'heal',
    effect: 14,
    defense: 3,
    wait: 5,
    uses: 2,
    upgrades: [
      { stat: 'effect', value: 18, note: '회복 14→18' },
      { stat: 'uses', value: 3, note: '횟수 2→3' },
    ],
  },
  wedge: {
    id: 'wedge',
    name: '시간 쐐기',
    short: '쐐기',
    role: '지연',
    desc: '적의 태엽 사이에 박아 넣어 준비 중인 행동을 뒤로 민다. 같은 행동은 한 번만 밀 수 있다.',
    kind: 'attack',
    effect: 3,
    defense: 2,
    wait: 3,
    delay: 4,
    upgrades: [
      { stat: 'delay', value: 5, note: '지연 4→5' },
      { stat: 'wait', value: 2, note: '대기 3→2' },
    ],
  },
};

/** 강화 레벨(1~3)을 반영한 전투 행동. */
export function equipAction(id: EquipId, level: number): ActionDef {
  const e = EQUIP[id];
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const a: ActionDef = {
    id: e.id,
    name: e.name,
    kind: e.kind,
    effect: e.effect,
    defense: e.defense,
    wait: e.wait,
  };
  if (e.pierce) a.pierce = true;
  if (e.delay != null) a.delay = e.delay;
  if (e.uses != null) a.uses = e.uses;
  for (let k = 0; k < lv - 1; k++) {
    const up = e.upgrades[k];
    a[up.stat] = up.value;
  }
  return a;
}

export function buildLoadout(ids: readonly EquipId[], levels: Partial<Record<EquipId, number>>): ActionDef[] {
  return ids.map((id) => equipAction(id, levels[id] ?? 1));
}
