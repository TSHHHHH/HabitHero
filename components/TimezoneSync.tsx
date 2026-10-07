"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Tells the server which timezone the browser is in, so "today" follows the player's day. */
export default function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith("tz="))?.slice(3);
    if (current === encodeURIComponent(tz)) return;
    document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router]);
  return null;
}
