// All UI strings live here so a Gujarati/Hindi (Devanagari) locale can be added later by
// adding one more column, without touching scene code.
export type Language = 'en' | 'hi-roman';

const STRINGS = {
  appTitle: { en: 'Mithai Match', 'hi-roman': 'Mithai Match' },
  tagline: { en: 'A mithai match-3 adventure', 'hi-roman': 'Ek mithai match-3 safar' },
  play: { en: 'PLAY', 'hi-roman': 'KHELO' },
  shop: { en: 'SHOP', 'hi-roman': 'DUKAAN' },
  dailyReward: { en: 'DAILY REWARD', 'hi-roman': 'ROZANA INAAM' },
  settings: { en: 'SETTINGS', 'hi-roman': 'SETTINGS' },
  levelMap: { en: 'Levels', 'hi-roman': 'Level' },
  locked: { en: 'Locked', 'hi-roman': 'Band' },
  back: { en: 'Back', 'hi-roman': 'Peeche' },
  moves: { en: 'Moves', 'hi-roman': 'Chaalein' },
  score: { en: 'Score', 'hi-roman': 'Score' },
  levelComplete: { en: 'Level Complete!', 'hi-roman': 'Level Poora!' },
  outOfMoves: { en: 'Out of Moves', 'hi-roman': 'Chaalein Khatam' },
  next: { en: 'NEXT', 'hi-roman': 'AAGE' },
  retry: { en: 'RETRY', 'hi-roman': 'PHIR SE' },
  backToMenu: { en: 'Back to menu', 'hi-roman': 'Menu par jao' },
  paused: { en: 'Paused', 'hi-roman': 'Ruka Hua' },
  resume: { en: 'RESUME', 'hi-roman': 'JAARI RAKHO' },
  quitToMenu: { en: 'Quit to menu', 'hi-roman': 'Menu mein jao' },
  outOfLives: { en: 'Out of Lives', 'hi-roman': 'Jaan Khatam' },
  refillWithCoins: { en: 'Refill with coins', 'hi-roman': 'Sikkon se bharo' },
  buyLives: { en: 'Buy 5 lives', 'hi-roman': '5 jaan khareedo' },
  waitForLife: { en: 'Wait for next life', 'hi-roman': 'Agli jaan ka intezaar karo' },
  notEnoughCoins: { en: 'Not enough coins', 'hi-roman': 'Sikke kam hain' },
  claim: { en: 'CLAIM', 'hi-roman': 'LO' },
  alreadyClaimedToday: { en: 'Come back tomorrow!', 'hi-roman': 'Kal phir aana!' },
  mithaiShop: { en: 'Mithai Shop', 'hi-roman': 'Mithai ki Dukaan' },
  buy: { en: 'Buy', 'hi-roman': 'Khareedo' },
  owned: { en: 'Owned', 'hi-roman': 'Mil Gaya' },
  lockedUntilLevel: { en: 'Unlocks at level', 'hi-roman': 'Level par khulega' },
  sound: { en: 'Sound', 'hi-roman': 'Awaaz' },
  music: { en: 'Music', 'hi-roman': 'Sangeet' },
  haptics: { en: 'Vibration', 'hi-roman': 'Kampan' },
  language: { en: 'Language', 'hi-roman': 'Bhasha' },
  restorePurchases: { en: 'Restore purchases', 'hi-roman': 'Khareedari wapas lao' },
  deleteMyData: { en: 'Delete my data', 'hi-roman': 'Mera data mitao' },
  privacyPolicy: { en: 'Privacy Policy', 'hi-roman': 'Privacy Policy' },
  appVersion: { en: 'Version', 'hi-roman': 'Version' },
  hammer: { en: 'Hammer', 'hi-roman': 'Hathoda' },
  shuffle: { en: 'Shuffle', 'hi-roman': 'Fer-badal' },
  extraStriped: { en: 'Striped Start', 'hi-roman': 'Dhaari Shuruaat' },
  extraMoves3: { en: '+3 Moves', 'hi-roman': '+3 Chaalein' },
  start: { en: 'START', 'hi-roman': 'SHURU' },
  coins: { en: 'Coins', 'hi-roman': 'Sikke' },
  lives: { en: 'Lives', 'hi-roman': 'Jaan' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, language: Language): string {
  return STRINGS[key][language];
}
