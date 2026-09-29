// 미리보기: 실제 엔진 commit을 복제 상태에서 stopAtUncertain으로 돌린 결과만 요약한다.
// 적의 다음 행동은 결정 전이므로 사실처럼 예측하지 않는다 (DESIGN_LOCK §15).
import type { BattleEngine } from './engine';
import type { ActionDef, BattleState, DamageResult } from './types';

export interface PreviewDamage {
  amount: number;
  raw: number;
  defense: number;
  result: DamageResult;
  lethal: boolean;
}

export interface PreviewEnemyStep {
  act: ActionDef;
  /** 지금부터 몇 틱 뒤. 0 = 확정 즉시. */
  at: number;
  damage: PreviewDamage | null;
  delay: { amount: number; applied: boolean } | null;
}

export interface PreviewMine {
  at: number;
  damage: PreviewDamage | null;
  heal: number | null;
  delay: { amount: number; applied: boolean } | null;
}

export type PreviewInfo =
  | { ok: false; reason: string }
  | {
      ok: true;
      act: ActionDef;
      defense: number;
      wait: number;
      usesLeft: number | null;
      /** 내 행동보다 먼저 끝나는 적의 현재 행동(확실). */
      enemyFirst: PreviewEnemyStep | null;
      /** 적의 다음 결정 전에 내 행동이 해결되면 그 결과(확실). */
      mine: PreviewMine | null;
      /** 내 행동이 해결될 예정 틱(지연 반영). */
      mineAt: number;
      /** 내 행동이 적의 다음(미정) 행동 도중 해결됨. */
      mineUncertain: boolean;
      playerDies: boolean;
    };

export function previewCommit(engine: BattleEngine, state: BattleState, actId: string): PreviewInfo {
  const r = engine.commit(state, actId, { stopAtUncertain: true });
  if (!r.ok) return { ok: false, reason: r.reason };
  const act = engine.actionOf('player', actId);
  let elapsed = 0;
  let current: 'player' | 'enemy' | null = null;
  let enemyFirst: PreviewEnemyStep | null = null;
  let mine: PreviewMine | null = null;
  let usesLeft: number | null = null;
  let playerDies = false;

  for (const ev of r.events) {
    switch (ev.t) {
      case 'commit':
        usesLeft = ev.usesLeft;
        break;
      case 'advance':
        elapsed += ev.dt;
        break;
      case 'resolve':
        current = ev.side;
        if (ev.side === 'enemy') {
          enemyFirst = { act: engine.actionOf('enemy', ev.act), at: elapsed, damage: null, delay: null };
        } else {
          mine = { at: elapsed, damage: null, heal: null, delay: null };
        }
        break;
      case 'damage': {
        const d: PreviewDamage = {
          amount: ev.amount,
          raw: ev.raw,
          defense: ev.defense,
          result: ev.result,
          lethal: ev.lethal,
        };
        if (current === 'enemy' && enemyFirst) enemyFirst.damage = d;
        if (current === 'player' && mine) mine.damage = d;
        break;
      }
      case 'heal':
        if (current === 'player' && mine) mine.heal = ev.amount;
        break;
      case 'delay':
        if (current === 'enemy' && enemyFirst) enemyFirst.delay = { amount: ev.amount, applied: ev.applied };
        if (current === 'player' && mine) mine.delay = { amount: ev.amount, applied: ev.applied };
        break;
      case 'death':
        if (ev.side === 'player') playerDies = true;
        break;
      default:
        break;
    }
  }

  const mineAt = mine ? mine.at : elapsed + r.state.p.wait;
  return {
    ok: true,
    act,
    defense: act.defense,
    wait: act.wait,
    usesLeft,
    enemyFirst,
    mine,
    mineAt,
    mineUncertain: !mine && !playerDies,
    playerDies,
  };
}
