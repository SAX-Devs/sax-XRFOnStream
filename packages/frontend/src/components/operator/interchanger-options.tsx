"use client";

import { ActionCard, type ActionOption, type StateTone } from "./action-card";
import type { InterchangerData } from "@/types/telemetry";
import type { InflightAction } from "@/hooks/use-action-runner";
import { TERMINAL_STAGES } from "@/hooks/use-action-runner";

/**
 * "Opciones" cards for the INTERCHANGER module — the first module of the
 * operator screen rollout (SAX-selected actions):
 *
 *   cam_interchange  — full arm position change (Chamber ↔ Recal), the
 *                      equipment runs the whole axial→rot→axial sequence.
 *   usage_axial      — small piston UP/DOWN (needs rotational sensors).
 *   usage_rot        — large piston UP/DOWN (needs axial piston UP).
 *
 * Current states come straight from interchanger_status telemetry
 * (current_position + the four piston sensors).
 */

/** Visual timeouts: equipment-side timeouts (5s/20s/sequence) + travel margin. */
export const INTERCHANGER_TIMEOUTS: Record<string, number> = {
  cam_interchange: 90_000,
  usage_axial: 15_000,
  usage_rot: 40_000,
};

interface PistonState {
  label: string;
  tone: StateTone;
  pulse: boolean;
  /** 'true' (UP) | 'false' (DOWN) when a definite position is reported. */
  value: string | null;
}

function pistonState(up?: boolean, down?: boolean): PistonState {
  if (up && !down) return { label: "UP", tone: "ok", pulse: false, value: "true" };
  if (down && !up) return { label: "DOWN", tone: "info", pulse: false, value: "false" };
  if (!up && !down)
    return { label: "En tránsito", tone: "moving", pulse: true, value: null };
  return { label: "Sensores ⚠", tone: "warn", pulse: false, value: null };
}

interface InterchangerOptionsProps {
  data: InterchangerData | null;
  /** In-flight/failed action currently occupying the interchanger module. */
  action: InflightAction | null;
  disabled: boolean;
  onRun: (
    command: string,
    args: Record<string, string>,
    label: string,
    timeoutMs: number
  ) => void;
  onDismiss: () => void;
  /** Bumped when the diagram's interchanger is clicked. */
  focusSignal: number;
}

export function InterchangerOptions({
  data,
  action,
  disabled,
  onRun,
  onDismiss,
  focusSignal,
}: InterchangerOptionsProps) {
  const axial = pistonState(data?.axial_up, data?.axial_down);
  const rot = pistonState(data?.rot_up, data?.rot_down);
  const position = data?.current_position ?? null;

  const busy =
    !!action && !TERMINAL_STAGES.includes(action.stage) && action.stage !== "timeout";

  const cardProps = (command: string) => ({
    inflight: action?.command === command ? action : null,
    lockedBy: busy && action?.command !== command ? action!.label : null,
    onDismiss,
    focusSignal,
    disabled,
  });

  // --- cam_interchange -------------------------------------------------
  const camOptions: ActionOption[] = [
    {
      value: "Chamber",
      label: "Chamber",
      hint: "Brazo fuera — medición normal",
      isCurrent: position === "Chamber",
    },
    {
      value: "Recal",
      label: "Recal",
      hint: "Muestra de recalibración en la ventana",
      isCurrent: position === "Recal",
    },
  ];

  // --- usage_axial ------------------------------------------------------
  const axialOptions: ActionOption[] = [
    {
      value: "true",
      label: "Subir (UP)",
      hint: "Pistón axial a posición superior",
      isCurrent: axial.value === "true",
    },
    {
      value: "false",
      label: "Bajar (DOWN)",
      hint: "Pistón axial a posición de transición",
      isCurrent: axial.value === "false",
    },
  ];
  const rotSensorsSilent = !!data && !data.rot_up && !data.rot_down;

  // --- usage_rot ---------------------------------------------------------
  const rotOptions: ActionOption[] = [
    {
      value: "true",
      label: "Subir (UP)",
      hint: "Pistón rotacional a posición superior",
      isCurrent: rot.value === "true",
    },
    {
      value: "false",
      label: "Bajar (DOWN)",
      hint: "Pistón rotacional a posición inferior",
      isCurrent: rot.value === "false",
    },
  ];
  const axialNotUp = !!data && axial.value !== "true";

  return (
    <div className="space-y-3">
      <ActionCard
        title="Posición del brazo"
        command="cam_interchange"
        stateLabel={position ?? "—"}
        stateTone={
          position === "Recal" ? "moving" : position ? "info" : "unknown"
        }
        statePulse={busy && action?.command === "cam_interchange"}
        requirement="Secuencia automática: axial ↓ → rotación → axial ↑"
        options={camOptions}
        onRun={(opt) =>
          onRun(
            "cam_interchange",
            { arg1: opt.value },
            `Brazo → ${opt.label}`,
            INTERCHANGER_TIMEOUTS.cam_interchange
          )
        }
        {...cardProps("cam_interchange")}
      />

      <ActionCard
        title="Pistón axial"
        command="usage_axial"
        stateLabel={axial.label}
        stateTone={axial.tone}
        statePulse={axial.pulse}
        requirement="Requiere sensores rotacionales activos"
        warning={
          rotSensorsSilent
            ? "Los sensores rotacionales no reportan posición — el equipo puede rechazar el movimiento."
            : null
        }
        options={axialOptions}
        onRun={(opt) =>
          onRun(
            "usage_axial",
            { arg1: opt.value, arg2: "5" },
            `Pistón axial → ${opt.value === "true" ? "UP" : "DOWN"}`,
            INTERCHANGER_TIMEOUTS.usage_axial
          )
        }
        {...cardProps("usage_axial")}
      />

      <ActionCard
        title="Pistón rotacional"
        command="usage_rot"
        stateLabel={rot.label}
        stateTone={rot.tone}
        statePulse={rot.pulse}
        requirement="Requiere el pistón axial en UP"
        warning={
          axialNotUp
            ? "El pistón axial no está en UP — el equipo verificará esta condición antes de mover."
            : null
        }
        options={rotOptions}
        onRun={(opt) =>
          onRun(
            "usage_rot",
            { arg1: opt.value, arg2: "20" },
            `Pistón rotacional → ${opt.value === "true" ? "UP" : "DOWN"}`,
            INTERCHANGER_TIMEOUTS.usage_rot
          )
        }
        {...cardProps("usage_rot")}
      />
    </div>
  );
}
