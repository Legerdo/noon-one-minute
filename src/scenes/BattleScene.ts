// 전투 장면. 논리는 BattleSession/엔진이 결정하고, 이 장면은 사건을 재생(Presenter)하며 입력을 명령으로 넘긴다.
import Phaser from 'phaser';
import { playMusic, sfx } from '../audio/audio';
import { STAGE_Y } from '../art/backgrounds';
import { ACTION_POSE, ENEMY_ART } from '../art/enemies';
import { PAL } from '../art/palette';
import type { Theme } from '../art/tiles';
import { EnemyView } from '../battle/enemyView';
import { FxKit } from '../battle/fxkit';
import { BattleHud, tlX, TL } from '../battle/hud';
import type { BattleEvent, BattleState } from '../core/types';
import { COACH } from '../data/coach';
import { buildLoadout, EQUIP, type EquipId } from '../data/equipment';
import { ENEMIES, type EnemyActionDef, type EnemyId } from '../data/enemies';
import { BattleSession, type Presenter } from '../game/battleSession';
import { Solver } from '../core/solver';
import { grantVictory, newGame, recordDefeat, withFlag, type Reward, type SaveData } from '../game/progress';
import { saveSettings, settings, SHAKE_NAMES, SPEED_NAMES } from '../game/settings';
import { loadSave, writeSave } from '../game/storage';
import { HaruRig, preparePose } from '../ui/haruRig';
import { LoadoutPanel } from '../ui/loadout';
import { txt } from '../ui/text';
import { banner, confirm, DialogBox, InputRouter, Menu, panel, type Layer, type Line, type UiKey } from '../ui/widgets';
import { applyVolumes } from '../audio/audio';

export interface BattleData {
  enemyId: EnemyId;
  theme: Theme;
}

const PX = 150;
const TICK_MS = 95;
const MATERIAL: Record<EnemyId, 'brass' | 'steel' | 'rust' | 'wood'> = {
  dummy: 'wood',
  rat: 'steel',
  sentry: 'brass',
  knight: 'steel',
  swarm: 'brass',
  tortoise: 'steel',
  hexer: 'rust',
  boss: 'brass',
};

export class BattleScene extends Phaser.Scene implements Presenter {
  private bd!: BattleData;
  private save!: SaveData;
  private session!: BattleSession;
  private hud!: BattleHud;
  private fx!: FxKit;
  private stage!: Phaser.GameObjects.Container;
  private rig!: HaruRig;
  private ttok!: Phaser.GameObjects.Image;
  private warnMark!: Phaser.GameObjects.Image;
  private enemy!: EnemyView;
  private router!: InputRouter;
  private dialog!: DialogBox;
  private enabled: boolean[] = [];
  private focusIdx = 0;
  private selectTurn: number | null = null;
  private selectOpenedAt = 0;
  private tutorial = false;
  private tutStep = 0;
  private tutLock: number | null = null;
  private tutSolver: Solver | null = null;
  private tutHint: Phaser.GameObjects.Container | null = null;
  private pressedSlot = -1;
  private playerEquip: EquipId | null = null;
  private playerWaitTotal = 0;
  private view = { pWait: null as number | null, eWait: null as number | null, time: 0 };
  private coachQueue: Line[][] = [];
  private localFlags = new Set<string>();
  private resultDone = false;
  private idleT = 0;
  private idleFrame = 0;
  private blinkAt = 0;
  private fastKeys: Phaser.Input.Keyboard.Key[] = [];
  private enemyHome = { x: 334, y: STAGE_Y };
  private busyOverlay = false;
  private menuOpen = false;

  constructor() {
    super('battle');
  }

  init(data: BattleData): void {
    this.bd = data;
    this.enabled = [];
    this.focusIdx = 0;
    this.selectTurn = null;
    this.pressedSlot = -1;
    this.playerEquip = null;
    this.view = { pWait: null, eWait: null, time: 0 };
    this.coachQueue = [];
    this.localFlags = new Set();
    this.resultDone = false;
    this.busyOverlay = false;
    this.menuOpen = false;
    this.tutorial = false;
    this.tutStep = 0;
    this.tutLock = null;
    this.tutSolver = null;
    this.tutHint = null;
  }

  create(): void {
    const id = this.bd.enemyId;
    this.save = loadSave() ?? { ...newGame('f1', 0, 0), owned: ['dagger', 'buckler'], loadout: ['dagger', 'buckler'] };
    const def = ENEMIES[id];
    const loadout = buildLoadout(this.save.loadout, this.save.levels);
    // 첫 전투(연습 인형 또는 태엽 쥐)는 추천 행동만 고를 수 있는 안내 전투.
    this.tutorial = (id === 'rat' || id === 'dummy') && !this.save.flags.includes('tut_done');

    this.stage = this.add.container(0, 0);
    this.stage.add(this.add.image(0, 0, `bg_${this.bd.theme}`).setOrigin(0, 0));
    this.addBackgroundGears();

    if (id === 'boss') this.enemyHome = { x: 358, y: 194 };
    else this.enemyHome = { x: 334, y: STAGE_Y };
    // 그림자
    const shadowG = this.add.graphics();
    shadowG.fillStyle(PAL.ink, 0.45);
    shadowG.fillEllipse(PX + 2, STAGE_Y + 1, 30, 6);
    if (id !== 'boss') shadowG.fillEllipse(this.enemyHome.x, STAGE_Y + 1, Math.min(70, ENEMY_ART[id].w * 0.8), 7);
    this.stage.add(shadowG);

    this.enemy = new EnemyView(this, this.stage, id, this.enemyHome.x, this.enemyHome.y);
    this.rig = new HaruRig(this, PX, STAGE_Y);
    this.stage.add(this.rig.root);
    this.ttok = this.add.image(PX - 24, STAGE_Y - 46, 'ttok', 0);
    this.stage.add(this.ttok);
    this.warnMark = this.add.image(0, 0, 'ic_warn').setVisible(false);
    this.stage.add(this.warnMark);
    this.tweens.add({ targets: this.warnMark, alpha: 0.35, duration: 240, yoyo: true, repeat: -1 });
    const fxLayer = this.add.container(0, 0);
    this.stage.add(fxLayer);
    this.fx = new FxKit(this, fxLayer);

    this.hud = new BattleHud(this, loadout, this.save.levels, def.name);
    this.hud.playerHp(this.save.maxHp, this.save.maxHp, false);
    this.hud.enemyHp(def.maxHp, def.maxHp, false);
    this.hud.playerState(0, '행동 없음');
    this.hud.setSelecting(false);
    this.hud.log(`${def.name} — ${def.title}`);

    this.router = new InputRouter(this);
    this.dialog = new DialogBox(this, this.router);
    this.router.push(this.battleLayer);
    this.bindSlots();
    const kb = this.input.keyboard!;
    this.fastKeys = [kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT), kb.addKey(Phaser.Input.Keyboard.KeyCodes.F)];

    this.session = new BattleSession({ enemy: def, loadout, playerMaxHp: this.save.maxHp }, this);
    this.session.onSelect = (turn) => this.openSelection(turn);
    this.session.onEnd = (r) => void this.onEnd(r);
    this.events.once('shutdown', () => this.session.dispose());

    playMusic(id === 'boss' ? 'boss' : 'battle');
    this.exposeDebug();
    this.cameras.main.fadeIn(220, 24, 20, 37);
    void this.session.begin();
  }

  private addBackgroundGears(): void {
    const spots: [string, number, number, number][] =
      this.bd.theme === 'summit'
        ? [
            ['bggear_brass', 30, 150, 1],
            ['bggear_brass', 452, 140, -1],
          ]
        : [
            ['bggear_big', 18, 96, 1],
            ['bggear_mid', 462, 70, -1],
            ['bggear_mid', 250, 16, 1],
          ];
    for (const [key, x, y, dir] of spots) {
      const g = this.add.image(x, y, key, 0);
      this.stage.add(g);
      let f = 0;
      this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          f = (f + (dir > 0 ? 1 : 7)) % 8;
          g.setFrame(f);
        },
      });
    }
  }

  // ───────────────────────── 입력 ─────────────────────────
  private battleLayer: Layer = {
    layerName: 'battle',
    key: (k: UiKey) => this.onKey(k),
  };

  private onKey(k: UiKey): void {
    if (this.busyOverlay) return;
    if (!this.hud.isSelecting) return;
    const n = this.hud.slots.length;
    if (k === 'left') this.moveFocus((this.focusIdx + n - 1) % n);
    else if (k === 'right') this.moveFocus((this.focusIdx + 1) % n);
    else if (k === 'up' || k === 'down') return;
    else if (k >= '1' && k <= '5') {
      const i = Number(k) - 1;
      if (i < n) this.moveFocus(i);
    } else if (k === 'ok') this.tryCommit(this.focusIdx);
    else if (k === 'cancel') this.openMenu();
  }

  private bindSlots(): void {
    this.hud.slots.forEach((sl, i) => {
      sl.zone.on('pointerover', () => {
        if (this.hud.isSelecting && !this.busyOverlay && this.router.isTop(this.battleLayer)) this.moveFocus(i);
      });
      sl.zone.on('pointerdown', () => (this.pressedSlot = i));
      sl.zone.on('pointerup', () => {
        if (this.pressedSlot === i && !this.busyOverlay && this.router.isTop(this.battleLayer)) this.tryCommit(i);
        this.pressedSlot = -1;
      });
    });
  }

  private openSelection(turn: number): void {
    this.selectTurn = turn;
    const st = this.session.state;
    this.enabled = this.hud.slots.map((sl) => this.session.engine.cannotCommit(st, sl.act.id) === null);
    if (!this.enabled[this.focusIdx]) this.focusIdx = Math.max(0, this.enabled.indexOf(true));
    this.tutLock = null;
    if (this.tutorial) this.guideSelection();
    this.hud.setSelecting(true);
    this.selectOpenedAt = this.time.now;
    this.moveFocus(this.focusIdx, true);
    this.hud.playerState(0, '행동 선택 중');
  }

  // ───────────────────────── 첫 전투 안내(강제 선택) ─────────────────────────
  private static readonly TUT_STEPS = 5;

  /** 추천 행동 하나만 열어 두고, 왜 그걸 고르는지 한 줄로 설명한다. */
  private guideSelection(): void {
    if (this.tutStep >= BattleScene.TUT_STEPS) {
      this.tutorial = false;
      this.localFlags.add('tut_done');
      this.showTutHint('이제 네가 직접 골라 봐! 커서를 옮기면 오른쪽에 확실한 결과가 보여.', null);
      this.time.delayedCall(4200, () => this.hideTutHint());
      return;
    }
    this.tutSolver = this.tutSolver ?? new Solver(this.session.engine, 1_000_000);
    const rec = this.tutSolver.best(this.session.state as BattleState).id;
    const idx = rec ? this.hud.slots.findIndex((s) => s.act.id === rec) : -1;
    if (idx < 0) return;
    this.enabled = this.enabled.map((_, k) => k === idx);
    this.focusIdx = idx;
    this.tutLock = idx;
    this.showTutHint(this.explain(rec!), idx);
  }

  private explain(id: string): string {
    const e = EQUIP[id as EquipId];
    const pv = this.session.preview(id);
    if (!pv.ok) return `${e.name}을(를) 골라 보자.`;
    const ef = pv.enemyFirst;
    const step = `(${this.tutStep + 1}/${BattleScene.TUT_STEPS})`;
    if (e.kind === 'guard') {
      if (ef?.damage) {
        const when = ef.at === 0 ? '곧바로' : `${ef.at}틱 뒤`;
        const res = ef.damage.amount === 0 ? '피해 0으로 막아 낼 수 있어' : `피해를 ${ef.damage.amount}로 줄일 수 있어`;
        return `${step} 적 「${ef.act.name}」이 ${when} 들어와! ${e.short}(방어 ${pv.defense})를 들면 ${res}.`;
      }
      return `${step} 위험한 공격이 다가와. ${e.short}로 몸을 지키자.`;
    }
    if (pv.mine?.damage) {
      const d = pv.mine.damage;
      const kill = d.lethal ? ' 이걸로 쓰러뜨릴 수 있어!' : '';
      if (!ef || !ef.damage) return `${step} ${e.short}은 대기 ${pv.wait} — 적보다 먼저 끝나. 지금 찌르면 피해 ${d.amount}!${kill}`;
      return `${step} 적 공격(피해 ${ef.damage.amount})을 받아도, ${pv.mine.at}틱 뒤 ${e.short}이 피해 ${d.amount}를 준다.${kill}`;
    }
    return `${step} ${e.name}을(를) 골라 보자. 오른쪽 칸에서 결과를 확인해.`;
  }

  private showTutHint(text: string, slot: number | null): void {
    this.hideTutHint();
    const c = this.add.container(0, 0).setDepth(150);
    const W = 300;
    const body = txt(this, 0, 0, text, { font: 'small', color: PAL.cream, wrap: W - 34, lineSpacing: 3 });
    const h = Math.round(body.height) + 12;
    const x = 90;
    const y = 88;
    c.add(panel(this, x, y, W, h, 'brass'));
    c.add(this.add.image(x + 14, y + h / 2, 'ttok', 0));
    body.setPosition(x + 28, y + 6);
    c.add(body);
    if (slot !== null) {
      const sl = this.hud.slots[slot];
      const ax = sl.root.x + 24;
      const arrow = this.add.image(ax, 192, 'ic_cursorDown').setScale(2).setOrigin(0.5, 1);
      const label = txt(this, ax, 178, '이걸 골라!', { font: 'bold', color: PAL.yellow, shadow: PAL.ink });
      label.setX(Math.round(ax - label.width / 2)).setY(Math.round(178 - label.height));
      c.add([arrow, label]);
      this.tweens.add({ targets: arrow, y: 196, duration: 280, yoyo: true, repeat: -1 });
    }
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    this.tutHint = c;
  }

  private hideTutHint(): void {
    this.tutHint?.destroy();
    this.tutHint = null;
  }

  /** 잠긴 슬롯을 고르려 할 때: 추천 슬롯을 흔들어 알려 준다. */
  private nudgeTut(): void {
    sfx('ui_deny');
    if (this.tutLock === null) return;
    const root = this.hud.slots[this.tutLock].root;
    const x0 = root.x;
    this.tweens.add({ targets: root, x: x0 + 2, duration: 40, yoyo: true, repeat: 2, onComplete: () => (root.x = x0) });
  }

  private moveFocus(i: number, silent = false): void {
    if (this.tutLock !== null && i !== this.tutLock) {
      if (!silent) this.nudgeTut();
      i = this.tutLock;
    }
    if (!silent && i !== this.focusIdx) sfx('ui_move');
    this.focusIdx = i;
    this.hud.focusSlot(i, this.enabled);
    const sl = this.hud.slots[i];
    // 미리보기: 상태를 바꾸지 않는 순수 계산(엔진 commit 복제 실행).
    const pv = this.session.preview(sl.act.id);
    this.hud.showPreview(pv, sl.act.id, null);
  }

  private tryCommit(i: number): void {
    if (!this.hud.isSelecting || this.selectTurn === null) return;
    if (this.time.now - this.selectOpenedAt < 200) return; // 더블 클릭·연타 방지
    if (!this.enabled[i]) {
      if (this.tutLock !== null) this.nudgeTut();
      else sfx('ui_deny');
      return;
    }
    const id = this.hud.slots[i].act.id;
    const turn = this.selectTurn;
    this.focusIdx = i;
    if (this.tutLock !== null) {
      this.tutStep++;
      this.tutLock = null;
      this.hideTutHint();
    }
    // 먼저 선택 창을 닫아 두 번째 입력이 들어갈 틈을 없앤다.
    this.hud.setSelecting(false);
    this.selectTurn = null;
    const ok = this.session.request(id, turn);
    if (!ok) {
      sfx('ui_deny');
      // 거부되면(이미 처리됨 등) 다시 열지 않는다: 세션이 다음 선택 창을 연다.
    }
  }

  private openMenu(): void {
    if (this.menuOpen) return;
    this.menuOpen = true;
    const items = () => [
      { label: '계속하기' },
      { label: `전투 속도: ${SPEED_NAMES[settings.speed]}` },
      { label: `화면 흔들림: ${SHAKE_NAMES[settings.shake]}` },
      { label: `효과음: ${Math.round(settings.sfx * 100)}%` },
      { label: `음악: ${Math.round(settings.music * 100)}%` },
      { label: '전투 규칙 보기' },
      { label: '후퇴하기' },
    ];
    const m = new Menu(
      this,
      this.router,
      160,
      60,
      items(),
      {
        select: async (i) => {
          if (i === 0) {
            m.close();
            this.menuOpen = false;
          } else if (i === 1) {
            settings.speed = ((settings.speed % 3) + 1) as 1 | 2 | 3;
            m.setLabel(1, items()[1].label);
          } else if (i === 2) {
            settings.shake = ((settings.shake + 1) % 3) as 0 | 1 | 2;
            m.setLabel(2, items()[2].label);
          } else if (i === 3) {
            settings.sfx = settings.sfx >= 1 ? 0 : Math.round((settings.sfx + 0.2) * 10) / 10;
            applyVolumes();
            m.setLabel(3, items()[3].label);
          } else if (i === 4) {
            settings.music = settings.music >= 1 ? 0 : Math.round((settings.music + 0.2) * 10) / 10;
            applyVolumes();
            m.setLabel(4, items()[4].label);
          } else if (i === 5) {
            await this.dialog.say([
              { who: '똑딱이', text: '장비를 고르면 그게 행동이 돼. 대기(틱)가 0이 될 때 효과가 나고, 기다리는 동안엔 그 장비의 방어로 버텨.' },
              { who: '똑딱이', text: '표식이 "지금"에 먼저 닿는 쪽이 먼저 움직여. 동시면 네가 먼저야.' },
              { who: '똑딱이', text: '피해 = 위력 - 받는 쪽의 현재 방어. 관통은 방어를 무시해.' },
              { who: '똑딱이', text: '한 번 고른 행동은 끝날 때까지 못 바꿔. 네가 고르는 동안 시간은 흐르지 않아.' },
            ]);
          } else if (i === 6) {
            const yes = await confirm(this, this.router, '물러날까? (잃는 것은 없다)', 150, 150);
            if (yes) {
              m.close();
              this.menuOpen = false;
              this.retreat();
            }
          }
          saveSettings();
        },
        cancel: () => {
          m.close();
          this.menuOpen = false;
        },
      },
      { width: 170, title: '전투 메뉴' },
    );
  }

  update(_t: number, dt: number): void {
    this.fx.fast = this.fastKeys.some((k) => k.isDown) ? 3 : 1;
    this.enemy.update(dt);
    this.idleT += dt;
    if (this.idleT > 170) {
      this.idleT = 0;
      this.idleFrame = (this.idleFrame + 1) % 4;
      this.ttok.setFrame(this.idleFrame);
      this.ttok.y = STAGE_Y - 46 + [0, -1, -1, 0][this.idleFrame];
      if (this.playerEquip === null && this.rig.pose.startsWith('idle')) {
        const blink = this.time.now > this.blinkAt && this.time.now < this.blinkAt + 160;
        if (this.time.now > this.blinkAt + 160) this.blinkAt = this.time.now + 2400 + Math.random() * 2400;
        this.rig.set(`idle${this.idleFrame}` as 'idle0', null, blink);
      }
    }
  }

  // ───────────────────────── 사건 재생 ─────────────────────────
  async play(ev: BattleEvent, state: Readonly<BattleState>): Promise<void> {
    void state;
    switch (ev.t) {
      case 'start':
        return this.playStart();
      case 'intent':
        return this.playIntent(ev);
      case 'commit':
        return this.playCommit(ev);
      case 'advance':
        return this.playAdvance(ev);
      case 'resolve':
        return this.playResolve(ev);
      case 'damage':
        return this.playDamage(ev);
      case 'heal':
        return this.playHeal(ev);
      case 'delay':
        return this.playDelay(ev);
      case 'death':
        return this.playDeath(ev);
      case 'release':
        return this.playRelease(ev);
      case 'await':
        return this.flushCoach();
      case 'end':
        return;
    }
  }

  private async playStart(): Promise<void> {
    const def = ENEMIES[this.bd.enemyId];
    this.rig.root.x = PX - 60;
    this.enemy.root.x = this.enemyHome.x + 60;
    void this.fx.tween({ targets: this.rig.root, x: PX, duration: 280, ease: 'Quad.easeOut' });
    void this.fx.tween({ targets: this.enemy.root, x: this.enemyHome.x, duration: 280, ease: 'Quad.easeOut' });
    await banner(this, `VS  ${def.name}`, PAL.pink, 700, 118);
    if (this.tutorial) this.coach('intro');
    if (this.save.owned.includes('hammer') && this.bd.enemyId === 'knight') this.coach('heavyFirst');
    if (this.save.loadout.includes('wedge')) this.coach('wedge');
  }

  private enemyAct(id: string): EnemyActionDef {
    return ENEMIES[this.bd.enemyId].actions[id];
  }

  private async playIntent(ev: Extract<BattleEvent, { t: 'intent' }>): Promise<void> {
    const a = this.enemyAct(ev.act);
    this.view.eWait = ev.wait;
    this.hud.setEnemyMarker(ev.wait);
    const pose = ACTION_POSE[this.bd.enemyId][ev.act]?.[0] ?? 'idle';
    this.enemy.setPose(pose);
    if (this.bd.enemyId === 'swarm') {
      this.enemy.setSwarm(ev.act === 'scatter' ? 'wide' : ev.act === 'storm' ? 'tight' : ev.act === 'regroup' ? 'drift' : 'loose');
    }
    this.hud.enemyDef(a.defense);
    const danger = (a.kind === 'attack' && a.effect >= 15) || !!a.pierce;
    this.hud.showIntent(a, danger);
    // 무대 위 표식: 위험한 동작이면 적 머리 위에 경고가 깜빡인다.
    const top = Math.max(96, this.enemy.top());
    this.warnMark.setPosition(this.enemyHome.x, top - 8).setVisible(danger);
    if (ev.banner) {
      sfx('phase');
      this.fx.screenFlash(PAL.hotred, 220, 0.35);
      this.fx.shake(this.stage, 4, -1);
      await banner(this, ev.banner, PAL.hotred, 900, 118);
    }
    sfx(danger ? 'danger' : 'enemy_intent');
    if (a.pierce) this.coach('pierce');
    if (a.delay) this.coach('pdelay');
    if (this.bd.enemyId === 'rat' && ev.act === 'wind') this.coach('wind');
    if (a.kind === 'guard' && a.defense >= 12) this.coach('enemyGuard');
    await this.fx.wait(160);
  }

  private async playCommit(ev: Extract<BattleEvent, { t: 'commit' }>): Promise<void> {
    const eq = ev.act as EquipId;
    this.playerEquip = eq;
    this.playerWaitTotal = ev.wait;
    this.view.pWait = ev.wait;
    this.hud.setPlayerMarker(ev.wait);
    this.hud.playerState(ev.defense, `${EQUIP[eq].name} 준비`);
    if (ev.usesLeft != null) this.hud.setUses(eq, ev.usesLeft);
    this.rig.set(preparePose(eq, ev.wait, ev.wait), eq);
    const kind = EQUIP[eq].kind;
    if (kind === 'guard') {
      sfx('commit_guard');
      this.fx.burst('fx_dust', 3, PX - 6, STAGE_Y - 2, 60);
    } else if (eq === 'hammer') sfx('windup_heavy');
    else sfx('commit');
    await this.fx.tween({ targets: this.rig.root, y: STAGE_Y + 1, duration: 60, yoyo: true });
    this.rig.root.y = STAGE_Y;
    this.hud.log(`하루: 「${EQUIP[eq].name}」 준비 (${ev.wait}틱)`);
    await this.fx.wait(90);
  }

  private async playAdvance(ev: Extract<BattleEvent, { t: 'advance' }>): Promise<void> {
    const ms = this.fx.d(TICK_MS);
    const p0 = this.view.pWait;
    const e0 = this.view.eWait;
    await this.hud.flow(p0, e0, ev.dt, ms, (k) => {
      sfx('tick');
      this.hud.setTime(this.view.time + k);
      if (this.playerEquip && p0 !== null) this.rig.set(preparePose(this.playerEquip, p0 - k, this.playerWaitTotal), this.playerEquip);
    });
    this.view.time = ev.time;
    this.view.pWait = p0 === null ? null : ev.pWait;
    this.view.eWait = e0 === null ? null : ev.eWait;
  }

  private haruHit(): { x: number; y: number } {
    return { x: this.rig.root.x + 2, y: this.rig.root.y - 16 };
  }

  private async playResolve(ev: Extract<BattleEvent, { t: 'resolve' }>): Promise<void> {
    if (ev.side === 'player') return this.playerStrike(ev.act as EquipId);
    return this.enemyStrike(ev.act, ev.immediate);
  }

  private async playerStrike(eq: EquipId): Promise<void> {
    const hit = this.enemy.hitPoint();
    const contactX = Math.max(PX + 30, hit.x - 30);
    const kind = EQUIP[eq].kind;
    this.hud.log(`하루의 「${EQUIP[eq].name}」!`);
    if (kind === 'guard') {
      this.rig.set('idle0', eq);
      await this.fx.wait(80);
      return;
    }
    if (kind === 'heal') {
      this.rig.set('cheer', eq);
      await this.fx.wait(120);
      return;
    }
    if (eq === 'wedge') {
      this.rig.set('cast', eq);
      sfx('swish');
      const h = this.rig.handWorld();
      const proj = this.add.image(h.x, h.y, 'wpn_wedge', 'r');
      this.stage.add(proj);
      await this.fx.tween({ targets: proj, x: hit.x, y: hit.y, duration: 150, ease: 'Quad.easeIn' });
      proj.destroy();
      return;
    }
    if (eq === 'hammer') {
      this.rig.set('windupHi', eq);
      await this.fx.wait(70);
      sfx('swish_heavy');
      await this.fx.tween({ targets: this.rig.root, x: contactX - 6, y: STAGE_Y - 18, duration: 120, ease: 'Sine.easeOut' });
      this.rig.set('slam', eq);
      await this.fx.tween({ targets: this.rig.root, y: STAGE_Y, duration: 60, ease: 'Quad.easeIn' });
      this.fx.burst('fx_slash_big', 3, hit.x - 4, hit.y, 45);
      this.fx.burst('fx_dust', 3, contactX + 18, STAGE_Y - 3, 70);
      this.fx.burst('fx_dust', 3, contactX + 2, STAGE_Y - 3, 70);
      return;
    }
    // 단검·장검·송곳: 준비 동작 → 돌진 → 접촉
    this.rig.set(eq === 'sword' ? 'ready' : 'readyLow', eq);
    await this.fx.tween({ targets: this.rig.root, x: PX - 3, duration: eq === 'dagger' ? 35 : 55 });
    sfx('swish');
    this.rig.set('strike', eq);
    await this.fx.tween({ targets: this.rig.root, x: contactX, duration: eq === 'dagger' ? 70 : eq === 'sword' ? 95 : 105, ease: 'Quad.easeIn' });
    if (eq === 'sword') this.fx.burst('fx_slash', 3, hit.x - 2, hit.y, 40);
    else if (eq === 'awl') this.fx.burst('fx_pierce', 2, hit.x - 14, hit.y, 60);
    else this.fx.burst('fx_thrust', 2, hit.x - 12, hit.y, 40);
  }

  private async enemyStrike(actId: string, immediate: boolean): Promise<void> {
    const a = this.enemyAct(actId);
    const id = this.bd.enemyId;
    const pose = ACTION_POSE[id][actId]?.[1] ?? 'idle';
    this.hud.log(`${ENEMIES[id].name}의 「${a.name}」!`);
    if (immediate) {
      this.fx.popup(tlX(0), 44, '동시!', PAL.cyan, false);
      this.coach('tie');
    }
    if (a.kind !== 'attack') {
      this.enemy.setPose(pose);
      await this.fx.wait(90);
      return;
    }
    const target = this.haruHit();
    this.enemy.setPose(pose);
    const melee = ['poke', 'bite', 'dash', 'thrust', 'slam', 'headbutt', 'spin'].includes(a.anim) || (id === 'knight' && a.anim !== 'guard');
    if (id === 'swarm') {
      if (a.anim === 'storm') {
        sfx('storm');
        this.enemy.beeStrike(12, target.x, target.y, this.fx.d(420));
        this.fx.burst('fx_storm', 4, target.x, target.y, 70);
        await this.fx.wait(260);
      } else {
        sfx('sting');
        this.enemy.beeStrike(3, target.x, target.y, this.fx.d(200));
        await this.fx.wait(110);
      }
      return;
    }
    if (melee) {
      const half = Math.round(ENEMY_ART[id].w * 0.32);
      const destX = PX + 22 + half;
      const dur = a.anim === 'dash' ? 70 : a.effect >= 15 ? 150 : 100;
      await this.fx.tween({ targets: this.enemy.root, x: this.enemyHome.x + 4, duration: a.effect >= 15 ? 90 : 40 });
      sfx(a.effect >= 15 ? 'swish_heavy' : a.anim === 'bite' ? 'bite' : 'swish');
      await this.fx.tween({ targets: this.enemy.root, x: destX, duration: dur, ease: 'Quad.easeIn' });
      if (a.anim === 'slam' || a.anim === 'quake' || a.effect >= 15) {
        this.fx.burst('fx_slash_big', 3, target.x + 6, target.y, 45, { flipX: true });
        this.fx.burst('fx_dust', 3, target.x + 10, STAGE_Y - 3, 70);
      } else if (a.anim === 'swing') this.fx.burst('fx_slash', 3, target.x + 4, target.y, 40, { flipX: true });
      return;
    }
    // 원거리·보스 동작
    switch (a.anim) {
      case 'bolt':
      case 'curse': {
        sfx('bolt');
        const from = this.enemy.hitPoint();
        const b = this.add.image(from.x - 14, from.y - 6, 'fx_bolt', 0);
        this.stage.add(b);
        await this.fx.tween({ targets: b, x: target.x + 4, y: target.y, duration: 150, ease: 'Quad.easeIn' });
        b.destroy();
        return;
      }
      case 'rain': {
        sfx('bolt');
        for (let k = 0; k < 5; k++) {
          const b = this.add.image(target.x - 20 + k * 10, 60, 'fx_bolt', k % 2).setAngle(90);
          this.stage.add(b);
          void this.fx.tween({ targets: b, y: target.y - 4 + (k % 2) * 6, duration: 160 + k * 25, ease: 'Quad.easeIn' }).then(() => b.destroy());
        }
        await this.fx.wait(260);
        return;
      }
      case 'bell': {
        sfx('bell');
        const c = this.enemy.hitPoint();
        this.fx.burst('fx_wave', 4, c.x, c.y + 40, 90);
        this.fx.screenFlash(PAL.plum, 260, 0.4);
        await this.fx.wait(320);
        this.fx.burst('fx_wave', 4, target.x, target.y, 70);
        return;
      }
      case 'burst': {
        sfx('steam');
        const c = this.enemy.hitPoint();
        this.fx.debris('mote_rust', c.x - 40, c.y, 16, { spread: 60, up: 10, dir: -1, life: 380, gravity: 20 });
        await this.fx.wait(160);
        return;
      }
      case 'swing':
      case 'quake':
      case 'frenzy': {
        sfx(a.anim === 'frenzy' ? 'swish' : 'swish_heavy');
        await this.fx.wait(a.anim === 'frenzy' ? 50 : 110);
        this.fx.burst(a.anim === 'frenzy' ? 'fx_slash' : 'fx_slash_big', 3, target.x + 6, target.y, 45, { flipX: true });
        if (a.anim === 'quake') {
          for (let k = 0; k < 5; k++) this.fx.burst('fx_dust', 3, this.enemyHome.x - 40 - k * 36, STAGE_Y - 3, 60);
        }
        return;
      }
      default:
        await this.fx.wait(80);
    }
  }

  private async playDamage(ev: Extract<BattleEvent, { t: 'damage' }>): Promise<void> {
    const stop = ev.lethal ? 210 : ev.big ? 130 : ev.result === 'full' ? 55 : 75;
    if (ev.target === 'enemy') {
      const hit = this.enemy.hitPoint();
      const mat = MATERIAL[this.bd.enemyId];
      this.enemy.frozen = true;
      if (ev.result === 'full') {
        sfx('block_partial');
        this.fx.burst('fx_block', 3, hit.x - 8, hit.y, 45);
        this.fx.popup(hit.x, hit.y - 14, '막힘', PAL.steel, false, `방어 ${ev.defense}`);
        this.fx.shake(this.stage, 1, 1);
      } else {
        const heavy = ev.big || ev.lethal;
        sfx(ev.result === 'pierce' ? 'pierce' : heavy ? 'hit_heavy' : this.playerEquip === 'dagger' ? 'hit_light' : mat === 'wood' ? 'hit_light' : 'hit_metal');
        if (ev.result !== 'pierce') this.fx.burst(heavy ? 'fx_spark_hot' : 'fx_spark', 3, hit.x - 6, hit.y, 40);
        if (ev.result === 'partial') this.fx.burst('fx_block', 3, hit.x - 10, hit.y, 45);
        this.fx.flash(this.enemy.images, heavy ? 90 : 55);
        this.fx.debris(`fx_shard_${mat}`, hit.x, hit.y, heavy ? 9 : 4, { dir: 1, spread: heavy ? 70 : 40, up: heavy ? 50 : 30 });
        const col = ev.result === 'pierce' ? PAL.magenta : heavy ? PAL.yellow : PAL.white;
        const label = ev.result === 'pierce' ? `관통 ${ev.amount}` : String(ev.amount);
        this.fx.popup(hit.x, hit.y - 14, label, col, heavy, ev.result === 'partial' ? `방어 -${ev.defense}` : undefined);
        this.fx.shake(this.stage, heavy ? 5 : 2, 1);
        if (heavy) this.fx.screenFlash(PAL.white, 70, 0.25);
        if (this.bd.enemyId !== 'swarm') this.enemy.setPose('hurt');
        this.enemy.root.x += heavy ? 6 : 3;
      }
      this.hud.enemyHp(ev.hp, ev.maxHp);
      await this.fx.wait(stop);
      this.enemy.frozen = false;
      await this.fx.wait(90);
      return;
    }
    // 하루가 맞음
    const h = this.haruHit();
    const shield = this.playerEquip === 'buckler' || this.playerEquip === 'tower';
    const hand = this.rig.handWorld();
    const fxAt = shield ? hand : { x: h.x + 8, y: h.y };
    this.enemy.frozen = true;
    if (ev.result === 'full') {
      sfx('block_full');
      this.fx.burst('fx_block_full', 3, fxAt.x + 2, fxAt.y, 50);
      this.fx.burst('fx_spark', 3, fxAt.x + 6, fxAt.y - 2, 40);
      this.fx.popup(h.x, h.y - 20, '막음!', PAL.cyan, false, `방어 ${ev.defense}`);
      this.fx.shake(this.stage, 1, -1);
      this.rig.root.x -= 1;
      this.coach('fullblock');
    } else if (ev.result === 'partial') {
      sfx('block_partial');
      this.fx.burst('fx_block', 3, fxAt.x + 2, fxAt.y, 45);
      this.fx.flash(this.rigImages(), 50);
      this.fx.popup(h.x, h.y - 20, String(ev.amount), ev.big ? PAL.hotred : PAL.red, ev.big, `방어 -${ev.defense}`);
      this.fx.shake(this.stage, ev.big ? 4 : 2, -1);
      if (!shield) this.rig.set('hurt', this.playerEquip);
      this.rig.root.x -= shield ? 2 : 4;
    } else {
      sfx(ev.result === 'pierce' ? 'pierce' : ev.big ? 'hurt_big' : 'hurt');
      if (ev.result === 'pierce') this.fx.burst('fx_pierce', 2, h.x + 14, h.y, 60, { flipX: true });
      else this.fx.burst(ev.big ? 'fx_spark_hot' : 'fx_spark', 3, h.x + 6, h.y, 40);
      this.fx.flash(this.rigImages(), ev.big ? 90 : 60);
      const col = ev.result === 'pierce' ? PAL.magenta : ev.big ? PAL.hotred : PAL.red;
      this.fx.popup(h.x, h.y - 20, ev.result === 'pierce' ? `관통 ${ev.amount}` : String(ev.amount), col, ev.big);
      this.fx.shake(this.stage, ev.big ? 5 : 3, -1);
      if (ev.big) this.fx.screenFlash(PAL.crimson, 90, 0.3);
      this.rig.set('hurt', this.playerEquip);
      this.rig.root.x -= ev.big ? 7 : 4;
    }
    this.hud.playerHp(ev.hp, ev.maxHp);
    if (!ev.lethal && ev.hp <= ev.maxHp * 0.3) this.coach('lowHp');
    await this.fx.wait(stop);
    this.enemy.frozen = false;
    // 피격 자세에서 원래 자세로(행동이 계속되면 준비 자세 유지)
    if (!ev.lethal && this.playerEquip) this.rig.set(preparePose(this.playerEquip, this.view.pWait ?? 1, this.playerWaitTotal), this.playerEquip);
    await this.fx.tween({ targets: this.rig.root, x: PX, duration: 120 });
  }

  private rigImages(): Phaser.GameObjects.Image[] {
    return this.rig.root.list.filter((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image && o.visible);
  }

  private async playHeal(ev: Extract<BattleEvent, { t: 'heal' }>): Promise<void> {
    const h = this.haruHit();
    sfx('heal');
    this.fx.burst('fx_ring_heal', 4, h.x, h.y, 70);
    this.fx.debris('mote_green', h.x, h.y + 10, 10, { spread: 26, up: 40, gravity: -30, life: 600 });
    this.fx.burst('fx_sparkle', 3, h.x - 8, h.y - 10, 90);
    this.fx.burst('fx_sparkle', 3, h.x + 9, h.y - 2, 90);
    this.fx.popup(h.x, h.y - 20, `+${ev.amount}`, PAL.green, false, '회복');
    this.hud.playerHp(ev.hp, ev.maxHp);
    await this.fx.wait(320);
  }

  private async playDelay(ev: Extract<BattleEvent, { t: 'delay' }>): Promise<void> {
    if (!ev.applied) {
      sfx('delay_fail');
      const p = ev.target === 'enemy' ? this.enemy.hitPoint() : this.haruHit();
      this.fx.popup(p.x, p.y - 30, '지연 무효', PAL.steel, false, '이미 밀린 행동');
      await this.fx.wait(260);
      return;
    }
    sfx('delay');
    if (ev.target === 'enemy') {
      const p = this.enemy.hitPoint();
      this.fx.burst('fx_delay', 4, p.x, p.y, 70);
      const from = this.view.eWait ?? 0;
      await this.animateMarker('enemy', from, ev.wait);
      this.view.eWait = ev.wait;
      this.fx.popup(tlX(ev.wait), 44, `+${ev.amount} 지연`, PAL.cyan);
    } else {
      const p = this.haruHit();
      this.fx.burst('fx_delay', 4, p.x, p.y, 70);
      const from = this.view.pWait ?? 0;
      await this.animateMarker('player', from, ev.wait);
      this.view.pWait = ev.wait;
      this.playerWaitTotal = Math.max(this.playerWaitTotal, ev.wait);
      this.fx.popup(tlX(ev.wait), 44, `+${ev.amount} 지연`, PAL.cyan);
    }
    await this.fx.wait(160);
  }

  private animateMarker(who: 'player' | 'enemy', from: number, to: number): Promise<void> {
    return new Promise((resolve) => {
      const steps = Math.max(1, to - from);
      let k = 0;
      const step = () => {
        k++;
        const v = from + k;
        if (who === 'enemy') this.hud.setEnemyMarker(v);
        else this.hud.setPlayerMarker(v);
        if (v >= to) resolve();
        else this.time.delayedCall(this.fx.d(45), step);
      };
      step();
      void steps;
    });
  }

  private async playDeath(ev: Extract<BattleEvent, { t: 'death' }>): Promise<void> {
    // 전투가 끝났으니 레일 표식과 의도 표시는 모두 치운다.
    this.hud.setPlayerMarker(null);
    this.hud.setEnemyMarker(null);
    this.hud.hideIntent();
    this.warnMark.setVisible(false);
    if (ev.side === 'enemy') {
      const p = this.enemy.hitPoint();
      sfx('ko');
      this.fx.screenFlash(PAL.white, 160, 0.55);
      this.fx.burst('fx_ko', 3, p.x, p.y, 80);
      this.fx.debris(`fx_shard_${MATERIAL[this.bd.enemyId]}`, p.x, p.y, 18, { spread: 90, up: 70, life: 700 });
      this.fx.debris('mote_gold', p.x, p.y, 10, { spread: 60, up: 50, life: 600 });
      this.fx.shake(this.stage, 6, 1);
      this.hud.hideIntent();
      this.hud.setEnemyMarker(null);
      this.enemy.frozen = true;
      await this.fx.wait(260);
      await this.fx.tween({ targets: this.enemy.root, alpha: 0, y: this.enemy.root.y + 6, duration: 420 });
    } else {
      sfx('hurt_big');
      this.rig.set('kneel', null);
      this.fx.shake(this.stage, 5, -1);
      const dark = this.add.rectangle(0, 0, 480, 270, PAL.ink, 0).setOrigin(0, 0).setDepth(90);
      await this.fx.tween({ targets: dark, fillAlpha: 0.45, duration: 500 } as Phaser.Types.Tweens.TweenBuilderConfig);
    }
    await this.fx.wait(200);
  }

  private async playRelease(ev: Extract<BattleEvent, { t: 'release' }>): Promise<void> {
    if (ev.side === 'player') {
      this.playerEquip = null;
      this.view.pWait = null;
      this.hud.setPlayerMarker(null);
      this.hud.playerState(0, '행동 없음');
      await this.fx.tween({ targets: this.rig.root, x: PX, y: STAGE_Y, duration: 130, ease: 'Quad.easeOut' });
      this.rig.set('idle0', null);
    } else {
      this.view.eWait = null;
      this.hud.setEnemyMarker(null);
      this.hud.hideIntent();
      this.warnMark.setVisible(false);
      await this.fx.tween({ targets: this.enemy.root, x: this.enemyHome.x, y: this.enemyHome.y, duration: 140, ease: 'Quad.easeOut' });
      this.enemy.setPose('idle');
    }
  }

  // ───────────────────────── 도움말 ─────────────────────────
  private coach(flag: string): void {
    const key = `coach_${flag}`;
    if (this.localFlags.has(key) || this.save.flags.includes(key)) return;
    const lines = COACH[flag];
    if (!lines) return;
    this.localFlags.add(key);
    this.coachQueue.push(lines);
  }

  private async flushCoach(): Promise<void> {
    while (this.coachQueue.length) {
      const lines = this.coachQueue.shift()!;
      await this.dialog.say(lines);
    }
  }

  private withCoachFlags(s: SaveData): SaveData {
    let n = s;
    for (const f of this.localFlags) n = withFlag(n, f);
    return n;
  }

  // ───────────────────────── 종료 ─────────────────────────
  private async onEnd(result: 'victory' | 'defeat'): Promise<void> {
    if (this.resultDone) return;
    this.resultDone = true;
    this.hud.setSelecting(false);
    if (result === 'victory') {
      playMusic('victory');
      const cur = loadSave() ?? this.save;
      const { save, reward } = grantVictory(cur, this.bd.enemyId);
      const next = this.withCoachFlags(save);
      writeSave(next);
      this.save = next;
      await banner(this, '승리!', PAL.yellow, 900, 110);
      await this.showRewards(reward);
      this.leave({ enemyId: this.bd.enemyId, reward, victory: true });
    } else {
      playMusic('defeat');
      const cur = loadSave() ?? this.save;
      const next = this.withCoachFlags(recordDefeat(cur));
      writeSave(next);
      this.save = next;
      await banner(this, '쓰러졌다…', PAL.pink, 900, 100);
      this.defeatMenu();
    }
  }

  private showRewards(reward: Reward | null): Promise<void> {
    return new Promise((resolve) => {
      const lines: string[] = [];
      if (reward) {
        if (reward.gears > 0) lines.push(`톱니 +${reward.gears}`);
        if (reward.equip) lines.push(`새 장비: ${EQUIP[reward.equip].name}`);
      }
      if (lines.length === 0) lines.push(this.bd.enemyId === 'dummy' ? '좋은 연습이었다.' : '더 얻을 것은 없다.');
      const c = this.add.container(0, 0).setDepth(2500);
      c.add(panel(this, 150, 120, 180, 30 + lines.length * 14, 'brass'));
      c.add(txt(this, 162, 126, '전리품', { font: 'bold', color: PAL.gold }));
      lines.forEach((l, i) => c.add(txt(this, 162, 142 + i * 14, l, { color: PAL.white })));
      if (reward?.equip || reward?.gears) sfx(reward?.equip ? 'item' : 'gear');
      const layer: Layer = {
        layerName: 'reward',
        key: (k) => {
          if (k !== 'ok' && k !== 'cancel') return;
          if (this.time.now - opened < 350) return;
          this.router.remove(layer);
          this.input.off('pointerup', click);
          c.destroy();
          resolve();
        },
      };
      const opened = this.time.now;
      const click = () => layer.key('ok', false);
      this.input.on('pointerup', click);
      this.router.push(layer);
      c.add(txt(this, 318, 130 + lines.length * 14, 'Z', { font: 'tiny', color: PAL.steel, origin: [1, 0] }));
    });
  }

  private defeatMenu(): void {
    const def = ENEMIES[this.bd.enemyId];
    const tipBox = this.add.container(0, 0).setDepth(1400);
    tipBox.add(panel(this, 60, 64, 360, 40, 'dark'));
    tipBox.add(txt(this, 70, 70, `똑딱이: ${def.tip}`, { font: 'small', color: PAL.cream, wrap: 340, lineSpacing: 3 }));
    let locked = false;
    const m = new Menu(
      this,
      this.router,
      170,
      116,
      [{ label: '다시 도전' }, { label: '장비를 바꾸고 도전' }, { label: '물러나기' }],
      {
        select: (i) => {
          if (locked) return;
          if (i === 0) {
            locked = true;
            m.close();
            this.scene.restart(this.bd);
          } else if (i === 1) {
            m.close();
            new LoadoutPanel(this, this.router, this.save, (lo) => {
              if (lo) {
                const s2 = { ...this.save, loadout: lo };
                writeSave(s2);
              }
              locked = true;
              this.scene.restart(this.bd);
            });
          } else {
            locked = true;
            m.close();
            this.retreat();
          }
        },
      },
      { width: 150, title: '어떻게 할까?' },
    );
  }

  private retreat(): void {
    if (!this.resultDone) {
      const cur = loadSave() ?? this.save;
      writeSave(this.withCoachFlags(cur));
    }
    this.leave({ enemyId: this.bd.enemyId, reward: null, victory: false });
  }

  private leave(after: { enemyId: EnemyId; reward: Reward | null; victory: boolean }): void {
    this.session.dispose();
    this.cameras.main.fadeOut(220, 24, 20, 37);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (after.victory && after.enemyId === 'boss') this.scene.start('ending');
      else this.scene.start('world', { afterBattle: after });
    });
  }

  // ───────────────────────── 디버그 다리(테스트용) ─────────────────────────
  private exposeDebug(): void {
    const w = window as unknown as { __TT?: Record<string, unknown> };
    w.__TT = w.__TT ?? {};
    let solver: Solver | null = null;
    w.__TT.battle = {
      // 복사본만 내보낸다(권위 상태를 밖에서 바꿀 수 없게).
      state: () => structuredClone(this.session.state),
      phase: () => this.session.sessionPhase,
      turn: () => this.selectTurn,
      selecting: () => this.hud.isSelecting,
      depth: () => this.router.depth,
      top: () => this.router.topName(),
      loadout: () => this.hud.slots.map((s) => s.act.id),
      focus: () => this.focusIdx,
      log: () => structuredClone(this.session.log),
      enemyId: () => this.bd.enemyId,
      /** 테스트 봇용: 현재 상태에서 최선의 행동(실제 엔진으로 탐색). */
      best: () => {
        solver = solver ?? new Solver(this.session.engine, 3_000_000);
        return solver.best(this.session.state as BattleState).id;
      },
      active: () => this.scene.isActive(),
    };
    void TL;
  }
}
