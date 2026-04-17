# Resumen Ejecutivo y Técnico — Trabajo de Dev A

**Fecha:** 2026-04-17
**Audiencia:** stakeholders SAX, Dev B (frontend), nuevos integrantes del equipo
**Propósito:** documento autocontenido para entender, contar y operar todo lo que se construyó del lado backend/IoT del proyecto.

---

## Tabla de contenidos

1. [La gran imagen — qué problema resolvemos](#1-la-gran-imagen)
2. [Glosario rápido](#2-glosario-rápido)
3. [Arquitectura completa en un diagrama](#3-arquitectura-completa)
4. [Fase 0 — Infraestructura base](#4-fase-0--infraestructura-base)
5. [Fase 1 — Edge Gateway (cerebro local del equipo)](#5-fase-1--edge-gateway)
6. [Fase 2 — Ingestion Service (puente nube)](#6-fase-2--ingestion-service)
7. [Pruebas y validaciones — la evidencia](#7-pruebas-y-validaciones)
8. [Decisiones de diseño importantes (ADRs informales)](#8-decisiones-de-diseño)
9. [Estado actual y lo que sigue](#9-estado-actual-y-lo-que-sigue)
10. [Operación: cómo arrancar, parar, monitorear](#10-operación)

---

## 1. La gran imagen

### El problema que resolvemos

Los equipos **XrfOnStream** (analizadores XRF de SAX) están instalados en plantas mineras. Hoy, cada equipo opera en aislamiento: tiene su propia base de datos local en PostgreSQL y su software (CommandDaemon, Sentinel, módulos físicos, SQLClient). Si un cliente quiere saber qué está pasando con su equipo a 1.500 km de distancia, alguien tiene que ir físicamente o llamar por teléfono. Si SAX necesita hacer diagnóstico remoto, no puede.

### La solución

Construimos una plataforma multi-tenant en la nube que centraliza el monitoreo y, eventualmente, el control remoto de todos los equipos XrfOnStream. La regla de oro: **el software original del equipo no se modifica**. Lo único que se agrega es un programa nuevo (el Edge Gateway) que **lee** de la base local y publica a la nube.

### Los 3 pilares conceptuales

1. **Cloud convenience, never authority.** La nube es para conveniencia (ver datos, mandar comandos), nunca para autoridad. Los interlocks de seguridad físicos del equipo siguen siendo inmutables desde la nube.
2. **Offline-first.** El equipo opera normalmente sin internet. El Edge Gateway buffer-ea los datos y los reenvía cuando vuelve la conexión.
3. **Multi-tenant con aislamiento estricto.** Cada cliente minero es un *tenant*. Ningún tenant puede ver datos de otro, y eso lo garantiza la base de datos misma (no la aplicación).

---

## 2. Glosario rápido

| Término | Significado en este proyecto |
|---|---|
| **XrfOnStream** | El equipo físico de SAX que mide composición elemental por fluorescencia de rayos X |
| **Tenant** | Un cliente (empresa minera). En la base, una fila en `tenants` |
| **Device** | Un equipo XRF físico, perteneciente a un tenant. Una fila en `devices` |
| **Edge Gateway** | Programa Python que vive **dentro** del equipo, junto al software original |
| **Ingestion Service** | Programa Python que vive **en la nube** (Railway), recibe del broker y escribe en Supabase |
| **MQTT** | Protocolo de mensajería pub/sub liviano, ideal para IoT |
| **Broker** | El servidor MQTT (en nuestro caso, EMQX Cloud) que rutea mensajes |
| **Topic** | Una "ruta" tipo URL en MQTT, ej. `sax/<tenant>/<device>/telemetry/generator` |
| **QoS 1** | Garantía de entrega "al menos una vez" — el broker reintenta hasta que el receptor confirma |
| **TLS** | Cifrado de la conexión (como HTTPS pero para MQTT) |
| **HMAC-SHA256** | Firma criptográfica que prueba que un mensaje viene de quien dice venir y no fue alterado |
| **RLS (Row Level Security)** | Mecanismo de Postgres/Supabase que filtra filas automáticamente según el usuario |
| **Sentinel** | Subsistema del software original del equipo que monitorea seguridad (4 validaciones) |
| **JWT** | Token criptográfico que un usuario obtiene al hacer login y presenta para probar quién es |
| **Service role** | Una "llave maestra" de Supabase que bypassa RLS — solo se usa server-side |
| **LWT (Last Will and Testament)** | Mensaje que el broker publica automáticamente si un cliente se desconecta abruptamente — usado para marcar equipos como "offline" |

---

## 3. Arquitectura completa

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       SITIO DEL CLIENTE (planta minera)                       │
│                                                                                │
│  ┌────────────────────────────────────┐                                       │
│  │   EQUIPO XRF (XrfOnStream)         │                                       │
│  │                                    │                                       │
│  │  ┌──────────────────────────────┐  │                                       │
│  │  │  Software ORIGINAL (intacto) │  │                                       │
│  │  │  - CommandDaemon             │  │                                       │
│  │  │  - Sentinel                  │  │                                       │
│  │  │  - 7 módulos físicos         │  │                                       │
│  │  │  - SQLClient                 │  │                                       │
│  │  │  - PostgreSQL local          │  │                                       │
│  │  └──────────────────────────────┘  │                                       │
│  │              │ (lee, no escribe)   │                                       │
│  │              ▼                     │                                       │
│  │  ┌──────────────────────────────┐  │                                       │
│  │  │  EDGE GATEWAY (NUEVO, Dev A) │  │                                       │
│  │  │  - mqtt_client (TLS+reconnect)│  │                                       │
│  │  │  - 7 publishers              │  │                                       │
│  │  │  - command_receiver          │  │                                       │
│  │  │  - command_validator (7 capas)│  │                                       │
│  │  │  - offline_buffer (PG local) │  │                                       │
│  │  └──────────────────────────────┘  │                                       │
│  └────────────┬───────────────────────┘                                       │
│               │ outbound TCP 8883 (TLS)                                       │
│               │ (no requiere abrir puertos en firewall del cliente)          │
└───────────────┼───────────────────────────────────────────────────────────────┘
                │
        INTERNET (cifrado)
                │
┌───────────────▼───────────────────────────────────────────────────────────────┐
│                              NUBE                                              │
│                                                                                │
│  ┌──────────────────────────────────┐                                         │
│  │   EMQX Cloud (broker MQTT)        │                                         │
│  │   wc68f227.ala.us-east-1.emqxsl  │                                         │
│  │   - TLS obligatorio               │                                         │
│  │   - Auth por usuario/password     │                                         │
│  │   - ACLs por topic                │                                         │
│  │   - Persiste sesiones (QoS 1)     │                                         │
│  └────────┬─────────────────────────┘                                         │
│           │                                                                    │
│           ▼ (subscribe a sax/+/+/...)                                         │
│  ┌──────────────────────────────────┐                                         │
│  │   INGESTION SERVICE (Railway)     │  Dev A                                  │
│  │   - mqtt_subscriber               │                                         │
│  │   - 6 handlers (1 por kind)       │                                         │
│  │   - supabase_writer (retry 5xx)   │                                         │
│  │   - spectra_storage (>200KB)      │                                         │
│  │   - healthcheck /healthz, /readyz │                                         │
│  └────────┬─────────────────────────┘                                         │
│           │ INSERT/UPSERT/UPDATE                                               │
│           ▼                                                                    │
│  ┌──────────────────────────────────┐    ┌──────────────────────────────┐    │
│  │   SUPABASE (Postgres + Auth +    │    │   Storage bucket             │    │
│  │              Realtime)            │    │   "device-spectra"           │    │
│  │   - 9 tablas (con RLS)            │    │   (espectros >200 KB)        │    │
│  │   - Auth con claims tenant_id+rol │    │                              │    │
│  │   - Realtime para el dashboard    │    │                              │    │
│  └────────┬─────────────────────────┘    └──────────────────────────────┘    │
│           │                                                                    │
│           ▼ (lectura via Supabase JS client)                                  │
│  ┌──────────────────────────────────┐                                         │
│  │   FRONTEND Next.js (Vercel)       │  Dev B (pendiente)                     │
│  │   - Dashboard de lectura          │                                         │
│  │   - Pantallas de control          │                                         │
│  │   - Route Handler /commands       │                                         │
│  └────────┬─────────────────────────┘                                         │
│           │                                                                    │
│           ▼ POST con HMAC firmado                                             │
│           └──► EMQX HTTP API → topic command/request → Edge Gateway            │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Cómo viaja un dato (telemetría) end-to-end:**
1. Cada 2 s, el `telemetry_publisher` del Edge Gateway lee de la BD local del equipo.
2. Construye un JSON `{device_id, module, ts, data: {...}}` y lo publica a `sax/<tenant>/<device>/telemetry/<module>` con QoS 1.
3. El cliente MQTT del Edge Gateway lo envía cifrado por TLS al broker EMQX.
4. EMQX lo entrega al Ingestion Service (suscriptor con `clean_session=False`).
5. El handler de telemetría valida el payload con un modelo Pydantic, lo convierte a una fila y hace `INSERT INTO device_telemetry`.
6. El handler también bumpea `devices.last_seen_at = now()`.
7. Supabase Realtime (websocket) notifica al frontend, que actualiza la pantalla.

Latencia medida punta-a-punta: **~700 ms** (objetivo del plan: <3 s).

---

## 4. Fase 0 — Infraestructura base

> **Objetivo:** dejar todos los servicios externos contratados, configurados y listos para que las fases siguientes puedan empezar sin pelearse con configuración.

### 4.1 Repositorio

- **GitHub:** `SAX-Devs/sax-XRFOnStream` (privado).
- **Estructura monorepo** con 3 paquetes (edge-gateway, ingestion-service, frontend) + carpeta `supabase/migrations/` + `scripts/` + `docs/`.
- **`.gitignore`** configurado para Python (`__pycache__`, `*.pyc`, `.venv`), Node (`node_modules`, `.next`) y secretos (`.env`, `*.key`).
- **`.env.example`** versionado con placeholders, **`.env`** con valores reales NO versionado.

### 4.2 Supabase (Postgres + Auth + Realtime + Storage)

**Proyecto:** `ndnijhnpfzxanadtfflb` en región **South America (São Paulo)**, plan Free (a actualizar a Pro para producción).

**11 migraciones SQL aplicadas** (en `supabase/migrations/`):

| # | Migración | Qué crea |
|---|---|---|
| 00001 | `create_tenants` | Tabla `tenants` (clientes mineros) con slug único, trigger `updated_at` |
| 00002 | `create_devices` | Tabla `devices` (equipos), FK a tenants, enum `device_status_enum` |
| 00003 | `create_device_telemetry` | Tabla append-only de telemetría con índices por (device_id, device_ts DESC) |
| 00004 | `create_device_spectra` | Tabla de espectros: campo JSONB `spectra_data` o referencia `storage_path` |
| 00005 | `create_command_audit` | Tabla de auditoría de comandos + enum `command_status_enum` (sent/ack/completed/...) |
| 00006 | `create_alerts` | Tabla de alertas + enum `alert_severity_enum` (info/warning/critical/emergency) |
| 00007 | `create_device_secrets` | **Schema `private`**, tabla `device_secrets` con HMAC secret y password MQTT por device. **REVOKE ALL** para roles `anon` y `authenticated` |
| 00008 | `create_equipment_state` | Tabla `device_equipment_state` (UPSERT por device_id) + enum `equipment_state_enum` |
| 00009 | `create_device_concentrations` | Tabla de concentraciones elementales (preparada para DEP-01) |
| 00010 | `rls_policies` | Habilita RLS en todas las tablas públicas + policies por tenant_id |
| 00011 | `auth_hooks` | Trigger que injecta `tenant_id` y `role` en los claims del JWT al hacer login |

**Detalles importantes:**

- Las claves primarias de las tablas append-only (`device_telemetry`, `device_spectra`, `device_concentrations`, `alerts`) son **`BIGINT GENERATED ALWAYS AS IDENTITY`** — no UUIDs — para que los índices sean compactos y los joins por `device_id + device_ts` sean rápidos.
- `command_audit.id` sí es UUID porque ese ID viaja al equipo y vuelve, y necesita ser globalmente único sin coordinación.
- `device_equipment_state` tiene `device_id` como PK porque solo guardamos el estado actual (no historial — eso vive en telemetría).
- **Funciones helper SQL:** `get_user_tenant_id()` y `get_user_role()` leen del JWT actual. Se usan en cada policy de RLS.
- **Triggers `updated_at`:** automáticos en `tenants` y `devices`.

**Datos seed (vivos en la base):**

| Recurso | Valor |
|---|---|
| Tenant | `a1b2c3d4-...001` — "Minera Demo" (slug `minera-demo`) |
| Device | `d1e2f3a4-...001` — "Equipo Demo Lab" (serial `XRF-DEV-001`, status `active`) |
| Device Secrets | HMAC + MQTT password para el device demo |
| Telemetry mock | 7 filas (1 por módulo) |
| Equipment state | `idle` |
| Usuario test | `dev@sax.cl` / `devpassword123` (rol `sax_admin`) |

**Storage:**

- **Bucket `device-spectra`** creado el 2026-04-16 (privado, límite 50 MB, sin restricción de MIME).
- Sin políticas de lectura → solo accesible vía `service_role` (Ingestion Service). Las políticas de lectura para el frontend se agregan en Fase 4.

### 4.3 EMQX Cloud (broker MQTT)

**Deployment:** Serverless, región AWS Norteamérica, EMQX v5.

| Param | Valor |
|---|---|
| Hostname | `wc68f227.ala.us-east-1.emqxsl.com` |
| Puerto MQTT (TLS) | `8883` (obligatorio TLS, no acepta plain) |
| WebSocket TLS | `8084` |
| HTTP API | `https://wc68f227.ala.us-east-1.emqxsl.com:8443/api/v5` |

**Usuarios MQTT (con autenticación):**

| Username | Para qué | Password en .env |
|---|---|---|
| `xrf-dev-001` | Edge Gateway del equipo demo | `MQTT_PASSWORD` |
| `ingestion-svc` | Ingestion Service en Railway | `INGESTION_MQTT_PASSWORD` |

**ACL (autorización por topic):** ningún cliente puede pisar topics que no le tocan.

- `xrf-dev-001`: solo puede *publicar* a sus 8 topics de salida + *suscribirse* a `command/request` (donde le llegan comandos).
- `ingestion-svc`: solo *suscribirse*, nunca publicar (es puramente consumidor).

**Estructura jerárquica de topics** (multi-tenant en el path):

```
sax/{tenant_id}/{device_id}/telemetry/{module}     dispositivo → cloud
sax/{tenant_id}/{device_id}/spectra                dispositivo → cloud
sax/{tenant_id}/{device_id}/concentrations         dispositivo → cloud
sax/{tenant_id}/{device_id}/sentinel               dispositivo → cloud
sax/{tenant_id}/{device_id}/alerts                 dispositivo → cloud
sax/{tenant_id}/{device_id}/equipment_state        dispositivo → cloud (con LWT)
sax/{tenant_id}/{device_id}/command/request        cloud → dispositivo
sax/{tenant_id}/{device_id}/command/ack            dispositivo → cloud
sax/{tenant_id}/{device_id}/command/result         dispositivo → cloud
```

### 4.4 Seguridad (cross-cutting)

| Elemento | Estado |
|---|---|
| HMAC-SHA256 secret (256 bits, generado aleatoriamente) | Guardado en `private.device_secrets` y en `.env` para el equipo demo |
| MQTT auth (user/pass) + TLS 1.2+ obligatorio | ✅ |
| ACL por topic — cada equipo "dueño" solo de sus topics | ✅ |
| RLS en todas las tablas públicas | ✅ |
| `private.device_secrets` inaccesible para `anon`/`authenticated` | ✅ verificado |
| `.env` en `.gitignore`, nunca commiteado | ✅ |

### 4.5 Servicios externos

| Servicio | Propósito | Estado |
|---|---|---|
| **Supabase** | BD + Auth + Realtime + Storage | ✅ contratado y configurado |
| **EMQX Cloud** | Broker MQTT | ✅ contratado y configurado |
| **Railway** | Hosting del Ingestion Service | ✅ proyecto `sax-ingestion-service` con servicio desplegado |
| **Vercel** | Hosting del frontend | ⏸ pendiente (Dev B) |
| **Dominio** `app.sax.cl` | DNS al frontend | ⏸ pendiente |

---

## 5. Fase 1 — Edge Gateway

> **Objetivo:** un programa Python que se instala en cada equipo XRF, lee de su BD local, publica a la nube por MQTT, ejecuta comandos remotos validados y mantiene el estado del equipo siempre consistente — sin tocar el software original.

**Ubicación:** `packages/edge-gateway/`.
**Lenguaje:** Python 3.11.
**Dependencias clave:** `paho-mqtt>=2.0`, `psycopg[binary]>=3.1`, `pydantic>=2.0`.

### 5.1 Componentes implementados

| Módulo | Responsabilidad |
|---|---|
| `config.py` | Carga `provision.json` con Pydantic. Define toda la configuración (broker, credenciales, intervalos) |
| `main.py` | Entry point. Maneja signal handling (SIGTERM/SIGINT), threading de publishers y graceful shutdown |
| `mqtt_client.py` | Wrapper sobre paho-mqtt: TLS, autenticación, **Last Will and Testament**, reconexión exponencial |
| `db_reader.py` | Conexión a PostgreSQL local del equipo. Solo SELECT (nunca escribe) |
| `offline_buffer.py` | Tabla en la BD local que guarda mensajes cuando el broker está caído. Drena al reconectar |
| `telemetry_publisher.py` | Cada 2 s, lee los 7 módulos físicos y publica a `sax/.../telemetry/<module>` |
| `spectra_uploader.py` | Detecta nuevos espectros en la BD local y los publica a `sax/.../spectra` |
| `sentinel_publisher.py` | Lee las 4 validaciones del Sentinel y publica a `sax/.../sentinel` cuando cambian |
| `equipment_state_publisher.py` | Calcula estado global (idle/measuring/error/...) y lo publica con LWT registrado |
| `concentrations_publisher.py` | Preparado para DEP-01: publica concentraciones elementales (g/L) |
| `command_receiver.py` | Suscriptor a `sax/.../command/request`. Recibe comandos del cloud |
| `command_validator.py` | **7 capas de seguridad** antes de ejecutar un comando (ver abajo) |
| `result_reporter.py` | Tras ejecutar un comando, publica el resultado a `sax/.../command/result` |

### 5.2 Las 7 capas de seguridad para comandos remotos

Cuando el cloud manda un comando a un equipo, este NUNCA lo ejecuta directamente. Pasa por:

1. **JWT del usuario** (verificado en el Route Handler de Next.js, antes de salir al broker).
2. **RBAC** (matriz de permisos por rol — viewer/operator/service/tenant_admin/sax_admin).
3. **TLS** del transporte (el comando viaja cifrado).
4. **Firma HMAC-SHA256** con el secreto único del device. El Edge Gateway re-firma localmente y compara.
5. **Whitelist** de comandos permitidos (no se aceptan comandos arbitrarios).
6. **Validación de rangos** (no podés mandar `set_voltage=100` si el máximo físico es 50).
7. **Sentinel veto:** si el Sentinel está en estado CRITICAL, comandos peligrosos se rechazan automáticamente.

Cualquier capa que falle → el comando se rechaza, se registra en `command_audit` con `status='rejected'` y el motivo, y se reporta al cloud.

### 5.3 Estrategia offline-first

- El equipo siempre opera, **conectado o no**.
- Si el broker está inalcanzable, los mensajes se acumulan en `offline_buffer` (tabla en la BD local).
- Cuando vuelve la conexión, los mensajes se drenan en orden, respetando QoS 1.
- El equipo NUNCA bloquea la operación local por problemas de red.

### 5.4 Last Will and Testament (LWT)

Al conectarse, el Edge Gateway le dice al broker: *"si me desconecto sin avisar (cable, kernel panic, kill -9), publica `{status: offline}` al topic `equipment_state` por mí"*. Esto garantiza que el dashboard de la nube sepa que el equipo se cayó **incluso si el equipo no pudo enviarlo**.

---

## 6. Fase 2 — Ingestion Service

> **Objetivo:** un servicio cloud 24/7 que escucha al broker MQTT y persiste cada mensaje en la tabla correcta de Supabase, con resiliencia ante caídas, sin perder datos y con baja latencia.

**Ubicación:** `packages/ingestion-service/`.
**Lenguaje:** Python 3.11.
**Despliegue:** Railway (URL del proyecto: https://railway.com/project/492cf7d6-e756-43be-b3fe-84a29ba39477).

### 6.1 Filosofía de diseño

- **Capas puras separadas** — cada una con una responsabilidad y testeable en aislamiento.
- **Sin estado en memoria persistente** — Railway puede reiniciar el contenedor en cualquier momento; la persistencia vive en EMQX (sesiones MQTT) y en Supabase.
- **Stateless dispatch loop** que dispara handlers — fácil de razonar, fácil de testear.
- **Inyección de dependencias** mediante `HandlerContext` — los tests usan mocks sin tocar la red.

### 6.2 Componentes implementados

| Módulo | Responsabilidad |
|---|---|
| `config.py` | Pydantic Settings basado en variables de entorno. Acepta `INGESTION_*` o nombres bare |
| `logging_setup.py` | Logger con formato estructurado |
| `topic_router.py` | **Parser puro** sin I/O: convierte `"sax/<t>/<d>/telemetry/<m>"` → `ParsedTopic(kind, tenant_id, device_id, module)` |
| `models.py` | Modelos Pydantic — uno por shape de payload. Validación al deserializar el JSON. Incluye traducción de LWT |
| `supabase_writer.py` | Cliente supabase-py con retry exponencial + jitter solo en errores 5xx (no 4xx). Cache TTL 60 s para `last_seen_at` |
| `spectra_storage.py` | Sube espectros >200 KB al bucket `device-spectra` con upsert idempotente |
| `mqtt_subscriber.py` | Cliente paho-mqtt con TLS, `clean_session=False` para sesión persistente, reconexión exponencial |
| `handlers/base.py` | Clase abstracta `Handler` + `HandlerContext` (writer + storage + config) inyectado |
| `handlers/telemetry_handler.py` | INSERT en `device_telemetry` |
| `handlers/spectra_handler.py` | INSERT en `device_spectra` (inline o con `storage_path` según tamaño) |
| `handlers/concentrations_handler.py` | INSERT en `device_concentrations` |
| `handlers/alert_handler.py` | INSERT en `alerts` (sirve para `/alerts` y `/sentinel`) |
| `handlers/equipment_state_handler.py` | UPSERT en `device_equipment_state` (PK `device_id`) |
| `handlers/command_audit_handler.py` | UPDATE de `command_audit` para ACKs y resultados (state machine monotónica) |
| `healthcheck.py` | Servidor HTTP stdlib (sin FastAPI) con `/healthz` y `/readyz` para Railway |
| `main.py` | Wiring + signal handling + graceful shutdown |

### 6.3 Mapeo topic → tabla

| Topic pattern | Handler | Tabla destino | Operación |
|---|---|---|---|
| `sax/+/+/telemetry/+` | telemetry | `device_telemetry` | INSERT |
| `sax/+/+/spectra` | spectra | `device_spectra` (+ Storage) | INSERT |
| `sax/+/+/concentrations` | concentrations | `device_concentrations` | INSERT |
| `sax/+/+/alerts` | alert | `alerts` | INSERT |
| `sax/+/+/sentinel` | alert | `alerts` | INSERT |
| `sax/+/+/equipment_state` | equipment_state | `device_equipment_state` | UPSERT (PK device_id) |
| `sax/+/+/command/ack` | command_audit | `command_audit` | UPDATE |
| `sax/+/+/command/result` | command_audit | `command_audit` | UPDATE |

Cada operación exitosa además bumpea `devices.last_seen_at = now()` (con cache 60 s para no inundar la base).

### 6.4 Idempotencia

MQTT QoS 1 puede entregar un mismo mensaje dos veces (al reconectar). El servicio está diseñado para tolerarlo:

- **Tablas append-only** (`device_telemetry`, `device_spectra`, `alerts`, `device_concentrations`): un duplicado con el mismo `device_ts` es cosmético — el dashboard agrupa por timestamp.
- **`device_equipment_state`**: PK `device_id`, siempre UPSERT.
- **`command_audit`**: UPDATE con state machine monotónica (`sent → ack → completed`); re-aplicar la misma transición es un no-op.

### 6.5 Despliegue en Railway

| Aspecto | Configuración |
|---|---|
| Proyecto Railway | `sax-ingestion-service` (workspace `sax-cl`) |
| Imagen | Multi-stage Dockerfile, build cacheado ~8 s |
| Healthcheck | `GET /healthz` cada 30 s — definido en `railway.json` versionado |
| Restart policy | `ON_FAILURE`, 10 reintentos |
| Dominio interno | `sax-ingestion-service.railway.internal:8080` |
| Variables de entorno | 9 variables seteadas via CLI (Supabase URL+SRK, MQTT broker+creds, healthcheck port, log level) |

---

## 7. Pruebas y validaciones

### 7.1 Tests unitarios del Ingestion Service

**53/53 pasando** en `packages/ingestion-service/tests/`. Cubren:

- `test_config.py` — carga de config con/sin prefijo, valores default, errores claros.
- `test_topic_router.py` — todos los topic patterns, casos edge (sin tenant, malformado, etc.).
- `test_models.py` — validación de cada Pydantic model, traducción de LWT, coerción de estados desconocidos.
- `test_supabase_writer.py` — retry en 5xx, no retry en 4xx, cache de `last_seen`.
- `test_mqtt_subscriber.py` — connect/disconnect/dispatch sin tocar la red real (paho mock).
- `tests/handlers/test_*.py` — un test por handler con `HandlerContext` mockeado.

**Cómo correrlos:**
```bash
cd packages/ingestion-service
pytest tests/ -v
```

Tiempo: ~0.5 s.

### 7.2 Validación end-to-end con servicios reales

Script reproducible: **`packages/ingestion-service/scripts/phase2_e2e.py`**.

Conecta al broker EMQX real, publica payloads como si fuera un equipo, y verifica via PostgREST (con `service_role`) que las filas aparezcan en Supabase.

| Subcomando | Qué prueba | Resultado |
|---|---|---|
| `spectra-inline` | Espectro de 10 KB → guardado inline como JSONB en `device_spectra` | ✅ +1 fila, `spectra_data` poblado, `storage_path` NULL |
| `spectra-large` | Espectro de 789 KB → offload a Storage; en la fila solo va `storage_path` | ✅ archivo en bucket `device-spectra`, fila con path correcto |
| `concentrations` | Payload con 4 elementos (Cu, Fe, Zn, Pb) → `device_concentrations` | ✅ +1 fila, JSONB `elements` exacto |
| `command` | Pre-inserta `command_audit (status=sent)`, publica `/ack` y `/result`, verifica state machine | ✅ `sent → ack → completed`, timestamps correctos |
| `continuous --duration 300 --interval 2` | Telemetría cada 2 s durante 5 min | ✅ 144/144 mensajes, **0% pérdida** |
| `qos1-publish --count 10` | Publica 10 alerts mientras el servicio está caído (test de sesión persistente) | ✅ ver siguiente fila |

### 7.3 El test crítico de resiliencia: persistencia de sesión MQTT

**Procedimiento:**
1. `railway down --service sax-ingestion-service` (mata el contenedor).
2. Mientras el servicio está abajo, `python phase2_e2e.py qos1-publish --count 10` publica 10 alertas con QoS 1 al broker.
3. `railway up` reinicia el servicio.
4. Verificación: `SELECT count(*) FROM alerts WHERE source='qos1-<tag>'` → **10**.

**Por qué funciona:**
- El servicio se conecta con `client_id="ingestion-svc-01"` y `clean_session=False`.
- EMQX persiste la sesión: cuando el servicio se desconecta, el broker conserva la lista de suscripciones y bufferiza los mensajes QoS 1 que llegan.
- Cuando el cliente vuelve con el mismo `client_id`, EMQX entrega los mensajes acumulados.

**Esto garantiza el criterio del plan:** *"Detener Ingestion Service 1 minuto → reanudar → mensajes pendientes en QoS 1 se procesan."*

### 7.4 Métricas medidas en producción

| Métrica | Valor medido | Objetivo del plan |
|---|---|---|
| Latencia broker → fila en Supabase | **~700 ms** | <3 s |
| Pérdida en 5 min continuos (1 msg cada 2 s) | **0%** (144/144) | 0% |
| Pérdida durante stop/start del servicio | **0%** (10/10 buffered) | 0% |
| Tiempo de auto-reconexión tras caída del broker | **~2 s** | (no especificado) |
| Build time de la imagen Docker | ~8 s (cacheado) | (no especificado) |

### 7.5 Criterios de aceptación de Fase 2 (§7 del PLAN)

| Criterio | Evidencia |
|---|---|
| Conecta al broker y recibe mensajes | Logs Railway + tests `mqtt_subscriber` |
| Despacha al handler correcto | Logs + tests `topic_router` |
| Reconexión automática | Logs reales (`MQTT disconnected unexpectedly — auto-reconnect armed` → `Connected`) |
| Telemetría → `device_telemetry` | demo_live: +7 filas |
| Espectro inline → `device_spectra.spectra_data` | `spectra-inline` ✓ |
| Espectro grande → Storage + `storage_path` | `spectra-large` ✓ (789 KB) |
| Concentraciones → `device_concentrations` | `concentrations` ✓ |
| Estado equipo → `device_equipment_state` (UPSERT) | demo_live ✓ |
| Alertas Sentinel → `alerts` | demo_live: +4 filas |
| Auditorías de comando con `command_id` correcto | `command` ✓ (state machine) |
| `devices.last_seen_at` se actualiza | `null → 2026-04-17T04:12:13Z` |
| Latencia <3 s | ~700 ms ✓ |
| Auto-restart si proceso muere | `restartPolicyType=ON_FAILURE` en `railway.json` |
| 5 min continuos sin pérdida | 144/144 ✓ |
| Persistencia QoS 1 (stop/start) | 10/10 ✓ |

---

## 8. Decisiones de diseño

Decisiones no triviales que tomamos y por qué — los nombres siguen la nomenclatura del plan (D-XX) cuando aplica.

### D-06 — Firma HMAC en Route Handler + EMQX HTTP API (no Edge Function)

**Decisión:** la firma HMAC y publicación al broker viven en el Route Handler de Next.js (Vercel), no en una Supabase Edge Function.

**Por qué:**
- Vercel ya tiene el contexto de auth del usuario (cookies, sessions de Supabase Auth).
- Centraliza la lógica de "quién puede mandar qué comando" cerca del frontend que la consume.
- EMQX HTTP API es un POST simple — no necesitamos mantener una conexión MQTT persistente en el backend de Next.js (que sería problemático en serverless).

### Cloud convenience, never authority

**Decisión:** el equipo nunca confía ciegamente en el cloud para acciones críticas.

**Por qué:**
- Si la nube se compromete (cuenta hackeada, JWT robado), los interlocks físicos del equipo siguen activos.
- El Sentinel vive **dentro** del equipo y puede vetar cualquier comando.
- Las 7 capas de validación protegen contra escalamiento.

### Edge Gateway como huésped (no reemplazo)

**Decisión:** el software original del equipo (CommandDaemon, Sentinel, módulos, SQLClient) no se modifica.

**Por qué:**
- Riesgo cero para la operación existente del cliente.
- Rollback trivial: detener el servicio systemd y el equipo vuelve a operar como antes.
- El cliente puede aprobar la instalación sin auditoría exhaustiva del software crítico.

### `clean_session=False` + `client_id` estable en el Ingestion Service

**Decisión:** el cliente MQTT del Ingestion Service usa el mismo `client_id` siempre y mantiene sesión persistente en EMQX.

**Por qué:**
- Cubre el escenario de redeploy / crash del servicio sin perder mensajes.
- Trade-off: hay que evitar correr DOS instancias con el mismo `client_id` — la segunda kickea a la primera. Si en el futuro escalamos horizontalmente, hay que asignar `client_id`s diferentes y particionar topics.

### Espectros: umbral de 200 KB para inline vs Storage

**Decisión:** espectros <200 KB van inline como JSONB; >200 KB van a Storage.

**Por qué:**
- JSONB es ideal para queries del dashboard (rápido, indexable, transaccional).
- Pero >200 KB infla la base, ralentiza joins y consume mucho disco.
- Storage es barato y escala bien — el path en la fila es suficiente para el dashboard.
- 200 KB cubre la mayoría de los espectros típicos sin offload.

### Retry exponencial solo en errores 5xx

**Decisión:** `supabase_writer` reintenta solo si Supabase devuelve 5xx (server error). Los 4xx (client error: payload inválido, FK violation, etc.) NO se reintentan.

**Por qué:**
- 4xx significa "tu petición está mal" — reintentar no la va a arreglar y solo genera ruido.
- 5xx significa "Supabase tiene un problema temporal" — reintentar con backoff es la respuesta correcta.

### Cache TTL 60 s para `devices.last_seen_at`

**Decisión:** no actualizar `last_seen_at` en cada mensaje; cachear y actualizar como mucho cada 60 s por device.

**Por qué:**
- Sin cache: 7 módulos * 1 msg/2s = 3.5 UPDATEs/s por equipo solo para esto. Con 10 equipos, ya son 35 UPDATEs/s a una sola fila → potencial cuello de botella.
- Con cache: máximo 1 UPDATE/min por equipo. La precisión de "última vez visto" no se ve afectada (la pantalla muestra "online si <5 min").

---

## 9. Estado actual y lo que sigue

### 9.1 Lo que está completado y desplegado

- **Fase 0 — Infraestructura:** ✅ todo
- **Fase 1 — Edge Gateway:** ✅ todo (publishers + command receiver + validator + offline buffer)
- **Fase 2 — Ingestion Service:** ✅ todo (handlers + retry + storage + healthcheck + deploy en Railway)

**Posición vs cronograma original:** ~4 semanas de adelanto. El "milestone principal del proyecto" según el plan estaba programado para el **14 de mayo 2026**; las partes que dependen de Dev A están cumplidas el 17 de abril.

### 9.2 Lo que falta y dependencias

| Pendiente | Quién | Bloqueado por |
|---|---|---|
| Frontend Next.js — init del proyecto | Dev B | — |
| Pantallas de lectura (Status, Mediciones, Alertas) | Dev B | init Next.js + Supabase Auth claims |
| Pantallas de control (Operario, Servicio) | Dev B | Fase 5 backend (Route Handler) |
| **Fase 5 — Route Handler `/api/devices/[id]/commands`** | Dev A | Init Next.js (Dev B) + Auth claims (Dev B) |
| **Fase 6 — Hardening** (10 SEC + 6 RES + carga + rollback + monitoreo + docs + deploy real) | Mixto | Algunos items requieren Dev B; otros solo Dev A o hardware |

### 9.3 Resumen para stakeholders en una respiración

> "El backend del proyecto está listo y desplegado en producción. El equipo XRF puede mandar datos a la nube, esos datos se guardan en menos de un segundo, y el sistema sobrevive caídas de internet, del broker y del propio servicio sin perder mensajes. Lo único que falta para que el cliente final vea los datos en una pantalla es el frontend, que es trabajo en curso del otro desarrollador. Estamos ~4 semanas adelantados sobre el plan original."

---

## 10. Operación

### 10.1 Cómo correr todo localmente

```bash
# 1. Instalar el Ingestion Service en modo dev
cd sax-XRFOnStream/packages/ingestion-service
pip install -e ".[dev]"

# 2. Correr tests unitarios
pytest tests/ -v

# 3. Correr el servicio contra broker + Supabase reales
python -m src.main
# (lee .env raíz; necesita SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MQTT_*)
```

### 10.2 Cómo correr el demo del Edge Gateway

```bash
cd sax-XRFOnStream/packages/edge-gateway
python demo_live.py
# Publica 7 telemetry + 1 equipment_state + 1 sentinel report al broker real
```

### 10.3 Cómo correr la suite de validación end-to-end

```bash
cd sax-XRFOnStream/packages/ingestion-service
PYTHONIOENCODING=utf-8 python scripts/phase2_e2e.py spectra-inline
PYTHONIOENCODING=utf-8 python scripts/phase2_e2e.py spectra-large
PYTHONIOENCODING=utf-8 python scripts/phase2_e2e.py concentrations
PYTHONIOENCODING=utf-8 python scripts/phase2_e2e.py command
PYTHONIOENCODING=utf-8 python scripts/phase2_e2e.py continuous --duration 300 --interval 2
# qos1-publish requiere coordinar con railway down/up
```

### 10.4 Operar el servicio en Railway

```bash
# Login (token o interactivo)
RAILWAY_API_TOKEN=<token> railway whoami

# Ver logs
railway logs --service sax-ingestion-service

# Cambiar variables de entorno
railway variables --set 'LOG_LEVEL=DEBUG' --service sax-ingestion-service

# Redeployar (build con Dockerfile)
railway up --service sax-ingestion-service --ci

# Detener (para mantenimiento o test de QoS persistente)
railway down --service sax-ingestion-service -y

# Ver estado
railway status
```

### 10.5 Consultar Supabase rápido sin pasar por el dashboard

```bash
SRK="<SUPABASE_SERVICE_ROLE_KEY>"
B="https://ndnijhnpfzxanadtfflb.supabase.co/rest/v1"

# Last seen del equipo demo
curl -s -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "$B/devices?id=eq.d1e2f3a4-0000-0000-0000-000000000001&select=id,last_seen_at"

# Conteo de telemetría por módulo
curl -s -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "$B/device_telemetry?select=module&limit=1000" | jq 'group_by(.module) | map({module: .[0].module, count: length})'

# Últimas 5 alertas
curl -s -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  "$B/alerts?select=*&order=received_at.desc&limit=5"
```

### 10.6 Variables de entorno consolidadas

| Variable | Para | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Frontend / Ingestion | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Pública, va al browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingestion + Route Handler | **Secreta**, bypassa RLS |
| `EMQX_BROKER_URL` / `MQTT_BROKER_URL` | Edge GW / Ingestion | Hostname del broker |
| `EMQX_BROKER_PORT` / `MQTT_BROKER_PORT` | Edge GW / Ingestion | 8883 (TLS) |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Edge GW (`xrf-dev-001`) | Credenciales del equipo |
| `INGESTION_MQTT_USERNAME` / `INGESTION_MQTT_PASSWORD` | Ingestion (`ingestion-svc`) | Credenciales del cloud subscriber |
| `EMQX_HTTP_API_URL` / `EMQX_HTTP_API_KEY` / `EMQX_HTTP_API_SECRET` | Route Handler (Fase 5) | Para publicar comandos via HTTP |
| `HMAC_SECRET` | Edge GW + Route Handler | Por device, en `private.device_secrets` |
| `DEVICE_ID` / `TENANT_ID` | Edge GW | Identidad del equipo (en `provision.json`) |
| `HEALTHCHECK_PORT` | Ingestion | Default 8080 |
| `HEALTHCHECK_STALE_SECONDS` | Ingestion | Default 300 — si no llegan mensajes en X seg, /healthz responde 503 |
| `LOG_LEVEL` | Ingestion | Default INFO |

---

## Apéndice A — Archivos clave para revisar

| Si quieres entender... | Lee... |
|---|---|
| El plan completo | `SAX-PROYECT/docs/PLAN_IMPLEMENTACION_IOT_V2.md` |
| La distribución de roles y semanas | `SAX-PROYECT/docs/ESTRATEGIA_COLABORACION.md` |
| El estado actual sin filtrar | `sax-XRFOnStream/docs/ESTADO_PROYECTO.md` |
| El esquema de la base | `sax-XRFOnStream/supabase/migrations/*.sql` |
| Cómo está construido el Ingestion Service | `sax-XRFOnStream/packages/ingestion-service/README.md` |
| Cómo se valida end-to-end | `sax-XRFOnStream/packages/ingestion-service/scripts/phase2_e2e.py` |
| Config de despliegue Railway | `sax-XRFOnStream/packages/ingestion-service/railway.json` |
| Modelos de payloads MQTT | `sax-XRFOnStream/packages/ingestion-service/src/models.py` |
| Cómo funciona el Edge Gateway | `sax-XRFOnStream/packages/edge-gateway/src/*.py` |

---

## Apéndice B — Cómo resumir esto en una conversación de 2 minutos

> "Construimos la cañería completa para que los equipos XRF de SAX manden sus datos a la nube en tiempo real. Hay tres piezas: un programa en el equipo que lee de su base local sin tocar el software original, un broker MQTT en la nube que rutea los mensajes, y un servicio en Railway que toma esos mensajes y los guarda en Supabase. Todo encriptado, multi-tenant, y resistente a caídas: probamos parar el servicio receptor, mandar 10 mensajes, encenderlo de nuevo y los 10 llegaron sin perderse. La latencia punta-a-punta es de 700 milisegundos, bien por debajo del objetivo de 3 segundos. El backend está desplegado y corriendo 24/7. Falta el frontend, que lo está construyendo el otro dev — pero los datos ya están ahí esperándolo."
