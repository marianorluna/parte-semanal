# LeviParte - Parte semanal de horas

Aplicación interna para declarar, controlar y explotar las horas imputadas a proyecto.

El trabajador registra sus horas por día, proyecto y tarea. El encargado revisa y aprueba el parte de la semana. Dirección y administración obtienen horas, desviaciones e informes sin depender de hojas de cálculo.

- **Producción prevista:** https://horas.levitec.marianorluna.com (VPS propio con Coolify)
- **Escala objetivo:** ~20 proyectos, 500 trabajadores hoy, hasta 1.000 en cinco años

## Estado

MVP funcional implementado y verificado en local: autenticación con roles, carga rápida de horas, rejilla semanal con autoguardado y doble confirmación, bandeja de aprobación, control del equipo, dashboard con riesgo de presupuesto, centro de avisos con cron, exportaciones CSV/XLSX/PDF, administración, auditoría y datos de demo cargables y purgables. La fase 2 añade calendario laboral con festivos, cómputo por convenio, ausencias, coste y presupuesto, informes en segundo plano, cierre semanal y mensual con estado bloqueado, avisos por email y API pública con webhooks firmados. El estado vigente de la sesión vive en [`AGENTS.md`](AGENTS.md) §4.

## Empezar aquí

| Documento | Para qué |
|-----------|----------|
| [`AGENTS.md`](AGENTS.md) | Stack, dominio y estado de sesión (fuente única) |
| [`docs/onboarding.md`](docs/onboarding.md) | Arranque local paso a paso |
| [`docs/architecture.md`](docs/architecture.md) | Módulos, capas, modelo de datos y despliegue |
| [`docs/decisions.md`](docs/decisions.md) | ADRs: por qué se decidió cada cosa |
| [`docs/dev-prompts.md`](docs/dev-prompts.md) | Prompts de implementación, fase a fase |
| [`docs/start.md`](docs/start.md) | Índice del boilerplate y mapa SSOT |

## Arranque rápido

Requisitos: Node 22 o superior, npm y Docker (para el Postgres local).

```bash
cp .env.example .env          # ajusta DATABASE_URL, AUTH_SECRET y APP_URL
docker compose up -d db       # Postgres 16 en localhost:5432
npm install
npm run db:migrate            # aplica las migraciones versionadas
npm run db:seed:demo          # datos de demostración (o crea tu empresa y admin)
npm run dev                   # http://localhost:3000
```

### Datos de demostración

```bash
npm run db:seed:demo                  # 50 empleados, 11 proyectos y 14 semanas de partes
npm run db:seed:demo -- --refresh     # purga y recarga las semanas relativas a hoy
npm run db:seed:demo:purge            # borra solo la empresa DEMO
```

- El demo cubre todas las pantallas y estados de la app: 1 ADMIN, 6 ENCARGADO y 43 TRABAJADOR; partes en los cinco estados; calendarios, convenios, ausencias, costes, presupuestos con los seis niveles de riesgo, cierres, informes, avisos, correo, claves API, webhooks y auditoría.
- Las tres cuentas destacadas del seed usan correos genéricos y nombres de fantasía: `administrador@levitec.es` (ADMIN, Leo Messi), `encargado@levitec.es` (ENCARGADO, Daniel Rabinovich) y `trabajador01@levitec.es` (TRABAJADOR, Juan Maldacena). El resto sigue el formato inicial + apellidos sobre `@levitec.es`. Todos comparten la contraseña `DEMO_PASSWORD` (`Demo1234!` por defecto).
- Con `ACCESO_RAPIDO_DEMO=true`, el login muestra tres botones que entran directamente con esas cuentas. La contraseña se resuelve en el servidor y nunca se envía al navegador. Es un recurso provisional de pruebas: sin la variable, los botones no se renderizan.
- La empresa demo se identifica por `empresa.codigo = 'DEMO'`; la purga corre en una transacción y nunca toca otras empresas.
- Con `NODE_ENV=production`, las dos órdenes exigen `--yes` y muestran un resumen de lo que van a modificar o borrar.
- El seed nunca se ejecuta solo durante el despliegue.
- Al terminar las pruebas, purga la demo antes de dar de alta usuarios reales: el formato de correo es el mismo y el email es único global.

### Verificaciones

```bash
npm run lint
npm run typecheck
npm run test
```

### Avisos programados

