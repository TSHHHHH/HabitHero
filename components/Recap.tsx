"use client";

import { useMemo, useState } from "react";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import { computeRecap, type CompletionRecord, type DayRecord, type Period } from "@/lib/game/recap";
import type { HabitView } from "@/lib/types";

const ATTR_COLOR: Record<Attribute, string> = {
  STR: "var(--str)", INT: "var(--int)", VIT: "var(--vit)", WIS: "var(--wis)", CHA: "var(--cha)",
};

const FOCUS_TIP: Record<Attribute, string> = {
  STR: "Visit the Forge: a short workout will do.",
  INT: "Visit the Library: read a page or two.",
  VIT: "Visit the Grove: sleep and water are cheap wins.",
  WIS: "Visit the Temple: three deep breaths count.",
  CHA: "Visit the Tavern: send one message to someone.",
};

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return <span className="text-muted">{cur > 0 ? "new" : "-"}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span style={{ color: up ? "var(--vit)" : "var(--hp)" }}>
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
      {sub && <p className="text-xs">{sub}</p>}
    </div>
  );
}

interface Props {
  completions: CompletionRecord[];
  dayRecords: DayRecord[];
  habits: HabitView[];
  today: string;
}

export default function Recap({ completions, dayRecords, habits, today }: Props) {
  const [period, setPeriod] = useState<Period>("week");
  const r = useMemo(
    () => computeRecap(completions, dayRecords, habits.length, period, today),
    [completions, dayRecords, habits.length, period, today],
  );
  const topHabit = habits.find((h) => h.id === r.topHabitId);
  const maxAttr = Math.max(...ATTRIBUTES.map((a) => Math.max(r.xpByAttr[a], r.prevXpByAttr[a])), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 text-sm">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg py-2 font-medium ${period === p ? "bg-xp text-white" : "text-muted"}`}
          >
            {p === "week" ? "Weekly (7 days)" : "Monthly (30 days)"}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-4xl font-black"
            style={{ borderColor: "var(--gold)", color: "var(--gold)", boxShadow: "0 0 18px rgba(242,193,78,.35)" }}
          >
            {r.grade.letter}
          </div>
          <div>
            <p className="text-lg font-bold">{r.grade.title}</p>
            <p className="text-xs text-muted">{r.grade.line}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          {r.completions} of {r.possible} quests done ({Math.round(r.completionRate * 100)}%)
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Stat label="XP earned" value={r.totalXp} sub={<>vs previous: <Delta cur={r.totalXp} prev={r.prevTotalXp} /></>} />
        <Stat label="Perfect days" value={`${r.perfectDays}/${r.days.length}`} sub={<span className="text-muted">every quest done</span>} />
        <Stat label="Crits & loot" value={`${r.crits} · ${r.gold}g`} sub={<span className="text-muted">crit hits, gold earned</span>} />
        <Stat label="Boss damage taken" value={`-${r.hpLost} HP`} sub={<span className="text-muted">{r.shieldsUsed} shield{r.shieldsUsed === 1 ? "" : "s"} used</span>} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">XP by attribute</h2>
        <div className="flex flex-col gap-2">
          {ATTRIBUTES.map((a) => (
            <div key={a} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-semibold" style={{ color: ATTR_COLOR[a] }}>{a}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.xpByAttr[a] / maxAttr) * 100}%`, background: ATTR_COLOR[a], boxShadow: `0 0 8px ${ATTR_COLOR[a]}` }}
                />
              </div>
              <span className="w-10 text-right font-mono">{r.xpByAttr[a]}</span>
              <span className="w-10 text-right"><Delta cur={r.xpByAttr[a]} prev={r.prevXpByAttr[a]} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-muted">Quest heatmap</h2>
        <div className="flex flex-wrap gap-1">
          {r.days.map((d, i) => {
            const frac = habits.length ? r.perDay[i] / habits.length : 0;
            return (
              <div
                key={d}
                title={`${d}: ${r.perDay[i]}/${habits.length}`}
                className="h-5 w-5 rounded-md border border-border"
                style={{ background: frac === 0 ? "var(--surface-2)" : `rgba(139,92,246,${0.2 + frac * 0.8})` }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">Darker = more quests completed that day.</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-muted">Highlights</h2>
        <ul className="space-y-1">
          {r.bestDay && <li>Best day: {r.bestDay.date} with {r.bestDay.xp} XP</li>}
          {topHabit && <li>Most reliable quest: {topHabit.title}</li>}
          {r.minis > 0 && <li>Kept the chain alive {r.minis} time{r.minis > 1 ? "s" : ""} with minimum effort.</li>}
          <li className="text-gold">Next focus: {FOCUS_TIP[r.weakest]}</li>
        </ul>
      </section>
    </div>
  );
}
