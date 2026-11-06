import Phaser from 'phaser';
import type { SweetType } from '../core/types';

// Every tile texture is drawn procedurally at boot (original vector shapes, no external
// assets) so the 6 sweets stay distinguishable by SHAPE as well as colour.
const SIZE = 128;
const CENTER = SIZE / 2;

export const SWEET_TEXTURE_KEY = (s: SweetType): string => `sweet-${s}`;
export const BOOSTER_TEXTURE_KEY = (b: 'hammer' | 'shuffle'): string => `booster-${b}`;
export const BACKGROUND_KEY = (b: 'home' | 'levelmap'): string => `bg-${b}`;
export const SPECIAL_TEXTURE_KEY = (s: 'striped-h' | 'striped-v' | 'colorbomb' | 'wrapped'): string => `special-${s}`;
export const BLOCKER_TEXTURE_KEY = (b: 'ice1' | 'ice2' | 'locked' | 'honey'): string => `blocker-${b}`;
export const INGREDIENT_TEXTURE_KEY = 'ingredient-badge';
export const TILE_BG_TEXTURE_KEY = 'tile-bg';
export const TILE_SHINE_TEXTURE_KEY = 'tile-shine';
export const GLOW_PARTICLE_TEXTURE_KEY = 'glow-particle';

// A per-sweet accent colour, used to tint match-burst particles so "Tasty!" feels tied to
// what was just matched rather than one generic colour for every match.
export const SWEET_ACCENT_COLOR: Record<SweetType, number> = {
  laddu: 0xf09a35,
  jalebi: 0xf4c430,
  gulabjamun: 0x7a342a,
  barfi: 0x8bb34a,
  rasgulla: 0xe9e4da,
  kajukatli: 0xd9d2c4,
};

function soften(scene: Phaser.Scene, key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
}

function drawLaddu(g: Phaser.GameObjects.Graphics): void {
  // Round, orange, with a lighter highlight and a scatter of darker "sesame" flecks.
  g.fillStyle(0xd4760a, 1);
  g.fillCircle(CENTER, CENTER, 52);
  g.fillStyle(0xf09a35, 1);
  g.fillCircle(CENTER - 10, CENTER - 10, 42);
  g.fillStyle(0x8a4406, 1);
  const flecks = [[-18, -4], [10, -20], [20, 14], [-4, 22], [0, -2]];
  for (const [dx, dy] of flecks) g.fillCircle(CENTER + dx!, CENTER + dy!, 3);
  g.lineStyle(2.5, 0x8a4406, 0.7);
  g.strokeCircle(CENTER, CENTER, 52);
}

function drawJalebi(g: Phaser.GameObjects.Graphics): void {
  // Spiral: a coiled stroke of decreasing radius, yellow/orange.
  g.lineStyle(10, 0xf4c430, 1);
  let radius = 46;
  let angle = 0;
  g.beginPath();
  g.moveTo(CENTER + radius, CENTER);
  for (let i = 1; i <= 60; i++) {
    angle = (i / 60) * Math.PI * 3.4;
    radius = 46 - (i / 60) * 30;
    g.lineTo(CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius);
  }
  g.strokePath();
  g.lineStyle(4, 0xffe07d, 0.8);
  g.strokeCircle(CENTER, CENTER, 50);
}

function drawGulabJamun(g: Phaser.GameObjects.Graphics): void {
  // Dark maroon/brown oval with a soft highlight — deliberately NOT round, to stay
  // distinguishable from laddu/rasgulla by shape, not just colour.
  g.fillStyle(0x5c1f1a, 1);
  g.fillEllipse(CENTER, CENTER, 92, 76);
  g.fillStyle(0x7a342a, 1);
  g.fillEllipse(CENTER - 8, CENTER - 10, 50, 36);
  g.lineStyle(2.5, 0x3a1109, 0.7);
  g.strokeEllipse(CENTER, CENTER, 92, 76);
}

