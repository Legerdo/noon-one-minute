// 탐험 중 오버레이: 전투 준비(관찰 기록), 작업대 강화, 상태 보기.
import Phaser from 'phaser';
import { sfx } from '../audio/audio';
import { PAL } from '../art/palette';
import { ENEMY_ORIGIN_Y } from '../art/textures';
import { EQUIP, MAX_LEVEL, type EquipId } from '../data/equipment';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { levelOf, upgradeCost, upgradeEquip, type SaveData } from '../game/progress';
import { statLine } from '../ui/loadout';
import { txt } from '../ui/text';
import { confirm, Menu, panel, type InputRouter, type Layer, type UiKey } from '../ui/widgets';

const KIND_NAME: Record<string, string> = { attack: '공격', guard: '방어', heal: '회복', charge: '준비', rest: '빈틈' };

/** 전투 준비 화면: 적의 관찰 기록 + 현재 로드아웃. 결과: 'fight' | 'loadout' | 'leave'. */
export function preBattle(scene: Phaser.Scene, router: InputRouter, enemy: EnemyId, save: SaveData): Promise<'fight' | 'loadout' | 'leave'> {
  return new Promise((resolve) => {
    const def = ENEMIES[enemy];
    const root = scene.add.container(0, 0).setDepth(2500).setScrollFactor(0);
    root.add(scene.add.rectangle(0, 0, 480, 270, PAL.ink, 0.75).setOrigin(0, 0).setInteractive());
    root.add(panel(scene, 10, 8, 460, 254, 'brass'));
    root.add(txt(scene, 22, 14, def.name, { font: 'big', color: PAL.pink }));
    root.add(txt(scene, 22, 32, `${def.title} · 체력 ${def.maxHp}`, { font: 'small', color: PAL.steel }));
    // 초상
    if (enemy !== 'boss') {
      const img = scene.add.image(76, 132, `enemy_${enemy}`, 'idle_0').setOrigin(0.5, ENEMY_ORIGIN_Y.get(enemy) ?? 1);
      root.add(img);
    } else {
      root.add(scene.add.image(76, 110, 'mk_enemy').setScale(3));
    }
    // 관찰 기록
    root.add(panel(scene, 136, 44, 324, 60, 'dark'));
    root.add(txt(scene, 144, 48, '관찰 기록', { font: 'small', color: PAL.gold }));
    def.notes.forEach((n, i) => root.add(txt(scene, 144, 60 + i * 13, `· ${n}`, { font: 'small', color: PAL.cream, wrap: 308 })));
    // 행동 목록
    root.add(txt(scene, 22, 142, '알려진 동작', { font: 'small', color: PAL.gold }));
    const acts = Object.values(def.actions);
    acts.forEach((a, i) => {
      const col = i < 4 || acts.length <= 4 ? 0 : 1;
      const row = col === 0 ? i : i - 4;
      const x = 22 + col * 224;
      const y = 156 + row * 12;
      const tags: string[] = [];
      if (a.pierce) tags.push('관통');
      if (a.delay) tags.push(`지연+${a.delay}`);
      const stats = a.kind === 'attack' ? `위력${a.effect} 방어${a.defense} 대기${a.wait}` : `방어${a.defense} 대기${a.wait}`;
      root.add(txt(scene, x, y, `${a.name}`, { font: 'small', color: a.pierce ? PAL.magenta : a.effect >= 15 ? PAL.red : PAL.white }));
      root.add(txt(scene, x + 78, y, `[${KIND_NAME[a.kind]}] ${stats} ${tags.join(' ')}`, { font: 'tiny', color: PAL.silver }));
    });
    // 로드아웃
    root.add(txt(scene, 136, 110, '가져가는 장비', { font: 'small', color: PAL.gold }));
    save.loadout.forEach((id, i) => {
      root.add(panel(scene, 136 + i * 28, 122, 26, 26, 'slot'));
      root.add(scene.add.image(149 + i * 28, 135, `icon_${id}`));
    });
    root.add(txt(scene, 284, 128, `체력 ${save.maxHp}`, { font: 'small', color: PAL.green }));
    const m = new Menu(
      scene,
      router,
      344,
      110,
      [{ label: '싸운다' }, { label: '장비 바꾸기' }, { label: '물러난다' }],
      {
        select: (i) => {
          m.close();
          root.destroy();
          resolve(i === 0 ? 'fight' : i === 1 ? 'loadout' : 'leave');
        },
        cancel: () => {
          m.close();
          root.destroy();
          resolve('leave');
        },
      },
      { width: 116 },
    );
    m.root.setDepth(2600).setScrollFactor(0);
  });
}

