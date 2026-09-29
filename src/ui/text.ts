// 픽셀 폰트 텍스트 생성 도우미. 위치는 항상 정수.
import Phaser from 'phaser';
import { hex } from '../art/palette';
import { FONTS, type FontKind } from './fonts';

export interface TextOpts {
  font?: FontKind;
  color?: number;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  origin?: [number, number];
  shadow?: number | null;
  lineSpacing?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const f = FONTS[o.font ?? 'body'];
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: f.family,
    fontSize: `${f.size}px`,
    color: hex(o.color ?? 0xffffff),
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? 2,
    padding: { top: 1, bottom: 1 },
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.shadow !== null && o.shadow !== undefined) {
    style.shadow = { offsetX: 1, offsetY: 1, color: hex(o.shadow), blur: 0, fill: true, stroke: false };
  }
  const t = scene.add.text(Math.round(x), Math.round(y), s, style);
  t.setResolution(1);
  const [ox, oy] = o.origin ?? [0, 0];
  t.setOrigin(ox, oy);
  return t;
}

/** 원점이 중앙인 텍스트를 정수 픽셀에 맞춘다(홀수 폭에서 반 픽셀 방지). */
export function snapText(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  const w = Math.round(t.width);
  const h = Math.round(t.height);
  const left = Math.round(t.x - w * t.originX);
  const top = Math.round(t.y - h * t.originY);
  t.setOrigin(0, 0);
  t.setPosition(left, top);
  return t;
}
