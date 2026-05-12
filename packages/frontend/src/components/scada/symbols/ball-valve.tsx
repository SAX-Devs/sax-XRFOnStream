interface BallValveProps {
  x: number;
  y: number;
  isOpen: boolean;
  label?: string;
  tag?: string;
  size?: number;
}

export function BallValve({
  x,
  y,
  isOpen,
  label,
  tag,
  size = 26,
}: BallValveProps) {
  const half = size / 2;
  const stateColor = isOpen ? "#10b981" : "#ef4444";
  const bodyFill = isOpen ? "#064e3b" : "#7f1d1d";
  const colorTransition = {
    transition:
      "fill 0.4s ease-in-out, stroke 0.4s ease-in-out, opacity 0.4s ease-in-out, x1 0.4s ease-in-out, y1 0.4s ease-in-out, x2 0.4s ease-in-out, y2 0.4s ease-in-out",
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow halo */}
      <circle
        cx="0"
        cy="0"
        r={half + 4}
        fill={stateColor}
        opacity="0.2"
        filter="url(#valve-glow)"
        style={colorTransition}
      />

      {/* Outer body — square */}
      <rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx="2"
        fill={bodyFill}
        stroke={stateColor}
        strokeWidth="1.5"
        style={colorTransition}
      />

      {/* Ball inside */}
      <circle
        cx="0"
        cy="0"
        r={half * 0.6}
        fill="#0f172a"
        stroke={stateColor}
        strokeWidth="1.2"
        style={colorTransition}
      />

      {/* Indicator line — horizontal when open, vertical when closed */}
      <line
        x1={isOpen ? -half * 0.5 : 0}
        y1={isOpen ? 0 : -half * 0.5}
        x2={isOpen ? half * 0.5 : 0}
        y2={isOpen ? 0 : half * 0.5}
        stroke={stateColor}
        strokeWidth="2"
        strokeLinecap="round"
        style={colorTransition}
      />

      {/* Stem on top */}
      <line
        x1="0"
        y1={-half}
        x2="0"
        y2={-half * 1.5}
        stroke={stateColor}
        strokeWidth="1.5"
        style={colorTransition}
      />

      {/* Handle */}
      <rect
        x={-half * 0.5}
        y={-half * 1.7}
        width={size * 0.5}
        height="3"
        fill={stateColor}
        rx="1"
        style={colorTransition}
      />

      {label && (
        <text
          x="0"
          y={half + 14}
          textAnchor="middle"
          fill="#cbd5e1"
          fontSize="9"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="500"
        >
          {label}
        </text>
      )}

      {tag && (
        <text
          x="0"
          y={half + 25}
          textAnchor="middle"
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
