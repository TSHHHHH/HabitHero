"use client";

import { motion } from "framer-motion";
import { ATTRIBUTES, type Attribute } from "@/lib/game/xp";
import type { HabitView } from "@/lib/types";
import Landmark from "./art/Landmark";
import { ATTR_HEX } from "@/lib/theme";

const LAIR = { x: 180, y: 285 };

const REGIONS: Record<Attribute, { x: number; y: number; name: string; color: string }> = {
  STR: { x: 180, y: 92, name: "The Forge", color: ATTR_HEX.STR },
  INT: { x: 292, y: 215, name: "Arcane Library", color: ATTR_HEX.INT },
  VIT: { x: 250, y: 440, name: "Verdant Grove", color: ATTR_HEX.VIT },
  WIS: { x: 110, y: 440, name: "Moon Temple", color: ATTR_HEX.WIS },
  CHA: { x: 68, y: 215, name: "The Tavern", color: ATTR_HEX.CHA },
};

const SCENERY = [
  [30, 40, 1], [330, 50, 1.2], [20, 330, 0.9], [340, 340, 1], [180, 190, 0.7],
  [40, 520, 1], [320, 515, 1.1], [180, 520, 0.8], [130, 330, 0.6], [235, 340, 0.7],
];

const fogOpacity = (level: number) => Math.max(0, 0.7 - (level - 1) * 0.17);

const PER_RING = 3;
const MAX_NODES = PER_RING * 2;

/** Quests sit on rings around a region's landmark, three per ring; extras are summarized as "+N more". */
function nodePos(attr: Attribute, idx: number, count: number) {
  const r = REGIONS[attr];
  const ring = Math.floor(idx / PER_RING);
  const inRing = Math.min(PER_RING, count - ring * PER_RING);
  const angles = inRing === 1 ? [90] : inRing === 2 ? [30, 150] : [30, 90, 150];
  const a = (angles[idx % PER_RING] * Math.PI) / 180;
  const radius = 44 + ring * 36;
  return { x: r.x + radius * Math.cos(a), y: r.y + 14 + radius * Math.sin(a) };
}

interface Props {
  habits: HabitView[];
  levels: Record<Attribute, number>;
  done: Record<string, "full" | "mini">;
  selectedId: string | null;
  lastDoneId: string | null;
  bossHp: number; // 0..1 remaining
  bossName: string;
  onSelect: (id: string) => void;
}

