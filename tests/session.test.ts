import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleState } from '../src/core/types';
import { buildLoadout } from '../src/data/equipment';
import { ENEMIES } from '../src/data/enemies';
import { BattleSession, type Presenter } from '../src/game/battleSession';

const setup = () => ({
  enemy: ENEMIES.sentry,
  loadout: buildLoadout(['dagger', 'sword', 'buckler'], {}),
  playerMaxHp: 40,
});

interface Outcome {
  state: BattleState;
  log: BattleEvent[];
  rejected: number;
}

function run(delayOf: (ev: BattleEvent, n: number) => number, seq: string[]): Promise<Outcome> {
  return new Promise((resolve) => {
    let n = 0;
    const presenter: Presenter = {
      play: (ev) =>
        new Promise<void>((r) => {
          const d = delayOf(ev, n++);
          if (d <= 0) r();
          else setTimeout(r, d);
        }),
    };
    const session = new BattleSession(setup(), presenter);
    let i = 0;
    let rejected = 0;
    session.onSelect = (turn) => {
      const id = seq[i++ % seq.length];
      // 같은 선택 창에서 연타: 첫 요청만 처리돼야 한다.
      const a = session.request(id, turn);
      const b = session.request(id, turn);
      const c = session.request(seq[(i + 1) % seq.length]);
      if (!a) throw new Error('첫 요청이 거부됨');
      if (b || c) throw new Error('중복 요청이 처리됨');
      rejected += 2;
    };
    session.onEnd = () => resolve({ state: session.state as BattleState, log: [...session.log], rejected });
    void session.begin();
  });
}

describe('연출 독립성', () => {
  const seq = ['sword', 'buckler', 'dagger', 'sword', 'sword', 'buckler'];

  it('연출 속도·스킵·흔들림 설정이 달라도 논리 결과가 같다', async () => {
    const skip = await run(() => 0, seq);
    const slow = await run((ev) => (ev.t === 'advance' ? 3 : 1), seq);
    const jittery = await run((_ev, n) => (n * 7) % 4, seq);
    const heavyShake = await run((ev) => (ev.t === 'damage' ? 5 : 0), seq);
    for (const o of [slow, jittery, heavyShake]) {
      expect(o.state).toEqual(skip.state);
      expect(o.log).toEqual(skip.log);
    }
    expect(['victory', 'defeat']).toContain(skip.state.status);
    expect(skip.rejected).toBeGreaterThan(0);
  });

  it('재생 중 요청은 버린다(입력 버퍼 없음)', async () => {
    let release: () => void = () => {};
    const presenter: Presenter = {
      play: (ev) => (ev.t === 'advance' ? new Promise<void>((r) => (release = r)) : Promise.resolve()),
    };
    const session = new BattleSession(setup(), presenter);
    await new Promise<void>((resolve) => {
      session.onSelect = () => resolve();
      void session.begin();
    });
    expect(session.request('sword')).toBe(true);
    // 첫 advance에서 재생이 멈춰 있는 동안 들어온 입력
    expect(session.sessionPhase).toBe('playing');
    expect(session.request('dagger')).toBe(false);
    expect(session.state.turn).toBe(1);
    release();
    session.dispose();
  });

  it('dispose 후에는 이전 전투 콜백이 실행되지 않는다', async () => {
    let calls = 0;
    const presenter: Presenter = { play: () => new Promise<void>((r) => setTimeout(r, 2)) };
    const session = new BattleSession(setup(), presenter);
    session.onSelect = () => calls++;
    void session.begin();
    session.dispose();
    await new Promise((r) => setTimeout(r, 40));
    expect(calls).toBe(0);
  });
});
