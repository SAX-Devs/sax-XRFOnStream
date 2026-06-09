interface BallValveProps {
  x: number;
  y: number;
  isOpen: boolean;
  label?: string;
  tag?: string;
  size?: number;
  labelPosition?: "top" | "bottom" | "left" | "right";
  /** P&ID handle orientation. "horizontal" → handle parallel to a horizontal */
  /** pipe when open. "vertical" → handle parallel to a vertical pipe when open. */
  orientation?: "horizontal" | "vertical";
}

export function BallValve({
  x,
  y,
  isOpen,
  label,
  tag,
  size = 26,
  labelPosition = "bottom",
  orientation = "horizontal",
}: BallValveProps) {
  const half = size / 2;
  const stateColor = isOpen ? "#10b981" : "#ef4444";
  const bodyFill = isOpen ? "#064e3b" : "#7f1d1d";
  const colorTransition = {
    transition:
      "fill 0.4s ease-in-out, stroke 0.4s ease-in-out, opacity 0.4s ease-in-out, x1 0.4s ease-in-out, y1 0.4s ease-in-out, x2 0.4s ease-in-out, y2 0.4s ease-in-out",
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
      ? half + 14
      : -half - 18;
  const tagY = isSideLabel
    ? 12
    : labelPosition === "bottom"
      ? half + 25
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

      {/* Indicator line — handle parallel to flow = OPEN, perpendicular = CLOSED.
          For a vertical pipe the "open" pose is a vertical line. */}
      {(() => {
        const horizontalLine =
          orientation === "horizontal" ? isOpen : !isOpen;
        return (
          <line
            x1={horizontalLine ? -half * 0.5 : 0}
            y1={horizontalLine ? 0 : -half * 0.5}
            x2={horizontalLine ? half * 0.5 : 0}
            y2={horizontalLine ? 0 : half * 0.5}
            stroke={stateColor}
            strokeWidth="2"
            strokeLinecap="round"
            style={colorTransition}
          />
        );
      })()}

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
