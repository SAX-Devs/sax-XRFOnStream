import type { Database } from "./database";

/** Fila de device_telemetry en Supabase. Los tipos de dominio viven en @sax/xrf-core/types/telemetry. */
export type TelemetryRow =
  Database["public"]["Tables"]["device_telemetry"]["Row"];
