// 전투 HUD: 시간 레일, 상태판, 적 의도, 장비 슬롯, 미리보기. 표시만 한다.
import Phaser from 'phaser';
import { PAL } from '../art/palette';
import type { PreviewInfo } from '../core/preview';
import type { ActionDef } from '../core/types';
import { EQUIP, type EquipId } from '../data/equipment';
import type { EnemyActionDef } from '../data/enemies';
import { txt } from '../ui/text';
import { panel } from '../ui/widgets';

export const TL = { x0: 50, px: 22, maxT: 18, y: 23 };

export function tlX(t: number): number {
  return TL.x0 + Math.min(t, TL.maxT) * TL.px;
}

class HpBar {
  private bg: Phaser.GameObjects.Rectangle;
  private chunk: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private shown = 1;

  constructor(
    private scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private x: number,
    y: number,
    private w: number,
    private color: number,
  ) {
    this.bg = scene.add.rectangle(x, y, w, 5, PAL.ink).setOrigin(0, 0);
    this.chunk = scene.add.rectangle(x, y, w, 5, PAL.white).setOrigin(0, 0);
    this.fill = scene.add.rectangle(x, y, w, 5, color).setOrigin(0, 0);
    const frame = scene.add.rectangle(x - 1, y - 1, w + 2, 7).setOrigin(0, 0).setStrokeStyle(1, PAL.dslate);
    this.label = txt(scene, x + w, y - 11, '', { font: 'tiny', color: PAL.silver, origin: [1, 0] });
    parent.add([frame, this.bg, this.chunk, this.fill, this.label]);
  }

  set(hp: number, max: number, animate: boolean): void {
    const r = Math.max(0, hp) / max;
    const w = Math.max(0, Math.round(this.w * r));
    this.label.setText(`${Math.max(0, hp)}/${max}`);
    this.label.setX(this.x + this.w);
    const col = this.color === PAL.green ? (r > 0.5 ? PAL.green : r > 0.25 ? PAL.gold : PAL.red) : this.color;
    this.fill.setFillStyle(col);
    this.fill.width = w;
    if (!animate || r >= this.shown) {
      this.chunk.width = w;
      this.chunk.setFillStyle(r > this.shown ? PAL.cyan : PAL.white);
      if (r > this.shown) {
        this.chunk.width = w;
      }
    } else {
      this.chunk.setFillStyle(PAL.white);
      this.scene.tweens.add({ targets: this.chunk, width: w, delay: 260, duration: 320, ease: 'Quad.easeIn' });
    }
    this.shown = r;
  }
}

export interface SlotView {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.NineSlice;
  zone: Phaser.GameObjects.Zone;
  act: ActionDef;
  uses: Phaser.GameObjects.Image[];
}

const KIND_ICON: Record<string, string> = {
  attack: 'ic_atk',
  guard: 'ic_def',
  heal: 'ic_heal',
  charge: 'ic_wait',
  rest: 'ic_wait',
};

export class BattleHud {
  readonly root: Phaser.GameObjects.Container;
  private pMarker: Phaser.GameObjects.Image;
  private eMarker: Phaser.GameObjects.Image;
  private ghost: Phaser.GameObjects.Image;
  private pTag: Phaser.GameObjects.Text;
  private eTag: Phaser.GameObjects.Text;
  private gTag: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private pBar: HpBar;
  private eBar: HpBar;
  private pDef: Phaser.GameObjects.Text;
  private pAct: Phaser.GameObjects.Text;
  private pGhostDef: Phaser.GameObjects.Text;
  private eDef: Phaser.GameObjects.Text;
  private intent: Phaser.GameObjects.Container;
  private intentBg: Phaser.GameObjects.NineSlice;
  private intentIcon: Phaser.GameObjects.Image;
  private intentName: Phaser.GameObjects.Text;
  private intentStats: Phaser.GameObjects.Text;
  private intentTag: Phaser.GameObjects.Text;
  private intentWarn: Phaser.GameObjects.Image;
  private intentPulse?: Phaser.Tweens.Tween;
  private intentW = 100;
  readonly slots: SlotView[] = [];
  private cursor: Phaser.GameObjects.Image;
  private pv: Phaser.GameObjects.Container;
  private pvTitle: Phaser.GameObjects.Text;
  private pvStats: Phaser.GameObjects.Text;
  private pvLines: Phaser.GameObjects.Text[] = [];
  private pvHint: Phaser.GameObjects.Text;
  private logText: Phaser.GameObjects.Text;
  private selecting = false;

