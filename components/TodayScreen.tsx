"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ATTRIBUTES,
  levelFromXp,
  overallLevel,
  xpForLevel,
  type Attribute,
  type Difficulty,
} from "@/lib/game/xp";
import type { BuildingType } from "@/lib/game/town";
import { BOSS_COUNTER_DAMAGE, earnedTitles } from "@/lib/game/motivation";
import type { DayRecord } from "@/lib/game/recap";
import { isDue } from "@/lib/game/rollover";
import { describeRequirement, resolveLocation, type ProgressContext } from "@/lib/game/wilds";
import type { GameState } from "@/lib/types";
import { completeQuest } from "@/app/actions/quests";
import { createBuilding, createQuest, moveBuilding, retireQuest } from "@/app/actions/town";
import { clearStage, createLocation, resummonLocation } from "@/app/actions/wilds";
import WorldMap from "./WorldMap";
import WildsView, { deadlineLabel, type LocationItem } from "./WildsView";
import LocationSheet from "./LocationSheet";
import LocationWizard, { type LocationInput } from "./LocationWizard";
import HabitSheet from "./HabitSheet";
import Recap from "./Recap";
import TownView from "./TownView";
import BuildSheet from "./BuildSheet";
import BuildingSheet from "./BuildingSheet";

const ATTR_COLOR: Record<Attribute, string> = {
  STR: "var(--str)",
  INT: "var(--int)",
  VIT: "var(--vit)",
  WIS: "var(--wis)",
  CHA: "var(--cha)",
};

interface Pop {
  id: number;
  text: string;
  crit: boolean;
}

