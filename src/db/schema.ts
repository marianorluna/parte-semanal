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
export const tipoNotificacionEnum = pgEnum('tipo_notificacion', [
  'RECORDATORIO_PARTE',
  'EQUIPO_PENDIENTE',
  'RIESGO_PROYECTO',
])

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

export type EstadoParte = (typeof estadoParteEnum.enumValues)[number]
export type Rol = (typeof rolEnum.enumValues)[number]
export type TipoNotificacion = (typeof tipoNotificacionEnum.enumValues)[number]
