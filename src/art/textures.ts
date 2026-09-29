// 부팅 시 모든 픽셀 아트를 생성해 Phaser 텍스처로 등록한다.
import Phaser from 'phaser';
import { ALL_EQUIP, type EquipId } from '../data/equipment';
import type { EnemyId } from '../data/enemies';
import { battleBackground, bgGear, towerScene } from './backgrounds';
import { PixelCanvas } from './canvas';
import { ENEMY_ART, gearBee, queenGear } from './enemies';
import * as fx from './fx';
import { ALL_POSES, grandpa, haruBody, haruOverworld, ttokttagi } from './haru';
import { MINI } from './overworld';
import { PAL } from './palette';
import {
  chestSprite,
  clockProp,
  crateSprite,
  gateSprite,
  gearPickup,
  heartSprite,
  pendulumDecor,
  rubbleSprite,
  signSprite,
  steamVent,
  workbenchSprite,
} from './tiles';
import { enemyMarker, icon, ICON_NAMES, panelTex, playerMarker } from './ui';
import { weaponIcon, weaponSprites, type WeaponView } from './weapons';

export interface FrameInfo {
  w: number;
  h: number;
  /** origin 비율(무기 손잡이 등). */
  ox: number;
  oy: number;
}

/** 텍스처키 → 프레임 → 크기/원점. */
export const FRAME_INFO = new Map<string, Map<string, FrameInfo>>();
/** 적 스프라이트의 세로 원점(발바닥 기준). */
export const ENEMY_ORIGIN_Y = new Map<EnemyId, number>();

type Named = { name: string | number; pc: PixelCanvas; ox?: number; oy?: number };

export function addSheet(scene: Phaser.Scene, key: string, frames: Named[]): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const MAXW = 2048;
  let x = 0;
  let y = 0;
  let rowH = 0;
  const places: { f: Named; x: number; y: number }[] = [];
  for (const f of frames) {
    if (x + f.pc.w > MAXW) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    places.push({ f, x, y });
    x += f.pc.w;
    rowH = Math.max(rowH, f.pc.h);
  }
  const W = Math.max(1, ...places.map((p) => p.x + p.f.pc.w));
  const H = Math.max(1, y + rowH);
  const sheet = new PixelCanvas(W, H);
  for (const p of places) sheet.blit(p.f.pc, p.x, p.y);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas());
  if (!tex) throw new Error(`텍스처 생성 실패 ${key}`);
  const info = new Map<string, FrameInfo>();
  for (const p of places) {
    const name = String(p.f.name);
    tex.add(name, 0, p.x, p.y, p.f.pc.w, p.f.pc.h);
    info.set(name, { w: p.f.pc.w, h: p.f.pc.h, ox: p.f.ox ?? 0.5, oy: p.f.oy ?? 0.5 });
  }
  FRAME_INFO.set(key, info);
}

export function addSingle(scene: Phaser.Scene, key: string, pc: PixelCanvas): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
}

export function frameInfo(key: string, frame: string | number): FrameInfo | undefined {
  return FRAME_INFO.get(key)?.get(String(frame));
}

/** 스프라이트 프레임을 바꾸면서 등록된 원점을 적용. */
export function applyFrame(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, key: string, frame: string | number): void {
  if (obj.texture.key !== key) obj.setTexture(key, String(frame));
  else obj.setFrame(String(frame));
  const i = frameInfo(key, frame);
  if (i) obj.setOrigin(i.ox, i.oy);
}

