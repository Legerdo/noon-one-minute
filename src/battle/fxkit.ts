// 전투 연출 도우미. 전부 표현 전용이며 전투 상태를 읽거나 바꾸지 않는다.
import Phaser from 'phaser';
import { PAL, hex } from '../art/palette';
import { settings } from '../game/settings';
import { txt } from '../ui/text';

export class FxKit {
  /** 빨리감기(홀드) 배율. */
  fast = 1;

  constructor(
    private scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Container,
  ) {}

  /** 설정 속도·빨리감기를 반영한 시간(ms). */
  d(ms: number): number {
    const sp = [1, 1, 0.6, 0.35][settings.speed];
    return Math.max(1, Math.round((ms * sp) / this.fast));
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => this.scene.time.delayedCall(this.d(ms), () => r()));
  }

  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      this.scene.tweens.add({ ...cfg, duration: this.d(Number(cfg.duration ?? 100)), onComplete: () => r() });
    });
  }

  /** 프레임 애니메이션을 한 번 재생하는 1회성 스프라이트. */
  burst(key: string, frames: number, x: number, y: number, frameMs = 50, opts: { flipX?: boolean; depth?: number; scaleMode?: boolean } = {}): void {
    const img = this.scene.add.image(Math.round(x), Math.round(y), key, 0);
    if (opts.flipX) img.setFlipX(true);
    this.layer.add(img);
    let f = 0;
    const step = () => {
      f++;
      if (f >= frames) {
        img.destroy();
        return;
      }
      img.setFrame(f);
      this.scene.time.delayedCall(this.d(frameMs), step);
    };
    this.scene.time.delayedCall(this.d(frameMs), step);
  }

  /** 흩어지는 조각/입자. */
  debris(key: string, x: number, y: number, n: number, opts: { spread?: number; up?: number; dir?: number; life?: number; gravity?: number } = {}): void {
    const spread = opts.spread ?? 40;
    const life = opts.life ?? 450;
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(Math.round(x), Math.round(y), key);
      this.layer.add(img);
      const dir = opts.dir ?? 0;
      const vx = (Math.random() - 0.5) * spread + dir * spread * 0.6;
      const vy = -(opts.up ?? 30) * (0.5 + Math.random());
      const g = opts.gravity ?? 80;
      const t0 = this.scene.time.now;
      const dur = this.d(life * (0.7 + Math.random() * 0.5));
      const ev = this.scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          const t = (this.scene.time.now - t0) / 1000;
          img.setPosition(Math.round(x + vx * t * 2), Math.round(y + vy * t * 2 + g * t * t * 2));
          if (this.scene.time.now - t0 > dur) {
            ev.remove();
            img.destroy();
          } else if (this.scene.time.now - t0 > dur * 0.7 && (Math.floor(t * 30) % 2 === 0)) img.setVisible(false);
          else img.setVisible(true);
        },
      });
    }
  }

  /** 떠오르는 숫자/문구. */
  popup(x: number, y: number, s: string, color: number, big = false, sub?: string): void {
    const t = txt(this.scene, x, y, s, { font: big ? 'big' : 'bold', color, origin: [0.5, 1], shadow: PAL.ink });
    t.setDepth(500);
    const items: Phaser.GameObjects.Text[] = [t];
    if (sub) {
      const st = txt(this.scene, x, y + 2, sub, { font: 'tiny', color: PAL.silver, origin: [0.5, 0], shadow: PAL.ink });
      st.setDepth(500);
      items.push(st);
    }
    for (const it of items) {
      it.setPosition(Math.round(it.x), Math.round(it.y));
    }
    // 튀어 오른 뒤 머물다 사라짐
    const rise = big ? 18 : 12;
    this.scene.tweens.add({ targets: items, y: `-=${rise}`, duration: this.d(260), ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: items, alpha: 0, delay: this.d(700), duration: this.d(260), onComplete: () => items.forEach((i) => i.destroy()) });
    if (big) {
      t.setScale(1);
    }
  }

  /** 방향 흔들림: HUD는 흔들지 않고 무대 컨테이너만. */
  shake(stage: Phaser.GameObjects.Container, px: number, dir: 1 | -1 = 1): void {
    const mult = [0, 0.5, 1][settings.shake];
    const a = Math.round(px * mult);
    if (a <= 0) return;
    const seq = [a * dir, -Math.round(a * 0.6) * dir, Math.round(a * 0.3) * dir, 0];
    let i = 0;
    const step = () => {
      stage.x = seq[i];
      i++;
      if (i < seq.length) this.scene.time.delayedCall(this.d(28), step);
    };
    step();
  }

  /** 짧은 섬광(흰색 채우기). */
  flash(objs: (Phaser.GameObjects.Image | Phaser.GameObjects.Sprite)[], ms = 60, color: number = PAL.white): void {
    for (const o of objs) o.setTintFill(color);
    this.scene.time.delayedCall(this.d(ms), () => objs.forEach((o) => o.active && o.clearTint()));
  }

  /** 화면 전체 번쩍임(큰 사건 전용). */
  screenFlash(color: number, ms = 90, alpha = 0.5): void {
    const r = this.scene.add.rectangle(0, 0, 480, 270, color, alpha).setOrigin(0, 0).setDepth(900);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: this.d(ms), onComplete: () => r.destroy() });
  }
}

export function colorStr(c: number): string {
  return hex(c);
}
