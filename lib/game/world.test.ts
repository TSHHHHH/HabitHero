import { describe, expect, it } from "vitest";
import { xpForLevel } from "./xp";
import { isDue, rolloverDay, weekdayOf } from "./rollover";
import { resolveLocation, requirementProgress, stageProgress, type ProgressContext, type StageDef } from "./wilds";
import { buildingLevel, buildingTier, canPlace, gridSize, purchaseDecoration } from "./town";

const zeroXp = { STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 };
const ctx = (over: Partial<ProgressContext> = {}): ProgressContext => ({
  attributeXp: zeroXp,
  completions: [],
  today: "2026-10-08",
  ...over,
});

describe("wilds requirements", () => {
  it("attribute_level progress scales with level and caps at 1", () => {
    const req = { kind: "attribute_level", attribute: "STR", minLevel: 3 } as const;
    expect(requirementProgress(req, ctx())).toBeCloseTo(1 / 3);
    expect(requirementProgress(req, ctx({ attributeXp: { ...zeroXp, STR: xpForLevel(9) } }))).toBe(1);
  });

  it("quest_count honours the sliding window", () => {
    const req = { kind: "quest_count", questId: "q", count: 4, windowDays: 3 } as const;
    const completions = [
      { questId: "q", date: "2026-10-08" },
      { questId: "q", date: "2026-10-07" },
      { questId: "q", date: "2026-10-05" }, // outside the 3-day window
      { questId: "other", date: "2026-10-08" },
    ];
    expect(requirementProgress(req, ctx({ completions }))).toBe(2 / 4);
    expect(requirementProgress({ ...req, windowDays: undefined }, ctx({ completions }))).toBe(3 / 4);
  });

  it("a stage with no requirements never completes", () => {
    expect(stageProgress({ id: "s", ord: 1, kind: "gate", requirements: [] }, ctx())).toBe(0);
  });
});

describe("resolveLocation", () => {
  const gate: StageDef = { id: "g", ord: 1, kind: "gate", requirements: [{ kind: "attribute_level", attribute: "STR", minLevel: 2 }] };
  const boss: StageDef = { id: "b", ord: 2, kind: "boss", requirements: [{ kind: "quest_count", questId: "run", count: 2 }] };
  const strong = { ...zeroXp, STR: xpForLevel(2) };
  const runs = [{ questId: "run", date: "2026-10-01" }, { questId: "run", date: "2026-10-02" }];

  it("stages unlock in order and the boss stays locked", () => {
    const r = resolveLocation([boss, gate], new Set(), ctx({ attributeXp: strong }), "2026-12-31");
    expect(r.stages.map((s) => s.status)).toEqual(["ready", "locked"]);
    expect(r.status).toBe("active");
    expect(r.progress).toBeCloseTo(0.5);
  });

  it("becomes ready once the boss requirements are met", () => {
    const r = resolveLocation([gate, boss], new Set(["g"]), ctx({ completions: runs }), "2026-12-31");
    expect(r.stages.map((s) => s.status)).toEqual(["cleared", "ready"]);
    expect(r.status).toBe("ready");
  });

  it("a cleared stage stays cleared even if progress later drops", () => {
    const r = resolveLocation([gate, boss], new Set(["g"]), ctx(), "2026-12-31");
    expect(r.stages[0].status).toBe("cleared");
    expect(r.stages[1].status).toBe("active");
  });

  it("flees after the deadline unless the boss is ready; cleared is final", () => {
    expect(resolveLocation([gate, boss], new Set(), ctx(), "2026-10-01").status).toBe("fled");
    expect(resolveLocation([gate, boss], new Set(["g"]), ctx({ completions: runs }), "2026-10-01").status).toBe("ready");
    expect(resolveLocation([gate, boss], new Set(["g", "b"]), ctx(), "2026-10-01").status).toBe("cleared");
  });
});

describe("town", () => {
  it("building levels and tiers rise with completions", () => {
    expect(buildingLevel(0)).toBe(1);
    expect(buildingLevel(10)).toBe(2);
    expect(buildingTier(buildingLevel(0))).toBe(0);
    expect(buildingTier(buildingLevel(80))).toBe(2);
  });

  it("grid grows with level and placement respects bounds and occupancy", () => {
    expect(gridSize(1)).toBe(4);
    expect(gridSize(5)).toBe(5);
    expect(gridSize(10)).toBe(6);
    const occ = [{ id: "a", x: 1, y: 1 }];
    expect(canPlace({ x: 1, y: 1 }, 1, occ)).toBe(false);
    expect(canPlace({ x: 1, y: 1 }, 1, occ, "a")).toBe(true); // moving onto itself
    expect(canPlace({ x: 4, y: 0 }, 1, occ)).toBe(false); // outside a 4x4 grid
    expect(canPlace({ x: 4, y: 0 }, 5, occ)).toBe(true);
  });

  it("decoration purchases check the balance", () => {
    expect(purchaseDecoration(100, "tree")).toBe(80);
    expect(purchaseDecoration(10, "fountain")).toBeNull();
  });
});

