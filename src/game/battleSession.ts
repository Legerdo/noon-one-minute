// 입력(명령) → 엔진 → 사건 재생의 유일한 관문. Phaser 비의존이라 테스트 가능하다.
// 연출(Presenter)은 사건을 표현만 하며 결과를 바꿀 수 없다 (DESIGN_LOCK §14, §15).
import { BattleEngine } from '../core/engine';
import { previewCommit, type PreviewInfo } from '../core/preview';
import type { BattleEvent, BattleSetup, BattleState } from '../core/types';

export interface Presenter {
  /** 사건 하나를 표현한다. 끝나면 resolve. 결과값은 무시된다. */
  play(ev: BattleEvent, state: Readonly<BattleState>): Promise<void>;
}

export type SessionPhase = 'idle' | 'playing' | 'selecting' | 'ended';

export class BattleSession {
  readonly engine: BattleEngine;
  private _state: BattleState;
  private phase: SessionPhase = 'idle';
  /** 현재 열린 선택 창의 turn. 선택 창이 없으면 null. */
  private panelTurn: number | null = null;
  private runId = 0;
  private disposed = false;
  readonly log: BattleEvent[] = [];

  onSelect: ((turn: number) => void) | null = null;
  onEnd: ((result: 'victory' | 'defeat') => void) | null = null;

  constructor(
    setup: BattleSetup,
    private readonly presenter: Presenter,
  ) {
    this.engine = new BattleEngine(setup);
    this._state = this.engine.start().state;
  }

  get state(): Readonly<BattleState> {
    return this._state;
  }

  get sessionPhase(): SessionPhase {
    return this.phase;
  }

  get selectableTurn(): number | null {
    return this.phase === 'selecting' ? this.panelTurn : null;
  }

  /** 전투 시작 사건 재생. 한 번만 유효. */
  begin(): Promise<void> {
    if (this.phase !== 'idle') return Promise.resolve();
    const { state, events } = this.engine.start();
    this._state = state;
    return this.playAll(events);
  }

  /** 미리보기: 상태를 바꾸지 않는다. */
  preview(actId: string): PreviewInfo {
    return previewCommit(this.engine, this._state, actId);
  }

  /**
   * 행동 확정 요청. 선택 창이 열려 있고 turn이 일치할 때만 한 번 처리된다.
   * 처리되면 true, 무시되면 false.
   */
  request(actId: string, turn?: number): boolean {
    if (this.disposed || this.phase !== 'selecting' || this.panelTurn === null) return false;
    if (turn != null && turn !== this.panelTurn) return false;
    const r = this.engine.commit(this._state, actId, { expectTurn: this.panelTurn });
    if (!r.ok) return false;
    this._state = r.state;
    this.panelTurn = null;
    void this.playAll(r.events);
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.runId++;
    this.onSelect = null;
    this.onEnd = null;
  }

  private async playAll(events: BattleEvent[]): Promise<void> {
    const id = ++this.runId;
    this.phase = 'playing';
    for (const ev of events) {
      this.log.push(ev);
      await this.presenter.play(ev, this._state);
      if (id !== this.runId || this.disposed) return;
    }
    if (this._state.status === 'await') {
      this.phase = 'selecting';
      this.panelTurn = this._state.turn;
      this.onSelect?.(this._state.turn);
    } else {
      this.phase = 'ended';
      this.onEnd?.(this._state.status);
    }
  }
}
