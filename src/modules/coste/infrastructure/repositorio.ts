import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  costeHora,
  costeImputacion,
  empleado,
  imputacion,
  parte,
  presupuestoProyecto,
  proyecto,
  resultadoComputo,
  tarea,
} from '@/db/schema'
import { AppError } from '@/shared/errors'
import type {
  CosteCalculado,
  CosteGuardado,
  DatosPresupuesto,
  DatosTarifa,
  EjecucionProyecto,
  FiltroInformeCoste,
  LineaInformeCoste,
  ParteParaCoste,
  PresupuestoListado,
  RepositorioCoste,
  TarifaListada,
} from '../application/ports'
import type { TarifaCoste } from '../domain/coste'
import { type Fecha } from '../domain/coste'

const columnasTarifa = {
  id: costeHora.id,
  empleadoId: costeHora.empleadoId,
  categoria: costeHora.categoria,
  importeHoraCents: costeHora.importeHoraCents,
  desde: costeHora.desde,
  hasta: costeHora.hasta,
  activo: costeHora.activo,
}

function ambitoTarifa(datos: DatosTarifa) {
  if (datos.empleadoId) return eq(costeHora.empleadoId, datos.empleadoId)
  return and(isNull(costeHora.empleadoId), eq(costeHora.categoria, datos.categoria?.trim() ?? ''))
}