  constructor(
    private scene: Phaser.Scene,
    loadout: readonly ActionDef[],
    private levels: Partial<Record<EquipId, number>>,
    enemyName: string,
  ) {
    const s = scene;
    this.root = s.add.container(0, 0).setDepth(100);
    // ── 시간 레일
    this.root.add(panel(s, 6, 2, 468, 42, 'steel'));
    this.root.add(txt(s, 13, 17, '지금', { font: 'small', color: PAL.gold }));
    const rail = s.add.graphics();
    rail.fillStyle(PAL.dslate).fillRect(TL.x0, TL.y, TL.maxT * TL.px + 2, 2);
    rail.fillStyle(PAL.slate).fillRect(TL.x0, TL.y, TL.maxT * TL.px + 2, 1);
    for (let t = 0; t <= TL.maxT; t++) {
      const x = tlX(t);
      const big = t % 4 === 0;
      rail.fillStyle(big ? PAL.steel : PAL.dslate).fillRect(x, TL.y - (big ? 3 : 1), 1, big ? 8 : 4);
    }
    rail.fillStyle(PAL.gold).fillRect(TL.x0 - 1, TL.y - 5, 2, 12);
    this.root.add(rail);
    this.timeText = txt(s, 466, 5, '경과 0틱', { font: 'tiny', color: PAL.steel, origin: [1, 0] });
    this.root.add(this.timeText);
    this.ghost = s.add.image(0, 0, 'mk_ghost').setOrigin(0.5, 1).setVisible(false);
    this.pMarker = s.add.image(tlX(0), TL.y - 2, 'mk_player').setOrigin(0.5, 1).setVisible(false);
    this.eMarker = s.add.image(tlX(0), TL.y + 3, 'mk_enemy').setOrigin(0.5, 0).setVisible(false);
    this.pTag = txt(s, 0, 7, '', { font: 'tiny', color: PAL.yellow, shadow: PAL.ink });
    this.eTag = txt(s, 0, 30, '', { font: 'tiny', color: PAL.pink, shadow: PAL.ink });
    this.gTag = txt(s, 0, 7, '', { font: 'tiny', color: PAL.cyan, shadow: PAL.ink }).setVisible(false);
    this.root.add([this.ghost, this.pMarker, this.eMarker, this.pTag, this.eTag, this.gTag]);

    // ── 상태판: 이름·HP 숫자 / HP 막대 / 방어·현재 행동
    const pp = s.add.container(6, 46);
    pp.add(panel(s, 0, 0, 164, 38, 'dark'));
    pp.add(txt(s, 7, 3, '하루', { font: 'bold', color: PAL.white }));
    this.pBar = new HpBar(s, pp, 7, 18, 150, PAL.green);
    pp.add(s.add.image(7, 26, 'ic_def').setOrigin(0, 0));
    this.pDef = txt(s, 18, 25, '0', { font: 'small', color: PAL.silver });
    this.pGhostDef = txt(s, 30, 25, '', { font: 'small', color: PAL.cyan });
    this.pAct = txt(s, 157, 25, '', { font: 'small', color: PAL.steel, origin: [1, 0] });
    pp.add([this.pDef, this.pGhostDef, this.pAct]);
    this.root.add(pp);

    const ep = s.add.container(310, 46);
    ep.add(panel(s, 0, 0, 164, 38, 'dark'));
    ep.add(txt(s, 7, 3, enemyName, { font: 'bold', color: PAL.pink }));
    this.eBar = new HpBar(s, ep, 7, 18, 150, PAL.red);
    ep.add(s.add.image(7, 26, 'ic_def').setOrigin(0, 0));
    this.eDef = txt(s, 18, 25, '0', { font: 'small', color: PAL.silver });
    ep.add(this.eDef);
    this.root.add(ep);

    // ── 적 의도: 레일 위 적 표식 옆에 "무엇을"과 "언제"를 함께 붙인다
    this.intent = s.add.container(0, TL.y + 4);
    this.intentBg = panel(s, 0, 0, 120, 15, 'dark');
    this.intentIcon = s.add.image(4, 3, 'ic_atk').setOrigin(0, 0);
    this.intentName = txt(s, 15, 1, '', { font: 'small', color: PAL.white });
    this.intentStats = txt(s, 0, 2, '', { font: 'tiny', color: PAL.silver });
    this.intentTag = txt(s, 0, 2, '', { font: 'tiny', color: PAL.magenta });
    this.intentWarn = s.add.image(0, 3, 'ic_warn').setOrigin(0, 0).setVisible(false);
    this.intent.add([this.intentBg, this.intentIcon, this.intentName, this.intentStats, this.intentTag, this.intentWarn]);
    this.intent.setVisible(false);
    this.root.add(this.intent);

    // ── 하단: 장비 슬롯 + 미리보기
    this.root.add(panel(s, 0, 198, 480, 72, 'brass'));
    loadout.forEach((a, i) => this.slots.push(this.makeSlot(a, i)));
    this.cursor = s.add.image(0, 0, 'ic_cursorDown').setOrigin(0.5, 1).setVisible(false);
    this.root.add(this.cursor);
    s.tweens.add({ targets: this.cursor, y: '+=2', duration: 300, yoyo: true, repeat: -1 });

    this.pv = s.add.container(254, 202);
    this.pv.add(panel(s, 0, 0, 220, 64, 'dark'));
    this.pvTitle = txt(s, 7, 3, '', { font: 'bold', color: PAL.yellow });
    this.pvStats = txt(s, 7, 17, '', { font: 'small', color: PAL.silver });
    this.pv.add([this.pvTitle, this.pvStats]);
    for (let i = 0; i < 3; i++) {
      const t = txt(s, 7, 29 + i * 10, '', { font: 'small', color: PAL.white });
      this.pvLines.push(t);
      this.pv.add(t);
    }
    this.pvHint = txt(s, 213, 3, '', { font: 'tiny', color: PAL.steel, origin: [1, 0] });
    this.pv.add(this.pvHint);
    this.logText = txt(s, 7, 6, '', { font: 'small', color: PAL.silver, wrap: 206, lineSpacing: 3 });
    this.pv.add(this.logText);
    this.root.add(this.pv);
  }

