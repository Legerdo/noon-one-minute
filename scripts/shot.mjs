// 사용: node scripts/shot.mjs <baseUrl> <outDir> <query1> [query2 ...]
// 각 쿼리(예: "?gallery=0")를 열어 스크린샷을 찍고 콘솔 오류를 출력한다.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [, , base, outDir, ...queries] = process.argv;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
for (const q of queries) {
  await page.goto(base + q, { waitUntil: 'load' });
  const title = await page.title();
  if (title !== '정오 1분 전') throw new Error(`다른 앱에 접속함: "${title}" (${base})`);
  await page.waitForTimeout(1800);
  const name = q.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
  await page.locator('canvas').screenshot({ path: `${outDir}/${name}.png` });
  console.log('saved', `${outDir}/${name}.png`);
}
console.log(logs.join('\n'));
await browser.close();
