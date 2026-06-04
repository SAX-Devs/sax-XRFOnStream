interface GateValveProps {
  x: number;
  y: number;
  isOpen: boolean;
  label?: string;
  tag?: string;
  size?: number;
  labelPosition?: "top" | "bottom" | "left" | "right";
}

export function GateValve({
  x,
  y,
  isOpen,
  label,
  tag,
  size = 28,
  labelPosition = "bottom",
}: GateValveProps) {
  const half = size / 2;
  const stateColor = isOpen ? "#10b981" : "#ef4444";
  const bodyFill = isOpen ? "#064e3b" : "#7f1d1d";
  const glowOpacity = isOpen ? 0.6 : 0.3;

  const colorTransition = {
    transition:
      "fill 0.4s ease-in-out, stroke 0.4s ease-in-out, opacity 0.4s ease-in-out",
  };

  const isSideLabel = labelPosition === "left" || labelPosition === "right";
  const labelX =
    labelPosition === "right"
      ? half + 14
      : labelPosition === "left"
        ? -(half + 14)
        : 0;
  const labelY = isSideLabel
    ? 0
    : labelPosition === "bottom"
      ? half + 16
      : -half - 18;
  const tagY = isSideLabel
    ? 12
    : labelPosition === "bottom"
      ? half + 27
      : -half - 28;
  const textAnchor: "start" | "end" | "middle" =
    labelPosition === "right"
      ? "start"
      : labelPosition === "left"
        ? "end"
        : "middle";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow halo */}
      <circle
        cx="0"
        cy="0"
        r={half + 6}
        fill={stateColor}
        opacity={glowOpacity * 0.3}
        filter="url(#valve-glow)"
        style={colorTransition}
      />

      {/* Bowtie body — two triangles meeting at center */}
      <path
        d={`M ${-half},${-half * 0.7} L 0,0 L ${-half},${half * 0.7} Z`}
        fill={bodyFill}
        stroke={stateColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={colorTransition}
      />
      <path
        d={`M ${half},${-half * 0.7} L 0,0 L ${half},${half * 0.7} Z`}
        fill={bodyFill}
        stroke={stateColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={colorTransition}
      />

      {/* Stem */}
      <line
        x1="0"
        y1={-half * 0.6}
        x2="0"
        y2={-half * 1.1}
        stroke={stateColor}
        strokeWidth="1.5"
        style={colorTransition}
      />

      {/* Handwheel (small circle on top) */}
      <circle
        cx="0"
        cy={-half * 1.25}
        r="3"
        fill={stateColor}
        stroke="#0f172a"
        strokeWidth="0.5"
        style={colorTransition}
      />

      {/* Label */}
      {label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor={textAnchor}
          fill="#e2e8f0"
          fontSize="11"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="600"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
        >
          {label}
        </text>
      )}

      {/* Tag */}
      {tag && (
        <text
          x={labelX}
          y={tagY}
          textAnchor={textAnchor}
          fill="#64748b"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
