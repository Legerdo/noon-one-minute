// 개발용 아트 검수 화면: ?gallery=N
import Phaser from 'phaser';
import { ALL_POSES, type BodyPose } from '../art/haru';
import { ENEMY_ART } from '../art/enemies';
import { renderMap } from '../art/tiles';
import { addSingle } from '../art/textures';
import { ICON_NAMES } from '../art/ui';
import { ALL_EQUIP, type EquipId } from '../data/equipment';
import type { EnemyId } from '../data/enemies';
import { HaruRig } from '../ui/haruRig';
import { txt } from '../ui/text';

export class GalleryScene extends Phaser.Scene {
  private page = 0;

  constructor() {
    super('gallery');
  }

  init(data: { page?: number }): void {
    this.page = data.page ?? 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#3a4466');
    const p = this.page;
    txt(this, 2, 1, `갤러리 ${p}  ← → 넘기기`, { font: 'small', color: 0xfee761 });
    if (p === 0) this.haru();
    else if (p === 1) this.enemies(['dummy', 'rat', 'sentry']);
    else if (p === 2) this.enemies(['knight', 'tortoise']);
    else if (p === 3) this.enemies(['hexer', 'swarm']);
    else if (p >= 4 && p <= 7) this.boss(p - 4);
    else if (p === 8) this.misc();
    else {
      const bgs = ['bg_foyer', 'bg_gallery', 'bg_engine', 'bg_summit', 'bg_title', 'bg_ending'];
      const k = bgs[(p - 9) % bgs.length];
      this.add.image(0, 0, k).setOrigin(0, 0);
      txt(this, 2, 1, k, { font: 'small', color: 0xfee761 });
    }
    this.input.keyboard?.on('keydown-RIGHT', () => this.scene.restart({ page: this.page + 1 }));
    this.input.keyboard?.on('keydown-LEFT', () => this.scene.restart({ page: Math.max(0, this.page - 1) }));
  }

  private haru(): void {
    ALL_POSES.forEach((pose, i) => {
      const x = 26 + (i % 9) * 52;
      const y = 60 + Math.floor(i / 9) * 56;
      this.add.image(x, y, 'haru_b', pose).setOrigin(20 / 48, 46 / 48);
      txt(this, x - 20, y + 1, pose, { font: 'tiny', color: 0xffffff });
    });
    const combos: [BodyPose, EquipId][] = [
      ['idle0', 'sword'],
      ['ready', 'sword'],
      ['strike', 'sword'],
      ['windup', 'hammer'],
      ['windupHi', 'hammer'],
      ['slam', 'hammer'],
      ['readyLow', 'dagger'],
      ['strike', 'dagger'],
      ['readyLow', 'awl'],
      ['ready', 'wedge'],
      ['cast', 'wedge'],
      ['guard', 'buckler'],
      ['guard', 'tower'],
      ['drink', 'tonic'],
      ['idle0', 'tower'],
      ['idle0', 'buckler'],
      ['cheer', 'sword'],
      ['kneel', 'hammer'],
    ];
    combos.forEach(([pose, eq], i) => {
      const x = 26 + (i % 9) * 52;
      const y = 176 + Math.floor(i / 9) * 50;
      const rig = new HaruRig(this, x, y);
      rig.set(pose, eq);
    });
    // 탐험
    const ow = ['d0', 'd1', 'd2', 'u0', 'u1', 'u2', 'r0', 'r1', 'r2', 'l0', 'l1', 'l2'];
    ow.forEach((f, i) => this.add.image(300 + i * 15, 266, 'haru_ow', f).setOrigin(0.5, 1));
    [0, 1, 2, 3].forEach((f) => this.add.image(250 + f * 12, 250, 'ttok', f));
    this.add.image(470, 266, 'grandpa', 'awake').setOrigin(0.5, 1);
  }

