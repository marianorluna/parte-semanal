import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  convenio,
  empleado,
  empleadoConvenio,
  imputacion,
  parte,
  reglaComputo,
  resultadoComputo,
} from '@/db/schema'
import { AppError } from '@/shared/errors'
import type {
  AsignacionConvenio,
  ConvenioCompleto,
  ConvenioResumen,
  DatosConvenio,
  DatosRegla,
  ParteParaComputo,
  RepositorioComputo,
  ResultadoGuardado,
} from '../application/ports'
import type { TramoCalculado } from '../domain/reglas'

const columnasConvenio = {
  id: convenio.id,
  empresaId: convenio.empresaId,
  codigo: convenio.codigo,
  nombre: convenio.nombre,
  activo: convenio.activo,
  version: convenio.version,
}

async function cargarReglas(convenioId: string): Promise<ConvenioCompleto['reglas']> {
  return db
    .select({
      id: reglaComputo.id,
      convenioId: reglaComputo.convenioId,
      tipoHora: reglaComputo.tipoHora,
      factorBps: reglaComputo.factorBps,
      aplicaEn: reglaComputo.aplicaEn,
      topeDiarioMin: reglaComputo.topeDiarioMin,
      topeSemanalMin: reglaComputo.topeSemanalMin,
      requiereAutorizacion: reglaComputo.requiereAutorizacion,
      prioridad: reglaComputo.prioridad,
      activo: reglaComputo.activo,
    })
    .from(reglaComputo)
    .where(eq(reglaComputo.convenioId, convenioId))
    .orderBy(asc(reglaComputo.prioridad), asc(reglaComputo.tipoHora))
}

async function cargarConvenio(id: string): Promise<ConvenioCompleto | null> {
  const filas = await db.select(columnasConvenio).from(convenio).where(eq(convenio.id, id)).limit(1)
  const encontrado = filas[0]
  if (!encontrado) return null

  return { ...encontrado, reglas: await cargarReglas(id) }
}

async function subirVersion(convenioId: string): Promise<number> {
  const filas = await db
    .update(convenio)
    .set({ version: sql`${convenio.version} + 1` })
    .where(eq(convenio.id, convenioId))
    .returning({ version: convenio.version })

  const version = filas[0]?.version
  if (!version) throw new AppError('NO_ENCONTRADO', 'El convenio no existe')
  return version
}

