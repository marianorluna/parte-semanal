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
### ADR-NNN - [Título corto de la decisión]

- **Fecha:** YYYY-MM-DD
- **Estado:** Propuesta | Aceptada | Obsoleta | Reemplazada por ADR-NNN
- **Contexto:** Qué problema o restricción motivó la decisión.
- **Opciones consideradas:**
  1. Opción A - pros / contras
  2. Opción B - pros / contras
- **Decisión:** Qué se eligió y por qué.
- **Consecuencias:** Qué cambia, qué deuda introduce, qué facilita.
```

---

## Registro

### ADR-001 - Monolito modular con un solo despliegue

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** ~20 proyectos y 500 trabajadores hoy (1.000 a cinco años), con una única constructora usuaria. El equipo es pequeño y el MVP debe estar operativo en un día. A la vez, se quiere integrar con nómina, ERP y BI sin rehacer la app.
- **Opciones consideradas:**
  1. Microservicios (auth, partes, reporting) - escala y despliegue independiente, pero multiplica infraestructura, transacciones distribuidas y coste operativo para un volumen que una sola base de datos resuelve sin esfuerzo.
  2. Monolito por capas técnicas (`controllers/`, `services/`, `models/`) - arranque rápido, pero los límites se diluyen y el acoplamiento crece con cada feature.
  3. Monolito modular con puertos y adaptadores por módulo - un despliegue, transacciones locales, límites explícitos y posibilidad de extraer un módulo si hiciera falta.
- **Decisión:** Opción 3. Módulos `identidad`, `organizacion`, `partes`, `reporting` y `auditoria`, cada uno con `domain` / `application` / `infrastructure` y una API pública (`index.ts`).
- **Consecuencias:** Un solo contenedor y una sola base de datos, con transacciones simples. Exige disciplina: nadie importa repositorios de otro módulo ni tablas ajenas. Extraer `reporting` a un servicio o mover los jobs a otro proceso queda como opción barata si el volumen lo pide.

### ADR-002 - Stack: Next.js App Router + Postgres + Drizzle

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Se necesita autenticación, UI de dos perfiles, base de datos relacional y despliegue en un VPS con Coolify, sin mantener un backend separado por ahora.
- **Opciones consideradas:**
  1. Next.js full-stack (App Router, Server Actions, RSC) - un despliegue, un lenguaje, menos glue code; riesgo de mezclar lógica de negocio en componentes.
  2. NestJS + React separados - separación clara de capas y DI nativa, a cambio de dos despliegues, contrato HTTP propio y más tiempo de arranque.
  3. Remix/SvelteKit - buenos en formularios, ecosistema menor para lo que viene después (ExcelJS, PDF, jobs).
  4. Postgres + Prisma vs Drizzle - Prisma maduro y con mejor DX de migraciones; Drizzle es SQL-first, más ligero y sin motor binario, lo que simplifica la imagen Docker.
- **Decisión:** Next.js App Router con TypeScript estricto, Tailwind, Postgres 16 y Drizzle (+ `drizzle-kit`), Auth.js con Credentials y hash argon2id, Zod en fronteras, Vitest para dominio.
- **Consecuencias:** El riesgo de la opción 1 se mitiga con las capas de `architecture.md` y con revisión: los componentes no contienen reglas. `drizzle-kit` obliga a escribir SQL consciente y a versionar migraciones. Todo el backend es un contenedor Node 22, desplegable en Coolify sin servicios extra.

### ADR-003 - Granularidad diaria por tarea, en minutos enteros

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** El usuario pide un parte semanal, pero la nómina es mensual y las semanas cruzan meses. Además hay que poder corregir un día sin rehacer la semana y, más adelante, emitir un registro de jornada defendible.
- **Opciones consideradas:**
  1. Totales por semana y proyecto - mínimo esfuerzo de captura, pero impide repartir por mes, corregir un día y auditar. Retrofit muy caro.
  2. Filas por `(empleado, fecha, tarea)` con minutos enteros, presentadas como rejilla semanal - misma UX de captura y todo lo anterior resuelto.
  3. Event sourcing desde el fichaje - máximo detalle e historial, complejidad desproporcionada para el MVP.
- **Decisión:** Opción 2. El hecho atómico es `imputacion(parte_id, fecha, tarea_id, minutos)`. La semana ISO es la unidad de presentación y aprobación, no de almacenamiento.
- **Consecuencias:** ~7 filas por tarea y semana; los dashboards necesitan agregación (se resuelve con índices y, en fase 2, con agregados al aprobar). Se preserva la capacidad de calcular nómina mensual, coste por proyecto y registro legal futuro. Redondeo en minutos, con formato decimal solo en presentación: cambiarlo a mitad de ejercicio obligaría a recalcular histórico.

### ADR-004 - Mono-inquilino con `empresa_id` reservado

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Una sola constructora usa la app, pero en el futuro podría entrar una subcontrata con acceso limitado a sus propios trabajadores y obras.
- **Opciones consideradas:**
  1. Multi-inquilino real con `tenant_id` y Row Level Security - aislamiento fuerte, coste alto de diseño y pruebas desde el día uno.
  2. Mono-inquilino con `empresa_id` en las tablas de negocio - aislamiento por autorización en la aplicación; barato hoy y migrable.
  3. Base de datos por empresa - aislamiento máximo, operación duplicada sin necesidad.
- **Decisión:** Opción 2. Tabla `empresa` con una fila activa; `empresa_id` presente en proyecto, empleado y parte. Sin RLS por ahora.
- **Consecuencias:** Menos complejidad y consultas directas. Si se abre el portal de subcontratas, habrá que añadir RLS y revisar todas las consultas: el `empresa_id` ya presente evita una migración de datos traumática.

### ADR-005 - Aprobación de un nivel

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Hay que controlar la imputación sin burocratizar. En obra, dos niveles de aprobación suelen derivar en partes sin revisar.
- **Opciones consideradas:**
  1. Un nivel: trabajador envía → encargado/jefe de obra aprueba o rechaza con motivo.
  2. Dos niveles (encargado → jefe de obra / administración) - más control, más fricción y más estados.
  3. Sin aprobación, solo notificación - rápido, pero sin control real del dato.
- **Decisión:** Opción 1, con reapertura auditada de un parte aprobado.
- **Consecuencias:** Menos estados y adopción más rápida. La auditoría y el motivo de rechazo compensan la falta de segunda firma. Añadir un nivel después es viable: nuevo estado `REVISADO` entre `ENVIADO` y `APROBADO`, sin tocar `imputacion`.

### ADR-006 - Despliegue en VPS con Coolify y Postgres autogestionado

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** El MVP debe publicarse ya en `https://horas.levitec.marianorluna.com`, con coste bajo y sin operar un backend separado. Existe un VPS con Coolify y un repositorio en GitHub.
- **Opciones consideradas:**
  1. Vercel + Neon/Supabase - cero operación, pero dos proveedores, latencia de BD y coste creciente con conexiones.
  2. VPS + Coolify con Postgres en contenedor en el mismo servidor - un solo sitio, coste mínimo, control total; el backup y las actualizaciones son responsabilidad nuestra.
  3. VPS + Coolify con Postgres gestionado externo - mejor durabilidad, pero un proveedor y coste adicionales para un MVP.
