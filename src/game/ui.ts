import Phaser from 'phaser';

// Small shared helpers so every new menu/popup scene doesn't re-derive the same button
// boilerplate. Theme: light cream background, terracotta/saffron accents (see Phase 3).
export const THEME = {
  background: 0xfdf6ec,
  backgroundHex: '#fdf6ec',
  accent: '#c9622a',
  text: '#3a2317',
  subtleText: '#6b4a35',
  buttonBg: '#e07a3d',
  buttonText: '#fdf6ec',
  disabledBg: '#cbbfae',
  overlay: 0x000000,
};

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: { fontSize?: string; bg?: string; color?: string } = {},
): Phaser.GameObjects.Text {
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: 'sans-serif',
      fontSize: options.fontSize ?? '24px',
      color: options.color ?? THEME.buttonText,
      backgroundColor: options.bg ?? THEME.buttonBg,
      padding: { x: 24, y: 10 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerdown', () => btn.setScale(0.95));
  btn.on('pointerup', () => {
    btn.setScale(1);
    onClick();
  });
  return btn;
}

export function makeModalOverlay(scene: Phaser.Scene): { overlay: Phaser.GameObjects.Rectangle; panel: Phaser.GameObjects.Container } {
  const { width, height } = scene.scale;
  const overlay = scene.add.rectangle(0, 0, width, height, THEME.overlay, 0.75).setOrigin(0, 0).setInteractive();
  const panel = scene.add.container(width / 2, height / 2);
  return { overlay, panel };
}
