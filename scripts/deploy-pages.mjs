// 빌드 결과(dist)를 gh-pages 브랜치에 강제 없이 새 커밋으로 올린다.
// 임시 워크트리를 쓰므로 현재 작업 브랜치는 건드리지 않는다.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const out = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' }).trim();

run('npm run build');
writeFileSync('dist/.nojekyll', '');
const sha = out('git rev-parse --short HEAD');
const dir = mkdtempSync(join(tmpdir(), 'gh-pages-'));
try {
  const remoteHas = out('git ls-remote --heads origin gh-pages') !== '';
  if (remoteHas) {
    run('git fetch origin gh-pages');
    run(`git worktree add "${dir}" origin/gh-pages --detach`);
  } else {
    run(`git worktree add "${dir}" --detach`);
    run('git checkout --orphan gh-pages-tmp', dir);
  }
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true });
  cpSync('dist', dir, { recursive: true });
  run('git add -A', dir);
  const changed = out('git status --porcelain', dir) !== '';
  if (changed) run(`git commit -m "Deploy ${sha}"`, dir);
  run('git push origin HEAD:gh-pages', dir);
} finally {
  run(`git worktree remove "${dir}" --force`);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  // 첫 배포 때 만든 임시 로컬 브랜치 정리(원격 gh-pages에는 이미 올라가 있다).
  if (out('git branch --list gh-pages-tmp') !== '') run('git branch -D gh-pages-tmp');
}
