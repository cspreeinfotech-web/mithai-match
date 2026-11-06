import Phaser from 'phaser';
import { SHOP_STAGES } from '../../config/shop.config';
import { loadProfile, buyDecoration } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, THEME } from '../ui';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(): void {
    this.redraw();
  }

  private redraw(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const profile = loadProfile();
    const lang = profile.language;

    this.add.rectangle(0, 0, width, height, THEME.background).setOrigin(0, 0);
    this.add.text(20, 20, t('mithaiShop', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: THEME.accent }).setOrigin(0, 0);
    makeButton(this, width - 60, 36, '✕', () => this.scene.start('Menu'), { fontSize: '26px' });

    this.add
      .text(width - 20, 70, `🪙 ${profile.coins}`, { fontFamily: 'sans-serif', fontSize: '22px', color: THEME.text })
      .setOrigin(1, 0);

    const stage = [...SHOP_STAGES].reverse().find((s) => profile.currentLevel >= s.unlocksAtLevel) ?? SHOP_STAGES[0]!;
    this.add
      .text(width / 2, 120, stage.name, { fontFamily: 'sans-serif', fontSize: '26px', color: THEME.text })
      .setOrigin(0.5);

    let y = 180;
    for (const deco of stage.decorations) {
      const owned = profile.purchasedDecorations.includes(deco.id);
      this.add.text(40, y, deco.name, { fontFamily: 'sans-serif', fontSize: '20px', color: THEME.subtleText }).setOrigin(0, 0.5);

      if (owned) {
        this.add
          .text(width - 40, y, t('owned', lang), { fontFamily: 'sans-serif', fontSize: '18px', color: '#2f7a4f' })
          .setOrigin(1, 0.5);
      } else {
        // Positioned after creation: the label's width varies with the coin cost's digit
        // count, so a fixed x would let a 4-digit price push the button off the right edge.
        const buyBtn = makeButton(this, 0, y, `${t('buy', lang)} ${deco.cost}🪙`, () => {
          const result = buyDecoration(profile, deco.id, deco.cost);
          if (result) this.redraw();
          else this.showToast(t('notEnoughCoins', lang));
        }, { fontSize: '16px' });
        buyBtn.x = width - 40 - buyBtn.width / 2;
      }
      y += 70;
    }

    const nextStage = SHOP_STAGES.find((s) => s.unlocksAtLevel > profile.currentLevel);
    if (nextStage) {
      this.add
        .text(width / 2, y + 30, `${t('lockedUntilLevel', lang)} ${nextStage.unlocksAtLevel}: ${nextStage.name}`, {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          color: '#8a7c63',
        })
        .setOrigin(0.5);
    }
  }

  private showToast(message: string): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height - 100, message, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, alpha: 0, duration: 1600, delay: 1000, onComplete: () => text.destroy() });
  }
}
