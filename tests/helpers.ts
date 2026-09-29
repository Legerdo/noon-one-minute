import { phasedBrain } from '../src/core/ai';
import { BattleEngine } from '../src/core/engine';
import type { ActionDef, BattleEvent, EnemyCombatDef } from '../src/core/types';

export function act(id: string, effect: number, defense: number, wait: number, extra: Partial<ActionDef> = {}): ActionDef {
  const kind = extra.kind ?? (effect > 0 ? 'attack' : 'guard');
  return { id, name: id, kind, effect, defense, wait, ...extra };
}

export function enemy(hp: number, actions: ActionDef[], pattern: string[]): EnemyCombatDef {
  const map: Record<string, ActionDef> = {};
  for (const a of actions) map[a.id] = a;
  return { id: 'test', name: 'test', maxHp: hp, actions: map, ...phasedBrain([{ pattern }]) };
}

export function engineOf(e: EnemyCombatDef, loadout: ActionDef[], hp = 40): BattleEngine {
  return new BattleEngine({ enemy: e, loadout, playerMaxHp: hp });
}

export function only<T extends BattleEvent['t']>(events: BattleEvent[], t: T): Extract<BattleEvent, { t: T }>[] {
  return events.filter((e) => e.t === t) as Extract<BattleEvent, { t: T }>[];
}
