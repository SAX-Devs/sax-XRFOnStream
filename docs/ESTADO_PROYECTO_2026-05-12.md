# Estado del Proyecto — SAX XrfOnStream IoT Platform

**Fecha de actualización:** 2026-05-12
**Snapshot anterior:** [ESTADO_PROYECTO.md](ESTADO_PROYECTO.md) (2026-04-17 — **desactualizado**, sub-estima el avance del frontend)
**Verificación:** este documento se generó leyendo directamente el código del repo, no copiando del snapshot anterior.
**Fase completada:** Fase 0 (Infra) + Fase 1 (Edge Gateway) + Fase 2 (Ingestion Service) + Fase 3 (Frontend) ~80%
**Fase en curso:** Cableado de datos reales en las pantallas del frontend + deploy a Vercel
**Responsables:** Dev A (Backend/IoT) — Dev B (Frontend)

---

## 1. Contexto desde la última reunión con SAX

La presentación a SAX tuvo **buena recepción**. Salieron dos bloques de feedback que **modifican el alcance de la Fase 3** y nos tienen en **espera parcial**:

### 1.1. Cambios al diagrama del equipo (P&ID)

SAX modificó el equipo en planta:
- **Nuevas válvulas** agregadas al esquema (cantidad/ubicación pendiente de confirmación).
- **Cambio en la distribución del flujo que entra al detector**.

**Importante:** el frontend **ya tiene un diagrama SVG completo implementado** en [packages/frontend/src/components/scada/](../packages/frontend/src/components/scada/) con 3 tanques (Water, Brine, Brine Retro), 7 válvulas de compuerta (PV-101 a PV-401), 1 válvula de bola (PV-301), bomba peristáltica (P-101), intercambiador rotativo (IC-001), detector (DET-001), tubo de rayos X (GEN-001), 2 bombas de vacío (VP-001/002) y venteo atmosférico. Lo que falta cuando llegue el dibujo nuevo es **ajustar el SVG** (agregar válvulas nuevas + recablear el path al detector), no rehacerlo.

**Estado:** esperando dibujo/PDF actualizado de SAX.

### 1.2. Ajustes a pantallas ya revisadas (mediciones, operario, servicio, alertas)

SAX **aprobó conceptualmente** las cuatro pantallas (la UI ya está construida con datos mock). Pendiente lista detallada de ajustes finos.

**Estado:** esperando lista escrita de cambios.

### 1.3. Lo que NO está en pausa

Hay trabajo concreto y de alto valor que no depende de ninguno de los dos bloqueos. Ver sección 11.

---

## 2. Repositorio

- **URL:** https://github.com/SAX-Devs/sax-XRFOnStream (privado)
- **Branch principal:** `main`
- **Estructura:** Monorepo con 3 paquetes + migraciones + scripts

```
sax-XRFOnStream/
├── packages/
│   ├── edge-gateway/         ← Python: servicio en el equipo (Dev A)  ✅ Fase 1
│   ├── ingestion-service/    ← Python: puente MQTT → Supabase  ✅ Fase 2 + deploy Railway
│   └── frontend/             ← Next.js 16 + React 19 + Tailwind 4  🚧 Fase 3 ~80%
├── supabase/
│   └── migrations/           ← 11 migraciones SQL commiteadas, +1 aplicada solo en cloud (⚠ ver §3.4)
├── scripts/
│   ├── generate-provision-package.sh  ← stub
│   └── seed-dev-data.sh              ← funcional
└── docs/
    ├── ESTADO_PROYECTO.md            ← snapshot 2026-04-17
    └── ESTADO_PROYECTO_2026-05-12.md ← este documento
```

---

## 3. Supabase (Base de datos cloud)

- **Project ref:** `ndnijhnpfzxanadtfflb` — Región São Paulo — Plan Free.
- **11 migraciones commiteadas en el repo**, todas aplicadas en cloud.
- 9 tablas activas (`tenants`, `devices`, `device_telemetry`, `device_spectra`, `device_concentrations`, `device_equipment_state`, `alerts`, `command_audit`, `private.device_secrets`).
- RLS activo en todas las tablas públicas; `device_secrets` en schema privado.
- Seed data intacto: tenant `Minera Demo`, device `XRF-DEV-001`.

### 3.4. ⚠ Deuda detectada al auditar el código

