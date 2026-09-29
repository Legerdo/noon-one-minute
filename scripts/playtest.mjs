// 실제 브라우저에서 키보드·마우스로 처음부터 엔딩까지 플레이하는 검증 봇.
// 사용: (dev 서버 실행 중) node scripts/playtest.mjs [baseUrl]
// 게임 상태는 window.__TT(읽기 전용 디버그 다리)로 관찰하고, 조작은 오직 입력 이벤트로만 한다.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5288/';
const OUT = 'playtest-output/run';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
const page = await ctx.newPage();
const problems = [];
const report = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 6).join('\n')}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (fn, arg) => page.evaluate(fn, arg);
let shotN = 0;
async function shot(name) {
  shotN++;
  const file = `${OUT}/${String(shotN).padStart(2, '0')}_${name}.png`;
  await page.locator('canvas').screenshot({ path: file });
  return file;
}
async function waitFor(pred, desc, timeout = 30000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (await ev(pred, arg)) return;
    } catch {
      /* 장면 전환 중 */
    }
    await sleep(40);
  }
  throw new Error(`시간 초과: ${desc}`);
}
async function tap(code, hold = 45) {
  await page.keyboard.down(code);
  await sleep(hold);
  await page.keyboard.up(code);
}
function log(s) {
  report.push(s);
  console.log(s);
}
function check(cond, what) {
  log(`${cond ? 'PASS' : 'FAIL'}  ${what}`);
  if (!cond) problems.push(`[check] ${what}`);
}

// ───────────────────────── 탐험 ─────────────────────────
const ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const worldTop = () => ev(() => (window.__TT?.world?.active?.() ? window.__TT.world.top() : 'x'));
const worldPos = () => ev(() => window.__TT.world.pos());

async function drainWorld(maxMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const top = await worldTop();
    if (top === 'dialog') {
      await tap('KeyZ');
      await sleep(110);
      continue;
    }
    const idle = await ev(() => !!window.__TT?.world?.active?.() && window.__TT.world.idle());
    if (idle) return;
    await sleep(60);
  }
  throw new Error('대화/연출이 끝나지 않음');
}

async function grid() {
  return ev(() => {
    const w = window.__TT.world;
    const { w: W, h: H } = w.size();
    const g = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) row.push(w.walkable(x, y));
      g.push(row);
    }
    return g;
  });
}

