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
  /** Measured inlet flow — this is an ON-STREAM analyzer: the process stream
   * flows through the equipment even with the pump stopped. */
  flowRate: number;
  /** Measured outlet flow — animates the drain side independently, so an
   * in/out imbalance (chamber leaking/blocked) is visible in the diagram. */
  flowRateOut: number;
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
  // ON-STREAM analyzer: liquid moves whenever the measured flow says so, pump
  // running or not (with the pump stopped, the stream enters via the bypass /
  // Inlet Valve). The pump state alone must never gate the animations.
  //
  // Inlet and outlet sides animate INDEPENDENTLY from their own sensors, so a
  // hydraulic imbalance reads at a glance: e.g. "Analyzer Chamber Leaking or
  // Blocked" (in ~1591, out ~8) shows liquid entering and nothing draining.
  const flowingIn = pumping || state.flowRate > 0.1;
  // Out counts as flowing only when meaningful vs the inlet (>5%) — filters
  // sensor noise like out=8 vs in=1591. Thresholds pending SAX's units spec.
  const flowingOut =
    state.flowRateOut > 0.1 && state.flowRateOut > state.flowRate * 0.05;

  // Liquid path: source valves → (pump or bypass) → chamber.
  // Retro IN (top pipe): the pump pulls liquid FROM the recirculation tank
  // into the feed line — an inlet source like water/brine.
  const waterFlow = state.waterValve && flowingIn;
  const brineFlow = state.brineValve && flowingIn;
  const retroInFeedFlow = state.retroValveIn && flowingIn;
  const mainFlow = waterFlow || brineFlow || retroInFeedFlow;

  // Routing around the pump: a STOPPED peristaltic pump BLOCKS the line, so
  // liquid can only cross it when it's running. With the pump stopped and the
  // Inlet Valve open, the stream detours through the bypass and rejoins the
  // trunk AFTER the pump — nothing may animate through the pump itself.
  const viaPump = mainFlow && pumping;
  const bypassFlow = state.inletValve && mainFlow;
  const viaBypassOnly = bypassFlow && !pumping;

  // Drain path: chamber → Outlet Valve → off-screen vent (outlet sensor).
  const drainFlow = state.outletValve && flowingOut;
  // Retro OUT (bottom pipe): with the Outlet Valve closed, the chamber's
  // outflow returns to the recirculation tank — runs drain → tank (reversed).
  const retroOutReturnFlow = state.retroValveOut && flowingOut;

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

        {/* Pump-stopped routing: feed only reaches the bypass tap, and flow
            re-enters the trunk AFTER the pump (at the bypass rejoin, y=240). */}
        <path id="flow-feed-to-tap" d="M 320 165 L 595 165" />
        <path id="flow-rejoin-to-chamber" d="M 660 240 L 660 310" />

        {/* Bypass path — sample routed around the pump through the Inlet Valve */}
        <path id="flow-bypass-in" d="M 595 165 L 595 108 L 738 108 L 738 198" />
        <path id="flow-bypass-out" d="M 738 225 L 738 240 L 660 240" />

        {/* Retro IN (top): tank → up → joins the brine feed line. */}
        <path id="flow-retro-top-feed" d="M 160 440 L 200 440" />
        <path id="flow-retro-top-up" d="M 215 440 L 250 440 L 250 220" />
        {/* Retro OUT (bottom): defined tank→drain; animated REVERSED (drain→tank). */}
        <path id="flow-retro-bottom-feed" d="M 160 490 L 200 490" />
        <path id="flow-retro-bottom-drain" d="M 215 490 L 660 490" />

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

      {/* === Retro IN (top): the pump pulls from the tank into the feed === */}
      {retroInFeedFlow && (
        <>
          <Flow
            pathId="flow-retro-top-feed"
            color={COLORS.retroBrine}
            duration={1.2}
            particleCount={2}
            reverse={reverse}
          />
          <Flow
            pathId="flow-retro-top-up"
            color={COLORS.retroBrine}
            duration={3.5}
            reverse={reverse}
          />
        </>
      )}

      {/* === Feed after the merger ===
          Pump running: all the way into the pump. Pump stopped: only up to the
          bypass tap (a stopped peristaltic pump blocks the line). */}
      {viaPump && (
        <Flow
          pathId="flow-merger-pump"
          color={COLORS.mixed}
          duration={2.4}
          reverse={reverse}
        />
      )}
      {viaBypassOnly && (
        <Flow
          pathId="flow-feed-to-tap"
          color={COLORS.mixed}
          duration={2.1}
          reverse={reverse}
        />
      )}

      {/* === Down to the chamber ===
          Through the pump when it runs; from the bypass rejoin when it doesn't. */}
      {viaPump && (
        <Flow
          pathId="flow-pump-to-detector"
          color={COLORS.mixed}
          duration={1.8}
          reverse={reverse}
        />
      )}
      {viaBypassOnly && (
        <Flow
          pathId="flow-rejoin-to-chamber"
          color={COLORS.mixed}
          duration={1.2}
          particleCount={3}
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

      {/* === Retro OUT (bottom): chamber outflow returns to the tank ===
          Runs REVERSED: drain junction → valve → tank. */}
      {retroOutReturnFlow && (
        <>
          <Flow
            pathId="flow-retro-bottom-drain"
            color={COLORS.retroBrine}
            duration={3.2}
            reverse
          />
          <Flow
            pathId="flow-retro-bottom-feed"
            color={COLORS.retroBrine}
            duration={1}
            particleCount={2}
            reverse
          />
        </>
      )}
    </g>
  );
}
