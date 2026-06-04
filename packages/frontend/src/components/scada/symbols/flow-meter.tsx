interface FlowMeterProps {
  /** Center x of the inline housing (on the pipe). */
  x: number;
  /** Center y of the inline housing (on the pipe). */
  y: number;
  /** Numeric flow rate to display. */
  flowRate: number;
  /** Unit string (default "L/m"). */
  unit?: string;
  /** Whether the meter shows active flow (drives colour + animation). */
  active?: boolean;
  /** ISA tag (e.g. "FE-101") — caller should gate visibility by role. */
  tag?: string;
  /** Side of the inline housing where the digital display sits. */
  displaySide?: "left" | "right";
}

/**
 * Inline flow meter — a primary element (inline housing with flanges) plus a
 * separate digital display panel that shows the live flow rate. Deliberately
 * different from the ISA-balloon style used for pressure switches so the two
 * sensors read as distinct instrument types at a glance.
 *
 * The housing sits ON the pipe (covering a short section). Inside, paired
 * chevrons animate to suggest flow direction. The display panel shows the
 * numeric value with a small unit and a "FLOW" caption.
 */
export function FlowMeter({
  x,
  y,
  flowRate,
  unit = "L/m",
  active = true,
  tag,
  displaySide = "left",
}: FlowMeterProps) {
  const stateColor = active ? "#22d3ee" : "#64748b";
  const valueColor = active ? "#67e8f9" : "#94a3b8";
  const isLeft = displaySide === "left";
  const dispX = isLeft ? x - 64 : x + 13;
  const dispW = 51;

  const colorTrans = {
    transition: "stroke 0.4s ease-in-out, fill 0.4s ease-in-out",
  };

  return (
    <g>
      {/* Pipe flanges (entrance + exit of the meter) */}
      <line
        x1={x - 13}
        y1={y - 11}
        x2={x + 13}
        y2={y - 11}
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1={x - 13}
        y1={y + 11}
        x2={x + 13}
        y2={y + 11}
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Housing body */}
      <rect
        x={x - 11}
        y={y - 11}
        width="22"
        height="22"
        rx="2"
        fill="#0b1220"
        stroke={stateColor}
        strokeWidth="1.5"
        style={colorTrans}
      />

      {/* Flow direction chevrons — top + bottom, alternating opacity to flow */}
      <path
        d={`M ${x - 5} ${y - 6} L ${x} ${y - 1} L ${x + 5} ${y - 6}`}
        fill="none"
        stroke={stateColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.45"
        style={colorTrans}
      >
        {active && (
          <animate
            attributeName="opacity"
            values="0.25;0.85;0.25"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <path
        d={`M ${x - 5} ${y - 1} L ${x} ${y + 4} L ${x + 5} ${y - 1}`}
        fill="none"
        stroke={stateColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.45"
        style={colorTrans}
      >
        {active && (
          <animate
            attributeName="opacity"
            values="0.85;0.25;0.85"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* Signal line from meter to display */}
      <line
        x1={isLeft ? x - 13 : x + 13}
        y1={y}
        x2={isLeft ? dispX + dispW : dispX}
        y2={y}
        stroke="#64748b"
        strokeWidth="0.9"
        strokeDasharray="2 1.5"
      />

      {/* Digital display housing */}
      <rect
        x={dispX}
        y={y - 14}
        width={dispW}
        height="28"
        rx="3"
        fill="#020617"
        stroke={stateColor}
        strokeWidth="1.2"
        style={colorTrans}
      />

      {/* "FLOW" caption */}
      <text
        x={dispX + 6}
        y={y - 5}
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="0.8"
        fill="#64748b"
        fontFamily="ui-sans-serif, system-ui"
      >
        FLOW
      </text>

      {/* Live value */}
      <text
        x={dispX + 6}
        y={y + 9}
        fontSize="13"
        fontWeight="700"
        fill={valueColor}
        fontFamily="ui-monospace, monospace"
        style={colorTrans}
      >
        {flowRate.toFixed(1)}
      </text>

      {/* Unit (right-aligned inside the display) */}
      <text
        x={dispX + dispW - 4}
        y={y + 9}
        textAnchor="end"
        fontSize="6.5"
        fill="#64748b"
        fontFamily="ui-sans-serif, system-ui"
      >
        {unit}
      </text>

      {/* ISA tag (passed in by caller, typically only in Service mode) */}
      {tag && (
        <text
          x={x}
          y={y + 22}
          textAnchor="middle"
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
