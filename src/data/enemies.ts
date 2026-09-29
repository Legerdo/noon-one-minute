// 적 정의. 전투 수치 + 결정론적 AI + 관찰 기록. Phaser 의존 금지.
import { phasedBrain } from '../core/ai';
import type { ActionDef, EnemyCombatDef } from '../core/types';
import type { EquipId } from './equipment';

export type EnemyId = 'dummy' | 'rat' | 'sentry' | 'knight' | 'swarm' | 'tortoise' | 'hexer' | 'boss';

/** 연출 종류(표현 전용). */
export type EnemyAnim =
  | 'poke'
  | 'bite'
  | 'dash'
  | 'thrust'
  | 'slam'
  | 'swing'
  | 'quake'
  | 'sting'
  | 'storm'
  | 'headbutt'
  | 'spin'
  | 'bolt'
  | 'curse'
  | 'rain'
  | 'frenzy'
  | 'bell'
  | 'burst'
  | 'guard'
  | 'charge'
  | 'rest';

export interface EnemyActionDef extends ActionDef {
  anim: EnemyAnim;
  /** 짧은 성격 설명(의도 표시용). */
  hint?: string;
}

export interface EnemyDef extends EnemyCombatDef {
  title: string;
  floor: number;
  reward: { gears: number; equip?: EquipId };
  /** 전투 준비 화면의 관찰 기록. */
  notes: readonly string[];
  actions: Readonly<Record<string, EnemyActionDef>>;
  /** 패배 시 똑딱이의 조언. */
  tip: string;
}

function acts(list: EnemyActionDef[]): Record<string, EnemyActionDef> {
  const r: Record<string, EnemyActionDef> = {};
  for (const a of list) r[a.id] = a;
  return r;
}

const HEAVY = 15;

