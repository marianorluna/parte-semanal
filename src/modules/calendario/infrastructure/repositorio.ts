import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  calendario,
  empleado,
  empleadoCalendario,
  excepcionCalendario,
  festivo,
  jornadaTeorica,
  parte,
} from '@/db/schema'
import { AppError } from '@/shared/errors'
import { semanaIsoDe, type FechaIso } from '@/modules/partes/domain/fechas'
import type {
  AsignacionCalendario,
  CalendarioCompleto,
  CalendarioResumen,
  RepositorioCalendario,
} from '../application/ports'

const columnasResumen = {
  id: calendario.id,
  empresaId: calendario.empresaId,
  nombre: calendario.nombre,
  ambito: calendario.ambito,
  codigo: calendario.codigo,
  comunidad: calendario.comunidad,
  diasSemana: calendario.diasSemana,
  horasDiariasMin: calendario.horasDiariasMin,
  vigenteDesde: calendario.vigenteDesde,
  vigenteHasta: calendario.vigenteHasta,
  esPredeterminado: calendario.esPredeterminado,
  activo: calendario.activo,
  version: calendario.version,
}

type FilaResumen = {
  id: string
  empresaId: string
  nombre: string
  ambito: CalendarioResumen['ambito']
  codigo: string
  comunidad: string | null
  diasSemana: number[]
  horasDiariasMin: number | null
  vigenteDesde: string
  vigenteHasta: string | null
  esPredeterminado: boolean
  activo: boolean
  version: number
}

function aResumen(fila: FilaResumen, festivos: number): CalendarioResumen {
  return { ...fila, festivos }
}

async function contarFestivos(ids: readonly string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const filas = await db
    .select({ calendarioId: festivo.calendarioId, total: count() })
    .from(festivo)
    .where(inArray(festivo.calendarioId, [...ids]))
    .groupBy(festivo.calendarioId)

  return new Map(filas.map((fila) => [fila.calendarioId, Number(fila.total)]))
}

async function cargarCompleto(id: string): Promise<CalendarioCompleto | null> {
  const filas = await db.select(columnasResumen).from(calendario).where(eq(calendario.id, id)).limit(1)
  const encontrado = filas[0]
  if (!encontrado) return null

  const [festivos, excepciones, jornadas] = await Promise.all([
    db
      .select({
        id: festivo.id,
        fecha: festivo.fecha,
        nombre: festivo.nombre,
        ambito: festivo.ambito,
        esLaborable: festivo.esLaborable,
        origen: festivo.origen,
      })
      .from(festivo)
      .where(eq(festivo.calendarioId, id))
      .orderBy(asc(festivo.fecha)),
    db
      .select({
        id: excepcionCalendario.id,
        fecha: excepcionCalendario.fecha,
        laborable: excepcionCalendario.laborable,
        motivo: excepcionCalendario.motivo,
      })
      .from(excepcionCalendario)
      .where(eq(excepcionCalendario.calendarioId, id))
      .orderBy(asc(excepcionCalendario.fecha)),
    db
      .select({
        id: jornadaTeorica.id,
        empleadoId: jornadaTeorica.empleadoId,
        desde: jornadaTeorica.desde,
        hasta: jornadaTeorica.hasta,
        horasSemanalesMin: jornadaTeorica.horasSemanalesMin,
        horasDiariasMin: jornadaTeorica.horasDiariasMin,
      })
      .from(jornadaTeorica)
      .where(eq(jornadaTeorica.calendarioId, id))
      .orderBy(asc(jornadaTeorica.desde)),
  ])

  return { ...encontrado, festivos, excepciones, jornadas }
}

/** Incrementa la versión del calendario para que los partes cierren su snapshot. */
async function subirVersion(calendarioId: string): Promise<number> {
  const filas = await db
    .update(calendario)
    .set({ version: sql`${calendario.version} + 1` })
    .where(eq(calendario.id, calendarioId))
    .returning({ version: calendario.version })

  const version = filas[0]?.version
  if (!version) throw new AppError('NO_ENCONTRADO', 'El calendario no existe')
  return version
}

