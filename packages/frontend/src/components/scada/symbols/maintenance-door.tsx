interface MaintenanceDoorProps {
  /** Top-left corner of the closed door (this is also the hinge point). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** true = door sealed (X-rays may operate). false = open for maintenance. */
  closed: boolean;
  /** Degrees the door rotates open (clockwise around its top-left hinge). */
  openAngle?: number;
}

/**
 * Maintenance access panel for the X-ray equipment housing. When the door is
 * open the X-ray tube must be inhibited (handled in the parent diagram by
 * gating the effective HV state).
 *
 * Closed → solid panel with bolts and a handle, slate with a subtle green
 * accent, looking like a flush structural panel.
 * Open   → the panel tilts down on its top-left hinge, stroke turns red and
 * dashed, and a pulsing red halo flags the alarm. A dark "void" is exposed
 * underneath so the absence of the panel reads at a glance.
 */
export function MaintenanceDoor({
  x,
  y,
  width,
  height,
  closed,
  openAngle = 30,
}: MaintenanceDoorProps) {
  const accentColor = closed ? "#10b981" : "#ef4444";
  const strokeColor = closed ? "#475569" : "#ef4444";

  return (
    <g>
      {/* Alarm halo when the door is open */}
      {!closed && (
        <rect
          x={x - 3}
          y={y - 3}
          width={width + 6}
          height={height + 6}
          rx="2"
          fill="#ef4444"
          opacity="0.18"
          filter="url(#valve-glow)"
        >
          <animate
            attributeName="opacity"
            values="0.12;0.35;0.12"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Door opening (the dark void behind the panel, visible when open) */}
      {!closed && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx="1.5"
          fill="#020617"
          stroke="#1e293b"
          strokeWidth="0.5"
        />
      )}

      {/* Door panel — rotates around the top-left hinge when open */}
      <g
        transform={`rotate(${closed ? 0 : openAngle} ${x} ${y})`}
        style={{ transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)" }}
      >
        {/* Panel body */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx="1.5"
          fill="#1e293b"
          stroke={strokeColor}
          strokeWidth={closed ? "1" : "1.5"}
          strokeDasharray={closed ? "0" : "4 2"}
          style={{
            transition: "stroke 0.4s ease-in-out, stroke-width 0.4s ease-in-out",
          }}
        />
        {/* Bolts at the corners */}
        <circle cx={x + 6} cy={y + 3} r="0.9" fill="#475569" />
        <circle cx={x + width - 6} cy={y + 3} r="0.9" fill="#475569" />
        <circle cx={x + 6} cy={y + height - 3} r="0.9" fill="#475569" />
        <circle cx={x + width - 6} cy={y + height - 3} r="0.9" fill="#475569" />
        {/* Handle / grip in the middle */}
        <rect
          x={x + width / 2 - 5}
          y={y + height / 2 - 0.9}
          width="10"
          height="1.8"
          rx="0.6"
          fill={accentColor}
          style={{ transition: "fill 0.4s ease-in-out" }}
        />
      </g>

      {/* Hinge pin (visible at the rotation point) */}
      <circle
        cx={x}
        cy={y}
        r="1.6"
        fill="#94a3b8"
        stroke="#0f172a"
        strokeWidth="0.4"
      />
    </g>
  );
}
