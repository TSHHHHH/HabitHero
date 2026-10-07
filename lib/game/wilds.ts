import { addDays } from "./recap";
import { levelFromXp, type Attribute } from "./xp";
import type { AttributeXp } from "./boss";

/** What a stage asks of the player. */
export type Requirement =
  | { kind: "attribute_level"; attribute: Attribute; minLevel: number }
  | { kind: "quest_count"; questId: string; count: number; windowDays?: number };

export type StageKind = "gate" | "count" | "boss";

export interface StageDef {
  id: string;
  ord: number;
  kind: StageKind;
  requirements: Requirement[];
}

export type StageStatus = "locked" | "active" | "ready" | "cleared";
export type LocationStatus = "active" | "ready" | "cleared" | "fled";

export interface ProgressContext {
  attributeXp: AttributeXp;
  /** Every quest completion on record (date is YYYY-MM-DD). */
  completions: { questId: string; date: string }[];
  today: string;
}

/** 0..1 progress for a single requirement. */
export function requirementProgress(req: Requirement, ctx: ProgressContext): number {
  if (req.kind === "attribute_level") {
    return Math.min(levelFromXp(ctx.attributeXp[req.attribute]) / req.minLevel, 1);
  }
  const from = req.windowDays ? addDays(ctx.today, -(req.windowDays - 1)) : "0000-00-00";
  const n = ctx.completions.filter(
    (c) => c.questId === req.questId && c.date >= from && c.date <= ctx.today,
  ).length;
  return Math.min(n / req.count, 1);
}

/** Mean progress over a stage's requirements. A stage with none can never be met. */
export function stageProgress(stage: StageDef, ctx: ProgressContext): number {
  if (stage.requirements.length === 0) return 0;
  const sum = stage.requirements.reduce((acc, r) => acc + requirementProgress(r, ctx), 0);
  return sum / stage.requirements.length;
}

export interface ResolvedLocation {
  stages: { id: string; status: StageStatus; progress: number }[];
  /** 0..1 across the whole dungeon; the boss HP bar is `1 - progress`. */
  progress: number;
  status: LocationStatus;
}

/**
 * Stages unlock in order. `clearedIds` is the persisted set of stages the player has
 * already confirmed, so a count window sliding past never un-clears a stage.
 * The last stage by `ord` is treated as the boss.
 */
export function resolveLocation(
  stageDefs: StageDef[],
  clearedIds: Set<string>,
  ctx: ProgressContext,
  deadline: string,
): ResolvedLocation {
  const stages = [...stageDefs].sort((a, b) => a.ord - b.ord);
  let currentFound = false;
  let total = 0;
  const out: ResolvedLocation["stages"] = [];

  for (const s of stages) {
    if (clearedIds.has(s.id)) {
      out.push({ id: s.id, status: "cleared", progress: 1 });
      total += 1;
    } else if (!currentFound) {
      currentFound = true;
      const p = stageProgress(s, ctx);
      out.push({ id: s.id, status: p >= 1 ? "ready" : "active", progress: p });
      total += p;
    } else {
      out.push({ id: s.id, status: "locked", progress: 0 });
    }
  }

  const progress = stages.length === 0 ? 0 : total / stages.length;
  const boss = out[out.length - 1];
  let status: LocationStatus;
  if (out.length > 0 && boss.status === "cleared") status = "cleared";
  else if (out.length > 0 && boss.status === "ready") status = "ready"; // meeting it saves it past the deadline
  else if (ctx.today > deadline) status = "fled";
  else status = "active";

  return { stages: out, progress, status };
}

/** Whole days from `today` to `deadline` (negative once it has passed). */
export function daysUntil(deadline: string, today: string): number {
  const ms = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(deadline) - ms(today)) / 86_400_000);
}

export const MAX_WINDOW_DAYS = 60; // the client keeps 60 days of history, so windows can't be longer

/** Current/needed numbers behind a requirement's progress bar. */
export function requirementDetail(req: Requirement, ctx: ProgressContext): { current: number; needed: number } {
  if (req.kind === "attribute_level") {
    return { current: Math.min(levelFromXp(ctx.attributeXp[req.attribute]), req.minLevel), needed: req.minLevel };
  }
  const p = requirementProgress(req, ctx);
  return { current: Math.round(p * req.count), needed: req.count };
}

/** Plain-language description, e.g. "Reach STR level 6" or "Complete Morning run 12 times in 14 days". */
export function describeRequirement(req: Requirement, questTitle: (id: string) => string): string {
  if (req.kind === "attribute_level") return `Reach ${req.attribute} level ${req.minLevel}`;
  const times = req.count === 1 ? "once" : `${req.count} times`;
  return `Complete ${questTitle(req.questId)} ${times}${req.windowDays ? ` in ${req.windowDays} days` : ""}`;
}