export function generateAllTextures(scene: Phaser.Scene): void {
  // 하루(탐험)
  const ow = haruOverworld();
  const owFrames: Named[] = [];
  const dirs = ['d', 'u', 'r'];
  ow.forEach((list, di) => list.forEach((pc, f) => owFrames.push({ name: `${dirs[di]}${f}`, pc, ox: 0.5, oy: 1 })));
  ow[2].forEach((pc, f) => owFrames.push({ name: `l${f}`, pc: pc.flipped(), ox: 0.5, oy: 1 }));
  addSheet(scene, 'haru_ow', owFrames);

  // 하루(전투)
  const bodyFrames: Named[] = [];
  for (const p of ALL_POSES) {
    bodyFrames.push({ name: p, pc: haruBody(p), ox: 20 / 48, oy: 46 / 48 });
    if (p.startsWith('idle')) bodyFrames.push({ name: `${p}_blink`, pc: haruBody(p, true), ox: 20 / 48, oy: 46 / 48 });
  }
  addSheet(scene, 'haru_b', bodyFrames);

  // 무기
  for (const id of ALL_EQUIP) {
    const views = weaponSprites(id);
    const frames: Named[] = [];
    for (const [view, s] of Object.entries(views) as [WeaponView, { pc: PixelCanvas; gx: number; gy: number }][]) {
      // 손잡이 픽셀의 좌상단이 원점 → 손 픽셀 좌상단에 정확히 겹친다.
      frames.push({ name: view, pc: s.pc, ox: s.gx / s.pc.w, oy: s.gy / s.pc.h });
    }
    addSheet(scene, `wpn_${id}`, frames);
    addSingle(scene, `icon_${id}`, weaponIcon(id as EquipId));
  }

  // 적
  for (const [id, art] of Object.entries(ENEMY_ART) as [EnemyId, (typeof ENEMY_ART)[EnemyId]][]) {
    const frames: Named[] = [];
    // 발바닥(가장 아래 불투명 줄)이 무대 선에 딱 닿도록 원점을 계산한다.
    const idle = art.draw('idle', 0);
    const b = idle.bounds();
    const oy = art.oy === 1 && b ? (b.y + b.h) / art.h : art.oy;
    ENEMY_ORIGIN_Y.set(id, oy);
    for (const [pose, n] of Object.entries(art.poses))
      for (let f = 0; f < n; f++) frames.push({ name: `${pose}_${f}`, pc: art.draw(pose, f), ox: art.ox, oy });
    addSheet(scene, `enemy_${id}`, frames);
  }
  addSheet(
    scene,
    'bee',
    [0, 1].map((f) => ({ name: f, pc: gearBee(f) })),
  );
  addSheet(scene, 'queen', [
    ...[0, 1, 2, 3].map((f) => ({ name: `calm_${f}`, pc: queenGear(f, 'calm') })),
    ...[0, 1, 2, 3].map((f) => ({ name: `angry_${f}`, pc: queenGear(f, 'angry') })),
  ]);
  for (const [id, m] of Object.entries(MINI)) {
    addSheet(
      scene,
      `mini_${id}`,
      Array.from({ length: m.frames }, (_, f) => ({ name: f, pc: m.draw(f), ox: 0.5, oy: 1 })),
    );
  }
  addSheet(
    scene,
    'ttok',
    [0, 1, 2, 3].map((f) => ({ name: f, pc: ttokttagi(f) })),
  );
  addSheet(scene, 'grandpa', [
    { name: 'awake', pc: grandpa(false), ox: 0.5, oy: 1 },
    { name: 'sleep', pc: grandpa(true), ox: 0.5, oy: 1 },
  ]);

  // 소품
  addSheet(scene, 'chest', [
    { name: 'closed', pc: chestSprite(false) },
    { name: 'open', pc: chestSprite(true) },
  ]);
  addSheet(
    scene,
    'bench',
    [0, 1].map((f) => ({ name: f, pc: workbenchSprite(f), ox: 0.5, oy: 0.8 })),
  );
  addSheet(scene, 'gate', [
    { name: 'closed', pc: gateSprite(false) },
    { name: 'open', pc: gateSprite(true) },
  ]);
  addSingle(scene, 'rubble', rubbleSprite());
  addSingle(scene, 'sign', signSprite());
  addSingle(scene, 'crate', crateSprite());
  addSheet(
    scene,
    'heart',
    [0, 1, 2, 3].map((f) => ({ name: f, pc: heartSprite(f) })),
  );
  addSheet(
    scene,
    'gearpick',
    Array.from({ length: 8 }, (_, f) => ({ name: f, pc: gearPickup(f) })),
  );
  addSheet(
    scene,
    'clock',
    [0, 1, 2, 3].map((f) => ({ name: f, pc: clockProp(f), ox: 0.5, oy: 1 })),
  );
  addSheet(
    scene,
    'pendecor',
    Array.from({ length: 8 }, (_, f) => ({ name: f, pc: pendulumDecor(f), ox: 0.5, oy: 0 })),
  );
  addSheet(
    scene,
    'steam',
    [0, 1, 2].map((f) => ({ name: f, pc: steamVent(f), ox: 0.5, oy: 1 })),
  );

  // 연출
  const seq = (key: string, n: number, make: (f: number) => PixelCanvas) =>
    addSheet(
      scene,
      key,
      Array.from({ length: n }, (_, f) => ({ name: f, pc: make(f) })),
    );
  seq('fx_slash', 3, (f) => fx.slashArc(f, false));
  seq('fx_slash_big', 3, (f) => fx.slashArc(f, true));
  seq('fx_thrust', 2, (f) => fx.thrustStreak(f));
  seq('fx_spark', 3, (f) => fx.sparkStar(f, false));
  seq('fx_spark_hot', 3, (f) => fx.sparkStar(f, true));
  seq('fx_block', 3, (f) => fx.blockFlash(f, false));
  seq('fx_block_full', 3, (f) => fx.blockFlash(f, true));
  seq('fx_ring', 4, (f) => fx.ringBurst(f, PAL.white));
  seq('fx_ring_heal', 4, (f) => fx.ringBurst(f, PAL.green, 32));
  seq('fx_ring_gold', 4, (f) => fx.ringBurst(f, PAL.gold, 32));
  seq('fx_delay', 4, (f) => fx.delayRing(f));
  seq('fx_dust', 3, (f) => fx.dustPuff(f));
  seq('fx_sparkle', 3, (f) => fx.sparkle(f));
  seq('fx_pierce', 2, (f) => fx.pierceStreak(f));
  seq('fx_bolt', 2, (f) => fx.rustBolt(f));
  seq('fx_ko', 3, (f) => fx.koStar(f));
  seq('fx_wave', 4, (f) => fx.bellWave(f));
  seq('fx_storm', 4, (f) => fx.stormSwirl(f));
  for (const k of ['brass', 'steel', 'rust', 'wood'] as const) addSingle(scene, `fx_shard_${k}`, fx.shard(k));
  addSingle(scene, 'px', fx.mote(PAL.white, 1));
  addSingle(scene, 'px2', fx.mote(PAL.white, 2));
  addSingle(scene, 'mote_green', fx.mote(PAL.green, 2));
  addSingle(scene, 'mote_gold', fx.mote(PAL.gold, 2));
  addSingle(scene, 'mote_cyan', fx.mote(PAL.cyan, 2));
  addSingle(scene, 'mote_rust', fx.mote(PAL.rust, 2));
  addSingle(scene, 'mote_dust', fx.mote(PAL.cream, 1));

  // UI
  for (const k of ['brass', 'steel', 'dark', 'slot', 'slotSel', 'slotOff'] as const) addSingle(scene, `panel_${k}`, panelTex(k));
  for (const n of ICON_NAMES) addSingle(scene, `ic_${n}`, icon(n));
  addSingle(scene, 'mk_player', playerMarker(false));
  addSingle(scene, 'mk_ghost', playerMarker(true));
  addSingle(scene, 'mk_enemy', enemyMarker());

  // 배경
  addSingle(scene, 'bg_foyer', battleBackground('foyer'));
  addSingle(scene, 'bg_gallery', battleBackground('gallery'));
  addSingle(scene, 'bg_engine', battleBackground('engine'));
  addSingle(scene, 'bg_summit', battleBackground('summit'));
  addSingle(scene, 'bg_title', towerScene(false));
  addSingle(scene, 'bg_ending', towerScene(true));
  addSheet(
    scene,
    'bggear_big',
    bgGear(34, 8, PAL.night).map((pc, f) => ({ name: f, pc })),
  );
  addSheet(
    scene,
    'bggear_mid',
    bgGear(20, 8, PAL.dslate).map((pc, f) => ({ name: f, pc })),
  );
  addSheet(
    scene,
    'bggear_brass',
    bgGear(16, 8, PAL.brown).map((pc, f) => ({ name: f, pc })),
  );
}
