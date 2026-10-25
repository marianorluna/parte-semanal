# Prompts de desarrollo por fases

Plan ejecutable para construir el parte semanal de horas. Cada prompt es un cambio lógico y un commit. El stack, el dominio y el estado vigente viven en [`AGENTS.md`](../AGENTS.md); las capas en [`architecture.md`](./architecture.md); los porqués en [`decisions.md`](./decisions.md).

> **Objetivo:** MVP funcional desplegado en `https://horas.levitec.marianorluna.com` al final de la Fase 1. Todo lo demás, por orden de valor, en la Fase 2 y siguientes.

---

## 1. Cómo usar este documento

- Un prompt = una intención = un commit. No encadenes dos prompts sin verificar el primero.
- Abre un chat nuevo por prompt y adjunta solo los archivos que indica el contexto. Si el agente empieza a tocar archivos fuera del alcance, páralo y repite el prompt subrayando «Fuera de alcance».
- Antes de commitear: `npm run lint`, `npm run typecheck`, `npm run test`. Si algo falla, se corrige ahí, no se arrastra.
- Los prompts están escritos para ser pegados tal cual. Sustituye solo lo que va entre `< >`.
- **No** pidas al agente que haga commits, push ni despliegues: esas acciones las autorizas tú explícitamente.
- Al cerrar cada bloque, usa el prompt transversal **T5** para actualizar el estado de sesión.

---

## 2. Decisiones adoptadas

