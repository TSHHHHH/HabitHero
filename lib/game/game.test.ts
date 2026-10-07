import { describe, expect, it } from "vitest";
import { awardFor, levelFromXp, streakMultiplier, xpForLevel } from "./xp";
import { bossProgress, resolveBossStatus } from "./boss";

const zero = { STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 };

describe("xp", () => {
  it("level curve is monotonic and invertible", () => {
    for (let n = 1; n < 30; n++) {
      expect(levelFromXp(xpForLevel(n))).toBe(n);
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });
  it("streak multiplier caps at +50%", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(4)).toBeCloseTo(1.2);
    expect(streakMultiplier(100)).toBe(1.5);
  });
  it("weakened halves rewards", () => {
    expect(awardFor("hard", 0, true).xp).toBe(20);
  });
});

describe("boss", () => {
  const reqs = [{ attribute: "STR" as const, minLevel: 3 }];
  const future = new Date("2030-01-01");
  const past = new Date("2020-01-01");
  const now = new Date("2026-01-01");
  it("progress scales with level", () => {
    expect(bossProgress(reqs, zero)).toBeCloseTo(1 / 3);
  });
  it("becomes ready when requirements are met", () => {
    expect(resolveBossStatus("active", reqs, { ...zero, STR: xpForLevel(3) }, future, now)).toBe("ready");
  });
  it("flees after deadline if unmet, stays defeated", () => {
    expect(resolveBossStatus("active", reqs, zero, past, now)).toBe("fled");
    expect(resolveBossStatus("defeated", reqs, zero, past, now)).toBe("defeated");
  });
});

import { onMissedDay, onStreakIncrement, rollCrit, rollLoot, earnedTitles } from "./motivation";

describe("motivation", () => {
  it("earns a shield every 7 days, capped at 3", () => {
    let s = { days: 0, shields: 0 };
    for (let i = 0; i < 7; i++) s = onStreakIncrement(s);
    expect(s).toEqual({ days: 7, shields: 1 });
    s = { days: 20, shields: 3 };
    s = onStreakIncrement(s); // 21
    expect(s.shields).toBe(3);
  });
  it("shield absorbs a miss, otherwise streak resets", () => {
    expect(onMissedDay({ days: 10, shields: 1 })).toEqual({
      state: { days: 10, shields: 0 },
      shieldUsed: true,
    });
    expect(onMissedDay({ days: 10, shields: 0 }).state.days).toBe(0);
  });
  it("crit and loot respect rng", () => {
    expect(rollCrit(() => 0.05)).toBe(true);
    expect(rollCrit(() => 0.5)).toBe(false);
    expect(rollLoot(() => 0.9)).toBeNull();
    expect(rollLoot(() => 0.01)?.name).toBe("Pouch of Coins");
  });
  it("grants titles at level thresholds", () => {
    const lv = { STR: 5, INT: 1, VIT: 1, WIS: 1, CHA: 1 };
    expect(earnedTitles(lv).map((t) => t.name)).toEqual(["Iron Disciple"]);
  });
});

import { streakAfterCompletion } from "./motivation";

describe("streakAfterCompletion", () => {
  const s = { days: 6, shields: 1 };
  it("continues the chain when done yesterday, and earns a shield on day 7", () => {
    expect(streakAfterCompletion(s, "2026-10-07", "2026-10-08", "2026-10-07")).toEqual({ days: 7, shields: 2 });
  });
  it("restarts at 1 when the chain was broken or never started, keeping shields", () => {
    expect(streakAfterCompletion(s, "2026-10-05", "2026-10-08", "2026-10-07")).toEqual({ days: 1, shields: 1 });
    expect(streakAfterCompletion({ days: 0, shields: 0 }, null, "2026-10-08", "2026-10-07")).toEqual({ days: 1, shields: 0 });
  });
  it("does not extend twice on the same day", () => {
    expect(streakAfterCompletion(s, "2026-10-08", "2026-10-08", "2026-10-07")).toEqual(s);
  });
});
