import { describe, expect, it } from "vitest";
import { validateLocation } from "./validate";
import { daysUntil, describeRequirement, requirementDetail, type ProgressContext } from "./wilds";

describe("daysUntil", () => {
  it("counts whole days across month boundaries and goes negative after the deadline", () => {
    expect(daysUntil("2026-10-08", "2026-10-08")).toBe(0);
    expect(daysUntil("2026-11-02", "2026-10-30")).toBe(3);
    expect(daysUntil("2026-10-01", "2026-10-08")).toBe(-7);
  });
});

const ctx = (over: Partial<ProgressContext> = {}): ProgressContext => ({
  attributeXp: { STR: 0, INT: 0, VIT: 0, WIS: 0, CHA: 0 },
  completions: [],
  today: "2026-10-08",
  ...over,
});

describe("requirement helpers", () => {
  const titles = (id: string) => (id === "run" ? "Morning run" : id);

  it("describes requirements in plain language", () => {
    expect(describeRequirement({ kind: "attribute_level", attribute: "STR", minLevel: 6 }, titles)).toBe(
      "Reach STR level 6",
    );
    expect(
      describeRequirement({ kind: "quest_count", questId: "run", count: 12, windowDays: 14 }, titles),
    ).toBe("Complete Morning run 12 times in 14 days");
    expect(describeRequirement({ kind: "quest_count", questId: "run", count: 1 }, titles)).toBe(
      "Complete Morning run once",
    );
  });

  it("reports current and needed", () => {
    expect(requirementDetail({ kind: "attribute_level", attribute: "STR", minLevel: 6 }, ctx())).toEqual({
      current: 1,
      needed: 6,
    });
    const completions = [
      { questId: "run", date: "2026-10-08" },
      { questId: "run", date: "2026-10-07" },
    ];
    expect(requirementDetail({ kind: "quest_count", questId: "run", count: 5 }, ctx({ completions }))).toEqual({
      current: 2,
      needed: 5,
    });
  });
});

describe("validateLocation", () => {
  const base = {
    name: "Dragon Peak",
    placeType: "peak",
    description: "",
    deadline: "2026-12-31",
    rewardXp: 100,
    rewardGold: 50,
    stages: [{ title: "Warm up", requirements: [{ kind: "attribute_level", attribute: "STR", minLevel: 2 }] }],
    boss: {
      title: "The Dragon",
      requirements: [{ kind: "quest_count", questId: "q1", count: 10, windowDays: 14 }],
    },
  };
  const today = "2026-10-08";

  it("accepts a valid location", () => {
    expect(validateLocation(base, today)).toBeNull();
  });

  it("rejects bad basics", () => {
    expect(validateLocation({ ...base, name: " " }, today)).toMatch(/name/i);
    expect(validateLocation({ ...base, placeType: "castle" }, today)).toMatch(/place/i);
    expect(validateLocation({ ...base, deadline: "2026-10-01" }, today)).toMatch(/past/i);
    expect(validateLocation({ ...base, deadline: "soon" }, today)).toMatch(/deadline/i);
    expect(validateLocation({ ...base, rewardGold: -1 }, today)).toMatch(/gold/i);
  });

  it("rejects bad stages and boss", () => {
    expect(validateLocation({ ...base, boss: { title: "x", requirements: [] } }, today)).toMatch(/Boss.*requirement/);
    expect(validateLocation({ ...base, stages: [{ title: "s", requirements: [{ kind: "nope" }] }] }, today)).toMatch(
      /Stage 1/,
    );
    expect(validateLocation({ ...base, stages: Array(7).fill(base.stages[0]) }, today)).toMatch(/At most 6/);
    expect(
      validateLocation(
        { ...base, boss: { title: "b", requirements: [{ kind: "quest_count", questId: "q", count: 3, windowDays: 90 }] } },
        today,
      ),
    ).toMatch(/window/i);
  });
});
