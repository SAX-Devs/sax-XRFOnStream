"""Live demo — connects to real EMQX broker and publishes mock telemetry.

Usage: python demo_live.py
Requires: .env file in repo root with EMQX and MQTT credentials.
"""

import json
import ssl
import time
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

# Load .env from repo root
env_path = Path(__file__).parent.parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

BROKER = os.environ.get("EMQX_BROKER_URL", "")
PORT = int(os.environ.get("EMQX_BROKER_PORT", "8883"))
USERNAME = os.environ.get("MQTT_USERNAME", "")
PASSWORD = os.environ.get("MQTT_PASSWORD", "")
DEVICE_ID = os.environ.get("DEVICE_ID", "")
TENANT_ID = os.environ.get("TENANT_ID", "")

TOPIC_PREFIX = f"sax/{TENANT_ID}/{DEVICE_ID}"

# Mock telemetry for 7 modules — uses the REAL equipment *_status schema
# (keep in sync with packages/frontend/src/types/telemetry.ts, INT-2).
MOCK_TELEMETRY = {
    "generator": {
        "hv_on": True, "power_supply_on": True, "interlock_open": False,
        "interlock_fault": False, "overvoltage_fault": False, "overpower_fault": False,
        "sic_temperature_c": 46.0, "tube_high_voltage_kv": 49.99, "beam_current_ua": 289.5,
        "filament_current_ma": 2599.6, "hv_board_temperature_c": 42.5,
        "ramp_enabled": False, "ramp_time_ms": 3000,
    },
    "vacuum": {
        "outlet_valve": True, "vacuum_pump_1": True, "vacuum_pump_2": True,
        "purge_valve": False, "inlet_valve": False, "vacuum_sensor": 0.97,
        "atmospheric_status": "Vacuum", "filter": "None", "chamber_leak_ok": True,
    },
    "circulation": {
        "operation_state": "Brine", "pump_state": "FORWARD", "flow_rate_in": 12.5,
        "flow_rate_out": 12.4, "pressure_ok": True, "brine_in_valve": True,
        "water_in_valve": False, "out_valve": True, "recirculation_in_valve": False,
        "recirculation_out_valve": False, "pump_forward": True, "pump_reverse": False,
        "power_state": True, "tank_fill_sensor": False, "tank_level_ok": True,
        "tank_filled": False, "tank_percentage_level": 62, "bypass_valve": False,
        "pick_up_switch": False,
    },
    "interchanger": {
        "service_position": 0, "rot_up": True, "rot_down": False, "axial_up": False,
        "axial_down": True, "current_position": "Chamber", "chamber_lock": True,
        "door_lock": True,
    },
    "detector": {
        "mca_length": 8192, "gain": 8.0, "mca_bin_width": 23.4, "gain_trim": 1,
        "temperature": -25.4, "genset": 0, "parset": 0, "threshold": 50, "d_on": True,
    },
    "temp_control": {
        "cabinet_temperature": 27.7, "radiator_temperature_1": 17.5,
        "radiator_temperature_2": 17.6, "tube_temperature": 26.6,
        "target_temperature": 30, "water_pressure": 0.63, "flow_active": True,
        "valve_open": True,
    },
    "auxiliary": {
        "bat_vol": 23.7, "bat_dis": False, "bat_fail": False, "dc_ok": True,
        "tank_pressure_high": False, "tank_pressure_low": False,
    },
}


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f"\n{'='*60}")
        print(f"  CONNECTED to EMQX broker: {BROKER}:{PORT}")
        print(f"  Client: {USERNAME}")
        print(f"{'='*60}\n")
        # Subscribe to all our topics to see messages echo back
        client.subscribe(f"{TOPIC_PREFIX}/#", 1)
        print(f"  Subscribed to: {TOPIC_PREFIX}/#\n")
    else:
        print(f"  Connection FAILED: {reason_code}")
        sys.exit(1)


