import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  attributes,
  buildings,
  completions,
  dayRecords,
  locations,
  quests,
  stageRequirements,
  stages,
} from "@/db/schema";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import { addDays } from "@/lib/game/recap";
import type { Requirement } from "@/lib/game/wilds";
import type { GameState, LocationView } from "@/lib/types";
import { todayFor } from "./time";
import type { Player } from "./player";

const HISTORY_DAYS = 60;

function parseSchedule(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  } catch {
    return [];
  }
}

function toRequirement(r: typeof stageRequirements.$inferSelect): Requirement | null {
  if (r.kind === "attribute_level" && r.attribute && r.minLevel) {
    return { kind: "attribute_level", attribute: r.attribute, minLevel: r.minLevel };
  }
  if (r.kind === "quest_count" && r.questId && r.count) {
    return { kind: "quest_count", questId: r.questId, count: r.count, windowDays: r.windowDays ?? undefined };
  }
  return null;
}

/** All of a player's locations with their ordered stages and requirements. */
export async function loadLocations(db: Db, playerId: string): Promise<LocationView[]> {
  const [locRows, stageRows, reqRows] = await Promise.all([
    db.select().from(locations).where(eq(locations.playerId, playerId)).orderBy(asc(locations.deadline)),
    db
      .select({ stage: stages })
      .from(stages)
      .innerJoin(locations, eq(stages.locationId, locations.id))
      .where(eq(locations.playerId, playerId))
      .orderBy(asc(stages.ord)),
    db
      .select({ req: stageRequirements })
      .from(stageRequirements)
      .innerJoin(stages, eq(stageRequirements.stageId, stages.id))
      .innerJoin(locations, eq(stages.locationId, locations.id))
      .where(eq(locations.playerId, playerId)),
  ]);

  const reqsByStage = new Map<string, Requirement[]>();
  for (const { req } of reqRows) {
    const parsed = toRequirement(req);
    if (parsed) reqsByStage.set(req.stageId, [...(reqsByStage.get(req.stageId) ?? []), parsed]);
  }

  return locRows.map((l) => ({
    id: l.id,
    name: l.name,
    placeType: l.placeType,
    description: l.description,
    deadline: l.deadline,
    status: l.status,
    rewardXp: l.rewardXp,
    rewardGold: l.rewardGold,
    rewardTitle: l.rewardTitle,
    stages: stageRows
      .filter(({ stage }) => stage.locationId === l.id)
      .map(({ stage }) => ({
        id: stage.id,
        ord: stage.ord,
        kind: stage.kind,
        title: stage.title,
        clearedAt: stage.clearedAt,
        requirements: reqsByStage.get(stage.id) ?? [],
      })),
  }));
}

export async function loadGameState(db: Db, player: Player): Promise<GameState> {
  const today = todayFor(player.timezone);
  const since = addDays(today, -HISTORY_DAYS);

  const [questRows, attrRows, completionRows, dayRows, buildingRows, locationViews] = await Promise.all([
    db
      .select({ quest: quests, building: buildings })
      .from(quests)
      .innerJoin(buildings, eq(quests.buildingId, buildings.id))
      .where(and(eq(buildings.playerId, player.id), eq(quests.archived, false)))
      .orderBy(asc(buildings.plotY), asc(buildings.plotX), asc(quests.createdAt), asc(quests.title)),
    db.select().from(attributes).where(eq(attributes.playerId, player.id)),
    db
      .select()
      .from(completions)
      .where(and(eq(completions.playerId, player.id), gte(completions.date, since)))
      .orderBy(asc(completions.createdAt)),
    db
      .select()
      .from(dayRecords)
      .where(and(eq(dayRecords.playerId, player.id), gte(dayRecords.date, since))),
    db
      .select()
      .from(buildings)
      .where(eq(buildings.playerId, player.id))
      .orderBy(asc(buildings.plotY), asc(buildings.plotX)),
    loadLocations(db, player.id),
  ]);

  const xp = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  for (const r of attrRows) xp[r.key] = r.xp;

  const done: GameState["done"] = {};
  for (const c of completionRows) if (c.date === today) done[c.questId] = c.mini ? "mini" : "full";

  return {
    player: {
      name: player.name,
      townName: player.townName,
      theme: player.theme,
      hp: player.hp,
      maxHp: player.maxHp,
      gold: player.gold,
    },
    xp,
    locations: locationViews,
    buildings: buildingRows.map((b) => ({
      id: b.id, name: b.name, type: b.type, attribute: b.attribute,
      plotX: b.plotX, plotY: b.plotY, completions: b.completions,
    })),
    habits: questRows.map(({ quest, building }) => ({
      id: quest.id,
      buildingId: quest.buildingId,
      schedule: parseSchedule(quest.scheduleJson),
      title: quest.title,
      miniTitle: quest.miniTitle,
      difficulty: quest.difficulty,
      attribute: quest.attribute,
      streak: quest.streak,
      shields: quest.shields,
      buildingName: building.name,
      buildingType: building.type,
    })),
    done,
    completions: completionRows.map((c) => ({
      date: c.date,
      habitId: c.questId,
      attribute: c.attribute,
      xp: c.xp,
      gold: c.gold,
      crit: c.crit,
      mini: c.mini,
    })),
    days: dayRows.map((d) => ({ date: d.date, hpLost: d.hpLost, shieldsUsed: d.shieldsUsed })),
    today,
  };
}
