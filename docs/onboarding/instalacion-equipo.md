# Instalación del Edge Gateway en el equipo (paso a paso)

Guía para instalar el Edge Gateway en un equipo XrfOnStream físico. El gateway es
un programa nuevo que corre **junto al** software del equipo: lee su base de datos
local y la publica a la nube. **No modifica nada existente** — si se apaga, el
equipo opera igual que antes.

> Asume un equipo Linux con systemd (típico en los PLC). Comandos con `sudo`.

---

## Antes de empezar — ten a mano

- El paquete **`XRF-1.tar.gz`** (generado en el lado plataforma).
- **Acceso al equipo**: SSH o teclado+pantalla, con permisos `sudo`.
- La **contraseña del PostgreSQL local** del equipo.
- La carpeta del gateway: `packages/edge-gateway` del repo `sax-XRFOnStream`.

---

## Paso 0 — Verificar prerrequisitos (en el equipo)

Conéctate al equipo y corre:

```bash
python3.11 --version    # debe ser 3.11.x
psql --version          # cliente de PostgreSQL disponible
systemctl --version     # el sistema usa systemd
nc -vz wc68f227.ala.us-east-1.emqxsl.com 8883   # salida a EMQX (debe conectar)
```

**Qué es esto:** confirmas que el equipo tiene lo necesario — Python 3.11 (para correr
el gateway), acceso a la base, systemd (para el servicio), y **salida a internet por
el puerto 8883** hacia el broker.

- Si **no hay Python 3.11**: hay que instalarlo (no uses una versión menor; el gateway
  lo requiere).
- Si **`nc` no conecta al 8883**: la red del sitio bloquea ese puerto de salida — pide
  a TI del sitio que lo abra (es salida, no requiere abrir puertos de entrada).

---

## Paso 1 — Copiar el código y el paquete al equipo

Desde tu máquina (ajusta `usuario@equipo`):

```bash
scp -r packages/edge-gateway usuario@equipo:/tmp/edge-gateway
scp provisioning/XRF-1.tar.gz usuario@equipo:/tmp/
```

En el equipo:

```bash
sudo mkdir -p /opt/sax
sudo mv /tmp/edge-gateway /opt/sax/edge-gateway
```

**Qué es esto:** el programa del gateway vivirá en `/opt/sax/edge-gateway`, que es
donde el servicio lo va a buscar.

---

## Paso 2 — Crear el usuario de sistema `sax` (si no existe)

```bash
id sax || sudo useradd --system --create-home --shell /usr/sbin/nologin sax
```

**Qué es esto:** el gateway corre como un usuario dedicado `sax` (no como root) por
seguridad. Si el equipo ya tiene ese usuario, el comando no hace nada.

---

## Paso 3 — Instalar el gateway (entorno aislado)

```bash
cd /opt/sax/edge-gateway
sudo python3.11 -m venv .venv
sudo .venv/bin/pip install .
sudo chown -R sax:sax /opt/sax/edge-gateway
```

**Qué es esto:** crea un "entorno virtual" (una instalación de Python **aislada**, para
no chocar con el Python del equipo) e instala ahí el gateway con sus dependencias.

---

## Paso 4 — Colocar la configuración y los secretos

```bash
mkdir -p /tmp/xrf1 && tar -xzf /tmp/XRF-1.tar.gz -C /tmp/xrf1
sudo mkdir -p /etc/sax/secrets
sudo cp /tmp/xrf1/provision.json /etc/sax/
sudo cp /tmp/xrf1/secrets/* /etc/sax/secrets/
```

Pon la **contraseña real** del PostgreSQL local:

```bash
sudo nano /etc/sax/secrets/db.password   # reemplaza CHANGE_ME... por la clave real
```

Protege los archivos (solo el usuario `sax` los lee):

```bash
sudo chown -R sax:sax /etc/sax
sudo chmod 600 /etc/sax/secrets/*
```

**Qué es esto:** dejas la configuración (`provision.json`) y las llaves (HMAC,
contraseña MQTT, contraseña de la base) donde el gateway las busca, y las proteges.

---

## Paso 4b — Verificar la conexión a la base local

```bash
sudo nano /etc/sax/provision.json
```

Revisa la sección **`local_db`** y confirma que coincida con el PostgreSQL real del
equipo:

```json
"local_db": {
    "host": "localhost",
    "port": 5432,
    "dbname": "xrfonstream",   ← nombre real de la base del equipo
    "user": "sax",             ← usuario real de la base
    "password_file": "/etc/sax/secrets/db.password"
}
```

**Qué es esto:** el gateway se conecta a la base del equipo para leer sus datos. Si la
base se llama distinto o usa otro usuario, ajústalo aquí. El usuario debe poder **leer**
las tablas `*_status`/`spectras`/`validations_sentinel` y **escribir** en `command` y
`*_action`.

---

## Paso 5 — Crear las 2 tablas nuevas del gateway

```bash
PGPASSWORD="$(sudo cat /etc/sax/secrets/db.password)" \
  psql -h localhost -U sax -d xrfonstream \
  -f /opt/sax/edge-gateway/sql/init_local_tables.sql
```

**Qué es esto:** crea **2 tablas nuevas** (`edge_gateway_buffer` para el buffer offline
y `edge_gateway_command_map` para mapear comandos). **No toca ninguna tabla existente
del equipo** — son aparte.

---

## Paso 6 — Instalar y arrancar el servicio

```bash
sudo cp /opt/sax/edge-gateway/xrfonstream-edge-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now xrfonstream-edge-gateway
```

**Qué es esto:** registra el gateway como un **servicio** del sistema — arranca solo al
prender el equipo y se reinicia si se cae. `enable --now` lo activa y lo arranca de una.

> Si PostgreSQL en el equipo **no** se llama `postgresql.service`, edita las líneas
> `After=`/`Requires=` del archivo `.service` para que apunten al nombre real (o
> quítalas si la base se gestiona aparte), antes de copiarlo.

---

## Paso 7 — Verificar que funciona

```bash
sudo journalctl -u sax-edge-gateway -f
```

Debes ver: conexión a EMQX exitosa, "Telemetry publisher started", y mensajes
publicándose cada 2 s.

Luego, en el **dashboard**:
- El device **XRF-1** pasa a **active / en línea** (`last_seen` reciente).
- **Status** muestra telemetría real, **Mediciones** los espectros, **Alertas** las del
  Sentinel.

**Qué es esto:** confirmas que los datos del equipo están llegando a la nube y se ven
en el dashboard. ✅ Integración lista.

---

## Paso 8 — Rollback (si algo sale mal)

```bash
sudo systemctl stop xrfonstream-edge-gateway
sudo systemctl disable xrfonstream-edge-gateway
```

**Qué es esto:** apaga el gateway. El equipo **vuelve a operar exactamente como antes**
— el gateway nunca modifica el software del equipo, solo lee su base. **Riesgo cero.**

---

## Si algo falla — diagnóstico rápido

| Síntoma (en `journalctl`) | Causa probable | Acción |
|---|---|---|
| No conecta a EMQX | Red bloquea 8883 / EMQX caído / credenciales | Verificar Paso 0, EMQX activo, secretos |
| Error de PostgreSQL | `local_db` mal / contraseña mala / permisos | Revisar Paso 4b + db.password |
| `bytes.fromhex` / firma inválida en comandos | hmac.key mal copiado | Re-copiar `secrets/hmac.key` del paquete |
| Arranca pero no hay datos en dashboard | Ingestion Service caído | Revisar Railway (runbook de operaciones) |
