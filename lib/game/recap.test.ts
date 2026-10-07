import { describe, expect, it } from "vitest";
import { addDays, computeRecap, gradeFor, type CompletionRecord } from "./recap";

const rec = (date: string, habitId: string, attribute: CompletionRecord["attribute"], xp: number, extra: Partial<CompletionRecord> = {}): CompletionRecord => ({
  date, habitId, attribute, xp, gold: 2, crit: false, mini: false, ...extra,
});

describe("recap", () => {
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("grades by completion rate", () => {
    expect(gradeFor(0.95).letter).toBe("S");
    expect(gradeFor(0.8).letter).toBe("A");
    expect(gradeFor(0.6).letter).toBe("B");
    expect(gradeFor(0.4).letter).toBe("C");
    expect(gradeFor(0.1).letter).toBe("D");
  });

  it("computes weekly totals, previous-period XP and perfect days", () => {
    const today = "2026-10-08";
    const list = [
      rec("2026-10-08", "a", "STR", 20, { crit: true }),
      rec("2026-10-08", "b", "INT", 10),
      rec("2026-10-07", "a", "STR", 20),
      rec("2026-10-01", "a", "STR", 99), // previous week
      rec("2026-09-01", "a", "STR", 500), // out of both windows
    ];
    const r = computeRecap(list, [{ date: "2026-10-07", hpLost: 5, shieldsUsed: 1 }], 2, "week", today);
    expect(r.totalXp).toBe(50);
    expect(r.prevTotalXp).toBe(99);
    expect(r.xpByAttr.STR).toBe(40);
    expect(r.completions).toBe(3);
    expect(r.possible).toBe(14);
    expect(r.perfectDays).toBe(1);
    expect(r.crits).toBe(1);
    expect(r.hpLost).toBe(5);
    expect(r.shieldsUsed).toBe(1);
    expect(r.bestDay).toEqual({ date: "2026-10-08", xp: 30 });
    expect(r.topHabitId).toBe("a");
    expect(r.weakest).toBe("VIT");
    expect(r.days).toHaveLength(7);
  });

  it("monthly window is 30 days", () => {
    const r = computeRecap([rec("2026-09-10", "a", "STR", 10)], [], 1, "month", "2026-10-08");
    expect(r.days).toHaveLength(30);
    expect(r.totalXp).toBe(10);
  });

  it("handles empty history", () => {
    const r = computeRecap([], [], 0, "week", "2026-10-08");
    expect(r.completionRate).toBe(0);
    expect(r.bestDay).toBeNull();
    expect(r.grade.letter).toBe("D");
  });
});
