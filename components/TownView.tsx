"use client";

import { buildingLevel, gridSize } from "@/lib/game/town";
import { ATTR_HEX, THEME_BG } from "@/lib/theme";
import type { BuildingView, GameState, HabitView } from "@/lib/types";
import Landmark from "./art/Landmark";

const CELL = 80;
const PAD = 8;

interface Props {
  theme: GameState["player"]["theme"];
  overallLevel: number;
  buildings: BuildingView[];
  habits: HabitView[];
  done: Record<string, "full" | "mini">;
  selectedId: string | null;
  movingId: string | null;
  onPlot: (x: number, y: number) => void;
  onBuilding: (id: string) => void;
}

export default function TownView({
  theme, overallLevel, buildings, habits, done, selectedId, movingId, onPlot, onBuilding,
}: Props) {
  const n = gridSize(overallLevel);
  const size = n * CELL + PAD * 2;
  const at = (x: number, y: number) => buildings.find((b) => b.plotX === x && b.plotY === y);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full rounded-2xl border border-border"
      style={{ background: THEME_BG[theme] }}
      role="group"
      aria-label="Town"
    >
      <defs>
        <filter id="town-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {Array.from({ length: n * n }, (_, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const b = at(x, y);
        const px = PAD + x * CELL;
        const py = PAD + y * CELL;
        const mine = b ? habits.filter((h) => h.buildingId === b.id) : [];
        const doneCount = mine.filter((h) => done[h.id]).length;
        const color = b ? ATTR_HEX[b.attribute] : "#3a3558";
        const level = b ? buildingLevel(b.completions) : 0;
        const glowing = !!b && mine.length > 0 && doneCount === mine.length;
        const label = b ? (b.name.length > 12 ? b.name.slice(0, 11) + "…" : b.name) : "";
        const targetable = !!movingId && !b;

        return (
          <g
            key={`${x}-${y}`}
            role="button"
            tabIndex={0}
            aria-label={b ? `${b.name}, level ${level}` : `Empty plot ${x + 1},${y + 1}`}
            onClick={() => (b ? onBuilding(b.id) : onPlot(x, y))}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (b ? onBuilding(b.id) : onPlot(x, y))}
            className="cursor-pointer outline-none"
          >
            <rect
              x={px + 3}
              y={py + 3}
              width={CELL - 6}
              height={CELL - 6}
              rx={14}
              fill={b ? `${color}1a` : "rgba(255,255,255,0.025)"}
              stroke={targetable ? "#f2c14e" : b ? color : "#2b2740"}
              strokeWidth={targetable || selectedId === b?.id ? 2 : 1}
              strokeDasharray={b ? undefined : "4 5"}
              opacity={movingId && b && b.id !== movingId ? 0.5 : 1}
            />
            {b ? (
              <>
                <g transform={`translate(${px + CELL / 2} ${py + CELL / 2 - 8}) scale(1.35)`} filter={glowing ? "url(#town-glow)" : undefined}>
                  <Landmark level={level} color={color} />
                </g>
                <text x={px + CELL / 2} y={py + CELL - 20} textAnchor="middle" fontSize={9} fontWeight={600} fill="#e9e6f2">
                  {label}
                </text>
                <text x={px + CELL / 2} y={py + CELL - 9} textAnchor="middle" fontSize={8} fill="#8b86a3">
                  {mine.length === 0 ? "no quests" : `${doneCount}/${mine.length} today`}
                </text>
                <g transform={`translate(${px + CELL - 14} ${py + 14})`}>
                  <circle r={8} fill="#0b0a10" stroke={color} strokeWidth={1.2} />
                  <text y={3} textAnchor="middle" fontSize={9} fontWeight={700} fill={color} fontFamily="var(--font-geist-mono)">
                    {level}
                  </text>
                </g>
              </>
            ) : (
              <text x={px + CELL / 2} y={py + CELL / 2 + 6} textAnchor="middle" fontSize={22} fill={targetable ? "#f2c14e" : "#3a3558"}>
                +
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
