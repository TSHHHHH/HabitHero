"use server";

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  attributes,
  buildings,
  completions,
  locations,
  players,
  quests,
  stageRequirements,
  stages,
  titles,
} from "@/db/schema";
import type { Db } from "@/db/client";
import { addDays } from "@/lib/game/recap";
import { isDateKey, LOCATION_LIMITS, validateLocation, type PlaceType } from "@/lib/game/validate";
import { resolveLocation, type ProgressContext, type Requirement } from "@/lib/game/wilds";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import { currentPlayer, type Player } from "@/lib/server/player";
import { loadLocations } from "@/lib/server/state";
import { todayFor } from "@/lib/server/time";
import type { ActionResult, LocationView } from "@/lib/types";

const HISTORY_DAYS = 60;

interface StageInput {
  title: string;
  requirements: Requirement[];
}

async function progressContext(db: Db, player: Player, today: string): Promise<ProgressContext> {
  const [attrRows, completionRows] = await Promise.all([
    db.select().from(attributes).where(eq(attributes.playerId, player.id)),
    db
      .select({ questId: completions.questId, date: completions.date })
      .from(completions)
      .where(and(eq(completions.playerId, player.id), gte(completions.date, addDays(today, -HISTORY_DAYS)))),
  ]);
  const attributeXp = { STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 } as Record<Attribute, number>;
  for (const r of attrRows) attributeXp[r.key] = r.xp;
  return { attributeXp, completions: completionRows, today };
}

export async function createLocation(input: {
  name: string;
  placeType: PlaceType;
  description: string;
  deadline: string;
  rewardXp: number;
  rewardGold: number;
  stages: StageInput[];
  boss: StageInput;
}): Promise<ActionResult<{ location: LocationView }>> {
  const { db, player } = await currentPlayer();
  const today = todayFor(player.timezone);
  const err = validateLocation(input, today);
  if (err) return { ok: false, error: err };

  // Count requirements may only reference this player's own active quests.
  const allStages = [...input.stages, input.boss];
  const questIds = [
    ...new Set(
      allStages.flatMap((s) => s.requirements.flatMap((r) => (r.kind === "quest_count" ? [r.questId] : []))),
    ),
  ];
  if (questIds.length > 0) {
    const own = await db
      .select({ id: quests.id })
      .from(quests)
      .innerJoin(buildings, eq(quests.buildingId, buildings.id))
      .where(and(inArray(quests.id, questIds), eq(buildings.playerId, player.id), eq(quests.archived, false)));
    if (own.length !== questIds.length) return { ok: false, error: "One of the chosen quests doesn't exist" };
  }

  const open = await db
    .select({ n: sql<number>`count(*)` })
    .from(locations)
    .where(and(eq(locations.playerId, player.id), inArray(locations.status, ["active", "ready"])))
    .get();
  if ((open?.n ?? 0) >= LOCATION_LIMITS.maxActive) {
    return { ok: false, error: `You can have at most ${LOCATION_LIMITS.maxActive} open locations` };
  }

  const locationId = crypto.randomUUID();
  const statements: BatchItem<"sqlite">[] = [
    db.insert(locations).values({
      id: locationId,
      playerId: player.id,
      name: input.name.trim(),
      placeType: input.placeType,
      description: input.description.trim(),
      deadline: input.deadline,
      rewardXp: input.rewardXp,
      rewardGold: input.rewardGold,
    }),
  ];
  allStages.forEach((s, i) => {
    const stageId = crypto.randomUUID();
    const isBoss = i === allStages.length - 1;
    statements.push(
      db.insert(stages).values({
        id: stageId,
        locationId,
        ord: i + 1,
        kind: isBoss ? "boss" : s.requirements.some((r) => r.kind === "quest_count") ? "count" : "gate",
        title: s.title.trim(),
      }),
    );
    for (const r of s.requirements) {
      statements.push(
        db.insert(stageRequirements).values(
          r.kind === "attribute_level"
            ? { stageId, kind: r.kind, attribute: r.attribute, minLevel: r.minLevel }
            : { stageId, kind: r.kind, questId: r.questId, count: r.count, windowDays: r.windowDays ?? null },
        ),
      );
    }
  });
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  const created = (await loadLocations(db, player.id)).find((l) => l.id === locationId);
  if (!created) return { ok: false, error: "Could not create the location" };
  return { ok: true, location: created };
}

