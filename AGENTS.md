# AGENTS.md

Documento vivo del **qué** y el **quién**. Las leyes técnicas (cómo / no) viven en `.cursor/rules/`.

### Fuente canónica (SSOT)

Este archivo es la **única fuente** de stack (§2), contexto de negocio (§3) y estado de sesión (§4). El resto de documentos solo enlazan aquí.

---

## 1. Rol y misión

Eres un arquitecto de software senior y experto en Clean Code. Ayudas a construir, mantener y entregar LeviParte, el parte semanal de horas de Levitec, con código limpio, escalable y seguro. Analizas antes de codear, anticipas edge cases y respetas las reglas en `.cursor/rules/`.

---

## 2. Stack del proyecto

Las versiones exactas viven en `package.json` y `package-lock.json`; aquí se resume la elección tecnológica.

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript estricto + Tailwind CSS 4. Server Components por defecto; estado de cliente mínimo (sesión, UI local y autoguardado).
- **Data fetching:** Server Components y Server Actions; Zod en cada frontera (HTTP, formularios, parámetros de ruta y entorno). Sin capa de fetching adicional mientras no exista cliente móvil.
- **Backend:** monolito modular dentro de Next.js con runtime Node, organizado en puertos y adaptadores. La API REST `/api/v1` existe para integración externa.
- **Base de datos / ORM:** PostgreSQL 16 + Drizzle ORM + `drizzle-kit`. 36 tablas y migraciones versionadas en `src/db/migrations/`. Concurrencia optimista por columna `version`.
- **Autenticación:** Auth.js 5 (Credentials) con hash argon2id y sesión JWT en cookie httpOnly. El usuario se relee de base de datos en cada petición para reflejar rol, alcance y baja.
- **Autorización:** roles `ADMIN`, `ENCARGADO` y `TRABAJADOR`, con alcance adicional por proyecto y por empleado. Se comprueba en los casos de uso, nunca solo en la interfaz.
- **Cola de trabajos:** `pg-boss` sobre la misma base de datos, en proceso único arrancado desde `instrumentation.ts`. Sin Redis.
- **Lenguaje:** TypeScript estricto (`strict`, `noUncheckedIndexedAccess`). Prohibido `any`.
- **Testing:** Vitest para dominio y casos de uso. Playwright pendiente de aprobación para el flujo crítico.
- **Documentos:** `exceljs` (XLSX) y `@react-pdf/renderer` (PDF).
- **Correo:** Nodemailer por SMTP. Sin `SMTP_URL`, el envío queda en `SIN_PROVEEDOR` y no se considera fallo.
- **IA:** cliente compatible con la API de chat de OpenAI. Por defecto DeepSeek; configurable con `IA_BASE_URL`, `IA_API_KEY` y `IA_MODELO`. De solo lectura y con degradación limpia.
- **Despliegue:** repositorio GitHub → Coolify en VPS propio. Un único recurso Docker Compose (`compose.yml`) levanta la app (imagen del `Dockerfile` multi-stage, Node 22) y PostgreSQL 16 con volumen persistente; las migraciones se aplican en el entrypoint del contenedor. Dominio `https://horas.levitec.marianorluna.com` con TLS gestionado por Coolify. Backups programados fuera del VPS.

---

## 3. Contexto de negocio

- **Producto:** parte semanal de horas con imputación a proyecto para Levitec (constructora). El trabajador declara minutos por día, proyecto y tarea; el encargado las revisa y aprueba por semana. Sustituye hojas de cálculo y permite explotar horas y costes sin depender de un ERP.
- **Escala:** ~20 proyectos activos, ~500 trabajadores hoy y hasta ~1.000 en cinco años. Picos de uso los jueves y viernes.
- **Reglas de dominio clave:**
  - El hecho atómico es `(empleado, fecha, tarea) -> minutos enteros`. Nunca se almacenan horas decimales ni importes en coma flotante.
  - La semana operativa es ISO (lunes a domingo). Existe como máximo un parte por empleado y semana ISO.
  - Estados del parte: `BORRADOR -> ENVIADO -> APROBADO | RECHAZADO`. `BLOQUEADO` llega con el cierre semanal o mensual.
  - Un parte aprobado no se edita: se reabre con motivo y queda auditado. Un parte bloqueado solo se libera reabriendo el periodo.
  - `total_minutos` se calcula siempre en el servidor; el cliente no lo envía.
  - Un `ENCARGADO` solo ve y aprueba partes de usuarios `TRABAJADOR` de los proyectos asignados. No revisa a otros encargados ni a administradores, y tampoco sus propias horas. Un `ADMIN` revisa cualquiera.
  - Una imputación no puede ser 0, negativa ni superar 24 h/día. El aviso de exceso diario (12 h) o semanal (48 h) se muestra, no bloquea.
  - El envío de una semana ya terminada con desviación respecto a la capacidad exige un motivo de 10 a 500 caracteres. Se congela en el parte con la capacidad y la desviación (ADR-020).
  - El proyecto de ajuste (`es_ajuste`) absorbe horas no imputables. Es único por empresa, no tiene presupuesto y se excluye del semáforo de riesgo, pero suma en horas y coste totales.
  - El cómputo y el coste se calculan al aprobar y se persisten; al reabrir se borran y se recalculan al volver a aprobar.
  - Los cierres bloquean escritura y revisión de las fechas cubiertas, no solo el botón de enviar.
