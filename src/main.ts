import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { GameScene } from './game/scenes/GameScene';

// Portrait-only, safe-area-aware, letterboxed scaling (small phones to tablets).
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#fdf6ec',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  scene: [BootScene, MenuScene, GameScene],
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

// Android hardware back button: let the active scene handle it (its own pause/quit flow)
// instead of the OS default of killing the app outright.
App.addListener('backButton', () => {
  const active = game.scene.getScenes(true)[0] as (GameScene & Phaser.Scene) | undefined;
  if (active?.scene.key === 'Game') {
    active.handleBackButton();
  } else if (active?.scene.key === 'Menu') {
    void App.exitApp();
  }
});

