import Phaser from 'phaser';
import { audioState, currentMusic } from './audio/audio';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { GalleryScene } from './scenes/GalleryScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { loadFonts } from './ui/fonts';

export const GAME_W = 480;
export const GAME_H = 270;

/** 창에 들어가는 가장 큰 정수 배율(픽셀이 고르게 유지된다). */
function integerZoom(): number {
  const z = Math.floor(Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H));
  return Math.max(1, z);
}

async function start(): Promise<void> {
  try {
    await loadFonts();
  } catch (e) {
    console.warn('폰트 로드 실패, 기본 글꼴 사용', e);
  }
  document.getElementById('boot')?.remove();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#181425',
    scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() },
    audio: { noAudio: true },
    input: { keyboard: true, mouse: true, touch: true, gamepad: false },
    scene: [BootScene, TitleScene, WorldScene, BattleScene, EndingScene, GalleryScene],
  });
  window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));
  const w = window as unknown as { __TT?: Record<string, unknown> };
  w.__TT = w.__TT ?? {};
  // 테스트 봇이 현재 장면과 배율을 확인할 때 쓴다(읽기 전용).
  w.__TT.scenes = () => game.scene.getScenes(true).map((s) => s.scene.key);
  w.__TT.zoom = () => game.scale.zoom;
  w.__TT.audio = () => ({ state: audioState(), music: currentMusic() });
}

void start();
