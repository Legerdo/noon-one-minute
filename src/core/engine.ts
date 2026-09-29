// 전투 시뮬레이션. 렌더링·실시간·난수와 무관한 순수 규칙 (DESIGN_LOCK §2~§10).
import type {
  ActionDef,
  AIContext,
  BattleEvent,
  BattleSetup,
  BattleState,
  DamageResult,
  EnemyCombatDef,
  FighterState,
  Side,
} from './types';

export interface CommitOptions {
  /** 미리보기용: 적의 새 행동 결정이 필요한 지점에서 멈춘다. */
  stopAtUncertain?: boolean;
  /** 이 선택 창이 열린 시점의 turn. 다르면 거부(중복 확정 방지). */
  expectTurn?: number;
  /** 사건 기록 생략(탐색용). */
  silent?: boolean;
}

export type CommitResult =
  | { ok: true; state: BattleState; events: BattleEvent[]; stopped: boolean }
  | { ok: false; reason: string };

export function physicalDamage(effect: number, defense: number): number {
  return Math.max(0, effect - defense);
}

export function computeDamage(effect: number, defense: number, pierce: boolean): number {
  return pierce ? Math.max(0, effect) : physicalDamage(effect, defense);
}

export function isBigHit(amount: number, maxHp: number): boolean {
  return amount >= 12 || amount * 10 >= maxHp * 3;
}

export function cloneState(s: BattleState): BattleState {
  return {
    time: s.time,
    status: s.status,
    p: { ...s.p },
    e: { ...s.e },
    uses: { ...s.uses },
    mem: { ...s.mem },
    lastEnemyAct: s.lastEnemyAct,
    turn: s.turn,
  };
}

const MAX_LOOP = 100000;

export class BattleEngine {
  readonly enemy: EnemyCombatDef;
  readonly loadout: readonly ActionDef[];
  readonly playerMaxHp: number;
  private readonly pmap = new Map<string, ActionDef>();

  constructor(setup: BattleSetup) {
    this.enemy = setup.enemy;
    this.loadout = setup.loadout;
    this.playerMaxHp = setup.playerMaxHp;
    if (setup.loadout.length === 0) throw new Error('로드아웃이 비어 있음');
    for (const a of setup.loadout) {
      validateAction(a, 'player');
      if (this.pmap.has(a.id)) throw new Error(`중복 행동 ${a.id}`);
      this.pmap.set(a.id, a);
    }
    for (const a of Object.values(setup.enemy.actions)) validateAction(a, 'enemy');
  }

  playerAction(id: string): ActionDef | undefined {
    return this.pmap.get(id);
  }

  enemyAction(id: string): ActionDef | undefined {
    return this.enemy.actions[id];
  }

  actionOf(side: Side, id: string): ActionDef {
    const def = side === 'player' ? this.pmap.get(id) : this.enemy.actions[id];
    if (!def) throw new Error(`알 수 없는 행동 ${side}:${id}`);
    return def;
  }

  /** 현재 확정 행동의 Defense. 행동 없음 = 0 (DESIGN_LOCK §5). */
  defenseOf(f: FighterState, side: Side): number {
    return f.act ? this.actionOf(side, f.act).defense : 0;
  }

  start(): { state: BattleState; events: BattleEvent[] } {
    const uses: Record<string, number> = {};
    for (const a of this.loadout) if (a.uses != null) uses[a.id] = a.uses;
    const s: BattleState = {
      time: 0,
      status: 'await',
      p: { hp: this.playerMaxHp, maxHp: this.playerMaxHp, act: null, wait: 0, delayed: false },
      e: { hp: this.enemy.maxHp, maxHp: this.enemy.maxHp, act: null, wait: 0, delayed: false },
      uses,
      mem: this.enemy.initMem(),
      lastEnemyAct: null,
      turn: 0,
    };
    const events: BattleEvent[] = [{ t: 'start', playerHp: s.p.hp, enemyHp: s.e.hp }];
    this.enemyDecide(s, events);
    events.push({ t: 'await' });
    return { state: s, events };
  }

  /** 확정 불가 사유. 가능하면 null. */
  cannotCommit(state: BattleState, actId: string, expectTurn?: number): string | null {
    if (state.status !== 'await') return '선택할 수 있는 상태가 아님';
    if (state.p.act !== null) return '이미 행동을 준비 중';
    if (expectTurn != null && expectTurn !== state.turn) return '이미 처리된 선택';
    const def = this.pmap.get(actId);
    if (!def) return '로드아웃에 없는 장비';
    if (def.uses != null && (state.uses[actId] ?? 0) <= 0) return '남은 사용 횟수 없음';
    return null;
  }

