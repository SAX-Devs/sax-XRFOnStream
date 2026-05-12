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
      <Pipe id="pipe-merged-to-pump" d="M 320 165 L 510 165" />

      {/* === BRINE RETRO Output 1 — recirculation to BRINE pipe (Retro Valve out) === */}
      {/* Joins Brine horizontal pipe at (250, 220) before the merger */}
      <Pipe id="pipe-retro-out-feed" d="M 160 440 L 200 440" />
      <Pipe id="pipe-retro-out-up" d="M 215 440 L 250 440 L 250 220" />

      {/* === BRINE RETRO Output 2 — joins detector drain BEFORE the Exit Valve === */}
      {/* Single horizontal at y=490, joining the detector→exit pipe at (540, 490) */}
      <Pipe id="pipe-retro-in-feed" d="M 160 490 L 200 490" />
      <Pipe id="pipe-retro-in-to-drain" d="M 215 490 L 540 490" />

      {/* === LIQUID line — Pump bottom → Detector chamber (direct, no valve) === */}
      <Pipe id="pipe-pump-to-detector" d="M 540 195 L 540 285" />

      {/* === GAS line — Atmospheric → Inlet Valve → Detector chamber === */}
      {/* Inlet Valve belongs to the vacuum module. Its other side is open to atmosphere. */}
      <Pipe id="pipe-atm-to-inlet" d="M 605 190 L 605 222" />
      <Pipe id="pipe-inlet-to-detector-air" d="M 605 248 L 605 285" />

      {/* === INTERCHANGER → DETECTOR (adjacent, short connection) === */}
      <Pipe id="pipe-interchanger-detector" d="M 500 320 L 520 320" />

      {/* === DETECTOR drain → Exit Valve → off-screen (single line, no Outlet Valve here) === */}
      <Pipe id="pipe-detector-to-exit" d="M 540 380 L 540 510" />
      {/* Exit drain extends past the retro-drain junction at (540,555) and off-screen */}
      <Pipe id="pipe-exit-drain" d="M 540 525 L 540 585" />

      {/* === VACUUM line: Detector → Outlet Valve → Vacuum Pumps === */}
      {/* Pipe routed BELOW the Generator Rx (y=290-350) and to the RIGHT of its body (x=650-740) */}
      <Pipe
        id="pipe-detector-to-outlet"
        d="M 630 372 L 753 372 L 753 425"
      />
      <Pipe id="pipe-outlet-to-vac1" d="M 767 425 L 805 425" />
      <Pipe id="pipe-vac1-to-vac2" d="M 830 450 L 830 475" />
      {/* VP-002 → Purge Valve → off-screen vent */}
      <Pipe id="pipe-vac2-to-purge" d="M 830 525 L 830 540" />
      <Pipe id="pipe-purge-vent" d="M 830 570 L 830 590" />

      {/* === GENERATOR → DETECTOR (X-ray housing connection) === */}
      <Pipe id="pipe-gen-to-detector" d="M 680 320 L 630 320" />

      {/* === Junction markers — make T-junctions explicit (P&ID convention) === */}
      <JunctionDot cx={320} cy={165} /> {/* Water + Brine merger */}
      <JunctionDot cx={250} cy={220} /> {/* Retro recirculation joins Brine pipe */}
      <JunctionDot cx={540} cy={490} /> {/* Retro drain joins detector drain BEFORE Exit Valve */}
    </g>
  );
}
