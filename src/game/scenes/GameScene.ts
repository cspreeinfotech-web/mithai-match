import Phaser from 'phaser';
import {
  Rng,
  generateBoard,
  resolveSwap,
  initGoalProgress,
  applyStepToGoals,
  allGoalsMet,
  calculateStars,
  coinsForWin,
  findAnyValidMove,
  applyGravity,
  refill,
  shuffleBoard,
  continuePrice,
  type Board,
  type LevelConfig,
  type Tile,
  type GoalProgress,
} from '../../core';
import { getLevel } from '../../levels';
import { loadProfile, recordLevelWin, spendLife, useBooster, spendCoins } from '../../services/profile';
import { syncLevelWin } from '../../services/cloudSync';
import { billing } from '../../services/billing';
import { ECONOMY } from '../../config/economy.config';
import { ENABLE_ADS } from '../../config/app.config';
import { getProduct } from '../../config/products.config';
import { makeButton, THEME } from '../ui';
import {
  generateGameTextures,
  SWEET_TEXTURE_KEY,
  SPECIAL_TEXTURE_KEY,
  BLOCKER_TEXTURE_KEY,
  INGREDIENT_TEXTURE_KEY,
} from '../textures';

const HUD_HEIGHT = 200;
const BOARD_BOTTOM_MARGIN = 100;
const HINT_IDLE_MS = 8000;

interface CellPos {
  row: number;
  col: number;
}

export class GameScene extends Phaser.Scene {
  private levelConfig!: LevelConfig;
  private board!: Board;
  private rng!: Rng;
  private goalProgress!: GoalProgress[];
  private movesRemaining = 0;
  private score = 0;
  private tileSize = 0;
  private originX = 0;
  private originY = 0;
  private grid: (Phaser.GameObjects.Container | null)[][] = [];
  private inputLocked = false;
  private selected: CellPos | null = null;
  private dragStart: { pos: CellPos; x: number; y: number } | null = null;
  private idleTimer?: Phaser.Time.TimerEvent;
  private hintTweens: Phaser.Tweens.Tween[] = [];

  private movesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private boosterText!: Phaser.GameObjects.Text;
  private hammerArmed = false;
  private extraMoves = 0;
  private extraStriped = false;
  private continuesUsed = 0;

  constructor() {
    super('Game');
  }

  init(data: { levelId: number; extraMoves?: number; extraStriped?: boolean }): void {
    const config = getLevel(data.levelId);
    if (!config) throw new Error(`Unknown level id ${data.levelId}`);
    this.levelConfig = config;
    this.extraMoves = data.extraMoves ?? 0;
    this.extraStriped = data.extraStriped ?? false;
  }

  create(): void {
    generateGameTextures(this);

    this.board = generateBoard(this.levelConfig);
    this.rng = new Rng(this.levelConfig.seed + 1); // distinct stream from board generation
    if (this.extraStriped) this.applyExtraStripedBooster();
    this.goalProgress = initGoalProgress(this.levelConfig, this.board);
    this.movesRemaining = this.levelConfig.moves + this.extraMoves;
    this.score = 0;
    this.inputLocked = false;
    this.selected = null;
    this.hammerArmed = false;
    this.continuesUsed = 0;

    const { width, height } = this.scale;
    const availableWidth = width - 40;
    const availableHeight = height - HUD_HEIGHT - BOARD_BOTTOM_MARGIN;
    this.tileSize = Math.floor(
      Math.min(availableWidth / this.levelConfig.width, availableHeight / this.levelConfig.height),
    );
    this.originX = (width - this.tileSize * this.levelConfig.width) / 2 + this.tileSize / 2;
    this.originY = HUD_HEIGHT + (availableHeight - this.tileSize * this.levelConfig.height) / 2 + this.tileSize / 2;

    this.add.rectangle(0, 0, width, height, 0xfdf6ec).setOrigin(0, 0);
    this.buildHud();
    this.renderFullBoard(this.board);
    this.resetIdleTimer();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
  }

  // ---------------------------------------------------------------- layout helpers

  private cellToWorld(cell: CellPos): { x: number; y: number } {
    return { x: this.originX + cell.col * this.tileSize, y: this.originY + cell.row * this.tileSize };
  }

