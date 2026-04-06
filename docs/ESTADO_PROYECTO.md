# Estado del Proyecto — SAX XrfOnStream IoT Platform

**Fecha de actualización:** 2026-04-06
**Fase completada:** Fase 0 (Infraestructura base) + Fase 0 Final (Scaffold + Seed)
**Responsable:** Dev A (Backend/IoT)

---

## 1. Repositorio

- **URL:** https://github.com/SAX-Devs/sax-XRFOnStream (privado)
- **Branch principal:** `main`
- **Estructura:** Monorepo con 3 paquetes + migraciones + scripts

```
sax-XRFOnStream/
├── packages/
│   ├── edge-gateway/          ← Python: servicio en el equipo (Dev A)
│   │   ├── src/               ← Módulos implementados: config.py, main.py (resto son stubs)
│   │   ├── tests/             ← conftest.py con fixtures, test files son stubs vacíos
│   │   ├── config/            ← provision.example.json con valores reales de dev
│   │   ├── sql/               ← init_local_tables.sql (stub)
│   │   ├── pyproject.toml     ← Deps: paho-mqtt>=2.0, psycopg[binary]>=3.1, pydantic>=2.0
│   │   ├── Dockerfile         ← Stub vacío
│   │   └── xrfonstream-edge-gateway.service  ← Stub vacío
│   │
│   ├── ingestion-service/     ← Python: puente MQTT → Supabase (Dev A)
│   │   ├── src/               ← Todos los archivos son stubs vacíos
│   │   ├── tests/
│   │   ├── pyproject.toml     ← Stub vacío
│   │   └── Dockerfile         ← Stub vacío
│   │
│   └── frontend/              ← Next.js: dashboard web (Dev B)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/
│       │   │   ├── (auth)/accept-invite/
│       │   │   ├── (dashboard)/layout.tsx          ← Stub vacío
│       │   │   ├── (dashboard)/devices/[id]/status/
│       │   │   ├── (dashboard)/devices/[id]/measurements/
│       │   │   ├── (dashboard)/devices/[id]/operator/
│       │   │   ├── (dashboard)/devices/[id]/service/
│       │   │   ├── (dashboard)/devices/[id]/spectra/
│       │   │   ├── (dashboard)/devices/[id]/alerts/
│       │   │   ├── (dashboard)/admin/
│       │   │   └── api/devices/[id]/commands/
│       │   ├── components/
│       │   ├── lib/
│       │   │   ├── supabase/client.ts              ← Stub vacío
│       │   │   ├── supabase/server.ts              ← Stub vacío
│       │   │   ├── supabase/middleware.ts           ← Stub vacío
│       │   │   ├── hmac/sign.ts                    ← Stub vacío
│       │   │   └── emqx/publish.ts                 ← Stub vacío
│       │   └── types/
│       │   └── middleware.ts                        ← Stub vacío
│       ├── package.json        ← Stub vacío (Dev B debe correr create-next-app)
│       ├── tsconfig.json       ← Stub vacío
│       ├── tailwind.config.ts  ← Stub vacío
│       └── next.config.ts      ← Stub vacío
│
├── supabase/
│   ├── migrations/            ← 11 migraciones SQL, TODAS aplicadas en Supabase
│   ├── seed.sql               ← Stub vacío
│   └── config.toml            ← Stub vacío
│
├── scripts/
│   ├── generate-provision-package.sh  ← Stub vacío (pendiente)
│   └── seed-dev-data.sh              ← Funcional: crea tenant, device, user y telemetría mock
│
├── docs/
│   ├── adr/                   ← Vacío (ADRs pendientes)
│   ├── runbook/               ← Vacío
│   └── onboarding/            ← Vacío
│
├── .env.example               ← Todas las variables con placeholders
├── .env                       ← Valores reales (NO commiteado, en .gitignore)
├── .gitignore                 ← Python + Node + secrets configurados
└── README.md
```

---

## 2. Supabase (Base de datos cloud)

### Proyecto
- **Project ref:** `ndnijhnpfzxanadtfflb`
- **URL:** `https://ndnijhnpfzxanadtfflb.supabase.co`
- **Región:** South America (São Paulo)
- **Plan:** Free (upgrade a Pro para producción)

### Tablas creadas (11 migraciones aplicadas)

| Tabla | Schema | RLS | Descripción |
|-------|--------|-----|-------------|
| `tenants` | public | Sí | Clientes/empresas mineras |
| `devices` | public | Sí | Equipos XRF registrados, vinculados a un tenant |
| `device_telemetry` | public | Sí | Datos de telemetría de 7 módulos (generator, vacuum, circulation, interchanger, detector, temp_control, auxiliary) |
| `device_spectra` | public | Sí | Espectros XRF (JSONB inline o Storage path) |
| `command_audit` | public | Sí | Auditoría de comandos remotos enviados al equipo |
| `alerts` | public | Sí | Alertas del Sentinel y del sistema |
| `device_secrets` | **private** | No (inaccesible para anon/authenticated) | HMAC secrets y credenciales MQTT por dispositivo |
| `device_equipment_state` | public | Sí | Estado global inferido del equipo (idle, measuring, etc.) |
| `device_concentrations` | public | Sí | Concentraciones elementales en g/L (preparada para DEP-01) |

