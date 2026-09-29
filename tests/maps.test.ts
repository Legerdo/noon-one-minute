// 맵 데이터 검증: 격자 크기, 엔티티 배치, 출구 연결, 진행 순서대로 도달 가능한지.
import { describe, expect, it } from 'vitest';
import { baseChar, isWallChar } from '../src/art/tiles';
import { entitiesOf, key, MAPS, type MapDef, type MapId } from '../src/data/maps';

function grid(m: MapDef) {
  return { rows: m.rows, theme: m.theme, floorUnder: m.floorUnder };
}

function reach(m: MapDef, sx: number, sy: number, opts: { defeated: Set<string>; broken: Set<string> }): Set<string> {
  const blocked = new Set<string>();
  for (const p of entitiesOf(m)) {
    if (p.e.kind === 'enemy' && opts.defeated.has(p.e.enemy) && p.e.enemy !== 'dummy') continue;
    blocked.add(key(p.x, p.y));
  }
  for (const d of m.decor) if (d.kind === 'crate' || d.kind === 'clock') blocked.add(key(d.x, d.y));
  const ok = (x: number, y: number) => {
    const c = baseChar(grid(m), x, y);
    if (c === undefined) return false;
    if (c === '%') return true;
    if (c === 'X') return opts.broken.has(m.walls[key(x, y)]);
    if (isWallChar(c) || c === '~') return false;
    return !blocked.has(key(x, y));
  };
  const seen = new Set<string>([key(sx, sy)]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (seen.has(k) || !ok(nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

function adjacentReachable(r: Set<string>, x: number, y: number): boolean {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => r.has(key(x + dx, y + dy)));
}

describe('맵 데이터', () => {
  for (const m of Object.values(MAPS)) {
    it(`${m.id}: 직사각형 격자, 시작점·출구가 걷기 가능`, () => {
      const w = m.rows[0].length;
      m.rows.forEach((r, i) => expect(r.length, `${m.id} 행 ${i}`).toBe(w));
      const c = baseChar(grid(m), m.start.x, m.start.y);
      expect(c && !isWallChar(c)).toBeTruthy();
      for (const [k, ex] of Object.entries(m.exits)) {
        const [x, y] = k.split(',').map(Number);
        expect(['^', 'v']).toContain(m.rows[y][x]);
        const target = MAPS[ex.to as MapId];
        const tc = baseChar(grid(target), ex.x, ex.y);
        expect(tc && !isWallChar(tc) && tc !== '~', `${m.id}→${ex.to} 도착 지점`).toBeTruthy();
      }
      for (const k of Object.keys(m.walls)) {
        const [x, y] = k.split(',').map(Number);
        expect(m.rows[y][x]).toBe('X');
      }
      for (const k of Object.keys(m.triggers)) {
        const [x, y] = k.split(',').map(Number);
        const tc = baseChar(grid(m), x, y);
        expect(tc && !isWallChar(tc)).toBeTruthy();
      }
    });
  }

  it('진행 순서대로 모든 적·상자·출구에 도달할 수 있다', () => {
    const defeated = new Set<string>();
    const broken = new Set<string>();
    // 1층: 공구함 → 쥐 → 장검 → 파수병 → 계단
    const f1 = MAPS.f1;
    let r = reach(f1, f1.start.x, f1.start.y, { defeated, broken });
    const at = (m: MapDef, ch: string) => entitiesOf(m).find((p) => p.ch === ch)!;
    expect(adjacentReachable(r, at(f1, 'c').x, at(f1, 'c').y)).toBe(true);
    expect(adjacentReachable(r, at(f1, 'b').x, at(f1, 'b').y)).toBe(true);
    expect(adjacentReachable(r, at(f1, 'd').x, at(f1, 'd').y)).toBe(true);
    expect(adjacentReachable(r, at(f1, 'r').x, at(f1, 'r').y)).toBe(true);
    expect(adjacentReachable(r, at(f1, 'a').x, at(f1, 'a').y)).toBe(false);
    defeated.add('rat');
    r = reach(f1, f1.start.x, f1.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f1, 'a').x, at(f1, 'a').y)).toBe(true);
    expect(adjacentReachable(r, at(f1, 's').x, at(f1, 's').y)).toBe(true);
    expect(r.has('15,1')).toBe(false);
    defeated.add('sentry');
    r = reach(f1, f1.start.x, f1.start.y, { defeated, broken });
    expect(r.has('15,1')).toBe(true);
    // 비밀방은 망치가 있어야
    expect(adjacentReachable(r, at(f1, 'k').x, at(f1, 'k').y)).toBe(false);

    // 2층
    const f2 = MAPS.f2;
    r = reach(f2, f2.start.x, f2.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f2, 'a').x, at(f2, 'a').y)).toBe(true);
    expect(adjacentReachable(r, at(f2, 'b').x, at(f2, 'b').y)).toBe(true);
    expect(adjacentReachable(r, at(f2, 'n').x, at(f2, 'n').y)).toBe(false);
    broken.add('f2_wall');
    r = reach(f2, f2.start.x, f2.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f2, 'n').x, at(f2, 'n').y)).toBe(true);
    expect(adjacentReachable(r, at(f2, 'k').x, at(f2, 'k').y)).toBe(true);
    defeated.add('knight');
    r = reach(f2, f2.start.x, f2.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f2, 's').x, at(f2, 's').y)).toBe(true);
    defeated.add('swarm');
    r = reach(f2, f2.start.x, f2.start.y, { defeated, broken });
    expect(r.has('14,1')).toBe(true);
    // 망치를 들고 1층 비밀방
    broken.add('f1_wall');
    r = reach(f1, 15, 2, { defeated, broken });
    expect(adjacentReachable(r, at(f1, 'k').x, at(f1, 'k').y)).toBe(true);

    // 3층
    const f3 = MAPS.f3;
    r = reach(f3, f3.start.x, f3.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f3, 'a').x, at(f3, 'a').y)).toBe(true);
    expect(adjacentReachable(r, at(f3, 'b').x, at(f3, 'b').y)).toBe(true);
    expect(adjacentReachable(r, at(f3, 'T').x, at(f3, 'T').y)).toBe(true);
    expect(adjacentReachable(r, at(f3, 'c').x, at(f3, 'c').y)).toBe(false);
    defeated.add('tortoise');
    r = reach(f3, f3.start.x, f3.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f3, 'c').x, at(f3, 'c').y)).toBe(true);
    expect(adjacentReachable(r, at(f3, 'k').x, at(f3, 'k').y)).toBe(true);
    expect(adjacentReachable(r, at(f3, 'h').x, at(f3, 'h').y)).toBe(true);
    defeated.add('hexer');
    r = reach(f3, f3.start.x, f3.start.y, { defeated, broken });
    expect(r.has('14,1')).toBe(true);

    // 꼭대기
    const f4 = MAPS.f4;
    r = reach(f4, f4.start.x, f4.start.y, { defeated, broken });
    expect(adjacentReachable(r, at(f4, 'B').x, at(f4, 'B').y)).toBe(true);
    expect(adjacentReachable(r, at(f4, 'b').x, at(f4, 'b').y)).toBe(true);
    expect(adjacentReachable(r, at(f4, 'g').x, at(f4, 'g').y)).toBe(true);
  });
});
