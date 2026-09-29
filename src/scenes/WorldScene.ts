// 탐험: 격자 이동, 조사, 상자·작업대·비밀, 층 이동, 전투 진입. 저장은 안정된 순간에만.
import Phaser from 'phaser';
import { applyVolumes, playMusic, sfx } from '../audio/audio';
import { PAL } from '../art/palette';
import { addSingle, ENEMY_ORIGIN_Y } from '../art/textures';
import { baseChar, isWallChar, renderMap, T, THEMES } from '../art/tiles';
import { MINI } from '../art/overworld';
import { EQUIP } from '../data/equipment';
import { ENEMIES, type EnemyId } from '../data/enemies';
import { ENEMY_THEME, entitiesOf, key, MAPS, type Entity, type Exit, type MapDef, type MapId } from '../data/maps';
import { AFTER_BATTLE, AFTER_CHEST, STORY } from '../data/story';
import { breakWall, hasFlag, newGame, openChest, setLoadout, withFlag, type Dir, type Reward, type SaveData } from '../game/progress';
import { saveSettings, settings, SHAKE_NAMES, SPEED_NAMES } from '../game/settings';
import { loadSave, writeSave } from '../game/storage';
import { LoadoutPanel } from '../ui/loadout';
import { txt } from '../ui/text';
import { banner, confirm, DialogBox, InputRouter, Menu, panel, type Layer, type Line, type UiKey } from '../ui/widgets';
import { preBattle, statusView, UpgradePanel } from '../world/panels';

interface Obj {
  x: number;
  y: number;
  e: Entity;
  sprite: Phaser.GameObjects.Image;
  anim?: { key: string; frames: number; ms: number; acc: number; f: number };
}

interface WorldData {
  afterBattle?: { enemyId: EnemyId; reward: Reward | null; victory: boolean };
}

const DIRV: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const STEP_MS = 150;

export class WorldScene extends Phaser.Scene {
  private save!: SaveData;
  private map!: MapDef;
  private router!: InputRouter;
  private dialog!: DialogBox;
  private player!: Phaser.GameObjects.Image;
  private ttok!: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private facing: Dir = 'up';
  private moving = false;
  private busy = false;
  private objs: Obj[] = [];
  private decor: { sprite: Phaser.GameObjects.Image; anim: { key: string; frames: number; ms: number; acc: number; f: number } }[] = [];
  private mapImg: Phaser.GameObjects.Image | null = null;
  private roof: Phaser.GameObjects.Rectangle | null = null;
  private keys: Record<Dir, Phaser.Input.Keyboard.Key[]> = { up: [], down: [], left: [], right: [] };
  private walkPhase = 0;
  private lastBump = 0;
  private hudGears!: Phaser.GameObjects.Text;
  private hudHp!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private goalBg!: Phaser.GameObjects.NineSlice;
  private ttokT = 0;
  private wd: WorldData = {};
  private blockers = new Set<string>();
  private rubbleDone = new Set<string>();

  constructor() {
    super('world');
  }

  init(data: WorldData): void {
    this.wd = data ?? {};
    this.objs = [];
    this.decor = [];
    this.moving = false;
    this.busy = false;
    this.roof = null;
    // 장면 재시작 시 이전 실행의 (파괴된) 오브젝트를 재사용하지 않는다.
    this.mapImg = null;
    this.rubbleDone = new Set();
    this.blockers = new Set();
  }

