import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** Drizzle client bound to the D1 database. Call per request; don't cache it at module scope. */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
