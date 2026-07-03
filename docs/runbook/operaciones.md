# Runbook de Operaciones — SAX XrfOnStream

Guía de salud del sistema y respuesta a incidentes. Pensada para el dev/ops.

## Arquitectura (resumen)

```
Equipo (Edge Gateway) → EMQX Cloud (MQTT/TLS) → Ingestion Service (Railway) → Supabase → Frontend (Vercel)
                                                                                   ↑
                          Frontend → Route Handler → EMQX HTTP API → command/request → Equipo
```

## Servicios

| Servicio | Dónde | Notas |
|----------|-------|-------|
| Supabase | proyecto `ndnijhnpfzxanadtfflb` | DB + Auth + Realtime + Storage |
| EMQX Cloud | `wc68f227.ala.us-east-1.emqxsl.com` | MQTT 8883, HTTP API 8443 |
| Ingestion Service | Railway | suscriptor MQTT → Supabase |
| Frontend | Vercel | dashboard |

## Chequeo de salud rápido

Con `SUPABASE_SERVICE_ROLE_KEY` + URL del `.env` (todo va por HTTPS/443):

```bash
SRK=...; B="https://ndnijhnpfzxanadtfflb.supabase.co/rest/v1"
# Últimos vistos por equipo
curl -s -H "apikey: $SRK" -H "Authorization: Bearer $SRK" "$B/devices?select=serial,status,last_seen_at"
# ¿Llega telemetría reciente?
curl -s -H "apikey: $SRK" -H "Authorization: Bearer $SRK" "$B/device_telemetry?select=module,device_ts&order=device_ts.desc&limit=10"
```

- **EMQX**: revisar estado del deployment en el dashboard de EMQX Cloud.
- **Ingestion**: `railway logs --service sax-ingestion-service`.

## Incidente: comandos fallan (Operario)

El Route Handler devuelve códigos según dónde falla:

| Código | Significado | Acción |
|--------|-------------|--------|
| 401 | No autenticado | re-login |
| 403 | Rol insuficiente | el usuario necesita `operator`+ (revisar `user_profiles`) |
| 404 | Equipo no encontrado / otra organización | verificar device/tenant |
| 500 "Device secret not found" | equipo sin provisionar | provisionar (ver onboarding) |
| 502 "Failed to publish command" | EMQX no recibió el publish | **ver incidente EMQX abajo** |

Para ver la causa exacta del 502, revisar los **logs de la función** en Vercel
(el error real se loguea server-side con `console.error`).

## Incidente: EMQX suspendido / inalcanzable  ⚠️ (ocurrió en jun-2026)

**Síntomas:** comandos dan **502 "fetch failed"** en Vercel; no llega telemetría
nueva; el Ingestion Service muestra errores de reconexión a EMQX.

**Causa común:** el tier **Serverless free de EMQX se desactiva por inactividad**
o al agotar la cuota mensual. El DNS sigue resolviendo, pero el puerto 8883/8443
no acepta conexiones.

**Solución:**
1. Entrar a **EMQX Cloud** → deployment `wc68f227`.
2. Si está **Stopped/Suspended** → **reactivar/resume** (puede pedir método de pago).
3. Reintentar el comando → debe dar `sent`.

**Prevención (producción):** con un equipo real publicando, el tráfico mantiene
el broker activo; o subir de tier para evitar la suspensión.

## Incidente: Ingestion Service caído

**Síntomas:** el equipo está en línea (publica a EMQX) pero **no aparece
telemetría nueva en Supabase**.

**Solución:**
1. `railway logs --service sax-ingestion-service` para ver el error.
2. `railway up --service sax-ingestion-service` para redeployar.
3. EMQX persiste la sesión (QoS 1, `clean_session=False`): los mensajes
   encolados se procesan al reconectar — no se pierden.

## Incidente: equipo congelado por barrido de espectros ⚠️ (ocurrió 2026-07-02)

**Síntomas:** ~2 min después de arrancar el gateway por primera vez, el equipo
entero se congela (SSH muerto, MQTT muerto via LWT, software del equipo parado).

**Causa raíz:** en su primera ejecución, el spectra_uploader no tenía cursor
(`/var/lib/sax/last_spectra_id`) y hacía `SELECT *` de TODA la tabla `spectras`
histórica (meses de espectros de 8192 canales) con `fetchall()` → gigabytes en
RAM en una Raspberry Pi compartida con el software del equipo → OOM/thrash.

**Fix (aplicado):** (1) primera ejecución inicializa el cursor al MAX(id) actual
y NO publica el backlog histórico; (2) lecturas en lotes acotados (LIMIT 20);
(3) `MemoryMax=512M` + `Nice=10` en la unit de systemd — si el gateway vuelve a
excederse, systemd mata SOLO al gateway, nunca al equipo.

**Recuperación:** reiniciar el equipo (corte de energía si no responde) y
deshabilitar el gateway de inmediato (`systemctl disable --now
xrfonstream-edge-gateway`) hasta desplegar la versión corregida. El
congelamiento es solo de RAM: los datos y el software del equipo quedan intactos.

## Incidente: el dashboard no muestra datos para un usuario

**Causa probable:** el usuario no tiene `tenant_id`/`role` correctos en
`user_profiles` (RLS filtra por ahí desde la migración 00013).

```sql
SELECT user_id, role, tenant_id FROM public.user_profiles;
```
Corregir con la migración/seed o reasignando vía admin.

## Notas de seguridad operativa

- Secretos de Vercel: marcar como **"Sensitive"** (pendiente).
- Las llaves maestras (service_role, EMQX API) nunca van al equipo en planta.
- Los secretos por equipo viven en `private.device_secrets` (inaccesible por
  `anon`/`authenticated`; solo `service_role` vía RPC).