/** 작업대 강화 화면. 톱니 소비는 확인 후 원자적으로 적용·저장된다. */
export class UpgradePanel implements Layer {
  readonly layerName = 'upgrade';
  private root: Phaser.GameObjects.Container;
  private rows: { bg: Phaser.GameObjects.Rectangle; id: EquipId; lv: Phaser.GameObjects.Text; next: Phaser.GameObjects.Text; stat: Phaser.GameObjects.Text }[] = [];
  private gearsText: Phaser.GameObjects.Text;
  private index = 0;
  private busy = false;
  private closed = false;
  private openedAt: number;

  constructor(
    private scene: Phaser.Scene,
    private router: InputRouter,
    private save: SaveData,
    private commit: (s: SaveData) => void,
    private onClose: () => void,
  ) {
    const s = scene;
    this.root = s.add.container(0, 0).setDepth(2500).setScrollFactor(0);
    this.root.add(s.add.rectangle(0, 0, 480, 270, PAL.ink, 0.75).setOrigin(0, 0).setInteractive());
    this.root.add(panel(s, 16, 10, 448, 250, 'brass'));
    this.root.add(txt(s, 28, 16, '작업대 · 장비 강화', { font: 'bold', color: PAL.yellow }));
    this.root.add(s.add.image(360, 22, 'ic_gear'));
    this.gearsText = txt(s, 370, 16, '', { font: 'bold', color: PAL.gold });
    this.root.add(this.gearsText);
    this.root.add(txt(s, 452, 34, 'Z 강화 · X 닫기 · Lv3까지 (1→2: 톱니1, 2→3: 톱니2)', { font: 'tiny', color: PAL.steel, origin: [1, 0] }));
    save.owned.forEach((id, i) => {
      const y = 46 + i * 25;
      const bg = s.add.rectangle(26, y, 428, 23, PAL.night).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const icon = s.add.image(38, y + 11, `icon_${id}`);
      const name = txt(s, 52, y + 1, EQUIP[id].name, { font: 'small', color: PAL.white });
      const lv = txt(s, 172, y + 5, '', { font: 'bold', color: PAL.gold });
      const stat = txt(s, 52, y + 12, '', { font: 'tiny', color: PAL.silver });
      const next = txt(s, 250, y + 6, '', { font: 'small', color: PAL.cyan });
      bg.on('pointerover', () => this.focus(i));
      bg.on('pointerup', () => void this.tryUpgrade(i));
      this.root.add([bg, icon, name, lv, stat, next]);
      this.rows.push({ bg, id, lv, next, stat });
    });
    this.openedAt = s.time.now;
    router.push(this);
    this.refresh();
    this.focus(0);
  }

  private refresh(): void {
    this.gearsText.setText(`× ${this.save.gears}`);
    for (const r of this.rows) {
      const lv = levelOf(this.save, r.id);
      r.lv.setText(`Lv.${lv}/${MAX_LEVEL}`);
      r.lv.setColor(lv >= MAX_LEVEL ? '#fee761' : '#feae34');
      r.stat.setText(statLine(r.id, lv));
      const cost = upgradeCost(this.save, r.id);
      if (lv >= MAX_LEVEL || cost == null) {
        r.next.setText('최대 강화');
        r.next.setColor('#5a6988');
      } else {
        const note = EQUIP[r.id].upgrades[lv - 1].note;
        r.next.setText(`다음: ${note}  (톱니 ${cost})`);
        r.next.setColor(this.save.gears >= cost ? '#2ce8f5' : '#5a6988');
      }
    }
  }

