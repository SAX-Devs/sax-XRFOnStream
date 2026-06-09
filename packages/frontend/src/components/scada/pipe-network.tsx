/**
 * All static pipe paths for the XRF On Stream process diagram.
 * Each pipe is rendered with a 3-layer technique:
 *  1. Outer dark stroke (pipe shadow)
 *  2. Mid gradient stroke (pipe body)
 *  3. Inner highlight stroke (top reflection — gives cylindrical depth)
 */

interface PipeProps {
  d: string;
  id?: string;
}

function Pipe({ d, id }: PipeProps) {
  return (
    <g id={id}>
      <path
        d={d}
        fill="none"
        stroke="#020617"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#475569"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.4"
      />
    </g>
  );
}

/**
 * Small filled dot at pipe junctions. P&ID convention:
 * solid dot = pipes are connected (vs lines that just cross).
 */
function JunctionDot({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="5" fill="#475569" />
      <circle cx={cx} cy={cy} r="3" fill="#94a3b8" />
    </g>
  );
}

export function PipeNetwork() {
  return (
    <g className="pipe-network">
      {/* === WATER feed (tank → valve → DOWN to merger at midpoint y=165) === */}
      <Pipe id="pipe-water-feed" d="M 160 110 L 200 110" />
      <Pipe id="pipe-water-to-merger" d="M 215 110 L 320 110 L 320 165" />

      {/* === BRINE feed (tank → valve → UP to merger at midpoint y=165) === */}
      <Pipe id="pipe-brine-feed" d="M 160 220 L 200 220" />
      <Pipe id="pipe-brine-to-merger" d="M 215 220 L 320 220 L 320 165" />

      {/* === COMBINED Water+Brine → PUMP (the blue module) === */}
      <Pipe id="pipe-merged-to-pump" d="M 320 165 L 630 165" />

      {/* === BRINE RETRO Output 1 — recirculation to BRINE pipe (Retro Valve out) === */}
      {/* Joins Brine horizontal pipe at (250, 220) before the merger */}
      <Pipe id="pipe-retro-out-feed" d="M 160 440 L 200 440" />
      <Pipe id="pipe-retro-out-up" d="M 215 440 L 250 440 L 250 220" />

      {/* === BRINE RETRO Output 2 — joins detector drain BEFORE the Outlet Valve === */}
      {/* Single horizontal at y=490, joining the chamber→outlet pipe at (660, 490) */}
      <Pipe id="pipe-retro-in-feed" d="M 160 490 L 200 490" />
      <Pipe id="pipe-retro-in-to-drain" d="M 215 490 L 660 490" />

      {/* === LIQUID line — Pump → Analysis chamber inlet (top) === */}
      <Pipe id="pipe-pump-to-analysis" d="M 660 195 L 660 310" />

      {/* === BYPASS line — Inlet Valve is now a liquid bypass around the pump === */}
      {/* Tap off the feed BEFORE the pump → up and over → Inlet Valve → back into */}
      {/* the pump-output line AFTER the pump. (Was the gas/atmosphere line.) */}
      <Pipe id="pipe-bypass-in" d="M 595 165 L 595 108 L 738 108 L 738 198" />
      <Pipe id="pipe-bypass-out" d="M 738 225 L 738 240 L 660 240" />

      {/* === Analysis chamber drain (bottom) → Outlet Valve → off-screen === */}
      <Pipe id="pipe-analysis-to-exit" d="M 660 398 L 660 525" />
      {/* Outlet drain extends past the valve and off-screen */}
      <Pipe id="pipe-exit-drain" d="M 660 540 L 660 585" />

      {/* === Junction markers — make T-junctions explicit (P&ID convention) === */}
      <JunctionDot cx={320} cy={165} /> {/* Water + Brine merger */}
      <JunctionDot cx={250} cy={220} /> {/* Retro recirculation joins Brine pipe */}
      <JunctionDot cx={660} cy={490} /> {/* Retro drain joins chamber drain BEFORE Outlet Valve */}
      <JunctionDot cx={595} cy={165} /> {/* Bypass taps the feed line before the pump */}
      <JunctionDot cx={660} cy={240} /> {/* Bypass rejoins the pump-output line after the pump */}
    </g>
  );
}
