interface InterchangerArmProps {
  /** Pivot axis (upper-left of the analysis chamber). */
  pivotX: number;
  pivotY: number;
  /** Recal-sample position when the arm is in front of the window (RECAL mode). */
  recalTipX: number;
  recalTipY: number;
  /** Degrees the arm rotates from RECAL to the parked NORMAL position. */
  parkRotation: number;
  mode: "NORMAL" | "RECAL";
  tag?: string;
}

/**
 * The interchanger: a pivoting arm carrying the recalibration sample.
 *  - NORMAL: arm parked away → the flowing sample passes the window.
 *  - RECAL : arm swung so the recalibration sample sits in front of the window
 *            (in the radiation path), replacing the sample.
 * The arm is drawn in its RECAL pose and rotated around the pivot for NORMAL.
 */
export function InterchangerArm({
  pivotX,
  pivotY,
  recalTipX,
  recalTipY,
  parkRotation,
  mode,
  tag,
}: InterchangerArmProps) {
  const rotation = mode === "RECAL" ? 0 : parkRotation;
  const recalActive = mode === "RECAL";

  return (
    <g>
      {/* Pivot mount housing — bearing enclosure with bolted plate */}
      <rect
        x={pivotX - 6}
        y={pivotY - 8}
        width="20"
        height="16"
        rx="2.5"
        fill="#1e293b"
        stroke="#94a3b8"
        strokeWidth="0.9"
      />
      <circle cx={pivotX - 4} cy={pivotY - 5.5} r="0.85" fill="#475569" />
      <circle cx={pivotX + 12} cy={pivotY - 5.5} r="0.85" fill="#475569" />
      <circle cx={pivotX - 4} cy={pivotY + 5.5} r="0.85" fill="#475569" />
      <circle cx={pivotX + 12} cy={pivotY + 5.5} r="0.85" fill="#475569" />

      {/* Rotating arm + recalibration sample — CSS transform so the rotation
          can be transitioned smoothly between NORMAL/RECAL poses. */}
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${pivotX}px ${pivotY}px`,
          transition: "transform 2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Arm bar — base shadow */}
        <line
          x1={pivotX}
          y1={pivotY}
          x2={recalTipX}
          y2={recalTipY}
          stroke="#0f172a"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Arm bar — main body */}
        <line
          x1={pivotX}
          y1={pivotY}
          x2={recalTipX}
          y2={recalTipY}
          stroke="#475569"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Arm bar — mid highlight band */}
        <line
          x1={pivotX}
          y1={pivotY}
          x2={recalTipX}
          y2={recalTipY}
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.6"
        />
        {/* Arm bar — top ridge */}
        <line
          x1={pivotX}
          y1={pivotY}
          x2={recalTipX}
          y2={recalTipY}
          stroke="#e2e8f0"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />

        {/* Signal/power cable running along the arm */}
        <line
          x1={pivotX + 6}
          y1={pivotY + 2.8}
          x2={recalTipX - 13}
          y2={recalTipY + 2.8}
          stroke="#f97316"
          strokeWidth="0.7"
          strokeOpacity="0.75"
          strokeLinecap="round"
        />

        {/* Wrist mounting flange — connects arm to recal target */}
        <rect
          x={recalTipX - 13}
          y={recalTipY - 7}
          width="5"
          height="14"
          rx="1"
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="0.7"
        />
        <circle cx={recalTipX - 10.5} cy={recalTipY - 4} r="0.7" fill="#94a3b8" />
        <circle cx={recalTipX - 10.5} cy={recalTipY + 4} r="0.7" fill="#94a3b8" />

        {/* Recalibration target glow halo — fades in/out with mode so the
            light doesn't pop the moment rotation starts. */}
        <rect
          x={recalTipX - 10}
          y={recalTipY - 10}
          width="20"
          height="20"
          rx="3"
          fill="#fbbf24"
          opacity={recalActive ? 0.25 : 0}
          filter="url(#valve-glow)"
          style={{ transition: "opacity 1.2s ease-in-out" }}
        />
        <rect
          x={recalTipX - 7}
          y={recalTipY - 7}
          width="14"
          height="14"
          rx="2"
          fill="#451a03"
          stroke="#fbbf24"
          strokeWidth="1.5"
        />
        <line
          x1={recalTipX - 7}
          y1={recalTipY}
          x2={recalTipX + 7}
          y2={recalTipY}
          stroke="#fbbf24"
          strokeWidth="0.7"
          strokeOpacity="0.8"
        />
        <line
          x1={recalTipX}
          y1={recalTipY - 7}
          x2={recalTipX}
          y2={recalTipY + 7}
          stroke="#fbbf24"
          strokeWidth="0.7"
          strokeOpacity="0.8"
        />
      </g>

      {/* Pivot bearing — visible at the rotation centre on top of the arm */}
      <circle
        cx={pivotX}
        cy={pivotY}
        r="4.5"
        fill="#94a3b8"
        stroke="#0f172a"
        strokeWidth="1"
      />
      <circle
        cx={pivotX}
        cy={pivotY}
        r="2.5"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="0.6"
      />
      <circle cx={pivotX} cy={pivotY} r="1" fill="#cbd5e1" />

      {/* Tag — placed above the mount housing */}
      {tag && (
        <text
          x={pivotX - 8}
          y={pivotY - 13}
          textAnchor="end"
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
