import type { Database } from "./database";

/** Fila de command_audit en Supabase. Los tipos de dominio viven en @sax/xrf-core/types/commands. */
export type CommandAuditRow =
  Database["public"]["Tables"]["command_audit"]["Row"];