- **Integraciones previstas:** exportación a nómina y contabilidad (CSV de A3/Sage o API), ERP y BI mediante adaptadores; la API v1 y los webhooks ya cubren lectura de partes y escritura de imputaciones. El fichaje y el registro legal de jornada viven en Bizneo (ADR-019).
- **Deuda / limitaciones conocidas:**
  - Sin registro legal de jornada (art. 34.9 ET): el MVP registra imputación, no fichaje.
  - Sin motor de cómputo por convenio con hora de inicio y fin: no hay hora nocturna ni pluses que dependan de la franja.
  - Sin sincronización automática de ausencias con Bizneo: se registran en LeviParte como dato operativo.
  - Sin coste hora real de nómina: el coste usa tarifa configurada por empleado o categoría.
  - Sin multi-inquilino real: `empresa_id` reservado para subcontratas (ADR-004).
  - Sin Playwright: el flujo crítico solo está cubierto por tests de dominio y casos de uso.

---

## 4. Estado actual

Resumen operativo para retomar el trabajo, no historial de sesiones.

- **Última sesión:** 2026-10-25 - documentación alineada con el producto en producción: nuevo `docs/product.md`, `docs/api.md` y `docs/operations.md`, `README.md` reescrito y ADR al día.
- **Foco actual:** validar la migración `0011` y los flujos de fase 2 en staging; después, smoke test en producción. Playwright queda pendiente de aprobación de la dependencia.
- **Tamaño real del sistema:** 15 módulos, 36 tablas, 12 migraciones (`0000` a `0011`), 32 archivos de test y 30 páginas.
- **Checklist:**
  - [x] Especializar `AGENTS.md` §2-§4
  - [x] Definir arquitectura modular y modelo de datos del MVP
  - [x] Registrar ADR-001 a ADR-021
  - [x] Scaffold Next.js, `Dockerfile` y PostgreSQL local
  - [x] Autenticación con argon2id, roles y alcance por proyecto
  - [x] Dominio, esquema Drizzle, migraciones y casos de uso con concurrencia por `version`
  - [x] Seed demo idempotente de 50 usuarios con purga transaccional
  - [x] Rejilla `/mi-semana` con autoguardado, totales y envío
  - [x] Bandeja `/control/partes` con aprobación y rechazo con motivo
  - [x] Dashboard con horas por proyecto, tendencia y top 5
  - [x] CRUD de usuarios, proyectos, tareas y asignaciones
  - [x] CSV con BOM y vista imprimible con marca de agua
  - [x] Auditoría append-only y pantalla de consulta
  - [x] Endurecimiento: cabeceras, cookies y errores sin trazas
  - [x] `README.md`, `docs/onboarding.md` y ADR-008 del seed demo
  - [x] Despliegue en Coolify con dominio, TLS y migraciones automáticas en el arranque
  - [x] Fase 2.1: calendario laboral, festivos, excepciones y jornada teórica
  - [x] Fase 2.2: motor de cómputo versionado
  - [x] Fase 2.3: ausencias, vacaciones y bajas
  - [x] Fase 2.4: coste hora y presupuesto
  - [x] Fase 2.5: informes en segundo plano con `pg-boss`
  - [x] Fase 2.6: cierre semanal y mensual con reapertura auditada
  - [x] Fase 2.7: correo transaccional y preferencias de aviso
  - [x] Fase 2.8: API pública y webhooks
  - [x] Fase 2.9: CI, staging documentado, health ampliado y alerta de jobs fallidos
  - [x] Modo rápido y detalle, presets, copia de semana anterior y deshacer en la rejilla
  - [x] Desviación firmada y proyecto de ajuste (ADR-020)
  - [x] Asistente de IA de solo lectura con pseudonimización y auditoría de tokens (ADR-021)
  - [x] Leyenda de colores del dashboard y menú de usuario
  - [x] Documentación de producto, API y operaciones
  - [ ] Smoke test completo en producción y restauración de un backup verificada
  - [ ] Playwright para el flujo crítico (dependencia pendiente de aprobación)
- **Bloqueadores:** restaurar un backup en local o staging para validar la recuperación; aprobación de `@playwright/test`; un `SMTP_URL` real para probar el envío de correos en producción; y revisión del DPA del proveedor de IA antes de usar datos reales.

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
| **Este archivo** (`AGENTS.md`) | Stack (§2), producto/dominio (§3), estado de sesión (§4) |
| `.cursor/rules/` | Cómo programar y qué está prohibido |
| `docs/product.md` | Funcional: roles, permisos, flujos, estados, reglas y pantallas |
| `docs/architecture.md` | Patrón, capas, módulos, modelo de datos y flujos client ↔ server |
| `docs/api.md` | API v1, autenticación, idempotencia, errores y webhooks |
| `docs/operations.md` | Despliegue, backups, colas, cron, salud y runbook |
| `docs/decisions.md` | ADR - porqués ya tomados |
| `docs/onboarding.md` | Cómo arrancar el proyecto en local |
| `.env.example` | Nombres de variables de entorno (sin secretos) |

Si el agente pierde el hilo: menciona `@AGENTS.md` y/o `@docs/architecture.md` en el chat.
