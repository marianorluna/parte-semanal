import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const rolEnum = pgEnum('rol', ['TRABAJADOR', 'ENCARGADO', 'ADMIN'])
export const estadoParteEnum = pgEnum('estado_parte', ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO'])
export const ambitoCalendarioEnum = pgEnum('ambito_calendario', [
  'NACIONAL',
  'CCAA',
  'PROVINCIA',
  'LOCAL',
  'EMPRESA',
])
export const origenFestivoEnum = pgEnum('origen_festivo', ['SEED', 'ADMIN', 'IMPORTACION'])
export const tipoNotificacionEnum = pgEnum('tipo_notificacion', [
  'RECORDATORIO_PARTE',
  'EQUIPO_PENDIENTE',
  'RIESGO_PROYECTO',
])

/**
 * Tipos de hora que reconoce el motor de cómputo. `NOCTURNA` queda fuera a
 * propósito: sin hora de inicio y fin no se puede calcular con rigor (ADR-014).
 */
export const tipoHoraEnum = pgEnum('tipo_hora', [
  'NORMAL',
  'EXTRA',
  'COMPLEMENTARIA',
  'FESTIVA',
  'VIAJE',
  'FORMACION',
  'PARALIZACION',
])

/** Contexto en el que una regla de cómputo es aplicable. */
export const aplicaEnEnum = pgEnum('aplica_en', ['TODO', 'LABORABLE', 'FESTIVO'])

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const empresa = pgTable('empresa', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  cif: text('cif'),
  activa: boolean('activa').notNull().default(true),
  createdAt,
})

export const empleado = pgTable(
  'empleado',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    codigo: text('codigo').notNull().unique(),
    nombre: text('nombre').notNull(),
    categoria: text('categoria'),
    activo: boolean('activo').notNull().default(true),
    createdAt,
  },
  (t) => [index('empleado_empresa_idx').on(t.empresaId)],
)

export const proyecto = pgTable(
  'proyecto',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    codigo: text('codigo').notNull().unique(),
    nombre: text('nombre').notNull(),
    horasPresupuesto: integer('horas_presupuesto'),
    // Plazo planificado. Opcional: sin fechas se informa consumo, pero no
    // desviación temporal (ver ADR-011).
    fechaInicio: date('fecha_inicio'),
    fechaFin: date('fecha_fin'),
    activo: boolean('activo').notNull().default(true),
    createdAt,
  },
  (t) => [
    index('proyecto_empresa_idx').on(t.empresaId),
    index('proyecto_empresa_activo_idx').on(t.empresaId, t.activo),
    check('proyecto_plazo_ck', sql`${t.fechaFin} is null or (${t.fechaInicio} is not null and ${t.fechaInicio} <= ${t.fechaFin})`),
  ],
)

export const tarea = pgTable(
  'tarea',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyecto.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull(),
    nombre: text('nombre').notNull(),
    horasPresupuesto: integer('horas_presupuesto'),
    activa: boolean('activa').notNull().default(true),
    createdAt,
  },
  (t) => [uniqueIndex('tarea_proyecto_codigo_uq').on(t.proyectoId, t.codigo)],
)

export const usuario = pgTable(
  'usuario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    nombre: text('nombre').notNull(),
    rol: rolEnum('rol').notNull().default('TRABAJADOR'),
    empleadoId: uuid('empleado_id').references(() => empleado.id, { onDelete: 'set null' }),
    activo: boolean('activo').notNull().default(true),
    createdAt,
  },
  (t) => [
    index('usuario_empresa_idx').on(t.empresaId),
    index('usuario_empleado_idx').on(t.empleadoId),
  ],
)

export const usuarioProyecto = pgTable(
  'usuario_proyecto',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyecto.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.proyectoId] })],
)

