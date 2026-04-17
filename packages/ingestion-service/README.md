# SAX Ingestion Service

Cloud-side MQTT subscriber that bridges the EMQX broker to Supabase. Subscribes to all `sax/+/+/...` topics published by Edge Gateways and persists each payload into the right Supabase table (telemetry, spectra, alerts, equipment state, command audit).

Pure subscriber — does NOT expose an HTTP API for command publishing (that lives in the Next.js Route Handlers).

---

## Architecture

```
EMQX broker  ──► MqttSubscriber ──► TopicRouter ──► Handler ──► SupabaseWriter ──► Supabase tables
                                       │
                                       └────► (spectra >200 KB) ──► SpectraStorage ──► Supabase Storage
```

Layers:

| Layer | Module | Responsibility |
|---|---|---|
| Transport | `mqtt_subscriber.py` | MQTT client, subscription, dispatch loop |
| Routing | `topic_router.py` | Pure parser: topic string → `ParsedTopic` |
| Validation | `models.py` | Pydantic models for every payload shape |
| Logic | `handlers/*.py` | One handler per message kind |
| Persistence | `supabase_writer.py` | Supabase Postgres client + retry/backoff |
| Persistence | `spectra_storage.py` | Supabase Storage uploader |
| Lifecycle | `main.py` | Wiring, signal handling, graceful shutdown |
| Ops | `healthcheck.py` | `GET /healthz` and `GET /readyz` |

---

## Local development

```bash
cd packages/ingestion-service
pip install -e ".[dev]"
pytest tests/ -v
```

To run against the real broker + Supabase, populate `.env` (or export env vars) and:

```bash
python -m src.main
```

---

## Pre-requisite: Supabase Storage bucket

Before the first deploy, create one Storage bucket. This is **not** a SQL migration — it's a one-time manual step in the Supabase Dashboard:

1. Supabase Dashboard → project `ndnijhnpfzxanadtfflb` → Storage → **New bucket**
2. Name: `device-spectra`
3. Public bucket: **OFF** (private)
4. File size limit: 50 MB
5. Allowed MIME types: empty
6. Save

Default policies block `anon` and `authenticated` roles. The Ingestion Service writes via `service_role`, which bypasses bucket RLS by design. Read policies for the frontend will be added in Phase 4.

---

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SUPABASE_URL` | yes | — | e.g. `https://ndnijhnpfzxanadtfflb.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | Bypasses RLS — server-side only |
| `MQTT_BROKER_URL` | yes | — | e.g. `wc68f227.ala.us-east-1.emqxsl.com` |
| `MQTT_BROKER_PORT` | no | `8883` | TLS port |
| `MQTT_USERNAME` | yes | — | EMQX user `ingestion-svc` |
| `MQTT_PASSWORD` | yes | — | from `INGESTION_MQTT_PASSWORD` in root `.env` |
| `MQTT_CLIENT_ID` | no | `ingestion-svc-01` | Stable client_id for persistent session |
| `MQTT_USE_TLS` | no | `true` | Always true for EMQX Serverless |
| `SPECTRA_INLINE_THRESHOLD_BYTES` | no | `204800` | 200 KB; over this, spectra go to Storage |
| `SPECTRA_STORAGE_BUCKET` | no | `device-spectra` | Storage bucket name |
| `HEALTHCHECK_PORT` | no | `8080` | HTTP port for liveness probes |
| `HEALTHCHECK_STALE_SECONDS` | no | `300` | If no MQTT message received in this many seconds, `/healthz` returns 503 |
| `LOG_LEVEL` | no | `INFO` | Standard Python log levels |

The service accepts `INGESTION_*` prefixed variants too (e.g. `INGESTION_MQTT_PASSWORD`) — they take precedence over the bare names. This lets you reuse the root `.env` without renaming.

---

## Topic → table mapping

| Topic pattern | Handler | Supabase table | Operation |
|---|---|---|---|
| `sax/+/+/telemetry/+` | telemetry | `device_telemetry` | INSERT |
| `sax/+/+/spectra` | spectra | `device_spectra` (+ Storage) | INSERT |
| `sax/+/+/concentrations` | concentrations | `device_concentrations` | INSERT |
| `sax/+/+/alerts` | alert | `alerts` | INSERT |
| `sax/+/+/sentinel` | alert | `alerts` | INSERT |
| `sax/+/+/equipment_state` | equipment_state | `device_equipment_state` | UPSERT (PK `device_id`) |
| `sax/+/+/command/ack` | command_audit | `command_audit` | UPDATE |
| `sax/+/+/command/result` | command_audit | `command_audit` | UPDATE |

Every successful insert/upsert/update also bumps `devices.last_seen_at = now()`.

---

## Idempotency

MQTT QoS 1 is at-least-once: the broker may redeliver a message after a reconnect. The service is designed so duplicates are tolerable:

- Append-only tables (`device_telemetry`, `device_spectra`, `alerts`, `device_concentrations`) record `device_ts` and `received_at`. A duplicate row with the same `device_ts` is cosmetic — the dashboard groups by timestamp.
- `device_equipment_state` has `device_id` as PK and is always upserted.
- `command_audit` updates use a monotonic state machine (`sent → ack → completed/error`) — re-applying the same UPDATE is a no-op.

---

## Deployment

Production target is Railway. The Dockerfile builds a slim multi-stage image and runs as an unprivileged `ingestion` user. Set the environment variables above in the Railway dashboard, expose port `8080` for the health check, and configure liveness probe `GET /healthz` with a 30 s interval and 3 failure threshold.

---

## Phase 2 acceptance criteria

See `PLAN_IMPLEMENTACION_IOT_V2.md` § Fase 2 for the full criteria. End-to-end test:

```bash
# Terminal 1: ingestion service
cd packages/ingestion-service && python -m src.main

# Terminal 2: edge gateway publishing
cd packages/edge-gateway && python -m src.main --config config/provision.example.json

# Verify in Supabase Dashboard:
#   - device_telemetry receives rows every 2s for 7 modules
#   - device_equipment_state shows state='idle'
#   - devices.last_seen_at updates
```
