import { describe, expect, it } from 'vitest';
import { cloneState } from '../src/core/engine';
import { previewCommit } from '../src/core/preview';
import { act, enemy, engineOf, only } from './helpers';

describe('시간 진행', () => {
  it('남은 시간 보존: 플레이어 W3, 적 W10 → 플레이어 행동 후 적 남은 Wait 7', () => {
    const eng = engineOf(enemy(99, [act('slow', 1, 0, 10)], ['slow']), [act('poke', 1, 0, 3)]);
    const { state } = eng.start();
    const r = eng.commit(state, 'poke');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.status).toBe('await');
    expect(r.state.e.wait).toBe(7);
    expect(r.state.e.act).toBe('slow');
    expect(r.state.time).toBe(3);
  });

  it('느린 플레이어 행동: 적 행동마다 플레이어 Wait 10→7→3, 중간 재선택 불가', () => {
    const e = enemy(99, [act('a', 1, 0, 3), act('b', 1, 0, 4)], ['a', 'b']);
    const eng = engineOf(e, [act('slow', 1, 0, 10), act('fast', 1, 0, 1)]);
    const { state } = eng.start();
    const r = eng.commit(state, 'slow');
    if (!r.ok) throw new Error(r.reason);
    const enemyResolves = r.events
      .map((ev, i) => ({ ev, i }))
      .filter((x) => x.ev.t === 'resolve' && x.ev.side === 'enemy');
    expect(enemyResolves.length).toBe(2);
    const adv = only(r.events, 'advance');
    expect(adv[0].pWait).toBe(7);
    expect(adv[1].pWait).toBe(3);
    // 플레이어 행동이 해결될 때까지 선택권(await)은 오지 않는다.
    const firstAwait = r.events.findIndex((ev) => ev.t === 'await');
    const playerResolve = r.events.findIndex((ev) => ev.t === 'resolve' && ev.side === 'player');
    expect(firstAwait).toBeGreaterThan(playerResolve);
    expect(only(r.events, 'commit').length).toBe(1);

    // 중간 상태(첫 적 행동 직후)에서는 확정이 거부된다.
    const mid = eng.commit(state, 'slow', { stopAtUncertain: true });
    if (!mid.ok) throw new Error(mid.reason);
    expect(mid.state.p.act).toBe('slow');
    expect(mid.state.p.wait).toBe(7);
    expect(eng.cannotCommit(mid.state, 'fast')).not.toBeNull();
  });
});

describe('방어', () => {
  it('준비 중 방어: 물리 18 vs 방패 방어 14 → 피해 4', () => {
    const eng = engineOf(enemy(99, [act('hit', 18, 0, 3)], ['hit']), [act('shield', 0, 14, 7)]);
    const { state } = eng.start();
    const r = eng.commit(state, 'shield');
    if (!r.ok) throw new Error(r.reason);
    const hits = only(r.events, 'damage');
    // 방패 7틱 동안 적 공격(W3)이 t=3, t=6 두 번 들어온다. 둘 다 같은 방어 14로 계산.
    expect(hits.map((d) => d.amount)).toEqual([4, 4]);
    expect(hits[0].result).toBe('partial');
    expect(hits[0].hp).toBe(36);
    expect(r.state.p.hp).toBe(32);
  });

  it('방패 종료 후 교체: 이전 방어 14는 남지 않는다', () => {
    const eng = engineOf(enemy(99, [act('hit', 18, 0, 5)], ['hit']), [act('shield', 0, 14, 2), act('bow', 7, 0, 10)]);
    let { state } = eng.start();
    const r1 = eng.commit(state, 'shield');
    if (!r1.ok) throw new Error(r1.reason);
    state = r1.state;
    expect(only(r1.events, 'damage').length).toBe(0);
    expect(state.p.act).toBeNull();
    expect(eng.defenseOf(state.p, 'player')).toBe(0);
    const r2 = eng.commit(state, 'bow');
    if (!r2.ok) throw new Error(r2.reason);
    const dmg = only(r2.events, 'damage').find((d) => d.target === 'player')!;
    expect(dmg.defense).toBe(0);
    expect(dmg.amount).toBe(18);
  });

  it('방어 무시: 방어 14 상태에서도 관통 18은 피해 18', () => {
    const eng = engineOf(enemy(99, [act('pierce', 18, 0, 3, { pierce: true })], ['pierce']), [act('shield', 0, 14, 7)]);
    const { state } = eng.start();
    const r = eng.commit(state, 'shield');
    if (!r.ok) throw new Error(r.reason);
    const dmg = only(r.events, 'damage')[0];
    expect(dmg.amount).toBe(18);
    expect(dmg.result).toBe('pierce');
  });

  it('완전 방어는 full 결과로 구분된다', () => {
    const eng = engineOf(enemy(99, [act('hit', 9, 0, 1)], ['hit']), [act('buckler', 0, 9, 2)]);
    const r = eng.commit(eng.start().state, 'buckler');
    if (!r.ok) throw new Error(r.reason);
    expect(only(r.events, 'damage')[0].result).toBe('full');
    expect(r.state.p.hp).toBe(40);
  });
});