El endpoint `GET|POST /api/v1/cron/avisos` genera los avisos in-app de forma idempotente: repetir la llamada no duplica notificaciones gracias a las claves únicas `(usuario_id, clave_idempotencia)`. Requiere `CRON_SECRET` (sin él responde `503`) y se autentica con `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret`.

| Momento (Europe/Madrid) | Llamada | Qué genera |
|-------------------------|---------|------------|
| Viernes 09:00 | `/api/v1/cron/avisos?semana=actual&modo=recordatorios` | Recordatorio a quien no ha enviado el parte y resumen al encargado |
| Lunes 09:00 | `/api/v1/cron/avisos?semana=anterior&modo=recordatorios` | Recordatorio de cierre de la semana anterior |
| Diario 08:00 | `/api/v1/cron/avisos?modo=riesgos` | Aviso de riesgo de presupuesto a los encargados del proyecto |

Parámetros: `semana=actual|anterior`, `modo=recordatorios|riesgos|todo` y `dryRun=1` para previsualizar sin escribir. La respuesta JSON incluye el lote generado (usuario, email, título, cuerpo y URL) y se puede reenviar desde n8n por email o WhatsApp. En Coolify se configura como tarea programada del recurso; con n8n, un nodo HTTP con la cabecera `Authorization`.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://horas.levitec.marianorluna.com/api/v1/cron/avisos?semana=actual&dryRun=1"
```

El worker de `pg-boss` despacha el outbox de webhooks cada minuto. Para forzar una pasada o consultar la cola:

| Endpoint | Qué hace |
|----------|----------|
| `GET|POST /api/v1/cron/webhooks` | Despacha outbox y reintentos vencidos; devuelve el resumen |
| `GET /api/v1/cron/salud` | Responde `503` si hay 5 o más jobs fallidos en la cola |

### API pública v1

Requiere una clave creada en `/admin/api`. La clave completa (`lv_<prefijo>_<secreto>`) se muestra una sola vez; en base de datos solo queda un HMAC. Cada clave tiene alcances (`partes:leer`, `proyectos:leer`, `imputaciones:escribir`), caducidad opcional y un límite de 60 peticiones por minuto.

| Endpoint | Alcance | Descripción |
|----------|---------|-------------|
| `GET /api/v1/partes` | `partes:leer` | Partes filtrables por `isoYear`, `isoWeek`, `estado`, `empleadoId` y `limite` |
| `GET /api/v1/proyectos` | `proyectos:leer` | Proyectos de la empresa |
| `POST /api/v1/imputaciones` | `imputaciones:escribir` | Crea o actualiza una imputación; exige `Idempotency-Key` |
| `GET /api/v1/openapi.json` | público | Documento OpenAPI 3.0 generado desde Zod |

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://horas.levitec.marianorluna.com/api/v1/partes?isoYear=2026&isoWeek=43"
```

La respuesta sigue el formato `{ "success": true, "data": ... }` o `{ "success": false, "error": { "code", "message", "fieldErrors?" } }`. Una repetición con la misma `Idempotency-Key` devuelve la respuesta guardada con `Idempotency-Replayed: true`.

Los webhooks se firman con HMAC-SHA256 sobre `timestamp.cuerpo` y se envían con `X-Leviparte-Evento`, `X-Leviparte-Timestamp` y `X-Leviparte-Firma`. Los eventos son `parte.enviado`, `parte.aprobado`, `parte.rechazado` y `parte.reabierto`; se escriben en el outbox dentro de la misma transacción del cambio de estado y se reintentan con backoff exponencial hasta cinco veces.

## Rutas principales

