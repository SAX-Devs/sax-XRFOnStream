// seed-dev-data.mjs — seed Supabase with development data.
//
// Idempotent. Creates the demo tenant + device (provisioned), the dev user with
// its protected user_profiles row (migration 00013), and one telemetry row per
// module using the REAL equipment *_status schema. Run after applying migrations.
//
// Usage:  node scripts/seed-dev-data.mjs
// Reads repo-root .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOTE on field names: telemetry "data" mirrors the equipment's *_status columns
// verbatim (the Edge Gateway publishes the raw row). Keep in sync with
// packages/frontend/src/types/telemetry.ts (integration point INT-2).

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function envVal(name) {
  const line = fs
    .readFileSync(path.join(REPO_ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(name + "="));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const URL = envVal("NEXT_PUBLIC_SUPABASE_URL");
const SRK = envVal("SUPABASE_SERVICE_ROLE_KEY");
if (!URL || !SRK) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env");

const TENANT_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const DEVICE_ID = "d1e2f3a4-0000-0000-0000-000000000001";
const DEV_EMAIL = "dev@sax.cl";
const DEV_PASSWORD = "devpassword123";

const rest = (p) => `${URL}/rest/v1/${p}`;
const headers = {
  apikey: SRK,
  Authorization: `Bearer ${SRK}`,
  "Content-Type": "application/json",
};

async function req(method, url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function main() {
  // 1. Tenant (upsert)
  console.log("[1/6] tenant...");
  await req(
    "POST",
    rest("tenants"),
    { id: TENANT_ID, name: "Minera Demo", slug: "minera-demo" },
    { Prefer: "resolution=merge-duplicates" }
  );

  // 2. Device (upsert, active + provisioned)
  console.log("[2/6] device...");
  await req(
    "POST",
    rest("devices"),
    {
      id: DEVICE_ID,
      tenant_id: TENANT_ID,
      serial: "XRF-DEV-001",
      label: "Equipo Demo Lab",
      status: "active",
      mqtt_client_id: "xrf-dev-001",
    },
    { Prefer: "resolution=merge-duplicates" }
  );

  // 3. Provision the device secret (so commands work). Generates HMAC + MQTT creds.
  console.log("[3/6] device secret (provision)...");
  const hmacHex = randomBytes(32).toString("hex");
  await req("POST", rest("rpc/upsert_device_secret"), {
    p_device_id: DEVICE_ID,
    p_hmac_secret_hex: hmacHex,
    p_mqtt_username: "xrf-dev-001",
    p_mqtt_password: randomBytes(18).toString("base64url"),
  });

  // 4. Dev user (create if absent, then resolve id)
  console.log("[4/6] dev user...");
  await req("POST", `${URL}/auth/v1/admin/users`, {
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
    app_metadata: { tenant_id: TENANT_ID, role: "sax_admin" },
  });
  const list = await req(
    "GET",
    `${URL}/auth/v1/admin/users?per_page=200`
  );
  const users = JSON.parse(list.text).users ?? [];
  const devUser = users.find((u) => u.email === DEV_EMAIL);
  if (!devUser) throw new Error("dev user not found after creation");

  // 5. Protected profile (source of truth for role/tenant since 00013)
  console.log("[5/6] user_profile...");
  await req(
    "POST",
    rest("user_profiles"),
    { user_id: devUser.id, tenant_id: TENANT_ID, role: "sax_admin" },
    { Prefer: "resolution=merge-duplicates" }
  );

  // 6. Telemetry — one row per module, REAL *_status schema
  console.log("[6/6] telemetry...");
  const now = new Date().toISOString();
  const modules = {
    generator: {
      hv_on: true, power_supply_on: true, interlock_open: false,
      interlock_fault: false, overvoltage_fault: false, overpower_fault: false,
      sic_temperature_c: 46.0, tube_high_voltage_kv: 49.99, beam_current_ua: 289.5,
      filament_current_ma: 2599.6, hv_board_temperature_c: 42.5, ramp_enabled: false,
      ramp_time_ms: 3000,
    },
    vacuum: {
      outlet_valve: true, vacuum_pump_1: true, vacuum_pump_2: true, purge_valve: false,
      inlet_valve: false, vacuum_sensor: 0.97, atmospheric_status: "Vacuum",
      filter: "None", chamber_leak_ok: true,
    },
    circulation: {
      operation_state: "Brine", pump_state: "FORWARD", flow_rate_in: 12.5,
      flow_rate_out: 12.4, pressure_ok: true, brine_in_valve: true, water_in_valve: false,
      out_valve: true, recirculation_in_valve: false, recirculation_out_valve: false,
      pump_forward: true, pump_reverse: false, power_state: true, tank_fill_sensor: false,
      tank_level_ok: true, tank_filled: false, tank_percentage_level: 62,
      bypass_valve: false, pick_up_switch: false,
    },
    interchanger: {
      service_position: 0, rot_up: true, rot_down: false, axial_up: false,
      axial_down: true, current_position: "Chamber", chamber_lock: true, door_lock: true,
    },
    detector: {
      mca_length: 8192, gain: 8.0, mca_bin_width: 23.4, gain_trim: 1, temperature: -25.4,
      genset: 0, parset: 0, threshold: 50, d_on: true,
    },
    temp_control: {
      cabinet_temperature: 27.7, radiator_temperature_1: 17.5, radiator_temperature_2: 17.6,
      tube_temperature: 26.6, target_temperature: 30, water_pressure: 0.63,
      flow_active: true, valve_open: true,
    },
    auxiliary: {
      bat_vol: 23.7, bat_dis: false, bat_fail: false, dc_ok: true,
      tank_pressure_high: false, tank_pressure_low: false,
    },
  };
  const rows = Object.entries(modules).map(([module, data]) => ({
    device_id: DEVICE_ID,
    tenant_id: TENANT_ID,
    module,
    data,
    device_ts: now,
  }));
  await req("POST", rest("device_telemetry"), rows);

  console.log("\n=== Done ===");
  console.log("Tenant:", TENANT_ID);
  console.log("Device:", DEVICE_ID, "(XRF-DEV-001, provisioned)");
  console.log("User:  ", DEV_EMAIL, "/", DEV_PASSWORD, "(sax_admin)");
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
