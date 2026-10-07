import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

/** Dates are stored as YYYY-MM-DD text, matching `dateKey` in lib/game/recap.ts. */

export const players = sqliteTable("players", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default("Hero"),
  townName: text("town_name").notNull().default("Hearthvale"),
  theme: text("theme", { enum: ["forest", "snow", "desert"] }).notNull().default("forest"),
  avatarJson: text("avatar_json").notNull().default("{}"),
  timezone: text("timezone").notNull().default("UTC"),
  hp: integer("hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  gold: integer("gold").notNull().default(0),
  createdAt: createdAt(),
});

const ATTRIBUTE_ENUM = ["STR", "INT", "VIT", "WIS", "CHA"] as const;
const DIFFICULTY_ENUM = ["trivial", "easy", "medium", "hard", "epic"] as const;

export const attributes = sqliteTable(
  "attributes",
  {
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    key: text("key", { enum: ATTRIBUTE_ENUM }).notNull(),
    xp: integer("xp").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.key] })],
);

// ---- Town ----------------------------------------------------------------

export const buildings = sqliteTable(
  "buildings",
  {
    id: id(),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["gym", "library", "garden", "workshop", "shrine", "tavern", "home", "custom"],
    }).notNull(),
    attribute: text("attribute", { enum: ATTRIBUTE_ENUM }).notNull(),
    plotX: integer("plot_x").notNull(),
    plotY: integer("plot_y").notNull(),
    completions: integer("completions").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("buildings_plot_uq").on(t.playerId, t.plotX, t.plotY)],
);

export const quests = sqliteTable(
  "quests",
  {
    id: id(),
    buildingId: text("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    miniTitle: text("mini_title").notNull().default(""),
    difficulty: text("difficulty", { enum: DIFFICULTY_ENUM }).notNull().default("medium"),
    attribute: text("attribute", { enum: ATTRIBUTE_ENUM }).notNull(),
    /** JSON array of weekdays (0 = Sunday). `[]` means daily. */
    scheduleJson: text("schedule_json").notNull().default("[]"),
    dailyCap: integer("daily_cap").notNull().default(1),
    streak: integer("streak").notNull().default(0),
    shields: integer("shields").notNull().default(0),
    lastDoneDate: text("last_done_date"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("quests_building_idx").on(t.buildingId)],
);

export const completions = sqliteTable(
  "completions",
  {
    id: id(),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull().references(() => quests.id, { onDelete: "cascade" }),
    attribute: text("attribute", { enum: ATTRIBUTE_ENUM }).notNull(),
    date: text("date").notNull(),
    xp: integer("xp").notNull(),
    gold: integer("gold").notNull(),
    crit: integer("crit", { mode: "boolean" }).notNull().default(false),
    mini: integer("mini", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("completions_player_date_idx").on(t.playerId, t.date),
    index("completions_quest_date_idx").on(t.questId, t.date),
  ],
);

export const dayRecords = sqliteTable(
  "day_records",
  {
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    hpLost: integer("hp_lost").notNull().default(0),
    shieldsUsed: integer("shields_used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.date] })],
);

// ---- Wilds ---------------------------------------------------------------

export const locations = sqliteTable(
  "locations",
  {
    id: id(),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    placeType: text("place_type", {
      enum: ["cave", "tower", "swamp", "ruins", "peak"],
    }).notNull(),
    description: text("description").notNull().default(""),
    deadline: text("deadline").notNull(),
    status: text("status", { enum: ["active", "ready", "cleared", "fled"] }).notNull().default("active"),
    rewardXp: integer("reward_xp").notNull().default(0),
    rewardGold: integer("reward_gold").notNull().default(0),
    rewardTitle: text("reward_title"),
    posX: integer("pos_x").notNull().default(0),
    posY: integer("pos_y").notNull().default(0),
    clearedAt: text("cleared_at"),
    createdAt: createdAt(),
  },
  (t) => [index("locations_player_idx").on(t.playerId)],
);

export const stages = sqliteTable(
  "stages",
  {
    id: id(),
    locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
    ord: integer("ord").notNull(),
    kind: text("kind", { enum: ["gate", "count", "boss"] }).notNull(),
    title: text("title").notNull(),
    /** Set when the player confirms the stage. Status is derived by resolveLocation. */
    clearedAt: text("cleared_at"),
  },
  (t) => [uniqueIndex("stages_order_uq").on(t.locationId, t.ord)],
);

export const stageRequirements = sqliteTable(
  "stage_requirements",
  {
    id: id(),
    stageId: text("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["attribute_level", "quest_count"] }).notNull(),
    attribute: text("attribute", { enum: ATTRIBUTE_ENUM }),
    minLevel: integer("min_level"),
    questId: text("quest_id").references(() => quests.id, { onDelete: "cascade" }),
    count: integer("count"),
    windowDays: integer("window_days"),
  },
  (t) => [index("stage_requirements_stage_idx").on(t.stageId)],
);

// ---- Economy / meta ------------------------------------------------------

export const decorations = sqliteTable(
  "decorations",
  {
    id: id(),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["tree", "lantern", "banner", "fountain"] }).notNull(),
    /** Null while owned but not yet placed in the town. */
    plotX: integer("plot_x"),
    plotY: integer("plot_y"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("decorations_plot_uq").on(t.playerId, t.plotX, t.plotY)],
);

export const titles = sqliteTable(
  "titles",
  {
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    titleId: text("title_id").notNull(),
    earnedAt: text("earned_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.titleId] })],
);

export const rewards = sqliteTable("rewards", {
  id: id(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  cost: integer("cost").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const purchases = sqliteTable("purchases", {
  id: id(),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  rewardId: text("reward_id").notNull().references(() => rewards.id, { onDelete: "cascade" }),
  cost: integer("cost").notNull(),
  purchasedAt: text("purchased_at").notNull().default(sql`(datetime('now'))`),
});

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    body: text("body").notNull().default(""),
    mood: integer("mood"),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.date] })],
);

/** Adventure log feed: level-ups, boss damage, shield saves, etc. */
export const events = sqliteTable(
  "events",
  {
    id: id(),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (t) => [index("events_player_idx").on(t.playerId, t.createdAt)],
);
