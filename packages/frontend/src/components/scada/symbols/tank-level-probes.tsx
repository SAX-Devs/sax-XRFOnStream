interface TankLevelProbesProps {
  /** Geometry of the tank these probes are mounted inside. */
  tankX: number;
  tankY: number;
  tankWidth: number;
  tankHeight: number;
  /** tank_level_ok — true = within normal range, false = exceeded high limit. */
  levelOk: boolean;
  /** tank_percentage_level — discrete fill reading: 0 | 50 | 100. */
  percentLevel: number;
  ellipseRy?: number;
}

/**
 * Two measuring probes inside a tank:
 *  1. High-level switch  → boolean tank_level_ok (green OK / red exceeded).
 *  2. Graduated level rod → discrete tank_percentage_level (0 / 50 / 100).
 *
 * Drawn as an overlay positioned over a TankCylinder, so only the tanks that
 * are actually instrumented carry the probes.
 */
export function TankLevelProbes({
  tankX,
  tankY,
  tankWidth,
  tankHeight,
  levelOk,
  percentLevel,
  ellipseRy = 8,
}: TankLevelProbesProps) {
  const interiorTop = tankY + ellipseRy;
  const interiorBottom = tankY + tankHeight - ellipseRy;
  const range = interiorBottom - interiorTop;

  const leftX = tankX + 30; // level-switch probe
  const rightX = tankX + tankWidth - 30; // graduated % probe
  const cx = tankX + tankWidth / 2;

  const levelColor = levelOk ? "#10b981" : "#ef4444";
  const pctColor = "#22d3ee";

  // High limit sits near the top of the tank (switch trips when fluid exceeds it)
  const limitY = interiorBottom - range * 0.85;

  // Map a percentage to a y inside the tank
  const markY = (p: number) => interiorBottom - range * (p / 100);
  const grads = [0, 50, 100];

  const colorTransition = { transition: "fill 0.4s ease-in-out, stroke 0.4s ease-in-out" };

  return (
    <g>
      {/* === High-limit reference line (MÁX) === */}
      <line
        x1={tankX + 8}
        y1={limitY}
        x2={tankX + tankWidth - 8}
        y2={limitY}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="4 3"
        strokeOpacity="0.6"
      />
      <text
        x={tankX + tankWidth - 6}
        y={limitY - 4}
        textAnchor="end"
        fontSize="8"
        fontWeight="700"
        letterSpacing="1"
        fill="#e2e8f0"
        fontFamily="ui-monospace, monospace"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
      >
        MAX
      </text>

      {/* === Probe 1 — high-level switch (tank_level_ok) === */}
      {/* Mounting head on the lid */}
      <rect
        x={leftX - 4}
        y={tankY - 2}
        width="8"
        height="6"
        rx="1"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />
      {/* Rod down to the sensing point */}
      <line
        x1={leftX}
        y1={tankY + 4}
        x2={leftX}
        y2={limitY}
        stroke={levelColor}
        strokeWidth="1.6"
        style={colorTransition}
      />
      {/* Sensor glow — pulses on fault */}
      <circle
        cx={leftX}
        cy={limitY}
        r="7"
        fill={levelColor}
        opacity="0.25"
        filter="url(#valve-glow)"
        style={colorTransition}
      >
        {!levelOk && (
          <animate
            attributeName="opacity"
            values="0.15;0.5;0.15"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      {/* Sensor disc */}
      <circle
        cx={leftX}
        cy={limitY}
        r="3.5"
        fill={levelColor}
        stroke="#0f172a"
        strokeWidth="0.6"
        style={colorTransition}
      />

      {/* === Probe 2 — graduated % level (tank_percentage_level) === */}
      <rect
        x={rightX - 4}
        y={tankY - 2}
        width="8"
        height="6"
        rx="1"
        fill="#475569"
        stroke="#94a3b8"
        strokeWidth="0.6"
      />
      <line
        x1={rightX}
        y1={tankY + 4}
        x2={rightX}
        y2={interiorBottom}
        stroke="#94a3b8"
        strokeWidth="1.4"
      />
      {/* Graduation ticks (0 / 50 / 100) — active one highlighted */}
      {grads.map((p) => {
        const active = p === percentLevel;
        return (
          <line
            key={p}
            x1={rightX - 6}
            y1={markY(p)}
            x2={rightX}
            y2={markY(p)}
            stroke={active ? pctColor : "#64748b"}
            strokeWidth={active ? 2 : 1}
            style={colorTransition}
          />
        );
      })}
      {/* Current-level marker — triangle pointing at the active graduation */}
      <path
        d={`M ${rightX - 11} ${markY(percentLevel) - 3.5} L ${rightX - 11} ${markY(percentLevel) + 3.5} L ${rightX - 5} ${markY(percentLevel)} Z`}
        fill={pctColor}
        style={{ transition: "all 0.4s ease-in-out" }}
      />

      {/* === Readouts below the tank === */}
      <text
        x={cx}
        y={tankY + tankHeight + 30}
        textAnchor="middle"
        fontSize="9"
        fontFamily="ui-sans-serif, system-ui"
      >
        <tspan fill="#94a3b8">Level: </tspan>
        <tspan fill={levelColor} fontWeight="700">
          {levelOk ? "OK" : "HIGH"}
        </tspan>
      </text>
      <text
        x={cx}
        y={tankY + tankHeight + 45}
        textAnchor="middle"
        fontSize="9"
        fontFamily="ui-sans-serif, system-ui"
      >
        <tspan fill="#94a3b8">Fill: </tspan>
        <tspan fill={pctColor} fontWeight="700">
          {percentLevel}%
        </tspan>
      </text>
    </g>
  );
}