  private worldToCell(x: number, y: number): CellPos | null {
    const col = Math.round((x - this.originX) / this.tileSize);
    const row = Math.round((y - this.originY) / this.tileSize);
    if (row < 0 || row >= this.levelConfig.height || col < 0 || col >= this.levelConfig.width) return null;
    return { row, col };
  }

  private isAdjacent(a: CellPos, b: CellPos): boolean {
    return (Math.abs(a.row - b.row) === 1 && a.col === b.col) || (Math.abs(a.col - b.col) === 1 && a.row === b.row);
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    this.add
      .text(20, 20, this.levelConfig.id <= 999 ? `Level ${this.levelConfig.id}` : '', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: '#c9622a',
      })
      .setOrigin(0, 0);

    this.movesText = this.add
      .text(this.scale.width - 20, 20, '', { fontFamily: 'sans-serif', fontSize: '28px', color: '#3a2317' })
      .setOrigin(1, 0);

    this.scoreText = this.add
      .text(20, 60, '', { fontFamily: 'sans-serif', fontSize: '24px', color: '#6b4a35' })
      .setOrigin(0, 0);

    this.goalText = this.add
      .text(20, 100, '', { fontFamily: 'sans-serif', fontSize: '20px', color: '#2f7a4f', wordWrap: { width: this.scale.width - 120 } })
      .setOrigin(0, 0);

