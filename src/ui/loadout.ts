// 로드아웃 편집 오버레이(탐험 메뉴·작업대·전투 준비·패배 화면 공용). 전투 중에는 열 수 없다.
import Phaser from 'phaser';
import { sfx } from '../audio/audio';
import { PAL } from '../art/palette';
import { EQUIP, equipAction, LOADOUT_SIZE, type EquipId } from '../data/equipment';
import { levelOf, validateLoadout, type SaveData } from '../game/progress';
import { txt } from './text';
import { panel, type InputRouter, type Layer, type UiKey } from './widgets';

export function statLine(id: EquipId, level: number): string {
  const a = equipAction(id, level);
  const bits = [a.kind === 'heal' ? `회복 ${a.effect}` : `위력 ${a.effect}${a.pierce ? '관통' : ''}`, `방어 ${a.defense}`, `대기 ${a.wait}`];
  if (a.delay) bits.push(`지연+${a.delay}`);
  if (a.uses) bits.push(`${a.uses}회`);
  return bits.join(' ');
}

export class LoadoutPanel implements Layer {
  readonly layerName = 'loadout';
  private root: Phaser.GameObjects.Container;
  private rows: { bg: Phaser.GameObjects.Rectangle; check: Phaser.GameObjects.Text; id: EquipId }[] = [];
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private detail: Phaser.GameObjects.Text;
  private detailTitle: Phaser.GameObjects.Text;
  private msg: Phaser.GameObjects.Text;
  private index = 0;
  private sel: EquipId[];
  private openedAt: number;
  private closed = false;

  constructor(
    private scene: Phaser.Scene,
    private router: InputRouter,
    private save: SaveData,
    private onDone: (loadout: EquipId[] | null) => void,
    title = '장비 구성',
  ) {
    const s = scene;
    this.sel = [...save.loadout];
    this.root = s.add.container(0, 0).setDepth(3000).setScrollFactor(0);
    const dim = s.add.rectangle(0, 0, 480, 270, PAL.ink, 0.72).setOrigin(0, 0).setInteractive();
    this.root.add(dim);
    this.root.add(panel(s, 16, 12, 448, 246, 'brass'));
    this.root.add(txt(s, 28, 18, title, { font: 'bold', color: PAL.yellow }));
    this.root.add(txt(s, 452, 20, `전투에 가져갈 장비 ${LOADOUT_SIZE}개까지 · Z 넣기/빼기 · X 완료`, { font: 'tiny', color: PAL.steel, origin: [1, 0] }));
    save.owned.forEach((id, i) => {
      const y = 38 + i * 22;
      const bg = s.add.rectangle(26, y, 250, 20, PAL.night).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const icon = s.add.image(38, y + 10, `icon_${id}`);
      const lv = levelOf(save, id);
      const name = txt(s, 52, y + 1, `${EQUIP[id].name}${lv > 1 ? ` +${lv - 1}` : ''}`, { font: 'small', color: PAL.white });
      const stats = txt(s, 52, y + 11, statLine(id, lv), { font: 'tiny', color: PAL.silver });
      const check = txt(s, 262, y + 4, '', { font: 'bold', color: PAL.green });
      bg.on('pointerover', () => this.focus(i));
      bg.on('pointerup', () => this.toggle(i));
      this.root.add([bg, icon, name, stats, check]);
      this.rows.push({ bg, check, id });
    });
    // 오른쪽: 로드아웃 칸
    this.root.add(txt(s, 292, 38, '가져가는 장비', { font: 'small', color: PAL.gold }));
    for (let k = 0; k < LOADOUT_SIZE; k++) {
      const x = 292 + k * 32;
      this.root.add(panel(s, x, 52, 30, 30, 'slot'));
      const ic = s.add.image(x + 15, 67, 'icon_dagger').setVisible(false);
      this.slotIcons.push(ic);
      this.root.add(ic);
    }
    this.root.add(panel(s, 288, 90, 168, 130, 'dark'));
    this.detailTitle = txt(s, 296, 96, '', { font: 'bold', color: PAL.yellow });
    this.detail = txt(s, 296, 112, '', { font: 'small', color: PAL.silver, wrap: 152, lineSpacing: 3 });
    this.msg = txt(s, 292, 228, '', { font: 'small', color: PAL.pink, wrap: 164 });
    const done = txt(s, 292, 242, '[ 완료 ]', { font: 'bold', color: PAL.white }).setInteractive({ useHandCursor: true });
    done.on('pointerup', () => this.finish());
    this.root.add([this.detailTitle, this.detail, this.msg, done]);
    if (save.owned.length === 0) {
      this.root.add(txt(s, 30, 44, '아직 가진 장비가 없다.\n왼쪽 작업실의 공구함부터 열어 보자.', { font: 'small', color: PAL.steel, lineSpacing: 4 }));
      this.detailTitle.setText('장비 없음');
      this.detail.setText('Z 또는 X로 닫기');
    }
    this.openedAt = s.time.now;
    router.push(this);
    this.refresh();
    this.focus(0);
  }

  private refresh(): void {
    this.rows.forEach((r) => r.check.setText(this.sel.includes(r.id) ? '●' : ''));
    this.slotIcons.forEach((ic, k) => {
      const id = this.sel[k];
      ic.setVisible(!!id);
      if (id) ic.setTexture(`icon_${id}`);
    });
  }

  private focus(i: number): void {
    if (this.closed || this.rows.length === 0) return;
    if (i !== this.index) sfx('ui_move');
    this.index = i;
    this.rows.forEach((r, k) => r.bg.setFillStyle(k === i ? PAL.dslate : PAL.night));
    const id = this.rows[i].id;
    const e = EQUIP[id];
    const lv = levelOf(this.save, id);
    this.detailTitle.setText(`${e.name} (${e.role})`);
    this.detail.setText(`${statLine(id, lv)}\n\n${e.desc}`);
  }

  private toggle(i: number): void {
    if (this.closed || this.scene.time.now - this.openedAt < 150) return;
    const id = this.rows[i].id;
    if (this.sel.includes(id)) {
      this.sel = this.sel.filter((x) => x !== id);
      sfx('ui_cancel');
    } else if (this.sel.length >= LOADOUT_SIZE) {
      this.msg.setText(`${LOADOUT_SIZE}개가 꽉 찼다. 먼저 하나를 빼자.`);
      sfx('ui_deny');
      return;
    } else {
      this.sel = [...this.sel, id];
      sfx('ui_ok');
    }
    this.msg.setText('');
    this.focus(i);
    this.refresh();
  }

  private finish(): void {
    if (this.closed) return;
    // 가진 장비가 없으면 고를 것도 없다: 바꾸지 않고 닫는다.
    if (this.save.owned.length === 0) {
      this.close();
      this.onDone(null);
      return;
    }
    const reason = validateLoadout(this.save, this.sel);
    if (reason) {
      this.msg.setText(reason);
      sfx('ui_deny');
      return;
    }
    this.close();
    this.onDone([...this.sel]);
  }

  key(k: UiKey): void {
    if (this.closed) return;
    const n = this.rows.length;
    if (n === 0) {
      if (k === 'ok' || k === 'cancel') this.finish();
      return;
    }
    if (k === 'up') this.focus((this.index + n - 1) % n);
    else if (k === 'down') this.focus((this.index + 1) % n);
    else if (k === 'ok') this.toggle(this.index);
    else if (k === 'cancel') this.finish();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.router.remove(this);
    this.root.destroy();
  }
}
