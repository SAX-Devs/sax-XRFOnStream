interface PressureSwitchProps {
  x: number;
  y: number;
  /** Boolean reading: true = pressure OK, false = fault. */
  pressureOk: boolean;
  /** Absolute x of the process pipe tap point. */
  connectX?: number;
  /** Absolute y of the process pipe tap point. Defaults to the balloon y (horizontal lead). */
  connectY?: number;
  tag?: string;
  label?: string;
  size?: number;
  labelPosition?: "left" | "right";
}

/**
 * ISA instrument balloon for a pressure switch (boolean output).
 *
 * "PS" = Pressure (P) Switch (S): a discrete instrument that trips on a
 * pressure setpoint, so its reading is a simple OK / fault boolean.
 * Rendered as the standard P&ID balloon connected to the process pipe by a
 * thin lead line, colour-coded green (OK) / red (fault) like the valves.
 */
export function PressureSwitch({
  x,
  y,
  pressureOk,
  connectX,
  connectY,
  tag,
  label,
  size = 30,
  labelPosition = "left",
}: PressureSwitchProps) {
  const r = size / 2;
  const stateColor = pressureOk ? "#10b981" : "#ef4444";
  const statusText = pressureOk ? "OK" : "FAIL";

  // Manometer (pressure gauge) icon geometry — dial centred on a low pivot
  // with a scale arc of ticks over the top and a needle pointing up.
  const pivotY = 5;
  const dialR = 10;
  const tickAngles = [150, 120, 90, 60, 30];

  const colorTransition = {
    transition: "fill 0.4s ease-in-out, stroke 0.4s ease-in-out",
  };

  // Instrument lead — solid thin line from the balloon edge to the pipe tap.
  // Supports diagonal leads when connectY differs from the balloon's y.
  const hasLead = connectX !== undefined;
  const dx = hasLead ? connectX - x : 0;
  const dy = hasLead ? (connectY ?? y) - y : 0;
  const dist = Math.hypot(dx, dy) || 1;
  const bubbleEdgeX = (r * dx) / dist;
  const bubbleEdgeY = (r * dy) / dist;

  // Label / tag sit on the side opposite the lead by default.
  const isLeft = labelPosition === "left";
  const labelX = isLeft ? -(r + 10) : r + 10;
  const labelAnchor: "start" | "end" = isLeft ? "end" : "start";

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Instrument connection (lead) + tap dot on the process pipe */}
      {hasLead && (
        <>
          <line
            x1={bubbleEdgeX}
            y1={bubbleEdgeY}
            x2={dx}
            y2={dy}
            stroke="#64748b"
            strokeWidth="1.5"
          />
          <circle cx={dx} cy={dy} r="3" fill="#64748b" />
        </>
      )}

      {/* Glow halo — pulses when in fault to draw attention */}
      <circle
        cx="0"
        cy="0"
        r={r + 5}
        fill={stateColor}
        opacity="0.25"
        filter="url(#valve-glow)"
        style={colorTransition}
      >
        {!pressureOk && (
          <animate
            attributeName="opacity"
            values="0.15;0.5;0.15"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* ISA balloon */}
      <circle
        cx="0"
        cy="0"
        r={r}
        fill="#0f172a"
        stroke={stateColor}
        strokeWidth="2"
        style={colorTransition}
      />

      {/* Manometer (pressure gauge) icon */}
      <g style={colorTransition}>
        {/* Scale ticks over the top of the dial */}
        {tickAngles.map((a) => {
          const rad = (a * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          return (
            <line
              key={a}
              x1={dialR * cos}
              y1={pivotY - dialR * sin}
              x2={(dialR - 2.5) * cos}
              y2={pivotY - (dialR - 2.5) * sin}
              stroke={stateColor}
              strokeWidth="1"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
          );
        })}

        {/* Needle — points up/slightly right (nominal) */}
        <line
          x1={0}
          y1={pivotY}
          x2={2.6}
          y2={pivotY - 9.7}
          stroke={stateColor}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Pivot hub */}
        <circle cx={0} cy={pivotY} r="2" fill={stateColor} />
      </g>

      {/* Boolean status word below the balloon */}
      <text
        x="0"
        y={r + 13}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.5"
        fill={stateColor}
        style={colorTransition}
      >
        {statusText}
      </text>

      {/* Descriptive label — centred vertically when no tag is shown,
          shifted up when the tag sits below it. */}
      {label && (
        <text
          x={labelX}
          y={tag ? -4 : 3}
          textAnchor={labelAnchor}
          fontSize="11"
          fontWeight="600"
          fill="#e2e8f0"
          fontFamily="ui-sans-serif, system-ui"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
        >
          {label}
        </text>
      )}

      {/* Tag */}
      {tag && (
        <text
          x={labelX}
          y={9}
          textAnchor={labelAnchor}
          fontSize="8"
          fill="#64748b"
          fontFamily="ui-monospace, monospace"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
