import type { ModuleName } from "@/types/telemetry";

interface ModuleInfo {
  key: ModuleName;
  label: string;
  description: string;
}

export const EQUIPMENT_MODULES: ModuleInfo[] = [
  {
    key: "generator",
    label: "Generador",
    description: "Tubo de rayos X, alto voltaje y corriente",
  },
  {
    key: "vacuum",
    label: "Vacío",
    description: "Sistema de vacío y válvulas",
  },
  {
    key: "circulation",
    label: "Circulación",
    description: "Bomba peristáltica y flujo de muestra",
  },
  {
    key: "interchanger",
    label: "Intercambiador",
    description: "Posición de cámara y recalibración",
  },
  {
    key: "detector",
    label: "Detector",
    description: "DPP y parámetros MCA",
  },
  {
    key: "temp_control",
    label: "Temperatura",
    description: "Control de temperatura y refrigeración",
  },
  {
    key: "auxiliary",
    label: "Auxiliar",
    description: "Batería, DC y presión de tanque",
  },
];
