// 적 표현: 자세 프레임 순환, 벌떼 대형, 피격 지점. 전투 규칙과 무관.
import Phaser from 'phaser';
import { ENEMY_ART } from '../art/enemies';
import { ENEMY_ORIGIN_Y } from '../art/textures';
import type { EnemyId } from '../data/enemies';

type SwarmMode = 'loose' | 'wide' | 'tight' | 'drift';

interface Bee {
  img: Phaser.GameObjects.Image;
  a: number;
  r: number;
  s: number;
  ox: number;
  oy: number;
  /** 공격 중이면 궤도 대신 목표 위치로. */
  override: { x: number; y: number } | null;
}

export class EnemyView {
  readonly root: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Image | null = null;
  private queen: Phaser.GameObjects.Image | null = null;
  private bees: Bee[] = [];
  private pose = 'idle';
  private frame = 0;
  private acc = 0;
  private floatT = 0;
  private swarmMode: SwarmMode = 'loose';
  frozen = false;
  readonly floating: boolean;

  constructor(
    private scene: Phaser.Scene,
    stage: Phaser.GameObjects.Container,
    readonly id: EnemyId,
    readonly homeX: number,
    readonly homeY: number,
  ) {
    this.root = scene.add.container(homeX, homeY);
    stage.add(this.root);
    this.floating = id === 'hexer' || id === 'boss';
    if (id === 'swarm') {
      this.queen = scene.add.image(0, -52, 'queen', 'calm_0');
      this.root.add(this.queen);
      for (let i = 0; i < 12; i++) {
        const img = scene.add.image(0, -52, 'bee', i % 2);
        this.root.add(img);
        this.bees.push({ img, a: (i / 12) * Math.PI * 2, r: 24 + (i % 3) * 5, s: 1.6 + (i % 4) * 0.25, ox: 0, oy: 0, override: null });
      }
    } else {
      const art = ENEMY_ART[id];
      this.sprite = scene.add.image(0, 0, `enemy_${id}`, 'idle_0').setOrigin(art.ox, ENEMY_ORIGIN_Y.get(id) ?? 1);
      this.root.add(this.sprite);
    }
  }

  get images(): Phaser.GameObjects.Image[] {
    if (this.sprite) return [this.sprite];
    return [this.queen!, ...this.bees.map((b) => b.img)];
  }

  setPose(pose: string): void {
    if (this.id === 'swarm') return;
    const art = ENEMY_ART[this.id];
    if (!(pose in art.poses)) pose = 'idle';
    if (pose === this.pose) return;
    this.pose = pose;
    this.frame = 0;
    this.sprite!.setFrame(`${pose}_0`);
  }

  setSwarm(mode: SwarmMode): void {
    this.swarmMode = mode;
  }

  /** 월드 좌표 피격 지점. */
  hitPoint(): { x: number; y: number } {
    if (this.id === 'swarm') return { x: this.root.x, y: this.root.y - 52 };
    const art = ENEMY_ART[this.id];
    const oy = ENEMY_ORIGIN_Y.get(this.id) ?? 1;
    const left = this.root.x - art.w * art.ox;
    const top = this.root.y + (this.sprite?.y ?? 0) - art.h * oy;
    return { x: Math.round(left + art.hit[0]), y: Math.round(top + art.hit[1]) };
  }

  top(): number {
    if (this.id === 'swarm') return this.root.y - 90;
    const art = ENEMY_ART[this.id];
    const oy = ENEMY_ORIGIN_Y.get(this.id) ?? 1;
    return Math.round(this.root.y - art.h * oy);
  }

  /** 벌 몇 마리를 목표 지점으로 돌진시켰다가 되돌린다. */
  beeStrike(count: number, tx: number, ty: number, ms: number): void {
    const chosen = this.bees.slice(0, count);
    for (const b of chosen) {
      b.override = { x: tx - this.root.x + (Math.random() - 0.5) * 10, y: ty - this.root.y + (Math.random() - 0.5) * 10 };
    }
    this.scene.time.delayedCall(ms, () => chosen.forEach((b) => (b.override = null)));
  }

  update(dt: number): void {
    if (this.frozen) return;
    this.acc += dt;
    this.floatT += dt;
    if (this.sprite) {
      const art = ENEMY_ART[this.id];
      const n = art.poses[this.pose] ?? 1;
      if (this.acc > 170) {
        this.acc = 0;
        if (n > 1) {
          this.frame = (this.frame + 1) % n;
          this.sprite.setFrame(`${this.pose}_${this.frame}`);
        }
      }
      if (this.id === 'hexer') this.sprite.y = -8 + Math.round(Math.sin(this.floatT / 420) * 2);
      if (this.id === 'boss') this.sprite.y = Math.round(Math.sin(this.floatT / 700) * 2);
      return;
    }
    // 벌떼
    if (this.acc > 120) {
      this.acc = 0;
      this.frame = (this.frame + 1) % 4;
      this.queen!.setFrame(`${this.swarmMode === 'tight' ? 'angry' : 'calm'}_${this.frame}`);
    }
    const spd = { loose: 1, wide: 0.6, tight: 2.6, drift: 0.35 }[this.swarmMode];
    const rad = { loose: 1, wide: 1.7, tight: 0.6, drift: 1.25 }[this.swarmMode];
    this.bees.forEach((b, i) => {
      b.a += (dt / 1000) * b.s * spd;
      const tx = b.override ? b.override.x : Math.cos(b.a) * b.r * rad;
      const ty = b.override ? b.override.y : -52 + Math.sin(b.a * 1.3) * b.r * 0.55 * rad + (this.swarmMode === 'drift' ? Math.sin(this.floatT / 300 + i) * 6 : 0);
      b.ox += (tx - b.ox) * Math.min(1, dt / (b.override ? 40 : 90));
      b.oy += (ty - b.oy) * Math.min(1, dt / (b.override ? 40 : 90));
      b.img.setPosition(Math.round(b.ox), Math.round(b.oy));
      if (Math.floor(this.floatT / 90 + i) % 2 === 0) b.img.setFrame(0);
      else b.img.setFrame(1);
    });
  }
}
