import Phaser from 'phaser';
import { PRODUCTS, getProduct } from '../../config/products.config';
import { billing } from '../../services/billing';
import { loadProfile } from '../../services/profile';
import { makeButton, THEME } from '../ui';
import { sound } from '../../services/sound';

const BADGES: Record<string, string> = {
  coins_900: 'POPULAR',
  coins_2200: 'BEST VALUE',
};

const CARD_HEIGHT = 128;
const CARD_GAP = 20;

export class StoreScene extends Phaser.Scene {
  /** True when launched as an overlay (e.g. the "Get coins" shortcut from the out-of-moves
   *  popup) rather than navigated to from the main menu — changes what the close button does. */
  private isOverlay = false;

  constructor() {
    super('Store');
  }

  init(data: { overlay?: boolean }): void {
    this.isOverlay = data?.overlay ?? false;
  }

  create(): void {
    this.redraw();
  }

  private redraw(): void {
    this.children.removeAll();
    const { width } = this.scale;
    const profile = loadProfile();

    this.add.rectangle(0, 0, width, this.scale.height, THEME.background).setOrigin(0, 0);
    this.add
      .text(24, 24, 'Store', { fontFamily: 'sans-serif', fontSize: '32px', color: THEME.accent, fontStyle: 'bold' })
      .setOrigin(0, 0);
    makeButton(this, width - 50, 44, '✕', () => (this.isOverlay ? this.scene.stop() : this.scene.start('Menu')), {
      fontSize: '22px',
      bg: THEME.royalPurple,
    });
    this.add
      .text(24, 76, `🪙 ${profile.coins}`, { fontFamily: 'sans-serif', fontSize: '22px', color: THEME.text, fontStyle: 'bold' })
      .setOrigin(0, 0);

    let y = 140 + CARD_HEIGHT / 2;
    for (const product of PRODUCTS.filter((p) => p.id !== 'continue_moves_5')) {
      this.renderProductCard(product.id, y);
      y += CARD_HEIGHT + CARD_GAP;
    }
  }

  // A big, glossy gold-bordered card per pack — label and price large and easy to scan at a
  // glance, closer to a real store shelf than a thin settings-style row.
  private renderProductCard(productId: string, y: number): void {
    const { width } = this.scale;
    const product = getProduct(productId)!;
    const badge = BADGES[productId];
    const isLives = product.lives > 0;
    const label = isLives ? `${product.lives} Lives` : `${product.coins} Coins`;
    const price = billing.getLocalizedPrice(productId) ?? `₹${product.fallbackPriceInr}`;
    const cardWidth = width - 40;
    const cx = width / 2;

    const g = this.add.graphics();
    g.fillStyle(0x3a1a5c, 0.16);
    g.fillRoundedRect(cx - cardWidth / 2 + 3, y - CARD_HEIGHT / 2 + 5, cardWidth, CARD_HEIGHT, 24);
    g.fillGradientStyle(0xfffaf0, 0xfffaf0, 0xffe6c4, 0xffe6c4, 1);
    g.fillRoundedRect(cx - cardWidth / 2, y - CARD_HEIGHT / 2, cardWidth, CARD_HEIGHT, 24);
    g.lineStyle(3, Phaser.Display.Color.HexStringToColor(THEME.royalGold).color, badge ? 1 : 0.6);
    g.strokeRoundedRect(cx - cardWidth / 2, y - CARD_HEIGHT / 2, cardWidth, CARD_HEIGHT, 24);

    this.add.text(cx - cardWidth / 2 + 24, y - 6, isLives ? '❤' : '🪙', { fontSize: '44px' }).setOrigin(0, 0.5);
    this.add
      .text(cx - cardWidth / 2 + 84, y - 6, label, { fontFamily: 'sans-serif', fontSize: '28px', color: THEME.text, fontStyle: 'bold' })
      .setOrigin(0, 0.5);

    if (badge) {
      this.add
        .text(cx - cardWidth / 2 + 84, y - 40, badge, {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: THEME.saffronOrange,
          padding: { x: 8, y: 3 },
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
    }

    makeButton(this, cx + cardWidth / 2 - 70, y, price, () => this.buy(productId), { fontSize: '20px' });
  }

  private async buy(productId: string): Promise<void> {
    const outcome = await billing.purchase(productId);
    switch (outcome.kind) {
      case 'granted':
        sound.playSfx('coin');
        this.showToast(`Purchased! +${outcome.coins || outcome.lives}`);
        this.redraw();
        break;
      case 'cancelled':
        break; // no toast — the player just backed out, nothing to say
      case 'already_owned':
        this.showToast('Already owned');
        break;
      case 'pending':
        this.showToast('Purchase pending — check back soon');
        break;
      case 'error':
        this.showToast(outcome.message);
        break;
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
        wordWrap: { width: this.scale.width - 80 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, alpha: 0, duration: 1800, delay: 1200, onComplete: () => text.destroy() });
  }
}
