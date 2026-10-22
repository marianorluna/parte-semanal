# Decisiones arquitectónicas (ADR)

Registro de las decisiones técnicas relevantes del proyecto. Una entrada por decisión, en orden cronológico. No borres entradas antiguas: el historial de *por qué* es tan valioso como el *qué*.

**Cuándo añadir un ADR:** al elegir un patrón, librería, estrategia de auth, estructura de BD, contrato de API o cualquier decisión que afecte a más de un módulo o a toda la app. Su escritura debe respetar el alcance autorizado según el [protocolo de cierre](../AGENTS.md#protocolo-de-cierre-de-sesión); una revisión de solo lectura puede recomendarlo sin crear una entrada.

**Relación con otros docs:**

- Stack y producto → [`AGENTS.md`](../AGENTS.md) (no repetir aquí salvo que la decisión *cambie* el stack).
- Capas / carpetas / flujos → [`architecture.md`](./architecture.md).
- Al aceptar un ADR que cierre un ítem de “Decisiones abiertas” en `architecture.md`: marca el checkbox allí (`[x] → ADR-NNN`).

---

## Plantilla

```
### ADR-NNN — [Título corto de la decisión]

- **Fecha:** YYYY-MM-DD
- **Estado:** Propuesta | Aceptada | Obsoleta | Reemplazada por ADR-NNN
- **Contexto:** Qué problema o restricción motivó la decisión.
- **Opciones consideradas:**
  1. Opción A — pros / contras
  2. Opción B — pros / contras
- **Decisión:** Qué se eligió y por qué.
- **Consecuencias:** Qué cambia, qué deuda introduce, qué facilita.
```

---

## Registro

### ADR-001 — Monolito modular con un solo despliegue

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** ~20 proyectos y 500 trabajadores hoy (1.000 a cinco años), con una única constructora usuaria. El equipo es pequeño y el MVP debe estar operativo en un día. A la vez, se quiere integrar con nómina, ERP y BI sin rehacer la app.
- **Opciones consideradas:**
  1. Microservicios (auth, partes, reporting) — escala y despliegue independiente, pero multiplica infraestructura, transacciones distribuidas y coste operativo para un volumen que una sola base de datos resuelve sin esfuerzo.
  2. Monolito por capas técnicas (`controllers/`, `services/`, `models/`) — arranque rápido, pero los límites se diluyen y el acoplamiento crece con cada feature.
  3. Monolito modular con puertos y adaptadores por módulo — un despliegue, transacciones locales, límites explícitos y posibilidad de extraer un módulo si hiciera falta.
- **Decisión:** Opción 3. Módulos `identidad`, `organizacion`, `partes`, `reporting` y `auditoria`, cada uno con `domain` / `application` / `infrastructure` y una API pública (`index.ts`).
- **Consecuencias:** Un solo contenedor y una sola base de datos, con transacciones simples. Exige disciplina: nadie importa repositorios de otro módulo ni tablas ajenas. Extraer `reporting` a un servicio o mover los jobs a otro proceso queda como opción barata si el volumen lo pide.

### ADR-002 — Stack: Next.js App Router + Postgres + Drizzle

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Se necesita autenticación, UI de dos perfiles, base de datos relacional y despliegue en un VPS con Coolify, sin mantener un backend separado por ahora.
- **Opciones consideradas:**
  1. Next.js full-stack (App Router, Server Actions, RSC) — un despliegue, un lenguaje, menos glue code; riesgo de mezclar lógica de negocio en componentes.
  2. NestJS + React separados — separación clara de capas y DI nativa, a cambio de dos despliegues, contrato HTTP propio y más tiempo de arranque.
  3. Remix/SvelteKit — buenos en formularios, ecosistema menor para lo que viene después (ExcelJS, PDF, jobs).
  4. Postgres + Prisma vs Drizzle — Prisma maduro y con mejor DX de migraciones; Drizzle es SQL-first, más ligero y sin motor binario, lo que simplifica la imagen Docker.
- **Decisión:** Next.js App Router con TypeScript estricto, Tailwind, Postgres 16 y Drizzle (+ `drizzle-kit`), Auth.js con Credentials y hash argon2id, Zod en fronteras, Vitest para dominio.
- **Consecuencias:** El riesgo de la opción 1 se mitiga con las capas de `architecture.md` y con revisión: los componentes no contienen reglas. `drizzle-kit` obliga a escribir SQL consciente y a versionar migraciones. Todo el backend es un contenedor Node 22, desplegable en Coolify sin servicios extra.

### ADR-003 — Granularidad diaria por tarea, en minutos enteros

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** El usuario pide un parte semanal, pero la nómina es mensual y las semanas cruzan meses. Además hay que poder corregir un día sin rehacer la semana y, más adelante, emitir un registro de jornada defendible.
- **Opciones consideradas:**
  1. Totales por semana y proyecto — mínimo esfuerzo de captura, pero impide repartir por mes, corregir un día y auditar. Retrofit muy caro.
  2. Filas por `(empleado, fecha, tarea)` con minutos enteros, presentadas como rejilla semanal — misma UX de captura y todo lo anterior resuelto.
  3. Event sourcing desde el fichaje — máximo detalle e historial, complejidad desproporcionada para el MVP.
- **Decisión:** Opción 2. El hecho atómico es `imputacion(parte_id, fecha, tarea_id, minutos)`. La semana ISO es la unidad de presentación y aprobación, no de almacenamiento.
- **Consecuencias:** ~7 filas por tarea y semana; los dashboards necesitan agregación (se resuelve con índices y, en fase 2, con agregados al aprobar). Se preserva la capacidad de calcular nómina mensual, coste por proyecto y registro legal futuro. Redondeo en minutos, con formato decimal solo en presentación: cambiarlo a mitad de ejercicio obligaría a recalcular histórico.

### ADR-004 — Mono-inquilino con `empresa_id` reservado

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Una sola constructora usa la app, pero en el futuro podría entrar una subcontrata con acceso limitado a sus propios trabajadores y obras.
- **Opciones consideradas:**
  1. Multi-inquilino real con `tenant_id` y Row Level Security — aislamiento fuerte, coste alto de diseño y pruebas desde el día uno.
  2. Mono-inquilino con `empresa_id` en las tablas de negocio — aislamiento por autorización en la aplicación; barato hoy y migrable.
  3. Base de datos por empresa — aislamiento máximo, operación duplicada sin necesidad.
- **Decisión:** Opción 2. Tabla `empresa` con una fila activa; `empresa_id` presente en proyecto, empleado y parte. Sin RLS por ahora.
- **Consecuencias:** Menos complejidad y consultas directas. Si se abre el portal de subcontratas, habrá que añadir RLS y revisar todas las consultas: el `empresa_id` ya presente evita una migración de datos traumática.

### ADR-005 — Aprobación de un nivel

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Hay que controlar la imputación sin burocratizar. En obra, dos niveles de aprobación suelen derivar en partes sin revisar.
- **Opciones consideradas:**
  1. Un nivel: trabajador envía → encargado/jefe de obra aprueba o rechaza con motivo.
  2. Dos niveles (encargado → jefe de obra / administración) — más control, más fricción y más estados.
  3. Sin aprobación, solo notificación — rápido, pero sin control real del dato.
- **Decisión:** Opción 1, con reapertura auditada de un parte aprobado.
- **Consecuencias:** Menos estados y adopción más rápida. La auditoría y el motivo de rechazo compensan la falta de segunda firma. Añadir un nivel después es viable: nuevo estado `REVISADO` entre `ENVIADO` y `APROBADO`, sin tocar `imputacion`.

### ADR-006 — Despliegue en VPS con Coolify y Postgres autogestionado

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** El MVP debe publicarse ya en `https://horas.levitec.marianorluna.com`, con coste bajo y sin operar un backend separado. Existe un VPS con Coolify y un repositorio en GitHub.
- **Opciones consideradas:**
  1. Vercel + Neon/Supabase — cero operación, pero dos proveedores, latencia de BD y coste creciente con conexiones.
  2. VPS + Coolify con Postgres en contenedor en el mismo servidor — un solo sitio, coste mínimo, control total; el backup y las actualizaciones son responsabilidad nuestra.
  3. VPS + Coolify con Postgres gestionado externo — mejor durabilidad, pero un proveedor y coste adicionales para un MVP.
- **Decisión:** Opción 2. App Next.js en contenedor con `Dockerfile` multi-stage, Postgres 16 como servicio de Coolify en la misma red interna (puerto no publicado), TLS de Coolify y backups programados a almacenamiento externo.
- **Consecuencias:** Un único punto de fallo y mantenimiento propio (parches de Postgres, disco, backups verificados). El modelo es portable: cambiar a una BD gestionada es cambiar `DATABASE_URL`, y el `Dockerfile` funciona en cualquier host con Docker. Con 2 vCPU / 4 GB hay margen holgado para 1.000 trabajadores; el escalado vertical es la primera palanca antes de plantear servicios separados.

### ADR-007 — Cola de trabajos en Postgres con pg-boss

- **Fecha:** 2026-10-22
- **Estado:** Propuesta (se adopta en la fase 2)
- **Contexto:** Informes en segundo plano, exportaciones grandes, recordatorios de envío y webhooks necesitan ejecución asíncrona con reintentos. Añadir Redis implica otro servicio que operar en el mismo VPS.
- **Opciones consideradas:**
  1. `pg-boss` — reutiliza Postgres, transaccional con los datos, sin servicio extra; rendimiento suficiente para decenas de jobs por minuto.
  2. BullMQ + Redis — mayor throughput y ecosistema, a cambio de un contenedor y persistencia adicionales.
  3. Cron de Coolify + tabla de jobs propia — mínimo, pero sin reintentos, visibilidad ni bloqueo por job.
- **Decisión propuesta:** `pg-boss` sobre la misma base de datos, con una interfaz `JobQueue` en `application` para poder cambiar de implementación sin tocar el dominio.
- **Consecuencias:** Una dependencia menos y jobs en la misma transacción que el cambio de estado. La cola compite por recursos con la BD: si el volumen de informes crece, se separa en su propio Postgres o se migra a BullMQ detrás del mismo puerto.

---
