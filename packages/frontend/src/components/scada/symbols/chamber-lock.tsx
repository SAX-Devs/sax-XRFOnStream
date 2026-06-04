interface ChamberLockProps {
  x: number;
  y: number;
  /** true = chamber sealed (X-rays may operate). false = open (interlock active). */
  locked: boolean;
  /** Absolute coords of the chamber surface to draw the instrument lead to. */
  connectX?: number;
  connectY?: number;
  tag?: string;
  label?: string;
  size?: number;
  /** Which side of the balloon the descriptive label/tag sit on. */
  labelPosition?: "left" | "right";
}

/**
 * Chamber lock safety interlock — detects whether the analysis chamber is
 * sealed for the interchanger arm exchange. When unlocked (false), the X-ray
 * tube must be electrically inhibited; the diagram conveys this by gating the
 * tube's effective HV outside this component.
 *
 * Drawn as an ISA instrument balloon containing a padlock whose shackle
 * visibly lifts when open. Colour-coded green (LOCKED) / red (UNLOCKED),
 * with a pulsing halo to attract attention when the interlock is active.
 */
export function ChamberLock({
  x,
  y,
  locked,
  connectX,
  connectY,
  tag,
  label,
  size = 30,
  labelPosition = "right",
}: ChamberLockProps) {
  const r = size / 2;
  const stateColor = locked ? "#10b981" : "#ef4444";
  const colorTransition = {
    transition: "fill 0.4s ease-in-out, stroke 0.4s ease-in-out",
  };

  const isLeft = labelPosition === "left";
  const labelX = isLeft ? -(r + 10) : r + 10;
  const labelAnchor: "start" | "end" = isLeft ? "end" : "start";

  // Instrument lead from the balloon edge nearest the chamber, ending on the wall
  const hasLead = connectX !== undefined && connectY !== undefined;
  const dx = hasLead ? connectX - x : 0;
  const dy = hasLead ? connectY - y : 0;
  const dist = Math.hypot(dx, dy) || 1;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Instrument lead + tap dot on the chamber */}
      {hasLead && (
        <>
          <line
            x1={(r * dx) / dist}
            y1={(r * dy) / dist}
            x2={dx}
            y2={dy}
            stroke="#64748b"
            strokeWidth="1.5"
          />
          <circle cx={dx} cy={dy} r="3" fill="#64748b" />
        </>
      )}

      {/* Glow halo — pulses while unlocked */}
      <circle
        cx="0"
        cy="0"
        r={r + 5}
        fill={stateColor}
        opacity="0.25"
        filter="url(#valve-glow)"
        style={colorTransition}
      >
        {!locked && (
          <animate
            attributeName="opacity"
            values="0.15;0.55;0.15"
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

      {/* Padlock icon — shackle rotates around its left attachment when open */}
      <g style={colorTransition}>
        <g
          transform={locked ? "rotate(0 -3 0)" : "rotate(-32 -3 0)"}
          style={{ transition: "transform 0.4s ease-in-out" }}
        >
          <path
            d="M -3 0 L -3 -3.5 A 3 3 0 0 1 3 -3.5 L 3 0"
            fill="none"
            stroke={stateColor}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
        {/* Padlock body */}
        <rect
          x="-5"
          y="0"
          width="10"
          height="8"
          rx="1.5"
          fill={stateColor}
          opacity="0.9"
        />
        {/* Keyhole */}
        <circle cx="0" cy="3" r="1" fill="#0f172a" />
        <rect x="-0.5" y="3.3" width="1" height="2.7" fill="#0f172a" />
      </g>

      {/* Descriptive label */}
      {label && (
        <text
          x={labelX}
          y={tag ? -3 : 3}
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
