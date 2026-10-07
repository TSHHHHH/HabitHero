import { levelFromXp, type Attribute } from "./xp";

export type BossStatus = "active" | "ready" | "defeated" | "fled";

export interface BossRequirement {
  attribute: Attribute;
  minLevel: number;
}

export type AttributeXp = Record<Attribute, number>;

/** 0..1 progress toward the requirements; each requirement counts equally. */
export function bossProgress(reqs: BossRequirement[], xp: AttributeXp): number {
  if (reqs.length === 0) return 0;
  const sum = reqs.reduce(
    (acc, r) => acc + Math.min(levelFromXp(xp[r.attribute]) / r.minLevel, 1),
    0,
  );
  return sum / reqs.length;
}

export function resolveBossStatus(
  current: BossStatus,
  reqs: BossRequirement[],
  xp: AttributeXp,
  deadline: Date,
  now: Date,
): BossStatus {
  if (current === "defeated") return "defeated";
  const met = reqs.length > 0 && bossProgress(reqs, xp) >= 1;
  if (met) return "ready"; // meeting the requirements saves it even past the deadline
  if (now > deadline) return "fled";
  return "active";
}
