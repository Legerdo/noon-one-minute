// 타이틀 로고: 픽셀 폰트를 2배 블록으로 키운 뒤 1픽셀 단위로 외곽선·명암을 다시 그린다.
import { PixelCanvas } from './canvas';
import { PAL } from './palette';

export function logoCanvas(text: string, font: string, size: number, scale = 2): PixelCanvas {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  ctx.font = `${size}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + 4;
  const h = size + 6;
  cv.width = w;
  cv.height = h;
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  ctx.fillText(text, 2, 2);
  const img = ctx.getImageData(0, 0, w, h).data;
  const pad = 3;
  const pc = new PixelCanvas(w * scale + pad * 2, h * scale + pad * 2);
  // 글자 몸통: 위→아래 금빛 그라데이션
  const ramp = [PAL.yellow, PAL.yellow, PAL.gold, PAL.gold, PAL.borange, PAL.borange];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (img[(y * w + x) * 4 + 3] < 128) continue;
      for (let j = 0; j < scale; j++)
        for (let i = 0; i < scale; i++) {
          const py = y * scale + j;
          const t = Math.min(ramp.length - 1, Math.floor((py / (h * scale)) * ramp.length));
          pc.set(x * scale + i + pad, py + pad, ramp[t]);
        }
    }
  // 윗면 하이라이트(1픽셀)
  const src = pc.clone();
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      if (src.get(x, y) === -1) continue;
      if (src.get(x, y - 1) === -1) pc.set(x, y, PAL.white);
    }
  pc.outline(PAL.brown);
  pc.outline(PAL.ink, true);
  // 그림자
  const out = new PixelCanvas(pc.w + 2, pc.h + 2);
  const sh = pc.clone();
  for (let i = 0; i < sh.data.length; i++) if (sh.data[i] !== -1) sh.data[i] = PAL.ink;
  out.blit(sh, 2, 2);
  out.blit(pc, 0, 0);
  return out;
}
