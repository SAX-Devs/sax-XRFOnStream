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
  exitValve: boolean;
  purgeValve: boolean;
  pumpState: "FORWARD" | "REVERSE" | "STOP";
  vacuumPump1: boolean;
  vacuumPump2: boolean;
}

interface FlowLayerProps {
  state: FlowState;
}

const COLORS = {
  water: "#60a5fa", // blue-400
  brine: "#fbbf24", // amber-400
  retroBrine: "#f59e0b", // amber-500
  mixed: "#22d3ee", // cyan-400 (water + brine combined)
  vacuum: "#c084fc", // purple-400 (gas exiting toward vacuum pumps)
  atmospheric: "#67e8f9", // cyan-300 (atmospheric air entering through Inlet Valve)
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
  // Liquid path: source valves → pump → detector. The Inlet Valve does NOT
  // gate this path — it belongs to the vacuum module (gas/atmosphere) and is
  // independent of the liquid sample line.
  const waterFlow = state.waterValve && pumping;
  const brineFlow = state.brineValve && pumping;
  const retroOutFlow = state.retroValveOut && pumping;
  const mainFlow = waterFlow || brineFlow || retroOutFlow;
  const pumpToDetectorFlow = mainFlow;

  // Gas path (vacuum module)
  const atmosphericInflow = state.inletValve; // Air drawn in from atmosphere
  const vacuum1Flow = state.outletValve && state.vacuumPump1;
  const vacuum2Flow = vacuum1Flow && state.vacuumPump2;
  const purgeFlow = vacuum2Flow && state.purgeValve;

  const exitFlow = state.exitValve;
  const retroInFlow = state.retroValveIn;

  return (
    <g className="flow-layer">
      <defs>
        {/* Path definitions — must match pipe-network.tsx exactly */}
        <path id="flow-water-feed" d="M 160 110 L 200 110" />
        <path id="flow-water-merger" d="M 215 110 L 320 110 L 320 165" />
        <path id="flow-brine-feed" d="M 160 220 L 200 220" />
        <path id="flow-brine-merger" d="M 215 220 L 320 220 L 320 165" />
        <path id="flow-merger-pump" d="M 320 165 L 510 165" />
        <path id="flow-pump-to-detector" d="M 540 195 L 540 285" />

        {/* Gas path — atmospheric air entering through Inlet Valve */}
        <path id="flow-atm-to-detector" d="M 605 190 L 605 285" />

        <path id="flow-retro-out-feed" d="M 160 440 L 200 440" />
        <path id="flow-retro-out-up" d="M 215 440 L 250 440 L 250 220" />
        <path id="flow-retro-in-feed" d="M 160 490 L 200 490" />
        <path id="flow-retro-in-drain" d="M 215 490 L 540 490" />

        <path
          id="flow-detector-outlet"
          d="M 630 372 L 753 372 L 753 425"
        />
        <path id="flow-outlet-vac1" d="M 767 425 L 805 425" />
        <path id="flow-vac1-vac2" d="M 830 450 L 830 475" />
        <path id="flow-vac2-purge" d="M 830 525 L 830 540" />
        <path id="flow-purge-vent" d="M 830 570 L 830 590" />

        <path id="flow-detector-exit" d="M 540 380 L 540 510" />
        <path id="flow-exit-drain" d="M 540 525 L 540 585" />
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

      {/* === Atmospheric air → Inlet Valve → Detector chamber === */}
      {atmosphericInflow && (
        <Flow
          pathId="flow-atm-to-detector"
          color={COLORS.atmospheric}
          duration={1.6}
          particleCount={5}
          type="gas"
        />
      )}

      {/* === Vacuum line (gas flow toward pumps and out the purge) === */}
      {vacuum1Flow && (
        <>
          <Flow
            pathId="flow-detector-outlet"
            color={COLORS.vacuum}
            duration={2.0}
            particleCount={5}
            type="gas"
          />
          <Flow
            pathId="flow-outlet-vac1"
            color={COLORS.vacuum}
            duration={0.9}
            particleCount={3}
            type="gas"
          />
        </>
      )}

      {vacuum2Flow && (
        <Flow
          pathId="flow-vac1-vac2"
          color={COLORS.vacuum}
          duration={0.9}
          particleCount={3}
          type="gas"
        />
      )}

      {purgeFlow && (
        <>
          <Flow
            pathId="flow-vac2-purge"
            color={COLORS.vacuum}
            duration={0.9}
            particleCount={3}
            type="gas"
          />
          <Flow
            pathId="flow-purge-vent"
            color={COLORS.vacuum}
            duration={1.0}
            particleCount={3}
            type="gas"
          />
        </>
      )}

      {/* === Drain line (Detector → Exit Valve → off-screen) === */}
      {exitFlow && (
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
