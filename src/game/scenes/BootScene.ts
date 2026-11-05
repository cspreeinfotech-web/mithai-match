import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Phase 1: no assets yet. Later phases load the SVG texture atlas and audio here.
  }

  create(): void {
    document.title = APP_NAME;
    this.scene.start('Menu');
  }
}
