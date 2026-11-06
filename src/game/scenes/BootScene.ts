import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { sound } from '../../services/sound';
import { SWEET_TEXTURE_KEY } from '../textures';
import ladduUrl from '../../assets/sweets/laddu.png';
import jalebiUrl from '../../assets/sweets/jalebi.png';
import gulabjamunUrl from '../../assets/sweets/gulabjamun.png';
import barfiUrl from '../../assets/sweets/barfi.png';
import rasgullaUrl from '../../assets/sweets/rasgulla.png';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // Real illustrated sweet art (kaju katli still uses the procedural vector shape in
  // textures.ts — no generated art for it yet). Loaded here, before Menu/GameScene, so
  // generateGameTextures() sees these keys already populated and skips drawing over them.
  preload(): void {
    this.load.image(SWEET_TEXTURE_KEY('laddu'), ladduUrl);
    this.load.image(SWEET_TEXTURE_KEY('jalebi'), jalebiUrl);
    this.load.image(SWEET_TEXTURE_KEY('gulabjamun'), gulabjamunUrl);
    this.load.image(SWEET_TEXTURE_KEY('barfi'), barfiUrl);
    this.load.image(SWEET_TEXTURE_KEY('rasgulla'), rasgullaUrl);
  }

  create(): void {
    document.title = APP_NAME;
    sound.startMusic();
    this.scene.start('Menu');
  }
}
