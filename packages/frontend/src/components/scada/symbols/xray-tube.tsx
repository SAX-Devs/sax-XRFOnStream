interface XrayTubeProps {
  x: number;
  y: number;
  hvOn: boolean;
  width?: number;
  height?: number;
  tag?: string;
}

export function XrayTube({
  x,
  y,
  hvOn,
  width = 90,
  height = 60,
  tag,
}: XrayTubeProps) {
  const stateColor = hvOn ? "#fbbf24" : "#475569";
  const bodyFill = hvOn ? "#451a03" : "#1e293b";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id="xray-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor={bodyFill} />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id="xray-beam" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde047" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow halo when HV on */}
      {hvOn && (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2 + 12}
          ry={height / 2 + 8}
          fill={stateColor}
          opacity="0.2"
          filter="url(#generator-glow)"
        />
      )}

      {/* Outer housing */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="6"
        fill="url(#xray-body)"
        stroke={stateColor}
        strokeWidth="1.5"
      />

      {/* Cathode (left side) */}
      <rect
        x="6"
        y={height / 2 - 10}
        width="14"
        height="20"
        rx="2"
        fill="#1e293b"
        stroke={stateColor}
        strokeWidth="1"
      />
      <line
        x1="9"
        y1={height / 2 - 6}
        x2="17"
        y2={height / 2 - 6}
        stroke={stateColor}
        strokeWidth="1"
      />
      <line
        x1="9"
        y1={height / 2}
        x2="17"
        y2={height / 2}
        stroke={stateColor}
        strokeWidth="1"
      />
      <line
        x1="9"
        y1={height / 2 + 6}
        x2="17"
        y2={height / 2 + 6}
        stroke={stateColor}
        strokeWidth="1"
      />

      {/* Tube body — narrowing to anode */}
      <path
        d={`M 22,${height / 2 - 8} L ${width - 22},${height / 2 - 4} L ${width - 22},${height / 2 + 4} L 22,${height / 2 + 8} Z`}
        fill={hvOn ? "#7c2d12" : "#1e293b"}
        stroke={stateColor}
        strokeWidth="1"
      />

      {/* Anode (right side) — angled target */}
      <path
        d={`M ${width - 22},${height / 2 - 12} L ${width - 8},${height / 2 + 12} L ${width - 8},${height / 2 - 12} Z`}
        fill="#0f172a"
        stroke={stateColor}
        strokeWidth="1.2"
      />

      {/* Beam emanating from anode (when active) — pulsing intensity */}
      {hvOn && (
        <ellipse
          cx={width - 14}
          cy={height / 2}
          rx="20"
          ry="10"
          fill="url(#xray-beam)"
        >
          <animate
            attributeName="rx"
            values="18;26;18"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;1;0.6"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </ellipse>
      )}

      {/* Rx label */}
      <circle
        cx={width / 2}
        cy="12"
        r="9"
        fill="#0f172a"
        stroke={stateColor}
        strokeWidth="1.5"
      />
      <text
        x={width / 2}
        y="15"
        textAnchor="middle"
        fill={stateColor}
        fontSize="9"
        fontWeight="700"
        fontFamily="ui-serif, Georgia"
      >
        Rx
      </text>

      {/* Status LED — blinks when HV is on */}
      <circle
        cx={width - 8}
        cy="8"
        r="3"
        fill={hvOn ? "#fbbf24" : "#475569"}
      >
        {hvOn && (
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="1.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {tag && (
        <text
          x={width / 2}
          y={height + 13}
          textAnchor="middle"
          fill="#64748b"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {tag}
        </text>
      )}
    </g>
  );
}