  private focus(i: number): void {
    if (this.closed || this.busy) return;
    if (i !== this.index) sfx('ui_move');
    this.index = i;
    this.rows.forEach((r, k) => r.bg.setFillStyle(k === i ? PAL.dslate : PAL.night));
  }

  private async tryUpgrade(i: number): Promise<void> {
    if (this.closed || this.busy || this.scene.time.now - this.openedAt < 200) return;
    const id = this.rows[i].id;
    const cost = upgradeCost(this.save, id);
    if (cost == null) {
      sfx('ui_deny');
      return;
    }
    if (this.save.gears < cost) {
      sfx('ui_deny');
      this.rows[i].next.setText(`톱니가 ${cost - this.save.gears}개 부족하다`);
      return;
    }
    this.busy = true;
    const lv = levelOf(this.save, id);
    const ok = await confirm(this.scene, this.router, `톱니 ${cost}개로 「${EQUIP[id].name}」 강화? (${EQUIP[id].upgrades[lv - 1].note})`, 60, 120);
    if (ok) {
      const r = upgradeEquip(this.save, id);
      if (r.ok) {
        this.save = r.save;
        this.commit(r.save);
        sfx('upgrade');
      }
    }
    this.refresh();
    // 연타로 두 번 강화되지 않도록 잠깐 잠근다.
    this.scene.time.delayedCall(300, () => (this.busy = false));
  }

  key(k: UiKey): void {
    if (this.closed || this.busy) return;
    const n = this.rows.length;
    if (n === 0 && k !== 'cancel') return;
    if (k === 'up') this.focus((this.index + n - 1) % n);
    else if (k === 'down') this.focus((this.index + 1) % n);
    else if (k === 'ok') void this.tryUpgrade(this.index);
    else if (k === 'cancel') this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.router.remove(this);
    this.root.destroy();
    this.onClose();
  }
}

/** 상태 보기(읽기 전용). */
export function statusView(scene: Phaser.Scene, router: InputRouter, save: SaveData): Promise<void> {
  return new Promise((resolve) => {
    const root = scene.add.container(0, 0).setDepth(2500).setScrollFactor(0);
    root.add(scene.add.rectangle(0, 0, 480, 270, PAL.ink, 0.75).setOrigin(0, 0).setInteractive());
    root.add(panel(scene, 40, 20, 400, 230, 'brass'));
    root.add(txt(scene, 52, 26, '하루의 상태', { font: 'bold', color: PAL.yellow }));
    root.add(txt(scene, 52, 44, `최대 체력 ${save.maxHp}   톱니 ${save.gears}   전투 ${save.battles}회 (패배 ${save.losses})`, { font: 'small', color: PAL.cream }));
    const mins = Math.floor(save.playTime / 60);
    root.add(txt(scene, 52, 58, `플레이 시간 ${mins}분`, { font: 'small', color: PAL.steel }));
    save.owned.forEach((id, i) => {
      const y = 76 + i * 20;
      root.add(scene.add.image(62, y + 8, `icon_${id}`));
      const lv = levelOf(save, id);
      root.add(txt(scene, 76, y, `${EQUIP[id].name} Lv${lv}${save.loadout.includes(id) ? '  ● 휴대' : ''}`, { font: 'small', color: PAL.white }));
      root.add(txt(scene, 76, y + 10, statLine(id, lv), { font: 'tiny', color: PAL.silver }));
    });
    if (save.owned.length === 0) root.add(txt(scene, 52, 80, '아직 장비가 없다.', { font: 'small', color: PAL.steel }));
    root.add(txt(scene, 428, 236, 'X 닫기', { font: 'tiny', color: PAL.steel, origin: [1, 0] }));
    const opened = scene.time.now;
    const layer: Layer = {
      layerName: 'status',
      key: (k) => {
        if ((k === 'ok' || k === 'cancel') && scene.time.now - opened > 150) {
          router.remove(layer);
          root.destroy();
          resolve();
        }
      },
    };
    router.push(layer);
  });
}
