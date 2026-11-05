import Phaser from 'phaser';
import { ECONOMY, type BoosterId } from '../../config/economy.config';
import { LEVELS } from '../../levels';
import { regenerateLives } from '../../core';
import { loadProfile, saveProfile, spendCoins, addBooster, useBooster } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, makeModalOverlay, THEME } from '../ui';

const NODE_SPACING_Y = 110;
const ZIGZAG_X = 90;

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create(): void {
    const { width, height } = this.scale;
    const profile = saveProfileWithRegen();
    const lang = profile.language;

    this.add.rectangle(0, 0, width, height, THEME.background).setOrigin(0, 0);
    this.add.text(20, 20, t('levelMap', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: THEME.accent }).setOrigin(0, 0);
    makeButton(this, width - 60, 36, '✕', () => this.scene.start('Menu'), { fontSize: '26px' });

    this.add
      .text(width - 20, 20, `🪙 ${profile.coins}   ❤ ${profile.lives}/${ECONOMY.maxLives}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: THEME.text,
      })
      .setOrigin(1, 0)
      .setY(60);

    const listTop = 110;
    const container = this.add.container(0, 0);
    const centerX = width / 2;

    LEVELS.forEach((level, i) => {
      const y = listTop + i * NODE_SPACING_Y;
      const x = centerX + (i % 2 === 0 ? -ZIGZAG_X : ZIGZAG_X);
      const unlocked = level.id <= profile.currentLevel;
      const stars = profile.starsByLevel[level.id] ?? 0;

      const circle = this.add.circle(x, y, 38, unlocked ? 0xe07a3d : 0xd8cdb9);
      circle.setStrokeStyle(3, unlocked ? 0xc9622a : 0xb8ac96);
      const label = this.add
        .text(x, y, unlocked ? String(level.id) : '🔒', { fontFamily: 'sans-serif', fontSize: '22px', color: '#fdf6ec' })
        .setOrigin(0.5);
      container.add([circle, label]);

      if (unlocked && stars > 0) {
        const starText = this.add
          .text(x, y + 44, '⭐'.repeat(stars), { fontSize: '14px' })
          .setOrigin(0.5);
        container.add(starText);
      }

      if (unlocked) {
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerup', () => this.onSelectLevel(level.id));
      }
    });

    const totalHeight = listTop + LEVELS.length * NODE_SPACING_Y + 60;
    this.makeScrollable(container, height, totalHeight);
  }

  private makeScrollable(container: Phaser.GameObjects.Container, viewportHeight: number, contentHeight: number): void {
    const maxScroll = Math.max(0, contentHeight - viewportHeight + 110);
    let dragStartY = 0;
    let containerStartY = 0;
    let dragging = false;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      dragStartY = p.y;
      containerStartY = container.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dy = p.y - dragStartY;
      container.y = Phaser.Math.Clamp(containerStartY + dy, -maxScroll, 0);
    });
    this.input.on('pointerup', () => (dragging = false));
  }

  private onSelectLevel(levelId: number): void {
    const profile = saveProfileWithRegen();
    if (profile.lives <= 0) {
      this.showOutOfLivesPopup();
      return;
    }
    this.showPreLevelPopup(levelId);
  }

  private showPreLevelPopup(levelId: number): void {
    let profile = loadProfile();
    const lang = profile.language;
    const level = LEVELS.find((l) => l.id === levelId)!;
    const { overlay, panel } = makeModalOverlay(this);

    const title = this.add.text(0, -190, `Level ${levelId}`, { fontFamily: 'sans-serif', fontSize: '30px', color: '#fdf6ec' }).setOrigin(0.5);
    const goalLines = level.goals
      .map((g) => {
        if (g.type === 'score') return `Score ${g.target}`;
        if (g.type === 'collect') return `Collect ${g.target} ${g.sweet}`;
        if (g.type === 'clear-ice') return 'Clear all ice';
        return `Drop ${g.target} ingredients`;
      })
      .join('\n');
    const goalText = this.add.text(0, -150, goalLines, { fontFamily: 'sans-serif', fontSize: '16px', color: '#f4e3c1', align: 'center' }).setOrigin(0.5);
    const movesText = this.add.text(0, -110, `${t('moves', lang)}: ${level.moves}`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#f4e3c1' }).setOrigin(0.5);

    panel.add([title, goalText, movesText]);

    // Pre-level boosters: buy one into inventory with coins. Extra Striped / +3 Moves are
    // auto-applied from inventory (1 of each, if owned) the moment Start is tapped.
    const boosterRows: Phaser.GameObjects.Text[] = [];
    let y = -60;
    (['hammer', 'shuffle', 'extraStriped', 'extraMoves3'] as BoosterId[]).forEach((id) => {
      const count = this.add
        .text(-150, y, `${t(id, lang)} x${profile.inventory[id]}`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      const buyBtn = makeButton(this, 110, y, `+1 (${ECONOMY.boosterPrices[id]}🪙)`, () => {
        const spent = spendCoins(profile, ECONOMY.boosterPrices[id]);
        if (!spent) return;
        profile = addBooster(spent, id);
        count.setText(`${t(id, lang)} x${profile.inventory[id]}`);
      }, { fontSize: '14px' });
      boosterRows.push(count, buyBtn);
      y += 50;
    });
    panel.add(boosterRows);

    const start = makeButton(this, 0, y + 20, t('start', lang), () => {
      let extraMoves = 0;
      let extraStriped = false;
      const withStriped = useBooster(profile, 'extraStriped');
      if (withStriped) {
        profile = withStriped;
        extraStriped = true;
      }
      const withMoves = useBooster(profile, 'extraMoves3');
      if (withMoves) {
        profile = withMoves;
        extraMoves = 3;
      }
      overlay.destroy();
      panel.destroy();
      this.scene.start('Game', { levelId, extraMoves, extraStriped });
    });

    const cancel = makeButton(this, 0, y + 80, '✕', () => {
      overlay.destroy();
      panel.destroy();
    }, { bg: '#8a7c63' });

    panel.add([start, cancel]);
  }

  private showOutOfLivesPopup(): void {
    const lang = loadProfile().language;
    const { overlay, panel } = makeModalOverlay(this);

    const title = this.add.text(0, -100, t('outOfLives', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: '#ff8a80' }).setOrigin(0.5);

    const refill = makeButton(this, 0, -30, `${t('refillWithCoins', lang)} (${ECONOMY.lifeRefillCoins})`, () => {
      const profile = loadProfile();
      const spent = spendCoins(profile, ECONOMY.lifeRefillCoins);
      if (spent) {
        saveProfile({ ...spent, lives: ECONOMY.maxLives, livesUpdatedAt: Date.now() });
        overlay.destroy();
        panel.destroy();
        this.scene.restart();
      } else {
        this.showToast(t('notEnoughCoins', lang));
      }
    }, { fontSize: '18px' });

    // Real-money IAP for this is wired in Phase 6 (Google Play Billing); for now it's a
    // visible, honest placeholder rather than a fake "purchase".
    const buyIap = makeButton(this, 0, 30, `${t('buyLives', lang)} (IAP — coming soon)`, () => {
      this.showToast('In-app purchases land in Phase 6');
    }, { fontSize: '16px', bg: '#8a7c63' });

    const profile = loadProfile();
    const remainingMs = Math.max(0, ECONOMY.lifeRegenMinutes * 60_000 - (Date.now() - profile.livesUpdatedAt));
    const minutes = Math.ceil(remainingMs / 60_000);
    const wait = this.add
      .text(0, 90, `${t('waitForLife', lang)}: ~${minutes} min`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#f4e3c1' })
      .setOrigin(0.5);

    const close = makeButton(this, 0, 140, '✕', () => {
      overlay.destroy();
      panel.destroy();
    }, { bg: '#8a7c63' });

    panel.add([title, refill, buyIap, wait, close]);
  }

  private showToast(message: string): void {
    const t2 = this.add
      .text(this.scale.width / 2, this.scale.height - 100, message, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({ targets: t2, alpha: 0, duration: 1600, delay: 1000, onComplete: () => t2.destroy() });
  }
}

/** Applies life regeneration (local-monotonic Date.now() fallback) and persists it,
 *  returning the up-to-date profile. Phase 5 reconciles this against server time. */
function saveProfileWithRegen() {
  const profile = loadProfile();
  const regenerated = regenerateLives({ lives: profile.lives, lastUpdatedAt: profile.livesUpdatedAt }, Date.now());
  const next = { ...profile, lives: regenerated.lives, livesUpdatedAt: regenerated.lastUpdatedAt };
  saveProfile(next);
  return next;
}
