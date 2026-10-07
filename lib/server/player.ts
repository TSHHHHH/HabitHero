import "server-only";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "@/db/client";
import { attributes, buildings, players, quests } from "@/db/schema";
import { ATTRIBUTES, type Attribute, type Difficulty } from "@/lib/game/xp";
import type { BuildingType } from "@/lib/game/town";
import { getDb } from "@/db/client";
import { isValidTimeZone } from "./time";

export type Player = typeof players.$inferSelect;

/**
 * Who is calling. In production the site must sit behind Cloudflare Access, which sets
 * this header after authenticating. Locally (dev server, or preview with ALLOW_DEV_USER)
 * we fall back to a fixed dev user. With neither, requests are refused.
 */
export async function getEmail(): Promise<string> {
  const fromAccess = (await headers()).get("cf-access-authenticated-user-email");
  if (fromAccess) return fromAccess.toLowerCase();
  if (process.env.NODE_ENV === "development" || process.env.ALLOW_DEV_USER === "true") {
    return "dev@local";
  }
  throw new Error("Unauthorized: no Cloudflare Access identity on the request");
}

interface StarterQuest {
  title: string;
  mini: string;
  difficulty: Difficulty;
}
interface StarterBuilding {
  name: string;
  type: BuildingType;
  attribute: Attribute;
  quests: StarterQuest[];
}

/** A small starter town so a new player has something to do on day one. */
const STARTER_TOWN: StarterBuilding[] = [
  {
    name: "Iron Gym", type: "gym", attribute: "STR",
    quests: [
      { title: "Workout 30 min", mini: "5 push-ups", difficulty: "hard" },
      { title: "Morning run", mini: "Walk around the block", difficulty: "medium" },
    ],
  },
  {
    name: "Arcane Library", type: "library", attribute: "INT",
    quests: [
      { title: "Read 20 pages", mini: "Read 1 page", difficulty: "medium" },
      { title: "Study 30 min", mini: "Open the notes", difficulty: "hard" },
    ],
  },
  {
    name: "Verdant Garden", type: "garden", attribute: "VIT",
    quests: [
      { title: "Sleep before 11pm", mini: "Phone down at 11", difficulty: "medium" },
      { title: "Drink 2L water", mini: "One glass now", difficulty: "easy" },
    ],
  },
  {
    name: "Moon Shrine", type: "shrine", attribute: "WIS",
    quests: [{ title: "Meditate 10 min", mini: "3 deep breaths", difficulty: "easy" }],
  },
  {
    name: "The Tavern", type: "tavern", attribute: "CHA",
    quests: [{ title: "Message a friend", mini: "Send one emoji", difficulty: "easy" }],
  },
];

/** Returns the player for this email, creating them (and a starter town) on first visit. */
export async function ensurePlayer(db: Db, email: string): Promise<Player> {
  const existing = await db.select().from(players).where(eq(players.email, email)).get();
  if (existing) return existing;

  const playerId = crypto.randomUUID();
  const stmts: BatchItem<"sqlite">[] = [
    db.insert(players).values({ id: playerId, email }),
    ...ATTRIBUTES.map((key) => db.insert(attributes).values({ playerId, key, xp: 0 })),
  ];
  STARTER_TOWN.forEach((b, i) => {
    const buildingId = crypto.randomUUID();
    stmts.push(
      db.insert(buildings).values({
        id: buildingId, playerId, name: b.name, type: b.type, attribute: b.attribute,
        plotX: i % 4, plotY: Math.floor(i / 4),
      }),
    );
    for (const q of b.quests) {
      stmts.push(
        db.insert(quests).values({
          buildingId, title: q.title, miniTitle: q.mini, difficulty: q.difficulty, attribute: b.attribute,
        }),
      );
    }
  });

  try {
    await db.batch(stmts as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (err) {
    // A concurrent first request may have created the player already.
    const raced = await db.select().from(players).where(eq(players.email, email)).get();
    if (raced) return raced;
    throw err;
  }
  return (await db.select().from(players).where(eq(players.id, playerId)).get())!;
}

/**
 * The browser reports its timezone in a `tz` cookie (see TimezoneSync). Adopt it so
 * "today" matches the player's own calendar day. Invalid values are ignored.
 */
export async function syncTimezone(db: Db, player: Player): Promise<Player> {
  const tz = (await cookies()).get("tz")?.value;
  if (!tz || tz === player.timezone || !isValidTimeZone(tz)) return player;
  await db.update(players).set({ timezone: tz }).where(eq(players.id, player.id));
  return { ...player, timezone: tz };
}

/** The authenticated player plus a database handle; the entry point for every server action. */
export async function currentPlayer() {
  const email = await getEmail();
  const db = getDb();
  const player = await syncTimezone(db, await ensurePlayer(db, email));
  return { db, player };
}
