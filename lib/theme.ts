import type { Attribute } from "@/lib/game/xp";

/** Attribute colors as hex, for SVG fills and glow filters. */
export const ATTR_HEX: Record<Attribute, string> = {
  STR: "#ef4444",
  INT: "#3b82f6",
  VIT: "#22c55e",
  WIS: "#a78bfa",
  CHA: "#f59e0b",
};

export const THEME_BG: Record<"forest" | "snow" | "desert", string> = {
  forest: "#0e1a14",
  snow: "#121a26",
  desert: "#1e1810",
};
