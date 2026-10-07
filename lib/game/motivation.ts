import type { Attribute } from "./xp";

export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 2;
export const SHIELD_EVERY_DAYS = 7;
export const MAX_SHIELDS = 3;
export const BOSS_COUNTER_DAMAGE = 5;

/** `rng` is injectable so crits are testable. */
export function rollCrit(rng: () => number = Math.random): boolean {
  return rng() < CRIT_CHANCE;
}

export interface LootDrop {
  name: string;
  gold: number;
}

const LOOT: LootDrop[] = [
  { name: "Pouch of Coins", gold: 10 },
  { name: "Silver Idol", gold: 25 },
  { name: "Dragon Scale", gold: 60 },
];

/** ~15% of completions drop loot; rarer items are weighted lower. */
export function rollLoot(rng: () => number = Math.random): LootDrop | null {
  if (rng() >= 0.15) return null;
  const r = rng();
  return r < 0.65 ? LOOT[0] : r < 0.93 ? LOOT[1] : LOOT[2];
}

export interface StreakState {
  days: number;
  shields: number;
}

/** A shield is earned every SHIELD_EVERY_DAYS days of streak. */
export function onStreakIncrement(s: StreakState): StreakState {
  const days = s.days + 1;
  const earned = days % SHIELD_EVERY_DAYS === 0;
  return { days, shields: Math.min(s.shields + (earned ? 1 : 0), MAX_SHIELDS) };
}

/**
 * Streak after completing a quest today. If the last completion was before yesterday
 * the chain was already broken, so it starts over at 1 (shields are kept).
 * Doing it twice on the same day doesn't extend the streak.
 */
export function streakAfterCompletion(
  s: StreakState,
  lastDoneDate: string | null,
  today: string,
  yesterday: string,
): StreakState {
  if (lastDoneDate === today) return s;
  if (lastDoneDate === null || lastDoneDate < yesterday) {
    return onStreakIncrement({ days: 0, shields: s.shields });
  }
  return onStreakIncrement(s);
}

/** On a missed day a shield absorbs the miss; otherwise the streak resets. */
export function onMissedDay(s: StreakState): { state: StreakState; shieldUsed: boolean } {
  if (s.shields > 0) {
    return { state: { days: s.days, shields: s.shields - 1 }, shieldUsed: true };
  }
  return { state: { days: 0, shields: 0 }, shieldUsed: false };
}

export interface Title {
  id: string;
  name: string;
  attribute: Attribute;
  minLevel: number;
}

export const TITLES: Title[] = [
  { id: "str-5", name: "Iron Disciple", attribute: "STR", minLevel: 5 },
  { id: "int-5", name: "Scholar of the Deep", attribute: "INT", minLevel: 5 },
  { id: "vit-5", name: "Unbroken", attribute: "VIT", minLevel: 5 },
  { id: "wis-5", name: "Still Water", attribute: "WIS", minLevel: 5 },
  { id: "cha-5", name: "Silver Tongue", attribute: "CHA", minLevel: 5 },
];

export function earnedTitles(levels: Record<Attribute, number>): Title[] {
  return TITLES.filter((t) => levels[t.attribute] >= t.minLevel);
}

/** Minimum-effort ("2-minute") completions count for the streak but pay less. */
export const MIN_EFFORT_XP_FACTOR = 0.3;