function bfs(g, sx, sy, tx, ty) {
  const H = g.length;
  const W = g[0].length;
  const prev = new Map();
  const k = (x, y) => y * W + x;
  const q = [[sx, sy]];
  prev.set(k(sx, sy), null);
  const dirs = [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [d, dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (!g[ny][nx] || prev.has(k(nx, ny))) continue;
      prev.set(k(nx, ny), [x, y, d]);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(k(tx, ty))) return null;
  const path = [];
  let cur = [tx, ty];
  while (prev.get(k(cur[0], cur[1]))) {
    const [px, py, d] = prev.get(k(cur[0], cur[1]));
    path.unshift(d);
    cur = [px, py];
  }
  return path;
}

async function walkTo(tx, ty) {
  const startMap = await ev(() => window.__TT.world.map());
  for (let attempt = 0; attempt < 6; attempt++) {
    await drainWorld();
    // 계단을 밟아 층이 바뀌었으면 도착한 것으로 본다.
    if ((await ev(() => window.__TT.world.map())) !== startMap) return;
    const p = await worldPos();
    if (p.x === tx && p.y === ty) return;
    const path = bfs(await grid(), p.x, p.y, tx, ty);
    if (!path) throw new Error(`경로 없음 (${p.x},${p.y})→(${tx},${ty})`);
    for (const d of path) {
      await drainWorld();
      const before = await worldPos();
      await tap(ARROW[d], 40);
      await waitFor(
        (b) => {
          const w = window.__TT.world;
          if (!w.active()) return true;
          const q = w.pos();
          return q.x !== b.x || q.y !== b.y;
        },
        `이동 ${d}`,
        700,
        before,
      ).catch(() => {});
      await sleep(170);
      const now = await ev(() => (window.__TT.world.active() ? window.__TT.world.pos() : null));
      if (!now) return; // 층 이동
      if (now.x === tx && now.y === ty) return;
      if (now.x === before.x && now.y === before.y) break; // 막힘 → 경로 재계산
    }
  }
  if ((await ev(() => window.__TT.world.map())) !== startMap) return;
  const p = await worldPos();
  if (p.x !== tx || p.y !== ty) throw new Error(`도착 실패 (${p.x},${p.y}) 목표 (${tx},${ty})`);
}

async function face(d) {
  await drainWorld();
  await tap(ARROW[d], 30);
  await sleep(120);
}

async function interact() {
  await drainWorld();
  await tap('KeyZ');
  await sleep(250);
}

async function useAt(x, y, d) {
  await walkTo(x, y);
  await face(d);
  await interact();
}

// 메뉴 항목 고르기: 현재 top이 menu일 때 아래로 n번, 확정
async function menuPick(n, scope = 'world') {
  const topFn = scope === 'world' ? worldTop : battleTop;
  await waitFor(
    (s) => (s === 'world' ? window.__TT.world.top() : window.__TT.battle.top()) === 'menu',
    '메뉴 열림',
    8000,
    scope,
  );
  await sleep(220);
  for (let i = 0; i < n; i++) {
    await tap('ArrowDown', 30);
    await sleep(60);
  }
  await tap('KeyZ');
  await sleep(250);
  void topFn;
}

async function setLoadoutViaMenu(target) {
  await drainWorld();
  const save = await ev(() => window.__TT.world.save());
  await tap('KeyX'); // 메뉴
  await menuPick(0); // 장비 구성
  await waitFor(() => window.__TT.world.top() === 'loadout', '장비 구성 창', 5000);
  await sleep(220);
  const owned = save.owned;
  const cur = new Set(save.loadout);
  // 빼기 먼저, 그다음 넣기
  const ops = [];
  owned.forEach((id, i) => {
    if (cur.has(id) && !target.includes(id)) ops.push(i);
  });
  owned.forEach((id, i) => {
    if (!cur.has(id) && target.includes(id)) ops.push(i);
  });
  let at = 0;
  for (const i of ops) {
    while (at < i) {
      await tap('ArrowDown', 25);
      await sleep(45);
      at++;
    }
    while (at > i) {
      await tap('ArrowUp', 25);
      await sleep(45);
      at--;
    }
    await tap('KeyZ');
    await sleep(120);
  }
  await tap('KeyX'); // 완료
  await sleep(250);
  await tap('KeyX'); // 메뉴 닫기
  await sleep(250);
  const after = await ev(() => window.__TT.world.save().loadout);
  check(target.every((t) => after.includes(t)) && after.length === target.length, `로드아웃 변경 → ${after.join(',')}`);
}

async function untilTop(name, scope = 'world', timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const top = scope === 'world' ? await worldTop() : await battleTop();
    if (top === name) return;
    if (top === 'dialog') await tap('KeyZ');
    await sleep(110);
  }
  throw new Error(`${name} 창이 열리지 않음`);
}

async function upgradeAtBench(standX, standY, dir, ids) {
  await useAt(standX, standY, dir);
  await untilTop('menu'); // (첫 사용 대화 후) 작업대 메뉴
  for (const id of ids) {
    const save = await ev(() => window.__TT.world.save());
    const idx = save.owned.indexOf(id);
    if (idx < 0) continue;
    // 강화 창을 새로 열면 커서는 맨 위
    await menuPick(0);
    await waitFor(() => window.__TT.world.top() === 'upgrade', '강화 창', 5000);
    await sleep(260);
    for (let i = 0; i < idx; i++) {
      await tap('ArrowDown', 25);
      await sleep(45);
    }
    const g0 = save.gears;
    const lv0 = save.levels[id] ?? 1;
    await tap('KeyZ');
    await sleep(300);
    if ((await worldTop()) === 'menu') {
      // 확인 창 "예" + 곧바로 한 번 더 연타
      await tap('KeyZ', 30);
      await sleep(40);
      await tap('KeyZ', 30);
      await sleep(500);
      if ((await worldTop()) === 'menu') {
        await tap('KeyX');
        await sleep(250);
      }
    }
    const s2 = await ev(() => window.__TT.world.save());
    const lv1 = s2.levels[id] ?? 1;
    log(`  강화 ${id}: Lv${lv0}→Lv${lv1}, 톱니 ${g0}→${s2.gears}`);
    check(lv1 <= lv0 + 1, `강화 연타가 두 번 처리되지 않음 (${id})`);
    await tap('KeyX'); // 강화 창 닫기 → 작업대 메뉴
    await sleep(260);
  }
  await tap('KeyX'); // 작업대 메뉴 닫기
  await sleep(250);
  await drainWorld();
}

