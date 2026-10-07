"use client";

import { useState } from "react";
import { BUILDING_AFFINITY, BUILDING_TYPES, type BuildingType } from "@/lib/game/town";
import { LIMITS } from "@/lib/game/validate";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import { ATTR_HEX } from "@/lib/theme";
import Sheet from "./ui/Sheet";

const TYPE_LABEL: Record<BuildingType, string> = {
  gym: "Gym", library: "Library", garden: "Garden", workshop: "Workshop",
  shrine: "Shrine", tavern: "Tavern", home: "Home", custom: "Custom",
};

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-medium ${active ? "text-white" : "border-border text-muted"}`;

interface Props {
  plot: { x: number; y: number };
  busy: boolean;
  error: string | null;
  onSubmit: (input: { name: string; type: BuildingType; attribute: Attribute }) => void;
  onClose: () => void;
}

export default function BuildSheet({ plot, busy, error, onSubmit, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<BuildingType>("gym");
  const [attribute, setAttribute] = useState<Attribute>("STR");

  function pickType(t: BuildingType) {
    setType(t);
    const affinity = BUILDING_AFFINITY[t];
    if (affinity) setAttribute(affinity);
  }

  return (
    <Sheet title="Build in your town" subtitle={`Plot ${plot.x + 1}, ${plot.y + 1}`} onClose={onClose}>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, type, attribute });
        }}
      >
        <label className="text-xs text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.name}
            placeholder="e.g. Iron Gym"
            className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-xp"
          />
        </label>

        <div>
          <p className="mb-1 text-xs text-muted">Type</p>
          <div className="flex flex-wrap gap-1.5">
            {BUILDING_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => pickType(t)}
                className={chip(type === t)}
                style={type === t ? { background: "var(--xp)", borderColor: "var(--xp)" } : undefined}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted">Trains attribute (its quests earn this XP)</p>
          <div className="flex flex-wrap gap-1.5">
            {ATTRIBUTES.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setAttribute(a)}
                className={chip(attribute === a)}
                style={attribute === a ? { background: ATTR_HEX[a], borderColor: ATTR_HEX[a] } : undefined}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-hp">{error}</p>}
        <button
          type="submit"
          disabled={busy || name.trim().length === 0}
          className="rounded-xl bg-xp py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Building…" : "Build"}
        </button>
      </form>
    </Sheet>
  );
}
