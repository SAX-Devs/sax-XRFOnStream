interface InterchangerBlockProps {
  x: number;
  y: number;
  position: "Chamber" | "Brine" | "Recal" | string;
  tag?: string;
}

/**
 * Mechanical 2-position rotary sample changer.
 *
 * Visual: motor on top → drive shaft → cylindrical housing with rotating
 * disc inside. The disc holds two sample cells (Sample / Reference) that
 * physically rotate between the active position (top, where the X-ray
 * field is) and the parked position (bottom).
 *
 * Width 60, height 80. Connection port on the right edge at vertical
 * centre (y+40 absolute).
 */
export function InterchangerBlock({
  x,
  y,
  position,
  tag,
}: InterchangerBlockProps) {
  const isChamberMode = position === "Chamber";
  const sampleColor = "#10b981"; // emerald — process sample chamber
  const referenceColor = "#fbbf24"; // amber — calibration reference
  const activeColor = isChamberMode ? sampleColor : referenceColor;
  // Disc rotates 180° between the two positions
  const discRotation = isChamberMode ? 0 : 180;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Component title — sits above the motor */}
      <text
        x="30"
        y="-10"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.5"
        fill="#cbd5e1"
        fontFamily="ui-sans-serif, system-ui"
      >
        INTERCHANGER
      </text>

      {/* Motor housing on top */}
      <rect
        x="22"
        y="0"
        width="16"
        height="7"
        rx="1.5"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.8"
      />
      <line x1="25" y1="2.5" x2="35" y2="2.5" stroke="#1e293b" strokeWidth="0.5" />
      <line x1="25" y1="4.5" x2="35" y2="4.5" stroke="#1e293b" strokeWidth="0.5" />

      {/* Drive shaft from motor to disc */}
      <line x1="30" y1="7" x2="30" y2="17" stroke="#64748b" strokeWidth="2.5" />
      <line
        x1="30"
        y1="7"
        x2="30"
        y2="17"
        stroke="#cbd5e1"
        strokeWidth="0.6"
        strokeOpacity="0.5"
      />

      {/* Outer housing circle */}
      <circle
        cx="30"
        cy="40"
        r="22"
        fill="#1e293b"
        stroke="#94a3b8"
        strokeWidth="1.5"
      />

      {/* Inner disc track (visual hint of rotation path) */}
      <circle
        cx="30"
        cy="40"
        r="17"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="0.6"
        strokeDasharray="3 2"
        strokeOpacity="0.6"
      />

      {/* Active position indicator — fixed triangle pointing into the disc top.
          Whichever chamber is at the top is the one currently being measured. */}
      <path
        d="M 30 18 L 26 24 L 34 24 Z"
        fill={activeColor}
        opacity="0.85"
        style={{ transition: "fill 0.4s" }}
      />

      {/* Rotating disc — the two sample cells swap places when position changes */}
      <g
        transform={`rotate(${discRotation} 30 40)`}
        style={{ transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        {/* Sample chamber (process fluid) */}
        <rect
          x="24"
          y="25"
          width="12"
          height="8"
          rx="1.5"
          fill={sampleColor}
          stroke={sampleColor}
          strokeWidth="1"
          opacity="0.95"
        />
        <line
          x1="26"
          y1="29"
          x2="34"
          y2="29"
          stroke="#0f172a"
          strokeWidth="0.6"
          opacity="0.7"
        />

        {/* Reference chamber (calibration standard) */}
        <rect
          x="24"
          y="47"
          width="12"
          height="8"
          rx="1.5"
          fill={referenceColor}
          stroke={referenceColor}
          strokeWidth="1"
          opacity="0.95"
        />
        <line
          x1="26"
          y1="51"
          x2="34"
          y2="51"
          stroke="#0f172a"
          strokeWidth="0.6"
          opacity="0.7"
        />
      </g>

      {/* Center hub (rotation pivot) */}
      <circle cx="30" cy="40" r="3.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="0.8" />
      <circle cx="30" cy="40" r="1.5" fill="#0f172a" />

      {/* Connection port — right side, where the pipe to the Detector enters */}
      <rect
        x="52"
        y="38"
        width="8"
        height="4"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.5"
      />

      {/* Position label below the housing */}
      <text
        x="30"
        y="74"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill={activeColor}
        letterSpacing="0.5"
        style={{ transition: "fill 0.4s" }}
      >
        {position.toUpperCase()}
      </text>

      {/* Tag below the symbol bounds */}
      {tag && (
        <text
          x="30"
          y="93"
          textAnchor="middle"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          fill="#64748b"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
