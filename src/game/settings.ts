// 표현 전용 설정. 전투 판정에 전달되지 않는다 (DESIGN_LOCK §15).
export interface Settings {
  sfx: number;
  music: number;
  /** 1 보통, 2 빠름, 3 매우 빠름 */
  speed: 1 | 2 | 3;
  /** 0 끔, 1 약하게, 2 보통 */
  shake: 0 | 1 | 2;
}

const KEY = 'noon1min.settings.v1';

function load(): Settings {
  const d: Settings = { sfx: 0.8, music: 0.6, speed: 1, shake: 2 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      sfx: typeof o.sfx === 'number' ? Math.max(0, Math.min(1, o.sfx)) : d.sfx,
      music: typeof o.music === 'number' ? Math.max(0, Math.min(1, o.music)) : d.music,
      speed: o.speed === 2 || o.speed === 3 ? o.speed : 1,
      shake: o.shake === 0 || o.shake === 1 ? o.shake : 2,
    };
  } catch {
    return d;
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 저장 불가 환경: 무시 */
  }
}

export const SPEED_NAMES = ['', '보통', '빠름', '매우 빠름'] as const;
export const SHAKE_NAMES = ['끔', '약하게', '보통'] as const;