  private makeSlot(a: ActionDef, i: number): SlotView {
    const s = this.scene;
    const x = 6 + i * 49;
    const y = 202;
    const root = s.add.container(x, y);
    const bg = panel(s, 0, 0, 47, 64, 'slot');
    const icon = s.add.image(23, 14, `icon_${a.id}`);
    const lv = this.levels[a.id as EquipId] ?? 1;
    const num = txt(s, 4, 2, String(i + 1), { font: 'tiny', color: PAL.steel });
    const lvT = lv > 1 ? txt(s, 43, 2, `+${lv - 1}`, { font: 'tiny', color: PAL.gold, origin: [1, 0] }) : null;
    const name = txt(s, 0, 26, EQUIP[a.id as EquipId].short, { font: 'small', color: PAL.white });
    name.setX(Math.round(24 - name.width / 2));
    const row1: Phaser.GameObjects.GameObject[] = [];
    const statIconY = 39;
    if (a.kind === 'heal') {
      row1.push(s.add.image(4, statIconY, 'ic_heal').setOrigin(0, 0), txt(s, 14, statIconY - 1, String(a.effect), { font: 'tiny', color: PAL.green }));
    } else {
      row1.push(
        s.add.image(4, statIconY, a.pierce ? 'ic_pierce' : 'ic_atk').setOrigin(0, 0),
        txt(s, 14, statIconY - 1, String(a.effect), { font: 'tiny', color: a.effect > 0 ? PAL.white : PAL.slate }),
      );
    }
    row1.push(s.add.image(25, statIconY, 'ic_def').setOrigin(0, 0), txt(s, 35, statIconY - 1, String(a.defense), { font: 'tiny', color: PAL.silver }));
    const row2: Phaser.GameObjects.GameObject[] = [
      s.add.image(4, 50, 'ic_wait').setOrigin(0, 0),
      txt(s, 14, 49, String(a.wait), { font: 'tiny', color: PAL.yellow }),
    ];
    if (a.delay) row2.push(s.add.image(25, 50, 'ic_delay').setOrigin(0, 0), txt(s, 35, 49, `+${a.delay}`, { font: 'tiny', color: PAL.cyan }));
    const uses: Phaser.GameObjects.Image[] = [];
    if (a.uses) for (let k = 0; k < a.uses; k++) uses.push(s.add.image(25 + k * 6, 51, 'ic_uses').setOrigin(0, 0));
    root.add([bg, icon, num, name, ...row1, ...row2, ...uses]);
    if (lvT) root.add(lvT);
    const zone = s.add.zone(0, 0, 47, 64).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    root.add(zone);
    this.root.add(root);
    return { root, bg, zone, act: a, uses };
  }