- **Decisión:** Opción 2. App Next.js en contenedor con `Dockerfile` multi-stage, Postgres 16 como servicio de Coolify en la misma red interna (puerto no publicado), TLS de Coolify y backups programados a almacenamiento externo.
- **Consecuencias:** Un único punto de fallo y mantenimiento propio (parches de Postgres, disco, backups verificados). El modelo es portable: cambiar a una BD gestionada es cambiar `DATABASE_URL`, y el `Dockerfile` funciona en cualquier host con Docker. Con 2 vCPU / 4 GB hay margen holgado para 1.000 trabajadores; el escalado vertical es la primera palanca antes de plantear servicios separados.

### ADR-007 - Cola de trabajos en Postgres con pg-boss

- **Fecha:** 2026-10-22
- **Estado:** Propuesta (se adopta en la fase 2)
- **Contexto:** Informes en segundo plano, exportaciones grandes, recordatorios de envío y webhooks necesitan ejecución asíncrona con reintentos. Añadir Redis implica otro servicio que operar en el mismo VPS.
- **Opciones consideradas:**
  1. `pg-boss` - reutiliza Postgres, transaccional con los datos, sin servicio extra; rendimiento suficiente para decenas de jobs por minuto.
  2. BullMQ + Redis - mayor throughput y ecosistema, a cambio de un contenedor y persistencia adicionales.
  3. Cron de Coolify + tabla de jobs propia - mínimo, pero sin reintentos, visibilidad ni bloqueo por job.
