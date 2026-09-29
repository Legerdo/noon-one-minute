// 공용 UI: 입력 라우터(레이어 스택), 패널, 메뉴, 대화창, 확인창, 배너.
import Phaser from 'phaser';
import { sfx } from '../audio/audio';
import { PAL } from '../art/palette';
import { txt } from './text';

export type UiKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'cancel' | 'c' | '1' | '2' | '3' | '4' | '5';

const CODE_MAP: Record<string, UiKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  KeyZ: 'ok',
  Enter: 'ok',
  NumpadEnter: 'ok',
  Space: 'ok',
  KeyX: 'cancel',
  Escape: 'cancel',
  Backspace: 'cancel',
  KeyC: 'c',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Numpad1: '1',
  Numpad2: '2',
  Numpad3: '3',
  Numpad4: '4',
  Numpad5: '5',
};

export interface Layer {
  key(k: UiKey, repeat: boolean): void;
  /** 디버그·테스트용 이름. */
  layerName?: string;
}

/** 키 입력을 가장 위 레이어 하나에만 전달. 확정/취소는 키 반복(홀드)을 무시한다. */
export class InputRouter {
  private layers: Layer[] = [];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const onDown = (e: KeyboardEvent) => {
      const k = CODE_MAP[e.code];
      if (!k) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if ((k === 'ok' || k === 'cancel' || k === 'c') && e.repeat) return;
      const top = this.layers[this.layers.length - 1];
      top?.key(k, e.repeat);
    };
    kb.on('keydown', onDown);
    scene.events.once('shutdown', () => {
      kb.off('keydown', onDown);
      this.layers = [];
    });
  }

  push(l: Layer): void {
    this.layers.push(l);
  }

  remove(l: Layer): void {
    this.layers = this.layers.filter((x) => x !== l);
  }

  get depth(): number {
    return this.layers.length;
  }

  isTop(l: Layer): boolean {
    return this.layers[this.layers.length - 1] === l;
  }

  topName(): string {
    return this.layers[this.layers.length - 1]?.layerName ?? '';
  }
}

export type PanelKind = 'brass' | 'steel' | 'dark' | 'slot' | 'slotSel' | 'slotOff';

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, kind: PanelKind = 'brass'): Phaser.GameObjects.NineSlice {
  const p = scene.add.nineslice(Math.round(x), Math.round(y), `panel_${kind}`, undefined, Math.round(w), Math.round(h), 6, 6, 6, 6);
  p.setOrigin(0, 0);
  return p;
}

export interface MenuItem {
  label: string;
  disabled?: boolean;
  hint?: string;
}

/** 세로 메뉴. 키보드(위/아래/확정/취소) + 마우스(hover 포커스, 같은 항목에서 눌렀다 떼면 선택). */
export class Menu implements Layer {
  readonly layerName = 'menu';
  readonly root: Phaser.GameObjects.Container;
  private texts: Phaser.GameObjects.Text[] = [];
  private cursor: Phaser.GameObjects.Image;
  private pressed = -1;
  index = 0;
  private closed = false;
  private openedAt: number;

  constructor(
    private scene: Phaser.Scene,
    private router: InputRouter,
    x: number,
    y: number,
    private items: MenuItem[],
    private handlers: {
      select: (i: number) => void;
      cancel?: () => void;
      focus?: (i: number) => void;
    },
    opts: { width?: number; kind?: PanelKind; lineH?: number; title?: string; start?: number } = {},
  ) {
    const lineH = opts.lineH ?? 16;
    const width = opts.width ?? Math.max(90, ...items.map((i) => i.label.length * 12 + 34));
    const titleH = opts.title ? 16 : 0;
    const h = items.length * lineH + 12 + titleH;
    this.root = scene.add.container(Math.round(x), Math.round(y));
    this.root.add(panel(scene, 0, 0, width, h, opts.kind ?? 'brass'));
    if (opts.title) this.root.add(txt(scene, 10, 5, opts.title, { color: PAL.gold, font: 'small' }));
    items.forEach((it, i) => {
      const t = txt(scene, 20, 6 + titleH + i * lineH, it.label, { color: it.disabled ? PAL.slate : PAL.white });
      t.setInteractive({ useHandCursor: !it.disabled });
      t.on('pointerover', () => this.focus(i, true));
      t.on('pointerdown', () => (this.pressed = i));
      t.on('pointerup', () => {
        if (this.pressed === i && this.canAct()) this.choose(i);
        this.pressed = -1;
      });
      this.texts.push(t);
      this.root.add(t);
    });
    this.cursor = scene.add.image(10, 0, 'ic_cursor').setOrigin(0, 0);
    this.root.add(this.cursor);
    this.root.setDepth(1000).setScrollFactor(0);
    this.openedAt = scene.time.now;
    router.push(this);
    this.focus(Math.min(opts.start ?? 0, items.length - 1), false);
  }

