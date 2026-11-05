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
    this.add.text(20, 20, 'Store', { fontFamily: 'sans-serif', fontSize: '30px', color: THEME.accent }).setOrigin(0, 0);
    makeButton(this, width - 60, 36, '✕', () => (this.isOverlay ? this.scene.stop() : this.scene.start('Menu')), { fontSize: '26px' });
    this.add.text(width - 20, 70, `🪙 ${profile.coins}`, { fontFamily: 'sans-serif', fontSize: '22px', color: THEME.text }).setOrigin(1, 0);

    let y = 130;
    for (const product of PRODUCTS.filter((p) => p.id !== 'continue_moves_5')) {
      this.renderProductRow(product.id, y);
      y += 100;
    }

    this.add
      .text(width / 2, y + 10, 'Prices shown are from Google Play once connected; the number\nabove is a placeholder until then.', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#8a7c63',
        align: 'center',
      })
      .setOrigin(0.5);
  }

  private renderProductRow(productId: string, y: number): void {
    const { width } = this.scale;
    const product = getProduct(productId)!;
    const badge = BADGES[productId];
    const label = product.lives > 0 ? `${product.lives} Lives` : `${product.coins} Coins`;
    const price = billing.getLocalizedPrice(productId) ?? `₹${product.fallbackPriceInr}`;

    this.add.rectangle(width / 2, y, width - 40, 80, 0xffffff, 0.6).setStrokeStyle(2, 0xe0d5c0);
    this.add.text(40, y, label, { fontFamily: 'sans-serif', fontSize: '22px', color: THEME.text }).setOrigin(0, 0.5);
    if (badge) {
      this.add
        .text(40, y - 26, badge, { fontFamily: 'sans-serif', fontSize: '12px', color: '#ffffff', backgroundColor: '#c9622a', padding: { x: 6, y: 2 } })
        .setOrigin(0, 0.5);
    }
    makeButton(this, width - 100, y, price, () => this.buy(productId), { fontSize: '18px' });
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
