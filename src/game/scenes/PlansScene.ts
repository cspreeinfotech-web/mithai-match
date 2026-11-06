import Phaser from 'phaser';
import { loadProfile } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, makeModalOverlay, THEME } from '../ui';
import { getSupabase } from '../../services/supabaseClient';
import { plansForMe, buyPlan, claimFreePlan, grantOrderOnce, type Plan, type PaymentOrder } from '../../services/payments';

type LoadState = 'loading' | 'error' | 'loaded';

export class PlansScene extends Phaser.Scene {
  private loadState: LoadState = 'loading';
  private plans: Plan[] = [];

  constructor() {
    super('Plans');
  }

  create(): void {
    this.redraw();
    void this.loadPlans();

    // Live price/plan changes from the admin panel land here within seconds.
    const supabase = getSupabase();
    if (supabase) {
      const channel = supabase
        .channel('settings_version_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings_version' }, () => void this.loadPlans())
        .subscribe();
      this.events.once('shutdown', () => void channel.unsubscribe());
    }
  }

  private async loadPlans(): Promise<void> {
    this.loadState = 'loading';
    this.redraw();
    try {
      this.plans = await plansForMe();
      this.loadState = 'loaded';
    } catch {
      this.loadState = 'error';
    }
    this.redraw();
  }

  private redraw(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const profile = loadProfile();
    const lang = profile.language;

    this.add.rectangle(0, 0, width, height, THEME.background).setOrigin(0, 0);
    this.add.text(20, 20, t('plans', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: THEME.accent }).setOrigin(0, 0);
    this.add.text(20, 56, `🪙 ${profile.coins}`, { fontFamily: 'sans-serif', fontSize: '18px', color: THEME.text }).setOrigin(0, 0.5);
    makeButton(this, width - 60, 36, '✕', () => this.scene.start('Menu'), { fontSize: '26px' });

    if (this.loadState === 'loading') {
      this.add.text(width / 2, height / 2, t('loading', lang), { fontFamily: 'sans-serif', fontSize: '20px', color: THEME.text }).setOrigin(0.5);
      return;
    }
    if (this.loadState === 'error') {
      this.add.text(width / 2, height / 2 - 30, 'Something went wrong.', { fontFamily: 'sans-serif', fontSize: '20px', color: THEME.text }).setOrigin(0.5);
      makeButton(this, width / 2, height / 2 + 30, t('retry', lang), () => void this.loadPlans());
      return;
    }

    let y = 100;
    if (this.plans.length === 0) {
      this.add.text(width / 2, y + 40, t('planUnavailable', lang), { fontFamily: 'sans-serif', fontSize: '18px', color: THEME.subtleText }).setOrigin(0.5);
      return;
    }
    if (this.plans.every((p) => p.pay_mode === 'free')) {
      this.add.text(width / 2, y, t('freeModeActive', lang), { fontFamily: 'sans-serif', fontSize: '16px', color: THEME.accent }).setOrigin(0.5);
      y += 36;
    }

    for (const plan of this.plans) {
      const title = `🪙 ${plan.coins} Coins` + (plan.badge ? ` (${plan.badge})` : '');
      this.add.text(40, y, title, { fontFamily: 'sans-serif', fontSize: '20px', color: THEME.text }).setOrigin(0, 0.5);
      this.add.text(40, y + 22, plan.perks.join(' · '), { fontFamily: 'sans-serif', fontSize: '13px', color: THEME.subtleText }).setOrigin(0, 0.5);

      const label =
        plan.pay_mode === 'free' ? t('claimFree', lang)
        : plan.pay_mode === 'unavailable' ? t('planUnavailable', lang)
        : `${t('buyNow', lang)} ₹${(plan.price_paise / 100).toFixed(0)}`;

      makeButton(this, width - 90, y + 8, label, () => void this.onPlanTapped(plan), {
        fontSize: '14px',
        bg: plan.pay_mode === 'unavailable' ? THEME.disabledBg : THEME.buttonBg,
      });
      y += 72;
    }

    makeButton(this, width / 2, y + 10, t('paymentHistory', lang), () => this.scene.start('PaymentHistory'), { fontSize: '16px', bg: '#8a7c63' });
  }

  private async onPlanTapped(plan: Plan): Promise<void> {
    if (plan.pay_mode === 'unavailable') return;

    if (plan.pay_mode === 'free') {
      try {
        grantOrderOnce(await claimFreePlan(plan.id));
        await this.loadPlans();
      } catch (err) {
        const lang = loadProfile().language;
        const message = (err as { message?: string })?.message === 'already_claimed' ? t('alreadyClaimedPlan', lang) : (err as Error).message;
        this.showResultModal(message);
      }
      return;
    }

    const result = await buyPlan(plan.id);
    const lang = loadProfile().language;
    if (result.outcome === 'success') {
      grantOrderOnce(result.order);
      await this.loadPlans();
      this.showResultModal(`${t('paymentSuccess', lang)}\n+${result.order.coins} 🪙 ${plan.name}`);
    } else if (result.outcome === 'pending') {
      this.showResultModal(`${t('paymentPending', lang)}\n\n${t('reference', lang)}: ${result.order.reference}\nUTR: ${result.order.utr ?? '-'}`, result.order);
    } else if (result.outcome === 'failed') {
      this.showResultModal(t('paymentFailed', lang), undefined, true);
    } else if (result.outcome === 'no_upi_app') {
      this.showResultModal(t('noUpiAppMsg', lang));
    } else if (result.outcome === 'error') {
      this.showResultModal(result.message);
    }
    // 'cancelled' (back button): nothing to show, order stays open for next attempt.
  }

  private showResultModal(message: string, order?: PaymentOrder, showRetry = false): void {
    const lang = loadProfile().language;
    const { overlay, panel } = makeModalOverlay(this);
    const text = this.add.text(0, -40, message, { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5);
    panel.add(text);

    let y = 60;
    if (order?.reference) {
      const copyRef = makeButton(this, 0, y, `${t('reference', lang)} 📋`, () => this.copyToClipboard(order.reference), { fontSize: '14px' });
      panel.add(copyRef);
      y += 44;
    }
    if (order?.utr) {
      const copyUtr = makeButton(this, 0, y, `UTR 📋`, () => this.copyToClipboard(order.utr!), { fontSize: '14px' });
      panel.add(copyUtr);
      y += 44;
    }

    const closeBtn = makeButton(this, showRetry ? -70 : 0, y, t('close', lang), () => {
      overlay.destroy();
      panel.destroy();
    }, { bg: '#8a7c63' });
    panel.add(closeBtn);

    if (showRetry) {
      const retryBtn = makeButton(this, 70, y, t('retry', lang), () => {
        overlay.destroy();
        panel.destroy();
      });
      panel.add(retryBtn);
    }
  }

  private copyToClipboard(value: string): void {
    void navigator.clipboard?.writeText(value);
  }
}
