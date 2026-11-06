import Phaser from 'phaser';
import { loadProfile } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, THEME } from '../ui';
import { myPaymentOrders, type PaymentOrder } from '../../services/payments';

export class PaymentHistoryScene extends Phaser.Scene {
  private orders: PaymentOrder[] = [];

  constructor() {
    super('PaymentHistory');
  }

  create(): void {
    this.redraw();
    void myPaymentOrders().then((orders) => {
      this.orders = orders;
      this.redraw();
    });
  }

  private redraw(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const lang = loadProfile().language;

    this.add.rectangle(0, 0, width, height, THEME.background).setOrigin(0, 0);
    this.add.text(20, 20, t('paymentHistory', lang), { fontFamily: 'sans-serif', fontSize: '26px', color: THEME.accent }).setOrigin(0, 0);
    makeButton(this, width - 60, 36, '✕', () => this.scene.start('Plans'), { fontSize: '26px' });

    let y = 100;
    for (const order of this.orders) {
      this.add
        .text(30, y, `${order.plan_name} — ${order.status.toUpperCase()}`, { fontFamily: 'sans-serif', fontSize: '16px', color: THEME.text })
        .setOrigin(0, 0);
      this.add
        .text(30, y + 20, `${t('reference', lang)}: ${order.reference}${order.utr ? '  UTR: ' + order.utr : ''}`, {
          fontFamily: 'sans-serif', fontSize: '12px', color: THEME.subtleText,
        })
        .setOrigin(0, 0);
      this.add
        .text(30, y + 38, new Date(order.created_at).toLocaleString(), { fontFamily: 'sans-serif', fontSize: '11px', color: THEME.subtleText })
        .setOrigin(0, 0);
      y += 68;
    }

    if (this.orders.length === 0) {
      this.add.text(width / 2, height / 2, '—', { fontFamily: 'sans-serif', fontSize: '20px', color: THEME.subtleText }).setOrigin(0.5);
    }
  }
}
