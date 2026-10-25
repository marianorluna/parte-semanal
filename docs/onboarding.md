# Onboarding - entorno local

Guía para levantar LeviParte desde cero, cargar el demo y verificar el flujo completo antes de tocar código.

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto y dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)
- **Arquitectura:** [`architecture.md`](./architecture.md)
- **Operación y despliegue:** [`operations.md`](./operations.md)

## 1. Requisitos

- Node 22 o superior (`node -v`).
- npm 10 o superior.
- Docker con `docker compose`.
- `openssl` para generar secretos.
- Acceso al repositorio en GitHub.

Opcional para probar integraciones y correo: una cuenta SMTP y una clave de un proveedor compatible con la API de chat de OpenAI.

## 2. Clonar e instalar

```bash
git clone https://github.com/marianorluna/parte-semanal.git
cd parte-semanal
npm install
```

## 3. Variables de entorno

```bash
cp .env.example .env
```

Mínimo para arrancar:

```dotenv
DATABASE_URL=postgresql://parte_diario:parte_diario@localhost:5432/parte_diario
APP_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>
TZ=Europe/Madrid
DEMO_PASSWORD=Demo1234!
```

`AUTH_SECRET` es obligatorio y debe tener al menos 32 caracteres. Nunca reutilices el de producción ni subas `.env` al repositorio.

### Variables opcionales

| Variable | Efecto | Sin definir |
|----------|--------|-------------|
| `CRON_SECRET` | Autoriza `/api/v1/cron/avisos`, `/cron/webhooks` y `/cron/salud` | Los endpoints responden 503 |
| `SMTP_URL` | Envía correos por SMTP | Los envíos quedan en `SIN_PROVEEDOR`; la app funciona |
| `SMTP_FROM` | Remitente visible | `no-reply@levitec.es` |
| `IA_API_KEY` | Activa el asistente | Las herramientas aparecen como no configuradas |
| `IA_BASE_URL` | URL del proveedor compatible | `https://api.deepseek.com` |
| `IA_MODELO` | Modelo a usar | Sin asistente |
| `IA_TIMEOUT_MS` | Espera máxima (1.000 a 60.000) | 20.000 |
| `IA_MAX_TOKENS` | Tope de salida (100 a 2.000) | 700 |
| `IA_PSEUDONIMIZAR` | Reduce los nombres a inicial y apellido | `true` |
| `INFORMES_WORKER` | Con `off`, no arranca el worker de `pg-boss` en este proceso | El worker arranca |
| `ACCESO_RAPIDO_DEMO` | Muestra tres botones de acceso demo en el login | Ocultos |

Las claves de API y los secretos de webhook no se configuran por entorno: se crean desde Administración > API y se guardan con hash en la base de datos.

## 4. Base de datos

`compose.yml` contiene el stack completo, pero en local solo necesitas el servicio `db`, porque la app corre con `npm run dev`. El puerto del host lo aporta `compose.override.yml`, que Compose carga solo cuando no se pasa `-f`.

```bash
docker compose up -d db
docker compose ps          # el healthcheck debe estar en healthy
npm run db:migrate         # aplica las migraciones de src/db/migrations
```

| Comando | Uso |
|---------|-----|
| `npm run db:generate` | Genera una migración tras cambiar el esquema |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:studio` | Abre Drizzle Studio |
| `npm run db:seed:demo` | Carga el demo completo |
| `npm run db:seed:demo -- --refresh` | Purga y recarga el demo relativo a la semana actual |
| `npm run db:seed:demo:purge` | Borra solo la empresa `DEMO` |

El demo crea la empresa `DEMO`, 50 empleados, 12 proyectos (10 de obra activos, uno inactivo y el proyecto de ajuste), sus tareas, asignaciones, calendario, convenios, tarifas, presupuestos y 14 semanas ISO con todos los estados de parte. El proyecto de ajuste se llama "Ajuste de jornada" y tiene las tareas `AJ1` Horas no imputables y `AJ2` Exceso de jornada; está asignado a los encargados para que puedan revisar los partes que lo usan. Es idempotente y determinista: dos ejecuciones seguidas no duplican filas.

### Probar la imagen de producción sin Coolify

```bash
docker compose up --build -d   # app + db con el mismo compose del despliegue
docker compose ps              # ambos servicios en healthy
docker compose logs -f app     # migraciones del entrypoint y arranque de Next
```

La app queda accesible por la red interna (`app:3000`), no en un puerto del host: es el proxy de Coolify el que la publica en producción. Este comando fusiona `compose.override.yml`, así que el `db` sí expone `127.0.0.1:5432` para tu cliente SQL. Para emular el stack exacto de producción usa `docker compose -f compose.yml up --build -d`.

## 5. Arrancar

```bash
npm run dev
```

La app queda en `http://localhost:3000`. `GET /api/health` responde con el estado de base de datos, cola y jobs fallidos.

