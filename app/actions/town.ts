"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { attributes, buildings, decorations, quests } from "@/db/schema";
import { canPlace, type BuildingType } from "@/lib/game/town";
import { LIMITS, normalizeSchedule, validateBuilding, validateQuest } from "@/lib/game/validate";
import { overallLevel, type Attribute, type Difficulty } from "@/lib/game/xp";
import { currentPlayer } from "@/lib/server/player";
import type { ActionResult, BuildingView, HabitView } from "@/lib/types";

type Db = Awaited<ReturnType<typeof currentPlayer>>["db"];

/** Everything on the grid right now: buildings plus placed decorations. */
async function occupants(db: Db, playerId: string) {
  const [b, d] = await Promise.all([
    db.select({ id: buildings.id, x: buildings.plotX, y: buildings.plotY })
      .from(buildings)
      .where(eq(buildings.playerId, playerId)),
    db.select({ id: decorations.id, x: decorations.plotX, y: decorations.plotY })
      .from(decorations)
      .where(and(eq(decorations.playerId, playerId), isNotNull(decorations.plotX))),
  ]);
  return [...b, ...d.map((o) => ({ id: o.id, x: o.x as number, y: o.y as number }))];
}

async function levelFor(db: Db, playerId: string) {
  const rows = await db.select().from(attributes).where(eq(attributes.playerId, playerId));
  const xp = { STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 } as Record<Attribute, number>;
  for (const r of rows) xp[r.key] = r.xp;
  return overallLevel(xp);
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export async function createBuilding(input: {
  name: string;
  type: BuildingType;
  attribute: Attribute;
  plotX: number;
  plotY: number;
}): Promise<ActionResult<{ building: BuildingView }>> {
  const err = validateBuilding(input);
  if (err) return { ok: false, error: err };
  if (!isInt(input.plotX) || !isInt(input.plotY)) return { ok: false, error: "Invalid plot" };

  const { db, player } = await currentPlayer();
  const plot = { x: input.plotX, y: input.plotY };
  if (!canPlace(plot, await levelFor(db, player.id), await occupants(db, player.id))) {
    return { ok: false, error: "That plot isn't available" };
  }

  try {
    const row = await db
      .insert(buildings)
      .values({
        playerId: player.id,
        name: input.name.trim(),
        type: input.type,
        attribute: input.attribute,
        plotX: plot.x,
        plotY: plot.y,
      })
      .returning()
      .get();
    return {
      ok: true,
      building: {
        id: row.id, name: row.name, type: row.type, attribute: row.attribute,
        plotX: row.plotX, plotY: row.plotY, completions: 0,
      },
    };
  } catch {
    return { ok: false, error: "That plot was just taken" };
  }
}

export async function moveBuilding(
  buildingId: string,
  plotX: number,
  plotY: number,
): Promise<ActionResult<{ buildingId: string; plotX: number; plotY: number }>> {
  if (typeof buildingId !== "string" || !isInt(plotX) || !isInt(plotY)) return { ok: false, error: "Invalid plot" };

  const { db, player } = await currentPlayer();
  const own = await db
    .select({ id: buildings.id })
    .from(buildings)
    .where(and(eq(buildings.id, buildingId), eq(buildings.playerId, player.id)))
    .get();
  if (!own) return { ok: false, error: "Building not found" };

  const plot = { x: plotX, y: plotY };
  if (!canPlace(plot, await levelFor(db, player.id), await occupants(db, player.id), buildingId)) {
    return { ok: false, error: "That plot isn't available" };
  }
  try {
    await db.update(buildings).set({ plotX, plotY }).where(eq(buildings.id, buildingId));
  } catch {
    return { ok: false, error: "That plot was just taken" };
  }
  return { ok: true, buildingId, plotX, plotY };
}

export async function createQuest(input: {
  buildingId: string;
  title: string;
  miniTitle: string;
  difficulty: Difficulty;
  schedule: number[];
}): Promise<ActionResult<{ habit: HabitView }>> {
  const err = validateQuest(input);
  if (err) return { ok: false, error: err };
  if (typeof input.buildingId !== "string") return { ok: false, error: "Building not found" };

  const { db, player } = await currentPlayer();
  const building = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.id, input.buildingId), eq(buildings.playerId, player.id)))
    .get();
  if (!building) return { ok: false, error: "Building not found" };

  const count = await db
    .select({ n: sql<number>`count(*)` })
    .from(quests)
    .innerJoin(buildings, eq(quests.buildingId, buildings.id))
    .where(and(eq(buildings.playerId, player.id), eq(quests.archived, false)))
    .get();
  if ((count?.n ?? 0) >= LIMITS.maxQuests) return { ok: false, error: `You can have at most ${LIMITS.maxQuests} active quests` };

  const row = await db
    .insert(quests)
    .values({
      buildingId: building.id,
      title: input.title.trim(),
      miniTitle: input.miniTitle.trim(),
      difficulty: input.difficulty,
      attribute: building.attribute,
      scheduleJson: JSON.stringify(normalizeSchedule(input.schedule)),
    })
    .returning()
    .get();

  return {
    ok: true,
    habit: {
      id: row.id,
      buildingId: row.buildingId,
      schedule: normalizeSchedule(input.schedule),
      title: row.title,
      miniTitle: row.miniTitle,
      difficulty: row.difficulty,
      attribute: row.attribute,
      streak: 0,
      shields: 0,
      buildingName: building.name,
      buildingType: building.type,
    },
  };
}

/** Retire a quest: hidden from the town, but its completion history stays. */
export async function retireQuest(questId: string): Promise<ActionResult<{ questId: string }>> {
  if (typeof questId !== "string") return { ok: false, error: "Quest not found" };
  const { db, player } = await currentPlayer();
  const own = await db
    .select({ id: quests.id })
    .from(quests)
    .innerJoin(buildings, eq(quests.buildingId, buildings.id))
    .where(and(eq(quests.id, questId), eq(buildings.playerId, player.id)))
    .get();
  if (!own) return { ok: false, error: "Quest not found" };
  await db.update(quests).set({ archived: true }).where(eq(quests.id, questId));
  return { ok: true, questId };
}
