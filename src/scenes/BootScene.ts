import Phaser from 'phaser';
import { generateAllTextures } from '../art/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const t0 = performance.now();
    generateAllTextures(this);
    console.info(`텍스처 생성 ${Math.round(performance.now() - t0)}ms`);
    const params = new URLSearchParams(location.search);
    if (params.has('gallery')) this.scene.start('gallery', { page: Number(params.get('gallery') || 0) });
    else if (params.has('battle')) this.scene.start('battle', { enemyId: params.get('battle'), theme: params.get('theme') ?? 'foyer' });
    else this.scene.start('title');
  }
}