export const asignacion = pgTable(
  'asignacion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empleadoId: uuid('empleado_id')
      .notNull()
      .references(() => empleado.id, { onDelete: 'cascade' }),
    tareaId: uuid('tarea_id')
      .notNull()
      .references(() => tarea.id, { onDelete: 'cascade' }),
    desde: date('desde').notNull(),
    hasta: date('hasta'),
    activa: boolean('activa').notNull().default(true),
    createdAt,
  },
  (t) => [
    uniqueIndex('asignacion_empleado_tarea_desde_uq').on(t.empleadoId, t.tareaId, t.desde),
    index('asignacion_empleado_idx').on(t.empleadoId),
    check('asignacion_rango_ck', sql`${t.hasta} is null or ${t.desde} <= ${t.hasta}`),
  ],
)

export const calendario = pgTable(
  'calendario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    /** Ámbito de los festivos que aporta este calendario. */
    ambito: ambitoCalendarioEnum('ambito').notNull().default('EMPRESA'),
    /** Código estable: `ES`, `ES-MD`, `ES-MD-28079`, `EMPRESA`. */
    codigo: text('codigo').notNull(),
    /** Comunidad autónoma (ISO 3166-2:ES) cuando el ámbito es CCAA o inferior. */
    comunidad: text('comunidad'),
    /** Días de la semana laborables, 1 = lunes ... 7 = domingo. */
    diasSemana: integer('dias_semana').array().notNull().default(sql`'{1,2,3,4,5}'`),
    /** Jornada diaria de referencia en minutos. Null = sin jornada teórica. */
    horasDiariasMin: integer('horas_diarias_min'),
    vigenteDesde: date('vigente_desde').notNull(),
    vigenteHasta: date('vigente_hasta'),
    /** Calendario que se aplica a un empleado sin asignación explícita. */
    esPredeterminado: boolean('es_predeterminado').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
    version: integer('version').notNull().default(1),
    createdAt,
  },
  (t) => [
    uniqueIndex('calendario_empresa_codigo_uq').on(t.empresaId, t.codigo),
    index('calendario_empresa_idx').on(t.empresaId),
    check(
      'calendario_vigencia_ck',
      sql`${t.vigenteHasta} is null or ${t.vigenteDesde} <= ${t.vigenteHasta}`,
    ),
    check(
      'calendario_jornada_ck',
      sql`${t.horasDiariasMin} is null or (${t.horasDiariasMin} > 0 and ${t.horasDiariasMin} <= 1440)`,
    ),
    check(
      'calendario_dias_ck',
      sql`${t.diasSemana} <@ '{1,2,3,4,5,6,7}'::integer[]`,
    ),
  ],
)

export const festivo = pgTable(
  'festivo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarioId: uuid('calendario_id')
      .notNull()
      .references(() => calendario.id, { onDelete: 'cascade' }),
    fecha: date('fecha').notNull(),
    nombre: text('nombre').notNull(),
    /** Ámbito de origen del festivo; decide precedencia al resolver. */
    ambito: ambitoCalendarioEnum('ambito').notNull().default('EMPRESA'),
    /** Un festivo con `esLaborable` true abre un día que el calendario cerraba. */
    esLaborable: boolean('es_laborable').notNull().default(false),
    origen: origenFestivoEnum('origen').notNull().default('ADMIN'),
    createdAt,
  },
  (t) => [
    uniqueIndex('festivo_calendario_fecha_uq').on(t.calendarioId, t.fecha),
    index('festivo_calendario_idx').on(t.calendarioId, t.fecha),
  ],
)

export const excepcionCalendario = pgTable(
  'excepcion_calendario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarioId: uuid('calendario_id')
      .notNull()
      .references(() => calendario.id, { onDelete: 'cascade' }),
    fecha: date('fecha').notNull(),
    /** true abre el día (sábado puntual), false lo cierra (puente). */
    laborable: boolean('laborable').notNull(),
    motivo: text('motivo').notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex('excepcion_calendario_fecha_uq').on(t.calendarioId, t.fecha),
    index('excepcion_calendario_idx').on(t.calendarioId, t.fecha),
  ],
)

