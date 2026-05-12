interface TankCylinderProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  fluidColor: string;
  fluidLevel?: number;
  tag?: string;
}

export function TankCylinder({
  x,
  y,
  width = 110,
  height = 80,
  label,
  fluidColor,
  fluidLevel = 0.7,
  tag,
}: TankCylinderProps) {
  const ellipseRy = 8;
  const fluidTop = y + ellipseRy + (height - ellipseRy * 2) * (1 - fluidLevel);
  const gradientId = `tank-gradient-${label.replace(/\s+/g, "-")}`;
  const fluidGradientId = `tank-fluid-${label.replace(/\s+/g, "-")}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={fluidGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={fluidColor} stopOpacity="0.4" />
          <stop offset="50%" stopColor={fluidColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={fluidColor} stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Tank body */}
      <rect
        x={x}
        y={y + ellipseRy}
        width={width}
        height={height - ellipseRy * 2}
        fill={`url(#${gradientId})`}
        stroke="#475569"
        strokeWidth="1"
      />

      {/* Fluid inside */}
      <rect
        x={x + 2}
        y={fluidTop}
        width={width - 4}
        height={y + height - ellipseRy - fluidTop}
        fill={`url(#${fluidGradientId})`}
      />

      {/* Surface ripple — gentle wave on the fluid surface */}
      <ellipse
        cx={x + width / 2}
        cy={fluidTop}
        rx={width / 2 - 3}
        ry="2"
        fill={fluidColor}
        opacity="0.5"
      >
        <animate
          attributeName="ry"
          values="1.5;3;1.5"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.35;0.7;0.35"
          dur="3s"
          repeatCount="indefinite"
        />
      </ellipse>

      {/* Top ellipse (cylinder cap) */}
      <ellipse
        cx={x + width / 2}
        cy={y + ellipseRy}
        rx={width / 2}
        ry={ellipseRy}
        fill="#1e293b"
        stroke="#64748b"
        strokeWidth="1"
      />

      {/* Bottom ellipse */}
      <ellipse
        cx={x + width / 2}
        cy={y + height - ellipseRy}
        rx={width / 2}
        ry={ellipseRy}
        fill={`url(#${gradientId})`}
        stroke="#475569"
        strokeWidth="1"
      />

      {/* Highlight on left side */}
      <line
        x1={x + 4}
        y1={y + ellipseRy + 3}
        x2={x + 4}
        y2={y + height - ellipseRy - 3}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* Label */}
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        textAnchor="middle"
        fill="#f1f5f9"
        fontSize="13"
        fontWeight="600"
        fontFamily="ui-sans-serif, system-ui"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
      >
        {label}
      </text>

      {/* Tag */}
      {tag && (
        <text
          x={x + width / 2}
          y={y + height + 14}
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
