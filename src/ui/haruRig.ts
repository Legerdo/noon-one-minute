// 하루 전투 스프라이트 조립: 몸 프레임 + 손 위치의 무기(아래/위 레이어).
import Phaser from 'phaser';
import { bodyHand, type BodyPose, BODY_ORIGIN } from '../art/haru';
import { applyFrame } from '../art/textures';
import type { WeaponView } from '../art/weapons';
import type { EquipId } from '../data/equipment';

interface Grip {
  view: WeaponView;
  over: boolean;
}

const DEFAULT_VIEW: Record<EquipId, WeaponView> = {
  dagger: 'd',
  sword: 'dr',
  hammer: 'ul',
  awl: 'd',
  wedge: 'd',
  buckler: 'side',
  tower: 'side',
  tonic: 'side',
};

const GRIPS: Partial<Record<EquipId, Partial<Record<BodyPose, Grip>>>> = {
  dagger: {
    ready: { view: 'r', over: false },
    readyLow: { view: 'r', over: false },
    strike: { view: 'r', over: false },
    windup: { view: 'ul', over: false },
    cheer: { view: 'u', over: false },
    hurt: { view: 'ul', over: false },
  },
  sword: {
    ready: { view: 'ur', over: false },
    readyLow: { view: 'ur', over: false },
    windup: { view: 'ul', over: false },
    windupHi: { view: 'u', over: false },
    strike: { view: 'r', over: false },
    slam: { view: 'dr', over: false },
    cheer: { view: 'u', over: false },
    hurt: { view: 'ul', over: false },
  },
  hammer: {
    ready: { view: 'ul', over: false },
    windup: { view: 'ul', over: false },
    windupHi: { view: 'u', over: false },
    slam: { view: 'r', over: false },
    strike: { view: 'r', over: false },
    cheer: { view: 'u', over: false },
    kneel: { view: 'dl', over: false },
  },
  awl: {
    ready: { view: 'r', over: false },
    readyLow: { view: 'r', over: false },
    strike: { view: 'r', over: false },
    cheer: { view: 'u', over: false },
    hurt: { view: 'ul', over: false },
  },
  wedge: {
    ready: { view: 'u', over: true },
    readyLow: { view: 'u', over: true },
    cast: { view: 'r', over: true },
    cheer: { view: 'u', over: true },
  },
  buckler: {
    guard: { view: 'front', over: true },
  },
  tower: {
    guard: { view: 'front', over: true },
  },
  tonic: {
    drink: { view: 'tip', over: true },
    idle0: { view: 'side', over: true },
    idle1: { view: 'side', over: true },
    idle2: { view: 'side', over: true },
    idle3: { view: 'side', over: true },
  },
};

export function gripFor(equip: EquipId, pose: BodyPose): Grip {
  return GRIPS[equip]?.[pose] ?? { view: DEFAULT_VIEW[equip], over: equip === 'tonic' };
}

/** 준비(확정 후 대기) 자세. */
export function preparePose(equip: EquipId, remaining: number, total: number): BodyPose {
  switch (equip) {
    case 'hammer':
      return remaining <= Math.max(1, Math.floor(total * 0.34)) ? 'windupHi' : 'windup';
    case 'sword':
      return 'ready';
    case 'dagger':
    case 'awl':
      return 'readyLow';
    case 'wedge':
      return 'ready';
    case 'buckler':
    case 'tower':
      return 'guard';
    case 'tonic':
      return 'drink';
  }
}

/** 실행(해결) 자세. */
export function executePose(equip: EquipId): BodyPose {
  switch (equip) {
    case 'hammer':
      return 'slam';
    case 'wedge':
      return 'cast';
    case 'buckler':
    case 'tower':
      return 'guard';
    case 'tonic':
      return 'cheer';
    default:
      return 'strike';
  }
}

export class HaruRig {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private under: Phaser.GameObjects.Image;
  private over: Phaser.GameObjects.Image;
  pose: BodyPose = 'idle0';
  equip: EquipId | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.under = scene.add.image(0, 0, 'wpn_sword', 'r').setVisible(false);
    this.body = scene.add.image(0, 0, 'haru_b', 'idle0');
    this.over = scene.add.image(0, 0, 'wpn_sword', 'r').setVisible(false);
    this.root = scene.add.container(Math.round(x), Math.round(y), [this.under, this.body, this.over]);
    this.set('idle0', null);
  }

  set(pose: BodyPose, equip: EquipId | null, blink = false): void {
    this.pose = pose;
    this.equip = equip;
    const frame = blink && pose.startsWith('idle') ? `${pose}_blink` : pose;
    applyFrame(this.body, 'haru_b', frame);
    this.body.setPosition(0, 0);
    this.under.setVisible(false);
    this.over.setVisible(false);
    if (!equip) return;
    const g = gripFor(equip, pose);
    const img = g.over ? this.over : this.under;
    applyFrame(img, `wpn_${equip}`, g.view);
    const [hx, hy] = bodyHand(pose);
    img.setPosition(hx - BODY_ORIGIN[0], hy - BODY_ORIGIN[1]);
    img.setVisible(true);
  }

  /** 손(무기) 월드 좌표. */
  handWorld(): { x: number; y: number } {
    const [hx, hy] = bodyHand(this.pose);
    return { x: this.root.x + hx - BODY_ORIGIN[0], y: this.root.y + hy - BODY_ORIGIN[1] };
  }

  setTint(c: number | null): void {
    for (const o of [this.body, this.under, this.over]) {
      if (c === null) o.clearTint();
      else o.setTintFill(c);
    }
  }
}
