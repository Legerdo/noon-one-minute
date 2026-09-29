// 탐험 맵에 서 있는 적(작은 크기). 전투 스프라이트와 같은 색·실루엣 언어를 유지한다.
import { PixelCanvas } from './canvas';
import { gear } from './enemies';
import { PAL } from './palette';
import type { EnemyId } from '../data/enemies';

type Draw = (p: PixelCanvas) => void;

function part(target: PixelCanvas, draw: Draw, shade = true, skip: number[] = []): void {
  const p = new PixelCanvas(target.w, target.h);
  draw(p);
  if (shade) p.shade(skip);
  p.outline(PAL.ink);
  target.blit(p, 0, 0);
}

function rat(f: number): PixelCanvas {
  const pc = new PixelCanvas(20, 16);
  const b = f % 2;
  part(pc, (p) => {
    p.ellipse(11, 10 - b, 5, 3, PAL.slate);
    p.disc(6, 10 - b, 3, PAL.slate);
    p.poly(
      [
        [4, 8 - b],
        [0, 11 - b],
        [4, 12 - b],
      ],
      PAL.slate,
    );
  });
  part(pc, (p) => p.disc(7, 6 - b, 1, PAL.slate), false);
  part(
    pc,
    (p) => {
      p.vline(12, 4 - b, 6 - b, PAL.gold);
      p.ring(10, 3 - b, 1, PAL.gold);
      p.ring(14, 3 - b, 1, PAL.gold);
    },
    false,
  );
  pc.set(4, 9 - b, PAL.hotred);
  pc.set(0, 11 - b, PAL.pink);
  pc.hline(16, 18, 9 - b, PAL.steel);
  pc.set(18, 8 - b, PAL.steel);
  return pc;
}

function sentry(f: number): PixelCanvas {
  const pc = new PixelCanvas(18, 26);
  part(pc, (p) => {
    p.vline(8, 18, 23, PAL.dslate);
    p.vline(11, 18, 23, PAL.dslate);
    p.rect(6, 24, 4, 1, PAL.copper);
    p.rect(10, 24, 4, 1, PAL.copper);
  });
  part(
    pc,
    (p) => {
      p.rect(6, 11, 8, 8, PAL.copper);
      p.hline(6, 13, 13, PAL.gold);
    },
    true,
    [PAL.gold],
  );
  part(pc, (p) => {
    p.disc(10, 7, 4, PAL.copper);
    p.rect(6, 7, 9, 4, PAL.copper);
  });
  part(pc, (p) => p.thick(10, 3, 12, 1, 1, PAL.red), false);
  pc.hline(6, 11, 8, PAL.ink);
  pc.set(7, 8, f % 2 ? PAL.gold : PAL.borange);
  part(
    pc,
    (p) => {
      p.vline(3, 3, 24, PAL.brown);
      p.poly(
        [
          [3, 0],
          [5, 4],
          [1, 4],
        ],
        PAL.silver,
      );
    },
    false,
  );
  return pc;
}

function knight(f: number): PixelCanvas {
  const pc = new PixelCanvas(20, 28);
  part(pc, (p) => p.poly([[10, 9], [16, 10], [18, 22], [12, 21]], PAL.navy));
  part(pc, (p) => {
    p.thick(9, 19, 7, 25, 2, PAL.steel);
    p.thick(13, 19, 14, 25, 2, PAL.slate);
  });
  part(pc, (p) => p.rect(7, 10, 8, 10, PAL.steel));
  part(pc, (p) => p.rect(8, 3, 6, 7, PAL.steel));
  pc.vline(11, 0, 2, PAL.gold);
  pc.hline(8, 11, 6, PAL.ink);
  pc.set(8, 6, PAL.gold);
  const sw = [-1, 0, 1, 0][f % 4];
  part(
    pc,
    (p) => {
      p.vline(5 + sw, 13, 20, PAL.gold);
      p.disc(5 + sw, 22, 2, PAL.copper);
    },
    false,
  );
  return pc;
}

function swarm(f: number): PixelCanvas {
  const pc = new PixelCanvas(20, 20);
  part(pc, (p) => gear(p, 10, 10, 3, 7, f * 0.3, PAL.copper, PAL.brown), true, []);
  for (let k = 0; k < 4; k++) {
    const a = f * 0.5 + (k * Math.PI) / 2;
    const x = Math.round(10 + Math.cos(a) * 7);
    const y = Math.round(10 + Math.sin(a) * 6);
    part(pc, (p) => p.disc(x, y, 1, PAL.gold), false);
    pc.set(x, y - 2, PAL.white);
  }
  pc.set(10, 10, PAL.hotred);
  return pc;
}

function tortoise(f: number): PixelCanvas {
  const pc = new PixelCanvas(28, 18);
  part(pc, (p) => {
    p.ellipse(15, 11, 10, 7, PAL.dslate);
    p.rect(4, 12, 24, 8, -1);
  });
  part(pc, (p) => p.rect(5, 11, 21, 2, PAL.copper));
  part(pc, (p) => p.rect(17, 2, 3, 3, PAL.slate));
  part(pc, (p) => p.disc(3, 11, 2, PAL.slate));
  part(pc, (p) => {
    p.rect(7, 13, 3, 3, PAL.slate);
    p.rect(20, 13, 3, 3, PAL.slate);
  });
  pc.set(2, 10, PAL.gold);
  if (f % 2) pc.set(18, 0, PAL.silver);
  return pc;
}

function hexer(f: number): PixelCanvas {
  const pc = new PixelCanvas(18, 28);
  const b = [0, 1, 1, 0][f % 4];
  for (const x of [9, 4, 14]) for (let y = 0; y < 6 + b; y += 2) pc.set(x, y, PAL.slate);
  part(
    pc,
    (p) =>
      p.poly(
        [
          [9, 8 + b],
          [14, 12 + b],
          [15, 24 + b],
          [3, 24 + b],
          [4, 12 + b],
        ],
        PAL.rust,
      ),
    true,
  );
  part(pc, (p) => p.disc(9, 8 + b, 4, PAL.plum));
  part(pc, (p) => p.disc(9, 9 + b, 3, PAL.cream), false);
  pc.set(8, 9 + b, PAL.orange);
  pc.set(10, 9 + b, PAL.orange);
  pc.vline(9, 7 + b, 9 + b, PAL.brown);
  return pc;
}

function dummy(f: number): PixelCanvas {
  const pc = new PixelCanvas(16, 26);
  part(pc, (p) => {
    p.rect(3, 23, 10, 2, PAL.brown);
    p.vline(8, 15, 22, PAL.copper);
  });
  part(pc, (p) => p.ellipse(8, 13, 4, 5, PAL.tan));
  pc.disc(8, 13, 2, PAL.red);
  pc.set(8, 13, PAL.cream);
  part(pc, (p) => p.disc(8, 5, 3, PAL.tan));
  pc.set(7, 5, PAL.brown);
  pc.set(9, 5, PAL.brown);
  part(pc, (p) => p.hline(1, 4, 11 + (f % 2), PAL.tan), false);
  part(pc, (p) => p.hline(12, 15, 11 - (f % 2), PAL.tan), false);
  return pc;
}

export const MINI: Record<Exclude<EnemyId, 'boss'>, { frames: number; draw: (f: number) => PixelCanvas }> = {
  rat: { frames: 2, draw: rat },
  sentry: { frames: 2, draw: sentry },
  knight: { frames: 4, draw: knight },
  swarm: { frames: 4, draw: swarm },
  tortoise: { frames: 2, draw: tortoise },
  hexer: { frames: 4, draw: hexer },
  dummy: { frames: 2, draw: dummy },
};
