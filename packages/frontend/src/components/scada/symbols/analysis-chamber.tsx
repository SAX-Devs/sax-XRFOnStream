interface AnalysisChamberProps {
  x: number;
  y: number;
  width: number;
  height: number;
  tag?: string;
  /** Current interchanger mode — drives the inner visualisation. */
  interchangerMode: "NORMAL" | "RECAL";
  /** Whether the sample pump is delivering — gates the in-chamber flow animation. */
  pumping?: boolean;
}

/**
 * Outer "cámara de análisis" — the process side where the sample (or water)
 * flows in (top) and out (bottom), facing the internal chamber across the
 * honeycomb window.
 *
 * Inside the chamber:
 *  - A subtle fluid tint shows the sample present.
 *  - Animated cyan particles travel top→bottom as a "sight glass" of the
 *    sample flowing past the window (NORMAL mode + pump on).
 *  - A cyan halo at the right edge highlights the measurement zone where
 *    the radiation reaches the sample through the honeycomb window.
 *
 * In RECAL mode the sample flow visualisation fades and the recalibration
 * target on the interchanger arm takes over the measurement zone.
 */
export function AnalysisChamber({
  x,
  y,
  width,
  height,
  tag,
  interchangerMode,
  pumping = true,
}: AnalysisChamberProps) {
  const cx = x + width / 2;
  const normalMode = interchangerMode === "NORMAL";
  const showFlow = normalMode && pumping;
  const zoneX = x + width - 12;
  const zoneY = y + height / 2;

  return (
    <g>
      {/* Chamber body */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="6"
        fill="#0f172a"
        stroke="#64748b"
        strokeWidth="1.5"
      />

      {/* Fluid tint — subtle cyan when the chamber holds flowing sample */}
      <rect
        x={x + 5}
        y={y + 5}
        width={width - 10}
        height={height - 10}
        rx="4"
        fill="#22d3ee"
        opacity={normalMode ? "0.07" : "0"}
        style={{ transition: "opacity 0.5s ease-in-out" }}
      />

      {/* Inner accent border */}
      <rect
        x={x + 3}
        y={y + 3}
        width={width - 6}
        height={height - 6}
        rx="4"
        fill="none"
        stroke="#1e293b"
        strokeWidth="1"
      />

      {/* Recalibration arm port — sealed opening on the left wall at mid-height */}
      <g>
        {/* Port flange */}
        <rect
          x={x - 5}
          y={y + height / 2 - 13}
          width="13"
          height="26"
          rx="2"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="1.1"
        />
        {/* Slot opening for the arm */}
        <rect
          x={x - 3}
          y={y + height / 2 - 3}
          width="9"
          height="6"
          rx="0.5"
          fill="#020617"
          stroke="#475569"
          strokeWidth="0.5"
        />
        {/* Mounting bolts at the corners */}
        <circle cx={x - 2} cy={y + height / 2 - 9.5} r="0.85" fill="#94a3b8" />
        <circle cx={x + 5} cy={y + height / 2 - 9.5} r="0.85" fill="#94a3b8" />
        <circle cx={x - 2} cy={y + height / 2 + 9.5} r="0.85" fill="#94a3b8" />
        <circle cx={x + 5} cy={y + height / 2 + 9.5} r="0.85" fill="#94a3b8" />
      </g>

      {/* Flow particles — sample is routed past the window: enters top centre,
          arcs right toward the measurement zone, and returns to the bottom outlet.
          The quadratic curve's midpoint lands on the measurement zone (≈ x+width-12, y+height/2). */}
      {showFlow && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              r="2.4"
              fill="#22d3ee"
              filter="url(#particle-glow)"
            >
              <animateMotion
                dur="2.6s"
                repeatCount="indefinite"
                begin={`-${(i * 2.6) / 4}s`}
                path={`M ${cx} ${y + 8} Q ${cx + 110} ${y + height / 2} ${cx} ${y + height - 8}`}
              />
            </circle>
          ))}
        </>
      )}

      {/* Measurement zone — where the radiation meets the sample/target */}
      <g
        style={{ transition: "opacity 0.5s ease-in-out" }}
        opacity={normalMode ? 1 : 0.2}
      >
        <circle
          cx={zoneX}
          cy={zoneY}
          r="11"
          fill="#22d3ee"
          opacity="0.22"
          filter="url(#detector-glow)"
        />
        <circle
          cx={zoneX}
          cy={zoneY}
          r="5"
          fill="#22d3ee"
          opacity="0.45"
        />
      </g>

      {/* Inlet nozzle (top centre) */}
      <rect
        x={cx - 5}
        y={y - 5}
        width="10"
        height="6"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />
      {/* Outlet nozzle (bottom centre) */}
      <rect
        x={cx - 5}
        y={y + height - 1}
        width="10"
        height="6"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />

      {/* Title */}
      <text
        x={cx}
        y={y + 15}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1"
        fill="#cbd5e1"
        fontFamily="ui-sans-serif, system-ui"
      >
        ANALYSIS CHAMBER
      </text>

      {/* Tag */}
      {tag && (
        <text
          x={cx}
          y={y + height + 14}
          textAnchor="middle"
          fontSize="9"
          fill="#64748b"
          fontFamily="ui-monospace, monospace"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
