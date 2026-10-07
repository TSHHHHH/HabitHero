"use client";

import { useState } from "react";
import { addDays } from "@/lib/game/recap";
import { LOCATION_LIMITS, PLACE_TYPES, type PlaceType } from "@/lib/game/validate";
import { MAX_WINDOW_DAYS, type Requirement } from "@/lib/game/wilds";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import { ATTR_HEX } from "@/lib/theme";
import type { HabitView } from "@/lib/types";
import PlaceIcon from "./art/PlaceIcon";
import Sheet from "./ui/Sheet";

type ReqDraft =
  | { kind: "attribute_level"; attribute: Attribute; minLevel: number }
  | { kind: "quest_count"; questId: string; count: number; windowDays: number | null };

interface StageDraft {
  title: string;
  requirements: ReqDraft[];
}

export interface LocationInput {
  name: string;
  placeType: PlaceType;
  description: string;
  deadline: string;
  rewardXp: number;
  rewardGold: number;
  stages: { title: string; requirements: Requirement[] }[];
  boss: { title: string; requirements: Requirement[] };
}

const PLACE_LABEL: Record<PlaceType, string> = {
  cave: "Cave", tower: "Tower", swamp: "Swamp", ruins: "Ruins", peak: "Peak",
};

const input =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-xp";

function toRequirement(r: ReqDraft): Requirement {
  return r.kind === "attribute_level"
    ? r
    : { kind: "quest_count", questId: r.questId, count: r.count, windowDays: r.windowDays ?? undefined };
}