export const empleadoCalendario = pgTable(
  'empleado_calendario',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empleadoId: uuid('empleado_id')
      .notNull()
      .references(() => empleado.id, { onDelete: 'cascade' }),
    calendarioId: uuid('calendario_id')
      .notNull()
      .references(() => calendario.id, { onDelete: 'restrict' }),
    desde: date('desde').notNull(),
    hasta: date('hasta'),
    createdAt,
  },
  (t) => [
    index('empleado_calendario_empleado_idx').on(t.empleadoId, t.desde),
    check('empleado_calendario_rango_ck', sql`${t.hasta} is null or ${t.desde} <= ${t.hasta}`),
  ],
)

export const jornadaTeorica = pgTable(
  'jornada_teorica',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarioId: uuid('calendario_id')
      .notNull()
      .references(() => calendario.id, { onDelete: 'cascade' }),
    /** Null = jornada de referencia del calendario para toda la empresa. */
    empleadoId: uuid('empleado_id').references(() => empleado.id, { onDelete: 'cascade' }),
    desde: date('desde').notNull(),
    hasta: date('hasta'),
    horasSemanalesMin: integer('horas_semanales_min').notNull(),
    horasDiariasMin: integer('horas_diarias_min'),
    createdAt,
  },
  (t) => [
    index('jornada_teorica_calendario_idx').on(t.calendarioId, t.desde),
    index('jornada_teorica_empleado_idx').on(t.empleadoId, t.desde),
    check('jornada_teorica_rango_ck', sql`${t.hasta} is null or ${t.desde} <= ${t.hasta}`),
    check(
      'jornada_teorica_minutos_ck',
      sql`${t.horasSemanalesMin} > 0 and (${t.horasDiariasMin} is null or ${t.horasDiariasMin} > 0)`,
    ),
  ],
)

export const convenio = pgTable(
  'convenio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    codigo: text('codigo').notNull(),
    nombre: text('nombre').notNull(),
    activo: boolean('activo').notNull().default(true),
    /** Sube con cada cambio de reglas para que el parte cierre su snapshot. */
    version: integer('version').notNull().default(1),
    createdAt,
  },
  (t) => [
    uniqueIndex('convenio_empresa_codigo_uq').on(t.empresaId, t.codigo),
    index('convenio_empresa_idx').on(t.empresaId),
  ],
)

export const reglaComputo = pgTable(
  'regla_computo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    convenioId: uuid('convenio_id')
      .notNull()
      .references(() => convenio.id, { onDelete: 'cascade' }),
    tipoHora: tipoHoraEnum('tipo_hora').notNull(),
    /** Factor en puntos básicos: 10000 = 1,0; 15000 = 1,5. Nunca decimal. */
    factorBps: integer('factor_bps').notNull().default(10_000),
    aplicaEn: aplicaEnEnum('aplica_en').notNull().default('TODO'),
    /** Minutos por día con este factor; null = sin tope. */
    topeDiarioMin: integer('tope_diario_min'),
    /** Minutos por semana con este factor; null = sin tope. */
    topeSemanalMin: integer('tope_semanal_min'),
    requiereAutorizacion: boolean('requiere_autorizacion').notNull().default(false),
    /** Menor gana al elegir entre reglas aplicables. */
    prioridad: integer('prioridad').notNull().default(100),
    activo: boolean('activo').notNull().default(true),
    createdAt,
  },
  (t) => [
    uniqueIndex('regla_computo_convenio_tipo_uq').on(t.convenioId, t.tipoHora),
    check('regla_computo_factor_ck', sql`${t.factorBps} between 0 and 100000`),
    check(
      'regla_computo_topes_ck',
      sql`(${t.topeDiarioMin} is null or ${t.topeDiarioMin} > 0) and (${t.topeSemanalMin} is null or ${t.topeSemanalMin} > 0)`,
    ),
  ],
)