- **Decisión propuesta:** `pg-boss` sobre la misma base de datos, con una interfaz `JobQueue` en `application` para poder cambiar de implementación sin tocar el dominio.
- **Consecuencias:** Una dependencia menos y jobs en la misma transacción que el cambio de estado. La cola compite por recursos con la BD: si el volumen de informes crece, se separa en su propio Postgres o se migra a BullMQ detrás del mismo puerto.

### ADR-008 - Demo aislado por empresa marcada y purga transaccional

- **Fecha:** 2026-10-22
- **Estado:** Aceptada
- **Contexto:** Hacen falta datos realistas (50 usuarios, 10 proyectos, 6 semanas de partes) para probar la app y enseñarla antes de cargar datos reales. Ese juego de datos debe poder desaparecer sin tocar nada real, sin migraciones especiales y sin un segundo entorno de base de datos que operar.
- **Opciones consideradas:**
  1. Base de datos de demo separada con un segundo `DATABASE_URL` - aislamiento total, pero duplica migraciones, configuración y backups, y no permite probar el flujo contra el mismo esquema en un único despliegue.
  2. Columna `es_demo` en cada tabla - marcado explícito por fila, a cambio de tocar el esquema de negocio con una preocupación puramente operativa y de arrastrarla en todas las consultas.
  3. Marcador de empresa (`empresa.codigo = 'DEMO'`) más emails `@demo.local` - usa una clave natural ya existente, sin columnas nuevas; la purga borra por empresa y sus dependencias en cascada.
- **Decisión:** Opción 3. `npm run db:seed:demo` es idempotente (crea o actualiza la empresa `DEMO`, sus proyectos, tareas, usuarios, empleados, asignaciones y seis semanas relativas a la semana ISO actual, con RNG de semilla fija). `npm run db:seed:demo:purge` borra solo esa empresa en una única transacción y en orden seguro de claves foráneas. `--refresh` purga y recarga. Con `NODE_ENV=production` ambas órdenes exigen `--yes` y muestran el resumen de lo que van a tocar; el seed nunca forma parte del despliegue.
- **Consecuencias:** No hay cambios de esquema ni consultas condicionadas por el demo, y el desarrollador reproduce la misma carga siempre. La responsabilidad de mantener el marcador recae en el seed: cualquier dato nuevo del demo debe colgar de la empresa `DEMO` para que la purga lo alcance. Si algún día se abre un portal de subcontratas con demo propio, el patrón se extiende con un `codigo` por escenario en lugar de rehacer el mecanismo.

---
### ADR-009 - Avisos in-app con cron HTTP idempotente

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** El encargado necesita saber quién no ha cargado horas y qué proyecto se está agotando sin entrar a buscarlo, y el trabajador necesita un recordatorio antes de que su parte quede pendiente. La fase 2 preveía email transaccional y `pg-boss`, pero todavía no hay proveedor de correo elegido ni cola desplegada, y el MVP debe cerrarse sin sumar servicios que operar.
- **Opciones consideradas:**
  1. Email SMTP con `nodemailer` y plantillas - entrega fuera de la app, a cambio de credenciales, rebotes, reputación de dominio y un proveedor que decidir ahora.
  2. Solo avisos calculados al abrir la app - cero infraestructura, pero nadie recibe nada si no entra.
  3. Avisos persistidos en la app, generados por un endpoint de cron protegido que también devuelve el lote para que un automatizador externo lo reenvíe - sin proveedor acoplado, con historial consultable y posibilidad de conectar email o WhatsApp después sin tocar el dominio.
- **Decisión:** Opción 3. Cada aviso se guarda en `notificacion` con una `clave_idempotencia` única por usuario, de modo que repetir el cron no duplica nada. `GET|POST /api/v1/cron/avisos` exige `CRON_SECRET` y admite `modo` (`recordatorios`, `riesgos`, `todo`), `semana` y `dryRun`. La programación (viernes y lunes recordatorios, diario riesgos) la lanza Coolify o n8n; n8n puede consumir el lote devuelto para enviarlo por email o WhatsApp.
- **Consecuencias:** El MVP entrega avisos sin dependencias nuevas ni credenciales externas, y el canal de entrega queda desacoplado. La app no garantiza la entrega externa: si el cron no se invoca, no hay aviso, así que la programación debe quedar documentada y verificada en el despliegue. Cuando exista proveedor de correo, se añade un adaptador de envío que consume las notificaciones ya persistidas, sin cambiar las reglas de generación.