  create(): void {
    let s = loadSave();
    if (!s) {
      const m = MAPS.f1;
      s = newGame('f1', m.start.x, m.start.y);
      writeSave(s);
    }
    this.save = s;
    this.map = MAPS[(s.map as MapId) in MAPS ? (s.map as MapId) : 'f1'];
    this.px = s.x;
    this.py = s.y;
    this.facing = s.facing;

    this.drawMap();
    this.placeEntities();
    this.placeDecor();

    this.player = this.add.image(0, 0, 'haru_ow', 'u0').setOrigin(0.5, 1);
    this.ttok = this.add.image(0, 0, 'ttok', 0);
    this.syncPlayer();
    this.ttok.setPosition(this.player.x - 12, this.player.y - 22);

    const mw = this.map.rows[0].length * T;
    const mh = this.map.rows.length * T;
    const cam = this.cameras.main;
    cam.setBounds(Math.min(0, (mw - 480) / 2), Math.min(0, (mh - 270) / 2), Math.max(480, mw), Math.max(270, mh));
    cam.startFollow(this.player, true, 1, 1, 0, 20);
    cam.setRoundPixels(true);
    cam.setBackgroundColor(THEMES[this.map.theme].wallTop);

    this.makeHud();
    this.router = new InputRouter(this);
    this.dialog = new DialogBox(this, this.router);
    this.router.push(this.worldLayer);
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.UP), kb.addKey(K.W)],
      down: [kb.addKey(K.DOWN), kb.addKey(K.S)],
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    playMusic(this.map.music);
    cam.fadeIn(260, 24, 20, 37);
    this.exposeDebug();
    void this.onEnter();
  }

  // ───────────────────────── 맵 ─────────────────────────
  private floorChar(): string {
    return this.map.theme === 'foyer' ? '.' : ',';
  }

  private gridRows(): string[] {
    const rows = this.map.rows.map((r) => r.split(''));
    for (const [k, id] of Object.entries(this.map.walls)) {
      if (!this.save.walls.includes(id)) continue;
      const [x, y] = k.split(',').map(Number);
      rows[y][x] = this.floorChar();
    }
    return rows.map((r) => r.join(''));
  }

  private drawMap(): void {
    const keyName = `map_${this.map.id}_${this.save.walls.join('_')}`;
    if (!this.textures.exists(keyName)) {
      const pc = renderMap({ rows: this.gridRows(), theme: this.map.theme, floorUnder: this.map.floorUnder }, this.map.id.charCodeAt(1) * 97);
      addSingle(this, keyName, pc);
    }
    if (this.mapImg?.active) this.mapImg.setTexture(keyName);
    else this.mapImg = this.add.image(0, 0, keyName).setOrigin(0, 0).setDepth(-10);
    // 부서진 벽 잔해(한 번만)
    for (const [k, id] of Object.entries(this.map.walls)) {
      if (!this.save.walls.includes(id) || this.rubbleDone.has(id)) continue;
      this.rubbleDone.add(id);
      const [x, y] = k.split(',').map(Number);
      this.add.image(x * T, y * T, 'rubble').setOrigin(0, 0).setDepth(-5);
    }
    // 숨은 방 지붕
    const sec = this.map.secret;
    if (sec && !this.roof && !hasFlag(this.save, `secret_${this.map.id}`)) {
      this.roof = this.add
        .rectangle(sec.x * T, sec.y * T - 4, sec.w * T - 16, sec.h * T + 8, THEMES[this.map.theme].wallTop)
        .setOrigin(0, 0)
        .setDepth(900);
    }
  }

  private charAt(x: number, y: number): string | undefined {
    return baseChar({ rows: this.map.rows, theme: this.map.theme, floorUnder: this.map.floorUnder }, x, y);
  }

  private placeEntities(): void {
    for (const p of entitiesOf(this.map)) {
      const e = p.e;
      const wx = p.x * T + T / 2;
      const wy = p.y * T + T;
      if (e.kind === 'enemy') {
        // 연습 인형과 대진자(클리어 후 재대결)는 처치 기록과 무관하게 항상 남는다.
        if (e.enemy !== 'dummy' && e.enemy !== 'boss' && this.save.defeated.includes(e.enemy)) continue;
        if (e.enemy === 'boss') {
          const img = this.add.image(wx, wy + 4, 'enemy_boss', 'idle_0').setOrigin(0.5, ENEMY_ORIGIN_Y.get('boss') ?? 1);
          this.objs.push({ x: p.x, y: p.y, e, sprite: img, anim: { key: 'idle', frames: 6, ms: 180, acc: 0, f: 0 } });
        } else {
          const mini = MINI[e.enemy as Exclude<EnemyId, 'boss'>];
          const img = this.add.image(wx, wy, `mini_${e.enemy}`, 0).setOrigin(0.5, 1);
          this.objs.push({ x: p.x, y: p.y, e, sprite: img, anim: { key: `mini_${e.enemy}`, frames: mini.frames, ms: 260, acc: Math.random() * 200, f: 0 } });
        }
      } else if (e.kind === 'chest') {
        const img = this.add.image(wx, wy, 'chest', this.save.chests.includes(e.id) ? 'open' : 'closed').setOrigin(0.5, 1);
        this.objs.push({ x: p.x, y: p.y, e, sprite: img });
      } else if (e.kind === 'bench') {
        const img = this.add.image(wx, wy + 2, 'bench', 0).setOrigin(0.5, 1);
        this.objs.push({ x: p.x, y: p.y, e, sprite: img, anim: { key: 'bench', frames: 2, ms: 400, acc: 0, f: 0 } });
      } else if (e.kind === 'npc') {
        const img = this.add.image(wx, wy, 'grandpa', this.cleared() ? 'awake' : 'sleep').setOrigin(0.5, 1);
        this.objs.push({ x: p.x, y: p.y, e, sprite: img });
      } else if (e.kind === 'door') {
        const img = this.add.image(wx, wy, 'gate', 'closed').setOrigin(0.5, 1);
        this.objs.push({ x: p.x, y: p.y, e, sprite: img });
      }
    }
    for (const o of this.objs) o.sprite.setDepth(o.sprite.y);
  }

  private placeDecor(): void {
    for (const d of this.map.decor) {
      const wx = d.x * T + T / 2;
      if (d.kind === 'pendulum') {
        const img = this.add.image(wx, d.y * T + 2, 'pendecor', 0).setOrigin(0.5, 0).setDepth(-4);
        this.decor.push({ sprite: img, anim: { key: 'pendecor', frames: 8, ms: 150, acc: d.x * 40, f: d.x % 8 } });
      } else if (d.kind === 'clock') {
        const img = this.add.image(wx, d.y * T + T, 'clock', 0).setOrigin(0.5, 1).setDepth(d.y * T + T);
        this.decor.push({ sprite: img, anim: { key: 'clock', frames: 4, ms: 320, acc: 0, f: 0 } });
        this.blockers.add(key(d.x, d.y));
      } else if (d.kind === 'steam') {
        const img = this.add.image(wx, d.y * T + T, 'steam', 0).setOrigin(0.5, 1).setDepth(-4);
        this.decor.push({ sprite: img, anim: { key: 'steam', frames: 3, ms: 220, acc: d.x * 50, f: 0 } });
      } else if (d.kind === 'crate') {
        this.add.image(d.x * T, d.y * T, 'crate').setOrigin(0, 0).setDepth(d.y * T + T);
        this.blockers.add(key(d.x, d.y));
      }
    }
  }

  private cleared(): boolean {
    return hasFlag(this.save, 'cleared') || this.save.defeated.includes('boss');
  }

  private objAt(x: number, y: number): Obj | undefined {
    return this.objs.find((o) => o.x === x && o.y === y && o.sprite.active);
  }

  walkable(x: number, y: number): boolean {
    const c = this.charAt(x, y);
    if (c === undefined) return false;
    if (c === '%') return true;
    if (c === 'X') {
      const id = this.map.walls[key(x, y)];
      return !!id && this.save.walls.includes(id);
    }
    if (isWallChar(c) || c === '~') return false;
    if (this.blockers.has(key(x, y))) return false;
    if (this.objAt(x, y)) return false;
    return true;
  }

  // ───────────────────────── HUD ─────────────────────────
  private makeHud(): void {
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(950);
    const nameT = txt(this, 10, 6, this.map.name, { font: 'small', color: PAL.cream, shadow: PAL.ink });
    c.add(panel(this, 2, 2, Math.round(nameT.width) + 16, 18, 'dark'));
    c.add(nameT);
    c.add(panel(this, 392, 2, 86, 18, 'dark'));
    c.add(this.add.image(400, 11, 'ic_gear'));
    this.hudGears = txt(this, 408, 6, '', { font: 'small', color: PAL.gold });
    c.add(this.hudGears);
    c.add(this.add.image(440, 11, 'ic_hp'));
    this.hudHp = txt(this, 448, 6, '', { font: 'small', color: PAL.pink });
    c.add(this.hudHp);
    const hint = txt(this, 474, 258, 'Z 조사 · X 메뉴', { font: 'tiny', color: PAL.steel, origin: [1, 0], shadow: PAL.ink });
    c.add(hint);
    // 현재 목표: 다음에 무엇을 해야 할지 항상 보이게.
    this.goalBg = panel(this, 2, 22, 100, 16, 'dark');
    this.goalText = txt(this, 10, 25, '', { font: 'small', color: PAL.yellow, shadow: PAL.ink });
    c.add([this.goalBg, this.goalText]);
    this.refreshHud();
  }

  private objective(): string {
    const s = this.save;
    const has = (id: string) => s.chests.includes(id);
    const beat = (id: string) => s.defeated.includes(id);
    if (!has('f1_kit')) return '목표: 왼쪽 작업실의 공구함을 열자';
    if (!beat('rat') && !s.flags.includes('dummy_done')) return '목표: 작업실의 연습 인형과 한 번 겨뤄 보자';
    if (!beat('rat')) return '목표: 복도 위쪽의 태엽 쥐를 쓰러뜨리자';
    if (!beat('sentry')) return has('f1_sword') ? '목표: 계단을 지키는 놋쇠 파수병' : '목표: 북쪽 방 상자를 열고 파수병에게';
    if (!has('f2_hammer')) return '목표: 2층 회랑 왼쪽 아래의 상자';
    if (!beat('knight')) return '목표: 회랑 북쪽의 진자 기사';
    if (!beat('swarm')) return '목표: 계단 앞의 톱니 벌떼';
    if (!has('f3_awl')) return '목표: 3층 기관실 왼쪽 아래의 상자';
    if (!beat('tortoise')) return '목표: 통로를 막은 무쇠 거북';
    if (!beat('hexer')) return '목표: 계단 앞의 녹 주술사';
    if (!beat('boss')) return '목표: 꼭대기의 녹슨 대진자';
    return '목표 달성! 대진자와 재대결할 수 있다';
  }

  private refreshHud(): void {
    this.hudGears.setText(String(this.save.gears));
    this.hudHp.setText(String(this.save.maxHp));
    this.goalText.setText(this.objective());
    this.goalBg.setSize(Math.round(this.goalText.width) + 16, 16);
  }

  // ───────────────────────── 저장 ─────────────────────────
  private commit(s: SaveData): void {
    this.save = { ...s, map: this.map.id, x: this.px, y: this.py, facing: this.facing };
    writeSave(this.save);
    this.refreshHud();
  }

  // ───────────────────────── 입력 ─────────────────────────
  private worldLayer: Layer = {
    layerName: 'world',
    key: (k: UiKey) => {
      if (this.busy || this.moving) return;
      if (k === 'ok') void this.interact();
      else if (k === 'cancel') this.pauseMenu();
    },
  };

  private heldDir(): Dir | null {
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) if (this.keys[d].some((k) => k.isDown)) return d;
    return null;
  }

  update(_t: number, dt: number): void {
    this.save.playTime += dt / 1000;
    for (const o of this.objs) {
      if (!o.anim || !o.sprite.active) continue;
      o.anim.acc += dt;
      if (o.anim.acc > o.anim.ms) {
        o.anim.acc = 0;
        o.anim.f = (o.anim.f + 1) % o.anim.frames;
        if (o.e.kind === 'enemy' && o.e.enemy === 'boss') o.sprite.setFrame(`idle_${o.anim.f}`);
        else o.sprite.setFrame(o.anim.f);
      }
    }
    for (const d of this.decor) {
      d.anim.acc += dt;
      if (d.anim.acc > d.anim.ms) {
        d.anim.acc = 0;
        d.anim.f = (d.anim.f + 1) % d.anim.frames;
        d.sprite.setFrame(d.anim.f);
      }
    }
    // 똑딱이: 하루 뒤를 부드럽게 따라온다
    this.ttokT += dt;
    const [fx, fy] = DIRV[this.facing];
    const tx = this.player.x - fx * 12 - (fy !== 0 ? 11 : 0);
    const ty = this.player.y - 24 - fy * 4 + Math.round(Math.sin(this.ttokT / 260) * 2);
    this.ttok.x += (tx - this.ttok.x) * Math.min(1, dt / 120);
    this.ttok.y += (ty - this.ttok.y) * Math.min(1, dt / 120);
    this.ttok.setPosition(Math.round(this.ttok.x), Math.round(this.ttok.y));
    this.ttok.setFrame(Math.floor(this.ttokT / 160) % 4);
    this.ttok.setDepth(this.ttok.y + (this.facing === 'up' ? 20 : -2));

    if (!this.moving && !this.busy && this.router.depth === 1) {
      const d = this.heldDir();
      if (d) this.tryMove(d);
    }
  }

  private syncPlayer(): void {
    this.player.setPosition(this.px * T + T / 2, this.py * T + T);
    this.player.setDepth(this.player.y);
    this.setPlayerFrame(0);
  }

  private setPlayerFrame(f: number): void {
    const d = { up: 'u', down: 'd', left: 'l', right: 'r' }[this.facing];
    this.player.setFrame(`${d}${f}`);
  }

  private tryMove(d: Dir): void {
    this.facing = d;
    const [dx, dy] = DIRV[d];
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (!this.walkable(nx, ny)) {
      this.setPlayerFrame(0);
      if (this.time.now - this.lastBump > 400) {
        this.lastBump = this.time.now;
        sfx('bump');
      }
      return;
    }
    this.moving = true;
    this.px = nx;
    this.py = ny;
    this.walkPhase = (this.walkPhase + 1) % 2;
    this.setPlayerFrame(this.walkPhase + 1);
    this.tweens.add({
      targets: this.player,
      x: nx * T + T / 2,
      y: ny * T + T,
      duration: STEP_MS,
      onUpdate: () => this.player.setDepth(this.player.y),
      onComplete: () => {
        this.player.setPosition(nx * T + T / 2, ny * T + T);
        this.moving = false;
        if (!this.heldDir()) this.setPlayerFrame(0);
        sfx('step');
        void this.arrive();
      },
    });
  }

  private async arrive(): Promise<void> {
    const k = key(this.px, this.py);
    const ex = this.map.exits[k];
    if (ex) {
      this.changeMap(ex);
      return;
    }
    const sec = this.map.secret;
    if (sec && this.roof && this.px >= sec.x && this.px < sec.x + sec.w && this.py >= sec.y && this.py < sec.y + sec.h) {
      const roof = this.roof;
      this.roof = null;
      this.tweens.add({ targets: roof, alpha: 0, duration: 400, onComplete: () => roof.destroy() });
      sfx('door');
      this.commit(withFlag(this.save, `secret_${this.map.id}`));
      await this.say(STORY.secret_found);
    }
    const trig = this.map.triggers[k];
    if (trig && !hasFlag(this.save, `t_${trig}`)) {
      this.commit(withFlag(this.save, `t_${trig}`));
      await this.say(STORY[trig] ?? []);
    }
  }

  private async say(lines: Line[]): Promise<void> {
    if (!lines.length) return;
    this.busy = true;
    await this.dialog.say(lines);
    this.busy = false;
  }

  private async onEnter(): Promise<void> {
    const ab = this.wd.afterBattle;
    this.wd = {};
    if (ab?.victory) {
      // 쓰러뜨린 적 자리의 흙먼지
      const p = entitiesOf(this.map).find((q) => q.e.kind === 'enemy' && q.e.enemy === ab.enemyId);
      if (p && ab.enemyId !== 'dummy') {
        const img = this.add.image(p.x * T + T / 2, p.y * T + T, `mini_${ab.enemyId}`, 0).setOrigin(0.5, 1).setDepth(p.y * T + T);
        this.tweens.add({ targets: img, alpha: 0, y: img.y - 6, duration: 600, delay: 250, onComplete: () => img.destroy() });
        const dust = this.add.image(img.x, img.y - 6, 'fx_dust', 0).setDepth(img.depth + 1);
        let f = 0;
        this.time.addEvent({ delay: 110, repeat: 2, callback: () => (++f < 3 ? dust.setFrame(f) : dust.destroy()) });
      }
      await this.wait(420);
      const story = AFTER_BATTLE[ab.enemyId];
      if (story) await this.say(STORY[story]);
      if (ab.enemyId === 'dummy' && !hasFlag(this.save, 't_dummy_first')) {
        this.commit(withFlag(this.save, 't_dummy_first'));
        await this.say(STORY.dummy_first);
      }
      if (ab.reward?.equip && !this.save.loadout.includes(ab.reward.equip)) {
        await this.say([{ who: '똑딱이', text: `${EQUIP[ab.reward.equip].name}을(를) 챙길 자리가 없어. X 메뉴 → 장비 구성에서 바꿀 수 있어.` }]);
      }
    }
    const k = key(this.px, this.py);
    const trig = this.map.triggers[k];
    if (trig && !hasFlag(this.save, `t_${trig}`)) {
      this.commit(withFlag(this.save, `t_${trig}`));
      await this.say(STORY[trig] ?? []);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }

  // ───────────────────────── 조사 ─────────────────────────
  private async interact(): Promise<void> {
    const [dx, dy] = DIRV[this.facing];
    const tx = this.px + dx;
    const ty = this.py + dy;
    const o = this.objAt(tx, ty);
    if (o) {
      const e = o.e;
      if (e.kind === 'enemy') return this.approachEnemy(e.enemy);
      if (e.kind === 'chest') return this.openChestAt(o, e);
      if (e.kind === 'bench') return this.useBench();
      if (e.kind === 'npc') return this.say(this.cleared() ? STORY.grandpa_awake : STORY.grandpa);
      if (e.kind === 'door') return this.say([{ who: '안내', text: e.msg }]);
    }
    const wid = this.map.walls[key(tx, ty)];
    if (wid && !this.save.walls.includes(wid)) return this.crackedWall(tx, ty, wid);
  }

  private async approachEnemy(id: EnemyId): Promise<void> {
    if (this.save.loadout.length === 0) return this.say(STORY.no_gear);
    if (id === 'rat' && !this.save.defeated.includes('rat') && !hasFlag(this.save, 'dummy_done')) return this.say(STORY.need_dummy);
    if (id === 'boss' && !hasFlag(this.save, 't_boss_pre')) {
      this.commit(withFlag(this.save, 't_boss_pre'));
      await this.say(STORY.boss_pre);
    }
    this.busy = true;
    for (;;) {
      const r = await preBattle(this, this.router, id, this.save);
      if (r === 'fight') {
        this.startBattle(id);
        return;
      }
      if (r === 'leave') break;
      await this.editLoadout();
    }
    this.busy = false;
  }

  private editLoadout(): Promise<void> {
    return new Promise((resolve) => {
      new LoadoutPanel(this, this.router, this.save, (lo) => {
        if (lo) {
          const r = setLoadout(this.save, lo);
          if (r.ok) this.commit(r.save);
        }
        resolve();
      });
    });
  }

  private startBattle(id: EnemyId): void {
    this.busy = true;
    this.commit(this.save);
    sfx('danger');
    const cam = this.cameras.main;
    cam.flash(120, 255, 255, 255);
    cam.fadeOut(260, 24, 20, 37);
    cam.once('camerafadeoutcomplete', () => this.scene.start('battle', { enemyId: id, theme: ENEMY_THEME[id] }));
  }

  private async openChestAt(o: Obj, e: Extract<Entity, { kind: 'chest' }>): Promise<void> {
    if (this.save.chests.includes(e.id)) return this.say(STORY.already);
    this.busy = true;
    const r = openChest(this.save, e.id, e.reward);
    this.commit(r.save);
    o.sprite.setFrame('open');
    sfx('chest');
    await this.wait(300);
    sfx(e.reward.equip || e.reward.equips ? 'item' : e.reward.heart ? 'heal' : 'gear');
    await banner(this, e.msg, PAL.yellow, 1300, 120);
    this.busy = false;
    const story = AFTER_CHEST[e.id];
    if (story) await this.say(STORY[story]);
  }

  private async crackedWall(x: number, y: number, id: string): Promise<void> {
    if (!this.save.owned.includes('hammer')) return this.say(STORY.wall_hint);
    this.busy = true;
    const yes = await confirm(this, this.router, '시침 대망치로 금 간 벽을 부술까?', 140, 110);
    if (!yes) {
      this.busy = false;
      return;
    }
    sfx('swish_heavy');
    await this.wait(120);
    sfx('wall_break');
    this.cameras.main.shake(160, 0.006);
    for (let i = 0; i < 8; i++) {
      const p = this.add.image(x * T + 8, y * T + 8, 'fx_shard_steel').setDepth(500);
      this.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 40, y: p.y + Math.random() * 20 - 14, alpha: 0, duration: 500 });
    }
    this.commit(breakWall(this.save, id));
    this.drawMap();
    this.busy = false;
  }

  private async useBench(): Promise<void> {
    if (!hasFlag(this.save, 't_bench_first')) {
      this.commit(withFlag(this.save, 't_bench_first'));
      await this.say(STORY.bench_first);
    }
    this.busy = true;
    const m = new Menu(
      this,
      this.router,
      150,
      70,
      [{ label: '장비 강화' }, { label: '장비 구성' }, { label: '여정 기록하기' }, { label: '떠나기' }],
      {
        select: async (i) => {
          if (i === 0) {
            m.root.setVisible(false);
            await new Promise<void>((res) => new UpgradePanel(this, this.router, this.save, (s) => this.commit(s), res));
            m.root.setVisible(true);
          } else if (i === 1) {
            m.root.setVisible(false);
            await this.editLoadout();
            m.root.setVisible(true);
          } else if (i === 2) {
            this.commit(this.save);
            sfx('gear');
            await this.dialog.say(STORY.save_done);
          } else {
            m.close();
            this.busy = false;
          }
        },
        cancel: () => {
          m.close();
          this.busy = false;
        },
      },
      { width: 150, title: '할아버지의 작업대' },
    );
  }

  private pauseMenu(): void {
    this.busy = true;
    const labels = () => [
      { label: '장비 구성' },
      { label: '상태 보기' },
      { label: `전투 속도: ${SPEED_NAMES[settings.speed]}` },
      { label: `화면 흔들림: ${SHAKE_NAMES[settings.shake]}` },
      { label: `효과음: ${Math.round(settings.sfx * 100)}%` },
      { label: `음악: ${Math.round(settings.music * 100)}%` },
      { label: '타이틀로' },
      { label: '닫기' },
    ];
    const m = new Menu(
      this,
      this.router,
      160,
      40,
      labels(),
      {
        select: async (i) => {
          if (i === 0) {
            m.root.setVisible(false);
            await this.editLoadout();
            m.root.setVisible(true);
          } else if (i === 1) {
            m.root.setVisible(false);
            await statusView(this, this.router, this.save);
            m.root.setVisible(true);
          } else if (i >= 2 && i <= 5) {
            if (i === 2) settings.speed = ((settings.speed % 3) + 1) as 1 | 2 | 3;
            if (i === 3) settings.shake = ((settings.shake + 1) % 3) as 0 | 1 | 2;
            if (i === 4) settings.sfx = settings.sfx >= 1 ? 0 : Math.round((settings.sfx + 0.2) * 10) / 10;
            if (i === 5) settings.music = settings.music >= 1 ? 0 : Math.round((settings.music + 0.2) * 10) / 10;
            applyVolumes();
            saveSettings();
            m.setLabel(i, labels()[i].label);
          } else if (i === 6) {
            const yes = await confirm(this, this.router, '타이틀로 돌아갈까? (진행은 저장된다)', 110, 150);
            if (yes) {
              m.close();
              this.commit(this.save);
              this.scene.start('title');
            }
          } else {
            m.close();
            this.busy = false;
          }
        },
        cancel: () => {
          m.close();
          this.busy = false;
        },
      },
      { width: 160, title: '메뉴' },
    );
  }

  private changeMap(ex: Exit): void {
    this.busy = true;
    sfx('door');
    const cam = this.cameras.main;
    cam.fadeOut(240, 24, 20, 37);
    cam.once('camerafadeoutcomplete', () => {
      const next = { ...this.save, map: ex.to, x: ex.x, y: ex.y, facing: ex.facing };
      writeSave(next);
      this.scene.restart({});
    });
  }

  // ───────────────────────── 디버그 다리(테스트용) ─────────────────────────
  private exposeDebug(): void {
    const w = window as unknown as { __TT?: Record<string, unknown> };
    w.__TT = w.__TT ?? {};
    w.__TT.world = {
      map: () => this.map.id,
      pos: () => ({ x: this.px, y: this.py, facing: this.facing }),
      idle: () => !this.busy && !this.moving && this.router.depth === 1 && this.scene.isActive(),
      walkable: (x: number, y: number) => this.walkable(x, y),
      size: () => ({ w: this.map.rows[0].length, h: this.map.rows.length }),
      objs: () =>
        this.objs.filter((o) => o.sprite.active).map((o) => ({ x: o.x, y: o.y, kind: o.e.kind, id: 'enemy' in o.e ? o.e.enemy : 'id' in o.e ? o.e.id : '' })),
      walls: () => Object.entries(this.map.walls).map(([k, id]) => ({ k, id, broken: this.save.walls.includes(id) })),
      save: () => structuredClone(this.save),
      depth: () => this.router.depth,
      top: () => this.router.topName(),
      active: () => this.scene.isActive(),
    };
    void ENEMIES;
  }
}
