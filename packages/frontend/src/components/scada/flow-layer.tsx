/**
 * Animated flow particles traveling along active pipes.
 *
 * Technique: SVG <animateMotion> with <mpath> referencing path elements
 * defined in <defs>. Each "active" flow renders 4 small glowing circles
 * with offset begin times, producing a continuous moving-dots effect
 * that looks like fluid moving through the pipe.
 */

interface FlowState {
  waterValve: boolean;
  brineValve: boolean;
  retroValveOut: boolean;
  retroValveIn: boolean;
  inletValve: boolean;
  outletValve: boolean;
  pumpState: "FORWARD" | "REVERSE" | "STOP";
}

interface FlowLayerProps {
  state: FlowState;
}

const COLORS = {
  water: "#60a5fa", // blue-400
  brine: "#fbbf24", // amber-400
  retroBrine: "#f59e0b", // amber-500
  mixed: "#22d3ee", // cyan-400 (water + brine combined)
  drain: "#94a3b8", // slate-400
};

type FlowType = "liquid" | "gas";

interface FlowProps {
  pathId: string;
  color: string;
  duration?: number;
  particleCount?: number;
  reverse?: boolean;
  type?: FlowType;
}

/**
 * Liquid flow → round drop-like particles (heavy, continuous, distinct units).
 * Gas flow    → elongated streaks aligned with path direction via rotate="auto"
 *               (suggests fast-moving molecules / motion blur).
 */