export const empleadoConvenio = pgTable(
  'empleado_convenio',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empleadoId: uuid('empleado_id')
      .notNull()
      .references(() => empleado.id, { onDelete: 'cascade' }),
    convenioId: uuid('convenio_id')
      .notNull()
      .references(() => convenio.id, { onDelete: 'restrict' }),
    desde: date('desde').notNull(),
    hasta: date('hasta'),
    createdAt,
  },
  (t) => [
    index('empleado_convenio_empleado_idx').on(t.empleadoId, t.desde),
    check('empleado_convenio_rango_ck', sql`${t.hasta} is null or ${t.desde} <= ${t.hasta}`),
  ],
)

export const parte = pgTable(
  'parte',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'restrict' }),
    empleadoId: uuid('empleado_id')
      .notNull()
      .references(() => empleado.id, { onDelete: 'restrict' }),
    isoYear: integer('iso_year').notNull(),
    isoWeek: integer('iso_week').notNull(),
    weekStart: date('week_start').notNull(),
    estado: estadoParteEnum('estado').notNull().default('BORRADOR'),
    totalMinutos: integer('total_minutos').notNull().default(0),
    version: integer('version').notNull().default(1),
    // Snapshot del calendario aplicado. Un parte cerrado no cambia de calendario
    // aunque después se editen festivos o excepciones.
    calendarioId: uuid('calendario_id').references(() => calendario.id, { onDelete: 'set null' }),
    calendarioVersion: integer('calendario_version'),
    enviadoAt: timestamp('enviado_at', { withTimezone: true }),
    revisadoPor: uuid('revisado_por').references(() => usuario.id, { onDelete: 'set null' }),
    revisadoAt: timestamp('revisado_at', { withTimezone: true }),
    motivoRechazo: text('motivo_rechazo'),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('parte_empleado_semana_uq').on(t.empleadoId, t.isoYear, t.isoWeek),
    index('parte_estado_semana_idx').on(t.estado, t.isoYear, t.isoWeek),
    index('parte_empresa_semana_idx').on(t.empresaId, t.isoYear, t.isoWeek),
    check('parte_semana_ck', sql`${t.isoWeek} between 1 and 53`),
    check('parte_total_ck', sql`${t.totalMinutos} >= 0`),
  ],
)

export const imputacion = pgTable(
  'imputacion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parteId: uuid('parte_id')
      .notNull()
      .references(() => parte.id, { onDelete: 'cascade' }),
    fecha: date('fecha').notNull(),
    tareaId: uuid('tarea_id')
      .notNull()
      .references(() => tarea.id, { onDelete: 'restrict' }),
    minutos: integer('minutos').notNull(),
    nota: text('nota'),
    createdAt,
  },
  (t) => [
    uniqueIndex('imputacion_parte_fecha_tarea_uq').on(t.parteId, t.fecha, t.tareaId),
    index('imputacion_parte_idx').on(t.parteId),
    index('imputacion_tarea_fecha_idx').on(t.tareaId, t.fecha),
    check('imputacion_minutos_ck', sql`${t.minutos} > 0 and ${t.minutos} <= 1440`),
  ],
)

/**
 * Snapshot de cómputo por imputación y tramo. Se escribe al aprobar el parte:
 * cambiar una regla después no altera semanas ya cerradas.
 */
export const resultadoComputo = pgTable(
  'resultado_computo',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parteId: uuid('parte_id')
      .notNull()
      .references(() => parte.id, { onDelete: 'cascade' }),
    imputacionId: uuid('imputacion_id')
      .notNull()
      .references(() => imputacion.id, { onDelete: 'cascade' }),
    /** Un mismo registro puede partirse por topes; 0, 1, 2... */
    tramo: integer('tramo').notNull().default(0),
    tipoHora: tipoHoraEnum('tipo_hora').notNull(),
    minutosBase: integer('minutos_base').notNull(),
    factorBps: integer('factor_bps').notNull(),
    minutosComputados: integer('minutos_computados').notNull(),
    requiereAutorizacion: boolean('requiere_autorizacion').notNull().default(false),
    reglaId: uuid('regla_id').references(() => reglaComputo.id, { onDelete: 'set null' }),
    convenioId: uuid('convenio_id').references(() => convenio.id, { onDelete: 'set null' }),
    convenioVersion: integer('convenio_version'),
    createdAt,
  },
  (t) => [
    uniqueIndex('resultado_computo_imputacion_tramo_uq').on(t.imputacionId, t.tramo),
    index('resultado_computo_parte_idx').on(t.parteId),
    check(
      'resultado_computo_minutos_ck',
      sql`${t.minutosBase} > 0 and ${t.minutosComputados} >= 0 and ${t.tramo} >= 0`,
    ),
  ],
)

