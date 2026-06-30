// generate-provision-package.mjs — build the Edge Gateway provision package for a device.
//
// Cross-platform (Node, no jq). For a device serial it: resolves the device,
// reads its secret + MQTT creds (RPC get_device_provisioning), registers the
// device's MQTT user + ACL in EMQX (built-in database backend), and writes
// provision.json + secret files + a tarball under provisioning/<SERIAL>/.
//
// Usage:  node scripts/generate-provision-package.mjs <DEVICE_SERIAL>
// Reads repo-root .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   EMQX_HTTP_API_URL, EMQX_HTTP_API_KEY, EMQX_HTTP_API_SECRET,
//   EMQX_BROKER_URL, EMQX_BROKER_PORT
//
// NOTE: the EMQX calls assume the built-in-database authn/authz backend (the
// EMQX Serverless default). Adjust EMQX_AUTHN_ID if your deployment differs.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERIAL = process.argv[2];
if (!SERIAL) {
  console.error("Usage: node scripts/generate-provision-package.mjs <DEVICE_SERIAL>");
  process.exit(1);
}

function envVal(name) {
  const line = fs
    .readFileSync(path.join(REPO_ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(name + "="));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const SUPABASE_URL = envVal("NEXT_PUBLIC_SUPABASE_URL");
const SRK = envVal("SUPABASE_SERVICE_ROLE_KEY");
const EMQX_API = envVal("EMQX_HTTP_API_URL"); // https://xxxx.emqxsl.com:8443
const EMQX_KEY = envVal("EMQX_HTTP_API_KEY");
const EMQX_SECRET = envVal("EMQX_HTTP_API_SECRET");
const BROKER_HOST = envVal("EMQX_BROKER_URL").replace(/^[a-z]+:\/\//, "");
const BROKER_PORT = envVal("EMQX_BROKER_PORT") || "8883";
const EMQX_AUTHN_ID = "password_based:built_in_database";

for (const [k, v] of Object.entries({ SUPABASE_URL, SRK, EMQX_API, EMQX_KEY, EMQX_SECRET, BROKER_HOST })) {
  if (!v) { console.error(`ERROR: missing ${k} in .env`); process.exit(1); }
}

const sb = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };
const emqxAuth = "Basic " + Buffer.from(`${EMQX_KEY}:${EMQX_SECRET}`).toString("base64");

async function main() {
  console.log(`==> Provisioning device: ${SERIAL}`);

  // 1. resolve device
  const devs = await fetch(
    `${SUPABASE_URL}/rest/v1/devices?serial=eq.${SERIAL}&select=id,tenant_id`,
    { headers: sb }
  ).then((r) => r.json());
  const device = devs[0];
  if (!device) { console.error(`ERROR: device with serial '${SERIAL}' not found`); process.exit(1); }
  console.log(`    device_id=${device.id}  tenant_id=${device.tenant_id}`);

  // 2. read provisioning bundle (RPC)
  const prov = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_device_provisioning`, {
    method: "POST",
    headers: sb,
    body: JSON.stringify({ p_device_id: device.id }),
  }).then((r) => r.json());
  const bundle = prov[0];
  if (!bundle || !bundle.hmac_secret_hex) {
    console.error("ERROR: device has no secret (not provisioned in cloud)");
    process.exit(1);
  }
  const { hmac_secret_hex: HMAC_HEX, mqtt_username: MQTT_USER, mqtt_password: MQTT_PASS } = bundle;
  console.log(`    mqtt_username=${MQTT_USER}`);

  // 3. register MQTT user in EMQX (built-in database authn)
  console.log("==> Registering MQTT user in EMQX...");
  const authnRes = await fetch(`${EMQX_API}/api/v5/authentication/${EMQX_AUTHN_ID}/users`, {
    method: "POST",
    headers: { Authorization: emqxAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: MQTT_USER, password: MQTT_PASS }),
  });
  if (authnRes.status === 409) {
    console.log("    user exists, updating password...");
    await fetch(`${EMQX_API}/api/v5/authentication/${EMQX_AUTHN_ID}/users/${MQTT_USER}`, {
      method: "PUT",
      headers: { Authorization: emqxAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ password: MQTT_PASS }),
    });
  } else if (!authnRes.ok) {
    console.error(`ERROR: EMQX authn failed (HTTP ${authnRes.status}): ${await authnRes.text()}`);
    process.exit(1);
  }

  // 4. register ACL rules (built-in database authz), scoped to this device
  const P = `sax/${device.tenant_id}/${device.id}`;
  const rules = [
    { permission: "allow", action: "publish", topic: `${P}/telemetry/#` },
    { permission: "allow", action: "publish", topic: `${P}/spectra` },
    { permission: "allow", action: "publish", topic: `${P}/concentrations` },
    { permission: "allow", action: "publish", topic: `${P}/alerts` },
    { permission: "allow", action: "publish", topic: `${P}/sentinel` },
    { permission: "allow", action: "publish", topic: `${P}/equipment_state` },
    { permission: "allow", action: "publish", topic: `${P}/command/ack` },
    { permission: "allow", action: "publish", topic: `${P}/command/result` },
    { permission: "allow", action: "subscribe", topic: `${P}/command/request` },
  ];
  console.log(`==> Setting EMQX ACL for ${MQTT_USER} (scoped to ${P})...`);
  const putRes = await fetch(
    `${EMQX_API}/api/v5/authorization/sources/built_in_database/rules/users/${MQTT_USER}`,
    {
      method: "PUT",
      headers: { Authorization: emqxAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ username: MQTT_USER, rules }),
    }
  );
  if (!putRes.ok) {
    const postRes = await fetch(
      `${EMQX_API}/api/v5/authorization/sources/built_in_database/rules/users`,
      {
        method: "POST",
        headers: { Authorization: emqxAuth, "Content-Type": "application/json" },
        body: JSON.stringify([{ username: MQTT_USER, rules }]),
      }
    );
    if (!postRes.ok) {
      console.log(
        "    (ACL no aplicada: EMQX no tiene Authorization 'Built-in Database' habilitada. " +
          "El equipo igual funciona por autenticación; la ACL por topic es endurecimiento opcional.)"
      );
    }
  }

  // 5. build the provision package
  const outDir = path.join(REPO_ROOT, "provisioning", SERIAL);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "secrets"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "secrets", "hmac.key"), HMAC_HEX);
  fs.writeFileSync(path.join(outDir, "secrets", "mqtt.password"), MQTT_PASS);
  fs.writeFileSync(path.join(outDir, "secrets", "db.password"), "CHANGE_ME_LOCAL_DB_PASSWORD");

  const provision = {
    device_id: device.id,
    tenant_id: device.tenant_id,
    mqtt: {
      broker_url: BROKER_HOST,
      port: Number(BROKER_PORT),
      client_id: MQTT_USER,
      username: MQTT_USER,
      password_file: "/etc/sax/secrets/mqtt.password",
      use_tls: true,
    },
    hmac_secret_path: "/etc/sax/secrets/hmac.key",
    local_db: {
      host: "localhost",
      port: 5432,
      dbname: "xrfonstream",
      user: "sax",
      password_file: "/etc/sax/secrets/db.password",
    },
    telemetry_interval_s: 2,
    spectra_check_interval_s: 10,
    sentinel_check_interval_s: 5,
    concentrations_check_interval_s: 10,
  };
  fs.writeFileSync(path.join(outDir, "provision.json"), JSON.stringify(provision, null, 4));

  let tarball = path.join(REPO_ROOT, "provisioning", `${SERIAL}.tar.gz`);
  try {
    execSync(`tar -czf "${tarball}" -C "${outDir}" .`, { stdio: "ignore" });
  } catch {
    tarball = `${outDir} (tar no disponible — comprime la carpeta manualmente)`;
  }

  console.log("==> Done.");
  console.log(`    Package : ${tarball}`);
  console.log("    Install on the equipment: provision.json -> /etc/sax/, secrets/* -> /etc/sax/secrets/");
}

main().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
