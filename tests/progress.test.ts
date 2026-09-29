import { describe, expect, it } from 'vitest';
import {
  grantVictory,
  newGame,
  openChest,
  recordDefeat,
  sanitizeSave,
  setLoadout,
  upgradeEquip,
  type SaveData,
} from '../src/game/progress';

function base(): SaveData {
  const s = newGame('f1', 5, 5);
  return { ...s, owned: ['dagger', 'buckler'], loadout: ['dagger', 'buckler'] };
}

describe('보상 중복 방지', () => {
  it('첫 승리 보상은 한 번만', () => {
    const s0 = base();
    const a = grantVictory(s0, 'knight');
    expect(a.reward?.gears).toBe(2);
    expect(a.save.gears).toBe(2);
    expect(a.save.owned).toContain('tower');
    const b = grantVictory(a.save, 'knight');
    expect(b.reward).toBeNull();
    expect(b.save.gears).toBe(2);
    expect(b.save.owned.filter((x) => x === 'tower').length).toBe(1);
    expect(b.save.battles).toBe(2);
  });

  it('연습 인형은 보상 없음, 반복 가능, 첫 승리로 dummy_done', () => {
    const r = grantVictory(base(), 'dummy');
    expect(r.reward).toBeNull();
    expect(r.save.defeated).not.toContain('dummy');
    expect(r.save.flags).toContain('dummy_done');
    expect(grantVictory(r.save, 'dummy').save.flags.filter((f) => f === 'dummy_done').length).toBe(1);
  });

  it('상자는 한 번만 열린다', () => {
    const a = openChest(base(), 'c1', { gears: 1, equip: 'sword' });
    const b = openChest(a.save, 'c1', { gears: 1, equip: 'sword' });
    expect(b.reward).toBeNull();
    expect(b.save.gears).toBe(1);
    expect(b.save.owned.filter((x) => x === 'sword').length).toBe(1);
  });

  it('태엽 심장은 최대 HP +5', () => {
    const a = openChest(base(), 'h1', { gears: 0, heart: true });
    expect(a.save.maxHp).toBe(45);
    expect(openChest(a.save, 'h1', { gears: 0, heart: true }).save.maxHp).toBe(45);
  });

  it('패배는 자원을 잃지 않는다', () => {
    const s = { ...base(), gears: 3 };
    const d = recordDefeat(s);
    expect(d.gears).toBe(3);
    expect(d.losses).toBe(1);
  });
});

describe('강화', () => {
  it('비용 1 → 2, 최대 Lv3, 잔액 부족 거부', () => {
    let s = { ...base(), gears: 3 };
    const r1 = upgradeEquip(s, 'dagger');
    if (!r1.ok) throw new Error(r1.reason);
    s = r1.save;
    expect(s.levels.dagger).toBe(2);
    expect(s.gears).toBe(2);
    const r2 = upgradeEquip(s, 'dagger');
    if (!r2.ok) throw new Error(r2.reason);
    s = r2.save;
    expect(s.levels.dagger).toBe(3);
    expect(s.gears).toBe(0);
    expect(upgradeEquip(s, 'dagger').ok).toBe(false);
    expect(upgradeEquip(s, 'buckler').ok).toBe(false);
    expect(upgradeEquip({ ...s, gears: 9 }, 'hammer').ok).toBe(false);
  });
});

describe('로드아웃', () => {
  it('공격 장비 필수, 5칸, 중복 불가', () => {
    const s = { ...base(), owned: ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl'] as SaveData['owned'] };
    expect(setLoadout(s, ['buckler', 'tower']).ok).toBe(false);
    expect(setLoadout(s, ['dagger', 'dagger']).ok).toBe(false);
    expect(setLoadout(s, ['dagger', 'sword', 'hammer', 'buckler', 'tower', 'awl']).ok).toBe(false);
    expect(setLoadout(s, ['wedge']).ok).toBe(false);
    expect(setLoadout(s, ['awl', 'tower']).ok).toBe(true);
  });
});

describe('저장 복구', () => {
  it('잘못된 값은 거부하거나 안전하게 정리', () => {
    expect(sanitizeSave(null)).toBeNull();
    expect(sanitizeSave({ version: 2 })).toBeNull();
    const s = sanitizeSave({
      version: 1,
      map: 'f2',
      x: 3.7,
      owned: ['dagger', 'dagger', 'laser'],
      loadout: ['dagger', 'sword'],
      levels: { dagger: 9, nope: 2 },
      gears: -4,
      maxHp: 10,
    });
    expect(s).not.toBeNull();
    expect(s!.owned).toEqual(['dagger']);
    expect(s!.loadout).toEqual(['dagger']);
    expect(s!.levels).toEqual({ dagger: 3 });
    expect(s!.gears).toBe(0);
    expect(s!.maxHp).toBe(40);
    expect(s!.x).toBe(3);
  });
});
