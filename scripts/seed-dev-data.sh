#!/usr/bin/env bash
# seed-dev-data.sh — Inserts mock data into Supabase for development
# Usage: ./scripts/seed-dev-data.sh
# Requires: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env"

API_URL="${NEXT_PUBLIC_SUPABASE_URL}/rest/v1"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
APIKEY_HEADER="apikey: ${SUPABASE_SERVICE_ROLE_KEY}"
CONTENT_TYPE="Content-Type: application/json"

TENANT_ID="a1b2c3d4-0000-0000-0000-000000000001"
DEVICE_ID="d1e2f3a4-0000-0000-0000-000000000001"

echo "=== SAX IoT — Seed Dev Data ==="

# 1. Create tenant
echo "[1/4] Creating tenant..."
curl -s -X POST "$API_URL/tenants" \
  -H "$AUTH_HEADER" -H "$APIKEY_HEADER" -H "$CONTENT_TYPE" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{\"id\": \"$TENANT_ID\", \"name\": \"Minera Demo\", \"slug\": \"minera-demo\"}" \
  > /dev/null

# 2. Create device
echo "[2/4] Creating device..."
curl -s -X POST "$API_URL/devices" \
  -H "$AUTH_HEADER" -H "$APIKEY_HEADER" -H "$CONTENT_TYPE" \
  -H "Prefer: resolution=merge-duplicates" \
  -d "{\"id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"serial\": \"XRF-DEV-001\", \"label\": \"Equipo Demo Lab\", \"status\": \"active\", \"mqtt_client_id\": \"xrf-dev-001\", \"provisioned_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  > /dev/null

# 3. Create test user in Supabase Auth
echo "[3/4] Creating test user..."
curl -s -X POST "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users" \
  -H "$AUTH_HEADER" -H "$APIKEY_HEADER" -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"dev@sax.cl\",
    \"password\": \"devpassword123\",
    \"email_confirm\": true,
    \"app_metadata\": {
      \"tenant_id\": \"$TENANT_ID\",
      \"role\": \"sax_admin\"
    }
  }" > /dev/null

# 4. Insert mock telemetry
echo "[4/4] Inserting mock telemetry..."
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST "$API_URL/device_telemetry" \
  -H "$AUTH_HEADER" -H "$APIKEY_HEADER" -H "$CONTENT_TYPE" \
  -d "[
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"generator\", \"data\": {\"tube_high_voltage_kv\": 30.0, \"beam_current_ua\": 100.0, \"hv_on\": false, \"sic_temperature_c\": 42.5, \"power_supply_on\": true}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"vacuum\", \"data\": {\"vacuum_sensor\": 0.85, \"atmospheric_status\": false, \"chamber_liquid_sensor\": false}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"circulation\", \"data\": {\"operation_state\": \"ready\", \"pump_state\": true, \"flow_rate_in\": 2.5, \"flow_rate_out\": 2.4}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"interchanger\", \"data\": {\"current_position\": 1, \"service_position\": false, \"chamber_lock\": true, \"door_lock\": true}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"detector\", \"data\": {\"mca_length\": 2048, \"gain\": 1.0, \"temperature\": -25.3, \"d_on\": true, \"threshold\": 50}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"temp_control\", \"data\": {\"water_pressure\": 1.2, \"flow_active\": true, \"valve_open\": true, \"temperature_in\": 22.1, \"temperature_out\": 24.8}, \"device_ts\": \"$NOW\"},
    {\"device_id\": \"$DEVICE_ID\", \"tenant_id\": \"$TENANT_ID\", \"module\": \"auxiliary\", \"data\": {\"bat_vol\": 24.1, \"bat_fail\": false, \"bat_dis\": false, \"dc_ok\": true}, \"device_ts\": \"$NOW\"}
  ]" > /dev/null

echo ""
echo "=== Done ==="
echo "Tenant ID:  $TENANT_ID"
echo "Device ID:  $DEVICE_ID"
echo "Test user:  dev@sax.cl / devpassword123 (role: sax_admin)"