export const ENEMIES: Readonly<Record<EnemyId, EnemyDef>> = {
  dummy: {
    id: 'dummy',
    name: '연습 인형',
    title: '할아버지의 태엽 허수아비',
    floor: 1,
    maxHp: 30,
    reward: { gears: 0 },
    actions: acts([
      { id: 'poke', name: '콕 찌르기', kind: 'attack', effect: 3, defense: 0, wait: 3, anim: 'poke' },
      { id: 'brace', name: '버티기', kind: 'guard', effect: 0, defense: 10, wait: 3, anim: 'guard' },
      { id: 'big', name: '크게 휘두르기', kind: 'attack', effect: 10, defense: 0, wait: 6, anim: 'swing' },
    ]),
    ...phasedBrain([{ pattern: ['poke', 'poke', 'brace', 'big'] }]),
    notes: [
      '콕, 콕, 버티기, 크게 휘두르기를 되풀이한다.',
      '보상은 없지만 몇 번이든 다시 싸울 수 있다.',
    ],
    tip: '연습 인형은 몇 번이든 다시 상대할 수 있어요.',
  },

  rat: {
    id: 'rat',
    name: '태엽 쥐',
    title: '녹슨 태엽을 단 쥐',
    floor: 1,
    maxHp: 18,
    reward: { gears: 1 },
    actions: acts([
      { id: 'gnaw', name: '갉기', kind: 'attack', effect: 4, defense: 0, wait: 3, anim: 'bite' },
      { id: 'wind', name: '태엽 감기', kind: 'charge', effect: 0, defense: 2, wait: 4, anim: 'charge', hint: '다음은 돌진' },
      { id: 'dash', name: '돌진', kind: 'attack', effect: 9, defense: 0, wait: 2, anim: 'dash' },
    ]),
    ...phasedBrain([{ pattern: ['gnaw', 'gnaw', 'wind', 'dash'] }]),
    notes: ['갉기를 두 번 한 뒤 태엽을 감는다.', '태엽을 다 감으면 곧바로 돌진한다. 그때 방패를 들어 두자.'],
    tip: '태엽 감기가 보이면 돌진 직전이에요. 버클러가 그때 올라가 있게 맞춰 봐요.',
  },

  sentry: {
    id: 'sentry',
    name: '놋쇠 파수병',
    title: '문을 지키는 창잡이',
    floor: 1,
    maxHp: 44,
    reward: { gears: 1 },
    actions: acts([
      { id: 'aim', name: '겨누기', kind: 'charge', effect: 0, defense: 8, wait: 3, anim: 'charge', hint: '단단하게 겨눈다' },
      { id: 'slam', name: '내려찍기', kind: 'attack', effect: 20, defense: 2, wait: 6, anim: 'slam' },
      { id: 'breathe', name: '숨 고르기', kind: 'rest', effect: 0, defense: 0, wait: 6, anim: 'rest', hint: '빈틈' },
      { id: 'jab', name: '찌르기', kind: 'attack', effect: 8, defense: 4, wait: 3, anim: 'thrust' },
    ]),
    ...phasedBrain([{ pattern: ['aim', 'slam', 'breathe', 'jab', 'jab'] }]),
    notes: [
      '겨누는 동안 몸이 단단하다(방어 8). 단검은 튕긴다.',
      '겨누기 다음엔 느리고 무거운 내려찍기.',
      '내려찍은 뒤 숨을 고른다. 그때가 기회.',
    ],
    tip: '겨누는 동안(방어 8)은 때려도 소용없어요. 내려찍기는 버클러로 받고, 숨 고를 때 장검으로!',
  },

  knight: {
    id: 'knight',
    name: '진자 기사',
    title: '흔들리는 추의 검사',
    floor: 2,
    maxHp: 70,
    reward: { gears: 2, equip: 'tower' },
    actions: acts([
      { id: 'cut', name: '진자 베기', kind: 'attack', effect: 10, defense: 5, wait: 5, anim: 'swing' },
      { id: 'guard', name: '강철 수비', kind: 'guard', effect: 0, defense: 14, wait: 4, anim: 'guard' },
      { id: 'great', name: '대진자', kind: 'attack', effect: 22, defense: 2, wait: 9, anim: 'quake', hint: '느리고 강한 일격' },
      { id: 'tired', name: '균형 잃음', kind: 'rest', effect: 0, defense: 0, wait: 5, anim: 'rest', hint: '빈틈' },
    ]),
    ...phasedBrain([
      {
        pattern: ['cut', 'guard', 'cut', 'great', 'tired'],
        react: (ctx, planned) =>
          planned === 'cut' && ctx.playerAct && ctx.playerAct.kind === 'attack' && ctx.playerAct.effect >= HEAVY
            ? 'guard'
            : null,
      },
    ]),
    notes: [
      '베기, 수비, 베기, 대진자, 균형 잃음을 되풀이한다.',
      '다음 동작을 고를 때 무거운 공격(위력 15↑)을 준비하는 모습이 보이면, 베기 대신 수비한다.',
      '대진자와 균형 잃음 사이엔 방어가 거의 없다.',
    ],
    tip: '기사는 자기 동작이 끝날 때만 다음 수를 정해요. 대망치는 기사의 긴 동작 안에 떨어지게 맞춰 봐요.',
  },

  swarm: {
    id: 'swarm',
    name: '톱니 벌떼',
    title: '흩어진 톱니의 무리',
    floor: 2,
    maxHp: 44,
    reward: { gears: 2 },
    actions: acts([
      { id: 'sting', name: '쏘기', kind: 'attack', effect: 5, defense: 0, wait: 2, anim: 'sting' },
      { id: 'scatter', name: '흩어지기', kind: 'guard', effect: 0, defense: 8, wait: 3, anim: 'guard' },
      { id: 'storm', name: '벌떼 폭풍', kind: 'attack', effect: 24, defense: 0, wait: 7, anim: 'storm', hint: '거대한 일격' },
      { id: 'regroup', name: '재집결', kind: 'rest', effect: 0, defense: 0, wait: 5, anim: 'rest', hint: '빈틈' },
    ]),
    ...phasedBrain([{ pattern: ['sting', 'sting', 'sting', 'scatter', 'storm', 'regroup'] }]),
    notes: [
      '짧은 쏘기를 연달아 한다. 느린 무기를 들고 있으면 계속 쏘인다.',
      '흩어졌다가 벌떼 폭풍을 몰고 온다. 가벼운 방패로는 다 막지 못한다.',
      '폭풍 뒤에는 한동안 다시 모인다.',
    ],
    tip: '쏘기는 위력 5 — 장검의 방어 5로 딱 막혀요. 폭풍은 대방패로!',
  },

  tortoise: {
    id: 'tortoise',
    name: '무쇠 거북',
    title: '보일러를 짊어진 거북',
    floor: 3,
    maxHp: 52,
    reward: { gears: 2 },
    actions: acts([
      { id: 'shell', name: '껍질 웅크리기', kind: 'guard', effect: 0, defense: 16, wait: 5, anim: 'guard' },
      { id: 'headbutt', name: '박치기', kind: 'attack', effect: 16, defense: 8, wait: 6, anim: 'headbutt' },
      { id: 'peek', name: '고개 내밀기', kind: 'rest', effect: 0, defense: 3, wait: 3, anim: 'rest', hint: '빈틈' },
      { id: 'spin', name: '껍질 회전', kind: 'attack', effect: 10, defense: 16, wait: 4, anim: 'spin' },
    ]),
    ...phasedBrain([{ pattern: ['shell', 'headbutt', 'peek', 'spin', 'shell', 'spin'] }]),
    notes: [
      '거의 항상 껍질 속에 있다(방어 16).',
      '박치기 뒤에 잠깐 고개를 내민다. 아주 짧은 틈.',
      '송곳 같은 관통 공격이 답일지도.',
    ],
    tip: '껍질(방어 16)은 관통으로 뚫어요. 태엽 송곳은 방어를 무시해요.',
  },

  hexer: {
    id: 'hexer',
    name: '녹 주술사',
    title: '녹을 부리는 인형술사',
    floor: 3,
    maxHp: 46,
    reward: { gears: 2, equip: 'wedge' },
    actions: acts([
      { id: 'rust', name: '시간 부식', kind: 'attack', effect: 3, defense: 2, wait: 4, delay: 3, anim: 'curse', hint: '내 행동 지연' },
      { id: 'bolt', name: '녹 화살', kind: 'attack', effect: 7, defense: 2, wait: 3, pierce: true, anim: 'bolt' },
      { id: 'veil', name: '녹 장막', kind: 'guard', effect: 0, defense: 12, wait: 4, anim: 'guard' },
      { id: 'rain', name: '부식의 비', kind: 'attack', effect: 15, defense: 0, wait: 8, pierce: true, anim: 'rain', hint: '관통 큰 공격' },
    ]),
    ...phasedBrain([
      {
        pattern: ['rust', 'bolt', 'veil', 'bolt', 'rain'],
        react: (ctx, planned) =>
          planned !== 'rain' && planned !== 'bolt' && ctx.playerAct && ctx.playerAct.kind === 'guard' ? 'bolt' : null,
      },
    ]),
    notes: [
      '녹 화살과 부식의 비는 관통 — 방패로 막을 수 없다.',
      '다음 수를 고를 때 방패를 든 모습이 보이면 녹 화살을 쏜다.',
      '시간 부식은 준비 중인 내 행동을 늦춘다.',
    ],
    tip: '관통 공격은 방패가 소용없어요. 막기보다 먼저 쓰러뜨리고, 모래시계 약으로 버텨요.',
  },

  boss: {
    id: 'boss',
    name: '녹슨 대진자',
    title: '멈춘 시간의 심장',
    floor: 4,
    maxHp: 120,
    reward: { gears: 0 },
    actions: acts([
      { id: 'swing', name: '진자 흔들기', kind: 'attack', effect: 12, defense: 6, wait: 5, anim: 'swing' },
      { id: 'guard', name: '태엽 수비', kind: 'guard', effect: 0, defense: 16, wait: 4, anim: 'guard' },
      { id: 'quake', name: '대진동', kind: 'attack', effect: 28, defense: 2, wait: 10, anim: 'quake', hint: '거대한 일격' },
      { id: 'frenzy', name: '초침 연타', kind: 'attack', effect: 6, defense: 0, wait: 2, anim: 'frenzy' },
      { id: 'overheat', name: '과열', kind: 'rest', effect: 0, defense: 0, wait: 6, anim: 'rest', hint: '빈틈' },
      { id: 'bell', name: '자정의 종', kind: 'attack', effect: 30, defense: 10, wait: 12, pierce: true, anim: 'bell', hint: '관통 · 치명적' },
      { id: 'burst', name: '녹 분출', kind: 'attack', effect: 8, defense: 4, wait: 3, anim: 'burst' },
    ]),
    ...phasedBrain([
      { pattern: ['swing', 'guard', 'swing', 'quake'] },
      { hpAtOrBelow: 90, pattern: ['frenzy', 'frenzy', 'frenzy', 'frenzy', 'frenzy', 'overheat'], banner: '초침이 폭주한다!' },
      { hpAtOrBelow: 40, pattern: ['bell', 'burst', 'burst'], banner: '자정의 종이 울리려 한다!' },
    ]),
    notes: [
      '1단계: 흔들기와 수비 뒤에 거대한 대진동.',
      '체력이 줄면 초침이 폭주해 짧은 연타를 퍼붓다가 과열된다.',
      '마지막엔 자정의 종 — 방패를 무시하는 치명타. 울리기 전에 끝내거나 늦춰야 한다.',
    ],
    tip: '단계마다 질문이 달라요. 대진동엔 큰 방패, 연타엔 빠른 손, 종에는 쐐기와 관통!',
  },
};

export const ENEMY_ORDER: readonly EnemyId[] = ['rat', 'sentry', 'knight', 'swarm', 'tortoise', 'hexer', 'boss'];