export default function WorldMap({ habits, levels, done, selectedId, lastDoneId, bossHp, bossName, onSelect }: Props) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const a of ATTRIBUTES) {
    const list = habits.filter((h) => h.attribute === a);
    const shown = Math.min(list.length, MAX_NODES);
    list.slice(0, shown).forEach((h, i) => (positions[h.id] = nodePos(a, i, shown)));
  }
  const hero = (lastDoneId && positions[lastDoneId]) || { x: LAIR.x, y: LAIR.y + 52 };

  return (
    <svg viewBox="0 0 360 540" className="w-full rounded-2xl border border-border bg-[#0d0b16]" role="group" aria-label="World map">
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="fog">
          <stop offset="0%" stopColor="#0b0a10" stopOpacity="0.95" />
          <stop offset="65%" stopColor="#0b0a10" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0b0a10" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lair">
          <stop offset="0%" stopColor="#e5484d" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e5484d" stopOpacity="0" />
        </radialGradient>
        {ATTRIBUTES.map((a) => (
          <radialGradient key={a} id={`reg-${a}`}>
            <stop offset="0%" stopColor={REGIONS[a].color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={REGIONS[a].color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {SCENERY.map(([x, y, s], i) => (
        <polygon
          key={i}
          points={`${x - 10 * s},${y + 8 * s} ${x},${y - 12 * s} ${x + 10 * s},${y + 8 * s}`}
          fill="#17142a"
          stroke="#2b2740"
          strokeWidth={1}
        />
      ))}

      {ATTRIBUTES.map((a) => {
        const r = REGIONS[a];
        const cx = (LAIR.x + r.x) / 2 + (r.x < LAIR.x ? -18 : 18);
        const cy = (LAIR.y + r.y) / 2;
        return (
          <path
            key={a}
            d={`M${LAIR.x},${LAIR.y} Q${cx},${cy} ${r.x},${r.y + 10}`}
            fill="none"
            stroke="#3a3558"
            strokeWidth={2}
            strokeDasharray="2 7"
            strokeLinecap="round"
          />
        );
      })}

      {/* boss lair */}
      <circle cx={LAIR.x} cy={LAIR.y} r={56} fill="url(#lair)" />
      <circle cx={LAIR.x} cy={LAIR.y} r={26} fill="#1a0f14" stroke="#e5484d" strokeWidth={2} filter="url(#glow)" />
      <path d={`M${LAIR.x - 16},${LAIR.y - 10} l-6,-14 l12,8 M${LAIR.x + 16},${LAIR.y - 10} l6,-14 l-12,8`} fill="#e5484d" stroke="#e5484d" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={LAIR.x - 8} cy={LAIR.y - 2} r={3} fill="#ff7a45" />
      <circle cx={LAIR.x + 8} cy={LAIR.y - 2} r={3} fill="#ff7a45" />
      <path d={`M${LAIR.x - 9},${LAIR.y + 9} h18`} stroke="#e5484d" strokeWidth={2} strokeLinecap="round" />
      <text x={LAIR.x} y={LAIR.y + 42} textAnchor="middle" fontSize={9} fill="#c9c4dd" fontWeight={600}>
        {bossName}
      </text>
      <rect x={LAIR.x - 30} y={LAIR.y + 47} width={60} height={4} rx={2} fill="#2b2740" />
      <rect x={LAIR.x - 30} y={LAIR.y + 47} width={60 * Math.max(bossHp, 0)} height={4} rx={2} fill="#e5484d" />

      {/* regions */}
      {ATTRIBUTES.map((a) => {
        const r = REGIONS[a];
        const lv = levels[a];
        return (
          <g key={a}>
            <circle cx={r.x} cy={r.y + 6} r={64} fill={`url(#reg-${a})`} />
            <g transform={`translate(${r.x} ${r.y - 8})`}>
              <Landmark level={lv} color={r.color} />
            </g>
            <text x={r.x} y={r.y - 32} textAnchor="middle" fontSize={9} fontWeight={700} fill={r.color} letterSpacing={0.5}>
              {r.name.toUpperCase()} · LV {lv}
            </text>
            {habits.filter((h) => h.attribute === a).length > MAX_NODES && (
              <text x={r.x} y={r.y - 21} textAnchor="middle" fontSize={8} fill="#8b86a3">
                +{habits.filter((h) => h.attribute === a).length - MAX_NODES} more in Town
              </text>
            )}
            <circle
              cx={r.x}
              cy={r.y + 6}
              r={72}
              fill="url(#fog)"
              opacity={fogOpacity(lv)}
              className="fog"
              pointerEvents="none"
            />
          </g>
        );
      })}

      {/* habit nodes */}
      {habits.filter((h) => positions[h.id]).map((h) => {
        const p = positions[h.id];
        const color = REGIONS[h.attribute].color;
        const state = done[h.id];
        const selected = selectedId === h.id;
        const label = h.title.length > 12 ? h.title.slice(0, 11) + "…" : h.title;
        return (
          <g
            key={h.id}
            transform={`translate(${p.x} ${p.y})`}
            role="button"
            tabIndex={0}
            aria-label={`${h.title}, ${state ? "completed" : "not completed"}, ${h.streak} day streak`}
            onClick={() => onSelect(h.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(h.id)}
            className="cursor-pointer outline-none"
          >
            <circle r={24} fill="transparent" />
            {selected && <circle r={21} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="3 3" />}
            <circle
              r={15}
              fill={state ? color : "#15131f"}
              stroke={color}
              strokeWidth={2}
              filter={h.streak >= 7 || state ? "url(#glow)" : undefined}
              opacity={state ? 0.95 : 1}
            />
            {state ? (
              <path d="M-6,0 l4,4 l8,-8" fill="none" stroke="#0b0a10" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill={color} fontFamily="var(--font-geist-mono)">
                {h.streak}
              </text>
            )}
            {h.shields > 0 && !state && (
              <g transform="translate(12 -12)">
                <circle r={6} fill="#0b0a10" stroke="#f2c14e" strokeWidth={1} />
                <text y={3} textAnchor="middle" fontSize={8} fill="#f2c14e" fontWeight={700}>
                  {h.shields}
                </text>
              </g>
            )}
            <text y={29} textAnchor="middle" fontSize={8.5} fill={state ? "#8b86a3" : "#e9e6f2"}>
              {label}
            </text>
          </g>
        );
      })}

      {/* hero */}
      <motion.g
        initial={false}
        animate={{ x: hero.x + 18, y: hero.y - 18 }}
        transition={{ type: "spring", stiffness: 70, damping: 14 }}
        pointerEvents="none"
      >
        <circle r={9} fill="#f2c14e" opacity={0.25} filter="url(#glow)" />
        <circle r={5} fill="#f2c14e" stroke="#0b0a10" strokeWidth={1.5} />
        <path d="M-3,-6 l3,-4 l3,4" fill="#f2c14e" stroke="#0b0a10" strokeWidth={1} />
      </motion.g>
    </svg>
  );
}