describe("rollover", () => {
  const q = (id: string, streak: number, shields: number, schedule?: number[]) => ({ id, streak, shields, schedule });

  it("schedules by weekday", () => {
    expect(weekdayOf("2026-10-08")).toBe(4); // Thursday
    expect(isDue({ schedule: [1, 3] }, "2026-10-08")).toBe(false);
    expect(isDue({ schedule: [] }, "2026-10-08")).toBe(true);
  });

  it("a shield absorbs a miss with no HP loss; otherwise streak resets and HP drops", () => {
    const r = rolloverDay("2026-10-08", [q("a", 7, 1), q("b", 5, 0), q("c", 3, 0)], new Set(["c"]), 50, 100);
    expect(r.quests.find((x) => x.id === "a")).toMatchObject({ streak: 7, shields: 0 });
    expect(r.quests.find((x) => x.id === "b")).toMatchObject({ streak: 0 });
    expect(r.quests.find((x) => x.id === "c")).toMatchObject({ streak: 3 });
    expect(r.shieldsUsed).toBe(1);
    expect(r.hpLost).toBe(5);
    expect(r.hp).toBe(45);
    expect(r.perfect).toBe(false);
  });

  it("ignores quests not due, and heals on a perfect day up to max HP", () => {
    const r = rolloverDay("2026-10-08", [q("a", 2, 0), q("off", 9, 0, [0])], new Set(["a"]), 98, 100);
    expect(r.quests.find((x) => x.id === "off")?.streak).toBe(9);
    expect(r.perfect).toBe(true);
    expect(r.hp).toBe(100);
  });

  it("HP never goes below zero and no due quests is not a perfect day", () => {
    const many = Array.from({ length: 5 }, (_, i) => q(`m${i}`, 1, 0));
    const r = rolloverDay("2026-10-08", many, new Set(), 10, 100);
    expect(r.hp).toBe(0);
    expect(r.hpLost).toBe(10);
    expect(rolloverDay("2026-10-08", [q("off", 1, 0, [0])], new Set(), 50, 100).perfect).toBe(false);
  });
});

import { completionsForLevel } from "./town";
import { normalizeSchedule, validateBuilding, validateQuest } from "./validate";
import { overallLevel } from "./xp";

describe("town helpers", () => {
  it("completionsForLevel inverts buildingLevel", () => {
    for (const lv of [2, 3, 5, 8]) {
      expect(buildingLevel(completionsForLevel(lv))).toBe(lv);
      expect(buildingLevel(completionsForLevel(lv) - 1)).toBe(lv - 1);
    }
  });
  it("overallLevel is derived from half the total XP", () => {
    expect(overallLevel({ STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 })).toBe(1);
    expect(overallLevel({ STR: xpForLevel(5) * 2, INT: 0, VIT: 0, WIS: 0, CHA: 0 })).toBe(5);
  });
});

describe("validation", () => {
  it("validates buildings", () => {
    expect(validateBuilding({ name: "Iron Gym", type: "gym", attribute: "STR" })).toBeNull();
    expect(validateBuilding({ name: "   ", type: "gym", attribute: "STR" })).toMatch(/name/i);
    expect(validateBuilding({ name: "x".repeat(31), type: "gym", attribute: "STR" })).toMatch(/30/);
    expect(validateBuilding({ name: "A", type: "castle", attribute: "STR" })).toMatch(/type/i);
    expect(validateBuilding({ name: "A", type: "gym", attribute: "LUCK" })).toMatch(/attribute/i);
    expect(validateBuilding({ name: 5, type: "gym", attribute: "STR" })).toMatch(/name/i);
  });
  it("validates quests", () => {
    const ok = { title: "Run", miniTitle: "Walk", difficulty: "easy", schedule: [1, 3] };
    expect(validateQuest(ok)).toBeNull();
    expect(validateQuest({ ...ok, title: "" })).toMatch(/title/i);
    expect(validateQuest({ ...ok, difficulty: "godly" })).toMatch(/difficulty/i);
    expect(validateQuest({ ...ok, schedule: [9] })).toMatch(/schedule/i);
    expect(validateQuest({ ...ok, schedule: "daily" })).toMatch(/schedule/i);
    expect(validateQuest({ ...ok, miniTitle: null })).toMatch(/minimum/i);
  });
  it("normalizes schedules", () => {
    expect(normalizeSchedule([3, 1, 1])).toEqual([1, 3]);
    expect(normalizeSchedule([0, 1, 2, 3, 4, 5, 6])).toEqual([]);
    expect(normalizeSchedule([])).toEqual([]);
  });
});
