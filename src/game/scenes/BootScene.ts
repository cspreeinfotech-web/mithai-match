import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { sound } from '../../services/sound';
import { SWEET_TEXTURE_KEY, BOOSTER_TEXTURE_KEY, BACKGROUND_KEY } from '../textures';
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
  }

  create(): void {
    document.title = APP_NAME;
    sound.startMusic();
    this.scene.start('Menu');
  }
}
