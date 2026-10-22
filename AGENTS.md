# AGENTS.md

Documento vivo del **qué** y el **quién**. Las leyes técnicas (cómo / no) viven en `.cursor/rules/`.

> **Template versión:** 1.2.0

### Fuente canónica (SSOT)

Este archivo es la **única fuente** de stack (§2), contexto de negocio (§3) y estado de sesión (§4). El resto de docs solo enlazan aquí.

---

## 1. Rol y misión

Eres un arquitecto de software senior y experto en Clean Code. Ayudas a construir y mantener este proyecto con código limpio, escalable y seguro. Analizas antes de codear, anticipas edge cases y respetas las reglas en `.cursor/rules/`.

---

## 2. Stack del proyecto

Las versiones exactas de dependencias viven en manifiestos y lockfiles; aquí se resume la elección tecnológica.

- **Frontend:** Next.js (App Router) + TypeScript estricto + Tailwind CSS. Server Components por defecto; estado de cliente mínimo (sesión y UI local).
- **Data fetching:** Server Components y Server Actions; Zod en cada frontera (HTTP, formularios, entorno). Sin capa de fetching adicional mientras no exista cliente móvil.
- **Backend:** monolito modular dentro de Next.js (runtime Node). API REST `/api/v1` solo cuando exista integración externa (fase 2).
- **Base de datos / ORM:** PostgreSQL 16 + Drizzle ORM + `drizzle-kit` (migraciones versionadas en el repo).
- **Autenticación:** Auth.js (Credentials) con hash argon2id y sesión en cookie httpOnly. Sin autenticación propia.
- **Cola de trabajos:** `pg-boss` sobre la misma base de datos (fase 2). Sin Redis.
- **Lenguaje:** TypeScript estricto (`strict`, `noUncheckedIndexedAccess`). Prohibido `any`.
- **Testing:** Vitest (dominio y casos de uso) / Playwright (e2e, fase 2).
- **Despliegue:** repositorio GitHub → Coolify en VPS propio (`Dockerfile` multi-stage, Node 22). Postgres 16 como servicio de Coolify en el mismo VPS. Dominio `https://horas.levitec.marianorluna.com` con TLS gestionado por Coolify. Backups programados fuera del VPS.

---

## 3. Contexto de negocio

- **Producto:** parte semanal de horas con imputación a proyecto para Levitec (constructora). El trabajador declara horas por día, proyecto y tarea; el encargado las revisa y aprueba por semana. Sustituye hojas de cálculo y permite explotar horas y costes sin depender de un ERP.
- **Escala:** ~20 proyectos activos, ~500 trabajadores hoy y hasta ~1.000 en cinco años. Picos de uso los jueves y viernes.
- **Reglas de dominio clave:**
  - El hecho atómico es `(empleado, fecha, tarea) → minutos enteros`. Nunca se almacenan horas decimales.
  - La semana operativa es ISO (lunes a domingo). Existe como máximo un parte por empleado y semana ISO.
  - Estados del parte: `BORRADOR → ENVIADO → APROBADO | RECHAZADO`. `BLOQUEADO` llega con el cierre semanal y mensual (fase 2).
  - Un parte aprobado no se edita: se reabre con motivo y queda auditado.
  - `total_minutos` se calcula siempre en el servidor; el cliente no lo envía.
  - Un `ENCARGADO` solo ve y aprueba partes de los proyectos asignados; un `TRABAJADOR` solo los suyos.
  - Una imputación no puede ser 0, negativa ni superar 24 h/día. El aviso de exceso semanal se muestra, no bloquea.
- **Integraciones previstas:** exportación a nómina y contabilidad (CSV de A3/Sage o API), fichaje y control de accesos, ERP y BI. Siempre mediante adaptadores: el dominio no conoce formatos externos.
- **Deuda / limitaciones conocidas:**
  - Sin registro legal de jornada (art. 34.9 ET): el MVP registra imputación, no fichaje. Fase 3.
  - Sin motor de cómputo por convenio: en el MVP todas las horas computan igual.
  - Sin festivos, vacaciones ni ausencias: fase 2.
  - Sin coste hora ni presupuesto ejecutado: fase 2.
  - Sin multi-inquilino real: `empresa_id` reservado para subcontratas (ver ADR-004).

