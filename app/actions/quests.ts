"use server";

import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { attributes, buildings, completions, players, quests } from "@/db/schema";
import { awardFor, levelFromXp } from "@/lib/game/xp";
import {
  CRIT_MULTIPLIER,
  MIN_EFFORT_XP_FACTOR,
  rollCrit,
  rollLoot,
  streakAfterCompletion,
} from "@/lib/game/motivation";
import { addDays } from "@/lib/game/recap";
import { currentPlayer } from "@/lib/server/player";
import { todayFor } from "@/lib/server/time";
import type { CompleteResult } from "@/lib/types";

export async function completeQuest(questId: string, mode: "full" | "mini"): Promise<CompleteResult> {
  if (mode !== "full" && mode !== "mini") return { ok: false, error: "Invalid mode" };

  const { db, player } = await currentPlayer();
  const today = todayFor(player.timezone);

  // The quest must belong to this player (via its building).
  const row = await db
    .select({ quest: quests, building: buildings })
    .from(quests)
    .innerJoin(buildings, eq(quests.buildingId, buildings.id))
    .where(and(eq(quests.id, questId), eq(buildings.playerId, player.id), eq(quests.archived, false)))
    .get();
  if (!row) return { ok: false, error: "Quest not found" };
  const { quest } = row;

  const doneToday = await db
    .select({ n: sql<number>`count(*)` })
    .from(completions)
    .where(and(eq(completions.questId, quest.id), eq(completions.date, today)))
    .get();
  if ((doneToday?.n ?? 0) >= quest.dailyCap) return { ok: false, error: "Already completed today" };

  const attr = await db
    .select()
    .from(attributes)
    .where(and(eq(attributes.playerId, player.id), eq(attributes.key, quest.attribute)))
    .get();
  const oldXp = attr?.xp ?? 0;

  const streak = streakAfterCompletion(
    { days: quest.streak, shields: quest.shields },
    quest.lastDoneDate,
    today,
    addDays(today, -1),
  );

  const base = awardFor(quest.difficulty, streak.days, player.hp <= 0);
  const crit = mode === "full" && rollCrit();
  const factor = (mode === "mini" ? MIN_EFFORT_XP_FACTOR : 1) * (crit ? CRIT_MULTIPLIER : 1);
  const gain = Math.max(1, Math.round(base.xp * factor));
  const loot = rollLoot();
  const goldGain = Math.round(base.gold * factor) + (loot?.gold ?? 0);

  const statements: BatchItem<"sqlite">[] = [
    db.insert(completions).values({
      playerId: player.id, questId: quest.id, attribute: quest.attribute, date: today,
      xp: gain, gold: goldGain, crit, mini: mode === "mini",
    }),
    db.update(quests)
      .set({ streak: streak.days, shields: streak.shields, lastDoneDate: today })
      .where(eq(quests.id, quest.id)),
    db.update(buildings)
      .set({ completions: sql`${buildings.completions} + 1` })
      .where(eq(buildings.id, quest.buildingId)),
    db.update(players)
      .set({ gold: sql`${players.gold} + ${goldGain}` })
      .where(eq(players.id, player.id)),
  ];
  statements.push(
    attr
      ? db.update(attributes)
          .set({ xp: sql`${attributes.xp} + ${gain}` })
          .where(and(eq(attributes.playerId, player.id), eq(attributes.key, quest.attribute)))
      : db.insert(attributes).values({ playerId: player.id, key: quest.attribute, xp: gain }),
  );
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  const newXp = oldXp + gain;
  const newLevel = levelFromXp(newXp);
  return {
    ok: true,
    attribute: quest.attribute,
    gain,
    goldGain,
    crit,
    loot,
    newLevel: newLevel > levelFromXp(oldXp) ? newLevel : null,
    attributeXp: newXp,
    gold: player.gold + goldGain,
    streak: streak.days,
    shields: streak.shields,
    date: today,
  };
}