function Bar({ value, color, className = "" }: { value: number; color: string; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        animate={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

export default function TodayScreen({ initial }: { initial: GameState }) {
  const [xp, setXp] = useState(initial.xp);
  const [gold, setGold] = useState(initial.player.gold);
  const [hp, setHp] = useState(initial.player.hp);
  const [habits, setHabits] = useState(initial.habits);
  const [done, setDone] = useState(initial.done);
  const [history, setHistory] = useState({ completions: initial.completions, days: initial.days });
  const [pops, setPops] = useState<Pop[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [view, setView] = useState<"map" | "town" | "wilds" | "recap">("map");
  const [locations, setLocations] = useState(initial.locations);
  const [wildsSheet, setWildsSheet] = useState<{ kind: "new" } | { kind: "location"; id: string } | null>(null);
  const [buildings, setBuildings] = useState(initial.buildings);
  const [townSheet, setTownSheet] = useState<
    { kind: "build"; x: number; y: number } | { kind: "building"; id: string } | null
  >(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastDoneId, setLastDoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popId = useRef(0);
  const today = initial.today;
  const maxHp = initial.player.maxHp;

  const levels = Object.fromEntries(ATTRIBUTES.map((a) => [a, levelFromXp(xp[a])])) as Record<Attribute, number>;
  const overall = overallLevel(xp);
  const titles = earnedTitles(levels);

  // Wilds progress is derived from live XP and the completion history, so it moves as quests are done.
  const progressCtx: ProgressContext = {
    attributeXp: xp,
    completions: history.completions.map((c) => ({ questId: c.habitId, date: c.date })),
    today,
  };
  const questTitle = (id: string) => habits.find((h) => h.id === id)?.title ?? "a retired quest";
  const locationItems: LocationItem[] = locations.map((loc) => ({
    loc,
    res: resolveLocation(
      loc.stages.map((s) => ({ id: s.id, ord: s.ord, kind: s.kind, requirements: s.requirements })),
      new Set(loc.stages.filter((s) => s.clearedAt).map((s) => s.id)),
      progressCtx,
      loc.deadline,
    ),
  }));
  // The Realm shows the open adventure with the nearest deadline.
  const focus =
    locationItems
      .filter((i) => i.res.status === "active" || i.res.status === "ready")
      .sort((a, b) => a.loc.deadline.localeCompare(b.loc.deadline))[0] ?? null;
  const focusStage = focus ? focus.res.stages.find((s) => s.status === "active" || s.status === "ready") : null;
  const focusStageDef = focus && focusStage ? focus.loc.stages.find((s) => s.id === focusStage.id) : null;
  const openLocation = wildsSheet?.kind === "location" ? locationItems.find((i) => i.loc.id === wildsSheet.id) ?? null : null;
  const selected = habits.find((h) => h.id === selectedId) ?? null;

  const pushLog = (entries: string[]) => setLog((l) => [...entries, ...l].slice(0, 8));

  async function complete(habitId: string, mode: "full" | "mini") {
    const h = habits.find((x) => x.id === habitId);
    if (!h || done[h.id] || busy) return;
    setBusy(true);
    try {
      const r = await completeQuest(habitId, mode);
      if (!r.ok) {
        pushLog([`Could not complete "${h.title}": ${r.error}`]);
        return;
      }
      setXp((x) => ({ ...x, [r.attribute]: r.attributeXp }));
      setGold(r.gold);
      setDone((d) => ({ ...d, [h.id]: mode }));
      setHabits((hs) => hs.map((x) => (x.id === h.id ? { ...x, streak: r.streak, shields: r.shields } : x)));
      setBuildings((bs) => bs.map((b) => (b.id === h.buildingId ? { ...b, completions: b.completions + 1 } : b)));
      setLastDoneId(h.id);
      setHistory((hist) => ({
        ...hist,
        completions: [
          ...hist.completions,
          { date: r.date, habitId: h.id, attribute: r.attribute, xp: r.gain, gold: r.goldGain, crit: r.crit, mini: mode === "mini" },
        ],
      }));

      const id = ++popId.current;
      setPops((p) => [...p, { id, text: `${r.crit ? "CRIT! " : ""}-${r.gain} HP`, crit: r.crit }]);
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000);

      const entries = [
        `${h.title}${mode === "mini" ? " (minimum effort)" : ""}: +${r.gain} ${r.attribute} XP${r.crit ? " (critical!)" : ""}`,
      ];
      if (r.loot) entries.push(`Loot drop: ${r.loot.name} (+${r.loot.gold}g)`);
      if (r.newLevel) entries.push(`LEVEL UP: ${r.attribute} reached ${r.newLevel}!`);
      pushLog(entries.reverse());
    } catch {
      pushLog([`Could not reach the server. "${h.title}" was not saved.`]);
    } finally {
      setBusy(false);
    }
  }

  async function guarded<T>(fn: () => Promise<T>): Promise<T | null> {
    if (busy) return null;
    setBusy(true);
    setFormError(null);
    try {
      return await fn();
    } catch {
      setFormError("Could not reach the server. Nothing was saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onBuild(input: { name: string; type: BuildingType; attribute: Attribute }) {
    if (townSheet?.kind !== "build") return;
    const r = await guarded(() => createBuilding({ ...input, plotX: townSheet.x, plotY: townSheet.y }));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setBuildings((bs) => [...bs, r.building]);
    setTownSheet({ kind: "building", id: r.building.id });
    pushLog([`You built ${r.building.name}.`]);
  }

  async function onAddQuest(
    buildingId: string,
    input: { title: string; miniTitle: string; difficulty: Difficulty; schedule: number[] },
  ) {
    const r = await guarded(() => createQuest({ buildingId, ...input }));
    if (!r) return false;
    if (!r.ok) {
      setFormError(r.error);
      return false;
    }
    setHabits((hs) => [...hs, r.habit]);
    pushLog([`New quest: ${r.habit.title}`]);
    return true;
  }

  async function onRetire(habitId: string) {
    const r = await guarded(() => retireQuest(habitId));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setHabits((hs) => hs.filter((h) => h.id !== habitId));
  }

  async function onPlot(x: number, y: number) {
    if (!movingId) {
      setFormError(null);
      setTownSheet({ kind: "build", x, y });
      return;
    }
    const r = await guarded(() => moveBuilding(movingId, x, y));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setBuildings((bs) => bs.map((b) => (b.id === r.buildingId ? { ...b, plotX: r.plotX, plotY: r.plotY } : b)));
    setMovingId(null);
  }

  async function onCreateLocation(input: LocationInput) {
    const r = await guarded(() => createLocation(input));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setLocations((ls) => [...ls, r.location]);
    setWildsSheet({ kind: "location", id: r.location.id });
    pushLog([`A new adventure awaits: ${r.location.name}`]);
  }

  async function onClearStage(locationId: string, stageId: string) {
    const r = await guarded(() => clearStage(locationId, stageId));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setLocations((ls) =>
      ls.map((l) =>
        l.id !== locationId
          ? l
          : {
              ...l,
              status: r.bossDefeated ? "cleared" : l.status,
              stages: l.stages.map((s) => (s.id === stageId ? { ...s, clearedAt: r.clearedOn } : s)),
            },
      ),
    );
    const name = locations.find((l) => l.id === locationId)?.name ?? "the adventure";
    if (r.bossDefeated) {
      setXp(r.attributeXp);
      setGold(r.gold);
      pushLog([`VICTORY! ${name} is cleared: +${r.rewards.xp} XP, +${r.rewards.gold} gold`]);
    } else {
      pushLog([`Stage cleared in ${name}.`]);
    }
  }

  async function onResummon(locationId: string, deadline: string) {
    const r = await guarded(() => resummonLocation(locationId, deadline));
    if (!r) return;
    if (!r.ok) return setFormError(r.error);
    setLocations((ls) => ls.map((l) => (l.id === locationId ? { ...l, deadline: r.deadline, status: "active" } : l)));
    pushLog([`${locations.find((l) => l.id === locationId)?.name ?? "The location"} has been re-summoned.`]);
  }

  // Demo only until the daily rollover job exists: affects this session, not the database.
  function endDay() {
    const missed = habits.filter((h) => isDue(h, today) && !done[h.id]).length;
    if (!missed) return;
    const dmg = missed * BOSS_COUNTER_DAMAGE;
    setHp((v) => Math.max(0, v - dmg));
    const rec: DayRecord = { date: today, hpLost: dmg, shieldsUsed: 0 };
    setHistory((hist) => ({ ...hist, days: [...hist.days, rec] }));
    pushLog([`The boss counter-attacks! -${dmg} HP (${missed} quest${missed > 1 ? "s" : ""} skipped)`]);
  }

  // Quests scheduled for other weekdays stay out of today's map and counts.
  const dueHabits = habits.filter((h) => isDue(h, today));
  const doneCount = dueHabits.filter((h) => done[h.id]).length;
  const openBuilding = townSheet?.kind === "building" ? buildings.find((b) => b.id === townSheet.id) ?? null : null;

  const logSection = log.length > 0 && (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-xs uppercase tracking-widest text-muted">Adventure log</h2>
      <ul className="space-y-1 text-sm">
        {log.map((l, i) => (
          <li key={i} className={l.startsWith("LEVEL") ? "text-gold" : l.includes("counter") || l.startsWith("Could not") ? "text-hp" : ""}>
            {l}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-48 pt-6">
      <header className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">{initial.player.townName}</p>
            <h1 className="text-2xl font-bold">
              {initial.player.name}, Level {overall}
            </h1>
          </div>
          <p className="font-mono text-lg text-gold">{gold}g</p>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="w-6 text-hp">HP</span>
          <Bar value={hp / maxHp} color="var(--hp)" />
          <span className="w-8 text-right font-mono">{hp}</span>
        </div>
        {hp <= 0 && <p className="mt-2 text-xs text-crit">Weakened: rewards halved until you recover.</p>}
        {titles.length > 0 && <p className="mt-3 text-xs text-muted">Titles: {titles.map((t) => t.name).join(", ")}</p>}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {ATTRIBUTES.map((a) => {
            const lv = levels[a];
            const span = xpForLevel(lv + 1) - xpForLevel(lv);
            return (
              <div key={a} className="text-center">
                <p className="text-[10px] font-semibold" style={{ color: ATTR_COLOR[a] }}>
                  {a}
                </p>
                <p className="font-mono text-lg">{lv}</p>
                <Bar value={(xp[a] - xpForLevel(lv)) / span} color={ATTR_COLOR[a]} className="!h-1" />
              </div>
            );
          })}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1 text-sm">
        {(["map", "town", "wilds", "recap"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setSelectedId(null);
              setTownSheet(null);
              setWildsSheet(null);
              setMovingId(null);
              setFormError(null);
            }}
            className={`rounded-lg py-2 font-medium ${view === v ? "bg-xp text-white" : "text-muted"}`}
          >
            {v === "map" ? "Realm" : v === "town" ? "Town" : v === "wilds" ? "Wilds" : "Recap"}
          </button>
        ))}
      </div>

      {view === "map" ? (
        <>
          <section className="relative rounded-2xl border border-border bg-surface p-4">
            <div className="pointer-events-none absolute right-4 top-4">
              {pops.map((p) => (
                <span key={p.id} className={`float-up block font-mono text-sm font-bold ${p.crit ? "text-crit" : "text-gold"}`}>
                  {p.text}
                </span>
              ))}
            </div>
            {focus ? (
              <>
                <p className="text-xs uppercase tracking-widest text-muted">
                  Adventure · {deadlineLabel(focus.loc.deadline, today)}
                </p>
                <h2 className="mt-1 text-lg font-bold">{focus.loc.name}</h2>
                {focusStageDef && (
                  <p className="mt-1 text-xs text-muted">
                    {focusStageDef.id === focus.loc.stages[focus.loc.stages.length - 1].id ? "Boss" : `Stage ${focusStageDef.ord}`}:{" "}
                    {focusStageDef.title}. {focusStageDef.requirements.map((r) => describeRequirement(r, questTitle)).join("; ")}
                  </p>
                )}
                <button
                  disabled={busy || !focusStage || focusStage.status !== "ready"}
                  onClick={() => focusStage && onClearStage(focus.loc.id, focusStage.id)}
                  className="mt-3 w-full rounded-xl bg-xp py-2 text-sm font-semibold disabled:bg-surface-2 disabled:text-muted"
                >
                  {focusStage?.status === "ready"
                    ? focusStageDef?.id === focus.loc.stages[focus.loc.stages.length - 1].id
                      ? "Defeat the boss"
                      : "Clear this stage"
                    : "Not ready yet"}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-widest text-muted">No adventure underway</p>
                <p className="mt-1 text-sm">Create a location in the Wilds to give your quests a purpose.</p>
                <button
                  onClick={() => setView("wilds")}
                  className="mt-3 w-full rounded-xl border border-border py-2 text-sm text-muted"
                >
                  Go to the Wilds
                </button>
              </>
            )}
            {formError && view === "map" && <p className="mt-2 text-xs text-hp">{formError}</p>}
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-widest text-muted">The Realm</h2>
              <p className="text-xs text-muted">
                {doneCount}/{dueHabits.length} quests cleared today
              </p>
            </div>
            <WorldMap
              habits={dueHabits}
              levels={levels}
              done={done}
              selectedId={selectedId}
              lastDoneId={lastDoneId}
              bossHp={focus ? 1 - focus.res.progress : 1}
              bossName={focus ? focus.loc.name : "No adventure"}
              onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
            />
            <p className="mt-2 text-[11px] text-muted">
              Tap a location to start its quest. Numbers show streak days. Fog lifts and buildings grow as you level each attribute.
            </p>
            <button onClick={endDay} className="mt-2 block text-xs text-muted underline-offset-2 hover:underline">
              Preview end of day (demo, not saved)
            </button>
          </section>

          {logSection}
        </>
      ) : view === "wilds" ? (
        <>
          <WildsView
            items={locationItems}
            today={today}
            onOpen={(id) => {
              setFormError(null);
              setWildsSheet({ kind: "location", id });
            }}
            onNew={() => {
              setFormError(null);
              setWildsSheet({ kind: "new" });
            }}
          />
          {logSection}
        </>
      ) : view === "town" ? (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-widest text-muted">{initial.player.townName}</h2>
              <p className="text-xs text-muted">
                {buildings.length} building{buildings.length === 1 ? "" : "s"} · grid grows at level 5 and 10
              </p>
            </div>
            {movingId && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
                <span>Tap an empty plot to move the building there.</span>
                <button onClick={() => setMovingId(null)} className="underline-offset-2 hover:underline">
                  Cancel
                </button>
              </div>
            )}
            {movingId && formError && <p className="mb-2 text-xs text-hp">{formError}</p>}
            <TownView
              theme={initial.player.theme}
              overallLevel={overall}
              buildings={buildings}
              habits={dueHabits}
              done={done}
              selectedId={townSheet?.kind === "building" ? townSheet.id : null}
              movingId={movingId}
              onPlot={onPlot}
              onBuilding={(id) => {
                if (movingId) return;
                setFormError(null);
                setTownSheet({ kind: "building", id });
              }}
            />
            <p className="mt-2 text-[11px] text-muted">
              Tap an empty plot to build. Each building holds the quests that train its attribute and levels up as you use it.
            </p>
          </section>
          {logSection}
        </>
      ) : (
        <Recap completions={history.completions} dayRecords={history.days} habits={habits} today={today} />
      )}

      <AnimatePresence>
        {view === "wilds" && wildsSheet?.kind === "new" && (
          <LocationWizard
            key="wizard"
            quests={habits}
            today={today}
            busy={busy}
            error={formError}
            onSubmit={onCreateLocation}
            onClose={() => setWildsSheet(null)}
          />
        )}
        {view === "wilds" && openLocation && (
          <LocationSheet
            key={openLocation.loc.id}
            item={openLocation}
            ctx={progressCtx}
            questTitle={questTitle}
            busy={busy}
            error={formError}
            onClearStage={(stageId) => onClearStage(openLocation.loc.id, stageId)}
            onResummon={(deadline) => onResummon(openLocation.loc.id, deadline)}
            onClose={() => setWildsSheet(null)}
          />
        )}
        {view === "town" && townSheet?.kind === "build" && !movingId && (
          <BuildSheet
            key={`build-${townSheet.x}-${townSheet.y}`}
            plot={{ x: townSheet.x, y: townSheet.y }}
            busy={busy}
            error={formError}
            onSubmit={onBuild}
            onClose={() => setTownSheet(null)}
          />
        )}
        {view === "town" && openBuilding && !movingId && (
          <BuildingSheet
            key={openBuilding.id}
            building={openBuilding}
            habits={habits.filter((h) => h.buildingId === openBuilding.id)}
            today={today}
            done={done}
            busy={busy}
            error={formError}
            onComplete={complete}
            onAddQuest={(input) => onAddQuest(openBuilding.id, input)}
            onRetire={onRetire}
            onMove={() => {
              setFormError(null);
              setMovingId(openBuilding.id);
              setTownSheet(null);
            }}
            onClose={() => setTownSheet(null)}
          />
        )}
        {view === "map" && selected && (
          <HabitSheet
            key={selected.id}
            habit={selected}
            state={done[selected.id]}
            weakened={hp <= 0}
            busy={busy}
            onComplete={(mode) => complete(selected.id, mode)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
