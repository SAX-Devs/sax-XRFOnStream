interface DiagramBackgroundProps {
  width: number;
  height: number;
}

export function DiagramBackground({ width, height }: DiagramBackgroundProps) {
  return (
    <g>
      {/* Base dark fill */}
      <rect x="0" y="0" width={width} height={height} fill="#020617" />

      {/* Radial vignette behind central area */}
      <radialGradient id="bg-vignette" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#0f172a" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#020617" stopOpacity="1" />
      </radialGradient>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="url(#bg-vignette)"
      />

      {/* Subtle grid */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="url(#grid-pattern)"
      />
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="url(#grid-pattern-major)"
      />
    </g>
  );
}