| # | Decisión | Elegido | ADR | Coste de revertir |
|---|----------|---------|-----|-------------------|
| D1 | Arquitectura | Monolito modular, un despliegue | [ADR-001](./decisions.md#adr-001---monolito-modular-con-un-solo-despliegue) | Medio |
| D2 | Stack | Next.js App Router + TS estricto + Postgres 16 + Drizzle | [ADR-002](./decisions.md#adr-002---stack-nextjs-app-router--postgres--drizzle) | Medio |
| D3 | Granularidad | Día × tarea en minutos enteros; aprobación por semana ISO | [ADR-003](./decisions.md#adr-003---granularidad-diaria-por-tarea-en-minutos-enteros) | **Alto** |
| D4 | Inquilinos | Mono-inquilino con `empresa_id` reservado | [ADR-004](./decisions.md#adr-004---mono-inquilino-con-empresa_id-reservado) | Medio |
| D5 | Aprobación | Un nivel, con reapertura auditada | [ADR-005](./decisions.md#adr-005---aprobación-de-un-nivel) | Bajo |
| D6 | Despliegue | VPS + Coolify + Postgres en el mismo servidor, dominio propio | [ADR-006](./decisions.md#adr-006---despliegue-en-vps-con-coolify-y-postgres-autogestionado) | Bajo |
| D7 | Jobs | `pg-boss` sobre Postgres, sin Redis | [ADR-007](./decisions.md#adr-007---cola-de-trabajos-en-postgres-con-pg-boss) | Bajo |

Consecuencia directa de D6: **no hay backend separado**. La app Next.js y la base de datos son dos contenedores de Coolify en la misma red interna, y el dominio se publica con TLS automático. Nada de Vercel, Neon ni Supabase en esta etapa.

---

## 3. Alcance del MVP

**Entra:**

1. Login con email y contraseña; roles `TRABAJADOR`, `ENCARGADO`, `ADMIN`; alcance del encargado por proyecto.
2. Empleados, proyectos, tareas y asignaciones (seed real + pantalla mínima de administración).
3. Rejilla semanal del trabajador: tareas asignadas × 7 días, totales en vivo, guardado de borrador.
4. Envío, estados, bandeja del encargado, aprobación y rechazo con motivo.
5. Dashboard mínimo: horas por proyecto y semana, partes pendientes, top desviaciones.
6. Exportación CSV y vista imprimible (PDF por el diálogo del navegador).
7. Auditoría de cambios de estado y de ediciones tras el envío.
8. Desplegado en el subdominio con HTTPS, backups programados y datos semilla.

**No entra (a propósito):** registro legal de jornada, motor de cómputo por convenio, festivos, vacaciones y ausencias, coste hora y presupuesto, Excel y PDF generados en servidor, notificaciones por email, offline, portal de subcontratas, API pública, SSO, tests e2e.

**Criterio de aceptación:** un operario envía su semana en menos de 2 minutos y un encargado aprueba cinco partes en menos de 5 minutos, en móvil y en escritorio, con datos reales de una semana.

---

## 4. Plan del día

| Hora | Slice | Prompt | Si vas tarde |
|------|-------|--------|--------------|
| 09:00-09:45 | Scaffold + Dockerfile + BD local | 1.1 | No negociable |
| 09:45-10:30 | Despliegue temprano en Coolify | 1.2 | No negociable |
| 10:30-11:15 | Auth, roles y alcance | 1.3 | No negociable |
| 11:15-12:00 | Dominio, esquema y seed | 1.4 | No negociable |
| 12:00-13:15 | API del parte | 1.5 | No negociable |
| 13:15-14:15 | Rejilla semanal | 1.6 | Solo un proyecto por empleado |
| 14:15-15:00 | Bandeja y aprobación | 1.7 | No negociable |
| 15:00-15:45 | Dashboard | 1.8 | Reduce a 3 KPIs |
| 15:45-16:15 | CSV e imprimible | 1.9 | Solo imprimible |
| 16:15-17:00 | Auditoría y endurecimiento | 1.10 | Auditoría mínima sí |
| 17:00-18:00 | Prueba con usuarios reales | - | No negociable |

Si a las 14:00 el flujo de envío no funciona, paras de añadir alcance. Un flujo completo sin dashboard vale más que un dashboard sin flujo.

**El despliegue va segundo, no último.** Descubrir un problema de proxy, TLS o migraciones a las 19:00 es el fallo clásico de este tipo de entrega.

---

## 5. Fase 0 - Fundación (completada el 2026-10-22)

Ya ejecutada en el repositorio, sin código de aplicación:

- `AGENTS.md` §2-§4 especializados (stack, dominio, estado).
- `docs/architecture.md` con módulos, capas, contrato de errores, modelo de datos y topología de despliegue.
- `docs/decisions.md` con ADR-001 a ADR-007.
- `.env.example` con las variables reales.

No repitas estos pasos. Si una decisión cambia, actualiza el ADR correspondiente con el prompt **T4**.

---

## 6. Fase 1 - MVP (hoy y mañana)

### Prompt 1.1 - Scaffold, Dockerfile y Postgres local

```text
Contexto: @AGENTS.md @docs/architecture.md @docs/decisions.md

Tarea: inicializar el proyecto. Sin lógica de negocio todavía.

Haz:
1. Next.js con App Router y TypeScript en la raíz del repo (no en subcarpeta), Tailwind, ESLint.
2. tsconfig: strict, noUncheckedIndexedAccess, noImplicitOverride, path alias @/*.
3. next.config: output: 'standalone' (lo exige la imagen Docker de producción).
4. Dependencias: zod, drizzle-orm, drizzle-kit, postgres, date-fns, vitest, dotenv, @auth/* (cuando toque).
   No añadas ninguna otra sin pedir permiso.
5. docker-compose.yml para desarrollo: postgres:16, volumen persistente, healthcheck, puerto 5432.
   Nombre del servicio: db. Usuario, contraseña y base de datos: parte_diario.
6. Dockerfile de producción multi-stage (node:22-alpine):
   - stage deps: npm ci
   - stage builder: build de Next con output standalone
   - stage runner: usuario no root, solo .next/standalone, .next/static y public, TZ=Europe/Madrid, PORT=3000
   - CMD node server.js
7. .dockerignore con node_modules, .next, .git, .env*, docs.
8. src/app/api/health/route.ts que devuelva { status: "ok", version } sin tocar la base de datos.
9. src/config/env.ts: validación Zod de DATABASE_URL, APP_URL, AUTH_SECRET y TZ, con mensajes claros. Falla al arrancar si falta algo en producción.
10. Scripts npm: dev, build, start, lint, typecheck, test, db:generate, db:migrate, db:studio, db:seed.
11. drizzle.config.ts leyendo DATABASE_URL; carpeta src/db con cliente y migraciones.

Criterios de aceptación:
- docker compose up -d levanta Postgres y pasa healthcheck.
- npm run typecheck y npm run lint terminan sin errores ni warnings.
- npm run test ejecuta Vitest y pasa (aún sin tests).
- npm run dev sirve /api/health con 200.
- docker build -t parte-diario . construye sin errores y el contenedor responde en /api/health.

Fuera de alcance: auth, entidades, UI de negocio, PDF, Excel, CI.
Al terminar: comandos exactos para levantar todo desde cero, salida de cada verificación y peso de la imagen.
```

### Prompt 1.2 - Despliegue temprano en Coolify

```text
Contexto: @AGENTS.md §2 @docs/architecture.md (Despliegue) @docs/decisions.md (ADR-006)

Tarea: publicar el placeholder en https://horas.levitec.marianorluna.com antes de escribir features.
No supongas los pasos de la interfaz de Coolify: si tu versión no expone algo, indícalo y da la alternativa
(comando, API o variable de entorno).

Haz, en este orden:
1. Lista de requisitos previos y comprobaciones:
   - Registro DNS A (o CNAME) de horas.levitec.marianorluna.com apuntando al VPS; verificación con dig.
   - Puertos 80 y 443 abiertos en el firewall; 5432 cerrado al exterior.
   - Versión de Coolify y de Docker del servidor.
2. Proyecto en Coolify con dos recursos en la misma red:
   - Servicio PostgreSQL 16 con volumen persistente y backups programados.
   - Aplicación desde el repositorio GitHub, rama main, build por Dockerfile.
3. Variables de entorno en Coolify (nunca en el repo):
   - DATABASE_URL con la URL INTERNA del servicio Postgres.
   - APP_URL=https://horas.levitec.marianorluna.com
   - AUTH_SECRET generado con openssl rand -base64 32
   - AUTH_TRUST_HOST=true
   - TZ=Europe/Madrid
   - NODE_ENV=production
4. Dominio y TLS: asociar el subdominio a la app, forzar HTTPS y verificar el certificado.
5. Comando de pre-despliegue: npm run db:migrate. Si la versión de Coolify no lo soporta, explica
   la alternativa (script de entrada con reintento y bloqueo asesoría, o ejecución manual documentada).
6. Healthcheck apuntando a /api/health, con margen suficiente para el arranque.
7. Backups: programar dump diario del servicio Postgres hacia almacenamiento FUERA del VPS
   (S3, Backblaze B2 o similar). Un backup en el mismo disco no sirve.
8. Probar: despliegue verde, /api/health responde por HTTPS, el placeholder carga.
9. Documenta en docs/onboarding.md los pasos exactos y el checklist de verificación.

Criterios: HTTPS válido, healthcheck en verde, Postgres sin puerto público, backup ejecutado al menos una vez.
Fuera de alcance: CI, staging, monitorización, WAF.
Al terminar: URL pública, evidencia de cada comprobación y qué queda pendiente (por ejemplo, restaurar un backup).
```

### Prompt 1.3 - Autenticación, roles y alcance

```text
Contexto: @AGENTS.md §3 @docs/architecture.md (Contrato de errores)

Tarea: autenticación con email y contraseña, sesión en cookie httpOnly y autorización por rol y alcance.
Usa Auth.js con Credentials. No implementes criptografía propia.

Modelo:
- usuario(id, empresa_id, email único en minúsculas, password_hash, nombre, rol, empleado_id nullable, activo)
- usuario_proyecto(usuario_id, proyecto_id) - alcance del ENCARGADO
- rol enum TRABAJADOR | ENCARGADO | ADMIN

Haz:
1. Hash argon2id (o bcrypt coste 12 si argon2 falla en el runtime; documenta la elección). Nunca SHA.
2. /login, logout, sesión y redirección por rol. Layout protegido en (app) y (admin).
3. Autorización en servidor: requireUser(), requireRol(...), requireAccesoProyecto(proyectoId).
   Toda comprobación se hace en el servidor, también en Server Actions y route handlers.
4. Middleware solo para redirección de no autenticados; sin reglas de negocio.
5. Rate limit en login por IP + email (en memoria, documentado como limitación).
6. Página /sin-acceso para 403, con salida a la pantalla del rol.
7. Seed mínimo: 1 admin, 1 encargado y 2 trabajadores. El seed debe negarse a ejecutarse
   si NODE_ENV=production, salvo confirmación explícita por variable.

Criterios:
- Un TRABAJADOR no accede a rutas de encargado ni de admin, incluso escribiendo la URL.
- Sesión caducada redirige a login sin perder el destino.
- Logout invalida la cookie.
- Test unitario de las políticas de alcance (propio vs por proyecto vs global).
- Ningún secreto en el repo.

Fuera de alcance: registro público, recuperación de contraseña, MFA, SSO, invitaciones por email.
Al terminar: matriz rol × ruta implementada y cómo comprobarla a mano.
```

### Prompt 1.4 - Dominio, esquema y seed real

```text
Contexto: @AGENTS.md §3 @docs/architecture.md (Modelo de datos)

Tarea: modelar el dominio del parte semanal con minutos enteros y persistirlo.

Este es el esquema exacto: no añadas ni quites columnas sin justificarlo.
- empresa(id, nombre, cif, activa)
- empleado(id, empresa_id, codigo único, nombre, categoria, activo)
- proyecto(id, empresa_id, codigo único, nombre, horas_presupuesto nullable, activo)
- tarea(id, proyecto_id, codigo, nombre, horas_presupuesto nullable, activa) UNIQUE(proyecto_id, codigo)
- asignacion(id, empleado_id, tarea_id, desde date, hasta date nullable, activa) CHECK(desde <= hasta)
- parte(id, empresa_id, empleado_id, iso_year, iso_week, week_start date, estado, total_minutos,
        version, enviado_at, revisado_por, revisado_at, motivo_rechazo)
  UNIQUE(empleado_id, iso_year, iso_week)
- imputacion(id, parte_id, fecha date, tarea_id, minutos int, nota nullable)
  UNIQUE(parte_id, fecha, tarea_id); CHECK(minutos > 0 AND minutos <= 1440)
- auditoria(id, actor_id, entidad, entidad_id, accion, antes jsonb, despues jsonb, motivo, created_at)
- índices: parte(estado, iso_year, iso_week), imputacion(parte_id), imputacion(tarea_id, fecha)

Reglas:
- Toda mutación pasa por un caso de uso; los route handlers y Server Actions solo validan con Zod e invocan.
- Funciones puras en src/shared/date y src/modules/partes/domain:
  isoWeekOf(date), weekDaysOf(isoYear, isoWeek), horasAMinutos(texto), minutosAHoras(minutos), validarImputaciones(...).
- horasAMinutos acepta «1,5», «1.5» y «1:30»; normaliza a minutos. Rechaza negativos, cero y más de 24 h/día.
- La fecha de una imputación debe caer dentro de week_start..week_start+6.
- total_minutos se recalcula siempre en el servidor.

Haz:
1. Esquema Drizzle por módulo, migración generada y aplicada.
2. Entidades y casos de uso: obtenerOCrearBorrador, guardarImputaciones, enviar, aprobar, rechazar.
3. Seed con datos realistas: 1 empresa, 3 proyectos con 4-6 tareas cada uno, 12 empleados,
   asignaciones activas y dos semanas de imputaciones de ejemplo con totales variados.
4. Tests unitarios: conversión de horas, semana ISO en el cambio de año (incluida semana 53),
   fecha fuera de semana, minutos inválidos, transición de estado no permitida, suma de totales.

Criterios: migración aplicable desde cero, tests en verde, ningún `any`, ninguna regla de negocio fuera del dominio.
Fuera de alcance: UI, festivos, ausencias, costes, tipos de hora.
Al terminar: lista de casos de uso con su firma y salida de los tests.
```

### Prompt 1.5 - API del parte

```text
Contexto: @AGENTS.md §3 @docs/architecture.md @src/modules/partes

Tarea: exponer el parte semanal al cliente con Server Actions.

Haz:
1. Acciones (o route handlers; elige una vía y sé consistente, documentándolo):
   - obtener el parte de la semana indicada del usuario autenticado; si no existe, crear borrador vacío.
   - guardar imputaciones del borrador: transacción que sustituye las filas del parte y recalcula el total.
     Rechaza si el estado no es BORRADOR o RECHAZADO.
   - enviar: idempotente por parte + version; rechaza si el total es 0.
   - aprobar o rechazar: el rechazo exige motivo. Solo ENCARGADO con acceso al proyecto o ADMIN.
   - reabrir un parte aprobado con motivo obligatorio; queda auditado.
2. Validación Zod de entrada y salida. Errores con el contrato de @docs/architecture.md
   ({ success, error: { code, message, fieldErrors } }), sin trazas internas.
3. Concurrencia optimista con version: UPDATE ... WHERE id = ? AND version = ?. En conflicto, CONFLICTO_VERSION.
4. Autorización de alcance en cada acción: el trabajador solo su parte; el encargado solo proyectos asignados.
   Comprueba el alcance por el id del parte, no por el rol.
5. Auditoría en cada cambio de estado y en cada guardado sobre un parte ya enviado.
6. Datos para la rejilla: tareas activas asignadas al empleado, agrupadas por proyecto, con o sin imputación.
7. Tests de los casos de uso contra una base de datos de test (o dobles de repositorio si no hay tiempo;
   dilo explícitamente y déjalo anotado como deuda).

Criterios: no se puede aprobar un parte ajeno ni editar un APROBADO; el total lo calcula el servidor;
un doble clic en enviar no duplica.
Fuera de alcance: dashboard, exportaciones, notificaciones.
```

### Prompt 1.6 - Rejilla semanal del trabajador

```text
Contexto: @AGENTS.md §3 @src/modules/partes

Tarea: pantalla principal del trabajador. Móvil primero, escritorio correcto.

Haz:
1. Ruta /mi-semana con navegación de semanas (anterior, siguiente, «esta semana»).
2. Tabla: filas = proyecto > tarea asignada; columnas = lun..dom con fecha y resaltado de hoy.
   Totales por fila, por día y general.
3. Entrada tolerante: «1,5», «1.5», «1:30»; vacío = 0. Error inline por celda, nunca alert().
   No pierdas lo escrito cuando falle la validación de otra celda.
4. Guardado: botón explícito + autoguardado con debounce de 800 ms. Indicador: guardando / guardado / error con reintento.
5. Totales en vivo usando la MISMA función de dominio que el servidor (importada, no duplicada).
6. Aviso (no bloqueo) si un día supera 12 h o la semana supera 48 h.
7. Estados: BORRADOR editable; ENVIADO solo lectura con opción de retirar si no está aprobado;
   APROBADO solo lectura con sello de quién y cuándo; RECHAZADO editable con el motivo visible arriba.
8. Envío con confirmación y resumen: total de horas y desglose por proyecto.
9. Accesibilidad: labels asociados, navegación por teclado en la rejilla, contraste, objetivos táctiles de 44 px.
10. Estados vacíos: sin asignaciones, sin tareas, semana futura.

Criterios: en 375 px no hay scroll horizontal de página (usa tarjeta por día o columnas compactas);
recargar conserva los datos; el autoguardado no dispara peticiones en cascada.
Fuera de alcance: offline, plantillas, copiar semana anterior, adjuntos.
```

### Prompt 1.7 - Bandeja y aprobación del encargado

```text
Contexto: @AGENTS.md §3 @src/modules/partes

Tarea: flujo de control de partes.

Haz:
1. /control/partes: lista filtrable por semana, proyecto, estado y empleado; paginación en servidor;
   por defecto, ENVIADOS de la semana actual.
2. Acciones masivas: aprobar seleccionados; rechazar seleccionados exige un motivo común.
3. Detalle: rejilla en solo lectura con desglose por proyecto y tarea, totales e historial de estados
   con actor y fecha.
4. Reapertura de un parte APROBADO a BORRADOR con motivo obligatorio, auditada.
5. Avisos antes de aprobar: día con más de 12 h, parte con 0 horas, tarea sin asignación activa,
   semana sin envío.
6. Contador de pendientes en la navegación. Sin email todavía.
7. Empty states claros para cada filtro.

Criterios: un encargado sin proyectos ve la lista vacía y no puede aprobar por URL directa;
toda mutación queda en auditoría; aprobar 5 partes no exige más de 5 clics en total.
Fuera de alcance: email, push, SLA, aprobación en dos niveles.
```

### Prompt 1.8 - Dashboard mínimo

```text
Contexto: @AGENTS.md §3 @src/modules/reporting

Tarea: dashboard con datos reales, sin maquetas ni cifras inventadas.

KPIs (una consulta agregada por bloque, no N+1):
1. Horas de la semana seleccionada: total, por proyecto y evolución de las últimas 8 semanas.
2. Partes pendientes de aprobación y su antigüedad.
3. Top 5 proyectos por horas y top 5 empleados por horas.
4. Horas por proyecto frente a horas presupuestadas, cuando estén informadas.

Haz:
1. /control/dashboard con selector de semana y filtro por proyecto según el alcance del usuario.
2. Gráfico de evolución semanal y barras por proyecto (recharts, o SVG propio si evita una dependencia).
   No añadas una librería de UI completa.
3. Tabla de detalle con enlace al parte.
4. Skeleton de carga y estado vacío con mensaje explícito.
5. Índices necesarios; comprobar con EXPLAIN sobre un seed de 2.000 imputaciones.

Criterios: el encargado solo agrega sus proyectos; respuesta por debajo de 500 ms con 50.000 imputaciones.
Fuera de alcance: euros, productividad, exportaciones, comparativas interanuales, tiempo real.
```

### Prompt 1.9 - CSV e imprimible

```text
Contexto: @AGENTS.md

Tarea: salida de datos sin generación de PDF en servidor.

Haz:
1. CSV del parte (una fila por imputación) y CSV del listado filtrado de partes.
   UTF-8 con BOM, separador «;» por defecto (Excel en español), cabeceras legibles,
   importes y minutos sin notación científica, escape correcto de comillas y saltos.
2. /partes/[id]/imprimir con estilos @media print: cabecera con empresa, empleado, semana ISO y rango,
   rejilla, totales, líneas de firma y pie con fecha de generación.
3. Botón «Descargar PDF» que use window.print() y explique usar «Guardar como PDF».
4. Marca de agua «BORRADOR» cuando el estado no sea APROBADO.
5. Nombres de archivo saneados y siempre limitados al alcance autorizado.

Criterios: el imprimible cabe en una A4 vertical con 2 proyectos y 6 tareas; sin dependencias nuevas de PDF;
una exportación no puede incluir datos de proyectos fuera del alcance.
Fuera de alcance: ExcelJS, Gotenberg, plantillas configurables, envío por email.
```

### Prompt 1.10 - Auditoría, endurecimiento y go-live

```text
Contexto: @AGENTS.md @docs/architecture.md @docs/onboarding.md @docs/decisions.md

Tarea: cerrar el MVP con lo mínimo defendible y dejarlo publicado.

Haz:
1. Auditoría: registra login, logout, guardado sobre parte enviado, envío, aprobación, rechazo y reapertura,
   con actor, antes/después y motivo. Pantalla /admin/auditoria de solo lectura, filtrable y paginada.
2. Endurecimiento: cabeceras de seguridad (HSTS, X-Content-Type-Options, Referrer-Policy, CSP básica),
   cookies Secure + HttpOnly + SameSite=Lax, errores sin trazas internas, validación de todas las fronteras.
3. Recorre todas las rutas y confirma que ninguna confía en el cliente para autorizar.
   Entrega una tabla ruta × rol × comprobación.
4. Migraciones en producción: confirma que el pre-despliegue de Coolify las aplica en orden y que
   son aditivas (compatibles con la versión anterior de la app).
5. Verifica backups: restaura uno en local y documenta el procedimiento paso a paso.
   Un backup no restaurado no es un backup.
6. Smoke test del flujo completo en producción con datos de una semana real, en móvil y escritorio.
7. Actualiza docs/onboarding.md y README con los comandos y URLs reales.

Criterios: se puede hacer el flujo completo en producción, la restauración está probada y documentada,
y una petición a un parte ajeno devuelve 404/403 sin filtrar datos.
Fuera de alcance: CI, monitorización, alertas, WAF, staging.
Al terminar: informe de qué se verificó, qué no y por qué.
```

---

## 7. Fase 2 - Próxima semana

Ordenado por valor, no por facilidad. Si dispones de cinco días, haz 2.1 a 2.5 y deja el resto para la siguiente.

### Prompt 2.1 - Calendario laboral y festivos

```text
Tarea: calendario y jornada teórica por ámbito.
Entidades: calendario(id, nombre, ambito enum NACIONAL|CCAA|PROVINCIA|LOCAL|CENTRO, codigo, vigente_desde, vigente_hasta),
festivo(calendario_id, fecha, nombre, es_laborable),
jornada_teorica(calendario_id, empleado_id nullable, desde, hasta, horas_semanales, horas_diarias, dias_semana int[]).
Reglas: precedencia local > provincia > CCAA > nacional para un empleado; un parte aprobado conserva
la versión de calendario aplicada; vigencias solapadas rechazadas en base de datos.
Haz: importador CSV de festivos con informe de rechazos por fila; nada de librerías de festivos
sin verificar cobertura real por provincia.
Tests: precedencia, festivo en domingo, empleado sin calendario, vigencia solapada.
Fuera de alcance: convenios colectivos completos.
```

### Prompt 2.2 - Motor de cómputo versionado

```text
Tarea: convertir minutos registrados en horas computables según reglas con vigencia.
Entidades: regla_computo(convenio_id, desde, hasta, version),
regla_tipo_hora(regla_id, tipo enum NORMAL|EXTRA|COMPLEMENTARIA|NOCTURNA|FESTIVA|VIAJE|FORMACION|PARALIZACION,
factor numeric, tope_diario_min, tope_semanal_min, requiere_autorizacion),
resultado_computo(imputacion_id, regla_id, tipo, minutos_base, minutos_computados, factor_aplicado).
Reglas: función pura y determinista, sin acceso a BD dentro del cálculo (recibe la regla cargada).
Cambiar una regla no altera semanas cerradas: el resultado guarda regla_id.
Prohibido float en tiempo o dinero; redondeo definido y documentado.
Tests: reglas solapadas, tope diario, nocturna que cruza medianoche, cambio de hora, regla inexistente.
Fuera de alcance: interpretación automática de convenios reales.
```

### Prompt 2.3 - Ausencias, vacaciones y bajas

```text
Tarea: ausencias integradas en el parte y en el cómputo.
Entidades: tipo_ausencia(nombre, computa, remunerada, requiere_aprobacion, afecta_coste),
ausencia(empleado_id, tipo_id, desde, hasta, dias, estado SOLICITADA|APROBADA|RECHAZADA|ANULADA, aprobado_por, motivo).
Reglas: no se imputa en un día con ausencia de jornada completa aprobada; solapes rechazados;
la rejilla muestra el día marcado y deshabilitado con motivo; saldo de vacaciones por año natural
con arrastre configurable.
Tests: solape, ausencia que cruza semana, anulación tras aprobación, día parcial.
Fuera de alcance: integración con Seguridad Social, IT y recaídas.
```

### Prompt 2.4 - Coste hora y presupuesto

```text
Tarea: coste real por proyecto con histórico correcto.
Entidades: coste_hora(empleado_id, desde, hasta, coste_centimos, tipo enum COSTE_EMPRESA|FACTURACION),
presupuesto_proyecto(proyecto_id, version, horas, importe_centimos, aprobado_at).
Reglas: el coste aplicable es el vigente a la fecha de la imputación, nunca el actual; importes en céntimos
enteros; un proyecto cerrado no cambia de presupuesto sin nueva versión; nunca sobrescribir histórico.
Haz: agregado de coste por parte actualizado al aprobar (no calcular en cada dashboard).
Tests: vigencia solapada, cambio de coste a mitad de semana, imputación sin coste definido (advertencia, no error).
Fuera de alcance: contabilidad analítica completa, centros de coste, maquinaria.
```

### Prompt 2.5 - Informes y exportaciones reales

```text
Tarea: informes generados en segundo plano.
Informes: parte semanal por empleado (PDF), resumen por proyecto y semana, certificación mensual,
libro de jornada, costes por proyecto, ausencias, horas extra, auditoría.
Haz: ExcelJS para XLSX con plantillas versionadas; PDF en servidor con Gotenberg en contenedor o
@react-pdf/renderer (elige uno y justifícalo con ADR); cola con pg-boss (ADR-007) con reintentos y
estado visible; descarga firmada y con caducidad; límite de rango temporal por petición;
informe de errores por fila en las importaciones.
Criterios: 10.000 filas sin bloquear la petición; job fallido visible y reintentable;
ningún dato fuera del alcance del usuario.
```

### Prompt 2.6 - Bloqueo, cierre mensual y reapertura

```text
Tarea: ciclo de vida completo y cierre de nómina.
Reglas: BORRADOR → ENVIADO → APROBADO → BLOQUEADO por cierre semanal; cierre mensual independiente
por empleado y mes natural, repartiendo las semanas por fecha de imputación (las semanas cruzan meses).
Reapertura solo por rol autorizado, con motivo, auditoría y recálculo de los agregados de reporting.
Periodo cerrado no admite escritura, ni siquiera de admin, sin reapertura explícita.
Tests: semana que cruza mes, reapertura tras cierre mensual, doble cierre, recálculo de agregados.
```

### Prompt 2.7 - Notificaciones y recordatorios

```text
Tarea: avisos que muevan el proceso.
Haz: email transaccional con el proveedor ya elegido por el cliente; si no hay, deja la interfaz y marca Pendiente.
Cola pg-boss con reintentos y backoff; plantillas versionadas; recordatorio de envío viernes y lunes;
aviso al encargado de pendientes; digest semanal; preferencias por usuario.
Idempotencia por (evento, destinatario, periodo) para no duplicar envíos.
Fuera de alcance: push, WhatsApp, SMS.
```

### Prompt 2.8 - API pública y webhooks

```text
Tarea: preparar el intercambio de información sin acoplar el dominio.
Haz: API REST /api/v1 con OpenAPI generado desde Zod; claves de API con alcance, caducidad y rate limit;
claves de idempotencia obligatorias en POST; webhooks firmados (HMAC + timestamp + reintentos con backoff)
y patrón Outbox en la misma transacción que el cambio de estado; endpoints de solo lectura para reporting
y de escritura para imputaciones externas; ejemplos con curl.
Adaptadores: puertos NóminaExporter y FichajeImporter con implementación CSV. El dominio no conoce
los formatos de A3, Sage ni Factorial.
Tests: reintento sin duplicar, firma inválida, clave caducada, webhook caído que no bloquea la transacción.
```

### Prompt 2.9 - CI y staging

```text
Tarea: red de seguridad y entorno previo a producción.
Haz: GitHub Actions con lint, typecheck, test y build, con Postgres como servicio; tests e2e Playwright
del flujo crítico (login → rellenar → enviar → aprobar → imprimir); staging en Coolify con datos
anonimizados y rama dedicada; migraciones probadas primero en staging; backups automáticos con
prueba de restauración documentada; monitorización de errores y alerta de jobs fallidos.
Criterios: un PR roto no se puede mergear; restauración verificada al menos una vez.
```

---

## 8. Fase 3 - Backlog priorizado

Cada fila es un prompt independiente. No mezclar con lo anterior.

| Orden | Prompt | Valor |
|-------|--------|-------|
| ~~3.1~~ | ~~Registro legal de jornada (fichaje)~~ - descartado: se gestiona en Bizneo ([ADR-019](./decisions.md#adr-019---rrhh-fichaje-horas-extra-y-subcontratas-viven-en-bizneo)) | Cumplimiento |
| ~~3.2~~ | ~~Horas extra~~ - descartado: se gestionan en Bizneo ([ADR-019](./decisions.md#adr-019---rrhh-fichaje-horas-extra-y-subcontratas-viven-en-bizneo)) | Legal y coste |
| ~~3.3~~ | ~~Portal de subcontratas~~ - descartado: sin portal externo previsto ([ADR-019](./decisions.md#adr-019---rrhh-fichaje-horas-extra-y-subcontratas-viven-en-bizneo)) | Alcance |
| 3.4 | PWA offline: cola local, resolución de conflictos por versión, indicador de sincronización | Adopción en obra |
| 3.5 | Parte diario de obra: personal, maquinaria, materiales, meteorología, incidencias y producción, enlazado a las horas del día | Productividad |
| 3.6 | Rendimientos reales frente a presupuesto por unidad de obra, con avisos de desviación | Estimación |
| 3.7 | Capacidad y planificación a 8-12 semanas; simulador de cuadrillas | Planificación |
| 3.8 | Detección de anomalías con reglas explicables y revisión humana | Control |
| 3.9 | BI: vistas de solo lectura o exportación a Power BI | Dirección |
| 3.10 | Captura por voz o bot de mensajería para encargados | Adopción |
| 3.11 | Kiosco de obra con QR/PIN por operario, sin cuentas compartidas | Adopción |
| 3.12 | Consulta en lenguaje natural de solo lectura, con permisos y respuestas trazables | Diferenciación |

---

## 9. Prompts transversales

### T1 - Blueprint de tests antes de implementar

```text
Antes de escribir código, dame el blueprint de tests de esta feature: casos clave, qué mockear,
qué asertar y qué no merece test. Usa Vitest para dominio y casos de uso, y Playwright solo si hay
un flujo de UI que lo justifique. No escribas la suite completa salvo que lo pida.
```

### T2 - Revisión de seguridad de un cambio

```text
Revisa el diff actual buscando: autorización ausente en acciones y endpoints, IDOR por no comprobar alcance,
validación de entrada faltante, secretos o trazas expuestas, inyección en consultas, CSRF, XSS en la vista
imprimible y rate limit. Devuelve hallazgos con archivo:línea y severidad. No modifiques archivos.
```

### T3 - Revisión de rendimiento con datos reales

```text
Con 50.000 imputaciones y 500 empleados sembrados, mide las cinco consultas más lentas del dashboard
y de la bandeja. Propón índices o agregados y muestra EXPLAIN ANALYZE antes y después.
No cambies el esquema sin explicar la migración y su compatibilidad hacia atrás.
```

### T4 - Registrar una decisión como ADR

```text
Registra en docs/decisions.md un ADR con la plantilla existente para la decisión tomada en este cambio:
contexto, opciones con pros y contras, decisión y consecuencias. Si cierra un ítem de «Decisiones abiertas»
en docs/architecture.md, márcalo con el número de ADR. No dupliques el stack, que vive en AGENTS.md.
```

### T5 - Cierre de sesión

```text
Aplica el protocolo de cierre de AGENTS.md §4: actualiza última sesión, foco, checklist y bloqueadores.
Resume qué se verificó, qué no se pudo verificar y por qué. No toques código.
```

### T6 - Operación en Coolify

```text
Guíame paso a paso para <desplegar / hacer rollback / restaurar un backup / rotar un secreto> en Coolify,
sin suponer la interfaz: si tu versión no expone la opción, da el comando o variable equivalente.
Incluye cómo comprobar el resultado y qué riesgo tiene la operación sobre datos en producción.
No ejecutes nada sin mi confirmación.
```

---

## 10. Reglas de ejecución

- **Un prompt, una intención, un commit.** Mensajes en inglés y conventional commits: `feat(partes): add weekly timesheet grid`.
- Nunca `git add .` a ciegas: revisa el diff antes de commitear.
- Si un prompt genera más de diez archivos, pártelo: es señal de alcance mal delimitado.
- Prohíbe en cada prompt, de forma explícita: `any`, `float` para tiempo o dinero, reglas de negocio en componentes o handlers, y dependencias nuevas no pedidas.
- Guarda el resultado de las verificaciones en la descripción del PR, no en tu memoria.
- Los datos de la prueba final deben ser **reales de una semana**. Es lo único que dirá si el producto sirve.
- En producción solo se aplican migraciones aditivas; un rollback de imagen no revierte la base de datos.

---

## 11. Checklist de go-live

- [ ] `npm run lint`, `npm run typecheck` y `npm run test` en verde.
- [ ] `docker build` reproducible y contenedor sin root.
- [ ] DNS de `horas.levitec.marianorluna.com` apuntando al VPS y certificado válido.
- [ ] Postgres sin puerto público y con contraseña fuerte.
- [ ] Variables de entorno en Coolify, ninguna en el repo, `AUTH_SECRET` distinto por entorno.
- [ ] Migraciones aplicadas por el pre-despliegue y compatibles con la versión anterior.
- [ ] Backup ejecutado y **restaurado** una vez en local.
- [ ] Flujo completo probado en producción: login → rellenar → enviar → aprobar → imprimir.
- [ ] Prueba de acceso indebido: un trabajador no ve partes ajenos.
- [ ] `docs/onboarding.md` y `README.md` con comandos y URLs reales.
- [ ] `AGENTS.md` §4 actualizado con el estado real.

---

## 12. Lo que duele si no se decide ya

- **Redondeo:** define si 7 minutos son 0,12 h o 0:07 y no lo cambies a mitad de ejercicio.
- **Semana del año:** usa `week_start` (lunes) como clave estable, nunca solo `iso_week`.
- **Zona horaria:** guarda y muestra fecha local; contenedor y Postgres con `TZ=Europe/Madrid`.
- **Borrado:** no borres imputaciones aprobadas; corrección = fila nueva más auditoría.
- **Coste histórico:** si sobrescribes el coste hora, el informe de hace seis meses deja de ser cierto.