### ADR-010 - Exportación XLSX con ExcelJS y PDF en servidor con @react-pdf/renderer

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Hoy solo existe CSV e impresión del navegador. El encargado necesita abrir los datos en Excel con formato y disponer de un PDF con tablas y gráficos para adjuntar o archivar, sin depender de que el usuario sepa usar el diálogo de impresión.
- **Opciones consideradas:**
  1. Sin dependencias: XML Spreadsheet 2003 para Excel y `window.print()` para PDF - cero instalación, pero el "Excel" no es `.xlsx` real, no admite varias hojas con estilos fiables y el PDF sigue dependiendo del navegador del usuario.
  2. ExcelJS + `@react-pdf/renderer` - `.xlsx` real con hojas, estilos, autofiltro y formatos; PDF generado en servidor con componentes React y SVG, descargable por URL y verificable en pruebas.
  3. ExcelJS + Gotenberg (contenedor Chromium) - máxima fidelidad de maquetación, a cambio de un servicio contenedor más que operar en el VPS.
- **Decisión:** Opción 2. `exceljs@4.4.0` y `@react-pdf/renderer@4.9.0` (compatible con React 19), ambas declaradas en `serverExternalPackages` de `next.config.ts`. Los exportadores viven en `reporting/infrastructure/exportadores` y reciben datos ya filtrados por alcance; ningún route handler consulta la base de datos por su cuenta.
- **Consecuencias:** Dos dependencias nuevas y algo más de peso en la imagen, a cambio de informes reales sin servicios extra. La maquetación PDF se escribe una vez y se reutiliza en la app y en la exportación. Si más adelante se necesita fidelidad HTML/CSS exacta, el puerto del exportador permite sustituir la implementación por Gotenberg sin tocar las páginas.

### ADR-011 - Plazo de proyecto y riesgo por desviación temporal

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** `proyecto.horas_presupuesto` permite saber cuánto se ha consumido, pero no si el ritmo es sostenible. Un 30% consumido en el 10% del plazo es una señal distinta de un 30% consumido en el 90%. El aviso debe anticipar el problema, no confirmarlo al final.
- **Opciones consideradas:**
  1. Estimar el plazo desde la primera imputación hasta hoy - sin cambios de esquema, pero el plazo se mueve con el uso y no refleja la planificación real.
  2. Añadir `fecha_inicio` y `fecha_fin` al proyecto - plazo explícito y editable, con el coste de una migración aditiva y de mantener las fechas.
  3. Guardar un presupuesto versionado con importe y fechas (fase 2, 2.4) - más fiel a la realidad contractual, desproporcionado para este paso y pendiente de decidir si hay importes.
- **Decisión:** Opción 2. Se añaden `fecha_inicio` y `fecha_fin` (`date`, nulas) a `proyecto`. El dominio puro `reporting/domain/riesgo.ts` calcula consumo, plazo transcurrido, desviación en puntos porcentuales y proyección de consumo al cierre. Los niveles son `AGOTADO` (consumo >= 100%), `CRITICO` (proyección >= 125%, desviación >= 20 pp o consumo >= 90%), `AVISO` (proyección >= 110% o desviación >= 10 pp) y `OK`, con estados explícitos `SIN_PRESUPUESTO` y `SIN_PLAZO` cuando faltan datos.
- **Consecuencias:** Los avisos de desviación solo aparecen en proyectos con presupuesto y fechas cargadas; el resto muestra consumo sin juicio de plazo, sin falsear el semáforo. El cálculo es determinista y testeable, y no necesita tabla de agregados a esta escala. La versión con importes, coste hora y presupuesto histórico queda para la fase 2 sobre esta misma base.