  private enemies(ids: EnemyId[]): void {
    let y = 14;
    for (const id of ids) {
      const art = ENEMY_ART[id];
      let x = 2;
      const rowH = art.h + 10;
      for (const [pose, n] of Object.entries(art.poses)) {
        for (let f = 0; f < n; f++) {
          if (x + art.w > 480) {
            x = 2;
            y += rowH;
          }
          this.add.image(x, y, `enemy_${id}`, `${pose}_${f}`).setOrigin(0, 0);
          txt(this, x, y + art.h, `${pose}${f}`, { font: 'tiny', color: 0xffffff });
          x += art.w + 2;
        }
      }
      y += rowH;
    }
    if (ids.includes('swarm')) {
      for (let k = 0; k < 2; k++) this.add.image(300 + k * 14, 200, 'bee', k);
      for (let k = 0; k < 4; k++) this.add.image(340 + k * 24, 200, 'queen', `angry_${k}`);
      const minis = ['rat', 'sentry', 'knight', 'swarm', 'tortoise', 'hexer', 'dummy'];
      minis.forEach((m, i) => this.add.image(20 + i * 30, 262, `mini_${m}`, 0).setOrigin(0.5, 1));
    }
  }

  private boss(part: number): void {
    const art = ENEMY_ART.boss;
    const frames: string[] = [];
    for (const [pose, n] of Object.entries(art.poses)) for (let f = 0; f < n; f++) frames.push(`${pose}_${f}`);
    const slice = frames.slice(part * 3, part * 3 + 3);
    slice.forEach((fr, i) => {
      this.add.image(8 + i * 158, 14, 'enemy_boss', fr).setOrigin(0, 0);
      txt(this, 8 + i * 158, 166, fr, { font: 'small', color: 0xffffff });
    });
  }

  private misc(): void {
    const rows = [
      '##########W#####G####',
      '#.......,,,,,....X..#',
      '#..==========...~~..#',
      '#..,,,,,,,.......~..#',
      '#########P####.....^#',
      '........#...v.......#',
    ];
    const pc = renderMap({ rows, theme: 'foyer', floorUnder: {} }, 3);
    addSingle(this, 'gal_map', pc);
    this.add.image(2, 14, 'gal_map').setOrigin(0, 0);
    const props: [string, string | number][] = [
      ['chest', 'closed'],
      ['chest', 'open'],
      ['bench', 0],
      ['gate', 'closed'],
      ['gate', 'open'],
      ['rubble', 0],
      ['sign', 0],
      ['crate', 0],
      ['heart', 0],
      ['gearpick', 0],
      ['clock', 0],
      ['pendecor', 0],
      ['steam', 1],
    ];
    props.forEach(([k, f], i) => this.add.image(350 + (i % 5) * 26, 20 + Math.floor(i / 5) * 40, k, k === 'rubble' || k === 'sign' || k === 'crate' ? undefined : f).setOrigin(0, 0));
    const fxs: [string, number][] = [
      ['fx_slash', 3],
      ['fx_slash_big', 3],
      ['fx_thrust', 2],
      ['fx_spark', 3],
      ['fx_spark_hot', 3],
      ['fx_block', 3],
      ['fx_block_full', 3],
      ['fx_ring', 4],
      ['fx_delay', 4],
      ['fx_dust', 3],
      ['fx_sparkle', 3],
      ['fx_pierce', 2],
      ['fx_bolt', 2],
      ['fx_ko', 3],
      ['fx_wave', 4],
      ['fx_storm', 4],
    ];
    let x = 2;
    let y = 120;
    for (const [k, n] of fxs) {
      for (let f = 0; f < n; f++) {
        const img = this.add.image(x, y, k, f).setOrigin(0, 0);
        x += img.width + 2;
        if (x > 440) {
          x = 2;
          y += 52;
        }
      }
    }
    ICON_NAMES.forEach((n, i) => this.add.image(4 + i * 12, 256, `ic_${n}`).setOrigin(0, 0));
    ALL_EQUIP.forEach((id, i) => this.add.image(200 + i * 22, 250, `icon_${id}`).setOrigin(0, 0));
    ['mk_player', 'mk_ghost', 'mk_enemy'].forEach((k, i) => this.add.image(380 + i * 14, 256, k).setOrigin(0, 0));
    ['panel_brass', 'panel_steel', 'panel_dark', 'panel_slot', 'panel_slotSel'].forEach((k, i) =>
      this.add.image(440 - 120 + i * 26, 222, k).setOrigin(0, 0),
    );
  }
}
