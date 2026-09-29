import Phaser from 'phaser';
import { playMusic, resumeMusic, sfx, unlockAudio } from '../audio/audio';
import { logoCanvas } from '../art/logo';
import { PAL } from '../art/palette';
import { addSingle } from '../art/textures';
import { MAPS } from '../data/maps';
import { newGame } from '../game/progress';
import { clearSave, hasSave, writeSave } from '../game/storage';
import { txt } from '../ui/text';
import { confirm, InputRouter, Menu, panel } from '../ui/widgets';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    this.add.image(0, 0, 'bg_title').setOrigin(0, 0);
    if (!this.textures.exists('logo')) addSingle(this, 'logo', logoCanvas('정오 1분 전', 'Galmuri14', 15, 3));
    const logo = this.add.image(124, 60, 'logo').setOrigin(0.5, 0.5);
    const sub = txt(this, 0, 100, '멈춘 시계탑 · 장비와 시간을 읽는 자', { font: 'small', color: PAL.cream, shadow: PAL.ink }).setDepth(2);
    sub.setX(Math.round(124 - sub.width / 2));
    panel(this, sub.x - 8, 96, Math.round(sub.width) + 16, 18, 'dark').setDepth(1);
    // 멈춘 먼지(시간이 멈춰 공중에 떠 있다)
    for (let i = 0; i < 26; i++) {
      const x = 20 + ((i * 97) % 440);
      const y = 20 + ((i * 53) % 200);
      this.add.image(x, y, 'mote_dust').setAlpha(0.7);
    }
    // 멈춘 분침이 가끔 떨린다
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        sfx('tick');
        this.tweens.add({ targets: logo, y: 63, duration: 60, yoyo: true });
      },
    });
    const router = new InputRouter(this);
    const has = hasSave();
    const items = [{ label: '처음부터' }, { label: '이어하기', disabled: !has }];
    const start = has ? 1 : 0;
    const unlock = () => {
      unlockAudio();
      playMusic('title');
      resumeMusic();
    };
    this.input.keyboard?.once('keydown', unlock);
    this.input.once('pointerdown', unlock);
    const m = new Menu(
      this,
      router,
      70,
      132,
      items,
      {
        select: async (i) => {
          unlock();
          if (i === 0) {
            if (has) {
              const ok = await confirm(this, router, '기록을 지우고 처음부터 할까?', 110, 190);
              if (!ok) return;
            }
            clearSave();
            const f1 = MAPS.f1;
            writeSave(newGame('f1', f1.start.x, f1.start.y));
          }
          m.close();
          this.cameras.main.fadeOut(300, 24, 20, 37);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('world', {}));
        },
      },
      { width: 104, start },
    );
    panel(this, 0, 248, 480, 22, 'dark');
    txt(this, 8, 254, '방향키·WASD 이동   Z·Enter 확정   X·Esc 취소/메뉴   전투 중 Shift 빨리감기', { font: 'small', color: PAL.silver });
    txt(this, 474, 256, 'Galmuri 글꼴(OFL)', { font: 'tiny', color: PAL.steel, origin: [1, 0] });
    playMusic('title');
    this.cameras.main.fadeIn(400, 24, 20, 37);
  }
}
