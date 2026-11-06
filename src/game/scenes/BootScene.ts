import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { sound } from '../../services/sound';
import { SWEET_TEXTURE_KEY, BOOSTER_TEXTURE_KEY, BACKGROUND_KEY } from '../textures';
import { addCoverBackground } from '../ui';
import ladduUrl from '../../assets/sweets/laddu.png';
import jalebiUrl from '../../assets/sweets/jalebi.png';
import gulabjamunUrl from '../../assets/sweets/gulabjamun.png';
import barfiUrl from '../../assets/sweets/barfi.png';
import rasgullaUrl from '../../assets/sweets/rasgulla.png';
import kajukatliUrl from '../../assets/sweets/kajukatli.png';
import hammerUrl from '../../assets/boosters/hammer.png';
import shuffleUrl from '../../assets/boosters/shuffle.png';
import homeBgUrl from '../../assets/backgrounds/home.jpg';
import levelmapBgUrl from '../../assets/backgrounds/levelmap.jpg';
import splashBgUrl from '../../assets/backgrounds/splash.jpg';

const SPLASH_MIN_DISPLAY_MS = 1100;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // Real illustrated art for every sweet, the hammer/shuffle boosters, and the home/level-map
  // backgrounds. Loaded here, before Menu/GameScene, so generateGameTextures() sees the sweet
  // keys already populated and skips drawing procedural shapes over them.
  preload(): void {
    this.load.image(SWEET_TEXTURE_KEY('laddu'), ladduUrl);
    this.load.image(SWEET_TEXTURE_KEY('jalebi'), jalebiUrl);
    this.load.image(SWEET_TEXTURE_KEY('gulabjamun'), gulabjamunUrl);
    this.load.image(SWEET_TEXTURE_KEY('barfi'), barfiUrl);
    this.load.image(SWEET_TEXTURE_KEY('rasgulla'), rasgullaUrl);
    this.load.image(SWEET_TEXTURE_KEY('kajukatli'), kajukatliUrl);
    this.load.image(BOOSTER_TEXTURE_KEY('hammer'), hammerUrl);
    this.load.image(BOOSTER_TEXTURE_KEY('shuffle'), shuffleUrl);
    this.load.image(BACKGROUND_KEY('home'), homeBgUrl);
    this.load.image(BACKGROUND_KEY('levelmap'), levelmapBgUrl);
    this.load.image(BACKGROUND_KEY('splash'), splashBgUrl);
  }

  // All assets are already loaded by the time create() runs (Phaser guarantees preload()
  // finishes first), so this isn't a real progress bar — it's a fixed branded dwell, the
  // same UX most mobile games use regardless of how fast the actual load was.
  create(): void {
    document.title = APP_NAME;
    sound.startMusic();

    const { width, height } = this.scale;
    addCoverBackground(this, BACKGROUND_KEY('splash'));
    this.add
      .text(width / 2, height * 0.42, APP_NAME, { fontFamily: 'Georgia, serif', fontSize: '52px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#2a1046', 8, false, true);

    const barWidth = width * 0.6;
    const barY = height * 0.85;
    this.add.rectangle(width / 2, barY, barWidth, 10, 0x2a1046, 0.5).setStrokeStyle(2, 0xf5be48);
    const fill = this.add.rectangle(width / 2 - barWidth / 2, barY, 0, 6, 0xff5ca8).setOrigin(0, 0.5);
    this.add.text(width / 2, barY + 24, 'Loading...', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffe6a8' }).setOrigin(0.5);

    this.tweens.add({
      targets: fill,
      width: barWidth - 4,
      duration: SPLASH_MIN_DISPLAY_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.scene.start('Menu'),
    });
  }
}