### ADR-012 - Calendario laboral propio y bloqueo de días no laborables

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** El parte semanal acepta horas cualquier día, incluidos sábados, domingos y festivos. Eso distorsiona los totales, la planificación y la comparación con la jornada teórica. La empresa necesita, además, cubrir festivos locales y propios, y abrir o cerrar días puntuales sin tocar los datos históricos.
- **Opciones consideradas:**
  1. Calcular los festivos al vuelo desde un catálogo fijo - cero tablas, pero no admite festivos locales ni excepciones, y cualquier corrección obliga a desplegar.
  2. Un calendario por empresa con días laborables configurables, festivos y excepciones persistidos, y jornada teórica versionada - modela la realidad y permite corregir cada año desde administración.
  3. Un servicio externo de calendarios laborales - datos oficiales, a cambio de una integración, una dependencia de red y un coste recurrente que el MVP no justifica.
- **Decisión:** Opción 2. La tabla `calendario` guarda los días laborables, la jornada diaria de referencia y la comunidad; `festivo` y `excepcion_calendario` cuelgan de él; `empleado_calendario` asigna calendarios por empleado y `jornada_teorica` versiona la jornada por calendario o empleado. La precarga de festivos nacionales y autonómicos vive en dominio puro (`calendario/domain/festivos-espana.ts`) y es solo un punto de partida: el administrador revisa los traslados oficiales y publica. La resolución de un día tiene precedencia excepción > festivo > día de la semana, y la usan tanto la rejilla como la validación de servidor.
- **Consecuencias:** Los días no laborables se muestran siempre, deshabilitados y con su motivo; las horas ya registradas siguen siendo editables para poder corregirlas, pero no se admiten horas nuevas. Cada escritura incrementa `calendario.version` y `parte` guarda `calendario_id` y `calendario_version` al enviarse, de modo que un cambio posterior de festivos no reinterpreta partes cerrados. Sin calendario configurado se mantiene el comportamiento anterior (lunes a viernes, sin festivos), así que la migración no rompe empresas existentes. El cálculo de horas nocturnas y la jornada por convenio quedan fuera: requieren fichaje con hora de inicio y fin.

### ADR-013 - Día no laborable visible, deshabilitado y con excepción para horas existentes

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Ocultar o bloquear sin más los sábados, domingos y festivos impide corregir horas ya registradas y deja al trabajador sin explicación de por qué falta un día.
- **Opciones consideradas:**
  1. Deshabilitar el día por completo - simple, pero deja datos históricos ineditables y genera soporte.
  2. Mostrar el día con su motivo, deshabilitar la entrada nueva y permitir editar las horas que ya existían - conserva la corrección sin abrir la puerta a imputaciones nuevas.
  3. Permitir cualquier día con un aviso - no bloquea el error que se quiere evitar.
- **Decisión:** Opción 2. La rejilla y el panel rápido muestran los días no laborables con su etiqueta, sin celda de alta; si el día ya tenía una imputación, se mantiene editable para poder corregir o vaciar. La validación de servidor vuelve a comprobar la regla para que no dependa de la interfaz.
- **Consecuencias:** El trabajador entiende el calendario y conserva la capacidad de arreglar errores previos. Un festivo nuevo no invalida partes ya enviados: el calendario se congela en el parte al enviarse.

### ADR-014 - Cómputo versionado con resultado persistido; nocturna aplazada

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Cada convenio reparte las horas en tramos normales, extra, complementarias, festivas, de viaje, formación o paralización. Cambiar una regla no puede reescribir semanas ya aprobadas, y el cálculo debe poder auditarse.
- **Opciones consideradas:**
  1. Calcular al vuelo en cada consulta - siempre actualizado, pero un cambio de convenio altera el histórico y encarece los listados.
  2. Snapshot por imputación y tramo al aprobar, con reglas y convenio versionados - histórico inmutable y consultas baratas.
  3. Guardar solo el total computado - menos filas, sin trazabilidad de qué regla produjo cada tramo.
- **Decisión:** Opción 2. `convenio` y `regla_computo` se versionan; al aprobar se escriben `resultado_computo` por imputación y tramo, con `convenio_version`, `regla_id` y `factor_bps` en enteros. Las reglas se evalúan en dominio puro y el resultado se recalcula al reabrir. La hora nocturna queda fuera hasta que exista fichaje con hora de inicio y fin.
- **Consecuencias:** Reabrir un parte retira sus snapshots y los recalcula; una regla nueva solo afecta a lo aprobado después. El coste de almacenamiento crece con los tramos, no con el número de consultas.