### Enums creados
- `device_status_enum`: pending_activation, active, offline, maintenance, decommissioned
- `command_status_enum`: sent, delivered, ack, executing, completed, error, rejected, expired
- `alert_severity_enum`: info, warning, critical, emergency
- `equipment_state_enum`: unknown, idle, measuring, initializing, standby, error, offline

### RLS (Row Level Security)
- Habilitado en todas las tablas públicas
- Funciones helper: `get_user_tenant_id()` y `get_user_role()` leen claims del JWT
- Cada policy filtra por `tenant_id = get_user_tenant_id()` o permite si `role = 'sax_admin'`
- `private.device_secrets` tiene REVOKE ALL para anon y authenticated — solo accesible via `service_role` key

### Triggers
- `trg_tenants_updated_at`: actualiza `updated_at` automáticamente al UPDATE
- `trg_devices_updated_at`: igual para devices

### Datos de desarrollo (seed data ya insertados)

| Recurso | Valor |
|---------|-------|
| Tenant | `a1b2c3d4-0000-0000-0000-000000000001` — "Minera Demo" (slug: minera-demo) |
| Device | `d1e2f3a4-0000-0000-0000-000000000001` — "Equipo Demo Lab" (serial: XRF-DEV-001, status: active) |
| Device Secrets | HMAC secret + mqtt creds insertados en `private.device_secrets` |
| Telemetría mock | 7 registros (1 por módulo) con datos realistas |
| Equipment State | Estado `idle` con detalle `{"active_tasks": [], "hv_on": false}` |
| Usuario de prueba | Disponible via seed script: `dev@sax.cl` / `devpassword123` (role: sax_admin) |

### Keys de Supabase (en .env)
- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — key pública para el frontend
- `SUPABASE_SERVICE_ROLE_KEY` — key secreta que bypassa RLS (solo server-side)

---

## 3. EMQX Cloud (Broker MQTT)

### Deployment
- **ID:** deployment-wc68f227
- **Plan:** Serverless (free tier: 1M session minutes/month)
- **Región:** North America (AWS)
- **EMQX Version:** v5
- **Address:** `wc68f227.ala.us-east-1.emqxsl.com`
- **MQTT Port (TLS):** `8883`
- **WebSocket Port (TLS):** `8084`
- **API Endpoint:** `https://wc68f227.ala.us-east-1.emqxsl.com:8443/api/v5`
- **TLS:** Obligatorio (Serverless no permite conexiones sin TLS)

### Usuarios MQTT (Authentication)

| Username | Propósito | Password en .env |
|----------|-----------|------------------|
| `xrf-dev-001` | Dispositivo de prueba (Edge Gateway) | `MQTT_PASSWORD` |
| `ingestion-svc` | Ingestion Service (suscriptor cloud) | `INGESTION_MQTT_PASSWORD` |

### ACL (Authorization) — Configuradas por Username

**xrf-dev-001 (dispositivo) — 9 permisos:**

| Topic | Action |
|-------|--------|
| `sax/+/+/telemetry/#` | Publish |
| `sax/+/+/command/ack` | Publish |
| `sax/+/+/command/result` | Publish |
| `sax/+/+/spectra` | Publish |
| `sax/+/+/alerts` | Publish |
| `sax/+/+/sentinel` | Publish |
| `sax/+/+/equipment_state` | Publish |
| `sax/+/+/concentrations` | Publish |
| `sax/+/+/command/request` | Subscribe |

**ingestion-svc (cloud) — 8 permisos (todos Subscribe):**

| Topic | Action |
|-------|--------|
| `sax/+/+/telemetry/#` | Subscribe |
| `sax/+/+/spectra` | Subscribe |
| `sax/+/+/concentrations` | Subscribe |
| `sax/+/+/alerts` | Subscribe |
| `sax/+/+/sentinel` | Subscribe |
| `sax/+/+/command/ack` | Subscribe |
| `sax/+/+/command/result` | Subscribe |
| `sax/+/+/equipment_state` | Subscribe |

### HTTP API (para publicar comandos desde Next.js Route Handler)
- **API Key (App ID):** en `.env` como `EMQX_HTTP_API_KEY`
- **API Secret:** en `.env` como `EMQX_HTTP_API_SECRET`
- Permite publicar mensajes MQTT via HTTP POST sin necesidad de mantener una conexión MQTT persistente

### Estructura de topics MQTT

```
sax/{tenant_id}/{device_id}/telemetry/{module}   ← Status de cada módulo
sax/{tenant_id}/{device_id}/spectra               ← Espectros XRF
sax/{tenant_id}/{device_id}/concentrations         ← Concentraciones (DEP-01)
sax/{tenant_id}/{device_id}/sentinel               ← Alertas del Sentinel
sax/{tenant_id}/{device_id}/alerts                 ← Alertas generales
sax/{tenant_id}/{device_id}/equipment_state        ← Estado global del equipo
sax/{tenant_id}/{device_id}/command/request        ← Cloud → Device (comandos)
sax/{tenant_id}/{device_id}/command/ack            ← Device → Cloud (ACK)
sax/{tenant_id}/{device_id}/command/result         ← Device → Cloud (resultado)
```