// ───────────────────────── 전투 ─────────────────────────
const battleTop = () => ev(() => (window.__TT?.battle?.active?.() ? window.__TT.battle.top() : 'x'));

async function slotCenter(i) {
  const box = await page.locator('canvas').boundingBox();
  const zoom = await ev(() => window.__TT.zoom());
  return { x: box.x + (6 + i * 49 + 23) * zoom, y: box.y + (202 + 32) * zoom };
}

async function fight(label, opts = {}) {
  const policy = opts.policy ?? 'best';
  await waitFor(() => window.__TT?.battle?.active?.(), `${label} 전투 시작`, 20000);
  if (opts.fast !== false) await page.keyboard.down('ShiftLeft');
  let turns = 0;
  let shots = 0;
  let result = null;
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 240000) throw new Error(`${label} 전투가 끝나지 않음`);
    const s = await ev(() => {
      const b = window.__TT?.battle;
      if (!b || !b.active()) return { active: false };
      return { active: true, phase: b.phase(), sel: b.selecting(), top: b.top(), status: b.state().status, hp: b.state().p.hp, ehp: b.state().e.hp, turn: b.state().turn };
    });
    if (!s.active) break;
    if (s.status !== 'await' && !result) result = s.status;
    if (s.top === 'dialog') {
      await tap('KeyZ');
      await sleep(100);
      continue;
    }
    if (s.top === 'reward') {
      await sleep(400);
      await shot(`${label}_reward`);
      await tap('KeyZ');
      await sleep(400);
      continue;
    }
    if (s.phase === 'ended' && s.top === 'menu') {
      // 패배 메뉴
      await sleep(300);
      await shot(`${label}_defeat`);
      if (opts.onDefeat === 'retry') {
        await tap('KeyZ');
        await sleep(600);
        return { result: 'defeat-retry', turns };
      }
      await tap('KeyZ');
      await sleep(600);
      return { result: 'defeat', turns };
    }
    if (s.sel && s.top === 'battle') {
      await sleep(230); // 선택 창 입력 잠금(200ms) 이후
      let id;
      if (policy === 'best') id = await ev(() => window.__TT.battle.best());
      else id = policy;
      const lo = await ev(() => window.__TT.battle.loadout());
      const idx = lo.indexOf(id);
      if (opts.dblclick && turns === 0) {
        const before = await ev(() => window.__TT.battle.state().turn);
        const c = await slotCenter(idx);
        await page.mouse.move(c.x, c.y);
        await sleep(120);
        const st0 = await ev(() => JSON.stringify(window.__TT.battle.state()));
        // 다른 슬롯 위를 훑어도(hover) 상태는 그대로여야 한다
        for (let k = 0; k < lo.length; k++) {
          const ck = await slotCenter(k);
          await page.mouse.move(ck.x, ck.y);
          await sleep(40);
        }
        const st1 = await ev(() => JSON.stringify(window.__TT.battle.state()));
        check(st0 === st1, 'hover·미리보기는 전투 상태를 바꾸지 않음');
        await page.mouse.move(c.x, c.y);
        await sleep(60);
        await page.mouse.dblclick(c.x, c.y);
        await sleep(1500);
        const after = await ev(() => window.__TT.battle.state().turn);
        const commits = await ev(() => window.__TT.battle.log().filter((e) => e.t === 'commit').length);
        check(after === before + 1 && commits === 1, `더블 클릭은 행동 하나만 확정 (turn ${before}→${after}, commit ${commits})`);
        turns++;
        continue;
      }
      await tap(`Digit${idx + 1}`, 30);
      await sleep(60);
      await tap('KeyZ');
      turns++;
      await waitFor(() => !window.__TT.battle.active() || !window.__TT.battle.selecting(), '확정 반영', 3000).catch(async () => {
        await tap('KeyZ');
      });
      if (opts.midShots && shots < opts.midShots && turns % 2 === 1) {
        await page.keyboard.up('ShiftLeft');
        await sleep(opts.midDelay ?? 380);
        await shot(`${label}_t${turns}`);
        shots++;
        if (opts.fast !== false) await page.keyboard.down('ShiftLeft');
      }
      continue;
    }
    await sleep(50);
  }
  await page.keyboard.up('ShiftLeft');
  log(`  전투 ${label}: ${result} (${turns}수)`);
  return { result, turns };
}