### ADR-015 - Cierre por periodos y estado BLOQUEADO

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Nómina y contabilidad necesitan un corte formal. Un parte aprobado no debería cambiar después del cierre, pero un error real debe poder corregirse con trazabilidad.
- **Opciones consideradas:**
  1. Un booleano `cerrado` en el parte - no expresa cierres mensuales ni reaperturas parciales.
  2. Tabla `periodo_cerrado` con ámbito empresa o empleado y tipo semanal o mensual, y estado `BLOQUEADO` en el parte - modela el corte real y permite reabrir con motivo.
  3. Bloquear por fecha en la aplicación sin persistir el cierre - se pierde el motivo y la auditoría.
- **Decisión:** Opción 2. `periodo_cerrado` guarda tipo, año, semana o mes, empleado opcional, motivo y actor. Cerrar pasa a `BLOQUEADO` los partes aprobados cubiertos; reabrir los devuelve a `APROBADO` solo si ningún otro cierre activo los cubre, y recalcula cómputo y coste. Una semana que cruza de mes se bloquea si cualquiera de sus fechas imputadas cae en el mes cerrado. Escritura, envío, aprobación, rechazo y reapertura comprueban las fechas cerradas en servidor.
- **Consecuencias:** El cierre es auditable y reversible con motivo. Reabrir un periodo puede recalcular muchos partes; se hace en una operación explícita de administración y no en segundo plano silencioso.

### ADR-016 - Worker de pg-boss en el mismo contenedor

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Informes, correos y webhooks necesitan reintentos y no deben bloquear la petición del usuario. El despliegue es un único recurso Docker Compose y no hay Redis.
- **Opciones consideradas:**
  1. Un contenedor worker separado - aislamiento, a cambio de otro servicio que desplegar, monitorizar y escalar.
  2. Worker dentro del proceso Next, arrancado de forma idempotente - una sola imagen y un solo healthcheck, compartiendo base de datos.
  3. Ejecutar todo en la petición - sin infraestructura, pero un fallo de SMTP o de un webhook afecta al usuario.
- **Decisión:** Opción 2. `src/jobs/worker.ts` arranca el worker una vez por proceso (protegido contra el hot reload) y registra las colas de informes, correos y webhooks. Los jobs son idempotentes y persisten su estado. El despacho de webhooks corre cada minuto y también puede forzarse por cron.
- **Consecuencias:** Menos piezas que operar y un único despliegue. Un reinicio del contenedor interrumpe el job en curso, que pg-boss reintenta; las tareas deben seguir siendo idempotentes. Si el volumen de jobs crece, el worker puede extraerse a un servicio propio sin cambiar los casos de uso.

### ADR-017 - Claves de API, idempotencia y outbox

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** Un ERP externo necesita leer partes y escribir imputaciones sin compartir sesión de usuario. Los reintentos de red no pueden duplicar horas, y un webhook caído no puede revertir una aprobación.
- **Opciones consideradas:**
  1. Compartir un JWT de usuario - sin tablas nuevas, pero sin alcances, caducidad ni revocación independiente.
  2. Clave opaca con prefijo visible y hash HMAC, alcances, caducidad, rate limit, idempotencia persistida y outbox transaccional - auditable y seguro, con varias tablas.
  3. Firmar cada petición con un secreto compartido - más complejo para el integrador y sin revocación por clave.
- **Decisión:** Opción 2. La clave tiene formato `lv_<prefijo>_<secreto>`; se guarda un HMAC-SHA256 con `AUTH_SECRET` y solo se muestra una vez. Cada escritura exige `Idempotency-Key` y se reclama en `api_idempotencia` antes de procesar; una repetición devuelve la respuesta guardada. El cambio de estado escribe el evento en `outbox` en la misma transacción; un despachador crea una entrega por webhook suscrito y firma `timestamp.cuerpo` con HMAC. Los reintentos usan backoff de 1, 5, 15, 60 y 240 minutos hasta cinco intentos.
- **Consecuencias:** El integrador puede reintentar sin miedo y el negocio no depende de la disponibilidad del webhook. El secreto del webhook se guarda en claro porque hace falta para firmar: proteger la base de datos y rotarlo si se filtra. El rate limit es por minuto y por clave; no sustituye a un WAF.

### ADR-018 - CI, staging y observabilidad

