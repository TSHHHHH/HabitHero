import { ATTRIBUTES, type Attribute } from "./xp";

export type Period = "week" | "month";
export const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30 };

export interface CompletionRecord {
  date: string; // YYYY-MM-DD
  habitId: string;
  attribute: Attribute;
  xp: number;
  gold: number;
  crit: boolean;
  mini: boolean;
}

export interface DayRecord {
  date: string;
  hpLost: number;
  shieldsUsed: number;
}

export interface Grade {
  letter: "S" | "A" | "B" | "C" | "D";
  title: string;
  line: string;
}

export interface Recap {
  period: Period;
  days: string[];
  totalXp: number;
  prevTotalXp: number;
  xpByAttr: Record<Attribute, number>;
  prevXpByAttr: Record<Attribute, number>;
  completions: number;
  possible: number;
  completionRate: number;
  perDay: number[];
  perfectDays: number;
  crits: number;
  minis: number;
  gold: number;
  hpLost: number;
  shieldsUsed: number;
  bestDay: { date: string; xp: number } | null;
  topHabitId: string | null;
  weakest: Attribute;
  grade: Grade;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Local-time YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function gradeFor(rate: number): Grade {
  if (rate >= 0.9) return { letter: "S", title: "Legend of the Realm", line: "Almost nothing slipped past you. The boss trembles." };
  if (rate >= 0.75) return { letter: "A", title: "Seasoned Champion", line: "Strong, steady and hard to stop." };
  if (rate >= 0.55) return { letter: "B", title: "Steady Adventurer", line: "Solid progress. A few more quests and you'll hit A." };
  if (rate >= 0.35) return { letter: "C", title: "Wavering Wanderer", line: "The road got rough. Minimum effort keeps the streak alive." };
  return { letter: "D", title: "Lost in the Fog", line: "Rough stretch. Take a Comeback quest and start small today." };
}

const emptyAttr = (): Record<Attribute, number> => ({ STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 });

export function computeRecap(
  completions: CompletionRecord[],
  dayRecords: DayRecord[],
  habitCount: number,
  period: Period,
  today: string,
): Recap {
  const n = PERIOD_DAYS[period];
  const from = addDays(today, -(n - 1));
  const prevFrom = addDays(from, -n);
  const prevTo = addDays(from, -1);
  const days = Array.from({ length: n }, (_, i) => addDays(from, i));

  const cur = completions.filter((c) => c.date >= from && c.date <= today);
  const prev = completions.filter((c) => c.date >= prevFrom && c.date <= prevTo);
  const curDays = dayRecords.filter((d) => d.date >= from && d.date <= today);

  const sumByAttr = (list: CompletionRecord[]) => {
    const out = emptyAttr();
    for (const c of list) out[c.attribute] += c.xp;
    return out;
  };
  const xpByAttr = sumByAttr(cur);
  const prevXpByAttr = sumByAttr(prev);

  const perDay = days.map((d) => cur.filter((c) => c.date === d).length);
  const possible = n * habitCount;
  const completionRate = possible === 0 ? 0 : Math.min(cur.length / possible, 1);

  const xpPerDay = new Map<string, number>();
  for (const c of cur) xpPerDay.set(c.date, (xpPerDay.get(c.date) ?? 0) + c.xp);
  const bestEntry = [...xpPerDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const habitCounts = new Map<string, number>();
  for (const c of cur) habitCounts.set(c.habitId, (habitCounts.get(c.habitId) ?? 0) + 1);
  const topHabit = [...habitCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const weakest = ATTRIBUTES.reduce((w, a) => (xpByAttr[a] < xpByAttr[w] ? a : w), ATTRIBUTES[0]);

  return {
    period,
    days,
    totalXp: cur.reduce((s, c) => s + c.xp, 0),
    prevTotalXp: prev.reduce((s, c) => s + c.xp, 0),
    xpByAttr,
    prevXpByAttr,
    completions: cur.length,
    possible,
    completionRate,
    perDay,
    perfectDays: habitCount > 0 ? perDay.filter((c) => c >= habitCount).length : 0,
    crits: cur.filter((c) => c.crit).length,
    minis: cur.filter((c) => c.mini).length,
    gold: cur.reduce((s, c) => s + c.gold, 0),
    hpLost: curDays.reduce((s, d) => s + d.hpLost, 0),
    shieldsUsed: curDays.reduce((s, d) => s + d.shieldsUsed, 0),
    bestDay: bestEntry ? { date: bestEntry[0], xp: bestEntry[1] } : null,
    topHabitId: topHabit ? topHabit[0] : null,
    weakest,
    grade: gradeFor(completionRate),
  };
}
