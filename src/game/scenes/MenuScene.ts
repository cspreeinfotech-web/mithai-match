import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x1a0f08).setOrigin(0, 0);

    this.add
      .text(width / 2, height * 0.3, APP_NAME, {
        fontFamily: 'Georgia, serif',
        fontSize: '56px',
        color: '#ffd27a',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.4, 'A mithai match-3 adventure', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#f4e3c1',
      })
      .setOrigin(0.5);

    const playButton = this.add
      .text(width / 2, height * 0.6, 'PLAY', {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        color: '#1a0f08',
        backgroundColor: '#ffb84d',
        padding: { x: 40, y: 16 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Phase 3 wires this to the level map scene; it's a placeholder tap target for now.
    playButton.on('pointerdown', () => {
      playButton.setScale(0.95);
    });
    playButton.on('pointerup', () => {
      playButton.setScale(1);
    });
  }
}