---

## 4. Estado actual

Resumen operativo para retomar el trabajo, no historial de sesiones.

- **Última sesión:** 2026-10-22 - SSOT especializados (stack, dominio, arquitectura y ADR-001 a ADR-007) y plan de prompts por fases en [`docs/dev-prompts.md`](docs/dev-prompts.md). Sin código de aplicación todavía.
- **Foco actual:** MVP del parte semanal, desplegado en Coolify. Ejecutar los prompts 1.1 a 1.10 de [`docs/dev-prompts.md`](docs/dev-prompts.md#6-fase-1---mvp-hoy-y-mañana).
- **Checklist:**
  - [x] Especializar `AGENTS.md` §2-§4
  - [x] Definir arquitectura modular y modelo de datos del MVP
  - [x] Registrar ADR-001 a ADR-007
  - [x] Redactar prompts por fases
  - [ ] Prompt 1.1 - scaffold, `Dockerfile` y Postgres local
  - [ ] Prompt 1.2 - despliegue temprano en Coolify con dominio y TLS
  - [ ] Prompt 1.3 - autenticación, roles y alcance
  - [ ] Prompt 1.4 - dominio, esquema y seed
  - [ ] Prompt 1.5 - API del parte
  - [ ] Prompt 1.6 - rejilla semanal del trabajador
  - [ ] Prompt 1.7 - bandeja y aprobación del encargado
  - [ ] Prompt 1.8 - dashboard
  - [ ] Prompt 1.9 - CSV e imprimible
  - [ ] Prompt 1.10 - auditoría, endurecimiento y go-live
  - [ ] Actualizar `README.md` y `docs/onboarding.md` con los comandos reales
- **Bloqueadores:** acceso a Coolify y al DNS de `marianorluna.com`, y permisos del repositorio en GitHub. Si el DNS no está listo, el MVP se valida con la URL temporal de Coolify y se cambia el dominio después.

### Protocolo de cierre de sesión

Actualiza esta sección solo cuando el usuario solicite cerrar la sesión o el mantenimiento del estado forme parte del alcance aprobado. No modifiques documentos como efecto lateral de consultas o revisiones de solo lectura. Registrar un ADR también debe estar dentro del alcance autorizado; en otro caso, propón el registro sin escribirlo.

1. **Última sesión** → fecha de hoy + resumen de lo hecho en una frase.
2. **Foco actual** → próxima tarea o PR pendiente.
3. **Checklist** → marca lo completado, añade lo que quedó abierto.
4. **Bloqueadores** → cualquier decisión pendiente o dependencia externa.
5. Si tomaste una decisión arquitectónica relevante → añade un ADR en `docs/decisions.md`.

---

## 5. Mapa de contexto

| Recurso | Dueño |
|---------|-------|
| `docs/start.md` | **Índice / empieza aquí** - qué tocar, SSOT, orden de especialización |
| **Este archivo** (`AGENTS.md`) | Stack (§2), producto/dominio (§3), estado de sesión (§4) |
| `.cursor/rules/` | Cómo programar y qué está prohibido |
| `docs/architecture.md` | Patrón, capas, carpetas, flujos client ↔ server |
| `docs/decisions.md` | ADRs - porqués ya tomados |
| `docs/dev-prompts.md` | Prompts de implementación por fases (MVP y siguientes) |
| `docs/onboarding.md` | Cómo arrancar el proyecto en local |
| `.env.example` | Nombres de variables de entorno (sin secretos) |

Si el agente pierde el hilo: menciona `@AGENTS.md` y/o `@docs/architecture.md` en el chat.