// ───────────────────────── 시나리오 ─────────────────────────
async function main() {
  await page.goto(BASE, { waitUntil: 'load' });
  if ((await page.title()) !== '정오 1분 전') throw new Error('다른 앱에 접속함');
  await ev(() => {
    localStorage.clear();
    localStorage.setItem('noon1min.settings.v1', JSON.stringify({ sfx: 0.8, music: 0.6, speed: 3, shake: 2 }));
  });
  await page.reload({ waitUntil: 'load' });
  await waitFor(() => window.__TT?.scenes?.().includes('title'), '타이틀');
  await sleep(900);
  await shot('title');
  await tap('Enter');
  await waitFor(() => window.__TT?.world?.active?.(), '1층 진입');
  await sleep(500);
  await shot('f1_intro_dialog');
  await drainWorld();
  await shot('f1_start');
  check((await ev(() => window.__TT.world.map())) === 'f1', '새 게임은 1층에서 시작');
  const au = await ev(() => window.__TT.audio());
  check(au.state === 'running' && au.music === 'foyer', `오디오 동작 (${au.state}, 곡 ${au.music})`);

  // 맨손으로 쥐에게 가면 막힌다
  await useAt(15, 7, 'up');
  check((await worldTop()) === 'dialog', '장비 없이 전투 불가(안내 대사)');
  await drainWorld();
  // 장비를 얻은 뒤에도 연습 인형 전에는 쥐와 싸울 수 없다(아래에서 확인)

  // 공구함
  await useAt(7, 9, 'up');
  await sleep(600);
  await shot('f1_kit');
  await drainWorld();
  let save = await ev(() => window.__TT.world.save());
  check(save.owned.includes('dagger') && save.owned.includes('buckler'), '공구함: 단검·버클러 획득');
  // 같은 상자 재조사 → 중복 지급 없음
  await interact();
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.owned.filter((x) => x === 'dagger').length === 1, '상자 재조사로 장비 복제 없음');
  await useAt(15, 7, 'up');
  await sleep(200);
  const blockedTop = await worldTop();
  check(blockedTop === 'dialog', `연습 인형 전에는 태엽 쥐와 전투 불가 (${blockedTop})`);
  await drainWorld();

  // 연습 인형: 더블 클릭·hover 검사
  await useAt(5, 10, 'left');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비 화면', 5000);
  await sleep(300);
  await shot('prebattle_dummy');
  await tap('KeyZ');
  const rDummy = await fight('dummy', { dblclick: true, fast: true });
  check(rDummy.result === 'victory', '연습 인형 승리');
  await drainWorld();

  // 태엽 쥐 (튜토리얼): 연출 스크린샷
  await useAt(15, 7, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await tap('KeyZ');
  const rRat = await fight('rat', { midShots: 3, midDelay: 420, fast: false });
  check(rRat.result === 'victory', '태엽 쥐 승리');
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.gears === 1 && save.defeated.includes('rat'), '쥐 보상 톱니 1');

  // 장검
  await useAt(18, 3, 'right');
  await drainWorld();
  // 파수병: 일부러 한 번 지고(버클러만) 다시 도전 → 최적 전략으로 승리
  await useAt(15, 3, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await tap('KeyZ');
  const lose = await fight('sentry_lose', { policy: 'buckler', onDefeat: 'retry', fast: true });
  check(lose.result === 'defeat-retry', '패배 후 다시 도전 메뉴');
  await waitFor(() => window.__TT?.battle?.active?.() && window.__TT.battle.state().turn === 0, '재도전 시작', 10000);
  const retryState = await ev(() => window.__TT.battle.state());
  check(retryState.p.hp === retryState.p.maxHp && retryState.e.hp === retryState.e.maxHp, '재도전은 양측 HP 최대에서 시작');
  save = await ev(() => JSON.parse(localStorage.getItem('noon1min.save.v1')));
  check(save.losses === 1 && save.gears === 1, '패배로 자원 손실 없음(톱니 유지)');
  const rSentry = await fight('sentry', { fast: true });
  check(rSentry.result === 'victory', '파수병 승리');
  await drainWorld();

  // 2층
  await walkTo(15, 1);
  await waitFor(() => window.__TT?.world?.active?.() && window.__TT.world.map() === 'f2', '2층 이동', 10000);
  await sleep(400);
  await drainWorld();
  await shot('f2_start');
  await useAt(9, 12, 'left'); // 대망치
  await drainWorld();
  await useAt(7, 10, 'left'); // 금 간 벽
  await waitFor(() => window.__TT.world.top() === 'menu', '벽 부수기 확인', 5000);
  await tap('KeyZ');
  await sleep(700);
  await drainWorld();
  const walls = await ev(() => window.__TT.world.walls());
  check(walls.some((w) => w.id === 'f2_wall' && w.broken), '대망치로 금 간 벽 파괴');
  await shot('f2_wall_broken');
  await useAt(4, 10, 'left'); // 틈새 상자
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.gears === 3, '톱니 3개 보유(쥐·파수병·틈새)');
  await upgradeAtBench(25, 10, 'up', ['hammer', 'sword']);
  save = await ev(() => window.__TT.world.save());
  check((save.levels.hammer ?? 1) === 2 && (save.levels.sword ?? 1) === 2 && save.gears === 1, '작업대 강화: 대망치·장검 Lv2');
  await shot('f2_after_upgrade');

  // 진자 기사
  await useAt(14, 7, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await tap('KeyZ');
  const rKnight = await fight('knight', { midShots: 2, midDelay: 700, fast: false });
  check(rKnight.result === 'victory', '진자 기사 승리');
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.owned.includes('tower'), '기사 보상: 종루 대방패');

  // 벌떼
  await useAt(14, 3, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await tap('KeyZ');
  const rSwarm = await fight('swarm', { midShots: 1, midDelay: 500, fast: true });
  check(rSwarm.result === 'victory', '톱니 벌떼 승리');
  await drainWorld();

  // 이어하기 검증: 새로고침 → 타이틀 → 이어하기
  const beforeReload = await ev(() => window.__TT.world.save());
  await page.reload({ waitUntil: 'load' });
  await waitFor(() => window.__TT?.scenes?.().includes('title'), '타이틀(새로고침)');
  await sleep(700);
  await tap('Enter'); // 이어하기가 기본 선택
  await waitFor(() => window.__TT?.world?.active?.(), '이어하기 진입');
  await drainWorld();
  const afterReload = await ev(() => window.__TT.world.save());
  check(
    afterReload.map === beforeReload.map &&
      afterReload.x === beforeReload.x &&
      afterReload.y === beforeReload.y &&
      afterReload.gears === beforeReload.gears &&
      afterReload.defeated.length === beforeReload.defeated.length,
    `이어하기: 위치·톱니·처치 기록 유지 (${afterReload.map} ${afterReload.x},${afterReload.y} 톱니${afterReload.gears})`,
  );
  // 1층 비밀방(대망치 필요)으로 되돌아가기
  await walkTo(14, 14);
  await waitFor(() => window.__TT?.world?.active?.() && window.__TT.world.map() === 'f1', '1층으로', 10000);
  await drainWorld();
  await useAt(20, 10, 'right');
  await waitFor(() => window.__TT.world.top() === 'menu', '벽 부수기 확인', 5000);
  await tap('KeyZ');
  await sleep(700);
  await drainWorld();
  await useAt(24, 10, 'up');
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.maxHp === 45, '1층 비밀방: 태엽 심장(최대 체력 45)');
  await walkTo(15, 1);
  await waitFor(() => window.__TT?.world?.active?.() && window.__TT.world.map() === 'f2', '2층', 10000);
  await drainWorld();
  await walkTo(14, 1);
  await waitFor(() => window.__TT?.world?.active?.() && window.__TT.world.map() === 'f3', '3층', 10000);
  await sleep(400);
  await drainWorld();
  await shot('f3_start');

  // 3층
  await useAt(8, 12, 'left'); // 송곳
  await drainWorld();
  await upgradeAtBench(24, 12, 'up', ['awl', 'tower']);
  await setLoadoutViaMenu(['buckler', 'sword', 'hammer', 'tower', 'awl']);
  await useAt(14, 10, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await sleep(200);
  await shot('prebattle_tortoise');
  await tap('KeyZ');
  const rTort = await fight('tortoise', { midShots: 1, midDelay: 500, fast: true });
  check(rTort.result === 'victory', '무쇠 거북 승리');
  await drainWorld();
  await useAt(20, 6, 'right'); // 모래시계 약
  await drainWorld();
  await walkTo(7, 6); // 바람 힌트
  await drainWorld();
  await walkTo(4, 6); // 숨은 통로
  await sleep(500);
  await shot('f3_secret');
  await drainWorld();
  await face('left');
  await interact();
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.maxHp === 50 && save.flags.includes('secret_f3'), '3층 숨은 방: 태엽 심장(최대 체력 50)');
  await setLoadoutViaMenu(['dagger', 'sword', 'hammer', 'awl', 'tonic']);
  await useAt(14, 3, 'up');
  await waitFor(() => window.__TT.world.top() === 'menu', '전투 준비', 5000);
  await tap('KeyZ');
  const rHex = await fight('hexer', { midShots: 1, midDelay: 450, fast: true });
  check(rHex.result === 'victory', '녹 주술사 승리');
  await drainWorld();
  save = await ev(() => window.__TT.world.save());
  check(save.owned.includes('wedge'), '주술사 보상: 시간 쐐기');

  // 꼭대기
  await walkTo(14, 1);
  await waitFor(() => window.__TT?.world?.active?.() && window.__TT.world.map() === 'f4', '꼭대기', 10000);
  await sleep(400);
  await shot('f4_intro');
  await drainWorld();
  await useAt(20, 12, 'right'); // 할아버지
  await drainWorld();
  await shot('f4_grandpa');
  save = await ev(() => window.__TT.world.save());
  const want = ['hammer', 'wedge', 'tonic', 'tower', 'awl'].filter((id) => (save.levels[id] ?? 1) < 3);
  await upgradeAtBench(8, 13, 'left', want);
  await setLoadoutViaMenu(['hammer', 'tower', 'awl', 'tonic', 'wedge']);
  await useAt(14, 10, 'up');
  await untilTop('menu'); // 보스 대사 → 전투 준비
  await sleep(250);
  await shot('prebattle_boss');
  await tap('KeyZ');
  const rBoss = await fight('boss', { midShots: 3, midDelay: 520, fast: true });
  check(rBoss.result === 'victory', '녹슨 대진자 승리');

  // 엔딩
  await waitFor(() => window.__TT?.scenes?.().includes('ending'), '엔딩', 20000);
  await sleep(3800);
  await shot('ending_bells');
  for (let i = 0; i < 60; i++) {
    const top = await ev(() => window.__TT?.ending?.top?.() ?? '');
    if (top === 'ending') break;
    if (top === 'dialog') await tap('KeyZ');
    await sleep(160);
  }
  await sleep(500);
  await shot('ending_stats');
  await tap('KeyZ');
  await waitFor(() => window.__TT?.scenes?.().includes('title'), '엔딩 후 타이틀', 10000);
  const final = await ev(() => JSON.parse(localStorage.getItem('noon1min.save.v1')));
  check(final.flags.includes('cleared'), '클리어 기록 저장');
  log(`최종: 전투 ${final.battles}회, 패배 ${final.losses}회, 톱니 ${final.gears}, 최대 HP ${final.maxHp}`);

  // 창 크기: 정수 배율 유지
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
    [1000, 620],
    [1600, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(300);
    const r = await ev(() => {
      const c = document.querySelector('canvas');
      const b = c.getBoundingClientRect();
      return { cw: b.width, ch: b.height, zoom: window.__TT.zoom() };
    });
    const ok = Number.isInteger(r.zoom) && Math.abs(r.cw - 480 * r.zoom) < 0.5 && Math.abs(r.ch - 270 * r.zoom) < 0.5;
    check(ok, `창 ${w}x${h}: 배율 ${r.zoom} (캔버스 ${r.cw}x${r.ch})`);
  }
}

try {
  await main();
} catch (e) {
  problems.push(`[fatal] ${e.message}`);
  log(`FATAL ${e.message}`);
  await shot('fatal').catch(() => {});
  const dump = await ev(() => {
    const w = window.__TT?.world;
    return {
      scenes: window.__TT?.scenes?.(),
      map: w?.map?.(),
      pos: w?.pos?.(),
      top: w?.top?.(),
      idle: w?.idle?.(),
      objs: w?.objs?.(),
      defeated: w?.save?.().defeated,
    };
  }).catch((err) => ({ err: String(err) }));
  log(`상태: ${JSON.stringify(dump)}`);
}
const filtered = problems.filter((p) => !/favicon|GPU stall|WebGL/i.test(p));
log(`\n문제 ${filtered.length}건`);
for (const p of filtered) log(`  ${p}`);
writeFileSync(`${OUT}/report.txt`, report.join('\n'));
await browser.close();
process.exit(filtered.length ? 1 : 0);
