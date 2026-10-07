import type { Attribute, Difficulty } from "@/lib/game/xp";
import type { CompletionRecord, DayRecord } from "@/lib/game/recap";
import type { BuildingType } from "@/lib/game/town";
import type { PlaceType } from "@/lib/game/validate";
import type { Requirement, StageKind } from "@/lib/game/wilds";

export interface BuildingView {
  id: string;
  name: string;
  type: BuildingType;
  attribute: Attribute;
  plotX: number;
  plotY: number;
  completions: number;
}

/** A quest as the client sees it (flattened with its building). */
export interface HabitView {
  id: string;
  buildingId: string;
  /** Weekdays it is due (0 = Sunday). Empty means every day. */
  schedule: number[];
  title: string;
  miniTitle: string;
  difficulty: Difficulty;
  attribute: Attribute;
  streak: number;
  shields: number;
  buildingName: string;
  buildingType: string;
}

export interface StageView {
  id: string;
  ord: number;
  kind: StageKind;
  title: string;
  clearedAt: string | null;
  requirements: Requirement[];
}

export interface LocationView {
  id: string;
  name: string;
  placeType: PlaceType;
  description: string;
  deadline: string;
  /** Stored status; `fled` and `ready` are derived at render time by resolveLocation. */
  status: "active" | "ready" | "cleared" | "fled";
  rewardXp: number;
  rewardGold: number;
  rewardTitle: string | null;
  /** Stages in order; the last one is the boss. */
  stages: StageView[];
}

export interface GameState {
  player: {
    name: string;
    townName: string;
    theme: "forest" | "snow" | "desert";
    hp: number;
    maxHp: number;
    gold: number;
  };
  buildings: BuildingView[];
  locations: LocationView[];
  xp: Record<Attribute, number>;
  habits: HabitView[];
  /** Quests already completed today. */
  done: Record<string, "full" | "mini">;
  completions: CompletionRecord[];
  days: DayRecord[];
  today: string;
}

export type CompleteResult =
  | {
      ok: true;
      attribute: Attribute;
      gain: number;
      goldGain: number;
      crit: boolean;
      loot: { name: string; gold: number } | null;
      /** Set when the attribute leveled up. */
      newLevel: number | null;
      attributeXp: number;
      gold: number;
      streak: number;
      shields: number;
      date: string;
    }
  | { ok: false; error: string };

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };
