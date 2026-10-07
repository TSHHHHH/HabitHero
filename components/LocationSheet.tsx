"use client";

import { useState } from "react";
import { addDays } from "@/lib/game/recap";
import {
  describeRequirement,
  requirementDetail,
  requirementProgress,
  type ProgressContext,
  type StageStatus,
} from "@/lib/game/wilds";
import PlaceIcon from "./art/PlaceIcon";
import Sheet from "./ui/Sheet";
import { deadlineLabel, type LocationItem } from "./WildsView";

const STAGE_BADGE: Record<StageStatus, { label: string; color: string }> = {
  locked: { label: "Locked", color: "var(--muted)" },
  active: { label: "In progress", color: "var(--xp)" },
  ready: { label: "Ready", color: "var(--gold)" },
  cleared: { label: "Cleared", color: "var(--vit)" },
};

interface Props {
  item: LocationItem;
  ctx: ProgressContext;
  questTitle: (id: string) => string;
  busy: boolean;
  error: string | null;
  onClearStage: (stageId: string) => void;
  onResummon: (deadline: string) => void;
  onClose: () => void;
}

export default function LocationSheet({ item, ctx, questTitle, busy, error, onClearStage, onResummon, onClose }: Props) {
  const { loc, res } = item;
  const [newDeadline, setNewDeadline] = useState(addDays(ctx.today, 14));
  const lastId = loc.stages[loc.stages.length - 1]?.id;

  return (
    <Sheet
      title={loc.name}
      subtitle={res.status === "cleared" ? "Cleared" : `${deadlineLabel(loc.deadline, ctx.today)} · due ${loc.deadline}`}
      onClose={onClose}
    >
      <div className="mt-3 flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-surface-2 p-1.5">
          <PlaceIcon type={loc.placeType} color={res.status === "cleared" ? "#22c55e" : "#e5484d"} />
        </div>
        <div className="min-w-0 flex-1">
          {loc.description && <p className="mb-1 text-xs text-muted">{loc.description}</p>}
          <p className="text-[11px] text-muted">
            Reward: {loc.rewardXp} XP, {loc.rewardGold} gold
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${(1 - res.progress) * 100}%`, background: "var(--hp)" }} />
          </div>
        </div>
      </div>

      <ol className="mt-3 flex flex-col gap-2">
        {loc.stages.map((stage, i) => {
          const r = res.stages[i];
          const badge = STAGE_BADGE[r.status];
          const isBoss = stage.id === lastId;
          return (
            <li
              key={stage.id}
              className={`rounded-xl border p-2.5 ${r.status === "locked" ? "border-border opacity-60" : "border-border bg-surface-2/50"}`}
              style={r.status === "ready" ? { borderColor: "var(--gold)" } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {isBoss ? "Boss: " : `Stage ${i + 1}: `}
                  {stage.title}
                </p>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: badge.color }}>
                  {badge.label}
                </span>
              </div>
              {r.status !== "locked" && (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {stage.requirements.map((req, k) => {
                    const detail = requirementDetail(req, ctx);
                    const p = r.status === "cleared" ? 1 : requirementProgress(req, ctx);
                    return (
                      <li key={k}>
                        <div className="flex justify-between text-[11px] text-muted">
                          <span>{describeRequirement(req, questTitle)}</span>
                          <span className="font-mono">
                            {r.status === "cleared" ? detail.needed : detail.current}/{detail.needed}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: p >= 1 ? "var(--vit)" : "var(--xp)" }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {r.status === "ready" && res.status !== "fled" && (
                <button
                  disabled={busy}
                  onClick={() => onClearStage(stage.id)}
                  className="mt-2 w-full rounded-lg bg-xp py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {isBoss ? "Defeat the boss" : "Clear this stage"}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {res.status === "fled" && (
        <div className="mt-3 rounded-xl border border-hp/40 bg-hp/10 p-3">
          <p className="text-xs text-hp">The deadline passed and this location fled. Your progress is kept. Set a new date to re-summon it.</p>
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={newDeadline}
              min={ctx.today}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !newDeadline}
              onClick={() => onResummon(newDeadline)}
              className="rounded-lg bg-xp px-4 text-xs font-semibold disabled:opacity-50"
            >
              Re-summon
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-hp">{error}</p>}
    </Sheet>
  );
}