El Route Handler [api/devices/[id]/commands/route.ts:67](../packages/frontend/src/app/api/devices/[id]/commands/route.ts#L67) llama a una función Postgres `get_device_hmac_secret(p_device_id)` que **no existe** en `supabase/migrations/` del repo (la última es `00011_auth_hooks.sql`). Está creada solo en la Supabase Dashboard.

**Acción:** extraer la definición de la función como `00012_get_device_hmac_secret_fn.sql` y commitearla. Sin esto, un `supabase db reset` o una nueva instalación rompe el envío de comandos.

---

## 4. EMQX Cloud (Broker MQTT) — sin cambios

- `wc68f227.ala.us-east-1.emqxsl.com:8883` (TLS 1.3).
- 2 usuarios (`xrf-dev-001`, `ingestion-svc`) con ACLs por topic.
- HTTP API habilitada y consumida por el Route Handler de comandos.

Los topics actuales (`sax/+/+/telemetry/{module}`) absorben cualquier módulo nuevo (incluidas las válvulas nuevas) sin cambios de ACL.

---

## 5. Edge Gateway — Fase 1 ✅

Estable. 7 publishers + 1 receiver + offline buffer + HMAC validation. Sin cambios desde el snapshot anterior.

**Deuda técnica vigente:**
- `packages/edge-gateway/tests/` con stubs vacíos (sin cobertura unit real).
- `Dockerfile` stub.
- `xrfonstream-edge-gateway.service` (systemd unit) stub.
- `scripts/generate-provision-package.sh` stub.

---

## 6. Ingestion Service — Fase 2 ✅

53/53 tests pasando. Desplegado en Railway. 13/13 criterios E2E verdes el 2026-04-17 (latencia ~700 ms, 144/144 mensajes sin pérdida en prueba de 5 min, sesión QoS 1 verificada con stop/start).

- Proyecto Railway: https://railway.com/project/492cf7d6-e756-43be-b3fe-84a29ba39477
- Bucket `device-spectra` operativo.

Sin tareas en curso. El router actual absorbe módulos nuevos sin código nuevo.

---

## 7. Frontend — Fase 3 🚧 ~80%

### 7.1. Stack y dependencias (verificado en `package.json`)

- Next.js **16.2.3** con App Router + `src-dir` + TypeScript estricto
- React **19.2.4**
- Tailwind CSS **4** (`@tailwindcss/postcss`)
- `@supabase/ssr` 0.10.2 + `@supabase/supabase-js` 2.103.0
- `recharts` 3.8.1 (gráficos)
- `framer-motion` 12.38.0 (animaciones)
- ESLint 9 + `eslint-config-next` 16

### 7.2. Lo que SÍ está construido y conectado a datos reales

| Pieza | Archivo | Estado |
|---|---|---|
| Supabase browser client | [lib/supabase/client.ts](../packages/frontend/src/lib/supabase/client.ts) | ✅ |
| Supabase server client (cookies + service role) | [lib/supabase/server.ts](../packages/frontend/src/lib/supabase/server.ts) | ✅ |
| Supabase middleware client | [lib/supabase/middleware.ts](../packages/frontend/src/lib/supabase/middleware.ts) | ✅ |
| HMAC sign | [lib/hmac/sign.ts](../packages/frontend/src/lib/hmac/sign.ts) | ✅ canonical JSON + HMAC-SHA256 |
| EMQX publish | [lib/emqx/publish.ts](../packages/frontend/src/lib/emqx/publish.ts) | ✅ HTTP API v5 con Basic Auth |
| Proxy/middleware (auth + roles) | [proxy.ts](../packages/frontend/src/proxy.ts) | ✅ redirect login + admin guard |
| Login page | [(auth)/login/page.tsx](../packages/frontend/src/app/(auth)/login/page.tsx) | ✅ UI pulida con logo, password toggle, manejo de error |
| Accept-invite (set password desde token) | [(auth)/accept-invite/page.tsx](../packages/frontend/src/app/(auth)/accept-invite/page.tsx) | ✅ exchange de tokens + password strength meter |
| Dashboard layout + TopNav | [(dashboard)/layout.tsx](../packages/frontend/src/app/(dashboard)/layout.tsx) | ✅ |
| Devices list | [(dashboard)/devices/page.tsx](../packages/frontend/src/app/(dashboard)/devices/page.tsx) | ✅ usa `getDevices()` real |
| Device tabs layout | [devices/[id]/layout.tsx](../packages/frontend/src/app/(dashboard)/devices/[id]/layout.tsx) | ✅ |
| **API: POST /api/devices/[id]/commands** | [route.ts](../packages/frontend/src/app/api/devices/[id]/commands/route.ts) | ✅ E2E: validación de rol → HMAC → publish MQTT → insert en `command_audit` |
| Admin: tenants CRUD | [(dashboard)/admin/tenants/...](../packages/frontend/src/app/(dashboard)/admin/tenants/) | ✅ create tenant, create device, invite user (Server Actions) |
| Hook `useTelemetry` | [hooks/use-telemetry.ts](../packages/frontend/src/hooks/use-telemetry.ts) | ✅ fetch inicial + Supabase Realtime (`postgres_changes`) |
| Hook `useEquipmentState` | [hooks/use-equipment-state.ts](../packages/frontend/src/hooks/use-equipment-state.ts) | ✅ fetch + realtime |
| Services layer | [services/devices.ts](../packages/frontend/src/services/devices.ts), [services/tenants.ts](../packages/frontend/src/services/tenants.ts), [services/users.ts](../packages/frontend/src/services/users.ts) | ✅ |
| Tipos generados | [types/database.ts](../packages/frontend/src/types/database.ts) + auth/devices/tenants/users/commands/telemetry | ✅ |

### 7.3. Pantallas: UI construida con datos mock (pendiente cablear a datos reales)

Las 5 pantallas operativas **ya están maquetadas y con UI pulida**, pero corren con datos `SAMPLE_*` hardcoded:

| Pantalla | Componente | Estado UI | Datos reales |
|---|---|---|---|
| **Status (P&ID)** | [scada-screen.tsx](../packages/frontend/src/components/scada/scada-screen.tsx) + [process-diagram.tsx](../packages/frontend/src/components/scada/process-diagram.tsx) | ✅ Diagrama SVG completo con 13 componentes interactivos, partículas de flujo animadas | ❌ `sampleState` hardcoded |
| **Measurements** | [measurements-screen.tsx](../packages/frontend/src/components/measurements/measurements-screen.tsx) | ✅ Lista + spectrum chart (recharts) + tabla de concentraciones | ❌ `SAMPLE_MEASUREMENTS`, `SAMPLE_CONCENTRATIONS` |
| **Operator** | [operator-screen.tsx](../packages/frontend/src/components/operator/operator-screen.tsx) | ✅ Badge de estado, botones start/stop/initialize/pause/recalibrate, stat cards, historial | ❌ `SAMPLE_COMMANDS`, botones no llaman al Route Handler todavía |
| **Service** | [service-screen.tsx](../packages/frontend/src/components/service/service-screen.tsx) | ✅ SCADA + 3 diagnostic cards (Generador, Detector, Auxiliar) | ❌ datos hardcoded |
| **Alerts** | [alerts-screen.tsx](../packages/frontend/src/components/alerts/alerts-screen.tsx) | ✅ Filtros por severidad/estado, summary cards, lista con botón "Reconocer" | ❌ `SAMPLE_ALERTS`, ack no persiste |

**Importante:** los hooks `useTelemetry` y `useEquipmentState` **ya están escritos y funcionan**. Cablear cada pantalla es trabajo mecánico: reemplazar el objeto `sample*` por la llamada al hook + adaptar los tipos.

### 7.4. Componentes SCADA implementados

[components/scada/symbols/](../packages/frontend/src/components/scada/symbols/) — 8 símbolos SVG reutilizables: `ball-valve`, `gate-valve`, `peristaltic-pump`, `vacuum-pump`, `xray-tube`, `detector-block`, `interchanger-block`, `tank-cylinder`. Más `pipe-network`, `flow-layer` (partículas), `diagram-defs`, `diagram-background`, `params-panel`, `messages-panel`, `status-panel`, `control-bar`, `power-button`, `diagram-header`.

### 7.5. Lo que NO está construido del frontend

| Item | Impacto |
|---|---|
| Deploy a Vercel | ❌ pendiente. `README.md` del frontend sigue siendo el default de `create-next-app` (línea 1-37 sin personalizar) |
| Dominio `app.sax.cl` | ❌ pendiente |
| Página `(dashboard)/devices/[id]/spectra` | ❌ no existe ruta dedicada (los espectros viven en Measurements) |
| Roles en `app_metadata` vs `user_metadata` | ⚠ comentario en [services/users.ts:7](../packages/frontend/src/services/users.ts#L7): hoy se guardan en `user_metadata` (editable por el propio usuario), tracked como follow-up — **antes de producción** hay que crear tabla `user_profiles` con RLS |
| Ack persistente de alertas | ❌ el botón "Reconocer" no escribe en DB todavía |
| Migración faltante `00012_get_device_hmac_secret_fn.sql` | ⚠ ver §3.4 |

---

## 8. Seguridad — sin cambios desde 2026-04-17

HMAC-SHA256, TLS 1.3 en MQTT, RLS en Supabase, `private.device_secrets` aislado, `.env` en `.gitignore`. La firma de comandos desde el frontend usa **canonical JSON** ([sign.ts](../packages/frontend/src/lib/hmac/sign.ts)) — claves ordenadas alfabéticamente antes de `JSON.stringify`, lo que garantiza que el Edge Gateway pueda reproducir el hash.

---

## 9. Servicios externos

| Servicio | Estado | Cambio |
|---|---|---|
| Supabase | ✅ Activo (Free) | — |
| EMQX Cloud | ✅ Activo (Serverless free) | — |
| Railway | ✅ Ingestion Service en producción | — |
| **Vercel** | ❌ Pendiente | sin avance vs 2026-04-17 |
| Dominio `app.sax.cl` | ❌ Pendiente | sin avance |

---

## 10. Documentación interna

| Carpeta | Estado |
|---|---|
| `docs/adr/` | Vacío |
| `docs/runbook/` | Vacío |
| `docs/onboarding/` | Vacío |
| `docs/ESTADO_PROYECTO.md` | Snapshot 2026-04-17 (desactualizado) |
| `docs/ESTADO_PROYECTO_2026-05-12.md` | Este documento |
| `packages/frontend/README.md` | ❌ default de `create-next-app`, sin personalizar |

---

## 11. 🟢 Qué avanzar mientras esperamos a SAX

Priorizado por impacto. Todo lo de aquí es **independiente** del diagrama nuevo y de los ajustes pendientes.

### 11.1. PRIORIDAD MÁXIMA — Cablear las pantallas a datos reales

**Por qué ahora:** los hooks ya existen, la UI ya existe, la DB ya recibe datos del ingestion service en producción. Lo que falta es trabajo mecánico de **reemplazar `sample*` por hook real**. Esto se puede hacer sin tocar nada que SAX pueda querer cambiar (los ajustes son cosméticos, no estructurales).

Conexiones pendientes:

- [ ] **SCADA / Status:** reemplazar `sampleState` en [process-diagram.tsx:22-38](../packages/frontend/src/components/scada/process-diagram.tsx#L22) por composición de `useTelemetry(deviceId, "vacuum" | "circulation" | "interchanger" | "detector" | "generator")` + `useEquipmentState(deviceId)`.
- [ ] **Measurements:** crear query a `device_spectra` + `device_concentrations` filtrada por `device_id`, ordenada por `device_ts desc`. Mapear `spectra_data` (JSONB inline) o cargar desde `storage_path` cuando el espectro sea grande.
- [ ] **Operator:** cablear el botón "Iniciar Medición" para que haga `POST /api/devices/[id]/commands` con `{ module: "system", command: "start_measurement" }`. Mostrar el `command_id` devuelto y hacer polling de `command_audit` hasta ver `status = completed`. Lo mismo para los demás botones (stop, pause, recalibrate, initialize).
- [ ] **Operator — historial:** reemplazar `SAMPLE_COMMANDS` por query a `command_audit` filtrada por `device_id`, ordenada por `created_at desc`, con realtime para auto-refresh al llegar ACK/RESULT.
- [ ] **Alerts:** reemplazar `SAMPLE_ALERTS` por query a `alerts` con filtros server-side. Botón "Reconocer" → UPDATE en `alerts` (`acknowledged=true, ack_by, ack_at`). Suscripción realtime para alertas nuevas.
- [ ] **Service:** las 3 diagnostic cards leen los mismos hooks de telemetría que el SCADA, solo cambia el subset de campos mostrados.

**Estimación:** 3-5 días de Dev B. Cada pantalla 4-6 horas.

**Por qué es seguro tocar ahora:** lo que SAX va a ajustar son **labels, colores, qué columnas mostrar, agrupaciones, espaciados**. La capa de fetching está debajo y es invisible al usuario, no se la van a tocar.

### 11.2. PRIORIDAD ALTA — Deploy a Vercel (staging)

**Por qué ahora:** sin deploy no puedes mostrar el avance a SAX cuando regrese el feedback. Y permite que ellos (especialmente el operario que iba a revisar UX) entren desde sus máquinas a probar.

- [ ] Crear proyecto Vercel + vincular GitHub repo + `Root Directory = packages/frontend`.
- [ ] Configurar env vars en Vercel Dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EMQX_HTTP_API_URL`, `EMQX_HTTP_API_KEY`, `EMQX_HTTP_API_SECRET`, `NEXT_PUBLIC_SITE_URL`.
- [ ] Actualizar `redirectTo` en Supabase Auth Dashboard para incluir el dominio de Vercel staging (necesario para `accept-invite`).
- [ ] Primer deploy + smoke test del login + listar devices.
- [ ] Decidir dominio: `staging.app.sax.cl` o subdominio Vercel mientras tanto.

**Estimación:** medio día.

### 11.3. PRIORIDAD ALTA — Migración faltante 00012

**Por qué ahora:** silencioso, pero rompe el código si alguien hace `supabase db reset` o monta un proyecto nuevo. Bug latente.

- [ ] Extraer la definición SQL de `get_device_hmac_secret(p_device_id uuid)` desde Supabase Dashboard → Database → Functions.
- [ ] Crear `supabase/migrations/00012_get_device_hmac_secret_fn.sql` con `CREATE OR REPLACE FUNCTION ... SECURITY DEFINER ... GRANT EXECUTE TO service_role`.
- [ ] Commit + verificar que `supabase db diff` no reporte drift.

**Estimación:** 1 hora.

### 11.4. PRIORIDAD ALTA — Pre-trabajo para el diagrama nuevo

**Por qué ahora:** podemos adelantar el armado arquitectónico sin saber los detalles.

- [ ] **Decisión de modelado de telemetría de válvulas nuevas:**
  - **Opción A:** sub-campos del módulo existente (probablemente `vacuum` o `circulation`).
  - **Opción B:** módulo nuevo `valves` en `device_telemetry`.
  - **Recomendación:** Opción A. El diagrama actual ya tiene las válvulas conceptualmente dentro de los módulos `vacuum` (inlet/outlet/purge) y `circulation` (water/brine/retro). Agregar válvulas nuevas como sub-campos JSON evita migrar enums y mantiene la cardinalidad de mensajes razonable.
  - Documentar como **ADR-001** en `docs/adr/`.
- [ ] **Esqueleto de componente SVG vacío** para las válvulas nuevas (depende de qué tipo sean — si son `GateValve` o `BallValve`, los componentes ya existen). Solo falta posicionarlas en `process-diagram.tsx`.
- [ ] **Edge Gateway:** anticipar campos nuevos en el publisher correspondiente (`vacuum_publisher.py` o `circulation_publisher.py`) detrás de un flag de configuración para que el Edge no rompa al desplegar el binario nuevo en un equipo viejo.

**Estimación:** 1 día de diseño + ADR.

### 11.5. PRIORIDAD MEDIA — Migrar roles a tabla `user_profiles`

**Por qué ahora:** [services/users.ts:7-22](../packages/frontend/src/services/users.ts#L7) advierte que guardar `tenant_id` y `role` en `user_metadata` permite que **un usuario edite su propio rol** llamando a `auth.updateUser({ data: { role: 'sax_admin' } })`. Es seguridad rota.

- [ ] Migración `00013_create_user_profiles.sql` con tabla `user_profiles(user_id PK, tenant_id, role, created_at)` + RLS (`SELECT` propio para el usuario, `UPDATE/INSERT` solo `service_role`).
- [ ] Trigger en `auth.users` para que `INSERT` cree el `user_profile` automáticamente.
- [ ] Actualizar `inviteUser` para escribir en `user_profiles` además de pasar `data` al invite.
- [ ] Cambiar `getCurrentUser`, `getTenantUsers`, el middleware y el route handler para leer rol/tenant_id desde `user_profiles` en vez de `user_metadata`.
- [ ] Actualizar el Auth Hook ([00011_auth_hooks.sql](../supabase/migrations/00011_auth_hooks.sql)) que inyecta el rol en el JWT para que lea de `user_profiles`.

**Estimación:** 1-2 días. Riesgo medio — toca auth.

### 11.6. PRIORIDAD MEDIA — Edge Gateway: cerrar deuda técnica

**Por qué ahora:** todavía no hay equipos en producción real. Es el mejor momento.

- [ ] Tests reales en `packages/edge-gateway/tests/` (al menos `command_validator` y publishers).
- [ ] `Dockerfile` real (para CI/testing, no para deploy en planta).
- [ ] `xrfonstream-edge-gateway.service` (systemd unit).
- [ ] `scripts/generate-provision-package.sh` que tome `tenant_id + serial` y genere el `.tar.gz` con `provision.json`.

**Estimación:** 2-3 días.

### 11.7. PRIORIDAD BAJA — Documentación

- [ ] `docs/adr/ADR-001-modelado-valvulas.md` (ver 11.4).
- [ ] `docs/adr/ADR-002-roles-user-profiles.md` (ver 11.5).
- [ ] `docs/runbook/incident-ingestion-down.md`.
- [ ] `docs/runbook/provisioning-nuevo-equipo.md`.
- [ ] `docs/onboarding/dev-setup.md`.
- [ ] Reescribir `packages/frontend/README.md` (actualmente es el default de `create-next-app`).

**Estimación:** 1-2 días.

### 11.8. PRIORIDAD BAJA — CI/CD

- [ ] GitHub Action: `pytest` en `edge-gateway` + `ingestion-service` en cada PR.
- [ ] GitHub Action: `npm run lint && npm run build` en `frontend` en cada PR.
- [ ] Railway auto-deploy ya está vinculado a `main`. Vercel auto-deploy quedará vinculado al hacer 11.2.

**Estimación:** 1 día.

---

## 12. Plan recomendado de los próximos 7-10 días

| Día | Dev A (Backend/IoT) | Dev B (Frontend) |
|---|---|---|
| 1 | ADR-001 modelado de válvulas | Cablear Operator (botones → route handler) |
| 2 | Migración 00012 al repo + ADR-002 (roles) | Cablear Alerts (lista + ack persistente) |
| 3 | Migración 00013 user_profiles + actualizar auth hook | Cablear SCADA (state real) + Service (diagnostic cards) |
| 4 | Tests Edge Gateway + Dockerfile | Cablear Measurements (spectra + concentrations reales) |
| 5 | `generate-provision-package.sh` + systemd unit | Deploy a Vercel staging + smoke test E2E |
| 6 | Runbooks + onboarding doc | Polish menor + revisar consistencia de loading/error states |
| 7 | Buffer / revisión cruzada | Buffer / revisión cruzada |

**Punto de control día 7:** demo lista en `staging.app.sax.cl` con datos reales fluyendo. Si SAX no ha mandado el dibujo nuevo aún, está fuera del camino crítico — el ingreso del feedback puede absorberse en 2-3 días adicionales (ajustar SVG + aplicar lista de cambios cosméticos a las 4 pantallas).

---

## 13. Riesgos a monitorear

- **Validación contra datos reales:** los publishers del Edge Gateway empujan a `device_telemetry` con payloads ya definidos. Al cablear el SCADA con datos reales podría aparecer que algún campo esperado no llega o llega con otro nombre. Probar contra el seed device (`XRF-DEV-001`) o un script de telemetría falsa antes de la demo.
- **Plan Free de Supabase:** 500 MB DB, 1 GB Storage, 50K MAU. Con espectros reales y telemetría continua de 1 equipo, el plan Pro se vuelve necesario antes del primer cliente productivo.
- **Roles editables por el usuario:** §11.5. Bloquear antes de exponer la app a clientes reales.
- **Migración 00012 sin commit:** §3.4. Rompe instalaciones nuevas. Resolver primero.

---

## 14. Resumen ejecutivo en 4 líneas

1. Backend (Fases 0+1+2) ✅ en producción y validado. Sin tareas en curso.
2. Frontend ✅ ~80% — stack completo, auth funcional, route handler de comandos real, 5 pantallas maquetadas con UI pulida pero usando datos mock.
3. Bloqueos por SAX afectan **solo** ajustes cosméticos del diagrama y de las 4 pantallas — la capa de datos no se toca.
4. Camino crítico durante la espera: **cablear las 5 pantallas a datos reales + deploy a Vercel + cerrar 2 deudas críticas** (migración 00012 + roles en tabla protegida). ~7-10 días.
