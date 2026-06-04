interface HoneycombWindowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** When true, the window glows (radiation crossing). */
  active?: boolean;
}

/**
 * The "panal de abeja" window between the analysis chamber and the internal
 * chamber. The X-ray radiation crosses here to reach the sample. Drawn as a
 * framed vertical strip filled with a hexagonal honeycomb mesh.
 */
export function HoneycombWindow({
  x,
  y,
  width,
  height,
  active = true,
}: HoneycombWindowProps) {
  const clipId = `hc-clip-${x}-${y}`;
  const r = 3.2;
  const colSp = Math.sqrt(3) * r;
  const rowSp = 1.5 * r;

  const hexes: { cx: number; cy: number }[] = [];
  for (let row = 0; row * rowSp <= height; row++) {
    const cy = y + r + row * rowSp;
    const off = (row % 2) * (colSp / 2);
    for (let col = 0; col * colSp <= width + colSp; col++) {
      hexes.push({ cx: x + off + col * colSp - colSp / 2, cy });
    }
  }

  const hexPoints = (cx: number, cy: number) =>
    [-90, -30, 30, 90, 150, 210]
      .map((a) => {
        const rad = (a * Math.PI) / 180;
        return `${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`;
      })
      .join(" ");

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx="3" />
        </clipPath>
      </defs>

      {/* Frame */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="3"
        fill="#0b1220"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />

      {/* Honeycomb mesh (clipped to the frame) */}
      <g clipPath={`url(#${clipId})`}>
        {hexes.map((h, i) => (
          <polygon
            key={i}
            points={hexPoints(h.cx, h.cy)}
            fill="none"
            stroke={active ? "#22d3ee" : "#475569"}
            strokeWidth="0.6"
            strokeOpacity={active ? 0.5 : 0.35}
          />
        ))}
      </g>

      {/* Active glow */}
      {active && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx="3"
          fill="#22d3ee"
          opacity="0.12"
          filter="url(#detector-glow)"
        />
      )}
    </g>
  );
}
