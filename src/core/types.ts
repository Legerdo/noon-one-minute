// 순수 전투 규칙 타입. Phaser/DOM 의존 금지 (DESIGN_LOCK §15).

export type Side = 'player' | 'enemy';

/** 행동 성격. UI 아이콘과 AI 판단에 쓰인다. */
export type ActionKind = 'attack' | 'guard' | 'heal' | 'charge' | 'rest';

export interface ActionDef {
  id: string;
  name: string;
  kind: ActionKind;
  /** 공격이면 피해, 회복이면 회복량. */
  effect: number;
  /** 이 행동을 준비하는 동안의 방어. */
  defense: number;
  /** 확정부터 해결까지의 논리 시간(틱). 신규 행동은 1 이상. */
  wait: number;
  /** 방어 무시. */
  pierce?: boolean;
  /** 해결 시 대상의 현재 행동 남은 Wait += delay (행동 인스턴스당 1회). */
  delay?: number;
  /** 전투당 사용 횟수(플레이어 전용). 확정 시 차감. */
  uses?: number;
}

export interface FighterState {
  hp: number;
  maxHp: number;
  /** 현재 확정 행동 id. null = 행동 없음. */
  act: string | null;
  /** 현재 행동의 남은 Wait. */
  wait: number;
  /** 현재 행동 인스턴스가 이미 지연을 받았는지. */
  delayed: boolean;
}

/** AI 기억. 직렬화 가능한 평평한 숫자 객체만 허용. */
export type AIMemory = Readonly<Record<string, number>>;

export type BattleStatus = 'await' | 'victory' | 'defeat';

export interface BattleState {
  time: number;
  status: BattleStatus;
  p: FighterState;
  e: FighterState;
  /** 사용 횟수가 있는 플레이어 행동의 남은 횟수. */
  uses: Record<string, number>;
  mem: AIMemory;
  lastEnemyAct: string | null;
  /** 플레이어 확정 횟수. 선택 창 식별(중복 확정 방지)에 쓰인다. */
  turn: number;
}

/** AI가 읽을 수 있는 확정 정보만 담는다 (DESIGN_LOCK §9). */
export interface AIContext {
  selfHp: number;
  selfMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  /** 플레이어가 실제로 확정한 현재 행동. 없으면 null. */
  playerAct: ActionDef | null;
  playerWait: number;
  lastSelfAct: string | null;
  time: number;
}

export interface AIDecision {
  act: string;
  mem: AIMemory;
  /** 단계 전환 등 연출용 문구. 판정에는 쓰이지 않는다. */
  banner?: string;
  phase?: number;
}

export interface EnemyBrain {
  initMem(): AIMemory;
  decide(ctx: AIContext, mem: AIMemory): AIDecision;
}

export interface EnemyCombatDef extends EnemyBrain {
  id: string;
  name: string;
  maxHp: number;
  actions: Readonly<Record<string, ActionDef>>;
}

export type DamageResult = 'full' | 'partial' | 'clean' | 'pierce';

export type BattleEvent =
  | { t: 'start'; playerHp: number; enemyHp: number }
  | { t: 'intent'; act: string; wait: number; banner?: string; phase?: number }
  | { t: 'commit'; act: string; wait: number; defense: number; usesLeft: number | null }
  | { t: 'advance'; dt: number; time: number; pWait: number; eWait: number }
  | { t: 'resolve'; side: Side; act: string; immediate: boolean }
  | {
      t: 'damage';
      target: Side;
      amount: number;
      raw: number;
      defense: number;
      result: DamageResult;
      hp: number;
      maxHp: number;
      big: boolean;
      lethal: boolean;
    }
  | { t: 'heal'; target: Side; amount: number; hp: number; maxHp: number }
  | { t: 'delay'; target: Side; amount: number; wait: number; applied: boolean }
  | { t: 'death'; side: Side }
  | { t: 'release'; side: Side }
  | { t: 'await' }
  | { t: 'end'; result: 'victory' | 'defeat' };

export interface BattleSetup {
  enemy: EnemyCombatDef;
  /** 강화가 반영된 플레이어 행동 목록(로드아웃). */
  loadout: readonly ActionDef[];
  playerMaxHp: number;
}
