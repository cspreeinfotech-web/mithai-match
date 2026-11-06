import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { ECONOMY } from '../../config/economy.config';
import { canClaimDaily, claimDaily } from '../../core';
import { loadProfile, saveProfile, addCoins, addBooster } from '../../services/profile';
import { syncDailyClaim } from '../../services/cloudSync';
import { t } from '../../services/i18n';
import { makeButton, makeModalOverlay, addCoverBackground, THEME } from '../ui';
import { PLAY_STORE } from '../../config/app.config';
import { BACKGROUND_KEY } from '../textures';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.redraw();
  }

  private redraw(): void {
    this.children.removeAll();
    const { width, height } = this.scale;
    const profile = loadProfile();
    const lang = profile.language;

    addCoverBackground(this, BACKGROUND_KEY('home'));

    // The illustrated palace background is busy/dark, unlike the old flat cream fill — title
    // and status text switch to white with a drop shadow so they stay readable over it.
    this.add
      .text(width / 2, height * 0.16, APP_NAME, { fontFamily: 'Georgia, serif', fontSize: '56px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(0, 2, '#2a1046', 6, false, true);
    this.add
      .text(width / 2, height * 0.23, t('tagline', lang), { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffe6a8' })
      .setOrigin(0.5)
      .setShadow(0, 1, '#2a1046', 4, false, true);

    this.add
      .text(width / 2, height * 0.3, `🪙 ${profile.coins}   ❤ ${profile.lives}/${ECONOMY.maxLives}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setShadow(0, 1, '#2a1046', 4, false, true);

    makeButton(this, width / 2, height * 0.44, t('play', lang), () => this.scene.start('Map'), { fontSize: '42px' });

    const canClaim = canClaimDaily({ dailyStreak: profile.dailyStreak, lastDailyClaim: profile.lastDailyClaim }, Date.now());
    makeButton(
      this,
      width / 2,
      height * 0.54,
      canClaim ? `🎁 ${t('dailyReward', lang)}` : t('alreadyClaimedToday', lang),
      () => (canClaim ? this.showDailyRewardPopup() : undefined),
      { fontSize: '22px', bg: canClaim ? THEME.buttonBg : THEME.disabledBg },
    );

    makeButton(this, width / 2, height * 0.62, `🏪 ${t('shop', lang)}`, () => this.scene.start('Shop'), { fontSize: '22px' });
    makeButton(this, width / 2, height * 0.7, '🪙 Store', () => this.scene.start('Store'), { fontSize: '22px' });
    // UPI payments for digital goods aren't allowed on Play unless enrolled in user choice
    // billing — hidden entirely in the Play Store build, shown only in the website APK.
    if (!PLAY_STORE) {
      makeButton(this, width / 2, height * 0.78, `💳 ${t('plans', lang)}`, () => this.scene.start('Plans'), { fontSize: '22px' });
    }
    makeButton(this, width / 2, height * (PLAY_STORE ? 0.78 : 0.86), `⚙ ${t('settings', lang)}`, () => this.scene.start('Settings'), { fontSize: '22px' });
  }

  private showDailyRewardPopup(): void {
    const profile = loadProfile();
    const lang = profile.language;
    const result = claimDaily({ dailyStreak: profile.dailyStreak, lastDailyClaim: profile.lastDailyClaim }, Date.now());
    if (!result) return;

    let next = { ...profile, dailyStreak: result.dailyStreak, lastDailyClaim: result.lastDailyClaim };
    next = addCoins(next, result.reward.coins);
    if ('booster' in result.reward && result.reward.booster) {
      next = addBooster(next, result.reward.booster);
    }
    saveProfile(next);
    void syncDailyClaim();

    const { overlay, panel } = makeModalOverlay(this);
    const title = this.add
      .text(0, -60, `Day ${result.streakDay} / 7`, { fontFamily: 'sans-serif', fontSize: '28px', color: '#ffd27a' })
      .setOrigin(0.5);
    const rewardText = this.add
      .text(
        0,
        0,
        `+${result.reward.coins} coins` + ('booster' in result.reward && result.reward.booster ? `\n+1 ${t(result.reward.booster, lang)}` : ''),
        { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', align: 'center' },
      )
      .setOrigin(0.5);
    const close = makeButton(this, 0, 80, t('claim', lang), () => {
      overlay.destroy();
      panel.destroy();
      this.redraw();
    });
    panel.add([title, rewardText, close]);
  }
}
