import Phaser from 'phaser';
import { ECONOMY, type BoosterId } from '../../config/economy.config';
import { LEVELS } from '../../levels';
import { regenerateLives } from '../../core';
import { loadProfile, saveProfile, spendCoins, addBooster, useBooster } from '../../services/profile';
import { t } from '../../services/i18n';
import { makeButton, makeModalOverlay, makeModalCard, addCoverBackground, THEME } from '../ui';
import { billing } from '../../services/billing';
import { getProduct } from '../../config/products.config';
import { BACKGROUND_KEY } from '../textures';

const NODE_SPACING_Y = 120;
const ZIGZAG_X = 90;
const NODE_RADIUS = 42;

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create(): void {
    const { width, height } = this.scale;
    const profile = saveProfileWithRegen();
    const lang = profile.language;

    addCoverBackground(this, BACKGROUND_KEY('levelmap'));
    // The illustrated garden background is busy, unlike the old flat cream fill — header text
    // switches to white with a dark drop shadow so it stays readable over it.
    this.add
      .text(width / 2, 20, t('levelMap', lang), { fontFamily: 'sans-serif', fontSize: '30px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, '#2a1046', 6, false, true);
    makeButton(this, width - 50, 44, '✕', () => this.scene.start('Menu'), { fontSize: '22px', bg: THEME.royalPurple });

    this.add
      .text(20, 48, `🪙 ${profile.coins}   ❤ ${profile.lives}/${ECONOMY.maxLives}`, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setShadow(0, 1, '#2a1046', 4, false, true);

    const listTop = 120;
    const container = this.add.container(0, 0);
    const centerX = width / 2;

    // A soft winding path behind the nodes reads as a journey, not a bare list of circles.
    const path = this.add.graphics();
    path.lineStyle(10, Phaser.Display.Color.HexStringToColor(THEME.mangoYellow).color, 0.35);
    path.beginPath();
    LEVELS.forEach((_level, i) => {
      const y = listTop + i * NODE_SPACING_Y;
      const x = centerX + (i % 2 === 0 ? -ZIGZAG_X : ZIGZAG_X);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.strokePath();
    container.add(path);

    LEVELS.forEach((level, i) => {
      const y = listTop + i * NODE_SPACING_Y;
      const x = centerX + (i % 2 === 0 ? -ZIGZAG_X : ZIGZAG_X);
      const unlocked = level.id <= profile.currentLevel;
      const current = level.id === profile.currentLevel;
      const stars = profile.starsByLevel[level.id] ?? 0;

      const node = this.drawLevelNode(x, y, unlocked, current);
      const label = this.add
        .text(x, y, unlocked ? String(level.id) : '🔒', {
          fontFamily: 'sans-serif',
          fontSize: unlocked ? '26px' : '22px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setShadow(0, 1, '#00000066', 2, false, true);
      container.add([node, label]);

      if (unlocked && stars > 0) {
        const starText = this.add.text(x, y + NODE_RADIUS + 10, '⭐'.repeat(stars), { fontSize: '16px' }).setOrigin(0.5);
        container.add(starText);
      }

      if (unlocked) {
        node.setInteractive(new Phaser.Geom.Circle(0, 0, NODE_RADIUS), Phaser.Geom.Circle.Contains);
        node.on('pointerup', () => this.onSelectLevel(level.id));
      }
    });

    const totalHeight = listTop + LEVELS.length * NODE_SPACING_Y + 60;
    this.makeScrollable(container, height, totalHeight);
  }

  // Glossy gradient disc for unlocked levels (gold ring + pulse glow on the current one),
  // flat muted disc for locked ones — distinguishable at a glance, not just by the number.
  private drawLevelNode(x: number, y: number, unlocked: boolean, current: boolean): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    if (unlocked) {
      g.fillStyle(0x1a0a2e, 0.25);
      g.fillCircle(2, 4, NODE_RADIUS);
      const topColor = Phaser.Display.Color.HexStringToColor(THEME.mithaiPink).color;
      const bottomColor = Phaser.Display.Color.HexStringToColor(THEME.saffronOrange).color;
      g.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
      g.fillCircle(0, 0, NODE_RADIUS);
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(-NODE_RADIUS * 0.25, -NODE_RADIUS * 0.35, NODE_RADIUS * 0.9, NODE_RADIUS * 0.5);
      g.lineStyle(current ? 4 : 3, Phaser.Display.Color.HexStringToColor(THEME.royalGold).color, 1);
      g.strokeCircle(0, 0, NODE_RADIUS);
    } else {
      g.fillStyle(0x1a0a2e, 0.12);
      g.fillCircle(2, 3, NODE_RADIUS);
      g.fillStyle(0xd8cdb9, 1);
      g.fillCircle(0, 0, NODE_RADIUS);
      g.lineStyle(3, 0xb8ac96, 1);
      g.strokeCircle(0, 0, NODE_RADIUS);
    }
    const container = this.add.container(x, y, [g]);
    if (current) {
      this.tweens.add({ targets: g, scale: { from: 1, to: 1.08 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    return container;
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
    makeModalCard(this, panel, 360, 480);

    const title = this.add
      .text(0, -210, `Level ${levelId}`, { fontFamily: 'sans-serif', fontSize: '32px', color: THEME.royalPurple, fontStyle: 'bold' })
      .setOrigin(0.5);
    const goalLines = level.goals
      .map((g) => {
        if (g.type === 'score') return `🎯 Score ${g.target}`;
        if (g.type === 'collect') return `🍬 Collect ${g.target} ${g.sweet}`;
        if (g.type === 'clear-ice') return '❄️ Clear all ice';
        return `🥣 Drop ${g.target} ingredients`;
      })
      .join('\n');
    const goalText = this.add
      .text(0, -160, goalLines, { fontFamily: 'sans-serif', fontSize: '18px', color: THEME.text, align: 'center', lineSpacing: 6 })
      .setOrigin(0.5);
    const movesText = this.add
      .text(0, -105, `${t('moves', lang)}: ${level.moves}`, { fontFamily: 'sans-serif', fontSize: '17px', color: THEME.subtleText, fontStyle: 'bold' })
      .setOrigin(0.5);

    panel.add([title, goalText, movesText]);

    // Pre-level boosters: buy one into inventory with coins. Extra Striped / +3 Moves are
    // auto-applied from inventory (1 of each, if owned) the moment Start is tapped.
    const boosterRows: Phaser.GameObjects.GameObject[] = [];
    let y = -55;
    (['hammer', 'shuffle', 'extraStriped', 'extraMoves3'] as BoosterId[]).forEach((id) => {
      const count = this.add
        .text(-150, y, `${t(id, lang)} x${profile.inventory[id]}`, { fontFamily: 'sans-serif', fontSize: '16px', color: THEME.text, fontStyle: 'bold' })
        .setOrigin(0, 0.5);
      const buyBtn = makeButton(
        this,
        125,
        y,
        `+1 (${ECONOMY.boosterPrices[id]}🪙)`,
        () => {
          const spent = spendCoins(profile, ECONOMY.boosterPrices[id]);
          if (!spent) return;
          profile = addBooster(spent, id);
          count.setText(`${t(id, lang)} x${profile.inventory[id]}`);
        },
        { fontSize: '14px', bg: THEME.candyBlue },
      );
      boosterRows.push(count, buyBtn);
      y += 48;
    });
    panel.add(boosterRows);

    const start = makeButton(
      this,
      0,
      y + 30,
      t('start', lang),
      () => {
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
      },
      { fontSize: '22px' },
    );

    const cancel = makeButton(
      this,
      0,
      y + 90,
      t('close', lang),
      () => {
        overlay.destroy();
        panel.destroy();
      },
      { bg: THEME.royalPurple, fontSize: '16px' },
    );

    panel.add([start, cancel]);
  }

  private showOutOfLivesPopup(): void {
    const lang = loadProfile().language;
    const { overlay, panel } = makeModalOverlay(this);
    makeModalCard(this, panel, 340, 360);

    const title = this.add
      .text(0, -130, t('outOfLives', lang), { fontFamily: 'sans-serif', fontSize: '28px', color: '#e0457a', fontStyle: 'bold' })
      .setOrigin(0.5);

    const refill = makeButton(
      this,
      0,
      -55,
      `${t('refillWithCoins', lang)} (${ECONOMY.lifeRefillCoins})`,
      () => {
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
      },
      { fontSize: '17px' },
    );

    const buyIap = makeButton(
      this,
      0,
      5,
      `${t('buyLives', lang)} (${billing.getLocalizedPrice('lives_refill_5') ?? '₹' + getProduct('lives_refill_5')!.fallbackPriceInr})`,
      async () => {
        const outcome = await billing.purchase('lives_refill_5');
        if (outcome.kind === 'granted') {
          overlay.destroy();
          panel.destroy();
          this.scene.restart();
        } else if (outcome.kind === 'error') {
          this.showToast(outcome.message);
        } else if (outcome.kind === 'pending') {
          this.showToast('Purchase pending — check back soon');
        }
      },
      { fontSize: '16px', bg: THEME.candyBlue },
    );

    const profile = loadProfile();
    const remainingMs = Math.max(0, ECONOMY.lifeRegenMinutes * 60_000 - (Date.now() - profile.livesUpdatedAt));
    const minutes = Math.ceil(remainingMs / 60_000);
    const wait = this.add
      .text(0, 75, `${t('waitForLife', lang)}: ~${minutes} min`, { fontFamily: 'sans-serif', fontSize: '16px', color: THEME.subtleText, fontStyle: 'bold' })
      .setOrigin(0.5);

    const close = makeButton(this, 0, 130, '✕', () => {
      overlay.destroy();
      panel.destroy();
    }, { bg: THEME.royalPurple, fontSize: '16px' });

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
