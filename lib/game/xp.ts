export const ATTRIBUTES = ["STR", "INT", "VIT", "WIS", "CHA"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const DIFFICULTY_XP = {
  trivial: 5,
  easy: 10,
  medium: 20,
  hard: 40,
  epic: 80,
} as const;
export type Difficulty = keyof typeof DIFFICULTY_XP;

/** Total XP required to reach level n (level 1 = 0 XP). */
export function xpForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.round(100 * Math.pow(n - 1, 1.5));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** +5% per streak day, capped at +50%. */
export function streakMultiplier(streakDays: number): number {
  return 1 + Math.min(Math.max(streakDays, 0) * 0.05, 0.5);
}

export interface XpAward {
  xp: number;
  gold: number;
}

export function awardFor(
  difficulty: Difficulty,
  streakDays: number,
  weakened = false,
): XpAward {
  const base = DIFFICULTY_XP[difficulty];
  const mult = streakMultiplier(streakDays) * (weakened ? 0.5 : 1);
  return { xp: Math.round(base * mult), gold: Math.max(1, Math.round((base / 4) * mult)) };
}

/** Overall hero level: derived from half the combined attribute XP. */
export function overallLevel(xp: Record<Attribute, number>): number {
  return levelFromXp(ATTRIBUTES.reduce((s, a) => s + xp[a], 0) / 2);
}
