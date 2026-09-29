// 밸런스 검증: 단순 정책 vs 상대를 읽는 정책 (프롬프트 §25).
import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/core/engine';
import { policies, runOptimal, runPolicy, type RunResult } from '../src/core/solver';
import { buildLoadout, type EquipId } from '../src/data/equipment';
import { ENEMIES, type EnemyId } from '../src/data/enemies';

interface Scenario {
  label?: string;
  enemy: EnemyId;
  owned: EquipId[];
  levels: Partial<Record<EquipId, number>>;
  hp: number;
  /** 튜토리얼성 적은 단순 정책도 이길 수 있다. */
  tutorial?: boolean;
  /** 탐색 비용이 큰 전투는 후보 로드아웃만 비교. */
  candidates?: EquipId[][];
}

// 게임 진행상 그 전투 시점에 기대되는 장비·강화·HP (보수적으로 강화 최소).
const SCENARIOS: Scenario[] = [
  { enemy: 'rat', owned: ['dagger', 'buckler'], levels: {}, hp: 40, tutorial: true },
  { enemy: 'sentry', owned: ['dagger', 'sword', 'buckler'], levels: {}, hp: 40 },
  { enemy: 'knight', owned: ['dagger', 'sword', 'hammer', 'buckler'], levels: {}, hp: 40 },
  { enemy: 'swarm', owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower'], levels: { sword: 2 }, hp: 40 },
  { enemy: 'tortoise', owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl'], levels: { sword: 2, hammer: 2 }, hp: 40 },
  {
    enemy: 'hexer',
    owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl', 'tonic'],
    levels: { sword: 2, hammer: 2, awl: 2 },
    hp: 40,
  },
  {
    enemy: 'boss',
    owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl', 'tonic', 'wedge'],
    levels: { sword: 2, hammer: 2, awl: 2, tower: 2, tonic: 2 },
    hp: 45,
    candidates: [
      ['hammer', 'tower', 'awl', 'tonic', 'wedge'],
      ['sword', 'hammer', 'tower', 'awl', 'tonic'],
      ['sword', 'hammer', 'tower', 'awl', 'wedge'],
      ['dagger', 'hammer', 'tower', 'awl', 'wedge'],
      ['sword', 'hammer', 'buckler', 'awl', 'wedge'],
      ['dagger', 'sword', 'hammer', 'tower', 'tonic'],
    ],
  },
  {
    // Wait 감소 강화까지 모두 끝낸 경우에도 단순 정책이 통하지 않는지 재검증.
    label: 'boss(풀강화)',
    enemy: 'boss',
    owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl', 'tonic', 'wedge'],
    levels: { dagger: 3, sword: 3, hammer: 3, buckler: 3, tower: 3, awl: 3, tonic: 3, wedge: 3 },
    hp: 50,
    candidates: [
      ['hammer', 'tower', 'awl', 'tonic', 'wedge'],
      ['sword', 'hammer', 'tower', 'awl', 'wedge'],
      ['dagger', 'sword', 'hammer', 'tower', 'tonic'],
    ],
  },
];

function combos<T>(arr: T[], k: number): T[][] {
  if (arr.length <= k) return [arr];
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < arr.length; i++) rec(i + 1, [...acc, arr[i]]);
  };
  rec(0, []);
  return out;
}

function engineFor(sc: Scenario, ids: EquipId[]) {
  return new BattleEngine({ enemy: ENEMIES[sc.enemy], loadout: buildLoadout(ids, sc.levels), playerMaxHp: sc.hp });
}

function fmt(r: RunResult): string {
  return r.win ? `승 HP${String(r.hpLeft).padStart(3)}` : `패 적${String(r.enemyHpLeft).padStart(3)}`;
}

const report: string[] = [];

describe('밸런스', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.label ?? sc.enemy}: 읽는 전략이 단순 정책보다 낫다`, () => {
      // 최적 로드아웃 탐색
      let best: { ids: EquipId[]; res: ReturnType<typeof runOptimal> } | null = null;
      const perLoadout: string[] = [];
      for (const ids of sc.candidates ?? combos(sc.owned, 5)) {
        const res = runOptimal(engineFor(sc, ids), 3_000_000);
        perLoadout.push(`    · ${ids.join(',').padEnd(40)} ${fmt(res)} t=${res.time}`);
        if (!best || (res.win && (!best.res.win || res.hpLeft > best.res.hpLeft))) best = { ids, res };
      }
      const ids = best!.ids;
      const eng = engineFor(sc, ids);
      const rows: [string, RunResult][] = [
        ['최적(읽기)', best!.res],
        ['4수 앞보기', runPolicy(eng, policies.lookahead(4))],
        ['3수 앞보기', runPolicy(eng, policies.lookahead(3))],
        ['2수 앞보기', runPolicy(eng, policies.lookahead(2))],
        ['최고 위력만', runPolicy(eng, policies.maxEffect)],
        ['최단 대기만', runPolicy(eng, policies.minWait)],
        ['최고 방어만', runPolicy(eng, policies.maxDefense)],
      ];
      for (const id of ids) rows.push([`${id}만`, runPolicy(eng, policies.spam(id))]);
      report.push(
        `\n[${sc.label ?? sc.enemy}] HP${sc.hp} 로드아웃: ${ids.join(',')}  (탐색 ${best!.res.nodes}노드${best!.res.aborted ? ' 중단' : ''})`,
      );
      for (const [name, r] of rows) report.push(`  ${name.padEnd(10)} ${fmt(r)}  t=${r.time} 수=${r.turns}`);
      report.push(`  최적 수순: ${best!.res.line.join(' ')}`);
      if (perLoadout.length > 1) report.push('  로드아웃별 최적:', ...perLoadout);

      expect(best!.res.win).toBe(true);
      const opt = best!.res;
      const naive = rows.slice(4).map(([, r]) => r);
      if (!sc.tutorial) {
        // 단순 정책은 최적보다 확실히 못해야 한다(패배하거나 HP를 크게 잃음).
        for (const r of naive) {
          const clearlyWorse = !r.win || r.hpLeft <= opt.hpLeft - 8;
          expect(clearlyWorse).toBe(true);
        }
      }
    });
  }

  it('보고서 출력', () => {
    console.log(report.join('\n'));
  });
});
