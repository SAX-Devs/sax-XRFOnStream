"use client";

import { DiagramDefs } from "./diagram-defs";
import { DiagramBackground } from "./diagram-background";
import { PipeNetwork } from "./pipe-network";
import { FlowLayer } from "./flow-layer";
import { TankCylinder } from "./symbols/tank-cylinder";
import { GateValve } from "./symbols/gate-valve";
import { BallValve } from "./symbols/ball-valve";
import { PeristalticPump } from "./symbols/peristaltic-pump";
import { PressureSwitch } from "./symbols/pressure-switch";
import { TankLevelProbes } from "./symbols/tank-level-probes";
import { AnalysisChamber } from "./symbols/analysis-chamber";
import { HoneycombWindow } from "./symbols/honeycomb-window";
import { InternalChamber } from "./symbols/internal-chamber";
import { InterchangerArm } from "./symbols/interchanger-arm";
import { ChamberLock } from "./symbols/chamber-lock";
import { MaintenanceDoor } from "./symbols/maintenance-door";
import { ChamberLeakSensor } from "./symbols/chamber-leak-sensor";
import { FlowMeter } from "./symbols/flow-meter";

// viewBox width preserved at 932 from the earlier layout; rightmost content
// is now the internal chamber (~x=742) so the right margin is intentionally wide.
const VIEWBOX_WIDTH = 932;
const VIEWBOX_HEIGHT = 600;

/**
 * Visual state the diagram renders. Field names are the diagram's own
 * vocabulary; the useScadaTelemetry hook maps real equipment telemetry into
 * this shape. `interchangerMode` only drives the arm's physical pose — the raw
 * position string is shown in the parameters panel, not here.
 */
export interface ScadaDiagramState {
  waterValve: boolean;
  brineValve: boolean;
  retroValveOut: boolean;
  retroValveIn: boolean;
  inletValve: boolean;
  outletValve: boolean;
  pumpState: "FORWARD" | "REVERSE" | "STOP";
  interchangerMode: "NORMAL" | "RECAL";
  detectorMeasuring: boolean;
  generatorHvOn: boolean;
  pressureOk: boolean;
  tankLevelOk: boolean;
  tankPercentLevel: number;
  chamberLocked: boolean;
  maintenanceDoorClosed: boolean;
  chamberLeakOk: boolean;
  flowRate: number;
  flowRateOut: number;
}

interface ProcessDiagramProps {
  /** Live diagram state, mapped from telemetry by useScadaTelemetry. */
  state: ScadaDiagramState;
  /** Whether to render P&ID tags (TK-101, PV-101, etc.). Default off; the Service screen turns it on. */
  showTags?: boolean;
}

