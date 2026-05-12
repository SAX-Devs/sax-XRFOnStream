interface DetectorBlockProps {
  x: number;
  y: number;
  isMeasuring: boolean;
  width?: number;
  height?: number;
  tag?: string;
}

export function DetectorBlock({
  x,
  y,
  isMeasuring,
  width = 110,
  height = 90,
  tag,
}: DetectorBlockProps) {
  const stateColor = isMeasuring ? "#06b6d4" : "#64748b";
  const ledColor = isMeasuring ? "#22d3ee" : "#475569";

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id="detector-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
      </defs>

      {/* Glow halo — pulses when measuring */}
      {isMeasuring && (
        <rect
          x="-4"
          y="-4"
          width={width + 8}
          height={height + 8}
          rx="8"
          fill={stateColor}
          filter="url(#detector-glow)"
        >
          <animate
            attributeName="opacity"
            values="0.15;0.4;0.15"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Main housing */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="4"
        fill="url(#detector-body)"
        stroke={stateColor}
        strokeWidth="1.5"
      />

      {/* Heat sink fins on top */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={i}
          x1={12 + i * 12}
          y1="6"
          x2={12 + i * 12}
          y2="20"
          stroke="#475569"
          strokeWidth="1.5"
        />
      ))}

      {/* Crystal/sensor area (rectangular window) */}
      <rect
        x={width / 2 - 18}
        y="32"
        width="36"
        height="28"
        rx="2"
        fill={isMeasuring ? "#0c4a6e" : "#0f172a"}
        stroke={stateColor}
        strokeWidth="1.2"
      />

      {/* Inner crystal */}
      <rect
        x={width / 2 - 12}
        y="38"
        width="24"
        height="16"
        rx="1"
        fill={isMeasuring ? "#0e7490" : "#1e293b"}
        stroke={stateColor}
        strokeWidth="0.8"
        strokeOpacity="0.6"
      />

      {/* Crystal lattice pattern */}
      <g stroke={stateColor} strokeWidth="0.4" strokeOpacity="0.6">
        <line x1={width / 2 - 12} y1="42" x2={width / 2 + 12} y2="42" />
        <line x1={width / 2 - 12} y1="46" x2={width / 2 + 12} y2="46" />
        <line x1={width / 2 - 12} y1="50" x2={width / 2 + 12} y2="50" />
        <line x1={width / 2 - 6} y1="38" x2={width / 2 - 6} y2="54" />
        <line x1={width / 2 + 6} y1="38" x2={width / 2 + 6} y2="54" />
      </g>

      {/* Title label */}
      <text
        x={width / 2}
        y={height - 14}
        textAnchor="middle"
        fill="#cbd5e1"
        fontSize="11"
        fontWeight="600"
        fontFamily="ui-sans-serif, system-ui"
        letterSpacing="1"
      >
        DETECTOR
      </text>

      {/* Status LED — blinks when measuring */}
      <circle cx={width - 10} cy="10" r="3.5" fill={ledColor}>
        {isMeasuring && (
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle
        cx={width - 10}
        cy="10"
        r="5.5"
        fill="none"
        stroke={ledColor}
        strokeWidth="0.6"
        opacity="0.5"
      />

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
