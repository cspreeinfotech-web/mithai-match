// The Mithai Shop meta-game: 8 stages (stall -> grand palace), 3 decorations each.
// Pure data so new stages/decorations never need a code change.
export interface ShopDecoration {
  id: string;
  name: string;
  cost: number;
}

export interface ShopStage {
  id: number;
  name: string;
  unlocksAtLevel: number; // player's currentLevel must be >= this to shop at this stage
  decorations: ShopDecoration[];
}

export const SHOP_STAGES: ShopStage[] = [
  { id: 1, name: 'Mithai Stall', unlocksAtLevel: 1 },
  { id: 2, name: 'Pushcart', unlocksAtLevel: 4 },
  { id: 3, name: 'Small Shop', unlocksAtLevel: 8 },
  { id: 4, name: 'Corner Shop', unlocksAtLevel: 13 },
  { id: 5, name: 'Sweet House', unlocksAtLevel: 19 },
  { id: 6, name: 'Grand Store', unlocksAtLevel: 26 },
  { id: 7, name: 'Royal Mithai Hall', unlocksAtLevel: 34 },
  { id: 8, name: 'Grand Mithai Palace', unlocksAtLevel: 43 },
].map((stage) => ({
  ...stage,
  decorations: [
    { id: `${stage.id}-sign`, name: `${stage.name} sign`, cost: 80 + stage.id * 40 },
    { id: `${stage.id}-lights`, name: `${stage.name} string lights`, cost: 120 + stage.id * 50 },
    { id: `${stage.id}-display`, name: `${stage.name} sweet display`, cost: 160 + stage.id * 60 },
  ],
}));
