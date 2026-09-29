// 팔레트 색만 찍는 정수 좌표 픽셀 버퍼. 안티앨리어싱 없음.
import { CHARS, RAMP } from './palette';

export const CLEAR = -1;

export class PixelCanvas {
  readonly data: Int32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Int32Array(w * h).fill(CLEAR);
  }

  static fromRows(rows: readonly string[], map: Readonly<Record<string, number>> = CHARS): PixelCanvas {
    const w = Math.max(...rows.map((r) => r.length));
    const c = new PixelCanvas(w, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = map[ch];
        if (col === undefined) throw new Error(`알 수 없는 픽셀 문자 '${ch}' (${x},${y})`);
        c.set(x, y, col);
      }
    });
    return c;
  }

  clone(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.data.set(this.data);
    return c;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.w + x] : CLEAR;
  }

  set(x: number, y: number, c: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (this.inside(x, y)) this.data[y * this.w + x] = c;
  }

  /** 이미 칠해진 곳에만 찍는다. */
  setIfFilled(x: number, y: number, c: number): void {
    if (this.get(x, y) !== CLEAR) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  frame(x: number, y: number, w: number, h: number, c: number): this {
    for (let i = 0; i < w; i++) {
      this.set(x + i, y, c);
      this.set(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.set(x, y + j, c);
      this.set(x + w - 1, y + j, c);
    }
    return this;
  }

  hline(x0: number, x1: number, y: number, c: number): this {
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    for (let x = a; x <= b; x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: number): this {
    const a = Math.min(y0, y1);
    const b = Math.max(y0, y1);
    for (let y = a; y <= b; y++) this.set(x, y, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** 두께 w의 선: 정사각 붓으로 찍는다. */
  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: number): this {
    const pts = linePoints(x0, y0, x1, y1);
    const o = Math.floor((w - 1) / 2);
    for (const [x, y] of pts) this.rect(x - o, y - o, w, w, c);
    return this;
  }

  disc(cx: number, cy: number, r: number, c: number): this {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) this.set(cx + x, cy + y, c);
    return this;
  }

  ring(cx: number, cy: number, r: number, c: number): this {
    // 중점 원 알고리즘
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      const pts = [
        [x, y],
        [y, x],
        [-y, x],
        [-x, y],
        [-x, -y],
        [-y, -x],
        [y, -x],
        [x, -y],
      ];
      for (const [px, py] of pts) this.set(cx + px, cy + py, c);
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): this {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const v = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5);
        if (v <= 1) this.set(cx + x, cy + y, c);
      }
    return this;
  }

  /** 스캔라인 다각형 채우기. */
  poly(points: readonly (readonly [number, number])[], c: number): this {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        const yc = y + 0.5;
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  blit(src: PixelCanvas, dx: number, dy: number, opts: { flipX?: boolean; flipY?: boolean; only?: number } = {}): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const sx = opts.flipX ? src.w - 1 - x : x;
        const sy = opts.flipY ? src.h - 1 - y : y;
        const c = src.data[sy * src.w + sx];
        if (c !== CLEAR) this.set(dx + x, dy + y, opts.only ?? c);
      }
    return this;
  }

  /** 투명 픽셀 중 불투명 픽셀과 4방향으로 닿는 곳에 외곽선. */
  outline(c: number, diagonal = false): this {
    const src = this.data.slice();
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : CLEAR);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== CLEAR) continue;
        let hit = at(x - 1, y) !== CLEAR || at(x + 1, y) !== CLEAR || at(x, y - 1) !== CLEAR || at(x, y + 1) !== CLEAR;
        if (!hit && diagonal)
          hit =
            at(x - 1, y - 1) !== CLEAR ||
            at(x + 1, y - 1) !== CLEAR ||
            at(x - 1, y + 1) !== CLEAR ||
            at(x + 1, y + 1) !== CLEAR;
        if (hit) this.data[y * this.w + x] = c;
      }
    return this;
  }

  /**
   * 좌상단 광원 명암: 위/왼쪽이 비어 있으면 밝게, 아래/오른쪽이 비어 있으면 어둡게.
   * skip 색(외곽선 등)은 건드리지 않는다.
   */
  shade(skip: readonly number[] = []): this {
    const src = this.data.slice();
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : CLEAR);
    const isEdge = (v: number) => v === CLEAR || skip.includes(v);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = src[y * this.w + x];
        if (v === CLEAR || skip.includes(v)) continue;
        const lit = isEdge(at(x, y - 1)) || isEdge(at(x - 1, y));
        const dark = isEdge(at(x, y + 1)) || isEdge(at(x + 1, y));
        if (lit && !dark) this.data[y * this.w + x] = rampShift(v, 1);
        else if (dark && !lit) this.data[y * this.w + x] = rampShift(v, -1);
      }
    return this;
  }

  replace(from: number, to: number): this {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
    return this;
  }

  /** 체커 디더로 칠해진 영역 일부를 다른 색으로. */
  dither(x: number, y: number, w: number, h: number, c: number, phase = 0): this {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) this.setIfFilled(x + i, y + j, c);
    return this;
  }

  flipped(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.blit(this, 0, 0, { flipX: true });
    return c;
  }

  /** 90도 회전(시계 방향). 픽셀 손실 없음. */
  rotatedCW(): PixelCanvas {
    const c = new PixelCanvas(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.set(this.h - 1 - y, x, this.get(x, y));
    return c;
  }

  bounds(): { x: number; y: number; w: number; h: number } | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.data[y * this.w + x] !== CLEAR) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** 브라우저 캔버스로 변환. */
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === CLEAR) continue;
      img.data[i * 4] = (c >> 16) & 255;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const out: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

const shiftMap = new Map<number, [number, number]>();
for (const ramp of Object.values(RAMP)) {
  const r = ramp as readonly number[];
  r.forEach((c, i) => {
    if (!shiftMap.has(c)) shiftMap.set(c, [r[Math.max(0, i - 1)], r[Math.min(r.length - 1, i + 1)]]);
  });
}

/** 램프 안에서 한 단계 밝게(+1)/어둡게(-1). 램프에 없는 색은 그대로. */
export function rampShift(c: number, dir: 1 | -1): number {
  const m = shiftMap.get(c);
  if (!m) return c;
  return dir > 0 ? m[1] : m[0];
}

/** 결정론적 의사 난수(아트 변형용). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
