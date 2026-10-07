import { BUILDING_TYPES } from "./town";
import { ATTRIBUTES, DIFFICULTY_XP } from "./xp";
import { MAX_WINDOW_DAYS } from "./wilds";

export const LIMITS = { name: 30, questTitle: 60, miniTitle: 60, maxQuests: 60 } as const;

const isStr = (v: unknown): v is string => typeof v === "string";

/** Server actions receive untrusted input, so every field is checked at runtime. */
export function validateBuilding(input: { name: unknown; type: unknown; attribute: unknown }): string | null {
  if (!isStr(input.name) || input.name.trim().length === 0) return "Give the building a name";
  if (input.name.trim().length > LIMITS.name) return `Name must be ${LIMITS.name} characters or fewer`;
  if (!isStr(input.type) || !(BUILDING_TYPES as readonly string[]).includes(input.type)) return "Pick a building type";
  if (!isStr(input.attribute) || !(ATTRIBUTES as readonly string[]).includes(input.attribute)) return "Pick an attribute";
  return null;
}

export function validateQuest(input: {
  title: unknown;
  miniTitle: unknown;
  difficulty: unknown;
  schedule: unknown;
}): string | null {
  if (!isStr(input.title) || input.title.trim().length === 0) return "Give the quest a title";
  if (input.title.trim().length > LIMITS.questTitle) return `Title must be ${LIMITS.questTitle} characters or fewer`;
  if (!isStr(input.miniTitle)) return "Invalid minimum-effort text";
  if (input.miniTitle.trim().length > LIMITS.miniTitle) return `Minimum-effort text must be ${LIMITS.miniTitle} characters or fewer`;
  if (!isStr(input.difficulty) || !(input.difficulty in DIFFICULTY_XP)) return "Pick a difficulty";
  if (
    !Array.isArray(input.schedule) ||
    !input.schedule.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  ) {
    return "Invalid schedule";
  }
  return null;
}

/** Sorted unique weekdays; all seven (or none) means daily, stored as []. */
export function normalizeSchedule(days: number[]): number[] {
  const set = [...new Set(days)].sort((a, b) => a - b);
  return set.length === 7 ? [] : set;
}

export const PLACE_TYPES = ["cave", "tower", "swamp", "ruins", "peak"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const LOCATION_LIMITS = {
  name: 40,
  stageTitle: 50,
  maxStages: 6,
  maxRequirements: 4,
  maxReward: 5000,
  maxActive: 12,
} as const;

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
export const isDateKey = (v: unknown): v is string =>
  isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function validateRequirement(r: unknown): string | null {
  if (typeof r !== "object" || r === null) return "Invalid requirement";
  const q = r as Record<string, unknown>;
  if (q.kind === "attribute_level") {
    if (!isStr(q.attribute) || !(ATTRIBUTES as readonly string[]).includes(q.attribute)) return "Pick an attribute";
    if (!isInt(q.minLevel) || q.minLevel < 1 || q.minLevel > 50) return "Level must be between 1 and 50";
    return null;
  }
  if (q.kind === "quest_count") {
    if (!isStr(q.questId) || q.questId.length === 0) return "Pick a quest";
    if (!isInt(q.count) || q.count < 1 || q.count > 365) return "Count must be between 1 and 365";
    if (q.windowDays !== undefined && (!isInt(q.windowDays) || q.windowDays < 1 || q.windowDays > MAX_WINDOW_DAYS)) {
      return `Time window must be 1 to ${MAX_WINDOW_DAYS} days`;
    }
    return null;
  }
  return "Invalid requirement";
}

function validateStage(s: unknown, label: string): string | null {
  if (typeof s !== "object" || s === null) return `${label}: invalid`;
  const st = s as Record<string, unknown>;
  if (!isStr(st.title) || st.title.trim().length === 0) return `${label}: give it a title`;
  if (st.title.trim().length > LOCATION_LIMITS.stageTitle) return `${label}: title is too long`;
  if (!Array.isArray(st.requirements) || st.requirements.length === 0) return `${label}: add at least one requirement`;
  if (st.requirements.length > LOCATION_LIMITS.maxRequirements) {
    return `${label}: at most ${LOCATION_LIMITS.maxRequirements} requirements`;
  }
  for (const r of st.requirements) {
    const e = validateRequirement(r);
    if (e) return `${label}: ${e}`;
  }
  return null;
}

/** `today` is the player's local date; deadlines can't be in the past. */
export function validateLocation(
  input: {
    name: unknown;
    placeType: unknown;
    description: unknown;
    deadline: unknown;
    rewardXp: unknown;
    rewardGold: unknown;
    stages: unknown;
    boss: unknown;
  },
  today: string,
): string | null {
  if (!isStr(input.name) || input.name.trim().length === 0) return "Give the location a name";
  if (input.name.trim().length > LOCATION_LIMITS.name) return `Name must be ${LOCATION_LIMITS.name} characters or fewer`;
  if (!isStr(input.placeType) || !(PLACE_TYPES as readonly string[]).includes(input.placeType)) return "Pick a place type";
  if (!isStr(input.description) || input.description.length > 300) return "Description must be 300 characters or fewer";
  if (!isDateKey(input.deadline)) return "Pick a deadline";
  if (input.deadline < today) return "The deadline can't be in the past";
  for (const [label, v] of [["XP reward", input.rewardXp], ["Gold reward", input.rewardGold]] as const) {
    if (!isInt(v) || v < 0 || v > LOCATION_LIMITS.maxReward) return `${label} must be 0 to ${LOCATION_LIMITS.maxReward}`;
  }
  if (!Array.isArray(input.stages) || input.stages.length > LOCATION_LIMITS.maxStages) {
    return `At most ${LOCATION_LIMITS.maxStages} stages before the boss`;
  }
  for (let i = 0; i < input.stages.length; i++) {
    const e = validateStage(input.stages[i], `Stage ${i + 1}`);
    if (e) return e;
  }
  return validateStage(input.boss, "Boss");
}
