# Frontend — SAX XrfOnStream

Dashboard web de la plataforma IoT para los analizadores XRF on-stream de SAX.
Monitoreo y control remoto de equipos en planta.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 ·
`@supabase/ssr` · Recharts · Realtime de Supabase.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de producción
npm run lint
```

### Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side (Route Handler de comandos)
EMQX_HTTP_API_URL=                # https://...:8443  (base, sin /api/v5)
EMQX_HTTP_API_KEY=
EMQX_HTTP_API_SECRET=
```

> El envío de comandos publica a EMQX por su HTTP API (puerto 8443). En redes que
> bloquean puertos no estándar, eso solo funciona desde un entorno con salida
> abierta (p. ej. Vercel), no necesariamente desde localhost.

## Estructura

```
src/
├── app/                      rutas (App Router)
│   ├── (auth)/               login, accept-invite
│   ├── (dashboard)/          devices, admin, layout
│   └── api/devices/[id]/commands/route.ts   envío de comandos (HMAC + EMQX)
├── components/               scada, measurements, alerts, operator, service, admin
├── hooks/                    useTelemetry, useEquipmentState, useAlerts,
│                             useMeasurements, useCommands, useScadaTelemetry
├── lib/                      supabase (client/server/middleware), hmac, emqx, auth
├── services/                 tenants, users, devices
└── types/                    database, telemetry, auth, ...
```

## Conceptos clave

- **Datos en vivo:** los hooks (`use*`) hacen fetch inicial + suscripción Realtime
  a Supabase. Los numéricos se coercionan (`Number()`) porque el equipo publica
  Decimals como strings.
- **Roles/tenant:** viven en la tabla protegida `user_profiles` (migración 00013),
  no en `user_metadata`. RLS, middleware y el Route Handler leen de ahí.
- **Comandos:** `POST /api/devices/[id]/commands` verifica rol → firma HMAC →
  publica a EMQX → registra en `command_audit`. Requiere que el equipo esté
  provisionado (`device_secrets`).
- **Telemetría:** el campo `data` de `device_telemetry` refleja las columnas
  `*_status` del equipo (ver `src/types/telemetry.ts`, punto de integración INT-2).

## Documentación relacionada

- Manual de usuario: [`../../docs/MANUAL_USUARIO.md`](../../docs/MANUAL_USUARIO.md)
- Onboarding de equipos: [`../../docs/onboarding/provisionar-equipo.md`](../../docs/onboarding/provisionar-equipo.md)
- Runbook de operaciones: [`../../docs/runbook/operaciones.md`](../../docs/runbook/operaciones.md)
