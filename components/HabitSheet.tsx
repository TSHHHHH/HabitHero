"use client";

import { motion } from "framer-motion";
import { awardFor } from "@/lib/game/xp";
import { CRIT_CHANCE, MIN_EFFORT_XP_FACTOR } from "@/lib/game/motivation";
import type { HabitView } from "@/lib/types";

interface Props {
  habit: HabitView;
  state: "full" | "mini" | undefined;
  weakened: boolean;
  busy?: boolean;
  onComplete: (mode: "full" | "mini") => void;
  onClose: () => void;
}

export default function HabitSheet({ habit, state, weakened, busy, onComplete, onClose }: Props) {
  const award = awardFor(habit.difficulty, habit.streak, weakened);
  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-3 pb-3"
    >
      <div className="rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{habit.title}</p>
            <p className="text-xs text-muted">
              {habit.attribute} · {habit.difficulty} · {habit.streak > 0 ? `${habit.streak}d streak` : "no streak"}
              {habit.shields > 0 && ` · ${habit.shields} shield${habit.shields > 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="px-2 text-lg leading-none text-muted">
            ×
          </button>
        </div>
        {state ? (
          <p className="mt-3 text-sm text-vit">{state === "mini" ? "Streak kept alive today." : "Quest complete. Well fought."}</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted">
              +{award.xp} XP, +{award.gold}g · {Math.round(CRIT_CHANCE * 100)}% crit chance
            </p>
            <button
              disabled={busy}
              onClick={() => onComplete("full")}
              className="mt-3 w-full rounded-xl bg-xp py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-60"
            >
              Complete quest
            </button>
            <button
              disabled={busy}
              onClick={() => onComplete("mini")}
              className="mt-2 w-full rounded-xl border border-border py-2 text-xs text-muted"
            >
              Bad day? {habit.miniTitle} (+{Math.max(1, Math.round(award.xp * MIN_EFFORT_XP_FACTOR))} XP, keeps streak)
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
