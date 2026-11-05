import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { loadProfile } from '../../services/profile';
import { LEVELS } from '../../levels';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0xfdf6ec).setOrigin(0, 0);

    this.add
      .text(width / 2, height * 0.3, APP_NAME, {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#c9622a',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.4, 'A mithai match-3 adventure', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#6b4a35',
      })
      .setOrigin(0.5);

    const playButton = this.add
      .text(width / 2, height * 0.6, 'PLAY', {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#fdf6ec',
        backgroundColor: '#e07a3d',
        padding: { x: 40, y: 16 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playButton.on('pointerdown', () => playButton.setScale(0.95));
    playButton.on('pointerup', () => {
      playButton.setScale(1);
      // Phase 4 adds a proper level-map scene; for now Play jumps straight to the next
      // unlocked level (clamped to the last level we actually ship).
      const profile = loadProfile();
      const levelId = Math.min(profile.currentLevel, LEVELS[LEVELS.length - 1]!.id);
      this.scene.start('Game', { levelId });
    });
  }
}
