import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { MapScene } from './game/scenes/MapScene';
import { ShopScene } from './game/scenes/ShopScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { StoreScene } from './game/scenes/StoreScene';
import { GameScene } from './game/scenes/GameScene';
import { PlansScene } from './game/scenes/PlansScene';
import { PaymentHistoryScene } from './game/scenes/PaymentHistoryScene';
import { initCloudSync } from './services/cloudSync';
import { billing } from './services/billing';
import { sound } from './services/sound';

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
  scene: [BootScene, MenuScene, MapScene, ShopScene, SettingsScene, StoreScene, GameScene, PlansScene, PaymentHistoryScene],
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

void initCloudSync(); // best-effort; no-ops entirely if Supabase isn't configured (offline-first)
void billing.initialize(); // no-ops in a browser (no deviceready); MockBilling is instant

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

// Bug fix: music/SFX kept playing after backgrounding the app, because our AudioContext is
// independent of Phaser's own sound manager and nothing else stops it. 'pause'/'resume' cover
// native Android (home button, app switcher); visibilitychange covers the browser/dev preview.
App.addListener('pause', () => sound.suspendAll());
App.addListener('resume', () => sound.resumeAll());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.suspendAll();
  else sound.resumeAll();
});

