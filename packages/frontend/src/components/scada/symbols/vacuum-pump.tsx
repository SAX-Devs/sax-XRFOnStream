interface VacuumPumpProps {
  x: number;
  y: number;
  isActive: boolean;
  number: 1 | 2;
  size?: number;
  tag?: string;
  labelPosition?: "top" | "bottom" | "left" | "right";
}

export function VacuumPump({
  x,
  y,
  isActive,
  number,
  size = 44,
  tag,
  labelPosition = "bottom",
}: VacuumPumpProps) {
  const radius = size / 2;
  const stateColor = isActive ? "#a855f7" : "#475569";
  const bodyFill = isActive ? "#3b0764" : "#1e293b";

  const isSideLabel = labelPosition === "left" || labelPosition === "right";
  const tagX =
    labelPosition === "right"
      ? radius + 8
      : labelPosition === "left"
        ? -(radius + 8)
        : 0;
  const tagY = isSideLabel
    ? 4
    : labelPosition === "top"
      ? -(radius + 8)
      : radius + 14;
  const tagAnchor: "start" | "end" | "middle" =
    labelPosition === "right"
      ? "start"
      : labelPosition === "left"
        ? "end"
        : "middle";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow halo */}
      {isActive && (
        <circle
          cx="0"
          cy="0"
          r={radius + 6}
          fill={stateColor}
          opacity="0.25"
          filter="url(#pump-glow)"
        />
      )}

      {/* Pulsing rings — vacuum waves expanding outward */}
      {isActive && (
        <>
          <circle cx="0" cy="0" r={radius} fill="none" stroke={stateColor} strokeWidth="1.5">
            <animate
              attributeName="r"
              values={`${radius};${radius + 14}`}
              dur="1.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.7;0"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="0" cy="0" r={radius} fill="none" stroke={stateColor} strokeWidth="1.5">
            <animate
              attributeName="r"
              values={`${radius};${radius + 14}`}
              dur="1.8s"
              begin="-0.9s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.7;0"
              dur="1.8s"
              begin="-0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </>
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

      {/* Inner detail circle */}
      <circle
        cx="0"
        cy="0"
        r={radius * 0.7}
        fill="none"
        stroke={stateColor}
        strokeWidth="1"
        strokeOpacity="0.5"
      />

      {/* Suction arrow (downward) */}
      <path
        d={`M 0,${-radius * 0.5} L 0,${radius * 0.4} M ${-radius * 0.25},${radius * 0.15} L 0,${radius * 0.4} L ${radius * 0.25},${radius * 0.15}`}
        fill="none"
        stroke={stateColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Number badge */}
      <circle
        cx={radius * 0.7}
        cy={-radius * 0.7}
        r="7"
        fill="#0f172a"
        stroke={stateColor}
        strokeWidth="1.5"
      />
      <text
        x={radius * 0.7}
        y={-radius * 0.7 + 3}
        textAnchor="middle"
        fill={stateColor}
        fontSize="9"
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        {number}
      </text>

      {tag && (
        <text
          x={tagX}
          y={tagY}
          textAnchor={tagAnchor}
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