export const repositorioCalendario: RepositorioCalendario = {
  async listar(empresaId) {
    const filas = await db
      .select(columnasResumen)
      .from(calendario)
      .where(eq(calendario.empresaId, empresaId))
      .orderBy(desc(calendario.esPredeterminado), asc(calendario.nombre))

    const conteos = await contarFestivos(filas.map((fila) => fila.id))
    return filas.map((fila) => aResumen(fila, conteos.get(fila.id) ?? 0))
  },

  async obtener(id) {
    return cargarCompleto(id)
  },

  async obtenerPredeterminado(empresaId) {
    const filas = await db
      .select({ id: calendario.id })
      .from(calendario)
      .where(
        and(
          eq(calendario.empresaId, empresaId),
          eq(calendario.activo, true),
          eq(calendario.esPredeterminado, true),
        ),
      )
      .limit(1)

    const encontrado = filas[0]
    return encontrado ? cargarCompleto(encontrado.id) : null
  },

  async calendarioDeEmpleado(empleadoId, fecha) {
    const asignaciones = await db
      .select({ calendarioId: empleadoCalendario.calendarioId })
      .from(empleadoCalendario)
      .where(
        and(
          eq(empleadoCalendario.empleadoId, empleadoId),
          lte(empleadoCalendario.desde, fecha),
          or(isNull(empleadoCalendario.hasta), gte(empleadoCalendario.hasta, fecha)),
        ),
      )
      .orderBy(desc(empleadoCalendario.desde))
      .limit(1)

    const asignado = asignaciones[0]
    if (asignado) {
      const completo = await cargarCompleto(asignado.calendarioId)
      if (completo && completo.activo) return completo
    }

    const empleadoFilas = await db
      .select({ empresaId: empleado.empresaId })
      .from(empleado)
      .where(eq(empleado.id, empleadoId))
      .limit(1)

    const empresaId = empleadoFilas[0]?.empresaId
    if (!empresaId) return null

    return this.obtenerPredeterminado(empresaId)
  },

  async crear(empresaId, datos) {
    const filas = await db
      .insert(calendario)
      .values({
        empresaId,
        nombre: datos.nombre,
        ambito: datos.ambito,
        codigo: datos.codigo,
        comunidad: datos.comunidad,
        diasSemana: datos.diasSemana,
        horasDiariasMin: datos.horasDiariasMin,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta,
        esPredeterminado: datos.esPredeterminado,
      })
      .onConflictDoNothing({ target: [calendario.empresaId, calendario.codigo] })
      .returning({ id: calendario.id })

    const creado = filas[0]
    if (!creado) {
      throw new AppError('VALIDACION', `Ya existe un calendario con el código ${datos.codigo}`, {
        codigo: 'Código duplicado',
      })
    }
    return creado.id
  },

  async actualizar(id, datos) {
    await db
      .update(calendario)
      .set({
        nombre: datos.nombre,
        ambito: datos.ambito,
        comunidad: datos.comunidad,
        diasSemana: datos.diasSemana,
        horasDiariasMin: datos.horasDiariasMin,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta,
        esPredeterminado: datos.esPredeterminado,
      })
      .where(eq(calendario.id, id))

    return subirVersion(id)
  },

  async alternar(id, activo) {
    await db.update(calendario).set({ activo }).where(eq(calendario.id, id))
    await subirVersion(id)
  },

  async crearFestivos(calendarioId, festivos) {
    if (festivos.length === 0) return 0

    const insertados = await db
      .insert(festivo)
      .values(
        festivos.map((dato) => ({
          calendarioId,
          fecha: dato.fecha,
          nombre: dato.nombre,
          ambito: dato.ambito,
          esLaborable: dato.esLaborable,
          origen: dato.origen ?? 'ADMIN',
        })),
      )
      .onConflictDoNothing({ target: [festivo.calendarioId, festivo.fecha] })
      .returning({ id: festivo.id })

    if (insertados.length > 0) await subirVersion(calendarioId)
    return insertados.length
  },

  async actualizarFestivo(calendarioId, festivoId, datos) {
    await db
      .update(festivo)
      .set({
        fecha: datos.fecha,
        nombre: datos.nombre,
        ambito: datos.ambito,
        esLaborable: datos.esLaborable,
      })
      .where(and(eq(festivo.id, festivoId), eq(festivo.calendarioId, calendarioId)))

    await subirVersion(calendarioId)
  },

  async eliminarFestivo(calendarioId, festivoId) {
    await db.delete(festivo).where(and(eq(festivo.id, festivoId), eq(festivo.calendarioId, calendarioId)))
    await subirVersion(calendarioId)
  },

  async crearExcepcion(calendarioId, datos) {
    await db
      .insert(excepcionCalendario)
      .values({
        calendarioId,
        fecha: datos.fecha,
        laborable: datos.laborable,
        motivo: datos.motivo,
      })
      .onConflictDoUpdate({
        target: [excepcionCalendario.calendarioId, excepcionCalendario.fecha],
        set: { laborable: datos.laborable, motivo: datos.motivo },
      })

    await subirVersion(calendarioId)
  },

  async eliminarExcepcion(calendarioId, excepcionId) {
    await db
      .delete(excepcionCalendario)
      .where(
        and(eq(excepcionCalendario.id, excepcionId), eq(excepcionCalendario.calendarioId, calendarioId)),
      )
    await subirVersion(calendarioId)
  },

  async crearJornada(calendarioId, datos) {
    await db.insert(jornadaTeorica).values({
      calendarioId,
      empleadoId: datos.empleadoId,
      desde: datos.desde,
      hasta: datos.hasta,
      horasSemanalesMin: datos.horasSemanalesMin,
      horasDiariasMin: datos.horasDiariasMin,
    })

    await subirVersion(calendarioId)
  },

  async eliminarJornada(calendarioId, jornadaId) {
    await db
      .delete(jornadaTeorica)
      .where(and(eq(jornadaTeorica.id, jornadaId), eq(jornadaTeorica.calendarioId, calendarioId)))
    await subirVersion(calendarioId)
  },

  async asignarEmpleado(empleadoId, calendarioId, desde) {
    await db.insert(empleadoCalendario).values({ empleadoId, calendarioId, desde })
  },

  async quitarAsignacion(asignacionId) {
    await db.delete(empleadoCalendario).where(eq(empleadoCalendario.id, asignacionId))
  },

  async listarAsignaciones(empresaId) {
    const filas: AsignacionCalendario[] = await db
      .select({
        id: empleadoCalendario.id,
        empleadoId: empleadoCalendario.empleadoId,
        empleadoNombre: empleado.nombre,
        empleadoCodigo: empleado.codigo,
        calendarioId: empleadoCalendario.calendarioId,
        calendarioNombre: calendario.nombre,
        desde: empleadoCalendario.desde,
        hasta: empleadoCalendario.hasta,
      })
      .from(empleadoCalendario)
      .innerJoin(empleado, eq(empleado.id, empleadoCalendario.empleadoId))
      .innerJoin(calendario, eq(calendario.id, empleadoCalendario.calendarioId))
      .where(eq(empleado.empresaId, empresaId))
      .orderBy(asc(empleado.nombre), desc(empleadoCalendario.desde))

    return filas
  },

  async contarPartesAprobadosEnFecha(calendarioId, fecha) {
    const semana = semanaIsoDe(fecha)

    const asignados = db
      .select({ empleadoId: empleadoCalendario.empleadoId })
      .from(empleadoCalendario)
      .where(eq(empleadoCalendario.calendarioId, calendarioId))

    const filas = await db
      .select({ total: count() })
      .from(parte)
      .where(
        and(
          eq(parte.estado, 'APROBADO'),
          eq(parte.weekStart, semana.weekStart),
          inArray(parte.empleadoId, asignados),
        ),
      )

    return Number(filas[0]?.total ?? 0)
  },

  async versionDe(calendarioId) {
    const filas = await db
      .select({ version: calendario.version })
      .from(calendario)
      .where(eq(calendario.id, calendarioId))
      .limit(1)

    return filas[0]?.version ?? null
  },

  async perteneceAEmpresa(calendarioId, empresaId) {
    const filas = await db
      .select({ id: calendario.id })
      .from(calendario)
      .where(and(eq(calendario.id, calendarioId), eq(calendario.empresaId, empresaId)))
      .limit(1)

    return filas.length > 0
  },
}

export type { FechaIso }
