// 결정론적 적 AI 도우미. 랜덤 없음 — 고정 순환 + 조건 반응 + HP 단계 (DESIGN_LOCK §9).
import type { AIContext, AIMemory, EnemyBrain } from './types';

export interface PhaseSpec {
  /** 이 단계 진입 조건: 결정 시점의 자기 HP <= 값. 첫 단계는 생략. */
  hpAtOrBelow?: number;
  pattern: readonly string[];
  /** 단계 진입 연출 문구. */
  banner?: string;
  /**
   * 확정 정보에 대한 조건 반응. 계획된 행동 "대신" 다른 행동을 한다.
   * 패턴은 그대로 한 칸 진행한다(계획된 행동은 건너뜀) — 반응으로 패턴이 멈추는 무한 루프 방지.
   */
  react?: (ctx: AIContext, planned: string) => string | null;
}

export function phasedBrain(phases: readonly PhaseSpec[]): EnemyBrain {
  if (phases.length === 0) throw new Error('단계가 없음');
  return {
    initMem: () => ({ ph: 0, i: 0 }),
    decide(ctx: AIContext, mem: AIMemory) {
      let ph = mem.ph ?? 0;
      let i = mem.i ?? 0;
      let banner: string | undefined;
      // 조건을 만족하는 가장 깊은 단계로 (결정 시점에만 검사).
      for (let k = phases.length - 1; k > ph; k--) {
        const th = phases[k].hpAtOrBelow;
        if (th != null && ctx.selfHp <= th) {
          ph = k;
          i = 0;
          banner = phases[k].banner;
          break;
        }
      }
      const spec = phases[ph];
      const planned = spec.pattern[i % spec.pattern.length];
      const reacted = spec.react ? spec.react(ctx, planned) : null;
      return { act: reacted ?? planned, mem: { ph, i: (i + 1) % spec.pattern.length }, banner, phase: ph };
    },
  };
}

export function cycleBrain(pattern: readonly string[]): EnemyBrain {
  return phasedBrain([{ pattern }]);
}