  private canAct(): boolean {
    return !this.closed && this.router.isTop(this) && this.scene.time.now - this.openedAt > 150;
  }

  private focus(i: number, fromMouse: boolean): void {
    if (this.closed) return;
    if (fromMouse && !this.router.isTop(this)) return;
    if (i !== this.index) sfx('ui_move');
    this.index = i;
    const t = this.texts[i];
    this.cursor.setPosition(9, t.y + 3);
    this.texts.forEach((tx, k) => tx.setColor(k === i ? '#fee761' : this.items[k].disabled ? '#5a6988' : '#ffffff'));
    this.handlers.focus?.(i);
  }

  private choose(i: number): void {
    if (this.items[i].disabled) {
      sfx('ui_deny');
      return;
    }
    sfx('ui_ok');
    this.handlers.select(i);
  }

  key(k: UiKey): void {
    if (!this.canAct()) return;
    if (k === 'up') this.focus((this.index + this.items.length - 1) % this.items.length, false);
    else if (k === 'down') this.focus((this.index + 1) % this.items.length, false);
    else if (k === 'ok') this.choose(this.index);
    else if (k === 'cancel' && this.handlers.cancel) {
      sfx('ui_cancel');
      this.handlers.cancel();
    }
  }

  setLabel(i: number, s: string): void {
    this.texts[i]?.setText(s);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.router.remove(this);
    this.root.destroy();
  }
}

export interface Line {
  who: '하루' | '똑딱이' | '할아버지' | '녹' | '안내' | '';
  text: string;
}

const PORTRAIT: Record<string, string | null> = {
  하루: 'mk_player',
  똑딱이: 'ttok',
  할아버지: 'grandpa',
  녹: 'mk_enemy',
  안내: null,
  '': null,
};

/** 하단 대화창. say()는 모든 줄을 넘기면 끝난다. */
export class DialogBox implements Layer {
  readonly layerName = 'dialog';
  private root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Text;
  private name: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image;
  private more: Phaser.GameObjects.Image;
  private lines: Line[] = [];
  private li = 0;
  private shown = 0;
  private full = '';
  private timer?: Phaser.Time.TimerEvent;
  private done?: () => void;
  private openedAt = 0;
  active = false;

  constructor(
    private scene: Phaser.Scene,
    private router: InputRouter,
  ) {
    const W = 460;
    const H = 58;
    const x = 10;
    const y = 270 - H - 6;
    this.root = scene.add.container(x, y).setDepth(2000).setVisible(false).setScrollFactor(0);
    this.root.add(panel(scene, 0, 0, W, H, 'brass'));
    this.portrait = scene.add.image(26, 30, 'ttok', 0);
    this.root.add(this.portrait);
    this.name = txt(scene, 48, 6, '', { color: PAL.gold, font: 'bold' });
    this.body = txt(scene, 48, 22, '', { wrap: W - 60, lineSpacing: 3 });
    this.more = scene.add.image(W - 14, H - 10, 'ic_cursorDown').setOrigin(0.5, 0.5);
    this.root.add([this.name, this.body, this.more]);
    const zone = scene.add.zone(0, 0, W, H).setOrigin(0, 0).setInteractive();
    zone.on('pointerup', () => this.advance());
    this.root.add(zone);
    scene.tweens.add({ targets: this.more, y: H - 8, duration: 400, yoyo: true, repeat: -1 });
  }

