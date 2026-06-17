# Onboarding — Provisionar un equipo XrfOnStream

Guía operativa para dar de alta un equipo nuevo y conectarlo a la plataforma, de
punta a punta: desde crearlo en el dashboard hasta que publica datos reales.

## Concepto

Cada equipo comparte un **secreto** con la nube:
- `hmac_secret` — firma/verifica los comandos (nube ↔ equipo).
- `mqtt_username` / `mqtt_password` — el equipo se autentica al broker EMQX.

Esos valores viven en `private.device_secrets` (Supabase) y se entregan al equipo
físico dentro de un **paquete de provisión** (`provision.json` + archivos de
secretos) que se instala junto al **Edge Gateway**.

> **Regla de seguridad:** las llaves maestras (service_role de Supabase, API de
> EMQX) viven solo en una **máquina administradora de confianza**, nunca en el
> equipo en planta. El equipo recibe únicamente sus propios secretos.

## Pasos

### 1. Crear el equipo (dashboard)

`/admin` → organización → **Crear equipo** (serial + etiqueta).

Al crearlo, la nube **genera y guarda** su `hmac_secret` + credenciales MQTT y lo
marca como **provisionado** (`provisioned_at`). Desde ya puede recibir comandos
desde el dashboard (aunque el equipo físico todavía no esté conectado).

### 2. Generar el paquete de provisión (máquina admin)

En una máquina con el repo y el `.env` (con `SUPABASE_SERVICE_ROLE_KEY` +
credenciales de EMQX), y con `jq` instalado:

```bash
./scripts/generate-provision-package.sh <SERIAL>     # p.ej. XRF-005
```

El script:
1. Resuelve el equipo (id + tenant) en Supabase.
2. Lee su secreto + credenciales MQTT (RPC `get_device_provisioning`).
3. **Registra el usuario + ACL MQTT en EMQX** (topics scoped al equipo).
4. Genera `provisioning/<SERIAL>.tar.gz` con `provision.json` + `secrets/`.

> Si tu EMQX no usa el backend *built-in database*, ajusta `EMQX_AUTHN_ID` y los
> endpoints en el script.

### 3. Instalar en el equipo físico

Copia el tarball al equipo (USB/SCP) y:

```
provision.json   →  /etc/sax/provision.json
secrets/hmac.key →  /etc/sax/secrets/hmac.key
secrets/mqtt.password → /etc/sax/secrets/mqtt.password
secrets/db.password   → /etc/sax/secrets/db.password   # poner la contraseña real
                                                        # del PostgreSQL local
```

Instala el Edge Gateway y su servicio:

```bash
# en /opt/sax/edge-gateway con un venv
python -m venv .venv && .venv/bin/pip install .
sudo cp xrfonstream-edge-gateway.service /etc/systemd/system/
sudo systemctl enable --now xrfonstream-edge-gateway
```

### 4. Verificar

- `journalctl -u sax-edge-gateway -f` → debe conectar a EMQX y empezar a publicar.
- En el dashboard, la pantalla **Status** del equipo debe mostrar telemetría real
  y `last_seen` reciente.
- Envía un comando de prueba desde **Operario** → debe avanzar a ACK/Completado.

## Notas

- El secreto se genera en el paso 1 (dashboard) y el script solo lo **lee** — así
  el secreto de la nube y el del equipo siempre coinciden.
- Para re-provisionar (rotar credenciales), el script es idempotente: vuelve a
  generar el paquete y actualiza el usuario en EMQX.
- El `hmac.key` se entrega **hex** (texto); el Edge Gateway lo decodifica a bytes.
