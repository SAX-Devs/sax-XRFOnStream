# Manual de Usuario — Plataforma SAX XrfOnStream

Plataforma web para monitorear y operar los analizadores XRF on-stream de SAX de
forma remota. Este manual cubre el uso del dashboard para los distintos roles.

---

## 1. Acceso

- **URL:** la dirección del dashboard (p. ej. el dominio de SAX en Vercel).
- **Login:** correo + contraseña. Si es tu primer ingreso, recibirás un correo de
  invitación con un enlace para **establecer tu contraseña** (pantalla
  "Aceptar invitación"). El enlace caduca; si expira, pide una nueva invitación
  al administrador.

## 2. Roles

Cada usuario tiene un rol que determina qué puede ver y hacer:

| Rol | Puede |
|-----|-------|
| **viewer** | Ver datos (Status, Mediciones, Alertas). Sin controles. |
| **operator** | Lo anterior + enviar comandos de operación (Operario). |
| **service** | Lo anterior + pantalla de Servicio (diagnóstico técnico, tags P&ID). |
| **tenant_admin** | Lo anterior + administrar su organización (equipos, usuarios). |
| **sax_admin** | Acceso total a todas las organizaciones (SAX). |

> El rol se asigna al invitarte y **no puede cambiarlo el propio usuario** — es
> seguro por diseño.

## 3. Lista de equipos

Al entrar verás la **lista de dispositivos** de tu organización, cada uno con un
indicador en línea/desconectado y su estado. Haz clic en un equipo para abrir sus
pestañas: **Status, Mediciones, Alertas, Operario, Servicio**.

## 4. Pantalla Status (diagrama del proceso)

Muestra el **diagrama del equipo (SCADA)** con el estado en vivo de cada
componente y un **panel de parámetros** a la derecha:

- **Válvulas** (verde = abierta, rojo = cerrada), **bomba**, **cámaras de análisis
  e interna**, **tubo de rayos-X**, **detector**, **intercambiador**.
- **Flujo animado** por las tuberías cuando hay circulación.
- **Interlocks de seguridad**: el tubo de rayos-X solo emite si la cámara está
  cerrada, la puerta de mantenimiento cerrada y el sensor de fuga seco.
- **Panel de parámetros**: modo de operación, estado de bomba, flujos (entrada/
  salida), atmósfera, vacío, temperaturas (gabinete/tubo), kV/µA del generador,
  posición del intercambiador, bloqueos de cámara/puerta, fuga, energía DC,
  presión de tanque.

Los datos se actualizan **en tiempo real**.

## 5. Pantalla Mediciones

Historial de mediciones XRF del equipo:

- **Lista** de corridas a la izquierda (selecciona una).
- **Espectro XRF** (cuentas vs canal MCA) con los picos de elementos.
- **Tabla de concentraciones** cuantificadas (Fe, Cu, Zn, etc.) en g/L.
- Metadata de la corrida: duración, livetime, triggers.

## 6. Pantalla Alertas

Lista de alertas del equipo con:

- **Filtros** por severidad (info/warning/critical/emergency) y por estado
  (activas/reconocidas).
- **Tarjetas resumen**: total, activas, críticas activas.
- Botón **"Reconocer"** en cada alerta activa — al reconocerla queda registrada
  con la fecha y persiste (se sincroniza en tiempo real entre usuarios).

## 7. Pantalla Operario *(rol operator o superior)*

Control de operación del equipo:

- **Estado del equipo** (badge grande): En reposo / Midiendo / Inicializando /
  Error / Desconectado.
- **Acciones**: Iniciar Medición (con confirmación), Parada de Emergencia,
  Inicializar, Pausar, Recalibrar. Al enviar un comando verás un mensaje de
  confirmación o error.
- **Historial de comandos**: los últimos comandos enviados con su estado
  (Enviado → ACK → Completado / Error), quién lo envió y cuándo.

> **Equipo no provisionado:** si el equipo aún no completó su provisión, los
> botones aparecen deshabilitados con un aviso. Hay que provisionarlo primero
> (ver guía de onboarding).

## 8. Pantalla Servicio *(rol service o superior)*

Igual que Status pero con **tags P&ID** visibles (ZS-001, PV-201, etc.) y tres
**tarjetas de diagnóstico**:

- **Generador Rx**: ramp time, corriente de filamento, temperatura SiC,
  interlock, sobretensión.
- **Detector**: longitud MCA, ganancia, ancho de bin, trim, temperatura.
- **Auxiliar**: voltaje de batería, falla de batería, DC OK, presión de tanque.

⚠️ Los controles afectan la operación en tiempo real — proceder con precaución.

## 9. Administración *(rol tenant_admin / sax_admin)*

En **/admin** se administran organizaciones (tenants), equipos y usuarios:

- **Crear organización** (solo sax_admin).
- **Crear equipo**: al crearlo queda **provisionado** automáticamente (genera su
  secreto + credenciales). Falta solo instalar el paquete en el equipo físico
  (ver guía de onboarding).
- **Invitar usuario**: por correo, asignándole rol y organización.

---

## Preguntas frecuentes

**No veo ningún dato / equipo.** Verifica que tu usuario tenga la organización
correcta asignada (contacta al administrador).

**Un comando dice "Equipo no provisionado".** El equipo aún no tiene su secreto
instalado. Completa la provisión (guía de onboarding).

**Una medición dice "Espectro almacenado en Storage".** El espectro es grande y
está en almacenamiento; la carga diferida es una mejora pendiente.

**El estado de un comando se queda en "Enviado".** El comando se publicó pero el
equipo aún no lo confirmó (puede no estar conectado). Cuando el equipo lo procese,
el estado avanzará a ACK/Completado.