  say(lines: Line[]): Promise<void> {
    return new Promise((resolve) => {
      this.lines = lines;
      this.li = 0;
      this.done = resolve;
      this.active = true;
      this.root.setVisible(true);
      this.openedAt = this.scene.time.now;
      this.router.push(this);
      this.show();
    });
  }

  private show(): void {
    const l = this.lines[this.li];
    this.name.setText(l.who);
    const tex = PORTRAIT[l.who];
    this.portrait.setVisible(!!tex);
    if (tex) this.portrait.setTexture(tex, tex === 'ttok' ? 0 : tex === 'grandpa' ? 'awake' : undefined);
    this.body.setX(tex ? 48 : 14);
    this.name.setX(tex ? 48 : 14);
    this.full = l.text;
    this.shown = 0;
    this.body.setText('');
    this.more.setVisible(false);
    this.timer?.remove();
    this.timer = this.scene.time.addEvent({
      delay: 22,
      loop: true,
      callback: () => {
        this.shown++;
        this.body.setText(this.full.slice(0, this.shown));
        if (this.shown % 3 === 0 && this.full[this.shown] !== ' ') sfx('talk');
        if (this.shown >= this.full.length) {
          this.timer?.remove();
          this.more.setVisible(true);
        }
      },
    });
  }

  private advance(): void {
    if (!this.active || !this.router.isTop(this)) return;
    if (this.scene.time.now - this.openedAt < 120) return;
    if (this.shown < this.full.length) {
      this.timer?.remove();
      this.shown = this.full.length;
      this.body.setText(this.full);
      this.more.setVisible(true);
      return;
    }
    this.li++;
    if (this.li >= this.lines.length) {
      this.active = false;
      this.root.setVisible(false);
      this.router.remove(this);
      const d = this.done;
      this.done = undefined;
      d?.();
      return;
    }
    this.show();
  }

  key(k: UiKey): void {
    if (k === 'ok' || k === 'cancel') this.advance();
  }
}

export function confirm(scene: Phaser.Scene, router: InputRouter, question: string, x = 150, y = 100): Promise<boolean> {
  return new Promise((resolve) => {
    // 확인 창은 어떤 오버레이(강화·장비 구성 등)보다도 위에 떠야 한다.
    const q = scene.add.container(0, 0).setDepth(4000).setScrollFactor(0);
    const w = Math.max(180, question.length * 12 + 24);
    q.add(panel(scene, x, y, w, 28, 'steel'));
    q.add(txt(scene, x + 12, y + 8, question));
    const m = new Menu(
      scene,
      router,
      x + 8,
      y + 30,
      [{ label: '예' }, { label: '아니오' }],
      {
        select: (i) => {
          m.close();
          q.destroy();
          resolve(i === 0);
        },
        cancel: () => {
          m.close();
          q.destroy();
          resolve(false);
        },
      },
      { width: 90, kind: 'steel' },
    );
    m.root.setDepth(4001);
  });
}

/** 화면 가운데 잠깐 뜨는 배너. */
export function banner(scene: Phaser.Scene, text: string, color: number = PAL.yellow, ms = 1100, y = 110): Promise<void> {
  return new Promise((resolve) => {
    const t = txt(scene, 240, y, text, { font: 'big', color, origin: [0.5, 0.5], shadow: PAL.ink });
    const w = Math.round(t.width + 28);
    const p = panel(scene, 240 - Math.round(w / 2), y - 13, w, 26, 'dark');
    t.setDepth(2101).setScrollFactor(0);
    p.setDepth(2100).setScrollFactor(0);
    t.setPosition(Math.round(240 - t.width / 2), Math.round(y - t.height / 2)).setOrigin(0, 0);
    p.setAlpha(0);
    t.setAlpha(0);
    scene.tweens.add({ targets: [p, t], alpha: 1, duration: 120 });
    scene.time.delayedCall(ms, () => {
      scene.tweens.add({
        targets: [p, t],
        alpha: 0,
        duration: 180,
        onComplete: () => {
          p.destroy();
          t.destroy();
          resolve();
        },
      });
    });
  });
}
