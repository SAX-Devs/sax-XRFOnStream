interface ChamberLeakSensorProps {
  /** Center x of the probe (where it passes through the chamber wall). */
  x: number;
  /** y of the chamber wall (the probe enters here). */
  y: number;
  /** true = sensor dry (chamber OK). false = wet (leak detected, emergency). */
  dry: boolean;
  tag?: string;
}

/**
 * Chamber leak sensor — a two-prong conductivity probe inserted through the
 * chamber wall. The chamber it watches is meant to stay dry; if water bridges
 * the electrodes the boolean flips to false and the X-ray HV must be
 * inhibited as an emergency response (handled by the parent diagram).
 *
 * Visual: two short vertical electrodes inside the chamber, a wall pass-thru
 * fitting at the wall, a short cable going out and a junction terminal with
 * a status LED. Slate when dry, pulsing red with a "wet drop" between the
 * electrodes when wet.
 */
export function ChamberLeakSensor({
  x,
  y,
  dry,
  tag,
}: ChamberLeakSensorProps) {
  const probeColor = dry ? "#94a3b8" : "#ef4444";
  const ledColor = dry ? "#10b981" : "#ef4444";
  const colorTrans = {
    transition: "stroke 0.4s ease-in-out, fill 0.4s ease-in-out",
  };

  return (
    <g>
      {/* Alarm halo around the junction when wet */}
      {!dry && (
        <circle
          cx={x}
          cy={y + 18}
          r="9"
          fill="#ef4444"
          opacity="0.25"
          filter="url(#valve-glow)"
        >
          <animate
            attributeName="opacity"
            values="0.15;0.5;0.15"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Electrodes inside the chamber — two short vertical wires */}
      <line
        x1={x - 2.2}
        y1={y - 12}
        x2={x - 2.2}
        y2={y - 1}
        stroke={probeColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        style={colorTrans}
      />
      <line
        x1={x + 2.2}
        y1={y - 12}
        x2={x + 2.2}
        y2={y - 1}
        stroke={probeColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        style={colorTrans}
      />

      {/* "Wet drop" — water bridge between the electrodes when in alarm */}
      {!dry && (
        <ellipse cx={x} cy={y - 4.5} rx="2.6" ry="1.6" fill="#ef4444" opacity="0.85">
          <animate
            attributeName="opacity"
            values="0.55;0.95;0.55"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </ellipse>
      )}

      {/* Wall pass-through fitting */}
      <rect
        x={x - 5}
        y={y - 1}
        width="10"
        height="4"
        rx="0.5"
        fill="#334155"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />

      {/* External cable going down to the junction */}
      <line
        x1={x}
        y1={y + 3}
        x2={x}
        y2={y + 14}
        stroke={probeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={colorTrans}
      />

      {/* Junction terminal box */}
      <rect
        x={x - 5}
        y={y + 14}
        width="10"
        height="8"
        rx="1"
        fill="#0f172a"
        stroke={ledColor}
        strokeWidth="1.2"
        style={colorTrans}
      />

      {/* Status LED inside the junction — pulses when wet */}
      <circle cx={x} cy={y + 18} r="1.6" fill={ledColor} style={colorTrans}>
        {!dry && (
          <animate
            attributeName="r"
            values="1.2;2.5;1.2"
            dur="1s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Tag (only when showTags is true, passed in by parent) */}
      {tag && (
        <text
          x={x + 8}
          y={y + 21}
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
