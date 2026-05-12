/**
 * Shared SVG <defs>: filters and reusable patterns used across the diagram.
 * Mounted once inside the root SVG.
 */
export function DiagramDefs() {
  return (
    <defs>
      {/* Subtle grid pattern for background */}
      <pattern
        id="grid-pattern"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          stroke="#1e293b"
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />
      </pattern>

      <pattern
        id="grid-pattern-major"
        width="200"
        height="200"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 200 0 L 0 0 0 200"
          fill="none"
          stroke="#334155"
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />
      </pattern>

      {/* Glow filter for valves */}
      <filter id="valve-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Glow filter for pumps */}
      <filter id="pump-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Glow filter for generator */}
      <filter id="generator-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Glow filter for detector */}
      <filter id="detector-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Glow filter for flow particles */}
      <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Pipe gradient — gives 3D cylindrical effect */}
      <linearGradient id="pipe-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* Pipe gradient horizontal (for vertical pipes) */}
      <linearGradient id="pipe-gradient-h" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="50%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>
  );
}