- **Fecha:** 2026-10-24
- **Estado:** Aceptada
- **Contexto:** La fase 2 añade migraciones, jobs y webhooks. Un fallo silencioso en la cola o una migración no probada afecta a partes ya aprobados.
- **Opciones consideradas:**
  1. Solo CI de lint y tests - rápido, pero no valida migraciones ni el build de producción.
  2. CI con Postgres 16, migraciones, tests y build, más staging con datos anonimizados y health ampliado - cubre el riesgo real con un coste razonable.
  3. Añadir Playwright al mismo pipeline desde el primer día - más cobertura de UI, a cambio de una dependencia y un navegador que aún no están aprobados.
- **Decisión:** Opción 2 por ahora. GitHub Actions levanta Postgres 16, aplica migraciones sobre base limpia, ejecuta lint, tipado, tests y build. `/api/health` informa base de datos, estado de la cola y jobs fallidos sin devolver 503 por un job fallido; `/api/v1/cron/salud` responde 503 a partir de cinco jobs fallidos para que el monitor externo alerte. Staging es un recurso Coolify sobre la rama `staging`, con volumen propio y datos anonimizados o demo. Playwright queda como propuesta pendiente de aprobación.
- **Consecuencias:** Las migraciones se prueban antes de producción y la cola tiene una señal de alerta. El health no reinicia el contenedor por jobs fallidos, que se reintentan. Si se aprueba Playwright, se añade un job separado que arranca la app con el seed demo y no bloquea el pipeline de calidad.

### ADR-019 - RRHH, fichaje, horas extra y subcontratas viven en Bizneo

- **Fecha:** 2026-10-25
- **Estado:** Aceptada
- **Contexto:** La empresa ya gestiona con Bizneo las vacaciones, los permisos, las bajas, el fichaje y las horas extra. LeviParte necesita conocer las ausencias aprobadas para bloquear los días en la rejilla y explicar los huecos al encargado, pero replicar los flujos de RRHH crearía dos fuentes de verdad y dos aprobaciones para el mismo hecho.
- **Opciones consideradas:**
  1. Implementar fichaje, horas extra y portal de subcontratas dentro de LeviParte (fase 3.1 a 3.3) - cobertura completa, a cambio de duplicar un sistema que ya existe, asumir responsabilidad legal sobre el registro de jornada y mantener dos aprobaciones.
  2. Consumir Bizneo como fuente de verdad y limitar LeviParte a las ausencias aprobadas que afectan a la imputación - una sola fuente de verdad, con integración pendiente.
  3. No mostrar ausencias y dejar que cada encargado consulte Bizneo por su cuenta - sin código nuevo, pero el parte pierde el contexto de por qué falta una persona.
- **Decisión:** Opción 2. Bizneo es la fuente de verdad de RRHH: fichaje, horas extra y subcontratas quedan fuera del alcance del producto y se retiran del backlog de fase 3. LeviParte conserva el módulo de ausencias como registro operativo para bloquear la rejilla, con un aviso en las pantallas de ausencias que indica el origen de los datos y que la sincronización automática está prevista; mientras no exista, los registros de LeviParte se mantienen a mano. Las ausencias aprobadas de la semana se muestran al encargado en `/control/equipo`.
- **Consecuencias:** El aviso no debe prometer datos actualizados hasta que exista el adaptador. La integración futura se hará con un importador de ausencias y fichajes, sin reimplementar la solicitud ni la aprobación de RRHH. `empresa_id` sigue reservado (ADR-004) por si algún día se abre un portal externo, pero el multi-inquilino real deja de ser prioridad. La responsabilidad del registro legal de jornada queda en Bizneo.

### ADR-020 - Justificación de la desviación de jornada y proyecto interno de ajuste

- **Fecha:** 2026-10-25
- **Estado:** Aceptada
- **Contexto:** La jornada teórica ya se calcula por calendario, convenio y ausencias. La tentación es rechazar cualquier parte cuyo total no coincida exactamente, y ofrecer un "proyecto comodín" para las horas que no encajan en un proyecto real. Pero la igualdad exacta es frágil: la semana en curso, las altas y bajas a mitad de semana, los permisos parciales, las ausencias registradas tarde y los picos de obra producen diferencias legítimas. Bloquear empuja a rellenar horas en cualquier tarea para poder enviar, lo que degrada el dato que se quiere proteger.
- **Opciones consideradas:**
  1. Bloqueo estricto: no se envía si el total no coincide con la capacidad - dato limpio en teoría, pero rompe envíos válidos y fomenta la imputación ficticia.
  2. Aviso con justificación obligatoria en semanas cerradas, desviación firmada en el parte y proyecto interno de ajuste excluido del presupuesto - hace explícita la diferencia sin impedir el trabajo real.
  3. Tarea `DEFECTO` con minutos positivos o ajustes negativos - encaja en la rejilla, pero rompe la invariante `minutos > 0` y confunde el signo del saldo.