### Cuentas del demo

| Rol | Nombre | Email | Contraseña |
|-----|--------|-------|------------|
| ADMIN | Leo Messi | `administrador@levitec.es` | `Demo1234!` o `DEMO_PASSWORD` |
| ENCARGADO | Daniel Rabinovich | `encargado@levitec.es` | igual |
| TRABAJADOR | Juan Maldacena | `trabajador01@levitec.es` | igual |

El resto usa el patrón corporativo (inicial del nombre y apellidos sobre `@levitec.es`). Con `ACCESO_RAPIDO_DEMO=true`, el login muestra tres botones; la contraseña se resuelve en el servidor y no viaja al navegador. Quita la variable al terminar las pruebas.

> El email de usuario es único global. Si cargas el demo en producción, sus direcciones pueden chocar con el alta de personas reales. Purga el demo antes de dar de alta personal.

## 6. Verificar el entorno

```bash
npm run lint
npm run typecheck
npm test
```

Checklist manual:

- [ ] `/api/health` devuelve 200 con `database: ok`.
- [ ] Un trabajador entra en `/mi-semana`, ve festivos y ausencias, y el autoguardado confirma.
- [ ] El panel rápido añade horas en tramos de 30 minutos y deshacer revierte el último cambio.
- [ ] La copia de la semana anterior no sobrescribe celdas ocupadas ni días no laborables.
- [ ] Un día con más de 24 horas no se guarda; con más de 12 avisa.
- [ ] Enviar una semana pasada con desviación exige un motivo de 10 a 500 caracteres.
- [ ] El encargado ve partes enviados en `/control/partes` y no ve los de otros encargados ni los de administradores.
- [ ] Aprobar, rechazar y reabrir cambian el estado y dejan rastro en `/admin/auditoria`.
- [ ] `/control/dashboard` muestra KPIs, briefing, semáforo y la ayuda de colores.
- [ ] Un cierre semanal bloquea la escritura y un parte bloqueado solo se libera reabriendo el periodo.
- [ ] Las exportaciones CSV, XLSX y PDF descargan con los filtros aplicados.
- [ ] `npm run db:seed:demo` dos veces no duplica filas.
- [ ] `npm run db:seed:demo:purge` deja la base sin filas `DEMO` y conserva otras empresas.

## 7. Probar avisos, correo e IA

### Avisos

Con `CRON_SECRET` definido:

```bash
# Previsualiza sin escribir
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/v1/cron/avisos?semana=actual&dryRun=1"

# Genera recordatorios; repetirlo no duplica avisos ni correos
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/v1/cron/avisos?semana=actual&modo=recordatorios"
```

Comprueba en `/notificaciones` que aparecen una sola vez. Sin `CRON_SECRET`, el endpoint responde 503.

### Correo

Con `SMTP_URL` configurada, el envío sale por la cola de `pg-boss`. Revisa el estado en `/admin/emails`:

- `ENVIADO`: entregado al proveedor.
- `SIN_PROVEEDOR`: falta `SMTP_URL`; no se reintenta.
- `FALLIDO`: error real; se puede reintentar desde la pantalla.

### IA

Con `IA_API_KEY` e `IA_MODELO` definidos, abre `/control/dashboard` y pulsa el briefing; después abre un parte enviado y usa el borrador de motivo de rechazo. Sin configuración, ambas herramientas deben indicar que no están disponibles sin romper la página.

### API v1