describe('동률', () => {
  it('동률 처치: 플레이어 선행 공격으로 적이 죽으면 적 행동은 실행되지 않는다', () => {
    const eng = engineOf(enemy(5, [act('hit', 18, 0, 3)], ['hit']), [act('stab', 5, 0, 3)]);
    const r = eng.commit(eng.start().state, 'stab');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.status).toBe('victory');
    expect(r.state.p.hp).toBe(40);
    expect(r.events.some((ev) => ev.t === 'resolve' && ev.side === 'enemy')).toBe(false);
  });

  it('동률 후 방패: 추가 시간 없이 적 공격, 피해 4, 새 방패 Wait 감소 없음', () => {
    const eng = engineOf(enemy(50, [act('hit', 18, 0, 3)], ['hit']), [act('stab', 5, 0, 3), act('shield', 0, 14, 6)]);
    const r1 = eng.commit(eng.start().state, 'stab');
    if (!r1.ok) throw new Error(r1.reason);
    expect(r1.state.status).toBe('await');
    expect(r1.state.e.hp).toBe(45);
    expect(r1.state.e.act).toBe('hit');
    expect(r1.state.e.wait).toBe(0);
    expect(r1.state.p.hp).toBe(40);

    const stopped = eng.commit(r1.state, 'shield', { stopAtUncertain: true });
    if (!stopped.ok) throw new Error(stopped.reason);
    expect(stopped.state.p.hp).toBe(36);
    expect(stopped.state.p.wait).toBe(6);
    expect(stopped.state.time).toBe(3);

    const r2 = eng.commit(r1.state, 'shield');
    if (!r2.ok) throw new Error(r2.reason);
    const order = r2.events.map((e) => e.t);
    expect(order.slice(0, 5)).toEqual(['commit', 'resolve', 'damage', 'release', 'intent']);
    const first = r2.events[1];
    expect(first.t === 'resolve' && first.immediate && first.side === 'enemy').toBe(true);
    const dmg = only(r2.events, 'damage')[0];
    expect(dmg.amount).toBe(4);
  });

  it('동률에서 지연 공격이 적 Wait를 밀면 확정 직후 즉시 해결은 없다', () => {
    const eng = engineOf(enemy(50, [act('hit', 18, 0, 3)], ['hit']), [act('wedge', 1, 0, 3, { delay: 4 }), act('shield', 0, 14, 6)]);
    const r1 = eng.commit(eng.start().state, 'wedge');
    if (!r1.ok) throw new Error(r1.reason);
    expect(r1.state.e.wait).toBe(4);
    const r2 = eng.commit(r1.state, 'shield');
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.events[1].t).toBe('advance');
  });
});

describe('사망과 효과 순서', () => {
  it('플레이어 사망 즉시 패배, 이후 행동 없음', () => {
    const eng = engineOf(enemy(99, [act('hit', 50, 0, 2)], ['hit']), [act('slow', 30, 0, 5)]);
    const r = eng.commit(eng.start().state, 'slow');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.status).toBe('defeat');
    expect(r.state.p.hp).toBe(0);
    expect(r.events.some((ev) => ev.t === 'resolve' && ev.side === 'player')).toBe(false);
    expect(r.events[r.events.length - 1]).toEqual({ t: 'end', result: 'defeat' });
  });

  it('지연은 같은 행동 인스턴스에 한 번만', () => {
    const eng = engineOf(enemy(99, [act('big', 1, 0, 20)], ['big']), [act('wedge', 1, 0, 2, { delay: 4 })]);
    const r1 = eng.commit(eng.start().state, 'wedge');
    if (!r1.ok) throw new Error(r1.reason);
    expect(r1.state.e.wait).toBe(22);
    const r2 = eng.commit(r1.state, 'wedge');
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.state.e.wait).toBe(20);
    const d = only(r2.events, 'delay')[0];
    expect(d.applied).toBe(false);
  });

  it('회복은 최대 HP를 넘지 않고, 사용 횟수는 확정 시 차감', () => {
    const eng = engineOf(enemy(99, [act('hit', 10, 0, 1)], ['hit']), [act('tonic', 30, 0, 3, { kind: 'heal', uses: 1 })]);
    const s0 = eng.start().state;
    const r = eng.commit(s0, 'tonic');
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.uses.tonic).toBe(0);
    // t=1,2에 피격(40→20), t=3 동률에서 플레이어 우선으로 회복 30 → 최대 40에서 멈춤.
    expect(r.state.p.hp).toBe(40);
    const heal = only(r.events, 'heal')[0];
    expect(heal.amount).toBe(20);
    expect(r.state.e.wait).toBe(0);
    expect(eng.cannotCommit(r.state, 'tonic')).toBe('남은 사용 횟수 없음');
  });

  it('신규 행동 Wait 0은 데이터 검증에서 거부', () => {
    expect(() => engineOf(enemy(9, [act('a', 1, 0, 1)], ['a']), [act('zero', 1, 0, 0)])).toThrow();
  });
});

