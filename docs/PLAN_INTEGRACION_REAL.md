# Plan de Integración con Equipo Real

Guía para conectar un equipo XrfOnStream físico a la plataforma. Pensada como
material de la reunión con SAX y como runbook del día de integración.

---

## 1. Objetivo

Que un equipo real ejecute el **Edge Gateway**, publique sus datos a la nube y
reciba comandos — quedando visible y operable desde el dashboard.

```
Equipo (Edge Gateway) → EMQX → Ingestion (Railway) → Supabase → Dashboard
       ▲                                                            │
       └──────────── comando firmado (HMAC) ◄───── Route Handler ◄──┘
```

## 2. Estado actual (qué ya está listo)

- ✅ Pipeline cloud (EMQX + Ingestion + Supabase) desplegado y validado.
- ✅ Dashboard completo (Status, Mediciones, Alertas, Operario, Servicio).
- ✅ Auth + roles seguros (`user_profiles`).
- ✅ Provisión: crear equipo genera su secreto; `generate-provision-package.sh`
  arma el paquete + registra el usuario MQTT en EMQX.
- ✅ Edge Gateway implementado (publishers + receptor de comandos + validador de
  7 capas + offline buffer) con Dockerfile/systemd/tests.
- ✅ Esquema de telemetría alineado al equipo real (nombres de columnas `*_status`).

---

## 3. Preparación del lado plataforma (lo hacemos/verificamos nosotros)

| # | Tarea | Cómo verificar |
|---|-------|----------------|
| P1 | **EMQX activo** (se suspendió una vez por inactividad) | EMQX Cloud dashboard → deployment `wc68f227` en estado *Running* |
| P2 | **Backend authn/authz de EMQX = built-in database** | EMQX dashboard → Access Control. (El provision script lo asume; si es otro, ajustar) |
| P3 | **Ingestion Service corriendo** | `railway logs --service sax-ingestion-service` (conectado a EMQX) |
| P4 | **Migraciones aplicadas** (00001–00015) | esquema cloud al día (verificado incremental) |
| P5 | **Crear el equipo real** en `/admin` | queda con `provisioned_at` (secreto generado) |
| P6 | **Generar el paquete de provisión** | `./scripts/generate-provision-package.sh <SERIAL>` → tarball + usuario EMQX |
| P7 | **Dry-run del pipeline** (sin equipo) | `python demo_live.py` con EMQX arriba → ver telemetría real-shaped en el dashboard |
| P8 | **Alinear comandos UI al catálogo real** | ver §5 (requiere spec de SAX) |

> **Dry-run (P7):** `demo_live.py` simula un equipo publicando por MQTT a EMQX con
> el esquema real. Valida EMQX→Ingestion→Supabase→Dashboard **sin el equipo
> físico**. Útil para confirmar que el pipeline está sano antes de viajar/coordinar.

---

## 4. Lo que se hace EN EL EQUIPO (para explicar a SAX)

El Edge Gateway es un programa nuevo que se instala **junto al** software original
del equipo. **No modifica nada existente**: solo lee las tablas del equipo y crea
2 tablas nuevas propias.

### 4.1 Requisitos del equipo

| Requisito | Detalle |
|-----------|---------|
| **Acceso** | SSH (preferible) o físico, para instalar el gateway |
| **Red** | Salida a internet **TCP 8883** (MQTT/TLS) hacia EMQX. No requiere abrir puertos entrantes |
| **PostgreSQL local** | El gateway se conecta a `localhost:5432` — necesita usuario/clave de la BD del equipo (solo lectura de las tablas de estado + escritura en `command`) |
| **Python 3.11** | Para correr el gateway (en un venv aislado) |

### 4.2 Tablas que el gateway LEE del equipo (deben existir y coincidir)

- `generator_status`, `vacuum_status`, `circulation_status`, `interchanger_status`,
  `detector_status`, `temp_control_status`, `auxiliary_status` (telemetría).
- `spectras` (espectros), `validations_sentinel` (alertas Sentinel),
  `*_action` (estado de tareas), `command` (cola de comandos).

> Los nombres de columnas de los `*_status` ya están confirmados (screenshot del
> equipo). Falta **confirmar `spectras`, `validations_sentinel` y `command`/`*_action`**.

### 4.3 Tablas que el gateway CREA (nuevas, no interfieren)

`edge_gateway_buffer` (buffer offline) y `edge_gateway_command_map` (mapea el
command_id de la nube con el índice local). Se crean con `sql/init_local_tables.sql`.

### 4.4 Instalación (resumen)

1. Copiar el paquete de provisión → `/etc/sax/provision.json` + `/etc/sax/secrets/*`
   (poner la clave real del PostgreSQL local en `db.password`).
2. Crear venv e instalar el gateway en `/opt/sax/edge-gateway`.
3. Correr `init_local_tables.sql` en la BD local.
4. Instalar y habilitar el servicio systemd (`xrfonstream-edge-gateway.service`).
5. `journalctl -u sax-edge-gateway -f` → debe conectar y publicar.