  setSelecting(on: boolean): void {
    this.selecting = on;
    this.cursor.setVisible(on);
    for (const sl of this.slots) sl.root.setAlpha(on ? 1 : 0.55);
    this.pvTitle.setVisible(on);
    this.pvStats.setVisible(on);
    this.pvLines.forEach((l) => l.setVisible(on));
    this.pvHint.setVisible(on);
    this.logText.setVisible(!on);
    if (!on) {
      this.ghost.setVisible(false);
      this.gTag.setVisible(false);
      this.pGhostDef.setText('');
    }
  }

  setUses(id: string, left: number): void {
    const sl = this.slots.find((x) => x.act.id === id);
    if (!sl) return;
    sl.uses.forEach((u, k) => u.setTexture(k < left ? 'ic_uses' : 'ic_usesOff'));
  }

  setSlotEnabled(i: number, on: boolean): void {
    const sl = this.slots[i];
    if (!sl) return;
    sl.bg.setTexture(on ? 'panel_slot' : 'panel_slotOff');
  }

  focusSlot(i: number, enabled: boolean[]): void {
    this.slots.forEach((sl, k) => {
      sl.bg.setTexture(k === i ? 'panel_slotSel' : enabled[k] ? 'panel_slot' : 'panel_slotOff');
      // 고를 수 없는 슬롯(안내 중 잠김, 횟수 소진)은 흐리게.
      sl.root.setAlpha(enabled[k] ? 1 : 0.4);
    });
    const sl = this.slots[i];
    this.cursor.setPosition(sl.root.x + 24, 201);
  }

