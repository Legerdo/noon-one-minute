// 밸런스 검증용 탐색기와 단순 정책들. 실제 엔진 commit만 사용한다.
import type { BattleEngine } from './engine';
import type { BattleState } from './types';

const CYCLE = -1e6;
/** 같은 HP라면 빠른 승리를 선호(20틱 ≈ HP 1). 느린 치즈 전략이 "최적"으로 보이지 않게 한다. */
const TIME_COST = 0.05;

export function stateKey(s: BattleState): string {
  let k = `${s.p.hp}|${s.e.hp}|${s.e.act}|${s.e.wait}|${s.e.delayed ? 1 : 0}|${s.lastEnemyAct}`;
  for (const id in s.uses) k += `|${s.uses[id]}`;
  for (const id in s.mem) k += `|${id}${s.mem[id]}`;
  return k;
}

/** 결정론적 1인 탐색: 승리 시 1000 + 남은 HP, 패배 시 -(적 남은 HP). */
export class Solver {
  private memo = new Map<string, number>();
  private onStack = new Set<string>();
  nodes = 0;
  aborted = false;

  constructor(
    private readonly engine: BattleEngine,
    private readonly maxNodes = 4_000_000,
  ) {}

  value(s: BattleState): number {
    if (s.status === 'victory') return 1000 + s.p.hp;
    if (s.status === 'defeat') return -s.e.hp;
    const k = stateKey(s);
    const m = this.memo.get(k);
    if (m !== undefined) return m;
    if (this.onStack.has(k)) return CYCLE;
    if (++this.nodes > this.maxNodes) {
      this.aborted = true;
      return -s.e.hp;
    }
    this.onStack.add(k);
    let best = -Infinity;
    for (const a of this.engine.loadout) {
      const r = this.engine.commit(s, a.id, { silent: true });
      if (!r.ok) continue;
      const v = this.value(r.state) - TIME_COST * (r.state.time - s.time);
      if (v > best) best = v;
    }
    this.onStack.delete(k);
    this.memo.set(k, best);
    return best;
  }

  best(s: BattleState): { id: string | null; value: number } {
    let bestId: string | null = null;
    let best = -Infinity;
    for (const a of this.engine.loadout) {
      const r = this.engine.commit(s, a.id, { silent: true });
      if (!r.ok) continue;
      const v = this.value(r.state) - TIME_COST * (r.state.time - s.time);
      if (v > best) {
        best = v;
        bestId = a.id;
      }
    }
    return { id: bestId, value: best };
  }
}

export type Policy = (engine: BattleEngine, s: BattleState) => string;

function available(engine: BattleEngine, s: BattleState) {
  return engine.loadout.filter((a) => engine.cannotCommit(s, a.id) === null);
}

export const policies = {
  maxEffect: ((engine, s) => {
    const list = available(engine, s).filter((a) => a.kind === 'attack');
    const pool = list.length ? list : available(engine, s);
    return [...pool].sort((a, b) => b.effect - a.effect || a.wait - b.wait)[0].id;
  }) as Policy,
  minWait: ((engine, s) => {
    return [...available(engine, s)].sort((a, b) => a.wait - b.wait || b.effect - a.effect)[0].id;
  }) as Policy,
  maxDefense: ((engine, s) => {
    return [...available(engine, s)].sort((a, b) => b.defense - a.defense || b.effect - a.effect)[0].id;
  }) as Policy,
  spam(id: string): Policy {
    return (engine, s) => (engine.cannotCommit(s, id) === null ? id : policies.minWait(engine, s));
  },
  /** 패턴을 아는 사람처럼 몇 수 앞만 보는 정책. */
  lookahead(depth: number): Policy {
    const evalState = (s: BattleState): number => {
      if (s.status === 'victory') return 10 + s.p.hp / s.p.maxHp;
      if (s.status === 'defeat') return -10 - s.e.hp / s.e.maxHp;
      return s.p.hp / s.p.maxHp - (1.15 * s.e.hp) / s.e.maxHp;
    };
    const search = (engine: BattleEngine, s: BattleState, d: number): number => {
      if (d === 0 || s.status !== 'await') return evalState(s);
      let best = -Infinity;
      for (const a of available(engine, s)) {
        const r = engine.commit(s, a.id, { silent: true });
        if (!r.ok) continue;
        best = Math.max(best, search(engine, r.state, d - 1));
      }
      return best;
    };
    return (engine, s) => {
      let bestId = available(engine, s)[0].id;
      let best = -Infinity;
      for (const a of available(engine, s)) {
        const r = engine.commit(s, a.id, { silent: true });
        if (!r.ok) continue;
        const v = search(engine, r.state, depth - 1);
        if (v > best) {
          best = v;
          bestId = a.id;
        }
      }
      return bestId;
    };
  },
};

export interface RunResult {
  win: boolean;
  hpLeft: number;
  enemyHpLeft: number;
  time: number;
  turns: number;
  line: string[];
}

export function runPolicy(engine: BattleEngine, policy: Policy, maxTurns = 250): RunResult {
  let { state } = engine.start();
  const line: string[] = [];
  while (state.status === 'await' && line.length < maxTurns) {
    const id = policy(engine, state);
    const r = engine.commit(state, id, { silent: true });
    if (!r.ok) throw new Error(`정책이 불가능한 행동 선택: ${id} (${r.reason})`);
    line.push(id);
    state = r.state;
  }
  return {
    win: state.status === 'victory',
    hpLeft: state.p.hp,
    enemyHpLeft: state.e.hp,
    time: state.time,
    turns: line.length,
    line,
  };
}

export function runOptimal(engine: BattleEngine, maxNodes?: number): RunResult & { nodes: number; aborted: boolean } {
  const solver = new Solver(engine, maxNodes);
  const res = runPolicy(engine, (_e, s) => solver.best(s).id ?? policies.minWait(engine, s));
  return { ...res, nodes: solver.nodes, aborted: solver.aborted };
}