function RequirementEditor({
  value, quests, onChange, onRemove,
}: {
  value: ReqDraft;
  quests: HabitView[];
  onChange: (r: ReqDraft) => void;
  onRemove?: () => void;
}) {
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {(["attribute_level", "quest_count"] as const).map((k) => (
            <button
              type="button"
              key={k}
              disabled={k === "quest_count" && quests.length === 0}
              onClick={() =>
                value.kind !== k &&
                onChange(
                  k === "attribute_level"
                    ? { kind: k, attribute: "STR", minLevel: 5 }
                    : { kind: k, questId: quests[0]?.id ?? "", count: 10, windowDays: 14 },
                )
              }
              className={`rounded-md border px-2 py-1 text-[11px] disabled:opacity-40 ${value.kind === k ? "border-xp bg-xp text-white" : "border-border text-muted"}`}
            >
              {k === "attribute_level" ? "Reach a level" : "Do a quest N times"}
            </button>
          ))}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="Remove requirement" className="px-1 text-muted">
            ×
          </button>
        )}
      </div>

      {value.kind === "attribute_level" ? (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {ATTRIBUTES.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => onChange({ ...value, attribute: a })}
                className="rounded-md border px-2 py-1 text-[11px] font-medium"
                style={value.attribute === a ? { background: ATTR_HEX[a], borderColor: ATTR_HEX[a], color: "#fff" } : { borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {a}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            level
            <input
              type="number"
              min={1}
              max={50}
              value={value.minLevel}
              onChange={(e) => onChange({ ...value, minLevel: num(e.target.value) })}
              className="w-14 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <select
            value={value.questId}
            onChange={(e) => onChange({ ...value, questId: e.target.value })}
            className={input}
            aria-label="Quest"
          >
            {quests.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.buildingName})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <label className="flex items-center gap-1">
              times
              <input
                type="number"
                min={1}
                max={365}
                value={value.count}
                onChange={(e) => onChange({ ...value, count: num(e.target.value) })}
                className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-1">
              within
              <input
                type="number"
                min={1}
                max={MAX_WINDOW_DAYS}
                value={value.windowDays ?? ""}
                placeholder="any"
                onChange={(e) => onChange({ ...value, windowDays: e.target.value === "" ? null : num(e.target.value) })}
                className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-foreground"
              />
              days
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function StageEditor({
  label, stage, quests, onChange, onRemove,
}: {
  label: string;
  stage: StageDraft;
  quests: HabitView[];
  onChange: (s: StageDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-muted underline-offset-2 hover:underline">
            Remove
          </button>
        )}
      </div>
      <input
        value={stage.title}
        maxLength={LOCATION_LIMITS.stageTitle}
        onChange={(e) => onChange({ ...stage, title: e.target.value })}
        placeholder={label.startsWith("Boss") ? "e.g. The Dragon" : "e.g. Reach the gate"}
        className={input}
      />
      <div className="mt-2 flex flex-col gap-2">
        {stage.requirements.map((r, i) => (
          <RequirementEditor
            key={i}
            value={r}
            quests={quests}
            onChange={(nr) => onChange({ ...stage, requirements: stage.requirements.map((x, k) => (k === i ? nr : x)) })}
            onRemove={
              stage.requirements.length > 1
                ? () => onChange({ ...stage, requirements: stage.requirements.filter((_, k) => k !== i) })
                : undefined
            }
          />
        ))}
        {stage.requirements.length < LOCATION_LIMITS.maxRequirements && (
          <button
            type="button"
            onClick={() => onChange({ ...stage, requirements: [...stage.requirements, { kind: "attribute_level", attribute: "STR", minLevel: 5 }] })}
            className="self-start text-xs text-muted underline-offset-2 hover:underline"
          >
            + Add requirement
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  quests: HabitView[];
  today: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: LocationInput) => void;
  onClose: () => void;
}

export default function LocationWizard({ quests, today, busy, error, onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [placeType, setPlaceType] = useState<PlaceType>("cave");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(addDays(today, 30));
  const [rewardGold, setRewardGold] = useState(100);
  const [rewardXp, setRewardXp] = useState(200);
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [boss, setBoss] = useState<StageDraft>({
    title: "",
    requirements: [{ kind: "attribute_level", attribute: "STR", minLevel: 5 }],
  });

  const numeric = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

  return (
    <Sheet title="New adventure" subtitle="Turn a goal into a location with stages and a boss" onClose={onClose}>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            placeType,
            description,
            deadline,
            rewardXp,
            rewardGold,
            stages: stages.map((s) => ({ title: s.title, requirements: s.requirements.map(toRequirement) })),
            boss: { title: boss.title, requirements: boss.requirements.map(toRequirement) },
          });
        }}
      >
        <label className="text-xs text-muted">
          Name your adventure
          <input
            value={name}
            maxLength={LOCATION_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marathon Peak"
            className={`${input} mt-1`}
          />
        </label>

        <div className="flex gap-1.5">
          {PLACE_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setPlaceType(t)}
              aria-pressed={placeType === t}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border py-1.5 text-[10px] ${placeType === t ? "border-xp bg-xp/20 text-foreground" : "border-border text-muted"}`}
            >
              <PlaceIcon type={t} size={26} color={placeType === t ? "#c4b5fd" : "#8b86a3"} />
              {PLACE_LABEL[t]}
            </button>
          ))}
        </div>

        <input
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why does this matter? (optional)"
          className={input}
        />

        <div className="grid grid-cols-3 gap-2 text-xs text-muted">
          <label>
            Deadline
            <input type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${input} mt-1 px-2`} />
          </label>
          <label>
            Gold
            <input type="number" min={0} max={LOCATION_LIMITS.maxReward} value={rewardGold} onChange={(e) => setRewardGold(numeric(e.target.value))} className={`${input} mt-1 px-2`} />
          </label>
          <label>
            XP
            <input type="number" min={0} max={LOCATION_LIMITS.maxReward} value={rewardXp} onChange={(e) => setRewardXp(numeric(e.target.value))} className={`${input} mt-1 px-2`} />
          </label>
        </div>

        {stages.map((s, i) => (
          <StageEditor
            key={i}
            label={`Stage ${i + 1}`}
            stage={s}
            quests={quests}
            onChange={(ns) => setStages((cur) => cur.map((x, k) => (k === i ? ns : x)))}
            onRemove={() => setStages((cur) => cur.filter((_, k) => k !== i))}
          />
        ))}
        {stages.length < LOCATION_LIMITS.maxStages && (
          <button
            type="button"
            onClick={() => setStages((cur) => [...cur, { title: "", requirements: [{ kind: "attribute_level", attribute: "STR", minLevel: 3 }] }])}
            className="rounded-xl border border-dashed border-border py-2 text-xs text-muted"
          >
            + Add a stage before the boss
          </button>
        )}

        <StageEditor label="Boss (final stage)" stage={boss} quests={quests} onChange={setBoss} />

        {error && <p className="text-xs text-hp">{error}</p>}
        <button
          type="submit"
          disabled={busy || name.trim().length === 0 || boss.title.trim().length === 0}
          className="rounded-xl bg-xp py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create adventure"}
        </button>
      </form>
    </Sheet>
  );
}