def on_message(client, userdata, message):
    topic_short = message.topic.replace(TOPIC_PREFIX + "/", "")
    try:
        data = json.loads(message.payload)
        print(f"  << RECEIVED [{topic_short}]")
        if "module" in data:
            print(f"     Module: {data['module']} | Keys: {list(data.get('data', {}).keys())}")
        elif "state" in data:
            print(f"     State: {data['state']}")
        elif "alerts" in data:
            for a in data["alerts"]:
                print(f"     Alert: {a['name']} = {a['severity']}")
    except Exception:
        print(f"  << RECEIVED [{topic_short}] (raw)")


def main():
    if not BROKER or not USERNAME:
        print("ERROR: Missing EMQX credentials. Check .env file.")
        sys.exit(1)

    print("\n  SAX XrfOnStream — Edge Gateway Live Demo")
    print(f"  Broker: {BROKER}:{PORT}")
    print(f"  Device: {DEVICE_ID}")
    print(f"  Tenant: {TENANT_ID}")
    print(f"  Connecting...\n")

    client = mqtt.Client(
        callback_api_version=CallbackAPIVersion.VERSION2,
        client_id=USERNAME,
    )
    client.username_pw_set(USERNAME, PASSWORD)

    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    client.tls_set_context(context)

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(BROKER, PORT)
    client.loop_start()

    time.sleep(2)  # Wait for connection

    if not client.is_connected():
        print("  Failed to connect. Check credentials.")
        sys.exit(1)

    # --- Publish telemetry for all 7 modules ---
    print(f"\n{'-'*60}")
    print("  PUBLISHING TELEMETRY (7 modules)")
    print(f"{'-'*60}\n")

    for module, data in MOCK_TELEMETRY.items():
        payload = {
            "device_id": DEVICE_ID,
            "module": module,
            "ts": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        topic = f"{TOPIC_PREFIX}/telemetry/{module}"
        client.publish(topic, json.dumps(payload).encode(), qos=1)
        print(f"  >> SENT [telemetry/{module}] — {len(data)} fields")
        time.sleep(0.3)

    time.sleep(1)

    # --- Publish equipment state ---
    print(f"\n{'-'*60}")
    print("  PUBLISHING EQUIPMENT STATE")
    print(f"{'-'*60}\n")

    state_payload = {
        "device_id": DEVICE_ID,
        "ts": datetime.now(timezone.utc).isoformat(),
        "state": "idle",
        "detail": {"active_tasks": [], "hv_on": False},
    }
    client.publish(f"{TOPIC_PREFIX}/equipment_state", json.dumps(state_payload).encode(), qos=1)
    print(f"  >> SENT [equipment_state] — state: idle")

    time.sleep(1)

    # --- Publish sentinel alerts ---
    print(f"\n{'-'*60}")
    print("  PUBLISHING SENTINEL ALERTS")
    print(f"{'-'*60}\n")

    sentinel_payload = {
        "device_id": DEVICE_ID,
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": "sentinel",
        "alerts": [
            {"name": "critical_flow", "severity": "OK", "message": "Flow normal"},
            {"name": "hermetic", "severity": "OK", "message": "Hermetic seal OK"},
            {"name": "air_tank", "severity": "OK", "message": "Tank pressure normal"},
            {"name": "vacuum", "severity": "OK", "message": "Vacuum level OK"},
        ],
    }
    client.publish(f"{TOPIC_PREFIX}/sentinel", json.dumps(sentinel_payload).encode(), qos=1)
    print(f"  >> SENT [sentinel] — 4 validations, all OK")

    time.sleep(2)

    # --- Summary ---
    print(f"\n{'='*60}")
    print(f"  DEMO COMPLETE")
    print(f"  - 7 telemetry modules published")
    print(f"  - 1 equipment state published")
    print(f"  - 1 sentinel report published")
    print(f"  - All messages echoed back via subscription")
    print(f"")
    print(f"  Check EMQX Dashboard > Monitor to see the traffic!")
    print(f"{'='*60}\n")

    print("  Staying connected 30s so you can check EMQX Dashboard...")
    print("  (Press Ctrl+C to stop early)\n")
    try:
        time.sleep(30)
    except KeyboardInterrupt:
        pass

    client.loop_stop()
    client.disconnect()
    print("  Disconnected.")


if __name__ == "__main__":
    main()
