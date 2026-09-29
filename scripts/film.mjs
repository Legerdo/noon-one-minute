// 연출 검수용 연속 캡처: 보통 속도로 행동을 확정하고 무대 부분만 연속 저장한다.
// 사용: node scripts/film.mjs --enemy=knight --theme=gallery --equip=hammer --pre=sword --frames=8 --step=60 --delay=0 --out=playtest-output/film
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const opt = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = ''] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const enemy = opt.enemy ?? 'knight';
const theme = opt.theme ?? 'gallery';
const equip = opt.equip ?? 'hammer';
const pre = (opt.pre ?? '').split(',').filter(Boolean);
const FRAMES = Number(opt.frames ?? 8);
const STEP = Number(opt.step ?? 60);
const DELAY = Number(opt.delay ?? 0);
const OUT = opt.out ?? 'playtest-output/film';
const TIMES = (opt.times ?? '').split(',').filter(Boolean).map(Number);
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:5288/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: 'load' });
const owned = ['dagger', 'buckler', 'sword', 'hammer', 'tower', 'awl', 'tonic', 'wedge'];
await page.evaluate(
  ([owned, first]) => {
    const loadout = [...first, ...owned.filter((x) => !first.includes(x))].slice(0, 5);
    const flags = ['intro', 'wind', 'fullblock', 'tie', 'enemyGuard', 'pierce', 'pdelay', 'heavyFirst', 'wedge', 'lowHp'].map((f) => `coach_${f}`);
    localStorage.setItem(
      'noon1min.save.v1',
      JSON.stringify({ version: 1, map: 'f1', x: 15, y: 13, facing: 'up', owned, levels: {}, loadout, gears: 0, maxHp: 50, defeated: [], chests: [], walls: [], flags, playTime: 0, battles: 0, losses: 0 }),
    );
    localStorage.setItem('noon1min.settings.v1', JSON.stringify({ sfx: 0, music: 0, speed: 1, shake: 2 }));
  },
  [owned, [equip, ...pre]],
);
await page.goto(`${BASE}?battle=${enemy}&theme=${theme}`, { waitUntil: 'load' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitSel() {
  for (let i = 0; i < 600; i++) {
    const s = await page.evaluate(() => ({ sel: window.__TT?.battle?.selecting?.(), top: window.__TT?.battle?.top?.() }));
    if (s.sel && s.top === 'battle') return;
    if (s.top === 'dialog') await page.keyboard.press('KeyZ');
    await sleep(40);
  }
  throw new Error('선택 창 없음');
}
async function commit(id) {
  await waitSel();
  await sleep(260);
  const idx = await page.evaluate((id) => window.__TT.battle.loadout().indexOf(id), id);
  await page.keyboard.press(`Digit${idx + 1}`);
  await sleep(60);
  await page.keyboard.press('KeyZ');
}
for (const id of pre) await commit(id);
await commit(equip);
const t0 = Date.now();
const box = await page.locator('canvas').boundingBox();
const z = box.width / 480;
const clip = { x: box.x, y: box.y, width: 480 * z, height: 270 * z };
if (TIMES.length) {
  for (const t of TIMES) {
    const wait = t - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    await page.screenshot({ clip, path: `${OUT}/t${String(t).padStart(5, '0')}.png` });
  }
} else {
  await sleep(DELAY);
  for (let i = 0; i < FRAMES; i++) {
    await page.screenshot({ clip, path: `${OUT}/f${String(i).padStart(2, '0')}.png` });
    await sleep(STEP);
  }
}
console.log('saved', OUT, errors.length ? `errors: ${errors.join(' | ')}` : '');
await browser.close();