export async function clearStage(
  locationId: string,
  stageId: string,
): Promise<
  ActionResult<{
    stageId: string;
    bossDefeated: boolean;
    clearedOn: string;
    rewards: { xp: number; gold: number; title: string | null };
    attributeXp: Record<Attribute, number>;
    gold: number;
  }>
> {
  if (typeof locationId !== "string" || typeof stageId !== "string") return { ok: false, error: "Not found" };

  const { db, player } = await currentPlayer();
  const today = todayFor(player.timezone);
  const location = (await loadLocations(db, player.id)).find((l) => l.id === locationId);
  if (!location) return { ok: false, error: "Location not found" };
  if (location.status === "cleared") return { ok: false, error: "Already cleared" };

  const ctx = await progressContext(db, player, today);
  const resolved = resolveLocation(
    location.stages.map((s) => ({ id: s.id, ord: s.ord, kind: s.kind, requirements: s.requirements })),
    new Set(location.stages.filter((s) => s.clearedAt).map((s) => s.id)),
    ctx,
    location.deadline,
  );
  if (resolved.status === "fled") return { ok: false, error: "This location was abandoned. Re-summon it first." };
  if (resolved.stages.find((s) => s.id === stageId)?.status !== "ready") {
    return { ok: false, error: "That stage isn't ready yet" };
  }

  const isBoss = location.stages[location.stages.length - 1].id === stageId;
  const perAttribute = isBoss ? Math.floor(location.rewardXp / ATTRIBUTES.length) : 0;
  const goldReward = isBoss ? location.rewardGold : 0;

  const statements: BatchItem<"sqlite">[] = [
    db.update(stages).set({ clearedAt: today }).where(eq(stages.id, stageId)),
  ];
  if (isBoss) {
    statements.push(
      db.update(locations).set({ status: "cleared", clearedAt: today }).where(eq(locations.id, locationId)),
      db.update(players).set({ gold: sql`${players.gold} + ${goldReward}` }).where(eq(players.id, player.id)),
    );
    if (perAttribute > 0) {
      statements.push(
        db
          .update(attributes)
          .set({ xp: sql`${attributes.xp} + ${perAttribute}` })
          .where(eq(attributes.playerId, player.id)),
      );
    }
    if (location.rewardTitle) {
      statements.push(
        db.insert(titles).values({ playerId: player.id, titleId: location.rewardTitle }).onConflictDoNothing(),
      );
    }
  }
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  const attributeXp = { ...ctx.attributeXp };
  for (const a of ATTRIBUTES) attributeXp[a] += perAttribute;
  return {
    ok: true,
    stageId,
    bossDefeated: isBoss,
    clearedOn: today,
    rewards: { xp: perAttribute * ATTRIBUTES.length, gold: goldReward, title: isBoss ? location.rewardTitle : null },
    attributeXp,
    gold: player.gold + goldReward,
  };
}

/** Give a location that fled a fresh deadline. Progress already made is kept. */
export async function resummonLocation(
  locationId: string,
  deadline: string,
): Promise<ActionResult<{ locationId: string; deadline: string }>> {
  if (typeof locationId !== "string" || !isDateKey(deadline)) return { ok: false, error: "Pick a new deadline" };

  const { db, player } = await currentPlayer();
  const today = todayFor(player.timezone);
  if (deadline < today) return { ok: false, error: "The deadline can't be in the past" };

  const location = await db
    .select()
    .from(locations)
    .where(and(eq(locations.id, locationId), eq(locations.playerId, player.id)))
    .get();
  if (!location) return { ok: false, error: "Location not found" };
  if (location.status === "cleared") return { ok: false, error: "Already cleared" };
  if (location.deadline >= today) return { ok: false, error: "This location hasn't fled" };

  await db.update(locations).set({ deadline, status: "active" }).where(eq(locations.id, locationId));
  return { ok: true, locationId, deadline };
}