| Ruta | Rol | Qué hace |
|------|-----|----------|
| `/login` | público | Acceso con email y contraseña |
| `/mi-semana` | TRABAJADOR | Panel rápido de carga, rejilla semanal, autoguardado y envío con doble confirmación |
| `/control/partes` | ENCARGADO, ADMIN | Bandeja de aprobación y rechazo con motivo; exportación CSV, XLSX y PDF |
| `/control/equipo` | ENCARGADO, ADMIN | Cumplimiento del equipo, aprobación en lote y recordatorios manuales |
| `/control/dashboard` | ENCARGADO, ADMIN | KPIs, alertas, riesgo de presupuesto, tendencia y exportación XLSX/PDF |
| `/control/proyectos` | ENCARGADO, ADMIN | Consumo, proyección y semáforo de riesgo por proyecto |
| `/notificaciones` | autenticado | Centro de avisos con marcado de leído |
| `/notificaciones/preferencias` | autenticado | Elección de avisos in-app y por correo |
| `/mis-ausencias` | TRABAJADOR | Solicitud y seguimiento de vacaciones y ausencias |
| `/control/ausencias` | ENCARGADO, ADMIN | Aprobación de ausencias del equipo |
| `/partes/[id]/imprimir` | según alcance | Vista imprimible con marca de agua según estado |
| `/partes/[id]/pdf` | según alcance | Descarga del parte en PDF generado en servidor |
| `/admin/usuarios` | ADMIN | Alta, edición, activación y reseteo de contraseña |
| `/admin/proyectos` | ADMIN | Proyectos, tareas y asignaciones |
| `/admin/calendario` | ADMIN | Calendarios, festivos, excepciones e importación CSV |
| `/admin/convenios` | ADMIN | Convenios y reglas de cómputo versionadas |
| `/admin/costes` | ADMIN | Tarifas de coste y presupuestos de proyecto |
| `/admin/informes` | ADMIN | Informes en segundo plano con descarga firmada |
| `/admin/cierres` | ADMIN | Cierre semanal y mensual, y reapertura auditada |
| `/admin/ausencias` | ADMIN | Tipos de ausencia y saldos |
| `/admin/emails` | ADMIN | Estado de entrega de los correos de aviso |
| `/admin/api` | ADMIN | Claves de API, webhooks y estado de entregas |
| `/admin/auditoria` | ADMIN | Registro append-only filtrable y paginado |
| `/admin/demo` | ADMIN | Herramientas de carga y purga del demo (solo fuera de producción) |
| `/api/health` | público | Sonda de salud con base de datos y cola |

## Despliegue

`compose.yml` define el **stack completo**: la aplicación Next.js (imagen del `Dockerfile` multi-stage, `output: 'standalone'`, usuario no root, `TZ=Europe/Madrid`) y un PostgreSQL 16 con volumen persistente, comunicados por la red interna del stack. El `db` **no publica ningún puerto del host**: solo se llega a él por `db:5432` dentro de la red del stack. El puerto para `npm run dev` vive en `compose.override.yml`, que Compose fusiona automáticamente en local (`127.0.0.1:${DB_PORT:-5432}`) y que Coolify ignora porque arranca con `-f compose.yml`. Así el stack desplegado no choca con el Postgres del propio Coolify, que suele ocupar el 5432 del servidor.

Las migraciones se aplican **solas** al arrancar el contenedor (`docker/entrypoint.mjs` ejecuta el runner idempotente antes de `server.js`). Ya no existe un comando de pre-despliegue que recordar.

En Coolify basta con un único recurso **Docker Compose**:

1. Build pack `Docker Compose`, archivo `compose.yml`, rama `main`; Coolify construye el servicio `app` y crea el `db` con su volumen.
2. Variables del recurso: `POSTGRES_PASSWORD` (contraseña fuerte y sin caracteres que rompan una URL; `openssl rand -hex 24`), `AUTH_SECRET`, `APP_URL`, `CRON_SECRET` y, si quieres que Coolify asigne el dominio, `SERVICE_FQDN_APP_3000`. Opcionales: `SMTP_URL` y `SMTP_FROM` para los avisos por correo; sin ellas los envíos quedan en estado `SIN_PROVEEDOR` sin afectar al resto de la app.
3. Dominio `https://horas.levitec.marianorluna.com` sobre el servicio `app`, puerto 3000; TLS lo gestiona el proxy de Coolify.
4. Backup diario del volumen `parte_diario_pgdata` a almacenamiento fuera del VPS.

Si el healthcheck `/api/health` no responde, Coolify no enruta tráfico y conserva la versión anterior. Detalle de la decisión en [ADR-006](docs/decisions.md).

## Reglas del proyecto

- Un cambio lógico por commit, en inglés: `feat(partes): add weekly timesheet grid`.
- El agente no commitea, no hace push y no despliega sin autorización explícita.
- Sin `any`. Tiempo y dinero en enteros (minutos y céntimos).
- Las reglas de negocio viven en `domain`; los componentes y handlers solo validan, autorizan y orquestan.
- Stack, dominio y estado se declaran **solo** en `AGENTS.md`; el resto de documentos enlazan.

## Licencia

Distribuido bajo licencia [MIT](LICENSE): puedes usar, copiar, modificar y redistribuir el código, también comercialmente, conservando el aviso de copyright. El repositorio público es <https://github.com/marianorluna/parte-semanal> y el login del MVP enlaza directamente a él.