export function ProcessDiagram({ state, showTags = false }: ProcessDiagramProps) {
  // Helper: returns the tag string only when tags are enabled, undefined otherwise
  const t = (tag: string) => (showTags ? tag : undefined);

  const sampleState = state;

  // Safety interlock chain: the X-ray tube may only emit when the analysis
  // chamber is sealed, the maintenance door is closed, AND the leak sensor
  // reports dry. The honeycomb window and tube beam follow this gated state.
  const effectiveHvOn =
    sampleState.generatorHvOn &&
    sampleState.chamberLocked &&
    sampleState.maintenanceDoorClosed &&
    sampleState.chamberLeakOk;

  // ON-STREAM: liquid is moving whenever the measured flow says so — the
  // process stream flows through the equipment even with the pump stopped.
  const flowing = sampleState.pumpState !== "STOP" || sampleState.flowRate > 0.1;

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
          tag={t("TK-101")}
        />
        <TankCylinder
          x={50}
          y={185}
          label="Brine"
          fluidColor="#fbbf24"
          fluidLevel={0.6}
          tag={t("TK-102")}
        />
        <TankCylinder
          x={50}
          y={425}
          label="Recirculation Tank"
          labelPosition="above"
          fluidColor="#d97706"
          fluidLevel={sampleState.tankPercentLevel / 100}
          tag={t("TK-103")}
        />
        {/* Level instrumentation — two measuring probes inside the tank */}
        <TankLevelProbes
          tankX={50}
          tankY={425}
          tankWidth={110}
          tankHeight={80}
          levelOk={sampleState.tankLevelOk}
          percentLevel={sampleState.tankPercentLevel}
        />

        {/* === VALVES on tank outputs === */}
        <GateValve
          x={207}
          y={110}
          isOpen={sampleState.waterValve}
          label="Water in Valve"
          tag={t("PV-101")}
        />
        <GateValve
          x={207}
          y={220}
          isOpen={sampleState.brineValve}
          label="Brine in Valve"
          tag={t("PV-102")}
        />
        {/* Retro Valve out — top output of Brine Retro → recirculates UP to Brine pipe */}
        {/* Labels go ABOVE the valve so PV-103 is not hidden by Retro Valve in below */}
        <GateValve
          x={207}
          y={440}
          isOpen={sampleState.retroValveOut}
          label="Retro Valve out"
          tag={t("PV-103")}
          labelPosition="top"
        />

        {/* Retro Valve in — bottom output of Brine Retro → joins drain at Exit Valve area */}
        <GateValve
          x={207}
          y={490}
          isOpen={sampleState.retroValveIn}
          label="Retro Valve in"
          tag={t("PV-104")}
        />

        {/* === PERISTALTIC PUMP — aligned with Water+Brine merger at y=165 === */}
        <PeristalticPump
          x={660}
          y={165}
          state={sampleState.pumpState}
          tag={t("P-101")}
          labelPosition="right"
        />

        {/* === INLET VALVE — now a liquid bypass around the peristaltic pump === */}
        {/* Feed (before pump) → Inlet Valve → pump-output line (after pump). */}
        {/* Formerly the atmospheric/gas line to the detector (both removed). */}
        <GateValve
          x={738}
          y={211}
          isOpen={sampleState.inletValve}
          label="Inlet Valve"
          tag={t("PV-201")}
          labelPosition="right"
          orientation="vertical"
        />

        {/* === CENTRAL ASSEMBLY — two chambers facing each other === */}
        {/* Analysis chamber (left): sample flows in (top) and out (bottom). */}
        <AnalysisChamber
          x={594}
          y={310}
          width={132}
          height={88}
          tag={t("AC-001")}
          interchangerMode={sampleState.interchangerMode}
          pumping={flowing}
        />

        {/* Honeycomb window between the chambers — radiation crosses here. */}
        <HoneycombWindow
          x={726}
          y={324}
          width={14}
          height={60}
          active={effectiveHvOn}
        />

        {/* Internal chamber (right): X-ray tube + detector, aimed at the window. */}
        <InternalChamber
          x={744}
          y={310}
          width={118}
          height={88}
          hvOn={effectiveHvOn}
          measuring={sampleState.detectorMeasuring}
          pointX={733}
          pointY={354}
          showTags={showTags}
        />

        {/* Interchanger arm — pivot OUTSIDE the chamber on the left wall, mid-height. */}
        {/* In RECAL the arm reaches in through the wall to place the recal target  */}
        {/* in front of the window; in NORMAL it parks pointing left, outside.       */}
        <InterchangerArm
          pivotX={580}
          pivotY={354}
          recalTipX={714}
          recalTipY={354}
          parkRotation={180}
          mode={sampleState.interchangerMode}
          tag={t("IC-001")}
        />
        {/* === CHAMBER LOCK — safety interlock on the analysis chamber lid === */}
        {/* Positioned well left of the PressureSwitch and chamber, label on the */}
        {/* far side of the balloon so nothing overlaps either instrument.        */}
        <ChamberLock
          x={515}
          y={320}
          locked={sampleState.chamberLocked}
          connectX={594}
          connectY={320}
          label="Chamber Lock"
          tag={t("ZS-001")}
          labelPosition="left"
        />

        {/* === CHAMBER LEAK SENSOR — leak detector probe in the internal chamber === */}
        {/* Two-prong electrode at the bottom-LEFT of the internal chamber, opposite  */}
        {/* the maintenance door. If water reaches it (e.g. a window/seal failure),   */}
        {/* the HV is interlocked off as an emergency response.                       */}
        <ChamberLeakSensor
          x={760}
          y={398}
          dry={sampleState.chamberLeakOk}
          tag={t("LD-001")}
        />

        {/* === MAINTENANCE DOOR — access panel at the bottom-RIGHT of the internal chamber === */}
        {/* Opens for service on the tube/detector side; while open the HV is interlocked off. */}
        <MaintenanceDoor
          x={806}
          y={398}
          width={48}
          height={8}
          closed={sampleState.maintenanceDoorClosed}
          openAngle={30}
        />


        {/* === FLOW METER — inline flow element just BEFORE the analysis chamber inlet === */}
        {/* Co-located with the inlet pressure switch (PS on the left, FE on the right) */}
        {/* so the two critical inlet readings sit together right at the chamber.         */}
        <FlowMeter
          x={660}
          y={288}
          flowRate={sampleState.flowRate}
          active={sampleState.flowRate > 0.1}
          tag={t("FE-101")}
          displaySide="right"
        />

        {/* === FLOW METER — inline flow element at the chamber outlet === */}
        {/* Measures the flow exiting the analysis chamber, before the drain joins  */}
        {/* the retro-in line. Display sits to the left like the inlet meter.       */}
        <FlowMeter
          x={660}
          y={450}
          flowRate={sampleState.flowRateOut}
          active={sampleState.flowRateOut > 0.1}
          tag={t("FE-102")}
        />

        {/* === PRESSURE SWITCH — measures pressure of sample entering the analysis chamber === */}
        {/* Tapped just above the chamber inlet (after the bypass merges). */}
        <PressureSwitch
          x={610}
          y={265}
          pressureOk={sampleState.pressureOk}
          connectX={660}
          connectY={270}
          label="Pressure"
          tag={t("PS-101")}
        />

        {/* === OUTLET VALVE — on the analysis chamber drain, before off-screen vent === */}
        <BallValve
          x={660}
          y={532}
          isOpen={sampleState.outletValve}
          label="Outlet Valve"
          tag={t("PV-301")}
          labelPosition="right"
          orientation="vertical"
        />

      </svg>
    </div>
  );
}
