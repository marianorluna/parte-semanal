import { and, asc, count, desc, eq, exists, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { asignacion, auditoria, empleado, imputacion, parte, proyecto, tarea, usuario } from '@/db/schema'
import type { Rol } from '@/db/schema'
import { AppError } from '@/shared/errors'
import { registrarOutbox } from '@/modules/integraciones/infrastructure/outbox'
import type { FechaIso, SemanaIso } from '../domain/fechas'
import { esEditable } from '../domain/parte'
import type {
  FiltrosControl,
  ImputacionGuardada,
  ParteCompleto,
  ParteEnLista,
  ParteResumen,
  ResultadoControl,
  TareaAsignada,
} from '../application/ports'

const columnasResumen = {
  id: parte.id,
  empresaId: parte.empresaId,
  empleadoId: parte.empleadoId,
  isoYear: parte.isoYear,
  isoWeek: parte.isoWeek,
  weekStart: parte.weekStart,
  estado: parte.estado,
  totalMinutos: parte.totalMinutos,
  version: parte.version,
  enviadoAt: parte.enviadoAt,
  revisadoPor: parte.revisadoPor,
  revisadoAt: parte.revisadoAt,
  motivoRechazo: parte.motivoRechazo,
}

type FilaResumen = {
  id: string
  empresaId: string
  empleadoId: string
  isoYear: number
  isoWeek: number
  weekStart: string
  estado: ParteResumen['estado']
  totalMinutos: number
  version: number
  enviadoAt: Date | null
  revisadoPor: string | null
  revisadoAt: Date | null
  motivoRechazo: string | null
}

function aResumen(fila: FilaResumen): ParteResumen {
  return { ...fila, weekStart: fila.weekStart }
}

async function cargarImputaciones(parteIds: readonly string[]): Promise<Map<string, ImputacionGuardada[]>> {
  const mapa = new Map<string, ImputacionGuardada[]>()
  if (parteIds.length === 0) return mapa

  const filas = await db
    .select({
      parteId: imputacion.parteId,
      id: imputacion.id,
      fecha: imputacion.fecha,
      tareaId: imputacion.tareaId,
      minutos: imputacion.minutos,
      nota: imputacion.nota,
    })
    .from(imputacion)
    .where(inArray(imputacion.parteId, [...parteIds]))
    .orderBy(asc(imputacion.fecha), asc(imputacion.tareaId))

  for (const fila of filas) {
    const lista = mapa.get(fila.parteId) ?? []
    lista.push({
      id: fila.id,
      fecha: fila.fecha,
      tareaId: fila.tareaId,
      minutos: fila.minutos,
      nota: fila.nota,
    })
    mapa.set(fila.parteId, lista)
  }

  return mapa
}

function condicionProyectos(ids: string[] | null) {
  if (ids === null) return undefined
  if (ids.length === 0) return sql`false`
  return exists(
    db
      .select({ uno: sql`1` })
      .from(imputacion)
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .where(and(eq(imputacion.parteId, parte.id), inArray(tarea.proyectoId, ids))),
  )
}

/**
 * El encargado solo revisa partes cuyo empleado tiene una cuenta TRABAJADOR.
 * Sin cuenta (o con otra rol) el parte queda fuera de su bandeja.
 */
function condicionSoloTrabajadores() {
  return exists(
    db
      .select({ uno: sql`1` })
      .from(usuario)
      .where(and(eq(usuario.empleadoId, parte.empleadoId), eq(usuario.rol, 'TRABAJADOR'))),
  )
}

async function auditar(
  tx: typeof db,
  entrada: {
    actorId: string
    entidadId: string
    accion: string
    antes?: unknown
    despues?: unknown
    motivo?: string | null
  },
) {
  await tx.insert(auditoria).values({
    actorId: entrada.actorId,
    entidad: 'parte',
    entidadId: entrada.entidadId,
    accion: entrada.accion,
    antes: entrada.antes ?? null,
    despues: entrada.despues ?? null,
    motivo: entrada.motivo ?? null,
  })
}

export const repositorioPartes = {
  async buscarPorSemana(empleadoId: string, isoYear: number, isoWeek: number): Promise<ParteCompleto | null> {
    const filas = await db
      .select(columnasResumen)
      .from(parte)
      .where(and(eq(parte.empleadoId, empleadoId), eq(parte.isoYear, isoYear), eq(parte.isoWeek, isoWeek)))
      .limit(1)

    const encontrado = filas[0]
    if (!encontrado) return null

    const imputaciones = (await cargarImputaciones([encontrado.id])).get(encontrado.id) ?? []
    return { ...aResumen(encontrado), imputaciones }
  },

  async crearBorrador(empresaId: string, empleadoId: string, semana: SemanaIso): Promise<ParteCompleto> {
    const filas = await db
      .insert(parte)
      .values({
        empresaId,
        empleadoId,
        isoYear: semana.isoYear,
        isoWeek: semana.isoWeek,
        weekStart: semana.weekStart,
        estado: 'BORRADOR',
        totalMinutos: 0,
        version: 1,
      })
      .onConflictDoNothing({ target: [parte.empleadoId, parte.isoYear, parte.isoWeek] })
      .returning(columnasResumen)

    const creado = filas[0]
    if (creado) return { ...aResumen(creado), imputaciones: [] }

    const existente = await this.buscarPorSemana(empleadoId, semana.isoYear, semana.isoWeek)
    if (!existente) throw new AppError('ERROR_INTERNO', 'No se pudo crear el parte')
    return existente
  },

  async guardarBorrador(
    parteId: string,
    versionEsperada: number,
    filas: { fecha: FechaIso; tareaId: string; minutos: number }[],
  ): Promise<number> {
    let nuevaVersion = versionEsperada + 1

    await db.transaction(async (tx) => {
      const actual = (await tx.select({ estado: parte.estado, version: parte.version }).from(parte).where(eq(parte.id, parteId)).limit(1))[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
      if (!esEditable(actual.estado)) {
        throw new AppError('ESTADO_INVALIDO', 'Solo se pueden editar borradores o partes rechazados')
      }
      if (actual.version !== versionEsperada) {
        throw new AppError('CONFLICTO_VERSION', 'El parte ha cambiado. Recarga la página y vuelve a intentarlo')
      }

      await tx.delete(imputacion).where(eq(imputacion.parteId, parteId))

      if (filas.length > 0) {
        await tx.insert(imputacion).values(
          filas.map((fila) => ({
            parteId,
            fecha: fila.fecha,
            tareaId: fila.tareaId,
            minutos: fila.minutos,
          })),
        )
      }

      const total = filas.reduce((suma, fila) => suma + fila.minutos, 0)

      await tx
        .update(parte)
        .set({ totalMinutos: total, version: actual.version + 1, updatedAt: new Date() })
        .where(eq(parte.id, parteId))

      nuevaVersion = actual.version + 1
    })

    return nuevaVersion
  },

  async enviar(
    parteId: string,
    versionEsperada: number,
    actorId: string,
    calendario?: { id: string | null; version: number | null },
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const actual = (await tx.select().from(parte).where(eq(parte.id, parteId)).limit(1))[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
      if (actual.version !== versionEsperada) {
        throw new AppError('CONFLICTO_VERSION', 'El parte ha cambiado. Recarga la página')
      }
      if (!esEditable(actual.estado)) {
        throw new AppError('ESTADO_INVALIDO', 'Este parte ya está enviado')
      }
      if (actual.totalMinutos <= 0) {
        throw new AppError('VALIDACION', 'No puedes enviar un parte sin horas')
      }

      await tx
        .update(parte)
        .set({
          estado: 'ENVIADO',
          version: actual.version + 1,
          enviadoAt: new Date(),
          updatedAt: new Date(),
          motivoRechazo: null,
          calendarioId: calendario?.id ?? actual.calendarioId,
          calendarioVersion: calendario?.version ?? actual.calendarioVersion,
        })
        .where(eq(parte.id, parteId))

      await auditar(tx as unknown as typeof db, {
        actorId,
        entidadId: parteId,
        accion: 'ENVIAR_PARTE',
        antes: { estado: actual.estado, totalMinutos: actual.totalMinutos },
        despues: {
          estado: 'ENVIADO',
          calendarioId: calendario?.id ?? actual.calendarioId,
          calendarioVersion: calendario?.version ?? actual.calendarioVersion,
        },
      })

      await registrarOutbox(tx as unknown as typeof db, {
        empresaId: actual.empresaId,
        parteId,
        evento: 'parte.enviado',
        isoYear: actual.isoYear,
        isoWeek: actual.isoWeek,
        empleadoId: actual.empleadoId,
        estado: 'ENVIADO',
        actorId,
      })
    })
  },

  async aprobar(parteId: string, versionEsperada: number, actorId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const actual = (await tx.select().from(parte).where(eq(parte.id, parteId)).limit(1))[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
      if (actual.version !== versionEsperada) {
        throw new AppError('CONFLICTO_VERSION', 'El parte ha cambiado. Recarga la página')
      }
      if (actual.estado !== 'ENVIADO') {
        throw new AppError('ESTADO_INVALIDO', 'Solo se pueden aprobar partes enviados')
      }

      await tx
        .update(parte)
        .set({
          estado: 'APROBADO',
          version: actual.version + 1,
          revisadoPor: actorId,
          revisadoAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(parte.id, parteId))

      await auditar(tx as unknown as typeof db, {
        actorId,
        entidadId: parteId,
        accion: 'APROBAR_PARTE',
        antes: { estado: actual.estado },
        despues: { estado: 'APROBADO' },
      })

      await registrarOutbox(tx as unknown as typeof db, {
        empresaId: actual.empresaId,
        parteId,
        evento: 'parte.aprobado',
        isoYear: actual.isoYear,
        isoWeek: actual.isoWeek,
        empleadoId: actual.empleadoId,
        estado: 'APROBADO',
        actorId,
      })
    })
  },

  async rechazar(parteId: string, versionEsperada: number, actorId: string, motivo: string): Promise<void> {
    await db.transaction(async (tx) => {
      const actual = (await tx.select().from(parte).where(eq(parte.id, parteId)).limit(1))[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
      if (actual.version !== versionEsperada) {
        throw new AppError('CONFLICTO_VERSION', 'El parte ha cambiado. Recarga la página')
      }
      if (actual.estado !== 'ENVIADO') {
        throw new AppError('ESTADO_INVALIDO', 'Solo se pueden rechazar partes enviados')
      }

      await tx
        .update(parte)
        .set({
          estado: 'RECHAZADO',
          version: actual.version + 1,
          revisadoPor: actorId,
          revisadoAt: new Date(),
          motivoRechazo: motivo,
          updatedAt: new Date(),
        })
        .where(eq(parte.id, parteId))

      await auditar(tx as unknown as typeof db, {
        actorId,
        entidadId: parteId,
        accion: 'RECHAZAR_PARTE',
        antes: { estado: actual.estado },
        despues: { estado: 'RECHAZADO' },
        motivo,
      })

      await registrarOutbox(tx as unknown as typeof db, {
        empresaId: actual.empresaId,
        parteId,
        evento: 'parte.rechazado',
        isoYear: actual.isoYear,
        isoWeek: actual.isoWeek,
        empleadoId: actual.empleadoId,
        estado: 'RECHAZADO',
        actorId,
        motivo,
      })
    })
  },

  async reabrir(parteId: string, versionEsperada: number, actorId: string, motivo: string): Promise<void> {
    await db.transaction(async (tx) => {
      const actual = (await tx.select().from(parte).where(eq(parte.id, parteId)).limit(1))[0]
      if (!actual) throw new AppError('NO_ENCONTRADO', 'El parte no existe')
      if (actual.version !== versionEsperada) {
        throw new AppError('CONFLICTO_VERSION', 'El parte ha cambiado. Recarga la página')
      }
      if (actual.estado === 'BLOQUEADO') {
        throw new AppError(
          'ESTADO_INVALIDO',
          'El periodo está cerrado. Reábrelo en Administración > Cierres antes de reabrir el parte',
        )
      }
      if (actual.estado !== 'APROBADO' && actual.estado !== 'ENVIADO') {
        throw new AppError('ESTADO_INVALIDO', 'Solo se pueden reabrir partes enviados o aprobados')
      }

      await tx
        .update(parte)
        .set({ estado: 'BORRADOR', version: actual.version + 1, updatedAt: new Date() })
        .where(eq(parte.id, parteId))

      await auditar(tx as unknown as typeof db, {
        actorId,
        entidadId: parteId,
        accion: 'REABRIR_PARTE',
        antes: { estado: actual.estado },
        despues: { estado: 'BORRADOR' },
        motivo,
      })

      await registrarOutbox(tx as unknown as typeof db, {
        empresaId: actual.empresaId,
        parteId,
        evento: 'parte.reabierto',
        isoYear: actual.isoYear,
        isoWeek: actual.isoWeek,
        empleadoId: actual.empleadoId,
        estado: 'BORRADOR',
        actorId,
        motivo,
      })
    })
  },

  async obtenerDetalle(parteId: string): Promise<ParteCompleto | null> {
    const filas = await db.select(columnasResumen).from(parte).where(eq(parte.id, parteId)).limit(1)
    const encontrado = filas[0]
    if (!encontrado) return null
    const imputaciones = (await cargarImputaciones([encontrado.id])).get(encontrado.id) ?? []
    return { ...aResumen(encontrado), imputaciones }
  },

  async tareasAsignadas(empleadoId: string, desde: FechaIso, hasta: FechaIso): Promise<TareaAsignada[]> {
    return db
      .select({
        proyectoId: proyecto.id,
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        tareaId: tarea.id,
        tareaCodigo: tarea.codigo,
        tareaNombre: tarea.nombre,
      })
      .from(asignacion)
      .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
      .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
      .where(
        and(
          eq(asignacion.empleadoId, empleadoId),
          eq(asignacion.activa, true),
          eq(tarea.activa, true),
          eq(proyecto.activo, true),
          lte(asignacion.desde, hasta),
          or(isNull(asignacion.hasta), gte(asignacion.hasta, desde)),
        ),
      )
      .orderBy(asc(proyecto.codigo), asc(tarea.codigo))
  },

  async tareasPorIds(ids: string[]): Promise<TareaAsignada[]> {
    if (ids.length === 0) return []
    return db
      .select({
        proyectoId: proyecto.id,
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        tareaId: tarea.id,
        tareaCodigo: tarea.codigo,
        tareaNombre: tarea.nombre,
      })
      .from(tarea)
      .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
      .where(inArray(tarea.id, ids))
      .orderBy(asc(proyecto.codigo), asc(tarea.codigo))
  },

  async listarParaControl(filtros: FiltrosControl): Promise<ResultadoControl> {
    const condiciones = [eq(parte.empresaId, filtros.empresaId), eq(parte.isoYear, filtros.isoYear), eq(parte.isoWeek, filtros.isoWeek)]

    if (filtros.estado) condiciones.push(eq(parte.estado, filtros.estado))
    if (filtros.empleadoId) condiciones.push(eq(parte.empleadoId, filtros.empleadoId))
    if (filtros.soloTrabajadores) condiciones.push(condicionSoloTrabajadores())

    const porProyecto = filtros.proyectoId
      ? condicionProyectos([filtros.proyectoId])
      : condicionProyectos(filtros.proyectosPermitidos)
    if (porProyecto) condiciones.push(porProyecto)

    const donde = and(...condiciones)

    const filas = await db
      .select({
        ...columnasResumen,
        empleadoNombre: empleado.nombre,
        empleadoCodigo: empleado.codigo,
        revisadoPorNombre: usuario.nombre,
      })
      .from(parte)
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .leftJoin(usuario, eq(usuario.id, parte.revisadoPor))
      .where(donde)
      .orderBy(desc(parte.totalMinutos), asc(empleado.nombre))
      .limit(filtros.porPagina)
      .offset((filtros.pagina - 1) * filtros.porPagina)

    const agregados = await db
      .select({
        total: count(),
        minutos: sql<number>`coalesce(sum(${parte.totalMinutos}), 0)`.mapWith(Number),
      })
      .from(parte)
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .where(donde)

    return {
      filas: filas.map((fila) => ({ ...aResumen(fila), empleadoNombre: fila.empleadoNombre, empleadoCodigo: fila.empleadoCodigo, revisadoPorNombre: fila.revisadoPorNombre })),
      total: Number(agregados[0]?.total ?? 0),
      totalMinutos: Number(agregados[0]?.minutos ?? 0),
    }
  },

  async contarPendientes(
    empresaId: string,
    proyectosPermitidos: string[] | null,
    opciones: { soloTrabajadores?: boolean } = {},
  ): Promise<number> {
    const condiciones = [eq(parte.empresaId, empresaId), eq(parte.estado, 'ENVIADO')]
    const porProyecto = condicionProyectos(proyectosPermitidos)
    if (porProyecto) condiciones.push(porProyecto)
    if (opciones.soloTrabajadores) condiciones.push(condicionSoloTrabajadores())

    const filas = await db.select({ total: count() }).from(parte).where(and(...condiciones))
    return Number(filas[0]?.total ?? 0)
  },

  async rolDeEmpleado(empleadoId: string): Promise<Rol | null> {
    const filas = await db
      .select({ rol: usuario.rol })
      .from(usuario)
      .where(eq(usuario.empleadoId, empleadoId))
      .limit(1)

    return filas[0]?.rol ?? null
  },

  async proyectosDeEmpleado(empleadoId: string): Promise<string[]> {
    const filas = await db
      .selectDistinct({ proyectoId: tarea.proyectoId })
      .from(asignacion)
      .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
      .where(and(eq(asignacion.empleadoId, empleadoId), eq(asignacion.activa, true)))

    return filas.map((fila) => fila.proyectoId)
  },
}

export type { ParteEnLista }