  /** 미리보기 표시: 확실한 결과만. */
  showPreview(p: PreviewInfo, id: string, playerWaitNow: number | null): void {
    if (!p.ok) {
      this.pvTitle.setText(EQUIP[id as EquipId]?.name ?? id);
      this.pvStats.setText(p.reason);
      this.pvLines.forEach((l) => l.setText(''));
      this.ghost.setVisible(false);
      this.gTag.setVisible(false);
      this.pGhostDef.setText('');
      return;
    }
    const e = EQUIP[id as EquipId];
    const a = p.act;
    this.pvTitle.setText(`${e.name} · ${e.role}`);
    const parts = [a.kind === 'heal' ? `회복 ${a.effect}` : `위력 ${a.effect}${a.pierce ? '(관통)' : ''}`, `방어 ${a.defense}`, `대기 ${a.wait}`];
    if (a.delay) parts.push(`지연 +${a.delay}`);
    if (a.uses) parts.push(`남은 ${p.usesLeft != null ? p.usesLeft + 1 : a.uses}회`);
    this.pvStats.setText(parts.join('  '));
    this.pvHint.setText('Z·클릭 확정');
    const lines: [string, number][] = [];
    if (p.enemyFirst) {
      const ef = p.enemyFirst;
      const when = ef.at === 0 ? '확정 즉시' : `${ef.at}틱 뒤`;
      if (ef.damage) {
        const d = ef.damage;
        if (d.result === 'full') lines.push([`${when} 적 「${ef.act.name}」 → 완전 방어!`, PAL.cyan]);
        else if (d.result === 'pierce') lines.push([`${when} 적 「${ef.act.name}」 관통 → 피해 ${d.amount}`, PAL.pink]);
        else lines.push([`${when} 적 「${ef.act.name}」 → 받는 피해 ${d.amount}${d.defense > 0 ? ` (방어 -${d.defense})` : ''}`, d.amount >= 10 ? PAL.red : PAL.tan]);
      } else lines.push([`${when} 적 「${ef.act.name}」 끝 (공격 아님)`, PAL.steel]);
      if (ef.delay?.applied) lines.push([`  └ 내 행동 ${ef.delay.amount}틱 지연`, PAL.cyan]);
    }
    if (p.playerDies) lines.push(['※ 이 선택이면 쓰러진다!', PAL.hotred]);
    else if (p.mine) {
      const m = p.mine;
      const bits: string[] = [];
      if (m.damage) bits.push(m.damage.result === 'full' ? '막힘(피해 0)' : `피해 ${m.damage.amount}${m.damage.lethal ? ' — 쓰러뜨린다!' : ''}`);
      if (m.heal != null) bits.push(`회복 +${m.heal}`);
      if (m.delay) bits.push(m.delay.applied ? `적 행동 +${m.delay.amount}틱` : '지연 무효');
      if (bits.length === 0) bits.push('자세를 푼다');
      lines.push([`${m.at}틱 뒤 내 행동 → ${bits.join(', ')}`, m.damage?.lethal ? PAL.yellow : PAL.gold]);
    } else if (p.mineUncertain) {
      lines.push([`${p.mineAt}틱 뒤 발동 — 적의 다음 동작 중(결과 미정)`, PAL.steel]);
    }
    this.pvLines.forEach((l, k) => {
      l.setText(lines[k]?.[0] ?? '');
      l.setColor(`#${(lines[k]?.[1] ?? PAL.white).toString(16).padStart(6, '0')}`);
    });
    // 레일 미리보기(점선 표식)
    this.ghost.setPosition(tlX(p.wait), TL.y - 2).setVisible(true);
    this.gTag.setText(String(p.wait)).setPosition(tlX(p.wait) + 6, 7).setVisible(true);
    this.pGhostDef.setText(`→${p.defense}`);
    void playerWaitNow;
  }

  log(s: string): void {
    this.logText.setText(s);
  }

  setTime(t: number): void {
    this.timeText.setText(`경과 ${t}틱`);
  }

  setPlayerMarker(wait: number | null): void {
    if (wait === null) {
      this.pMarker.setVisible(false);
      this.pTag.setVisible(false);
      return;
    }
    this.pMarker.setVisible(true).setX(tlX(wait));
    this.pTag.setVisible(true).setText(String(wait)).setX(tlX(wait) + 6);
  }

  setEnemyMarker(wait: number | null): void {
    if (wait === null) {
      this.eMarker.setVisible(false);
      this.eTag.setVisible(false);
      return;
    }
    this.eMarker.setVisible(true).setX(tlX(wait));
    this.eTag.setVisible(true).setText(String(wait)).setX(tlX(wait) + 6);
    if (this.intent.visible) this.placeIntent();
  }