---

## 4. Seguridad

| Elemento | Estado |
|----------|--------|
| HMAC-SHA256 secret (256 bits) | Generado, en `.env` y en `private.device_secrets` |
| MQTT auth (username/password) | Configurado en EMQX, TLS 1.3 obligatorio |
| ACL por topic | Configurado — dispositivo no puede publicar en topics de otro |
| RLS en Supabase | Habilitado en todas las tablas públicas |
| `private.device_secrets` | Inaccesible para roles anon/authenticated, verificado |
| `.env` con secretos | En `.gitignore`, nunca commiteado |

---

## 5. Servicios externos pendientes

| Servicio | Estado | Propósito |
|----------|--------|-----------|
| **Vercel** | Pendiente (Dev B) | Deploy del frontend Next.js |
| **Railway** | Cuenta creada, sin proyecto | Deploy del Ingestion Service |
| **Dominio (app.sax.cl)** | Pendiente | DNS apuntando a Vercel |

---

## 6. Edge Gateway — Estado actual

El scaffold está listo y funcional:

- `config.py` — Modelo Pydantic completo que parsea `provision.json`
- `main.py` — Entry point que carga config y logea. Ejecutable con: `python -m src.main --config config/provision.example.json`
- `pyproject.toml` — Dependencies instalables con `pip install -e ".[dev]"`
- `conftest.py` — Fixture `sample_config_path` que genera provision.json temporal para tests
- Módulos pendientes (stubs vacíos): mqtt_client, telemetry_publisher, sentinel_publisher, concentrations_publisher, equipment_state_publisher, command_receiver, command_validator, result_reporter, spectra_uploader, offline_buffer, db_reader

---

## 7. Lo que Dev B necesita hacer (Fase 0 — Frontend)

Según el plan, Dev B debe completar estas tareas del Paso 0.3:

1. **Inicializar proyecto Next.js** en `packages/frontend/`:
   ```bash
   cd packages/frontend
   # Borrar los stubs vacíos primero
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Implementar lib/supabase/**:
   - `client.ts` — Supabase client para componentes del lado del cliente (createBrowserClient)
   - `server.ts` — Supabase client para Server Components y Route Handlers (createServerClient)
   - `middleware.ts` — Helper para refresh de sesión en middleware

3. **Implementar stubs server-side:**
   - `lib/hmac/sign.ts` — Firma HMAC-SHA256 de comandos (usa crypto de Node.js)
   - `lib/emqx/publish.ts` — Publicación via HTTP API de EMQX (fetch a la API REST)

4. **Implementar middleware:**
   - `src/middleware.ts` — Protección de rutas, redirect a `/login` si no autenticado

5. **Implementar login:**
   - `src/app/(auth)/login/page.tsx` — Formulario email + password con `supabase.auth.signInWithPassword()`

6. **Layout básico:**
   - `src/app/(dashboard)/layout.tsx` — Sidebar con navegación

7. **Variables de entorno:** Copiar `.env` a `packages/frontend/.env.local` con:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ndnijhnpfzxanadtfflb.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ver .env en raíz>
   SUPABASE_SERVICE_ROLE_KEY=<ver .env en raíz>
   EMQX_HTTP_API_URL=https://wc68f227.ala.us-east-1.emqxsl.com:8443
   EMQX_HTTP_API_KEY=<ver .env en raíz>
   EMQX_HTTP_API_SECRET=<ver .env en raíz>
   ```

8. **Deploy en Vercel:** Vincular el repo de GitHub, configurar las variables de entorno en Vercel Dashboard.

### Datos disponibles para Dev B
- La base de datos ya tiene un tenant, un device y telemetría mock de 7 módulos
- Las queries desde el frontend pasarán por RLS automáticamente
- El usuario de prueba se puede crear ejecutando `scripts/seed-dev-data.sh` o manualmente en Supabase Dashboard → Authentication

---

## 8. Archivos de referencia

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| Plan de implementación completo | `SAX-PROYECT/PLAN_IMPLEMENTACION_IOT_V2.md` | Todas las fases, SQL, payloads MQTT, criterios de aceptación |
| Estrategia de colaboración | `SAX-PROYECT/ESTRATEGIA_COLABORACION.md` | División de roles, calendario semana a semana, puntos de integración |
| Variables de entorno (ejemplo) | `sax-XRFOnStream/.env.example` | Todas las variables con placeholders |
| Variables de entorno (reales) | `sax-XRFOnStream/.env` | Valores reales, NO en git |

---

## 9. Git config del repositorio

- **Git local config:** `SAX-CL` / `angel.guevara@sax.cl` (solo dentro de este repo)
- **Remote URL:** `https://SAX-CL@github.com/SAX-Devs/sax-XRFOnStream.git`
- Los commits y push desde este repo van con la cuenta de la organización SAX
