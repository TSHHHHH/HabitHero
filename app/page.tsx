import TodayScreen from "@/components/TodayScreen";
import { getDb } from "@/db/client";
import TimezoneSync from "@/components/TimezoneSync";
import { ensurePlayer, getEmail, syncTimezone } from "@/lib/server/player";
import { loadGameState } from "@/lib/server/state";

// Every request reads the caller's identity and D1, so this page is never prerendered.
export const dynamic = "force-dynamic";

export default async function Home() {
  const email = await getEmail();
  const db = getDb();
  const player = await syncTimezone(db, await ensurePlayer(db, email));
  const state = await loadGameState(db, player);
  return (
    <>
      <TimezoneSync />
      <TodayScreen initial={state} />
    </>
  );
}