  /** 레일 위 두 표식을 dt틱만큼 함께 흘려보낸다. */
  flow(pFrom: number | null, eFrom: number | null, dt: number, ms: number, onTick: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let k = 0;
      const step = () => {
        k++;
        if (pFrom !== null) this.setPlayerMarker(pFrom - k);
        if (eFrom !== null) this.setEnemyMarker(eFrom - k);
        onTick(k);
        if (k >= dt) resolve();
        else this.scene.time.delayedCall(ms, step);
      };
      this.scene.time.delayedCall(ms, step);
    });
  }

  enemyMarkerX(): number {
    return this.eMarker.x;
  }

  playerHp(hp: number, max: number, animate = true): void {
    this.pBar.set(hp, max, animate);
  }

  enemyHp(hp: number, max: number, animate = true): void {
    this.eBar.set(hp, max, animate);
  }

  playerState(def: number, action: string): void {
    this.pDef.setText(String(def));
    this.pAct.setText(action);
    this.pGhostDef.setX(18 + this.pDef.width + 4);
  }

  enemyDef(def: number): void {
    this.eDef.setText(String(def));
  }

  showIntent(a: EnemyActionDef, danger: boolean): void {
    this.intentIcon.setTexture(KIND_ICON[a.kind] ?? 'ic_atk');
    this.intentName.setText(a.name);
    this.intentName.setColor(danger ? '#ff0044' : '#ffffff');
    const stats = a.kind === 'attack' ? `위력${a.effect} 방어${a.defense}` : a.kind === 'heal' ? `회복${a.effect}` : `방어${a.defense}`;
    this.intentStats.setText(stats);
    const tags: string[] = [];
    if (a.pierce) tags.push('관통');
    if (a.delay) tags.push(`지연+${a.delay}`);
    if (!a.pierce && !a.delay && a.hint) tags.push(a.hint);
    this.intentTag.setText(tags.join(' '));
    this.intentTag.setColor(a.pierce ? '#f6757a' : a.delay ? '#2ce8f5' : '#8b9bb4');
    this.intentStats.setX(this.intentName.x + this.intentName.width + 5);
    this.intentTag.setX(this.intentStats.x + this.intentStats.width + (tags.length ? 5 : 0));
    let w = Math.round(this.intentTag.x + this.intentTag.width + 5);
    if (danger) {
      this.intentWarn.setX(w);
      w += 12;
    }
    this.intentBg.setSize(w, 15);
    this.intentW = w;
    this.intent.setVisible(true);
    this.intentWarn.setVisible(danger);
    this.intentPulse?.stop();
    this.intentBg.setTexture(danger ? 'panel_brass' : 'panel_dark');
    if (danger) this.intentPulse = this.scene.tweens.add({ targets: this.intentWarn, alpha: 0.25, duration: 260, yoyo: true, repeat: -1 });
    else this.intentWarn.setAlpha(1);
    this.placeIntent();
    this.intent.setAlpha(0);
    this.scene.tweens.add({ targets: this.intent, alpha: 1, duration: 120 });
  }

  /** 적 표식을 따라 의도 표시를 붙인다(오른쪽 끝에서는 왼쪽으로). */
  private placeIntent(): void {
    const mx = this.eMarker.x;
    let x = mx + 16;
    if (x + this.intentW > 470) x = mx - 8 - this.intentW;
    this.intent.setX(Math.round(Math.max(40, x)));
  }

  hideIntent(): void {
    this.intent.setVisible(false);
    this.intentPulse?.stop();
  }

  slotIndexAt(zone: Phaser.GameObjects.Zone): number {
    return this.slots.findIndex((s) => s.zone === zone);
  }

  get isSelecting(): boolean {
    return this.selecting;
  }
}