  commit(state: BattleState, actId: string, opts: CommitOptions = {}): CommitResult {
    const reason = this.cannotCommit(state, actId, opts.expectTurn);
    if (reason) return { ok: false, reason };
    const s = cloneState(state);
    const ev: BattleEvent[] | null = opts.silent ? null : [];
    const def = this.actionOf('player', actId);

    if (def.uses != null) s.uses[actId] = (s.uses[actId] ?? 0) - 1;
    s.p.act = actId;
    s.p.wait = def.wait;
    s.p.delayed = false;
    s.turn += 1;
    ev?.push({
      t: 'commit',
      act: actId,
      wait: def.wait,
      defense: def.defense,
      usesLeft: def.uses != null ? s.uses[actId] : null,
    });

    const done = (stopped: boolean): CommitResult => ({ ok: true, state: s, events: ev ?? [], stopped });

    // 동률 잔여: 적 행동이 이미 0이면 시간 진행 전에 즉시 해결 (DESIGN_LOCK §7-3).
    if (s.e.act !== null && s.e.wait === 0) {
      this.resolve(s, 'enemy', ev, true);
      if (s.status === 'defeat') return done(false);
      if (opts.stopAtUncertain) return done(true);
      this.enemyDecide(s, ev);
    }

    for (let guard = 0; guard < MAX_LOOP; guard++) {
      const dt = Math.min(s.p.wait, s.e.wait);
      if (dt > 0) {
        s.p.wait -= dt;
        s.e.wait -= dt;
        s.time += dt;
        ev?.push({ t: 'advance', dt, time: s.time, pWait: s.p.wait, eWait: s.e.wait });
      }
      if (s.p.wait === 0) {
        // 플레이어 우선 (동률 포함).
        this.resolve(s, 'player', ev, false);
        if (s.status === 'victory') return done(false);
        ev?.push({ t: 'await' });
        return done(false);
      }
      this.resolve(s, 'enemy', ev, false);
      if (s.status === 'defeat') return done(false);
      if (opts.stopAtUncertain) return done(true);
      this.enemyDecide(s, ev);
    }
    throw new Error('전투 루프 상한 초과');
  }

  private resolve(s: BattleState, side: Side, ev: BattleEvent[] | null, immediate: boolean): void {
    const actor = side === 'player' ? s.p : s.e;
    const tside: Side = side === 'player' ? 'enemy' : 'player';
    const target = side === 'player' ? s.e : s.p;
    if (!actor.act) throw new Error(`${side} 해결할 행동 없음`);
    const def = this.actionOf(side, actor.act);
    ev?.push({ t: 'resolve', side, act: def.id, immediate });

    // ① 피해
    if (def.kind === 'attack' && def.effect > 0) {
      const d = this.defenseOf(target, tside);
      const amount = computeDamage(def.effect, d, !!def.pierce);
      target.hp = Math.max(0, target.hp - amount);
      let result: DamageResult;
      if (def.pierce) result = 'pierce';
      else if (amount === 0) result = 'full';
      else if (d > 0) result = 'partial';
      else result = 'clean';
      ev?.push({
        t: 'damage',
        target: tside,
        amount,
        raw: def.effect,
        defense: def.pierce ? 0 : d,
        result,
        hp: target.hp,
        maxHp: target.maxHp,
        big: isBigHit(amount, target.maxHp),
        lethal: target.hp <= 0,
      });
    }
    // ② 회복(자신)
    if (def.kind === 'heal' && def.effect > 0) {
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + def.effect);
      ev?.push({ t: 'heal', target: side, amount: actor.hp - before, hp: actor.hp, maxHp: actor.maxHp });
    }
    // ③ 지연(대상 생존 시, 행동 인스턴스당 1회)
    if (def.delay && def.delay > 0 && target.hp > 0 && target.act !== null) {
      if (!target.delayed) {
        target.wait += def.delay;
        target.delayed = true;
        ev?.push({ t: 'delay', target: tside, amount: def.delay, wait: target.wait, applied: true });
      } else {
        ev?.push({ t: 'delay', target: tside, amount: def.delay, wait: target.wait, applied: false });
      }
    }
    // 사망 판정: 효과를 모두 적용한 직후.
    if (target.hp <= 0) {
      s.status = side === 'player' ? 'victory' : 'defeat';
      ev?.push({ t: 'death', side: tside });
      ev?.push({ t: 'end', result: s.status });
      return;
    }
    actor.act = null;
    actor.wait = 0;
    actor.delayed = false;
    ev?.push({ t: 'release', side });
  }

  private enemyDecide(s: BattleState, ev: BattleEvent[] | null): void {
    const ctx: AIContext = {
      selfHp: s.e.hp,
      selfMaxHp: s.e.maxHp,
      playerHp: s.p.hp,
      playerMaxHp: s.p.maxHp,
      playerAct: s.p.act ? this.actionOf('player', s.p.act) : null,
      playerWait: s.p.act ? s.p.wait : 0,
      lastSelfAct: s.lastEnemyAct,
      time: s.time,
    };
    const d = this.enemy.decide(ctx, s.mem);
    const def = this.actionOf('enemy', d.act);
    s.mem = d.mem;
    s.e.act = def.id;
    s.e.wait = def.wait;
    s.e.delayed = false;
    s.lastEnemyAct = def.id;
    ev?.push({ t: 'intent', act: def.id, wait: def.wait, banner: d.banner, phase: d.phase });
  }
}

function validateAction(a: ActionDef, who: string): void {
  if (!Number.isInteger(a.wait) || a.wait < 1) throw new Error(`${who}:${a.id} Wait는 1 이상의 정수`);
  if (!Number.isInteger(a.effect) || a.effect < 0) throw new Error(`${who}:${a.id} Effect는 0 이상의 정수`);
  if (!Number.isInteger(a.defense) || a.defense < 0) throw new Error(`${who}:${a.id} Defense는 0 이상의 정수`);
  if (a.delay != null && (!Number.isInteger(a.delay) || a.delay < 0)) throw new Error(`${who}:${a.id} delay 오류`);
  if (a.uses != null && (!Number.isInteger(a.uses) || a.uses < 1)) throw new Error(`${who}:${a.id} uses 오류`);
}
