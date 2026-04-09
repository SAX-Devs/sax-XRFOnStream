/**
 * Supabase database types.
 *
 * TODO: Replace with auto-generated types when available:
 *   npx supabase gen types typescript --project-id ndnijhnpfzxanadtfflb > src/types/database.ts
 *
 * For now, these manual types match the schema defined in
 * supabase/migrations/00001–00011.
 */

export type DeviceStatusEnum =
  | "pending_activation"
  | "active"
  | "offline"
  | "maintenance"
  | "decommissioned";

export type CommandStatusEnum =
  | "sent"
  | "delivered"
  | "ack"
  | "executing"
  | "completed"
  | "error"
  | "rejected"
  | "expired";

export type AlertSeverityEnum =
  | "info"
  | "warning"
  | "critical"
  | "emergency";

export type EquipmentStateEnum =
  | "unknown"
  | "idle"
  | "measuring"
  | "initializing"
  | "standby"
  | "error"
  | "offline";

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          tenant_id: string;
          serial: string;
          label: string | null;
          status: DeviceStatusEnum;
          firmware_version: string | null;
          last_seen_at: string | null;
          mqtt_client_id: string | null;
          provisioned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          serial: string;
          label?: string | null;
          status?: DeviceStatusEnum;
        };
        Update: {
          label?: string | null;
          status?: DeviceStatusEnum;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      device_telemetry: {
        Row: {
          id: number;
          device_id: string;
          tenant_id: string;
          module: string;
          data: Record<string, unknown>;
          device_ts: string;
          received_at: string;
        };
        Insert: {
          device_id: string;
          tenant_id: string;
          module: string;
          data: Record<string, unknown>;
          device_ts: string;
        };
        Update: never;
        Relationships: [];
      };
      device_spectra: {
        Row: {
          id: number;
          device_id: string;
          tenant_id: string;
          measurement_id: string | null;
          spectra_data: Record<string, unknown> | null;
          run_data: Record<string, unknown> | null;
          storage_path: string | null;
          device_ts: string;
          received_at: string;
        };
        Insert: {
          device_id: string;
          tenant_id: string;
          measurement_id?: string | null;
          spectra_data?: Record<string, unknown> | null;
          run_data?: Record<string, unknown> | null;
          storage_path?: string | null;
          device_ts: string;
        };
        Update: never;
        Relationships: [];
      };
      command_audit: {
        Row: {
          id: string;
          device_id: string;
          tenant_id: string;
          issued_by: string;
          issued_by_email: string;
          issued_by_role: string;
          module: string;
          command: string;
          args: Record<string, unknown> | null;
          status: CommandStatusEnum;
          error_message: string | null;
          sent_at: string;
          ack_at: string | null;
          completed_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          tenant_id: string;
          issued_by: string;
          issued_by_email: string;
          issued_by_role: string;
          module: string;
          command: string;
          args?: Record<string, unknown> | null;
          expires_at: string;
        };
        Update: {
          status?: CommandStatusEnum;
          error_message?: string | null;
          ack_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: number;
          device_id: string;
          tenant_id: string;
          severity: AlertSeverityEnum;
          source: string;
          title: string;
          detail: Record<string, unknown> | null;
          ack_by: string | null;
          ack_at: string | null;
          device_ts: string;
          received_at: string;
        };
        Insert: {
          device_id: string;
          tenant_id: string;
          severity: AlertSeverityEnum;
          source: string;
          title: string;
          detail?: Record<string, unknown> | null;
          device_ts: string;
        };
        Update: {
          ack_by?: string | null;
          ack_at?: string | null;
        };
        Relationships: [];
      };
      device_equipment_state: {
        Row: {
          device_id: string;
          tenant_id: string;
          state: EquipmentStateEnum;
          detail: Record<string, unknown> | null;
          device_ts: string;
          received_at: string;
        };
        Insert: {
          device_id: string;
          tenant_id: string;
          state: EquipmentStateEnum;
          detail?: Record<string, unknown> | null;
          device_ts: string;
        };
        Update: {
          state?: EquipmentStateEnum;
          detail?: Record<string, unknown> | null;
          device_ts?: string;
        };
        Relationships: [];
      };
      device_concentrations: {
        Row: {
          id: number;
          device_id: string;
          tenant_id: string;
          measurement_id: string | null;
          elements: Record<string, number>;
          device_ts: string;
          received_at: string;
        };
        Insert: {
          device_id: string;
          tenant_id: string;
          measurement_id?: string | null;
          elements: Record<string, number>;
          device_ts: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      device_status_enum: DeviceStatusEnum;
      command_status_enum: CommandStatusEnum;
      alert_severity_enum: AlertSeverityEnum;
      equipment_state_enum: EquipmentStateEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