function Flow({
  pathId,
  color,
  duration = 2,
  particleCount = 4,
  reverse = false,
  type = "liquid",
}: FlowProps) {
  const indices = Array.from({ length: particleCount }, (_, i) => i);
  const keyPoints = reverse ? "1;0" : "0;1";

  if (type === "gas") {
    return (
      <>
        {indices.map((i) => (
          <ellipse
            key={`${pathId}-gas-${i}`}
            rx="4"
            ry="1.1"
            fill={color}
            opacity="0.7"
            filter="url(#particle-glow)"
          >
            <animateMotion
              dur={`${duration}s`}
              repeatCount="indefinite"
              begin={`-${(i * duration) / particleCount}s`}
              rotate="auto"
              keyPoints={keyPoints}
              keyTimes="0;1"
            >
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </ellipse>
        ))}
      </>
    );
  }

  // Liquid — round droplets with glow halo
  return (
    <>
      {indices.map((i) => (
        <circle
          key={`${pathId}-liq-${i}`}
          r="2.5"
          fill={color}
          filter="url(#particle-glow)"
        >
          <animateMotion
            dur={`${duration}s`}
            repeatCount="indefinite"
            begin={`-${(i * duration) / particleCount}s`}
            keyPoints={keyPoints}
            keyTimes="0;1"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}

export function FlowLayer({ state }: FlowLayerProps) {
  const pumping = state.pumpState !== "STOP";
  const reverse = state.pumpState === "REVERSE";

  // === Active flow logic ===
  // Liquid path: source valves → pump → detector.
  const waterFlow = state.waterValve && pumping;
  const brineFlow = state.brineValve && pumping;
  const retroOutFlow = state.retroValveOut && pumping;
  const mainFlow = waterFlow || brineFlow || retroOutFlow;
  const pumpToDetectorFlow = mainFlow;

  // Bypass path: when the Inlet Valve is open, sample flows around the pump
  // (feed → Inlet Valve → pump-output line) in parallel with the pump.
  const bypassFlow = state.inletValve && mainFlow;

  // Drain path: chamber → Outlet Valve → off-screen vent. Gated on outletValve.
  const drainFlow = state.outletValve;
  const retroInFlow = state.retroValveIn;

  return (
    <g className="flow-layer">
      <defs>
        {/* Path definitions — must match pipe-network.tsx exactly */}
        <path id="flow-water-feed" d="M 160 110 L 200 110" />
        <path id="flow-water-merger" d="M 215 110 L 320 110 L 320 165" />
        <path id="flow-brine-feed" d="M 160 220 L 200 220" />
        <path id="flow-brine-merger" d="M 215 220 L 320 220 L 320 165" />
        <path id="flow-merger-pump" d="M 320 165 L 630 165" />
        <path id="flow-pump-to-detector" d="M 660 195 L 660 310" />

        {/* Bypass path — sample routed around the pump through the Inlet Valve */}
        <path id="flow-bypass-in" d="M 595 165 L 595 108 L 738 108 L 738 212" />
        <path id="flow-bypass-out" d="M 738 238 L 738 265 L 660 265" />

        <path id="flow-retro-out-feed" d="M 160 440 L 200 440" />
        <path id="flow-retro-out-up" d="M 215 440 L 250 440 L 250 220" />
        <path id="flow-retro-in-feed" d="M 160 490 L 200 490" />
        <path id="flow-retro-in-drain" d="M 215 490 L 660 490" />

        <path id="flow-detector-exit" d="M 660 398 L 660 525" />
        <path id="flow-exit-drain" d="M 660 540 L 660 585" />
      </defs>

      {/* === Water flow (tank → merger) === */}
      {waterFlow && (
        <>
          <Flow
            pathId="flow-water-feed"
            color={COLORS.water}
            duration={1.2}
            particleCount={2}
            reverse={reverse}
          />
          <Flow
            pathId="flow-water-merger"
            color={COLORS.water}
            duration={2.6}
            reverse={reverse}
          />
        </>
      )}

      {/* === Brine flow (tank → merger) === */}
      {brineFlow && (
        <>
          <Flow
            pathId="flow-brine-feed"
            color={COLORS.brine}
            duration={1.2}
            particleCount={2}
            reverse={reverse}
          />
          <Flow
            pathId="flow-brine-merger"
            color={COLORS.brine}
            duration={2.6}
            reverse={reverse}
          />
        </>
      )}

      {/* === Retro recirculation (tank → up → joins brine) === */}
      {retroOutFlow && (
        <>
          <Flow
            pathId="flow-retro-out-feed"
            color={COLORS.retroBrine}
            duration={1.2}
            particleCount={2}
            reverse={reverse}
          />
          <Flow
            pathId="flow-retro-out-up"
            color={COLORS.retroBrine}
            duration={3.5}
            reverse={reverse}
          />
        </>
      )}

      {/* === Combined to pump (mixed colour after merger) === */}
      {mainFlow && (
        <Flow
          pathId="flow-merger-pump"
          color={COLORS.mixed}
          duration={2.4}
          reverse={reverse}
        />
      )}

      {/* === Pump → Detector (liquid sample, direct) === */}
      {pumpToDetectorFlow && (
        <Flow
          pathId="flow-pump-to-detector"
          color={COLORS.mixed}
          duration={1.8}
          reverse={reverse}
        />
      )}

      {/* === Bypass — sample flowing around the pump through the Inlet Valve === */}
      {bypassFlow && (
        <>
          <Flow
            pathId="flow-bypass-in"
            color={COLORS.mixed}
            duration={2.2}
            reverse={reverse}
          />
          <Flow
            pathId="flow-bypass-out"
            color={COLORS.mixed}
            duration={1.4}
            reverse={reverse}
          />
        </>
      )}

      {/* === Drain line (Analysis chamber → Outlet Valve → off-screen) === */}
      {drainFlow && (
        <>
          <Flow
            pathId="flow-detector-exit"
            color={COLORS.drain}
            duration={2.6}
          />
          <Flow
            pathId="flow-exit-drain"
            color={COLORS.drain}
            duration={1.2}
            particleCount={2}
          />
        </>
      )}

      {/* === Retro-in drain (tank → joins exit drain) === */}
      {retroInFlow && (
        <>
          <Flow
            pathId="flow-retro-in-feed"
            color={COLORS.retroBrine}
            duration={1}
            particleCount={2}
          />
          <Flow
            pathId="flow-retro-in-drain"
            color={COLORS.retroBrine}
            duration={3.2}
          />
        </>
      )}
    </g>
  );
}
