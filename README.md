# Parte semanal de horas - Levitec

Aplicación interna para declarar, controlar y explotar las horas imputadas a proyecto.

El trabajador registra sus horas por día, proyecto y tarea. El encargado revisa y aprueba el parte de la semana. Dirección y administración obtienen horas, desviaciones e informes sin depender de hojas de cálculo.

- **Producción prevista:** https://horas.levitec.marianorluna.com (VPS propio con Coolify)
- **Escala objetivo:** ~20 proyectos, 500 trabajadores hoy, hasta 1.000 en cinco años

## Estado

MVP funcional implementado y verificado en local: autenticación con roles, rejilla semanal con autoguardado, bandeja de aprobación, dashboard, administración, exportaciones, auditoría y datos de demo cargables y purgables. El estado vigente de la sesión vive en [`AGENTS.md`](AGENTS.md) §4.

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
npm run db:seed               # datos mínimos para entrar
npm run dev                   # http://localhost:3000
```

### Datos de demostración

```bash
npm run db:seed:demo                  # 1 ADMIN, 6 ENCARGADO y 43 TRABAJADOR con 6 semanas de partes
npm run db:seed:demo -- --refresh     # purga y recarga las semanas relativas a hoy
npm run db:seed:demo:purge            # borra solo la empresa DEMO
```

- Todas las cuentas usan el dominio `@demo.local` y la contraseña `DEMO_PASSWORD` (`Demo1234!` por defecto).
- La empresa demo se identifica por `empresa.codigo = 'DEMO'`; la purga corre en una transacción y nunca toca otras empresas.
- Con `NODE_ENV=production`, las dos órdenes exigen `--yes` y muestran un resumen de lo que van a modificar o borrar.
- El seed nunca se ejecuta solo durante el despliegue.

### Verificaciones

```bash
npm run lint
npm run typecheck
npm run test
```

## Rutas principales

| Ruta | Rol | Qué hace |
|------|-----|----------|
| `/login` | público | Acceso con email y contraseña |
| `/mi-semana` | TRABAJADOR | Rejilla semanal, autoguardado, envío |
| `/control/partes` | ENCARGADO, ADMIN | Bandeja de aprobación y rechazo con motivo |
| `/control/dashboard` | ENCARGADO, ADMIN | Horas por proyecto, tendencia y pendientes |
| `/partes/[id]/imprimir` | según alcance | Vista imprimible con marca de agua según estado |
| `/admin/usuarios` | ADMIN | Alta, edición, activación y reseteo de contraseña |
| `/admin/proyectos` | ADMIN | Proyectos, tareas y asignaciones |
| `/admin/auditoria` | ADMIN | Registro append-only filtrable y paginado |
| `/admin/demo` | ADMIN | Herramientas de carga y purga del demo (solo fuera de producción) |
| `/api/health` | público | Sonda de salud con comprobación real de base de datos |

## Despliegue

`compose.yml` define el **stack completo**: la aplicación Next.js (imagen del `Dockerfile` multi-stage, `output: 'standalone'`, usuario no root, `TZ=Europe/Madrid`) y un PostgreSQL 16 con volumen persistente, comunicados por la red interna del stack. El `db` **no publica ningún puerto del host**: solo se llega a él por `db:5432` dentro de la red del stack. El puerto para `npm run dev` vive en `compose.override.yml`, que Compose fusiona automáticamente en local (`127.0.0.1:${DB_PORT:-5432}`) y que Coolify ignora porque arranca con `-f compose.yml`. Así el stack desplegado no choca con el Postgres del propio Coolify, que suele ocupar el 5432 del servidor.

Las migraciones se aplican **solas** al arrancar el contenedor (`docker/entrypoint.mjs` ejecuta el runner idempotente antes de `server.js`). Ya no existe un comando de pre-despliegue que recordar.

En Coolify basta con un único recurso **Docker Compose**:

1. Build pack `Docker Compose`, archivo `compose.yml`, rama `main`; Coolify construye el servicio `app` y crea el `db` con su volumen.
2. Variables del recurso: `POSTGRES_PASSWORD` (contraseña fuerte y sin caracteres que rompan una URL; `openssl rand -hex 24`), `AUTH_SECRET`, `APP_URL` y, si quieres que Coolify asigne el dominio, `SERVICE_FQDN_APP_3000`.
3. Dominio `https://horas.levitec.marianorluna.com` sobre el servicio `app`, puerto 3000; TLS lo gestiona el proxy de Coolify.
4. Backup diario del volumen `parte_diario_pgdata` a almacenamiento fuera del VPS.

Si el healthcheck `/api/health` no responde, Coolify no enruta tráfico y conserva la versión anterior. Detalle de la decisión en [ADR-006](docs/decisions.md).

## Reglas del proyecto

- Un cambio lógico por commit, en inglés: `feat(partes): add weekly timesheet grid`.
- El agente no commitea, no hace push y no despliega sin autorización explícita.
- Sin `any`. Tiempo y dinero en enteros (minutos y céntimos).
- Las reglas de negocio viven en `domain`; los componentes y handlers solo validan, autorizan y orquestan.
- Stack, dominio y estado se declaran **solo** en `AGENTS.md`; el resto de documentos enlazan.
