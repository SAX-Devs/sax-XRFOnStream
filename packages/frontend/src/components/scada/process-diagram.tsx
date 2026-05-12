"use client";

import { DiagramDefs } from "./diagram-defs";
import { DiagramBackground } from "./diagram-background";
import { PipeNetwork } from "./pipe-network";
import { FlowLayer } from "./flow-layer";
import { TankCylinder } from "./symbols/tank-cylinder";
import { GateValve } from "./symbols/gate-valve";
import { BallValve } from "./symbols/ball-valve";
import { PeristalticPump } from "./symbols/peristaltic-pump";
import { VacuumPump } from "./symbols/vacuum-pump";
import { XrayTube } from "./symbols/xray-tube";
import { DetectorBlock } from "./symbols/detector-block";
import { InterchangerBlock } from "./symbols/interchanger-block";

// Cropped viewBox right edge: rightmost content (Purge Valve label) ends at ~x=915.
// 932 leaves ~17px margin and makes elements ~4% larger than the previous 970 setting.
const VIEWBOX_WIDTH = 932;
const VIEWBOX_HEIGHT = 600;

export function ProcessDiagram() {
  // Sample state for preview — replaced with real telemetry in sub-phase 4.2.D
  const sampleState = {
    waterValve: false,
    brineValve: true,
    retroValveOut: false,
    retroValveIn: false,
    inletValve: true,
    outletValve: true,
    exitValve: false,
    pumpState: "FORWARD" as const,
    interchangerPos: "Chamber" as const,
    detectorMeasuring: true,
    generatorHvOn: true,
    vacuumPump1: true,
    vacuumPump2: false,
    purgeValve: false,
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#020617] shadow-2xl">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <DiagramDefs />
        <DiagramBackground width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} />

        {/* Pipes go below all components */}
        <PipeNetwork />

        {/* Animated flow particles travelling along active pipes */}
        <FlowLayer state={sampleState} />


        {/* === TANKS (left column) === */}
        <TankCylinder
          x={50}
          y={75}
          label="Water"
          fluidColor="#3b82f6"
          fluidLevel={0.75}
          tag="TK-101"
        />
        <TankCylinder
          x={50}
          y={185}
          label="Brine"
          fluidColor="#fbbf24"
          fluidLevel={0.6}
          tag="TK-102"
        />
        <TankCylinder
          x={50}
          y={425}
          label="Brine Retro"
          fluidColor="#d97706"
          fluidLevel={0.4}
          tag="TK-103"
        />

        {/* === VALVES on tank outputs === */}
        <GateValve
          x={207}
          y={110}
          isOpen={sampleState.waterValve}
          label="Water in Valve"
          tag="PV-101"
        />
        <GateValve
          x={207}
          y={220}
          isOpen={sampleState.brineValve}
          label="Brine in Valve"
          tag="PV-102"
        />
        {/* Retro Valve out — top output of Brine Retro → recirculates UP to Brine pipe */}
        {/* Labels go ABOVE the valve so PV-103 is not hidden by Retro Valve in below */}
        <GateValve
          x={207}
          y={440}
          isOpen={sampleState.retroValveOut}
          label="Retro Valve out"
          tag="PV-103"
          labelPosition="top"
        />

        {/* Retro Valve in — bottom output of Brine Retro → joins drain at Exit Valve area */}
        <GateValve
          x={207}
          y={490}
          isOpen={sampleState.retroValveIn}
          label="Retro Valve in"
          tag="PV-104"
        />

        {/* === PERISTALTIC PUMP — aligned with Water+Brine merger at y=165 === */}
        <PeristalticPump
          x={540}
          y={165}
          state={sampleState.pumpState}
          tag="P-101"
          labelPosition="right"
        />

        {/* === ATMOSPHERIC VENT — open to atmosphere on top of the Inlet Valve === */}
        <g className="atmospheric-vent">
          {/* Horizontal cap at the top of the gas pipe */}
          <line
            x1={599}
            y1={190}
            x2={611}
            y2={190}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Three short upward strokes — air rising / open vent */}
          <line
            x1={601}
            y1={187}
            x2={601}
            y2={183}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeOpacity="0.7"
            strokeLinecap="round"
          />
          <line
            x1={605}
            y1={186}
            x2={605}
            y2={181}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeOpacity="0.85"
            strokeLinecap="round"
          />
          <line
            x1={609}
            y1={187}
            x2={609}
            y2={183}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeOpacity="0.7"
            strokeLinecap="round"
          />
          {/* "ATM" label */}
          <text
            x={616}
            y={189}
            textAnchor="start"
            fontSize="8"
            fontWeight="600"
            letterSpacing="1"
            fill="#64748b"
            fontFamily="ui-monospace, monospace"
          >
            ATM
          </text>
        </g>

        {/* === INLET VALVE — atmospheric air valve, part of the vacuum module === */}
        {/* Standalone: connects atmosphere (above) to the detector chamber (below). */}
        {/* Used in Atmospheric and Vacuum I modes per the equipment manual. */}
        <GateValve
          x={605}
          y={235}
          isOpen={sampleState.inletValve}
          label="Inlet Valve"
          tag="PV-201"
          labelPosition="right"
        />

        {/* === INTERCHANGER — rotary sample changer with motor + disc === */}
        <InterchangerBlock
          x={440}
          y={280}
          position={sampleState.interchangerPos}
          tag="IC-001"
        />

        {/* === DETECTOR (center) === */}
        <DetectorBlock
          x={520}
          y={285}
          isMeasuring={sampleState.detectorMeasuring}
          tag="DET-001"
        />

        {/* === GENERATOR Rx (right of detector) === */}
        <XrayTube
          x={650}
          y={290}
          hvOn={sampleState.generatorHvOn}
          tag="GEN-001"
        />

        {/* === OUTLET VALVE — on the vacuum line, just before VP-001 === */}
        <BallValve
          x={760}
          y={425}
          isOpen={sampleState.outletValve}
          label="Outlet Valve"
          tag="PV-301"
        />

        {/* === EXIT VALVE — on the drain line below the Detector === */}
        <GateValve
          x={540}
          y={517}
          isOpen={sampleState.exitValve}
          label="Exit Valve"
          tag="PV-302"
          labelPosition="right"
        />

        {/* === VACUUM PUMPS (bottom right) === */}
        <VacuumPump
          x={830}
          y={425}
          isActive={sampleState.vacuumPump1}
          number={1}
          tag="VP-001"
          labelPosition="right"
        />
        <VacuumPump
          x={830}
          y={500}
          isActive={sampleState.vacuumPump2}
          number={2}
          tag="VP-002"
          labelPosition="right"
        />

        {/* === PURGE VALVE — end of the vacuum line, after VP-002 === */}
        <GateValve
          x={830}
          y={555}
          isOpen={sampleState.purgeValve}
          label="Purge Valve"
          tag="PV-401"
          labelPosition="right"
        />

      </svg>
    </div>
  );
}