export const repositorioCoste: RepositorioCoste = {
  async listarTarifas(empresaId): Promise<TarifaListada[]> {
    return db
      .select({
        ...columnasTarifa,
        empleadoNombre: empleado.nombre,
        empleadoCodigo: empleado.codigo,
      })
      .from(costeHora)
      .leftJoin(empleado, eq(empleado.id, costeHora.empleadoId))
      .where(eq(costeHora.empresaId, empresaId))
      .orderBy(desc(costeHora.activo), desc(costeHora.desde), asc(costeHora.categoria))
  },

  async tarifasActivas(empresaId): Promise<TarifaCoste[]> {
    return db
      .select(columnasTarifa)
      .from(costeHora)
      .where(and(eq(costeHora.empresaId, empresaId), eq(costeHora.activo, true)))
      .orderBy(asc(costeHora.desde))
  },

  async crearTarifa(empresaId, datos: DatosTarifa) {
    const filas = await db
      .insert(costeHora)
      .values({
        empresaId,
        empleadoId: datos.empleadoId,
        categoria: datos.empleadoId ? null : datos.categoria?.trim() || null,
        importeHoraCents: datos.importeHoraCents,
        desde: datos.desde,
        hasta: datos.hasta,
        activo: datos.activo,
      })
      .returning({ id: costeHora.id })

    const creada = filas[0]
    if (!creada) throw new AppError('NO_ENCONTRADO', 'No se pudo crear la tarifa')
    return creada.id
  },

  async actualizarTarifa(id, datos: DatosTarifa) {
    await db
      .update(costeHora)
      .set({
        empleadoId: datos.empleadoId,
        categoria: datos.empleadoId ? null : datos.categoria?.trim() || null,
        importeHoraCents: datos.importeHoraCents,
        desde: datos.desde,
        hasta: datos.hasta,
        activo: datos.activo,
      })
      .where(eq(costeHora.id, id))
  },

  async eliminarTarifa(id) {
    await db.delete(costeHora).where(eq(costeHora.id, id))
  },

  async existeSolape(empresaId, datos, excluirId) {
    const condiciones = [
      eq(costeHora.empresaId, empresaId),
      eq(costeHora.activo, true),
      ambitoTarifa(datos),
      or(isNull(costeHora.hasta), gte(costeHora.hasta, datos.desde)),
    ]

    if (datos.hasta !== null) condiciones.push(lte(costeHora.desde, datos.hasta))
    if (excluirId) condiciones.push(ne(costeHora.id, excluirId))

    const filas = await db
      .select({ id: costeHora.id })
      .from(costeHora)
      .where(and(...condiciones))
      .limit(1)

    return filas.length > 0
  },

  async perteneceTarifaAEmpresa(tarifaId, empresaId) {
    const filas = await db
      .select({ id: costeHora.id })
      .from(costeHora)
      .where(and(eq(costeHora.id, tarifaId), eq(costeHora.empresaId, empresaId)))
      .limit(1)

    return filas.length > 0
  },

  async listarPresupuestos(empresaId): Promise<PresupuestoListado[]> {
    return db
      .select({
        id: presupuestoProyecto.id,
        proyectoId: presupuestoProyecto.proyectoId,
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        version: presupuestoProyecto.version,
        importeCents: presupuestoProyecto.importeCents,
        horasPresupuesto: presupuestoProyecto.horasPresupuesto,
        motivo: presupuestoProyecto.motivo,
        createdAt: presupuestoProyecto.createdAt,
      })
      .from(presupuestoProyecto)
      .innerJoin(proyecto, eq(proyecto.id, presupuestoProyecto.proyectoId))
      .where(eq(proyecto.empresaId, empresaId))
      .orderBy(asc(proyecto.codigo), desc(presupuestoProyecto.version))
  },

  async crearPresupuesto(proyectoId, datos: DatosPresupuesto, creadoPor) {
    return db.transaction(async (tx) => {
      const versiones = await tx
        .select({ maxima: sql<number>`coalesce(max(${presupuestoProyecto.version}), 0)` })
        .from(presupuestoProyecto)
        .where(eq(presupuestoProyecto.proyectoId, proyectoId))

      const version = Number(versiones[0]?.maxima ?? 0) + 1

      const filas = await tx
        .insert(presupuestoProyecto)
        .values({
          proyectoId,
          version,
          importeCents: datos.importeCents,
          horasPresupuesto: datos.horasPresupuesto,
          motivo: datos.motivo,
          creadoPor,
        })
        .returning({ version: presupuestoProyecto.version })

      const creada = filas[0]
      if (!creada) throw new AppError('NO_ENCONTRADO', 'No se pudo crear el presupuesto')
      return creada.version
    })
  },

  async proyectoPerteneceAEmpresa(proyectoId, empresaId) {
    const filas = await db
      .select({ id: proyecto.id })
      .from(proyecto)
      .where(and(eq(proyecto.id, proyectoId), eq(proyecto.empresaId, empresaId)))
      .limit(1)

    return filas.length > 0
  },

  async parteParaCoste(parteId): Promise<ParteParaCoste | null> {
    const cabeceras = await db
      .select({
        id: parte.id,
        empresaId: parte.empresaId,
        empleadoId: parte.empleadoId,
        estado: parte.estado,
        empleadoCategoria: empleado.categoria,
      })
      .from(parte)
      .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
      .where(eq(parte.id, parteId))
      .limit(1)

    const cabecera = cabeceras[0]
    if (!cabecera) return null

    const lineas = await db
      .select({
        imputacionId: imputacion.id,
        fecha: imputacion.fecha,
        minutosBase: imputacion.minutos,
        tareaId: tarea.id,
        proyectoId: tarea.proyectoId,
      })
      .from(imputacion)
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .where(eq(imputacion.parteId, parteId))
      .orderBy(asc(imputacion.fecha), asc(imputacion.id))

    const computados = await db
      .select({
        imputacionId: resultadoComputo.imputacionId,
        minutos: sql<number>`coalesce(sum(${resultadoComputo.minutosComputados}), 0)`.mapWith(Number),
      })
      .from(resultadoComputo)
      .where(eq(resultadoComputo.parteId, parteId))
      .groupBy(resultadoComputo.imputacionId)

    const porImputacion = new Map(computados.map((fila) => [fila.imputacionId, fila.minutos]))

    return {
      id: cabecera.id,
      empresaId: cabecera.empresaId,
      empleadoId: cabecera.empleadoId,
      empleadoCategoria: cabecera.empleadoCategoria,
      estado: cabecera.estado,
      lineas: lineas.map((linea) => ({
        ...linea,
        minutos: porImputacion.get(linea.imputacionId) ?? linea.minutosBase,
      })),
    }
  },

  async guardarCostes(parteId, lineas: readonly CosteCalculado[]) {
    await db.transaction(async (tx) => {
      await tx.delete(costeImputacion).where(eq(costeImputacion.parteId, parteId))
      if (lineas.length === 0) return

      const cabeceras = await tx
        .select({ empleadoId: parte.empleadoId })
        .from(parte)
        .where(eq(parte.id, parteId))
        .limit(1)

      const empleadoId = cabeceras[0]?.empleadoId
      if (!empleadoId) throw new AppError('NO_ENCONTRADO', 'El parte no existe')

      await tx.insert(costeImputacion).values(
        lineas.map((linea) => ({
          parteId,
          imputacionId: linea.imputacionId,
          empleadoId,
          tareaId: linea.tareaId,
          proyectoId: linea.proyectoId,
          fecha: linea.fecha,
          minutos: linea.minutos,
          costeHoraCents: linea.costeHoraCents,
          importeCents: linea.importeCents,
          sinTarifa: linea.sinTarifa,
          tarifaId: linea.tarifaId,
        })),
      )
    })
  },

  async borrarCostesDeParte(parteId) {
    await db.delete(costeImputacion).where(eq(costeImputacion.parteId, parteId))
  },

  async costesDeParte(parteId): Promise<CosteGuardado[]> {
    return db
      .select({
        id: costeImputacion.id,
        imputacionId: costeImputacion.imputacionId,
        fecha: costeImputacion.fecha,
        minutos: costeImputacion.minutos,
        costeHoraCents: costeImputacion.costeHoraCents,
        importeCents: costeImputacion.importeCents,
        sinTarifa: costeImputacion.sinTarifa,
        tarifaId: costeImputacion.tarifaId,
        proyectoId: costeImputacion.proyectoId,
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        tareaNombre: tarea.nombre,
      })
      .from(costeImputacion)
      .innerJoin(proyecto, eq(proyecto.id, costeImputacion.proyectoId))
      .innerJoin(tarea, eq(tarea.id, costeImputacion.tareaId))
      .where(eq(costeImputacion.parteId, parteId))
      .orderBy(asc(costeImputacion.fecha), asc(proyecto.codigo))
  },

  async ejecucionProyectos(empresaId, permitidos): Promise<EjecucionProyecto[]> {
    const condiciones = [eq(proyecto.empresaId, empresaId)]
    if (permitidos !== null) {
      if (permitidos.length === 0) return []
      condiciones.push(inArray(proyecto.id, permitidos))
    }

    const proyectos = await db
      .select({
        proyectoId: proyecto.id,
        codigo: proyecto.codigo,
        nombre: proyecto.nombre,
        esAjuste: proyecto.esAjuste,
        horasPresupuesto: proyecto.horasPresupuesto,
      })
      .from(proyecto)
      .where(and(...condiciones))
      .orderBy(asc(proyecto.codigo))

    if (proyectos.length === 0) return []
    const ids = proyectos.map((fila) => fila.proyectoId)

    const presupuestos = await db
      .select({
        proyectoId: presupuestoProyecto.proyectoId,
        version: presupuestoProyecto.version,
        importeCents: presupuestoProyecto.importeCents,
        horasPresupuesto: presupuestoProyecto.horasPresupuesto,
      })
      .from(presupuestoProyecto)
      .where(inArray(presupuestoProyecto.proyectoId, ids))

    const vigente = new Map<string, (typeof presupuestos)[number]>()
    for (const fila of presupuestos) {
      const actual = vigente.get(fila.proyectoId)
      if (!actual || fila.version > actual.version) vigente.set(fila.proyectoId, fila)
    }

    const costes = await db
      .select({
        proyectoId: costeImputacion.proyectoId,
        gastadoCents: sql<number>`coalesce(sum(${costeImputacion.importeCents}), 0)`.mapWith(Number),
        minutos: sql<number>`coalesce(sum(${costeImputacion.minutos}), 0)`.mapWith(Number),
        lineasSinTarifa:
          sql<number>`count(*) filter (where ${costeImputacion.sinTarifa})`.mapWith(Number),
      })
      .from(costeImputacion)
      .where(inArray(costeImputacion.proyectoId, ids))
      .groupBy(costeImputacion.proyectoId)

    const porProyecto = new Map(costes.map((fila) => [fila.proyectoId, fila]))

    return proyectos.map((fila) => {
      const presupuesto = vigente.get(fila.proyectoId)
      const coste = porProyecto.get(fila.proyectoId)

      return {
        ...fila,
        presupuestoCents: presupuesto?.importeCents ?? null,
        versionPresupuesto: presupuesto?.version ?? null,
        horasPresupuesto: presupuesto?.horasPresupuesto ?? fila.horasPresupuesto,
        gastadoCents: coste?.gastadoCents ?? 0,
        horasAprobadas: (coste?.minutos ?? 0) / 60,
        lineasSinTarifa: coste?.lineasSinTarifa ?? 0,
      }
    })
  },

  async lineasInforme(empresaId, filtro: FiltroInformeCoste, permitidos): Promise<LineaInformeCoste[]> {
    const condiciones = [
      eq(proyecto.empresaId, empresaId),
      gte(costeImputacion.fecha, filtro.desde as Fecha),
      lte(costeImputacion.fecha, filtro.hasta as Fecha),
    ]

    if (filtro.proyectoId) condiciones.push(eq(tarea.proyectoId, filtro.proyectoId))
    if (permitidos !== null) {
      if (permitidos.length === 0) return []
      condiciones.push(inArray(tarea.proyectoId, permitidos))
    }

    return db
      .select({
        fecha: costeImputacion.fecha,
        empleadoCodigo: empleado.codigo,
        empleadoNombre: empleado.nombre,
        proyectoId: proyecto.id,
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        tareaCodigo: tarea.codigo,
        tareaNombre: tarea.nombre,
        minutos: costeImputacion.minutos,
        costeHoraCents: costeImputacion.costeHoraCents,
        importeCents: costeImputacion.importeCents,
        sinTarifa: costeImputacion.sinTarifa,
      })
      .from(costeImputacion)
      .innerJoin(empleado, eq(empleado.id, costeImputacion.empleadoId))
      .innerJoin(proyecto, eq(proyecto.id, costeImputacion.proyectoId))
      .innerJoin(tarea, eq(tarea.id, costeImputacion.tareaId))
      .where(and(...condiciones))
      .orderBy(asc(costeImputacion.fecha), asc(empleado.codigo), asc(proyecto.codigo))
  },
}