function drawBarfi(g: Phaser.GameObjects.Graphics): void {
  // Square, cream/white base with a green pistachio half and flecks.
  g.fillStyle(0xfbf3e3, 1);
  g.fillRoundedRect(CENTER - 44, CENTER - 44, 88, 88, 6);
  g.fillStyle(0x8bb34a, 1);
  g.fillRoundedRect(CENTER - 44, CENTER - 4, 88, 48, 6);
  g.fillStyle(0x4f7a24, 1);
  const specks = [[-20, 14], [10, 24], [-4, 32], [22, 10]];
  for (const [dx, dy] of specks) g.fillCircle(CENTER + dx!, CENTER + dy!, 3);
  g.lineStyle(3, 0xd8c79a, 1);
  g.strokeRoundedRect(CENTER - 44, CENTER - 44, 88, 88, 6);
}

function drawRasgulla(g: Phaser.GameObjects.Graphics): void {
  // White, round but slightly flattened ("pillow") so it reads differently from laddu's circle.
  g.fillStyle(0xe9e4da, 1);
  g.fillEllipse(CENTER, CENTER, 96, 82);
  g.fillStyle(0xfbfaf6, 1);
  g.fillEllipse(CENTER, CENTER - 4, 70, 58);
  g.lineStyle(2, 0xcfc8b8, 0.8);
  g.strokeEllipse(CENTER, CENTER, 96, 82);
}

function drawKajuKatli(g: Phaser.GameObjects.Graphics): void {
  // Diamond, warm gold-silver with a pink foil corner — previously near-monochrome grey,
  // which read as a generic "locked" icon rather than a sweet; the gold border + blush
  // accent fix that at a glance.
  g.fillStyle(0xf0dca0, 1);
  g.fillPoints(
    [
      { x: CENTER, y: CENTER - 52 },
      { x: CENTER + 46, y: CENTER },
      { x: CENTER, y: CENTER + 52 },
      { x: CENTER - 46, y: CENTER },
    ],
    true,
  );
  g.fillStyle(0xfff6de, 1);
  g.fillPoints(
    [
      { x: CENTER, y: CENTER - 30 },
      { x: CENTER + 26, y: CENTER },
      { x: CENTER, y: CENTER + 30 },
      { x: CENTER - 26, y: CENTER },
    ],
    true,
  );
  g.fillStyle(0xff8fc0, 0.55);
  g.fillTriangle(CENTER - 46, CENTER, CENTER - 20, CENTER - 8, CENTER - 20, CENTER + 8);
  g.lineStyle(3, 0xd9a638, 1);
  g.strokePoints(
    [
      { x: CENTER, y: CENTER - 52 },
      { x: CENTER + 46, y: CENTER },
      { x: CENTER, y: CENTER + 52 },
      { x: CENTER - 46, y: CENTER },
    ],
    true,
  );
  g.lineStyle(2, 0xffffff, 0.8);
  g.strokeLineShape(new Phaser.Geom.Line(CENTER - 18, CENTER - 22, CENTER + 18, CENTER + 22));
}

const SWEET_DRAWERS: Record<SweetType, (g: Phaser.GameObjects.Graphics) => void> = {
  laddu: drawLaddu,
  jalebi: drawJalebi,
  gulabjamun: drawGulabJamun,
  barfi: drawBarfi,
  rasgulla: drawRasgulla,
  kajukatli: drawKajuKatli,
};

