# Parte semanal de horas - Levitec

Aplicación interna para declarar, controlar y explotar las horas imputadas a proyecto.

El trabajador registra sus horas por día, proyecto y tarea. El encargado revisa y aprueba el parte de la semana. Dirección y administración obtienen horas, desviaciones e informes sin depender de hojas de cálculo.

- **Producción prevista:** https://horas.levitec.marianorluna.com (VPS propio con Coolify)
- **Escala objetivo:** ~20 proyectos, 500 trabajadores hoy, hasta 1.000 en cinco años

## Estado

Documentación y arquitectura definidas. **Sin código de aplicación todavía**: el plan de implementación por fases está en [`docs/dev-prompts.md`](docs/dev-prompts.md) y el estado vigente en [`AGENTS.md`](AGENTS.md) §4.

## Empezar aquí

| Documento | Para qué |
|-----------|----------|
| [`AGENTS.md`](AGENTS.md) | Stack, dominio y estado de sesión (fuente única) |
| [`docs/dev-prompts.md`](docs/dev-prompts.md) | Prompts de implementación, fase a fase |
| [`docs/architecture.md`](docs/architecture.md) | Módulos, capas, modelo de datos y despliegue |
| [`docs/decisions.md`](docs/decisions.md) | ADRs: por qué se decidió cada cosa |
| [`docs/onboarding.md`](docs/onboarding.md) | Arranque local (comandos reales al crear el código) |
| [`docs/start.md`](docs/start.md) | Índice del boilerplate y mapa SSOT |

## Estructura prevista

```
parte-diario/
├── src/
│   ├── app/            # rutas Next: transporte y composición
│   ├── modules/        # identidad, organizacion, partes, reporting, auditoria
│   ├── db/             # esquema Drizzle, migraciones y seed
│   ├── shared/         # errores, fechas, horas <-> minutos, validación
│   └── config/         # validación de variables de entorno
├── Dockerfile          # imagen de producción (Coolify)
├── compose.yml         # Postgres de desarrollo
├── docs/
└── AGENTS.md
```

El detalle de capas y responsabilidades está en [`docs/architecture.md`](docs/architecture.md).

## Reglas del proyecto

- Un cambio lógico por commit, en inglés: `feat(partes): add weekly timesheet grid`.
- El agente no commitea, no hace push y no despliega sin autorización explícita.
- Sin `any`. Tiempo y dinero en enteros (minutos y céntimos).
- Las reglas de negocio viven en `domain`; los componentes y handlers solo validan, autorizan y orquestan.
- Stack, dominio y estado se declaran **solo** en `AGENTS.md`; el resto de documentos enlazan.
