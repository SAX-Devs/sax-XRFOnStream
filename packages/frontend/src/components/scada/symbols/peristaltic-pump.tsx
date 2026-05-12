interface PeristalticPumpProps {
  x: number;
  y: number;
  state: "FORWARD" | "REVERSE" | "STOP";
  size?: number;
  tag?: string;
  labelPosition?: "top" | "bottom" | "left" | "right";
}

export function PeristalticPump({
  x,
  y,
  state,
  size = 60,
  tag,
  labelPosition = "bottom",
}: PeristalticPumpProps) {
  const radius = size / 2;
  const isActive = state !== "STOP";
  const stateColor = isActive
    ? state === "FORWARD"
      ? "#3b82f6"
      : "#f97316"
    : "#475569";
  const bodyFill = isActive ? "#0c4a6e" : "#1e293b";

  const isSideLabel = labelPosition === "left" || labelPosition === "right";
  const sideX =
    labelPosition === "right"
      ? radius + 12
      : labelPosition === "left"
        ? -(radius + 12)
        : 0;
  const tagX = isSideLabel ? sideX : 0;
  const tagY = isSideLabel
    ? 6
    : labelPosition === "top"
      ? -(radius + 12)
      : radius + 22;
  const arrowX = isSideLabel ? sideX : 0;
  const arrowY = isSideLabel
    ? -6
    : labelPosition === "top"
      ? -(radius + 22)
      : radius + 3;
  const textAnchor: "start" | "end" | "middle" =
    labelPosition === "right"
      ? "start"
      : labelPosition === "left"
        ? "end"
        : "middle";

  // 3 rotors at 120° apart
  const rotors = [0, 120, 240].map((angle) => {
    const rad = (angle * Math.PI) / 180;
    const rx = Math.cos(rad) * radius * 0.55;
    const ry = Math.sin(rad) * radius * 0.55;
    return { rx, ry };
  });

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow halo */}
      {isActive && (
        <circle
          cx="0"
          cy="0"
          r={radius + 8}
          fill={stateColor}
          opacity="0.25"
          filter="url(#pump-glow)"
        />
      )}

      {/* Outer housing */}
      <circle
        cx="0"
        cy="0"
        r={radius}
        fill={bodyFill}
        stroke={stateColor}
        strokeWidth="2"
      />

      {/* Inner rotor housing */}
      <circle
        cx="0"
        cy="0"
        r={radius * 0.78}
        fill="none"
        stroke={stateColor}
        strokeWidth="1"
        strokeOpacity="0.5"
      />

      {/* Rotor group — rotates around (0,0) which is the pump center thanks to the parent translate */}
      <g className="pump-rotor">
        {isActive && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={state === "FORWARD" ? "0" : "360"}
            to={state === "FORWARD" ? "360" : "0"}
            dur="2s"
            repeatCount="indefinite"
          />
        )}

        {/* Center hub */}
        <circle cx="0" cy="0" r="4" fill={stateColor} />

        {/* Rotor arms */}
        {rotors.map((r, i) => (
          <g key={i}>
            <line
              x1="0"
              y1="0"
              x2={r.rx}
              y2={r.ry}
              stroke={stateColor}
              strokeWidth="2"
            />
            <circle
              cx={r.rx}
              cy={r.ry}
              r="6"
              fill={isActive ? "#0ea5e9" : "#334155"}
              stroke={stateColor}
              strokeWidth="1.5"
            />
          </g>
        ))}
      </g>

      {/* Direction arrow (small) */}
      {isActive && (
        <text
          x={arrowX}
          y={arrowY}
          textAnchor={textAnchor}
          fill={stateColor}
          fontSize="10"
          fontWeight="bold"
        >
          {state === "FORWARD" ? "▶" : "◀"}
        </text>
      )}

      {tag && (
        <text
          x={tagX}
          y={tagY}
          textAnchor={textAnchor}
          fill="#64748b"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
