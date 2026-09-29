import Phaser from 'phaser';
import { playMusic, sfx } from '../audio/audio';
import { PAL } from '../art/palette';
import { withFlag } from '../game/progress';
import { loadSave, writeSave } from '../game/storage';
import { txt } from '../ui/text';
import { DialogBox, InputRouter, panel, type Layer } from '../ui/widgets';

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('ending');
  }

  async create(): Promise<void> {
    const s = loadSave();
    if (s) writeSave(withFlag(s, 'cleared'));
    this.add.image(0, 0, 'bg_ending').setOrigin(0, 0);
    const router = new InputRouter(this);
    const dialog = new DialogBox(this, router);
    const w = window as unknown as { __TT?: Record<string, unknown> };
    w.__TT = w.__TT ?? {};
    w.__TT.ending = { top: () => router.topName() };
    this.cameras.main.fadeIn(900, 255, 255, 255);
    // 날아오르는 새
    for (let i = 0; i < 6; i++) {
      const b = this.add.image(90 + i * 22, 110 + (i % 2) * 8, 'px2').setTint(PAL.ink);
      this.tweens.add({ targets: b, x: b.x + 180 + i * 10, y: b.y - 80 - i * 6, duration: 5000 + i * 400, delay: 800 + i * 200 });
    }
    // 탑 아래 광장의 하루, 할아버지, 똑딱이
    this.add.rectangle(0, 250, 300, 20, PAL.dbrown).setOrigin(0, 0);
    this.add.rectangle(0, 250, 300, 1, PAL.brown).setOrigin(0, 0);
    this.add.image(236, 252, 'haru_ow', 'r0').setOrigin(0.5, 1);
    this.add.image(258, 252, 'grandpa', 'awake').setOrigin(0.5, 1).setFlipX(true);
    const tt = this.add.image(226, 226, 'ttok', 0);
    let tf = 0;
    this.time.addEvent({ delay: 160, loop: true, callback: () => tt.setFrame((tf = (tf + 1) % 4)).setY(226 + [0, -1, -1, 0][tf]) });
    await this.wait(900);
    for (let k = 0; k < 3; k++) {
      sfx('bell');
      this.cameras.main.shake(120, 0.002);
      await this.wait(1100);
    }
    playMusic('ending');
    await dialog.say([
      { who: '안내', text: '댕— 댕— 댕— 정오의 종이 울리고, 멈춰 있던 마을이 한꺼번에 숨을 내쉰다.' },
      { who: '할아버지', text: '…하루야? 이 늙은 태엽이 한참 멈춰 있었구나.' },
      { who: '하루', text: '할아버지! 대진자가 녹에 먹혀서… 다 멈춰 버렸었어요.' },
      { who: '할아버지', text: '움직이지 않는 톱니가 먼저 녹슬지. 네가 다시 감아 주었구나. 고맙다.' },
      { who: '똑딱이', text: '째깍, 째깍! 시간이 흐른다! 이제 점심 먹으러 가자!' },
    ]);
    // 정오를 가리키는 문자판이 보이도록 왼쪽에 기록판을 둔다.
    const stats = this.add.container(0, 0).setDepth(3000);
    stats.add(panel(this, 16, 40, 240, 128, 'brass'));
    stats.add(txt(this, 30, 50, '정오 1분 전 — 끝', { font: 'big', color: PAL.yellow }));
    const mins = s ? Math.max(1, Math.round(s.playTime / 60)) : 0;
    const lines = [
      `플레이 시간  ${mins}분`,
      `전투  ${s?.battles ?? 0}회   패배  ${s?.losses ?? 0}회`,
      `최대 체력  ${s?.maxHp ?? 40}   남은 톱니  ${s?.gears ?? 0}`,
      '시간은 다시 흐른다.',
    ];
    lines.forEach((l, i) => stats.add(txt(this, 30, 76 + i * 16, l, { color: i === 3 ? PAL.gold : PAL.cream })));
    stats.add(txt(this, 244, 152, 'Z · 클릭: 타이틀로', { font: 'small', color: PAL.steel, origin: [1, 0] }));
    const opened = this.time.now;
    const done = () => {
      if (this.time.now - opened < 600) return;
      this.cameras.main.fadeOut(500, 24, 20, 37);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
    };
    const layer: Layer = { layerName: 'ending', key: (k) => (k === 'ok' || k === 'cancel' ? done() : undefined) };
    router.push(layer);
    this.input.on('pointerup', done);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }
}
