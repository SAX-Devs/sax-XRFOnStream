#!/usr/bin/env bash
#
# generate-provision-package.sh — build the Edge Gateway provision package for a device.
#
# For a given device serial it:
#   1. resolves the device (id + tenant) from Supabase
#   2. reads its HMAC secret + MQTT credentials (RPC get_device_provisioning, 00015)
#   3. registers the device's MQTT user + ACL in EMQX (built-in database backend)
#   4. writes provision.json + secret files and a tarball to install on the equipment
#
# The device must already exist and be provisioned in the cloud (createDevice
# generates its secret/creds). This script READS those — it does not generate new
# ones — so the secret matches what the command Route Handler signs with.
#
# Usage:
#   ./scripts/generate-provision-package.sh <DEVICE_SERIAL>
#
# Requires: bash, curl, jq. Reads the repo-root .env for:
#   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#   EMQX_HTTP_API_URL, EMQX_HTTP_API_KEY, EMQX_HTTP_API_SECRET,
#   EMQX_BROKER_URL, EMQX_BROKER_PORT
#
# NOTE: the EMQX calls assume the built-in-database authn/authz backend (the
# EMQX Serverless default). If your deployment uses a different backend, adjust
# the EMQX_AUTHN_ID / endpoints below.

set -euo pipefail

SERIAL="${1:?Usage: $0 <DEVICE_SERIAL>}"

# --- locate repo root + load .env -------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found"; exit 1; }
command -v jq   >/dev/null || { echo "ERROR: jq is required"; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl is required"; exit 1; }

# read a KEY=VALUE from .env (strips quotes/CR)
envval() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r"' ; }

SUPABASE_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"
SRK="$(envval SUPABASE_SERVICE_ROLE_KEY)"
EMQX_API="$(envval EMQX_HTTP_API_URL)"          # e.g. https://xxxx.emqxsl.com:8443
EMQX_KEY="$(envval EMQX_HTTP_API_KEY)"
EMQX_SECRET="$(envval EMQX_HTTP_API_SECRET)"
BROKER_HOST="$(envval EMQX_BROKER_URL | sed -E 's#^[a-z]+://##')"
BROKER_PORT="$(envval EMQX_BROKER_PORT)"
BROKER_PORT="${BROKER_PORT:-8883}"

EMQX_AUTHN_ID="password_based:built_in_database"

for v in SUPABASE_URL SRK EMQX_API EMQX_KEY EMQX_SECRET BROKER_HOST; do
  [ -n "${!v}" ] || { echo "ERROR: missing $v in .env"; exit 1; }
done

echo "==> Provisioning device: $SERIAL"

# --- 1. resolve device ------------------------------------------------------
device_json="$(curl -fsS -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "$SUPABASE_URL/rest/v1/devices?serial=eq.$SERIAL&select=id,tenant_id")"
DEVICE_ID="$(echo "$device_json" | jq -r '.[0].id // empty')"
TENANT_ID="$(echo "$device_json" | jq -r '.[0].tenant_id // empty')"
[ -n "$DEVICE_ID" ] || { echo "ERROR: device with serial '$SERIAL' not found"; exit 1; }
echo "    device_id=$DEVICE_ID  tenant_id=$TENANT_ID"

# --- 2. read provisioning bundle (RPC) --------------------------------------
prov_json="$(curl -fsS -X POST \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d "{\"p_device_id\":\"$DEVICE_ID\"}" \
  "$SUPABASE_URL/rest/v1/rpc/get_device_provisioning")"
HMAC_HEX="$(echo "$prov_json" | jq -r '.[0].hmac_secret_hex // empty')"
MQTT_USER="$(echo "$prov_json" | jq -r '.[0].mqtt_username // empty')"
MQTT_PASS="$(echo "$prov_json" | jq -r '.[0].mqtt_password // empty')"
[ -n "$HMAC_HEX" ] || { echo "ERROR: device has no secret (not provisioned in cloud)"; exit 1; }
echo "    mqtt_username=$MQTT_USER"

# --- 3. register MQTT user in EMQX (built-in database authn) ----------------
echo "==> Registering MQTT user in EMQX..."
authn_code="$(curl -s -o /dev/null -w '%{http_code}' -u "$EMQX_KEY:$EMQX_SECRET" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$MQTT_USER\",\"password\":\"$MQTT_PASS\"}" \
  "$EMQX_API/api/v5/authentication/$EMQX_AUTHN_ID/users")"
