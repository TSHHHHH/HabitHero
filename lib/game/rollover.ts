import { BOSS_COUNTER_DAMAGE, onMissedDay } from "./motivation";

export const PERFECT_DAY_HEAL = 5;

export interface RolloverQuest {
  id: string;
  streak: number;
  shields: number;
  /** Weekdays it's due on (0 = Sunday .. 6 = Saturday). Empty or omitted means daily. */
  schedule?: number[];
}

export interface RolloverResult {
  quests: RolloverQuest[];
  hp: number;
  hpLost: number;
  shieldsUsed: number;
  missedIds: string[];
  perfect: boolean;
}

export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDue(quest: Pick<RolloverQuest, "schedule">, dateKey: string): boolean {
  return !quest.schedule || quest.schedule.length === 0 || quest.schedule.includes(weekdayOf(dateKey));
}

/**
 * Closes out one day. A missed quest spends a shield if it has one (no HP loss),
 * otherwise its streak resets and the boss counter-attacks. Stats are never reduced.
 * A day with at least one due quest and no misses heals a little.
 */
export function rolloverDay(
  date: string,
  quests: RolloverQuest[],
  doneIds: Set<string>,
  hp: number,
  maxHp: number,
): RolloverResult {
  let hpLost = 0;
  let shieldsUsed = 0;
  let dueCount = 0;
  const missedIds: string[] = [];

  const next = quests.map((q) => {
    if (!isDue(q, date)) return q;
    dueCount++;
    if (doneIds.has(q.id)) return q;
    missedIds.push(q.id);
    const { state, shieldUsed } = onMissedDay({ days: q.streak, shields: q.shields });
    if (shieldUsed) shieldsUsed++;
    else hpLost += BOSS_COUNTER_DAMAGE;
    return { ...q, streak: state.days, shields: state.shields };
  });

  const perfect = dueCount > 0 && missedIds.length === 0;
  const newHp = Math.min(maxHp, Math.max(0, hp - hpLost) + (perfect ? PERFECT_DAY_HEAL : 0));
  return {
    quests: next,
    hp: newHp,
    hpLost: Math.min(hpLost, hp),
    shieldsUsed,
    missedIds,
    perfect,
  };
}
