# Start - punto de entrada

**Punto de entrada - lee esto primero al especializar el template.**

Guía de qué copiar tal cual y qué rellenar antes de arrancar cualquier proyecto.

---

## Fuente canónica (SSOT) - no duplicar

Cada dato vive en **un solo archivo**. El resto solo enlaza.

| Dato | Dónde vive (única vez) | Dónde se menciona |
|------|------------------------|-------------------|
| Stack | [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto) | Enlace corto en otros docs |
| Producto / dominio | [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio) | Idem |
| Estado de sesión | [`AGENTS.md` §4](../AGENTS.md#4-estado-actual) | Solo aquí |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) | Enlace desde onboarding / AGENTS mapa |
| Decisiones ya tomadas | [`decisions.md`](./decisions.md) | Checklist en architecture al cerrar → ADR |
| Plan de implementación por fases | [`dev-prompts.md`](./dev-prompts.md) | Enlace desde el estado de sesión de [`AGENTS.md`](../AGENTS.md) |
| Cómo arrancar en local | [`onboarding.md`](./onboarding.md) | Enlace corto en [`README.md`](../README.md) |

Mantén la declaración de stack y producto únicamente en `AGENTS.md`. Si cambia, actualiza también los comandos, variables y arquitectura afectados, sin duplicar esa declaración. Las versiones exactas de dependencias pertenecen a los manifiestos y lockfiles del proyecto.

> Recuerda: un enlace Markdown **no** inyecta el contenido en el agente. En chats importantes, menciona también `@AGENTS.md`.

---

## Base general - revisable según el proyecto

Estos archivos ofrecen valores predeterminados independientes del stack. No requieren una reescritura inicial, pero revisa su adecuación al equipo, al proyecto y al flujo de trabajo; no son reglas inmutables.

| Archivo | Qué hace | ¿Cuándo revisar? |
|---------|----------|-----------------|
| `.cursor/rules/core.mdc` | Rol, idioma, alcance aprobado, confirmación por riesgo, review loop | Cuando cambien los límites de autonomía o el flujo de trabajo |
| `.cursor/rules/code-style.mdc` | Tipado, naming, inmutabilidad, async, secretos y configuración | Cuando cambien las convenciones o el runtime |
| `.cursor/rules/git.mdc` | Lectura permitida, mutaciones autorizadas, commits atómicos | Cuando cambie la política de control de versiones |
| `.cursor/rules/mentoring.mdc` | Mentoría proporcional, blueprint y verificación de tests | Cuando cambien las necesidades de aprendizaje o validación |

---

## Archivos que DEBES editar antes de empezar

Estos archivos contienen **placeholders**, no decisiones ya tomadas. Rellénalos antes de implementar; elimina las secciones irrelevantes o marca «No aplica» y usa «Pendiente» para decisiones aún abiertas. No inventes un frontend, backend o base de datos si el producto no los necesita.

### Prioridad 1 - Rellenar el primer día

| Archivo | Qué rellenar | Impacto si no lo haces |
|---------|-------------|----------------------|
| `AGENTS.md` §2 Stack | Framework, ORM, lenguaje, testing, despliegue | El agente propone soluciones del stack equivocado |
| `AGENTS.md` §3 Contexto de negocio | Producto, reglas de dominio, integraciones, deuda conocida | El agente no entiende restricciones del dominio |
| `AGENTS.md` §4 Estado actual | Fecha, foco, checklist y bloqueadores iniciales | Los ejemplos se confunden con el estado real |
| `docs/decisions.md` | Revisar `ADR-001`: adoptarlo con fecha real o eliminar el ejemplo | Una propuesta parece una decisión aceptada |
| `docs/architecture.md` | Patrón arquitectónico y árbol de carpetas real | El agente puede crear archivos en rutas incorrectas |
| `.env.example` | Variables reales del proyecto (sin valores secretos) | Los devs no saben qué configurar; riesgo de `.env` mal formado |

### Prioridad 2 - Ajustar antes de la primera feature

| Archivo | Qué ajustar | Detalle |
|---------|------------|---------|
| `.cursor/rules/frontend.mdc` | Activación contextual | Parte por relevancia; añade `globs` de las rutas reales de interfaz |
| `.cursor/rules/backend.mdc` | Activación contextual | Parte por relevancia; añade `globs` de las rutas reales de backend/dominio |
| `README.md` | Descripción del proyecto derivado | Reemplaza la descripción del template por la del producto real |
| `docs/onboarding.md` | Comandos reales de setup | Derivados del stack en `AGENTS.md` §2 (sin re-listar el stack) |

### Cómo especializar la activación de reglas

Frontend/backend incluyen `description` y `alwaysApply: false`, sin `globs`: el agente decide si son relevantes. Puedes mencionarlas con `@` cuando necesites aplicarlas explícitamente. Al conocer el layout, añade `globs` al frontmatter y conserva `alwaysApply: false`: se adjuntarán cuando haya archivos coincidentes en contexto.

Usa rutas que existan en el proyecto: por ejemplo, `src/ui/**` solo si esa carpeta es realmente interfaz. Separa varios patrones con comas; evita patrones genéricos como `**/services/**` si también existen servicios del cliente. Comprueba casos dentro y fuera de cada área. Los globs seleccionan contexto, no conceden permisos de edición. Elimina las reglas de áreas que no apliquen al producto.

Referencia: [reglas de Cursor](https://cursor.com/docs/context/rules).

### Prioridad 3 - Mantener vivo durante el desarrollo

| Archivo | Qué actualizar y cuándo |
|---------|------------------------|
| `AGENTS.md` §4 Estado actual | Según el [protocolo de cierre](../AGENTS.md#protocolo-de-cierre-de-sesión), no automáticamente tras consultas |
| `docs/architecture.md` → Decisiones abiertas | Al resolver dentro del alcance autorizado: `[x] → ADR-NNN` y registrar el ADR según el [protocolo de cierre](../AGENTS.md#protocolo-de-cierre-de-sesión); sin autorización de escritura, solo proponerlo |

---

## Del proyecto derivado (no vienen en este boilerplate)

No se incluyen a propósito: hinchan el template y obligan a borrarlos o reescribirlos en cada clon. Créalos en el **repo del producto** cuando toque.

| Archivo / recurso | Cuándo crearlo |
|-------------------|----------------|
| `LICENSE` | Repo público, entrega a clientes, o quieres dejar claro el uso del código |
| `CHANGELOG.md` | Cuando empieces a etiquetar releases (`v0.1.0`, `v1.0.0`…) |
| Versión de la app | En el manifiesto del stack (`package.json`, `pyproject.toml`, etc.), no aquí |
| `CONTRIBUTING.md` | Cuando entre un segundo colaborador o contribuciones externas |
| `SECURITY.md` / `CODE_OF_CONDUCT.md` | Repos abiertos o producto con usuarios reales |
| `.github/` (PR / issue templates) | Equipo o open source con flujo de review |
| `.github/workflows/ci.yml` (o equivalente) | Primer PR en equipo, o `main` protegida: lint, typecheck, test |
| Deploy (Vercel, Railway, AWS…) | Al publicar: configura la plataforma; documenta la elección en `AGENTS.md` §2 (Despliegue) |
| `Dockerfile` / `docker-compose.yml` | BD/redis locales reproducibles, API multi-servicio, o imagen propia para producción |
| `.cursor/rules/docker.mdc` / `ci.mdc` | Opcional, cuando Docker o CI formen parte habitual del flujo |
| ESLint / Biome / Prettier | Al existir código: lint + formato; declara la elección en `AGENTS.md` §2 si aplica |
| Typecheck (`tsc --noEmit` / tipado del lenguaje) | Junto al lenguaje estricto; en CI cuando haya pipeline |
| Tests unitarios (Vitest, Jest, pytest…) | Al primer módulo de dominio; documenta el runner en `AGENTS.md` §2 (Testing) |
| Tests e2e (Playwright, Cypress…) | Cuando haya flujos críticos de UI o API a proteger |
| Validación de entrada (Zod, Valibot, Pydantic, class-validator…) | En boundaries (HTTP, forms, env); no hardcodear schemas en docs |
| Pre-commit / husky / lint-staged | Opcional, cuando el equipo quiera gates locales antes del push |

La versión de **este template** vive en `AGENTS.md` (`Template versión`). No la confundas con la versión de la app. Un MVP en Vercel a menudo no necesita Docker ni CI el día 1; lint + tests sí conviene montarlos pronto en el **proyecto derivado**, no en este boilerplate.

---

## Resumen visual

```
cursor-project-template/
│
├── ✅ BASE GENERAL - REVISAR SEGÚN EL PROYECTO
│   ├── .cursor/rules/core.mdc
│   ├── .cursor/rules/code-style.mdc
│   ├── .cursor/rules/git.mdc
│   └── .cursor/rules/mentoring.mdc
│
├── ✏️  RELLENAR (fuentes canónicas - Prioridad 1)
│   ├── AGENTS.md              ← stack + negocio + estado (SSOT)
│   ├── docs/architecture.md   ← patrón + árbol de carpetas (SSOT)
│   └── .env.example           ← variables del proyecto
│
├── 🔧 AJUSTAR (Prioridad 2)
│   ├── .cursor/rules/frontend.mdc
│   ├── .cursor/rules/backend.mdc
│   ├── docs/onboarding.md     ← comandos; stack → enlace a AGENTS
│   └── README.md
│
├── 📎 REFERENCIA (no duplicar datos de AGENTS)
│   ├── docs/decisions.md      ← ADRs registrados
│   ├── docs/dev-prompts.md    ← prompts de implementación por fases
│   └── docs/start.md          ← este archivo (punto de entrada)
│
└── ➕ CREAR EN EL PROYECTO DERIVADO (cuando toque)
    ├── LICENSE / CHANGELOG / CONTRIBUTING
    ├── versión en package.json / pyproject.toml / …
    ├── .github/workflows/ci.yml
    ├── Dockerfile / docker-compose.yml
    ├── config de deploy (Vercel, Railway, …)
    ├── ESLint|Biome|Prettier + typecheck
    ├── Vitest|Jest|pytest + Playwright|Cypress
    └── validación (Zod|Valibot|Pydantic|…)
```
