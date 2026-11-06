import Phaser from 'phaser';
import { sound } from '../services/sound';
import { haptics } from '../services/haptics';

// Shared visual language: a premium Indian-sweets palette (royal purple headings, mithai-pink
// CTAs, warm cream backgrounds) applied consistently via makeButton/makeModalOverlay so every
// scene gets the same glossy, readable look for free.
export const THEME = {
  background: 0xfff3d7,
  backgroundHex: '#fff3d7',
  accent: '#6727b5', // royal purple — headings
  text: '#3a2317',
  subtleText: '#6b4a35',
  buttonBg: '#ff5ca8', // mithai pink — primary CTA
  buttonText: '#ffffff',
  disabledBg: '#cbbfae',
  overlay: 0x2a1046,
  // Extended palette for scenes that want a specific accent (boosters, special sweets, etc).
  royalPurple: '#6727b5',
  deepPlum: '#42146d',
  mithaiPink: '#ff5ca8',
  mangoYellow: '#ffc83d',
  saffronOrange: '#ff902e',
  pistachioGreen: '#8bcf65',
  sweetCream: '#fff3d7',
  candyBlue: '#43c8f5',
  royalGold: '#f5be48',
  chocolateBrown: '#79452f',
};

function drawPillBackground(g: Phaser.GameObjects.Graphics, w: number, h: number, baseHex: string): void {
  const radius = h / 2;
  const base = Phaser.Display.Color.HexStringToColor(baseHex);
  const light = Phaser.Display.Color.Interpolate.ColorWithColor(base, Phaser.Display.Color.HexStringToColor('#ffffff'), 100, 30);
  const dark = Phaser.Display.Color.Interpolate.ColorWithColor(base, Phaser.Display.Color.HexStringToColor('#000000'), 100, 22);
  const lightColor = Phaser.Display.Color.GetColor(light.r, light.g, light.b);
  const darkColor = Phaser.Display.Color.GetColor(dark.r, dark.g, dark.b);

  // soft drop shadow
  g.fillStyle(0x1a0a2e, 0.22);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, radius);
  // gradient body
  g.fillGradientStyle(lightColor, lightColor, darkColor, darkColor, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  // glossy top highlight
  g.fillStyle(0xffffff, 0.28);
  g.fillRoundedRect(-w / 2 + w * 0.08, -h / 2 + h * 0.1, w * 0.84, h * 0.34, radius * 0.6);
  // crisp edge
  g.lineStyle(2, darkColor, 0.55);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: { fontSize?: string; bg?: string; color?: string } = {},
): Phaser.GameObjects.Container {
  const fontSize = options.fontSize ?? '24px';
  const textColor = options.color ?? THEME.buttonText;
  const bgHex = options.bg ?? THEME.buttonBg;

  const text = scene.add
    .text(0, 0, label, { fontFamily: 'sans-serif', fontSize, color: textColor, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setShadow(0, 1, '#00000066', 2, false, true);

  const paddingX = 26;
  const w = Math.max(text.width + paddingX * 2, 48);
  const h = Math.max(text.height + 22, 48); // >=48px — comfortable touch target

  const g = scene.add.graphics();
  drawPillBackground(g, w, h, bgHex);

  const container = scene.add.container(x, y, [g, text]);
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerdown', () => container.setScale(0.95));
  container.on('pointerup', () => {
    container.setScale(1);
    sound.playSfx('button');
    void haptics.light();
    onClick();
  });
  container.on('pointerout', () => container.setScale(1));
  return container;
}

export function makeModalOverlay(scene: Phaser.Scene): { overlay: Phaser.GameObjects.Rectangle; panel: Phaser.GameObjects.Container } {
  const { width, height } = scene.scale;
  const overlay = scene.add.rectangle(0, 0, width, height, THEME.overlay, 0.78).setOrigin(0, 0).setInteractive();
  const panel = scene.add.container(width / 2, height / 2);
  return { overlay, panel };
}

// A rounded, gold-bordered card behind a modal's content — every popup used to float its text
// straight on the dark overlay with nothing to frame it; this gives it a real backing panel.
// Draws centered on the panel container's own origin (0,0), so call this before adding content.
export function makeModalCard(scene: Phaser.Scene, panel: Phaser.GameObjects.Container, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const radius = 28;
  g.fillStyle(0x1a0a2e, 0.3);
  g.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, radius);
  g.fillGradientStyle(0xfffaf0, 0xfffaf0, 0xffe6c4, 0xffe6c4, 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  g.lineStyle(3, Phaser.Display.Color.HexStringToColor(THEME.royalGold).color, 0.9);
  g.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  panel.add(g);
  return g;
}
