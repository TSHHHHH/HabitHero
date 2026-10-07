"use client";

import { useState } from "react";
import { isDue } from "@/lib/game/rollover";
import { buildingLevel, buildingTier, completionsForLevel } from "@/lib/game/town";
import { LIMITS } from "@/lib/game/validate";
import { DIFFICULTY_XP, type Difficulty } from "@/lib/game/xp";
import { ATTR_HEX } from "@/lib/theme";
import type { BuildingView, HabitView } from "@/lib/types";
import Sheet from "./ui/Sheet";

const TIER_NAME = ["Camp", "House", "Tower", "Fortress"] as const;
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DIFFICULTIES = Object.keys(DIFFICULTY_XP) as Difficulty[];

interface Props {
  building: BuildingView;
  habits: HabitView[];
  today: string;
  done: Record<string, "full" | "mini">;
  busy: boolean;
  error: string | null;
  onComplete: (habitId: string, mode: "full" | "mini") => void;
  onAddQuest: (input: { title: string; miniTitle: string; difficulty: Difficulty; schedule: number[] }) => Promise<boolean>;
  onRetire: (habitId: string) => void;
  onMove: () => void;
  onClose: () => void;
}

export default function BuildingSheet({
  building, habits, today, done, busy, error, onComplete, onAddQuest, onRetire, onMove, onClose,
}: Props) {
  const level = buildingLevel(building.completions);
  const floor = completionsForLevel(level);
  const next = completionsForLevel(level + 1);
  const progress = (building.completions - floor) / Math.max(next - floor, 1);
  const color = ATTR_HEX[building.attribute];

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [mini, setMini] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [days, setDays] = useState<number[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onAddQuest({ title, miniTitle: mini, difficulty, schedule: days });
    if (ok) {
      setAdding(false);
      setTitle("");
      setMini("");
      setDifficulty("medium");
      setDays([]);
    }
  }

  return (
    <Sheet
      title={building.name}
      subtitle={`${TIER_NAME[buildingTier(level)]} · level ${level} · trains ${building.attribute}`}
      onClose={onClose}
    >
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.min(progress, 1) * 100}%`, background: color }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {next - building.completions} more completion{next - building.completions === 1 ? "" : "s"} to level {level + 1}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {habits.length === 0 && <li className="text-sm text-muted">No quests yet. Add the first one below.</li>}
        {habits.map((h) => {
          const state = done[h.id];
          return (
            <li key={h.id} className="rounded-xl border border-border bg-surface-2/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.title}</p>
                  <p className="text-[11px] text-muted">
                    {h.difficulty} · {h.streak > 0 ? `${h.streak}d streak` : "no streak"}
                    {!isDue(h, today) && " · not scheduled today"}
                    {h.shields > 0 && ` · ${h.shields} shield${h.shields > 1 ? "s" : ""}`}
                  </p>
                </div>
                {state ? (
                  <span className="text-xs text-vit">{state === "mini" ? "Kept alive" : "Done"}</span>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => onComplete(h.id, "full")}
                    className="rounded-lg bg-xp px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
              </div>
              {!state && (
                <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                  {h.miniTitle ? (
                    <button disabled={busy} onClick={() => onComplete(h.id, "mini")} className="underline-offset-2 hover:underline">
                      Bad day? {h.miniTitle}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => window.confirm(`Retire "${h.title}"? Its history is kept.`) && onRetire(h.id)}
                    className="underline-offset-2 hover:underline"
                  >
                    Retire
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5 rounded-xl border border-border p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.questTitle}
            placeholder="Quest, e.g. Read 20 pages"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-xp"
          />
          <input
            value={mini}
            onChange={(e) => setMini(e.target.value)}
            maxLength={LIMITS.miniTitle}
            placeholder="Bad-day version, e.g. Read 1 page"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-xp"
          />
          <div className="flex flex-wrap gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg border px-2.5 py-1 text-xs ${difficulty === d ? "border-xp bg-xp text-white" : "border-border text-muted"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted">Days (none selected = every day)</p>
            <div className="flex gap-1.5">
              {DAYS.map((label, d) => (
                <button
                  type="button"
                  key={d}
                  aria-pressed={days.includes(d)}
                  onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                  className={`h-8 w-8 rounded-lg border text-xs ${days.includes(d) ? "border-xp bg-xp text-white" : "border-border text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-hp">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-lg border border-border py-2 text-xs text-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || title.trim().length === 0}
              className="flex-1 rounded-lg bg-xp py-2 text-xs font-semibold disabled:opacity-50"
            >
              Add quest
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setAdding(true)} className="rounded-xl bg-xp py-2.5 text-sm font-semibold">
            Add quest
          </button>
          <button onClick={onMove} className="rounded-xl border border-border py-2.5 text-sm text-muted">
            Move building
          </button>
        </div>
      )}
      {!adding && error && <p className="mt-2 text-xs text-hp">{error}</p>}
    </Sheet>
  );
}