### 4.5 Ejecución de comandos (cómo el equipo recibe órdenes)

Cuando llega un comando válido (firmado, en whitelist, en rango, sin veto del
Sentinel), el gateway lo **inserta en la tabla `command`** del equipo y marca
`{module}_action.status_task='command_received'`. El **CommandDaemon original** del
equipo lo ejecuta — es el mismo protocolo que ya usa el equipo. El resultado se
reporta de vuelta a la nube.

---

## 5. Catálogo de comandos REAL (y el gap a resolver con SAX)

El validador del Edge Gateway solo acepta estos comandos (`COMMAND_WHITELIST`):

| Módulo | Comandos permitidos |
|--------|---------------------|
| generator | `set_hv_state`, `set_voltage_and_current`, `power` |
| vacuum | `set_atmospheric_condition`, `pump_control`, `valve_control` |
| circulation | `pump_control`, `valve_control` |
| interchanger | `cam_interchange`, `lock_control` |
| detector | `set_detector`, `set_gain`, `set_threshold` |
| temp_control | `set_target_temperature`, `valve_control` |
| auxiliary | `battery_test` |

Con rangos validados (ej. `set_voltage_and_current`: voltaje 0–50 kV, corriente
0–200 µA; `set_target_temperature`: 15–35 °C).

> ⚠️ **Gap clave:** los botones actuales de la pantalla Operario
> (`start_measurement`, `emergency_stop`, `initialize`, `pause`, `recalibrate`)
> **NO están en este whitelist** — son placeholders. Hay que definir con SAX el
> **mapeo "acción de operario → comando(s) real(es) del equipo"** y cómo se lanza
> una **medición** (no hay un `start_measurement` de bajo nivel; podría ser una
> secuencia o un mecanismo aparte). Esto es el **Bloque 7** (spec de operario/
> servicio) y bloquea el envío de comandos *reales* hasta acordarlo.

---

## 6. Agenda de la reunión con SAX (decisiones/preguntas)

1. **Infraestructura 24/7 (costo) — DECISIÓN CLAVE:** el piloto necesita planes de
   pago en **EMQX** y **Railway** (ambos en free tier se cayeron por límites/
   inactividad). Railway puso el Ingestion en modo "serverless", que **no sirve**
   para un suscriptor MQTT persistente (se duerme y deja de recibir). Para el
   equipo real ambos deben estar **always-on (de pago)** — del orden de ~$20–40/mes
   en total. ¿Quién lo cubre? Sin esto, el flujo de datos reales no se sostiene.
2. **Acceso al equipo:** ¿SSH remoto o presencial? ¿Credenciales del PostgreSQL local?
3. **Esquema del equipo:** confirmar `spectras`, `validations_sentinel`,
   `command`/`*_action` (los `*_status` ya están).
4. **Spec de comandos (Bloque 7):** el mapeo acción-operario → comando real, args
   (¿`arg1..arg5` posicionales o nombrados?), y cómo se lanza una medición.
5. **DEP-01 (concentraciones):** ¿el equipo calcula concentraciones? ¿en qué tabla/
   formato? (si no, esa parte de Mediciones queda vacía).
6. **DEP-02 (inicialización):** ¿el equipo acepta "inicializar" como comando en la
   tabla `command`, o es un script aparte?
7. **Red del sitio:** ¿permite salida TCP 8883?
8. **Quién instala:** ¿técnico de SAX + nosotros en remoto?

---

## 7. Runbook del día de integración (secuencia)

1. **Pre (plataforma):** EMQX activo (P1), Ingestion arriba (P3), equipo creado +
   provisionado (P5), paquete generado (P6).
2. **Red:** confirmar salida 8883 desde el equipo (`nc -vz <broker> 8883`).
3. **Instalar** el gateway + correr `init_local_tables.sql` + habilitar el servicio.
4. **Arrancar** y verificar en logs: conecta a EMQX, publica telemetría.
5. **Dashboard:** la pantalla Status del equipo muestra datos reales + `last_seen`.
6. **Comando de prueba:** enviar un comando del whitelist (ya mapeado) → verificar
   `sent → ack → completed` y que el equipo lo ejecutó.
7. **Verificar** espectros + Sentinel + equipment_state fluyendo.
8. **Rollback** (si algo falla): `systemctl stop` el gateway → el equipo vuelve a
   operar exactamente como antes (el gateway no toca su software).

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| EMQX suspendido | Verificar/reactivar antes (P1); mantener tráfico o subir tier |
| Backend EMQX distinto al asumido | Confirmar en dashboard (P2) y ajustar el provision script |
| Schema del equipo difiere | Confirmar tablas (§4.2) antes de instalar |
| Comandos no mapeados | No enviar comandos reales hasta cerrar el Bloque 7 (§5) |
| Red del sitio bloquea 8883 | Confirmar con TI del sitio antes |
| Sin acceso al equipo | Solicitar SSH remoto a SAX con anticipación |
