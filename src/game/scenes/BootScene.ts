import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { sound } from '../../services/sound';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    document.title = APP_NAME;
    sound.startMusic();
    this.scene.start('Menu');
  }
}