export function generateGameTextures(scene: Phaser.Scene): void {
  // TILE_BG_TEXTURE_KEY (not a sweet) is always procedural, so it's a safe "ran this
  // session" guard — unlike a sweet key, which may already exist from BootScene's preload
  // of the real illustrated art (see BootScene.ts) rather than from a prior run of this fn.
  if (scene.textures.exists(TILE_BG_TEXTURE_KEY)) return;

  for (const [sweet, draw] of Object.entries(SWEET_DRAWERS) as [SweetType, (g: Phaser.GameObjects.Graphics) => void][]) {
    if (scene.textures.exists(SWEET_TEXTURE_KEY(sweet))) continue; // preloaded illustrated art takes priority
    soften(scene, SWEET_TEXTURE_KEY(sweet), draw);
  }

  soften(scene, SPECIAL_TEXTURE_KEY('striped-h'), (g) => {
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(4, CENTER - 10, SIZE - 8, 20);
  });
  soften(scene, SPECIAL_TEXTURE_KEY('striped-v'), (g) => {
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(CENTER - 10, 4, 20, SIZE - 8);
  });
  soften(scene, SPECIAL_TEXTURE_KEY('colorbomb'), (g) => {
    g.fillStyle(0x1a1a2e, 0.9);
    g.fillCircle(CENTER, CENTER, 56);
    g.fillStyle(0xffe066, 1);
    const sparkles = [[-20, -16], [18, -10], [-6, 20], [22, 18], [0, -28]];
    for (const [dx, dy] of sparkles) g.fillCircle(CENTER + dx!, CENTER + dy!, 4);
  });
  soften(scene, SPECIAL_TEXTURE_KEY('wrapped'), (g) => {
    g.lineStyle(6, 0xffffff, 0.9);
    g.strokeRoundedRect(10, 10, SIZE - 20, SIZE - 20, 14);
  });

  soften(scene, BLOCKER_TEXTURE_KEY('ice1'), (g) => {
    g.fillStyle(0xaee4f5, 0.55);
    g.fillRect(0, 0, SIZE, SIZE);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(20, 20, 60, 70));
    g.strokeLineShape(new Phaser.Geom.Line(90, 30, 50, 90));
  });
  soften(scene, BLOCKER_TEXTURE_KEY('ice2'), (g) => {
    g.fillStyle(0x6ecbe8, 0.75);
    g.fillRect(0, 0, SIZE, SIZE);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeLineShape(new Phaser.Geom.Line(15, 25, 65, 75));
    g.strokeLineShape(new Phaser.Geom.Line(95, 25, 45, 95));
    g.strokeLineShape(new Phaser.Geom.Line(30, 95, 60, 30));
  });
  soften(scene, BLOCKER_TEXTURE_KEY('locked'), (g) => {
    g.fillStyle(0x5a5a5a, 1);
    g.fillRoundedRect(8, 8, SIZE - 16, SIZE - 16, 10);
    g.fillStyle(0x777777, 1);
    g.fillRoundedRect(8, 8, SIZE - 16, (SIZE - 16) / 2, 10);
  });
  soften(scene, BLOCKER_TEXTURE_KEY('honey'), (g) => {
    g.fillStyle(0xd98f00, 0.6);
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle(0xffb703, 0.6);
    g.fillEllipse(CENTER, SIZE - 20, 60, 24);
  });

  soften(scene, INGREDIENT_TEXTURE_KEY, (g) => {
    g.fillStyle(0xc1272d, 1);
    g.fillCircle(CENTER, CENTER, 14);
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(CENTER - 2, CENTER - 24, 4, 12);
  });

  // Glossy rounded "tray" sat behind every sweet, plus a soft diagonal shine on top of it —
  // the two things that make flat shapes read as polished, tactile tiles instead of stickers.
  // Warm lavender-gold gradient + a gold border (not plain grey/white) for a premium feel.
  soften(scene, TILE_BG_TEXTURE_KEY, (g) => {
    g.fillStyle(0x3a1a5c, 0.18);
    g.fillRoundedRect(6, 10, SIZE - 12, SIZE - 12, 22);
    g.fillGradientStyle(0xfff6e0, 0xfff6e0, 0xf3dcf0, 0xf3dcf0, 1);
    g.fillRoundedRect(4, 4, SIZE - 8, SIZE - 10, 22);
    g.lineStyle(2.5, 0xf5be48, 0.85);
    g.strokeRoundedRect(4, 4, SIZE - 8, SIZE - 10, 22);
  });
  soften(scene, TILE_SHINE_TEXTURE_KEY, (g) => {
    g.fillStyle(0xffffff, 0.4);
    g.fillEllipse(CENTER - 16, CENTER - 34, 66, 24);
    g.fillStyle(0xffffff, 0.16);
    g.fillEllipse(CENTER + 14, CENTER + 36, 44, 14);
  });

  // Soft radial glow for match-burst particles, tinted per-sweet at emit time.
  soften(scene, GLOW_PARTICLE_TEXTURE_KEY, (g) => {
    for (let r = 56; r >= 4; r -= 4) {
      g.fillStyle(0xffffff, 0.06 + ((56 - r) / 56) * 0.5);
      g.fillCircle(CENTER, CENTER, r);
    }
  });
}
