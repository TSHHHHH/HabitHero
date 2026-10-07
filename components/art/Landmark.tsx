/** Building art that grows with level: tent, house, tower, fortress. Drawn around (0,0). */
export default function Landmark({ level, color }: { level: number; color: string }) {
  const common = { fill: "#1d1a2b", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round" as const };
  if (level < 3)
    return (
      <g>
        <polygon points="-14,12 0,-12 14,12" {...common} />
        <polygon points="-4,12 0,2 4,12" fill={color} opacity={0.7} />
      </g>
    );
  if (level < 5)
    return (
      <g>
        <rect x={-12} y={-2} width={24} height={14} {...common} />
        <polygon points="-15,-2 0,-14 15,-2" {...common} />
        <rect x={-3} y={4} width={6} height={8} fill={color} opacity={0.7} />
      </g>
    );
  if (level < 8)
    return (
      <g>
        <rect x={-7} y={-12} width={14} height={24} {...common} />
        <path d="M-9,-12 h4 v-4 h2 v4 h6 v-4 h2 v4 h4" {...common} fill="none" />
        <rect x={-2} y={-4} width={4} height={6} fill={color} opacity={0.8} />
      </g>
    );
  return (
    <g>
      <rect x={-20} y={-2} width={40} height={14} {...common} />
      <rect x={-22} y={-14} width={10} height={26} {...common} />
      <rect x={12} y={-14} width={10} height={26} {...common} />
      <path d="M-5,12 v-8 a5,5 0 0 1 10,0 v8" fill={color} opacity={0.8} />
    </g>
  );
}