export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => usuario.id, { onDelete: 'set null' }),
    entidad: text('entidad').notNull(),
    entidadId: text('entidad_id'),
    accion: text('accion').notNull(),
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    motivo: text('motivo'),
    createdAt,
  },
  (t) => [
    index('auditoria_created_idx').on(t.createdAt),
    index('auditoria_entidad_idx').on(t.entidad, t.entidadId),
  ],
)

export const notificacion = pgTable(
  'notificacion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresa.id, { onDelete: 'cascade' }),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    tipo: tipoNotificacionEnum('tipo').notNull(),
    titulo: text('titulo').notNull(),
    cuerpo: text('cuerpo').notNull(),
    url: text('url'),
    /** Evita duplicados al repetir el cron: usuario + evento + periodo. */
    claveIdempotencia: text('clave_idempotencia').notNull(),
    metadata: jsonb('metadata'),
    leidaAt: timestamp('leida_at', { withTimezone: true }),
    createdAt,
  },
  (t) => [
    uniqueIndex('notificacion_usuario_clave_uq').on(t.usuarioId, t.claveIdempotencia),
    index('notificacion_usuario_leida_idx').on(t.usuarioId, t.leidaAt),
    index('notificacion_empresa_created_idx').on(t.empresaId, t.createdAt),
  ],
)

export const empresaRelations = relations(empresa, ({ many }) => ({
  usuarios: many(usuario),
  proyectos: many(proyecto),
  empleados: many(empleado),
}))

export const proyectoRelations = relations(proyecto, ({ many }) => ({
  tareas: many(tarea),
}))

export const tareaRelations = relations(tarea, ({ one, many }) => ({
  proyecto: one(proyecto, { fields: [tarea.proyectoId], references: [proyecto.id] }),
  imputaciones: many(imputacion),
}))

export const parteRelations = relations(parte, ({ one, many }) => ({
  empleado: one(empleado, { fields: [parte.empleadoId], references: [empleado.id] }),
  imputaciones: many(imputacion),
}))

export const imputacionRelations = relations(imputacion, ({ one }) => ({
  parte: one(parte, { fields: [imputacion.parteId], references: [parte.id] }),
  tarea: one(tarea, { fields: [imputacion.tareaId], references: [tarea.id] }),
}))

export const calendarioRelations = relations(calendario, ({ many }) => ({
  festivos: many(festivo),
  excepciones: many(excepcionCalendario),
}))

export const convenioRelations = relations(convenio, ({ many }) => ({
  reglas: many(reglaComputo),
}))

export const resultadoComputoRelations = relations(resultadoComputo, ({ one }) => ({
  parte: one(parte, { fields: [resultadoComputo.parteId], references: [parte.id] }),
  imputacion: one(imputacion, { fields: [resultadoComputo.imputacionId], references: [imputacion.id] }),
}))

export type EstadoParte = (typeof estadoParteEnum.enumValues)[number]
export type Rol = (typeof rolEnum.enumValues)[number]
export type TipoNotificacion = (typeof tipoNotificacionEnum.enumValues)[number]
export type AmbitoCalendario = (typeof ambitoCalendarioEnum.enumValues)[number]
export type OrigenFestivo = (typeof origenFestivoEnum.enumValues)[number]
export type TipoHora = (typeof tipoHoraEnum.enumValues)[number]
export type AplicaEn = (typeof aplicaEnEnum.enumValues)[number]
