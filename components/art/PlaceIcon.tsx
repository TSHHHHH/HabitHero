import type { PlaceType } from "@/lib/game/validate";

/** Small emblem for each kind of adventure location, drawn in a 40x40 box. */
export default function PlaceIcon({ type, color = "#e5484d", size = 40 }: { type: PlaceType; color?: string; size?: number }) {
  const common = { fill: "#1d1a2b", stroke: color, strokeWidth: 1.8, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {type === "cave" && (
        <>
          <path d="M4,34 L4,24 Q6,8 20,8 Q34,8 36,24 L36,34 Z" {...common} />
          <path d="M14,34 L14,26 Q14,19 20,19 Q26,19 26,26 L26,34 Z" fill="#0b0a10" stroke={color} strokeWidth={1.5} />
        </>
      )}
      {type === "tower" && (
        <>
          <rect x={14} y={10} width={12} height={24} {...common} />
          <path d="M12,10 h4 v-4 h3 v4 h2 v-4 h3 v4 h4" {...common} fill="none" />
          <rect x={18.5} y={16} width={3} height={6} fill={color} />
        </>
      )}
      {type === "swamp" && (
        <>
          <path d="M3,30 Q12,26 20,30 T37,30 V36 H3 Z" {...common} />
          <path d="M12,30 V14 M17,30 V10 M23,30 V16 M28,30 V12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <ellipse cx={12} cy={13} rx={2} ry={3.5} fill={color} />
          <ellipse cx={17} cy={9} rx={2} ry={3.5} fill={color} />
        </>
      )}
      {type === "ruins" && (
        <>
          <rect x={5} y={14} width={7} height={20} {...common} />
          <rect x={16} y={20} width={7} height={14} {...common} />
          <rect x={27} y={10} width={7} height={24} {...common} />
          <path d="M3,34 H37" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </>
      )}
      {type === "peak" && (
        <>
          <path d="M2,34 L16,8 L24,22 L29,14 L38,34 Z" {...common} />
          <path d="M16,8 L12.5,15 L16,13.5 L19,16 Z" fill={color} />
        </>
      )}
    </svg>
  );
}
