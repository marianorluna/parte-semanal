# Architecture

Mapa técnico del proyecto. El estilo de código y las prohibiciones están en `.cursor/rules/`.

## Stack y producto

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto / dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)

## Patrón

- **Arquitectura:** monolito modular con puertos y adaptadores por módulo. Un solo despliegue (contenedor Next.js) y una sola base de datos.
- **Principio rector:** Separation of Concerns - el dominio no conoce Next.js, Drizzle ni HTTP. Ver [`ADR-001`](./decisions.md#adr-001---monolito-modular-con-un-solo-despliegue) y [`ADR-002`](./decisions.md#adr-002---stack-nextjs-app-router--postgres--drizzle).
- **Regla de dependencia:** `app → application → domain`; `infrastructure` implementa los puertos que declara `application`. El dominio no importa de `app/`, `db/` ni `next/*`.
- **Límite entre módulos:** un módulo solo puede usar la API pública de otro (`modules/<modulo>/index.ts`). Nada de importar repositorios o tablas ajenas.

## Estructura de carpetas

```
parte-diario/
├── src/
│   ├── app/                              # rutas Next: transporte y composición
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx                # shell con sesión y navegación por rol
│   │   │   ├── mi-semana/page.tsx        # rejilla del trabajador
│   │   │   ├── control/
│   │   │   │   ├── partes/page.tsx       # bandeja del encargado
│   │   │   │   ├── partes/[id]/page.tsx  # detalle y aprobación
│   │   │   │   └── dashboard/page.tsx
│   │   │   └── partes/[id]/imprimir/page.tsx
│   │   ├── (admin)/admin/
│   │   │   ├── usuarios/page.tsx
│   │   │   └── auditoria/page.tsx
│   │   ├── api/health/route.ts           # healthcheck de Coolify
│   │   └── layout.tsx
│   ├── modules/
│   │   ├── identidad/                    # usuarios, roles, sesión, alcance
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── index.ts
│   │   ├── organizacion/                 # empresas, empleados, proyectos, tareas, asignaciones
│   │   ├── partes/                       # parte semanal, imputaciones, estados
│   │   ├── reporting/                    # consultas agregadas y exportaciones
│   │   └── auditoria/                    # traza de cambios
│   ├── db/
│   │   ├── schema/                       # tablas Drizzle por módulo
│   │   ├── migrations/                   # migraciones versionadas en repo
│   │   ├── seed.ts
│   │   └── client.ts
│   ├── shared/
│   │   ├── errors.ts                     # AppError, códigos y mapeo HTTP
│   │   ├── result.ts
│   │   ├── date/                         # ISO week, horas <-> minutos
│   │   └── validation/
│   └── config/env.ts                     # validación Zod de variables de entorno
├── Dockerfile                            # multi-stage, salida standalone
├── compose.yml                           # Postgres de desarrollo local
├── drizzle.config.ts
├── docs/
└── AGENTS.md
```

No crees carpetas vacías: cada módulo nace con su primer caso de uso real.

## Módulos y responsabilidad

| Módulo | Responsabilidad | No hace |
|--------|-----------------|---------|
| `identidad` | Usuario, rol, sesión, políticas de alcance (propio, por proyecto, global) | Reglas de partes ni de negocio |
| `organizacion` | Empresas, empleados, proyectos, tareas, asignaciones | Registrar horas |
| `partes` | Parte semanal, imputaciones, totales, máquina de estados | Consultas de dashboard |
| `reporting` | Agregados de horas, bandejas, CSV, vistas imprimibles | Escribir datos de negocio |
| `auditoria` | Registro append-only de cambios y accesos | Decidir permisos |

## Capas

| Capa | Contenido | Reglas |
|------|-----------|--------|
| `domain` | Entidades y funciones puras (`isoWeekOf`, `weekDaysOf`, `horasAMinutos`, `validarParte`) | Sin I/O, sin ORM, sin `Date.now()` implícito: recibe fecha y reglas por parámetro |
| `application` | Casos de uso, transacciones, puertos (repositorios, reloj, generador de ids) | Orquesta; no valida HTTP ni formatea respuestas |
| `infrastructure` | Repositorios Drizzle, mapeadores, adaptadores externos | No contiene reglas de negocio |
| `app` | Server Components, Server Actions, route handlers | Valida con Zod, autoriza, invoca el caso de uso y mapea errores. Sin reglas de negocio |

## Flujo client ↔ server

1. **Lectura:** página RSC → `requireUser()` / `requireAlcance()` → caso de uso de consulta → repositorio → DTO de presentación. Sin `useEffect` para datos iniciales.
2. **Escritura:** formulario cliente → Server Action → Zod → autorización → caso de uso (transacción) → auditoría → `revalidatePath`. La acción devuelve `Result`, nunca lanza errores de negocio al cliente.
3. **Autorización:** siempre en servidor. La UI oculta lo que no corresponde, pero no es la defensa. Cada consulta que recibe un id comprueba el alcance, no solo el rol (evitar IDOR).
4. **Concurrencia:** `version` en `parte`; `UPDATE ... WHERE id = ? AND version = ?`; en conflicto, `CONFLICTO_VERSION`.

## Identidad visual

La paleta sale del logotipo (`public/logo-levitec-sum.webp`) y vive como tokens en `src/app/globals.css`:

| Token | Uso | Base |
|-------|-----|------|
| `marca-*` | Cabecera, botones primarios, enlaces, foco, cabeceras de tabla | Petróleo `#015151` |
| `acento-*` | Éxito, aprobado, marca demo, realces del día actual | Menta `#009878` |

Las utilidades `.campo`, `.boton-primario`, `.tarjeta` y `.etiqueta` ya consumen esos tokens: una vista nueva no necesita colores propios. No se usa la paleta `sky` ni `blue` de Tailwind; ámbar y rojo quedan reservados para aviso y error.

## Contrato de errores

```json
{ "success": false, "error": { "code": "ESTADO_INVALIDO", "message": "El parte ya está aprobado.", "fieldErrors": { "minutos": "Debe ser mayor que 0" } } }
```

| Código | HTTP | Uso |
|--------|------|-----|
| `NO_AUTENTICADO` | 401 | Sin sesión válida |
| `SIN_PERMISO` | 403 | Rol o alcance insuficiente |
| `NO_ENCONTRADO` | 404 | Recurso inexistente o fuera de alcance |
| `VALIDACION` | 422 | Zod falla; incluye `fieldErrors` |
| `ESTADO_INVALIDO` | 409 | Transición no permitida |
| `CONFLICTO_VERSION` | 409 | Edición concurrente |
| `ERROR_INTERNO` | 500 | Fallo no esperado; log interno con id de correlación, sin trazas al cliente |

Los mensajes son públicos y seguros; los diagnósticos van al log del servidor sin datos personales ni secretos.

## Modelo de datos (MVP)

```
empresa 1─n proyecto 1─n tarea
empleado 1─n asignacion n─1 tarea
empleado 1─n parte 1─n imputacion n─1 tarea
empleado 1─n usuario (opcional: trabajador con acceso)
usuario 1─n auditoria
```

| Tabla | Campos clave | Restricciones |
|-------|--------------|---------------|
| `empresa` | `id`, `nombre`, `cif`, `activa` | Una sola fila en el MVP; `empresa_id` en el resto de tablas |
| `usuario` | `email` (único, minúsculas), `password_hash`, `nombre`, `rol`, `empleado_id`, `activo` | `rol ∈ {TRABAJADOR, ENCARGADO, ADMIN}` |
| `usuario_proyecto` | `usuario_id`, `proyecto_id` | PK compuesta; define el alcance del ENCARGADO |
| `empleado` | `codigo` (único), `nombre`, `categoria`, `activo` | Baja lógica, nunca borrado |
| `proyecto` | `codigo` (único), `nombre`, `horas_presupuesto`, `activo` | `horas_presupuesto` nullable |
| `tarea` | `proyecto_id`, `codigo`, `nombre`, `horas_presupuesto`, `activa` | `UNIQUE(proyecto_id, codigo)` |
| `asignacion` | `empleado_id`, `tarea_id`, `desde`, `hasta`, `activa` | `CHECK(desde <= hasta)` |
| `parte` | `empleado_id`, `iso_year`, `iso_week`, `week_start`, `estado`, `total_minutos`, `version`, `enviado_at`, `revisado_por`, `revisado_at`, `motivo_rechazo` | `UNIQUE(empleado_id, iso_year, iso_week)`; `estado ∈ {BORRADOR, ENVIADO, APROBADO, RECHAZADO}` |
| `imputacion` | `parte_id`, `fecha`, `tarea_id`, `minutos`, `nota` | `UNIQUE(parte_id, fecha, tarea_id)`; `CHECK(minutos > 0 AND minutos <= 1440)` |
| `auditoria` | `actor_id`, `entidad`, `entidad_id`, `accion`, `antes`, `despues`, `motivo`, `created_at` | Append-only; sin `UPDATE` ni `DELETE` |

Reglas transversales:

- Minutos enteros (`integer`). Las horas decimales solo existen en presentación.
- `fecha` como `date` (sin zona). `created_at`/`enviado_at` como `timestamptz`. Contenedor y Postgres con `TZ=Europe/Madrid`.
- Índices: `parte(estado, iso_year, iso_week)`, `imputacion(parte_id)`, `imputacion(tarea_id, fecha)`.
- Las restricciones se declaran **también** en base de datos, no solo en Zod.

## Despliegue

Topología en un único VPS:

```
Internet
  │  DNS A  horas.levitec.marianorluna.com → IP del VPS
  ▼
Traefik (Coolify) ── TLS Let's Encrypt
  ▼
contenedor app (Next.js standalone, Node 22)
  │  red interna de Coolify (Postgres no publicado)
  ▼
contenedor postgres:16 ── volumen persistente
  │
  └─ backup programado → almacenamiento externo (S3 / Backblaze B2)
```

Pipeline: `push` a `main` → webhook → build del `Dockerfile` → comando de pre-despliegue `npm run db:migrate` → healthcheck `GET /api/health` → tráfico. Si el healthcheck falla, Coolify mantiene la versión anterior.

Reglas de despliegue:

- Migraciones **aditivas y compatibles hacia atrás** (expand/contract). Un rollback de imagen no revierte la base de datos.
- Variables de entorno en Coolify, nunca en el repo. No hay `NEXT_PUBLIC_*` con datos sensibles; hoy no se necesita ninguna.
- Un solo proceso con `output: 'standalone'`. Sin Redis: los jobs usan Postgres (`pg-boss`, ver [`ADR-007`](./decisions.md#adr-007---cola-de-trabajos-en-postgres-con-pg-boss)).
- Backups fuera del VPS: un backup en el mismo disco no sobrevive a la pérdida del servidor. Restauración probada antes del go-live.

## Entornos

| Entorno | App | Base de datos | Datos |
|---------|-----|---------------|-------|
| Local | `npm run dev` | `compose.yml`, Postgres 16 | Seed de desarrollo |
| Producción | Coolify, dominio propio | Servicio Postgres de Coolify | Datos reales de obra |

No hay staging todavía; se crea en la fase 2 con datos anonimizados.

## Decisiones abiertas

- [ ] Registro legal de jornada (fichaje): fase 3. Afecta al modelo si se decide unificar con imputación.
- [ ] Multi-inquilino real y RLS para subcontratas: pendiente de si se abre portal externo.
- [ ] Generación de PDF en servidor (Gotenberg vs `@react-pdf`): se decide en fase 2.
- [ ] SSO con Microsoft Entra ID: depende de la gestión de identidades de la empresa.
- [ ] Proveedor de email transaccional: fase 2.

Decisiones ya tomadas → [`decisions.md`](./decisions.md).