    const pauseButton = this.add
      .text(this.scale.width - 20, 150, '⏸', { fontFamily: 'sans-serif', fontSize: '36px', color: '#3a2317' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    pauseButton.on('pointerdown', () => this.showPausePopup());

    const hammerBtn = this.add
      .text(20, 150, '🔨', { fontFamily: 'sans-serif', fontSize: '32px' })
      .setInteractive({ useHandCursor: true });
    hammerBtn.on('pointerdown', () => this.armHammer());

    const shuffleBtn = this.add
      .text(70, 150, '🔀', { fontFamily: 'sans-serif', fontSize: '32px' })
      .setInteractive({ useHandCursor: true });
    shuffleBtn.on('pointerdown', () => this.useShuffleBooster());

    this.boosterText = this.add
      .text(20, 190, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#6b4a35' })
      .setOrigin(0, 0);

    this.refreshHud();
  }

  private refreshHud(): void {
    this.movesText.setText(`Moves: ${this.movesRemaining}`);
    this.scoreText.setText(`Score: ${this.score}`);
    const inv = loadProfile().inventory;
    this.boosterText.setText(`x${inv.hammer}        x${inv.shuffle}`);
    this.goalText.setText(
      this.goalProgress
        .map((p) => {
          switch (p.goal.type) {
            case 'score':
              return `Score ${Math.min(p.current, p.goal.target)}/${p.goal.target}`;
            case 'collect':
              return `Collect ${p.goal.sweet}: ${p.current}/${p.goal.target}`;
            case 'clear-ice':
              return `Clear ice: ${p.current} left`;
            case 'drop-ingredients':
              return `Ingredients: ${p.current}/${p.goal.target}`;
          }
        })
        .join('   '),
    );
  }

  // ---------------------------------------------------------------- rendering

  private renderFullBoard(board: Board, animateIn = false): void {
    for (const row of this.grid) for (const container of row) container?.destroy();
    this.grid = [];

    for (let row = 0; row < board.height; row++) {
      const gridRow: (Phaser.GameObjects.Container | null)[] = [];
      for (let col = 0; col < board.width; col++) {
        const tile = board.cells[row]![col] ?? null;
        gridRow.push(this.renderCell({ row, col }, tile, animateIn));
      }
      this.grid.push(gridRow);
    }
  }

  private renderCell(cell: CellPos, tile: Tile | null, animateIn: boolean): Phaser.GameObjects.Container | null {
    if (!tile) return null;
    const { x, y } = this.cellToWorld(cell);
    const container = this.add.container(x, animateIn ? y - this.tileSize * 1.5 : y);
    const scaleFactor = (this.tileSize / 128) * 0.92;

    if (tile.blocker === 'locked') {
      const rock = this.add.image(0, 0, BLOCKER_TEXTURE_KEY('locked')).setScale(scaleFactor);
      container.add(rock);
    } else {
      const base = this.add.image(0, 0, SWEET_TEXTURE_KEY(tile.sweet)).setScale(scaleFactor);
      container.add(base);
      if (tile.special) {
        container.add(this.add.image(0, 0, SPECIAL_TEXTURE_KEY(tile.special)).setScale(scaleFactor));
      }
      if (tile.blocker === 'ice1' || tile.blocker === 'ice2' || tile.blocker === 'honey') {
        container.add(this.add.image(0, 0, BLOCKER_TEXTURE_KEY(tile.blocker)).setScale(scaleFactor));
      }
      if (tile.ingredient) {
        container.add(this.add.image(this.tileSize * 0.3, -this.tileSize * 0.3, INGREDIENT_TEXTURE_KEY).setScale(scaleFactor * 0.6));
      }
    }

    container.setSize(this.tileSize, this.tileSize);
    container.setInteractive(new Phaser.Geom.Rectangle(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize), Phaser.Geom.Rectangle.Contains);

    if (animateIn) {
      this.tweens.add({ targets: container, y, duration: 260, ease: 'Bounce.Out' });
    }

    return container;
  }

  // ---------------------------------------------------------------- input

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.inputLocked) return;
    const cell = this.worldToCell(pointer.x, pointer.y);
    if (!cell || !this.grid[cell.row]?.[cell.col]) return;
    this.resetIdleTimer();

    if (this.hammerArmed) {
      this.hammerArmed = false;
      void this.applyHammer(cell);
      return;
    }

    this.dragStart = { pos: cell, x: pointer.x, y: pointer.y };

    if (this.selected) {
      if (this.isAdjacent(this.selected, cell)) {
        const from = this.selected;
        this.selected = null;
        this.clearSelectionHighlight();
        void this.attemptSwap(from, cell);
        return;
      }
      this.clearSelectionHighlight();
    }
    this.selected = cell;
    this.highlightSelection(cell);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart || this.inputLocked) {
      this.dragStart = null;
      return;
    }
    const dx = pointer.x - this.dragStart.x;
    const dy = pointer.y - this.dragStart.y;
    const threshold = this.tileSize * 0.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
      this.dragStart = null;
      return; // treated as a tap; tap-tap selection already handled on pointerdown
    }

    const from = this.dragStart.pos;
    const target: CellPos =
      Math.abs(dx) > Math.abs(dy)
        ? { row: from.row, col: from.col + (dx > 0 ? 1 : -1) }
        : { row: from.row + (dy > 0 ? 1 : -1), col: from.col };
    this.dragStart = null;

    if (target.row < 0 || target.row >= this.levelConfig.height || target.col < 0 || target.col >= this.levelConfig.width) return;

    this.selected = null;
    this.clearSelectionHighlight();
    void this.attemptSwap(from, target);
  }

  private highlightSelection(cell: CellPos): void {
    this.grid[cell.row]?.[cell.col]?.setScale(1.1);
  }

  private clearSelectionHighlight(): void {
    for (const row of this.grid) for (const c of row) c?.setScale(1);
  }

  // ---------------------------------------------------------------- swap + cascade animation

  private async attemptSwap(a: CellPos, b: CellPos): Promise<void> {
    this.inputLocked = true;
    const result = resolveSwap(this.board, a, b, this.rng);

    if (!result.valid) {
      await this.bounceInvalidSwap(a, b);
      this.inputLocked = false;
      return;
    }

    this.movesRemaining -= 1;
    await this.animateDirectSwap(a, b);

    for (const step of result.steps) {
      applyStepToGoals(this.goalProgress, step);
      this.score += step.scoreGained;
      await this.animateClear(step.cleared.map((c) => ({ row: c.row, col: c.col })), step.scoreGained, step.multiplier);
      this.board = step.boardAfterStep;
      this.renderFullBoard(this.board, true);
      await this.delay(220);
    }

    this.refreshHud();

    if (result.shuffled) this.showToast('No moves — shuffling!');

    this.resetIdleTimer();

    if (allGoalsMet(this.goalProgress)) {
      this.onWin();
    } else if (this.movesRemaining <= 0) {
      this.onFail();
    } else {
      this.inputLocked = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private async animateDirectSwap(a: CellPos, b: CellPos): Promise<void> {
    const ca = this.grid[a.row]?.[a.col];
    const cb = this.grid[b.row]?.[b.col];
    if (!ca || !cb) return;
    const posA = this.cellToWorld(a);
    const posB = this.cellToWorld(b);
    await Promise.all([
      new Promise<void>((resolve) => {
        this.tweens.add({ targets: ca, x: posB.x, y: posB.y, duration: 160, ease: 'Sine.InOut', onComplete: () => resolve() });
      }),
      new Promise<void>((resolve) => {
        this.tweens.add({ targets: cb, x: posA.x, y: posA.y, duration: 160, ease: 'Sine.InOut', onComplete: () => resolve() });
      }),
    ]);
  }

  private async bounceInvalidSwap(a: CellPos, b: CellPos): Promise<void> {
    const ca = this.grid[a.row]?.[a.col];
    const cb = this.grid[b.row]?.[b.col];
    if (!ca || !cb) return;
    const posA = this.cellToWorld(a);
    const posB = this.cellToWorld(b);
    await Promise.all([
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: ca,
          x: posB.x,
          y: posB.y,
          duration: 110,
          yoyo: true,
          ease: 'Sine.InOut',
          onComplete: () => resolve(),
        });
      }),
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: cb,
          x: posA.x,
          y: posA.y,
          duration: 110,
          yoyo: true,
          ease: 'Sine.InOut',
          onComplete: () => resolve(),
        });
      }),
    ]);
  }

  private async animateClear(cells: CellPos[], scoreGained: number, multiplier: number): Promise<void> {
    if (cells.length === 0) return;
    const targets = cells.map((c) => this.grid[c.row]?.[c.col]).filter((c): c is Phaser.GameObjects.Container => !!c);
    if (targets.length === 0) return;

    const cx = targets.reduce((sum, t) => sum + t.x, 0) / targets.length;
    const cy = targets.reduce((sum, t) => sum + t.y, 0) / targets.length;
    this.popupText(cx, cy, `+${scoreGained}`, '#ffe066');
    if (multiplier >= 3) this.popupText(cx, cy - 36, 'Sugar Rush!', '#ff9a3c');
    else if (multiplier === 2) this.popupText(cx, cy - 36, 'Tasty!', '#9af08a');

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets,
        scale: 0,
        alpha: 0,
        duration: 160,
        ease: 'Back.In',
        onComplete: () => resolve(),
      });
    });
  }

  private popupText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '26px', color }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 700, ease: 'Sine.Out', onComplete: () => t.destroy() });
  }

  private showToast(message: string): void {
    const t = this.add
      .text(this.scale.width / 2, HUD_HEIGHT - 40, message, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, duration: 1800, delay: 800, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- hint

  private resetIdleTimer(): void {
    this.idleTimer?.remove();
    this.clearHintPulse();
    this.idleTimer = this.time.delayedCall(HINT_IDLE_MS, () => this.showHint());
  }

  private showHint(): void {
    if (this.inputLocked) return;
    const move = findAnyValidMove(this.board);
    if (!move) return;
    for (const cell of [move.a, move.b]) {
      const container = this.grid[cell.row]?.[cell.col];
      if (!container) continue;
      this.hintTweens.push(
        this.tweens.add({ targets: container, scale: 1.12, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      );
    }
  }

  private clearHintPulse(): void {
    for (const tween of this.hintTweens) tween.remove();
    this.hintTweens = [];
    for (const row of this.grid) for (const c of row) c?.setScale(1);
  }

  // ---------------------------------------------------------------- boosters

  /** Pre-level "Extra Striped" booster: converts one random sweet on the starting board
   *  into a striped special before the first render. */
  private applyExtraStripedBooster(): void {
    const candidates: CellPos[] = [];
    for (let row = 0; row < this.board.height; row++) {
      for (let col = 0; col < this.board.width; col++) {
        const tile = this.board.cells[row]![col];
        if (tile && tile.blocker !== 'locked') candidates.push({ row, col });
      }
    }
    if (candidates.length === 0) return;
    const pick = candidates[this.rng.int(candidates.length)]!;
    this.board.cells[pick.row]![pick.col]!.special = this.rng.next() < 0.5 ? 'striped-h' : 'striped-v';
  }

  private armHammer(): void {
    if (this.inputLocked) return;
    const profile = loadProfile();
    if (profile.inventory.hammer <= 0) {
      this.showToast('No hammers left — buy one before your next level');
      return;
    }
    this.hammerArmed = !this.hammerArmed;
    this.showToast(this.hammerArmed ? 'Tap a sweet to remove it' : 'Hammer cancelled');
  }

  private async applyHammer(cell: CellPos): Promise<void> {
    const used = useBooster(loadProfile(), 'hammer');
    if (!used) return;
    this.inputLocked = true;
    const target = this.grid[cell.row]?.[cell.col];
    if (target) {
      await new Promise<void>((resolve) => {
        this.tweens.add({ targets: target, scale: 0, alpha: 0, duration: 150, onComplete: () => resolve() });
      });
    }
    this.board.cells[cell.row]![cell.col] = null;
    applyGravity(this.board);
    refill(this.board, this.rng);
    this.renderFullBoard(this.board, true);
    await this.delay(220);
    this.refreshHud();
    this.inputLocked = false;
  }

  private useShuffleBooster(): void {
    if (this.inputLocked) return;
    const profile = loadProfile();
    if (profile.inventory.shuffle <= 0) {
      this.showToast('No shuffles left — buy one before your next level');
      return;
    }
    useBooster(profile, 'shuffle');
    shuffleBoard(this.board, this.rng);
    this.renderFullBoard(this.board, true);
    this.refreshHud();
    this.showToast('Shuffled!');
  }

  // ---------------------------------------------------------------- win / fail / pause

  private onWin(): void {
    const stars = calculateStars(this.levelConfig, this.score, true);
    const coins = coinsForWin(stars);
    const profile = loadProfile();
    recordLevelWin(profile, this.levelConfig.id, stars, coins);
    void syncLevelWin(this.levelConfig.id, this.score, stars);
    this.showWinPopup(stars, coins);
  }

  private onFail(): void {
    // Game state (board, score, moves) is already frozen — inputLocked stays true and
    // nothing in attemptSwap/animate* runs again until this popup resolves one way or
    // another, including while a purchase is in flight or the app is backgrounded.
    this.showOutOfMovesPopup();
  }

  private showWinPopup(stars: number, coins: number): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0, 0).setInteractive();
    const panel = this.add.container(width / 2, height / 2);

    const title = this.add
      .text(0, -80, 'Level Complete!', { fontFamily: 'sans-serif', fontSize: '36px', color: '#ffd27a' })
      .setOrigin(0.5);
    const starsText = this.add.text(0, -20, '⭐'.repeat(stars) + '☆'.repeat(3 - stars), { fontSize: '40px' }).setOrigin(0.5);
    const coinsText = this.add
      .text(0, 30, `+${coins} coins`, { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);

    const button = this.add
      .text(0, 90, 'NEXT', { fontFamily: 'sans-serif', fontSize: '28px', color: '#1a0f08', backgroundColor: '#ffb84d', padding: { x: 36, y: 12 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      const nextLevel = this.levelConfig.id + 1;
      if (getLevel(nextLevel)) this.scene.restart({ levelId: nextLevel });
      else this.scene.start('Menu');
    });

    const quit = this.add
      .text(0, 150, 'Back to menu', { fontFamily: 'sans-serif', fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    quit.on('pointerdown', () => this.scene.start('Menu'));

    panel.add([title, starsText, coinsText, button, quit]);
    void overlay; // keeps the backdrop referenced (blocks board input beneath it)
  }

  /** Out-of-moves fail flow (spec section 5.1): continue with coins (price escalates, capped
   *  at 3 uses this attempt), continue via direct IAP, a "get coins" shortcut into the Store
   *  that returns here with the board preserved, or give up (spends a life, back to map). */
  private showOutOfMovesPopup(): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0, 0).setInteractive();
    const panel = this.add.container(width / 2, height / 2);

    const title = this.add
      .text(0, -150, 'Out of Moves', { fontFamily: 'sans-serif', fontSize: '34px', color: '#ff8a80' })
      .setOrigin(0.5);
    const scoreText = this.add
      .text(0, -105, `Score: ${this.score}`, { fontFamily: 'sans-serif', fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
    panel.add([title, scoreText]);

    const price = continuePrice(this.continuesUsed + 1);
    const profile = loadProfile();

    if (price !== null) {
      const canAfford = profile.coins >= price;
      const coinBtn = makeButton(
        this,
        0,
        -50,
        canAfford ? `Continue: +5 moves (${price} 🪙)` : `Need ${price - profile.coins} more 🪙`,
        () => (canAfford ? this.continueWithCoins(price, overlay, panel) : this.openStoreShortcut(overlay, panel)),
        { fontSize: '18px', bg: canAfford ? THEME.buttonBg : THEME.disabledBg },
      );
      panel.add(coinBtn);
    }

    const iapPrice = billing.getLocalizedPrice('continue_moves_5') ?? `₹${getProduct('continue_moves_5')!.fallbackPriceInr}`;
    const iapBtn = makeButton(this, 0, 10, `Buy +5 moves (${iapPrice})`, () => this.continueWithIap(overlay, panel), { fontSize: '18px' });
    panel.add(iapBtn);

    if (ENABLE_ADS) {
      const adBtn = makeButton(this, 0, 70, 'Watch ad for +3 moves', () => this.showToast('Ads land once ENABLE_ADS is turned on'), {
        fontSize: '16px',
        bg: '#8a7c63',
      });
      panel.add(adBtn);
    }

    const giveUp = this.add
      .text(0, ENABLE_ADS ? 130 : 100, 'Give up', { fontFamily: 'sans-serif', fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    giveUp.on('pointerdown', () => {
      const current = loadProfile();
      spendLife(current);
      overlay.destroy();
      panel.destroy();
      this.scene.start('Map');
    });
    panel.add(giveUp);
  }

  private continueWithCoins(price: number, overlay: Phaser.GameObjects.Rectangle, panel: Phaser.GameObjects.Container): void {
    const profile = loadProfile();
    const spent = spendCoins(profile, price);
    if (!spent) {
      this.showToast('Not enough coins');
      return;
    }
    this.continuesUsed += 1;
    this.applyContinueMoves(overlay, panel);
  }

  private async continueWithIap(overlay: Phaser.GameObjects.Rectangle, panel: Phaser.GameObjects.Container): Promise<void> {
    const outcome = await billing.purchase('continue_moves_5');
    if (outcome.kind === 'granted') {
      this.applyContinueMoves(overlay, panel);
    } else if (outcome.kind === 'error') {
      this.showToast(outcome.message);
    } else if (outcome.kind === 'pending') {
      this.showToast('Purchase pending — check back soon');
    }
    // 'cancelled' and 'already_owned' need no message — the popup just stays open.
  }

  private applyContinueMoves(overlay: Phaser.GameObjects.Rectangle, panel: Phaser.GameObjects.Container): void {
    this.movesRemaining += ECONOMY.continueMovesGranted;
    overlay.destroy();
    panel.destroy();
    this.refreshHud();
    this.inputLocked = false;
    this.resetIdleTimer();
  }

  /** "Get coins" shortcut: opens the Store with the frozen attempt preserved, so coming back
   *  (via the Store's own back button) returns the player to this same out-of-moves popup. */
  private openStoreShortcut(overlay: Phaser.GameObjects.Rectangle, panel: Phaser.GameObjects.Container): void {
    overlay.destroy();
    panel.destroy();
    this.scene.pause();
    this.scene.launch('Store', { overlay: true });
    this.scene.get('Store').events.once('shutdown', () => {
      this.scene.resume();
      this.showOutOfMovesPopup();
    });
  }

  /** Called from the Android hardware back button (see src/main.ts). */
  public handleBackButton(): void {
    if (!this.inputLocked) this.showPausePopup();
  }

  private showPausePopup(): void {
    this.inputLocked = true;
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0, 0).setInteractive();
    const panel = this.add.container(width / 2, height / 2);

    const title = this.add.text(0, -60, 'Paused', { fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    const resume = this.add
      .text(0, 0, 'RESUME', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        color: '#1a0f08',
        backgroundColor: '#ffb84d',
        padding: { x: 30, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const quit = this.add
      .text(0, 70, 'Quit to menu', { fontFamily: 'sans-serif', fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    resume.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      this.inputLocked = false;
      this.resetIdleTimer();
    });
    quit.on('pointerdown', () => this.scene.start('Menu'));

    panel.add([title, resume, quit]);
  }
}