describe('입력·미리보기 순수성', () => {
  it('미리보기는 상태를 바꾸지 않고, 실제 결과와 같은 계산 경로를 쓴다', () => {
    const eng = engineOf(enemy(60, [act('hit', 12, 0, 4), act('guard', 0, 10, 3)], ['hit', 'guard']), [
      act('sword', 9, 5, 4),
      act('shield', 0, 14, 6),
      act('dagger', 4, 1, 2),
    ]);
    const s0 = eng.start().state;
    const snapshot = JSON.stringify(s0);
    for (let i = 0; i < 20; i++) for (const id of ['sword', 'shield', 'dagger']) previewCommit(eng, s0, id);
    expect(JSON.stringify(s0)).toBe(snapshot);

    const pv = previewCommit(eng, s0, 'dagger');
    if (!pv.ok) throw new Error(pv.reason);
    const real = eng.commit(s0, 'dagger');
    if (!real.ok) throw new Error(real.reason);
    const realDmg = only(real.events, 'damage').find((d) => d.target === 'enemy')!;
    expect(pv.mine?.damage?.amount).toBe(realDmg.amount);
    expect(pv.mine?.at).toBe(2);

    const pvShield = previewCommit(eng, s0, 'shield');
    if (!pvShield.ok) throw new Error(pvShield.reason);
    expect(pvShield.enemyFirst?.damage?.amount).toBe(0);
    expect(pvShield.mineUncertain).toBe(true);
  });

  it('AI는 미리보기의 영향을 받지 않는다', () => {
    const e = enemy(60, [act('hit', 12, 0, 4), act('guard', 0, 10, 3)], ['hit', 'guard']);
    const loadout = [act('sword', 9, 5, 4), act('shield', 0, 14, 6)];
    const a = engineOf(e, loadout);
    const b = engineOf(e, loadout);
    let sa = a.start().state;
    let sb = b.start().state;
    const seq = ['sword', 'shield', 'sword', 'sword', 'shield', 'sword'];
    for (const id of seq) {
      for (const any of ['sword', 'shield']) previewCommit(b, sb, any);
      const ra = a.commit(sa, id);
      const rb = b.commit(sb, id);
      if (!ra.ok || !rb.ok) break;
      expect(rb.events).toEqual(ra.events);
      sa = ra.state;
      sb = rb.state;
      if (sa.status !== 'await') break;
    }
    expect(sb).toEqual(sa);
  });

  it('같은 선택 창(turn)에서 두 번째 확정은 거부된다', () => {
    const eng = engineOf(enemy(60, [act('hit', 3, 0, 4)], ['hit']), [act('dagger', 4, 1, 2)]);
    const s0 = eng.start().state;
    const turn = s0.turn;
    const r1 = eng.commit(s0, 'dagger', { expectTurn: turn });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = eng.commit(r1.state, 'dagger', { expectTurn: turn });
    expect(r2.ok).toBe(false);
  });

  it('cloneState는 깊은 복사', () => {
    const eng = engineOf(enemy(60, [act('hit', 3, 0, 4)], ['hit']), [act('dagger', 4, 1, 2)]);
    const s0 = eng.start().state;
    const c = cloneState(s0);
    c.p.hp = 1;
    c.uses.x = 3;
    expect(s0.p.hp).toBe(40);
    expect(s0.uses.x).toBeUndefined();
  });
});
