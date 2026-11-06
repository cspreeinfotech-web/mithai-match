import Phaser from 'phaser';
import { APP_NAME } from '../../config/app.config';
import { loadProfile, saveProfile } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, THEME } from '../ui';
import { billing } from '../../services/billing';
import { getAuthStatus, requestEmailCode, verifyEmailCode, type AuthStatus } from '../../services/accountAuth';


export class SettingsScene extends Phaser.Scene {
  private authStatus: AuthStatus = { isAnonymous: true, email: null };

  constructor() {
    super('Settings');
  }

  create(): void {
    this.redraw();
    getAuthStatus().then((status) => {
      this.authStatus = status;
      this.redraw();
    });
  }

  private redraw(): void {
    this.children.removeAll();
    const { width } = this.scale;
    const profile = loadProfile();
    const lang = profile.language;

    this.add.rectangle(0, 0, width, this.scale.height, THEME.background).setOrigin(0, 0);
    this.add.text(20, 20, t('settings', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: THEME.accent }).setOrigin(0, 0);
    makeButton(this, width - 60, 36, '✕', () => this.scene.start('Menu'), { fontSize: '26px' });

    let y = 110;

    this.add
      .text(40, y, this.authStatus.email ? `${t('signedInAs', lang)} ${this.authStatus.email}` : t('playingAsGuest', lang), {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: THEME.subtleText,
      })
      .setOrigin(0, 0.5);
    y += 44;

    if (!this.authStatus.email) {
      makeButton(this, width / 2, y, t('signInWithEmail', lang), () => this.handleEmailSignIn(), { fontSize: '18px' });
      y += 56;
    }
    makeButton(this, width / 2, y, t('signInWithGoogle', lang), () => this.showToast(t('googleComingSoon', lang)), {
      fontSize: '16px',
      bg: '#8a7c63',
    });
    y += 64;

    const row = (label: string, value: string, onToggle: () => void) => {
      this.add.text(40, y, label, { fontFamily: 'sans-serif', fontSize: '22px', color: THEME.text }).setOrigin(0, 0.5);
      makeButton(this, width - 90, y, value, onToggle, { fontSize: '18px' });
      y += 64;
    };

    row(t('sound', lang), profile.soundOn ? 'ON' : 'OFF', () => {
      saveProfile({ ...profile, soundOn: !profile.soundOn });
      this.redraw();
    });
    row(t('music', lang), profile.musicOn ? 'ON' : 'OFF', () => {
      saveProfile({ ...profile, musicOn: !profile.musicOn });
      this.redraw();
    });
    row(t('haptics', lang), profile.hapticsOn ? 'ON' : 'OFF', () => {
      saveProfile({ ...profile, hapticsOn: !profile.hapticsOn });
      this.redraw();
    });
    row(t('language', lang), lang === 'en' ? 'English' : 'Hinglish', () => {
      saveProfile({ ...profile, language: lang === 'en' ? 'hi-roman' : 'en' });
      this.redraw();
    });

    y += 20;
    makeButton(this, width / 2, y, t('restorePurchases', lang), async () => {
      await billing.restorePurchases();
      this.showToast('Purchases restored');
    }, { fontSize: '18px' });
    y += 64;

    makeButton(this, width / 2, y, t('deleteMyData', lang), () => {
      this.showConfirmDelete();
    }, { fontSize: '18px', bg: '#c0392b' });
    y += 64;

    this.add
      .text(width / 2, y, t('privacyPolicy', lang) + ' (see PRIVACY_POLICY.md)', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: THEME.subtleText,
      })
      .setOrigin(0.5);
    y += 40;

    this.add
      .text(width / 2, y, `${APP_NAME} — ${t('appVersion', lang)} ${__APP_VERSION__}`, {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#8a7c63',
      })
      .setOrigin(0.5);
  }

  // shortcut: window.prompt() for email/code entry instead of an on-screen keyboard UI —
  // works fine in the Android WebView, upgrade to an in-scene text input if that ever feels cheap.
  private async handleEmailSignIn(): Promise<void> {
    const profile = loadProfile();
    const lang = profile.language;
    const email = window.prompt('Enter your email:')?.trim();
    if (!email) return;
    const sent = await requestEmailCode(email);
    if (!sent.ok) {
      this.showToast(sent.error);
      return;
    }
    this.showToast(t('codeSent', lang));
    const code = window.prompt('Enter the 6-digit code we emailed you:')?.trim();
    if (!code) return;
    const verified = await verifyEmailCode(email, code, sent.linking);
    if (!verified.ok) {
      this.showToast(verified.error);
      return;
    }
    this.authStatus = await getAuthStatus();
    this.showToast(t('signedInToast', lang));
    this.redraw();
  }

  private showConfirmDelete(): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0, 0).setInteractive();
    const panel = this.add.container(width / 2, height / 2);
    const title = this.add
      .text(0, -40, 'Delete all your progress?\nThis cannot be undone.', { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5);
    const confirm = makeButton(this, 0, 40, 'Delete', () => {
      localStorage.clear();
      overlay.destroy();
      panel.destroy();
      this.redraw();
    }, { bg: '#c0392b' });
    const cancel = makeButton(this, 0, 100, 'Cancel', () => {
      overlay.destroy();
      panel.destroy();
    }, { bg: '#8a7c63' });
    panel.add([title, confirm, cancel]);
  }

  private showToast(message: string): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height - 100, message, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
        wordWrap: { width: this.scale.width - 80 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, alpha: 0, duration: 1800, delay: 1200, onComplete: () => text.destroy() });
  }
}