export const repositorioComputo: RepositorioComputo = {
  async listar(empresaId): Promise<ConvenioResumen[]> {
    const filas = await db
      .select(columnasConvenio)
      .from(convenio)
      .where(eq(convenio.empresaId, empresaId))
      .orderBy(desc(convenio.activo), asc(convenio.nombre))

    if (filas.length === 0) return []

    const conteos = await db
      .select({ convenioId: reglaComputo.convenioId, total: count() })
      .from(reglaComputo)
      .where(inArray(reglaComputo.convenioId, filas.map((fila) => fila.id)))
      .groupBy(reglaComputo.convenioId)

    const mapa = new Map(conteos.map((fila) => [fila.convenioId, Number(fila.total)]))
    return filas.map((fila) => ({ ...fila, numeroReglas: mapa.get(fila.id) ?? 0 }))
  },

  async obtener(id) {
    return cargarConvenio(id)
  },

  async crear(empresaId, datos: DatosConvenio) {
    const filas = await db
      .insert(convenio)
      .values({ empresaId, codigo: datos.codigo, nombre: datos.nombre })
      .onConflictDoNothing({ target: [convenio.empresaId, convenio.codigo] })
      .returning({ id: convenio.id })

    const creado = filas[0]
    if (!creado) {
      throw new AppError('VALIDACION', `Ya existe un convenio con el código ${datos.codigo}`, {
        codigo: 'Código duplicado',
      })
    }
    return creado.id
  },

  async actualizar(id, datos) {
    await db.update(convenio).set({ codigo: datos.codigo, nombre: datos.nombre }).where(eq(convenio.id, id))
    return subirVersion(id)
  },

  async alternar(id, activo) {
    await db.update(convenio).set({ activo }).where(eq(convenio.id, id))
    await subirVersion(id)
  },

  async guardarRegla(convenioId, datos: DatosRegla) {
    await db
      .insert(reglaComputo)
      .values({ convenioId, ...datos })
      .onConflictDoUpdate({
        target: [reglaComputo.convenioId, reglaComputo.tipoHora],
        set: {
          factorBps: datos.factorBps,
          aplicaEn: datos.aplicaEn,
          topeDiarioMin: datos.topeDiarioMin,
          topeSemanalMin: datos.topeSemanalMin,
          requiereAutorizacion: datos.requiereAutorizacion,
          prioridad: datos.prioridad,
          activo: true,
        },
      })

    await subirVersion(convenioId)
  },

  async eliminarRegla(convenioId, reglaId) {
    await db
      .delete(reglaComputo)
      .where(and(eq(reglaComputo.id, reglaId), eq(reglaComputo.convenioId, convenioId)))
    await subirVersion(convenioId)
  },

  async listarAsignaciones(empresaId): Promise<AsignacionConvenio[]> {
    return db
      .select({
        id: empleadoConvenio.id,
        empleadoId: empleadoConvenio.empleadoId,
        empleadoNombre: empleado.nombre,
        empleadoCodigo: empleado.codigo,
        convenioId: empleadoConvenio.convenioId,
        convenioNombre: convenio.nombre,
        desde: empleadoConvenio.desde,
        hasta: empleadoConvenio.hasta,
      })
      .from(empleadoConvenio)
      .innerJoin(empleado, eq(empleado.id, empleadoConvenio.empleadoId))
      .innerJoin(convenio, eq(convenio.id, empleadoConvenio.convenioId))
      .where(eq(empleado.empresaId, empresaId))
      .orderBy(asc(empleado.nombre), desc(empleadoConvenio.desde))
  },

  async asignarEmpleado(empleadoId, convenioId, desde) {
    await db.insert(empleadoConvenio).values({ empleadoId, convenioId, desde })
  },

  async quitarAsignacion(asignacionId) {
    await db.delete(empleadoConvenio).where(eq(empleadoConvenio.id, asignacionId))
  },

  async convenioDeEmpleado(empleadoId, fecha) {
    const filas = await db
      .select({ convenioId: empleadoConvenio.convenioId })
      .from(empleadoConvenio)
      .where(
        and(
          eq(empleadoConvenio.empleadoId, empleadoId),
          lte(empleadoConvenio.desde, fecha),
          or(isNull(empleadoConvenio.hasta), gte(empleadoConvenio.hasta, fecha)),
        ),
      )
      .orderBy(desc(empleadoConvenio.desde))
      .limit(1)

    const asignado = filas[0]
    if (!asignado) return null

    const completo = await cargarConvenio(asignado.convenioId)
    return completo?.activo ? completo : null
  },

  async perteneceAEmpresa(convenioId, empresaId) {
    const filas = await db
      .select({ id: convenio.id })
      .from(convenio)
      .where(and(eq(convenio.id, convenioId), eq(convenio.empresaId, empresaId)))
      .limit(1)

    return filas.length > 0
  },

  async obtenerParte(parteId): Promise<ParteParaComputo | null> {
    const filas = await db
      .select({
        id: parte.id,
        empleadoId: parte.empleadoId,
        weekStart: parte.weekStart,
        estado: parte.estado,
      })
      .from(parte)
      .where(eq(parte.id, parteId))
      .limit(1)

    const cabecera = filas[0]
    if (!cabecera) return null

    const lineas = await db
      .select({ id: imputacion.id, fecha: imputacion.fecha, minutos: imputacion.minutos })
      .from(imputacion)
      .where(eq(imputacion.parteId, parteId))
      .orderBy(asc(imputacion.fecha), asc(imputacion.id))

    return { ...cabecera, imputaciones: lineas }
  },

  async guardarResultados(parteId, convenio, tramos) {
    await db.transaction(async (tx) => {
      await tx.delete(resultadoComputo).where(eq(resultadoComputo.parteId, parteId))

      if (tramos.length === 0) return

      await tx.insert(resultadoComputo).values(
        tramos.map((tramo) => ({
          parteId,
          imputacionId: tramo.imputacionId,
          tramo: tramo.tramo,
          tipoHora: tramo.tipoHora,
          minutosBase: tramo.minutosBase,
          factorBps: tramo.factorBps,
          minutosComputados: tramo.minutosComputados,
          requiereAutorizacion: tramo.requiereAutorizacion,
          reglaId: tramo.reglaId,
          convenioId: convenio?.id ?? null,
          convenioVersion: convenio?.version ?? null,
        })),
      )
    })
  },

  async resultadosDeParte(parteId): Promise<ResultadoGuardado[]> {
    const filas = await db
      .select({
        resultadoId: resultadoComputo.id,
        parteId: resultadoComputo.parteId,
        imputacionId: resultadoComputo.imputacionId,
        tramo: resultadoComputo.tramo,
        tipoHora: resultadoComputo.tipoHora,
        minutosBase: resultadoComputo.minutosBase,
        factorBps: resultadoComputo.factorBps,
        minutosComputados: resultadoComputo.minutosComputados,
        requiereAutorizacion: resultadoComputo.requiereAutorizacion,
        reglaId: resultadoComputo.reglaId,
        convenioId: resultadoComputo.convenioId,
        convenioVersion: resultadoComputo.convenioVersion,
      })
      .from(resultadoComputo)
      .where(eq(resultadoComputo.parteId, parteId))
      .orderBy(asc(resultadoComputo.imputacionId), asc(resultadoComputo.tramo))

    return filas
  },

  async borrarResultados(parteId) {
    await db.delete(resultadoComputo).where(eq(resultadoComputo.parteId, parteId))
  },

  async contarPartesConResultados(convenioId) {    const filas = await db
      .select({ total: count() })
      .from(resultadoComputo)
      .where(eq(resultadoComputo.convenioId, convenioId))

    return Number(filas[0]?.total ?? 0)
  },
}

export type { TramoCalculado }