if [ "$authn_code" = "409" ]; then
  echo "    user exists, updating password..."
  curl -fsS -u "$EMQX_KEY:$EMQX_SECRET" -X PUT -H "Content-Type: application/json" \
    -d "{\"password\":\"$MQTT_PASS\"}" \
    "$EMQX_API/api/v5/authentication/$EMQX_AUTHN_ID/users/$MQTT_USER" >/dev/null
elif [ "${authn_code:0:1}" != "2" ]; then
  echo "ERROR: EMQX authn user creation failed (HTTP $authn_code)"; exit 1
fi

# --- 4. register ACL rules (built-in database authz), scoped to this device --
P="sax/$TENANT_ID/$DEVICE_ID"
rules="$(jq -n --arg p "$P" '[
  {permission:"allow",action:"publish",  topic:($p+"/telemetry/#")},
  {permission:"allow",action:"publish",  topic:($p+"/spectra")},
  {permission:"allow",action:"publish",  topic:($p+"/concentrations")},
  {permission:"allow",action:"publish",  topic:($p+"/alerts")},
  {permission:"allow",action:"publish",  topic:($p+"/sentinel")},
  {permission:"allow",action:"publish",  topic:($p+"/equipment_state")},
  {permission:"allow",action:"publish",  topic:($p+"/command/ack")},
  {permission:"allow",action:"publish",  topic:($p+"/command/result")},
  {permission:"allow",action:"subscribe",topic:($p+"/command/request")}
]')"
echo "==> Setting EMQX ACL for $MQTT_USER (scoped to $P)..."
# PUT is idempotent (replaces the user's rule set); falls back to POST to create.
put_code="$(curl -s -o /dev/null -w '%{http_code}' -u "$EMQX_KEY:$EMQX_SECRET" \
  -X PUT -H "Content-Type: application/json" \
  -d "{\"username\":\"$MQTT_USER\",\"rules\":$rules}" \
  "$EMQX_API/api/v5/authorization/sources/built_in_database/rules/users/$MQTT_USER")"
if [ "${put_code:0:1}" != "2" ]; then
  curl -fsS -u "$EMQX_KEY:$EMQX_SECRET" -X POST -H "Content-Type: application/json" \
    -d "[{\"username\":\"$MQTT_USER\",\"rules\":$rules}]" \
    "$EMQX_API/api/v5/authorization/sources/built_in_database/rules/users" >/dev/null
fi

# --- 5. build the provision package -----------------------------------------
OUT_DIR="$REPO_ROOT/provisioning/$SERIAL"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/secrets"

printf '%s' "$HMAC_HEX"  > "$OUT_DIR/secrets/hmac.key"        # hex text; gateway does bytes.fromhex
printf '%s' "$MQTT_PASS" > "$OUT_DIR/secrets/mqtt.password"
printf '%s' "CHANGE_ME_LOCAL_DB_PASSWORD" > "$OUT_DIR/secrets/db.password"  # fill at install
chmod 600 "$OUT_DIR/secrets/"*

cat > "$OUT_DIR/provision.json" <<JSON
{
    "device_id": "$DEVICE_ID",
    "tenant_id": "$TENANT_ID",
    "mqtt": {
        "broker_url": "$BROKER_HOST",
        "port": $BROKER_PORT,
        "client_id": "$MQTT_USER",
        "username": "$MQTT_USER",
        "password_file": "/etc/sax/secrets/mqtt.password",
        "use_tls": true
    },
    "hmac_secret_path": "/etc/sax/secrets/hmac.key",
    "local_db": {
        "host": "localhost",
        "port": 5432,
        "dbname": "xrfonstream",
        "user": "sax",
        "password_file": "/etc/sax/secrets/db.password"
    },
    "telemetry_interval_s": 2,
    "spectra_check_interval_s": 10,
    "sentinel_check_interval_s": 5,
    "concentrations_check_interval_s": 10
}
JSON

TARBALL="$REPO_ROOT/provisioning/${SERIAL}.tar.gz"
tar -czf "$TARBALL" -C "$OUT_DIR" .

echo "==> Done."
echo "    Package : $TARBALL"
echo "    Contents: provision.json + secrets/{hmac.key,mqtt.password,db.password}"
echo ""
echo "    Install on the equipment:"
echo "      - provision.json -> /etc/sax/provision.json"
echo "      - secrets/*      -> /etc/sax/secrets/  (set db.password to the local PostgreSQL password)"
