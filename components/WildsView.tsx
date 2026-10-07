"use client";

import type { LocationStatus, ResolvedLocation } from "@/lib/game/wilds";
import { daysUntil } from "@/lib/game/wilds";
import type { LocationView } from "@/lib/types";
import PlaceIcon from "./art/PlaceIcon";

export interface LocationItem {
  loc: LocationView;
  res: ResolvedLocation;
}

const STATUS_STYLE: Record<LocationStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "var(--xp)" },
  ready: { label: "Boss ready", color: "var(--gold)" },
  cleared: { label: "Cleared", color: "var(--vit)" },
  fled: { label: "Fled", color: "var(--hp)" },
};

/** "12 days left", "due today", or "3 days overdue". */
export function deadlineLabel(deadline: string, today: string): string {
  const d = daysUntil(deadline, today);
  if (d === 0) return "due today";
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} left`;
  return `${-d} day${d === -1 ? "" : "s"} overdue`;
}

interface Props {
  items: LocationItem[];
  today: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}

export default function WildsView({ items, today, onOpen, onNew }: Props) {
  const open = items.filter((i) => i.res.status === "active" || i.res.status === "ready");
  const closed = items.filter((i) => i.res.status === "cleared" || i.res.status === "fled");

  const card = ({ loc, res }: LocationItem) => {
    const s = STATUS_STYLE[res.status];
    const cleared = res.stages.filter((st) => st.status === "cleared").length;
    return (
      <li key={loc.id}>
        <button
          onClick={() => onOpen(loc.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.99]"
          style={res.status === "ready" ? { borderColor: "var(--gold)", boxShadow: "0 0 14px rgba(242,193,78,.25)" } : undefined}
        >
          <div className="shrink-0 rounded-xl bg-surface-2 p-1.5">
            <PlaceIcon type={loc.placeType} color={res.status === "cleared" ? "#22c55e" : "#e5484d"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold">{loc.name}</p>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.color }}>
                {s.label}
              </span>
            </div>
            <p className="text-[11px] text-muted">
              {res.status === "cleared" ? "Victory!" : deadlineLabel(loc.deadline, today)} · {cleared}/{res.stages.length} stages
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-label="Boss health">
              <div
                className="h-full rounded-full"
                style={{ width: `${(1 - res.progress) * 100}%`, background: "var(--hp)", boxShadow: "0 0 8px var(--hp)" }}
              />
            </div>
          </div>
        </button>
      </li>
    );
  };

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-widest text-muted">The Wilds</h2>
        <p className="text-xs text-muted">
          {open.length} open adventure{open.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm">No adventures yet.</p>
          <p className="mt-1 text-xs text-muted">
            Turn a goal into a location: a cave, a tower, a peak. Add stages to clear and a boss to defeat.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">{open.map(card)}</ul>
          {closed.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs uppercase tracking-widest text-muted">Past adventures</h3>
              <ul className="flex flex-col gap-2 opacity-80">{closed.map(card)}</ul>
            </>
          )}
        </>
      )}

      <button onClick={onNew} className="mt-3 w-full rounded-xl bg-xp py-3 text-sm font-semibold">
        New adventure
      </button>
    </section>
  );
}
