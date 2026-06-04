"use client";

import { ProcessDiagram } from "./process-diagram";
import { DiagramHeader } from "./diagram-header";
import { ParamsPanel } from "./params-panel";
import { MessagesPanel } from "./messages-panel";
import { StatusPanel } from "./status-panel";
import { SpectrumButton, StopButton } from "./control-bar";

interface ScadaScreenProps {
  userLabel?: string;
  userRole?: string;
}

export function ScadaScreen({ userLabel, userRole }: ScadaScreenProps) {
  // P&ID tags are clutter for the operator view; only show them in the Service screen.
  const showTags = userRole === "service";

  return (
    <div className="space-y-3">
      <DiagramHeader userLabel={userLabel} userRole={userRole} />

      <div className="grid grid-cols-[180px_minmax(0,1fr)_185px] gap-3 items-start">
        {/* Left column — Spectrum, Stop, Status, Messages */}
        <div className="flex flex-col gap-3">
          <SpectrumButton />
          <StopButton />
          <StatusPanel />
          <MessagesPanel />
        </div>

        {/* Center — process diagram */}
        <ProcessDiagram showTags={showTags} />

        {/* Right column — parameters */}
        <ParamsPanel />
      </div>
    </div>
  );
}
