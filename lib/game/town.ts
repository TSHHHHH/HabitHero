import { levelFromXp, xpForLevel, type Attribute } from "./xp";

export const BUILDING_TYPES = [
  "gym", "library", "garden", "workshop", "shrine", "tavern", "home", "custom",
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const BUILDING_AFFINITY: Record<BuildingType, Attribute | null> = {
  gym: "STR",
  library: "INT",
  garden: "VIT",
  workshop: "INT",
  shrine: "WIS",
  tavern: "CHA",
  home: "VIT",
  custom: null,
};

export type Tier = 0 | 1 | 2 | 3; // tent, house, tower, fortress

const XP_PER_COMPLETION = 10;

/** Completions needed to reach `level` (for progress bars). */
export function completionsForLevel(level: number): number {
  return Math.ceil(xpForLevel(level) / XP_PER_COMPLETION);
}

/** Buildings level with use: 10 completions for L2, ~29 for L3, ~80 for L5. */
export function buildingLevel(completions: number): number {
  return levelFromXp(Math.max(completions, 0) * XP_PER_COMPLETION);
}

/** Mirrors the thresholds the map art uses for each landmark tier. */
export function buildingTier(level: number): Tier {
  if (level < 3) return 0;
  if (level < 5) return 1;
  if (level < 8) return 2;
  return 3;
}

/** The town grid is square and grows with your overall level. */
export function gridSize(overallLevel: number): number {
  if (overallLevel >= 10) return 6;
  if (overallLevel >= 5) return 5;
  return 4;
}

export interface Plot {
  x: number;
  y: number;
}

export function plotInBounds(p: Plot, overallLevel: number): boolean {
  const n = gridSize(overallLevel);
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < n && p.y < n;
}

/** A plot is free when no building or decoration sits on it (optionally ignoring one by id). */
export function isPlotFree(
  p: Plot,
  occupants: { id: string; x: number; y: number }[],
  ignoreId?: string,
): boolean {
  return !occupants.some((o) => o.id !== ignoreId && o.x === p.x && o.y === p.y);
}

export function canPlace(
  p: Plot,
  overallLevel: number,
  occupants: { id: string; x: number; y: number }[],
  ignoreId?: string,
): boolean {
  return plotInBounds(p, overallLevel) && isPlotFree(p, occupants, ignoreId);
}

export const DECORATIONS = {
  tree: { name: "Oak Tree", cost: 20 },
  lantern: { name: "Lantern", cost: 35 },
  banner: { name: "Banner", cost: 50 },
  fountain: { name: "Fountain", cost: 120 },
} as const;
export type DecorationKind = keyof typeof DECORATIONS;

/** Returns the new gold balance, or null if the player can't afford it. */
export function purchaseDecoration(gold: number, kind: DecorationKind): number | null {
  const cost = DECORATIONS[kind].cost;
  return gold >= cost ? gold - cost : null;
}