- **Decisión:** Opción 2. La semana en curso se envía con aviso. Si la semana ya terminó (`weekEnd < hoy`), hay capacidad conocida y la diferencia no es cero, el trabajador debe declarar un motivo de 10 a 500 caracteres. El envío guarda en el parte `capacidad_min`, `desviacion_min` (con signo, negativo = defecto) y `motivo_desviacion`; el borrador, el rechazo y la reapertura limpian esa declaración para que una nueva versión se justifique de nuevo. El defecto es una métrica firmada, nunca una imputación: se mantiene `(empleado, fecha, tarea) -> minutos enteros > 0`. El comodín es un proyecto normal marcado con `es_ajuste`, único por empresa por índice parcial, con tareas de exceso o no imputables asignadas por administración. Se excluye de `consumoTotalPorProyecto`, del semáforo y de las alertas de riesgo, y sigue sumando en `horasPorProyecto` y en el coste real como fila etiquetada "Ajuste", para no perder horas ni euros del total de la empresa.
- **Consecuencias:** Una semana con cero horas sigue sin poder enviarse aunque la capacidad sea cero: es una limitación previa y fuera de este cambio. El comodín debe asignarse también a los encargados que revisan, o el parte queda fuera de su ámbito y no pueden aprobarlo. El motivo declarado no se valida contra el calendario ni contra RRHH: es una explicación humana que el encargado juzga al aprobar. No se añade tabla de ajustes firmados ni tarea de defecto.
### ADR-021 - Asistente de IA como capa de apoyo con proveedor compatible con OpenAI

- **Fecha:** 2026-10-25
- **Estado:** Aceptada
- **Contexto:** El MVP ya calcula cumplimiento, riesgo por desviación y cómputo con reglas deterministas. El encargado pierde tiempo interpretando tres pantallas distintas y redactando motivos de rechazo, y se quiere demostrar valor de IA sin poner en riesgo datos de trabajadores ni decisiones auditadas.
- **Opciones consideradas:**
  1. Chat libre o text-to-SQL sobre la base de datos - muy vistoso, pero permite prompt injection, produce resultados no auditables y dispara el coste sin control.
  2. Capa de redacción y resumen sobre datos ya calculados, con contexto minimizado y una clave de empresa en servidor - valor inmediato, riesgo acotado, sin tocar el dominio ni el esquema.
  3. IA dentro de las reglas de negocio (aprobar, validar o calcular) - ahorra clics, pero traslada a un modelo una responsabilidad legal y auditada que debe seguir siendo determinista.
- **Decisión:** Opción 2. El módulo `asistente` expone dos funciones de solo lectura: briefing semanal en el dashboard y borrador del motivo de rechazo que el encargado edita y confirma. La IA nunca escribe, nunca aprueba, nunca rechaza y nunca calcula totales. El proveedor se integra mediante un puerto `ProveedorLLM` y un único adaptador compatible con el protocolo de chat de OpenAI, de modo que DeepSeek, OpenAI y OpenRouter se eligen con `IA_BASE_URL` e `IA_MODELO`. Sin `IA_API_KEY` o sin `IA_MODELO` la app funciona igual y las funciones responden `NO_CONFIGURADO`. El contexto excluye correos e identificadores internos, pseudonimiza nombres por defecto, delimita los textos libres dentro de `<datos>` y se acota con timeout, tope de tokens y límite por usuario. La auditoría guarda solo modelo y consumo de tokens.
- **Consecuencias:** Se obtiene valor demostrable sin migración ni dependencias nuevas. El coste y la latencia dependen de un tercero, así que el flujo manual debe seguir intacto, como ya ocurre con SMTP. Activar la función con datos reales exige verificar antes el DPA, la retención, el uso para entrenamiento y la transferencia internacional del proveedor; hasta entonces sirve para demo y datos de prueba. Las funciones de precarga por voz y consulta en lenguaje natural siguen fuera de alcance por su mayor superficie de ataque.
