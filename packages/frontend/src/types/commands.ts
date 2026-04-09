import type { Database } from "./database";

export type CommandAuditRow =
  Database["public"]["Tables"]["command_audit"]["Row"];

export interface CommandRequest {
  module: string;
  command: string;
  args?: Record<string, string>;
}

export interface CommandResponse {
  command_id: string;
  status: "sent";
}

export interface CommandError {
  error: string;
  detail?: string;
}
