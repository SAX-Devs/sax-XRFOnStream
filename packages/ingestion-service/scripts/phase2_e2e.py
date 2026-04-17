"""End-to-end validation for Fase 2 acceptance criteria.

Subcommands map 1:1 to the items left unverified after the demo_live.py run:

    python phase2_e2e.py spectra-inline        # spectra <200 KB → JSONB
    python phase2_e2e.py spectra-large         # spectra >200 KB → Storage
    python phase2_e2e.py concentrations        # device_concentrations row
    python phase2_e2e.py command               # command_audit ack + result
    python phase2_e2e.py continuous --duration 300 --interval 2
    python phase2_e2e.py qos1-publish --count 10   # publish while service is down

The script connects to the real EMQX broker as device 'xrf-dev-001' and uses
PostgREST (service_role) for the precondition INSERT into command_audit and
for verification queries.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import error, request

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

# --- env loading ------------------------------------------------------------

ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

BROKER = os.environ["EMQX_BROKER_URL"]
PORT = int(os.environ.get("EMQX_BROKER_PORT", "8883"))
USER = os.environ["MQTT_USERNAME"]
PASS = os.environ["MQTT_PASSWORD"]
DEVICE = os.environ["DEVICE_ID"]
TENANT = os.environ["TENANT_ID"]
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SRK = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

PREFIX = f"sax/{TENANT}/{DEVICE}"


# --- mqtt helpers -----------------------------------------------------------

def _mqtt_connect(client_id: str | None = None) -> mqtt.Client:
    client = mqtt.Client(
        callback_api_version=CallbackAPIVersion.VERSION2,
        client_id=client_id or USER,
    )
    client.username_pw_set(USER, PASS)
    ctx = ssl.create_default_context()
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    client.tls_set_context(ctx)
    client.connect(BROKER, PORT)
    client.loop_start()
    deadline = time.time() + 10
    while not client.is_connected() and time.time() < deadline:
        time.sleep(0.1)
    if not client.is_connected():
        raise RuntimeError("MQTT connect timeout")
    print(f"  ✓ MQTT connected as {USER}")
    return client


def _publish(client: mqtt.Client, topic_suffix: str, payload: dict, qos: int = 1) -> None:
    topic = f"{PREFIX}/{topic_suffix}"
    info = client.publish(topic, json.dumps(payload, default=str).encode(), qos=qos)
    info.wait_for_publish(timeout=5)
    print(f"  >> {topic}  ({len(json.dumps(payload, default=str))} bytes, qos={qos})")


# --- postgrest helpers ------------------------------------------------------

def _pg(method: str, path: str, body: dict | None = None, prefer: str | None = None) -> tuple[int, str]:
    url = f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body is not None else None
    req = request.Request(url, method=method, data=data)
    req.add_header("apikey", SRK)
    req.add_header("Authorization", f"Bearer {SRK}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    try:
        with request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode()
    except error.HTTPError as e:
        return e.code, e.read().decode()


def _count(table: str, filt: str = "") -> int:
    q = f"{table}?select=id&limit=0" + (f"&{filt}" if filt else "")
    status, body = _pg("GET", q, prefer="count=exact")
    # The count comes in Content-Range header; we parsed body, so re-query with header capture.
    # Simpler: use a fresh call retrieving the header via urllib.
    url = f"{SUPABASE_URL}/rest/v1/{q}"
    req = request.Request(url)
    req.add_header("apikey", SRK)
    req.add_header("Authorization", f"Bearer {SRK}")
    req.add_header("Prefer", "count=exact")
    try:
        with request.urlopen(req, timeout=15) as r:
            cr = r.headers.get("Content-Range", "*/0")
    except error.HTTPError as e:
        cr = e.headers.get("Content-Range", "*/0")
    return int(cr.split("/")[-1])


# --- subcommands ------------------------------------------------------------

def cmd_spectra_inline(_: argparse.Namespace) -> int:
    """Publish a small spectrum (~5 KB) — must land inline as JSONB."""
    print("\n[spectra-inline] start")
    before = _count("device_spectra", f"device_id=eq.{DEVICE}")
    client = _mqtt_connect()
    payload = {
        "device_id": DEVICE,
        "ts": datetime.now(timezone.utc).isoformat(),
        "measurement_id": f"e2e-inline-{uuid.uuid4().hex[:8]}",
        "spectra_data": {"channels": list(range(1024)), "intensities": [1.0] * 1024},
        "run_data": {"live_time_s": 30.0, "real_time_s": 32.5},
    }
    _publish(client, "spectra", payload)
    time.sleep(3)
    client.loop_stop()
    client.disconnect()
    after = _count("device_spectra", f"device_id=eq.{DEVICE}")
    print(f"  device_spectra: {before} → {after}  (+{after - before})")
    if after - before != 1:
        print("  ✗ FAIL: expected +1 row")
        return 1
    # verify the new row has spectra_data NOT null and storage_path NULL
    _, body = _pg("GET", f"device_spectra?measurement_id=eq.{payload['measurement_id']}&select=measurement_id,storage_path,spectra_data")
    rows = json.loads(body)
    if not rows:
        print("  ✗ FAIL: row not found by measurement_id")
        return 1
    r = rows[0]
    if r["storage_path"] is not None or r["spectra_data"] is None:
        print(f"  ✗ FAIL: expected inline (storage_path=null, spectra_data!=null), got {r}")
        return 1
    print("  ✓ PASS: stored inline as JSONB")
    return 0


def cmd_spectra_large(_: argparse.Namespace) -> int:
    """Publish a large spectrum (>200 KB) — must offload to Storage."""
    print("\n[spectra-large] start")
    before = _count("device_spectra", f"device_id=eq.{DEVICE}")
    client = _mqtt_connect()
    # ~600 KB JSON: 50000 channels with intensity floats
    big = {"channels": list(range(50000)), "intensities": [3.14159] * 50000}
    measurement_id = f"e2e-large-{uuid.uuid4().hex[:8]}"
    payload = {
        "device_id": DEVICE,
        "ts": datetime.now(timezone.utc).isoformat(),
        "measurement_id": measurement_id,
        "spectra_data": big,
        "run_data": {"live_time_s": 600.0},
    }
    raw = json.dumps(payload, default=str).encode()
    print(f"  payload size: {len(raw):,} bytes")
    _publish(client, "spectra", payload)
    time.sleep(5)
    client.loop_stop()
    client.disconnect()
    after = _count("device_spectra", f"device_id=eq.{DEVICE}")
    print(f"  device_spectra: {before} → {after}  (+{after - before})")
    if after - before != 1:
        print("  ✗ FAIL: expected +1 row")
        return 1
    _, body = _pg("GET", f"device_spectra?measurement_id=eq.{measurement_id}&select=measurement_id,storage_path,spectra_data")
    rows = json.loads(body)
    r = rows[0]
    if not r["storage_path"] or r["spectra_data"] is not None:
        print(f"  ✗ FAIL: expected offloaded (storage_path set, spectra_data null), got {r}")
        return 1
    print(f"  ✓ PASS: offloaded to Storage at {r['storage_path']}")
    # also verify the object exists in the bucket
    obj_url = f"{SUPABASE_URL}/storage/v1/object/info/device-spectra/{r['storage_path']}"
    req = request.Request(obj_url)
    req.add_header("apikey", SRK)
    req.add_header("Authorization", f"Bearer {SRK}")
    try:
        with request.urlopen(req, timeout=10) as resp:
            info = json.loads(resp.read())
            print(f"  ✓ Storage object exists: {info.get('size', '?')} bytes")
    except error.HTTPError as e:
        print(f"  ✗ FAIL: storage object missing ({e.code})")
        return 1
    return 0


def cmd_concentrations(_: argparse.Namespace) -> int:
    """Publish a concentrations payload — must land in device_concentrations."""
    print("\n[concentrations] start")
    before = _count("device_concentrations", f"device_id=eq.{DEVICE}")
    client = _mqtt_connect()
    measurement_id = f"e2e-conc-{uuid.uuid4().hex[:8]}"
    payload = {
        "device_id": DEVICE,
        "ts": datetime.now(timezone.utc).isoformat(),
        "measurement_id": measurement_id,
        "elements": {"Cu": 1.85, "Fe": 4.2, "Zn": 0.92, "Pb": 0.05},
        "unit": "g/L",
    }
    _publish(client, "concentrations", payload)
    time.sleep(3)
    client.loop_stop()
    client.disconnect()
    after = _count("device_concentrations", f"device_id=eq.{DEVICE}")
    print(f"  device_concentrations: {before} → {after}  (+{after - before})")
    if after - before != 1:
        print("  ✗ FAIL: expected +1 row")
        return 1
    _, body = _pg("GET", f"device_concentrations?measurement_id=eq.{measurement_id}&select=elements")
    elements = json.loads(body)[0]["elements"]
    if elements != payload["elements"]:
        print(f"  ✗ FAIL: elements mismatch  expected={payload['elements']} got={elements}")
        return 1
    print(f"  ✓ PASS: elements persisted exactly: {elements}")
    return 0


def cmd_command(_: argparse.Namespace) -> int:
    """Pre-insert a command_audit row, publish /ack and /result, verify state machine."""
    print("\n[command] start")
    cmd_id = str(uuid.uuid4())
    issued_by = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    seed = {
        "id": cmd_id,
        "device_id": DEVICE,
        "tenant_id": TENANT,
        "issued_by": issued_by,
        "issued_by_email": "e2e@sax.local",
        "issued_by_role": "operator",
        "module": "generator",
        "command": "set_voltage",
        "args": {"kv": 30.0},
        "status": "sent",
        "expires_at": expires_at,
    }
    status, body = _pg("POST", "command_audit", seed, prefer="return=minimal")
    if status not in (200, 201):
        print(f"  ✗ FAIL: precondition INSERT failed: {status} {body}")
        return 1
    print(f"  ✓ pre-inserted command_audit id={cmd_id} status=sent")

    client = _mqtt_connect()

    # ACK
    ack_at = datetime.now(timezone.utc).isoformat()
    _publish(client, "command/ack", {
        "command_id": cmd_id,
        "module": "generator",
        "command": "set_voltage",
        "status": "ack",
        "ack_at": ack_at,
    })
    time.sleep(2)
    _, body = _pg("GET", f"command_audit?id=eq.{cmd_id}&select=status,ack_at,completed_at,error_message")
    row = json.loads(body)[0]
    if row["status"] != "ack" or row["ack_at"] is None:
        print(f"  ✗ FAIL: after ack, expected status=ack with ack_at set, got {row}")
        return 1
    print(f"  ✓ after ack: status=ack, ack_at={row['ack_at']}")

    # RESULT (completed)
    completed_at = datetime.now(timezone.utc).isoformat()
    _publish(client, "command/result", {
        "command_id": cmd_id,
        "module": "generator",
        "command": "set_voltage",
        "status": "completed",
        "error_message": None,
        "completed_at": completed_at,
    })
    time.sleep(2)
    client.loop_stop()
    client.disconnect()
    _, body = _pg("GET", f"command_audit?id=eq.{cmd_id}&select=status,ack_at,completed_at,error_message")
    row = json.loads(body)[0]
    if row["status"] != "completed" or row["completed_at"] is None:
        print(f"  ✗ FAIL: after result, expected status=completed with completed_at set, got {row}")
        return 1
    print(f"  ✓ after result: status=completed, completed_at={row['completed_at']}")
    return 0


def cmd_continuous(args: argparse.Namespace) -> int:
    """Publish telemetry continuously and verify zero loss."""
    duration = args.duration
    interval = args.interval
    expected = duration // interval
    print(f"\n[continuous] duration={duration}s, interval={interval}s, expected≈{expected} messages")
    before = _count("device_telemetry", f"device_id=eq.{DEVICE}&module=eq.generator")
    client = _mqtt_connect()
    sent = 0
    start = time.time()
    while time.time() - start < duration:
        ts = datetime.now(timezone.utc).isoformat()
        _publish(client, "telemetry/generator", {
            "device_id": DEVICE,
            "module": "generator",
            "ts": ts,
            "data": {"tube_high_voltage_kv": 30.0 + sent * 0.01, "beam_current_ua": 100.0, "hv_on": True},
        })
        sent += 1
        time.sleep(interval)
    client.loop_stop()
    client.disconnect()
    print(f"  sent {sent} messages, waiting 5s for ingestion to drain...")
    time.sleep(5)
    after = _count("device_telemetry", f"device_id=eq.{DEVICE}&module=eq.generator")
    received = after - before
    print(f"  device_telemetry (generator): {before} → {after}  (+{received})")
    loss = sent - received
    pct = (loss / sent * 100) if sent else 0
    print(f"  sent={sent}  received={received}  loss={loss} ({pct:.1f}%)")
    if loss != 0:
        print("  ✗ FAIL: message loss detected")
        return 1
    print("  ✓ PASS: zero loss")
    return 0


def cmd_qos1_publish(args: argparse.Namespace) -> int:
    """Publish N alerts with QoS 1 (used during the QoS persistence test).

    Run this WHILE the ingestion service is stopped. The broker buffers messages
    against the persistent session of client_id 'ingestion-svc-01' (clean_session=False).
    When the service comes back up, the buffered messages should be delivered
    and end up in the alerts table.
    """
    n = args.count
    print(f"\n[qos1-publish] publishing {n} alerts at qos=1")
    client = _mqtt_connect(client_id=f"qos1-{uuid.uuid4().hex[:8]}")
    tag = f"qos1-{uuid.uuid4().hex[:6]}"
    for i in range(n):
        _publish(client, "alerts", {
            "device_id": DEVICE,
            "ts": datetime.now(timezone.utc).isoformat(),
            "source": tag,  # use this to count just our messages
            "alerts": [{"name": f"qos1_test_{i}", "severity": "info", "message": f"e2e {i}"}],
        })
        time.sleep(0.2)
    client.loop_stop()
    client.disconnect()
    print(f"  done. Look for source={tag!r} in alerts after restart")
    print(f"  TAG={tag}")
    return 0


# --- main -------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("spectra-inline").set_defaults(func=cmd_spectra_inline)
    sub.add_parser("spectra-large").set_defaults(func=cmd_spectra_large)
    sub.add_parser("concentrations").set_defaults(func=cmd_concentrations)
    sub.add_parser("command").set_defaults(func=cmd_command)
    cont = sub.add_parser("continuous")
    cont.add_argument("--duration", type=int, default=300)
    cont.add_argument("--interval", type=int, default=2)
    cont.set_defaults(func=cmd_continuous)
    qos1 = sub.add_parser("qos1-publish")
    qos1.add_argument("--count", type=int, default=10)
    qos1.set_defaults(func=cmd_qos1_publish)
    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