```bash
curl -H "Authorization: Bearer lv_xxx_yyy" \
  "http://localhost:3000/api/v1/partes?isoYear=2026&isoWeek=38"
```

El contrato completo está en [`api.md`](./api.md) y el esquema OpenAPI en `/api/v1/openapi.json`.

## 8. Backup y restauración

El backup debe salir del VPS. Un dump dentro del mismo volumen no protege de la pérdida del servidor.

```bash
docker compose exec -T db pg_dump -U parte_diario -Fc parte_diario > parte-diario-$(date +%F).dump
```

Restauración en un entorno limpio, nunca encima de producción:

```bash
docker compose exec -T db createdb -U parte_diario parte_diario_restaurada
cat parte-diario-2026-10-24.dump | docker compose exec -T db pg_restore -U parte_diario \
  -d parte_diario_restaurada --clean --if-exists
```

Comprobación:

- [ ] `npm run db:migrate` termina con las migraciones al día.
- [ ] `/api/health` responde 200 con `database: ok`.
- [ ] Un usuario puede iniciar sesión y ver sus partes de la última semana.
- [ ] El número de filas de `parte` e `imputacion` coincide con el origen.
- [ ] El backup programado apunta fuera del VPS y se ha restaurado al menos una vez.

Procedimiento completo en [`operations.md`](./operations.md#5-backups-y-restauracion).

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Cannot find module` | Dependencias no instaladas | `npm install` |
| Error de conexión a base de datos | `.env` mal configurado o contenedor parado | Revisa `DATABASE_URL` y `docker compose up -d db` |
| `AUTH_SECRET` ausente o corto | Falta la variable o tiene menos de 32 caracteres | `openssl rand -base64 32` |
| Deploy en `Success` pero el dominio da 503 y el contenedor reinicia | El entrypoint aborta al arrancar, normalmente por `AUTH_SECRET` corto o `POSTGRES_PASSWORD` con `+`, `/` o `@` | Mira las Runtime Logs del contenedor `app` y corrige la variable |
| Puerto 3000 o 5432 ocupado | Otro proceso usa el puerto | Para ese proceso o cambia el puerto |
| El demo no aparece en el dashboard | Semanas antiguas cargadas | `npm run db:seed:demo -- --refresh` |
| El correo queda en `SIN_PROVEEDOR` | Falta `SMTP_URL` | Configúrala y reintenta desde `/admin/emails` |
| La IA responde 503 `NO_CONFIGURADO` | Falta `IA_API_KEY` o `IA_MODELO` | Configura ambas y reinicia |
| La IA responde 429 | Límite de 20 por minuto o 1 por segundo | Espera y reintenta |
| Aviso de hidratación en consola | Una extensión modifica el DOM antes de hidratar | Ver abajo |

### Aviso de hidratación en la consola

React avisa cuando el HTML del servidor y el del cliente no coinciden. En desarrollo, el mensaje incluye un diff con los atributos que sobran. Antes de tocar código, comprueba si esos atributos son nuestros:

1. Busca los nombres marcados en el diff: `rg "nombre_del_atributo" src`. Si no aparecen, los inyecta una extensión antes de que React hidrate.
2. Los sospechosos habituales son `bis_skin_checked` y `bis_register` (Bitdefender) y `__processed_<uuid>__` (otras extensiones de seguridad).
3. Confirma con una ventana de incógnito o desactivando la extensión para `localhost`.

Solo es un aviso de desarrollo: en producción no se muestra. No añadas `suppressHydrationWarning` en `<body>` para silenciarlo, porque también ocultaría desajustes reales. Si el diff no cuadra con ninguna extensión, revisa fechas y números formateados en cliente, ramas con `typeof window` y HTML mal anidado.

## 10. Siguientes pasos

| Tema | Documento |
|------|-----------|
| Funcional: roles, flujos y pantallas | [`product.md`](./product.md) |
| Capas, módulos y modelo de datos | [`architecture.md`](./architecture.md) |
| API v1 y webhooks | [`api.md`](./api.md) |
| Despliegue, backups y runbook | [`operations.md`](./operations.md) |
| Decisiones y porqués | [`decisions.md`](./decisions.md) |
| Stack, dominio y estado | [`AGENTS.md`](../AGENTS.md) |
