import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { empleado, imputacion, parte, proyecto, tarea } from '@/db/schema'
import type { FechaIso } from '@/modules/partes/domain/fechas'

export type FilaProyecto = {
  proyectoId: string
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  minutos: number
}

export type FilaSemana = {
  isoYear: number
  isoWeek: number
  weekStart: string
  minutos: number
}

export type FilaEmpleado = {
  empleadoId: string
  nombre: string
  minutos: number
  partes: number
}

function filtroProyectos(ids: string[] | null) {
  if (ids === null) return undefined
  if (ids.length === 0) return sql`false`
  return inArray(tarea.proyectoId, ids)
}

/**
 * Restringe partes por proyecto sin necesidad de unir `tarea` en la consulta externa.
 * Se usa en agregados sobre `parte` para no inflar los totales con una fila por imputación.
 */
function filtroProyectosDeParte(ids: string[] | null) {
  if (ids === null) return undefined
  if (ids.length === 0) return sql`false`
  return inArray(
    parte.id,
    db
      .select({ parteId: imputacion.parteId })
      .from(imputacion)
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .where(inArray(tarea.proyectoId, ids)),
  )
}

// Los borradores no computan en los indicadores: solo cuentan los partes enviados.
const soloEnviados = ne(parte.estado, 'BORRADOR')

export async function horasPorProyecto(
  empresaId: string,
  isoYear: number,
  isoWeek: number,
  permitidos: string[] | null,
): Promise<FilaProyecto[]> {
  const condiciones = [eq(parte.empresaId, empresaId), eq(parte.isoYear, isoYear), eq(parte.isoWeek, isoWeek), soloEnviados]
  const porProyecto = filtroProyectos(permitidos)
  if (porProyecto) condiciones.push(porProyecto)

  const filas = await db
    .select({
      proyectoId: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      horasPresupuesto: proyecto.horasPresupuesto,
      minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
    })
    .from(parte)
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .where(and(...condiciones))
    .groupBy(proyecto.id, proyecto.codigo, proyecto.nombre, proyecto.horasPresupuesto)
    .orderBy(desc(sql`coalesce(sum(${imputacion.minutos}), 0)`))

  return filas
}

export async function evolucionSemanal(
  empresaId: string,
  desde: FechaIso,
  hasta: FechaIso,
  permitidos: string[] | null,
): Promise<FilaSemana[]> {
  const condiciones = [eq(parte.empresaId, empresaId), gte(parte.weekStart, desde), lte(parte.weekStart, hasta), soloEnviados]
  const porProyecto = filtroProyectos(permitidos)
  if (porProyecto) condiciones.push(porProyecto)

  return db
    .select({
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
      weekStart: parte.weekStart,
      minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
    })
    .from(parte)
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .where(and(...condiciones))
    .groupBy(parte.isoYear, parte.isoWeek, parte.weekStart)
    .orderBy(asc(parte.weekStart))
}

export async function topEmpleados(
  empresaId: string,
  isoYear: number,
  isoWeek: number,
  permitidos: string[] | null,
  limite = 5,
): Promise<FilaEmpleado[]> {
  const condiciones = [eq(parte.empresaId, empresaId), eq(parte.isoYear, isoYear), eq(parte.isoWeek, isoWeek), soloEnviados]
  const porProyecto = filtroProyectos(permitidos)
  if (porProyecto) condiciones.push(porProyecto)

  return db
    .select({
      empleadoId: empleado.id,
      nombre: empleado.nombre,
      minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
      partes: sql<number>`count(distinct ${parte.id})`.mapWith(Number),
    })
    .from(parte)
    .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .where(and(...condiciones))
    .groupBy(empleado.id, empleado.nombre)
    .orderBy(desc(sql`coalesce(sum(${imputacion.minutos}), 0)`))
    .limit(limite)
}

export type ResumenSemana = {
  totalMinutos: number
  partes: number
  empleados: number
  pendientes: number
  pendienteMasAntiguo: Date | null
}

export async function resumenSemana(
  empresaId: string,
  isoYear: number,
  isoWeek: number,
  permitidos: string[] | null,
): Promise<ResumenSemana> {
  const condiciones = [eq(parte.empresaId, empresaId), eq(parte.isoYear, isoYear), eq(parte.isoWeek, isoWeek), soloEnviados]
  const porProyecto = filtroProyectosDeParte(permitidos)
  if (porProyecto) condiciones.push(porProyecto)

  const filas = await db
    .select({
      totalMinutos: sql<number>`coalesce(sum(${parte.totalMinutos}), 0)`.mapWith(Number),
      partes: count(),
      empleados: sql<number>`count(distinct ${parte.empleadoId})`.mapWith(Number),
      pendientes: sql<number>`count(*) filter (where ${parte.estado} = 'ENVIADO')`.mapWith(Number),
    })
    .from(parte)
    .where(and(...condiciones))

  const fila = filas[0]

  const condicionesPendientes = [eq(parte.empresaId, empresaId), eq(parte.estado, 'ENVIADO')]
  if (porProyecto) condicionesPendientes.push(porProyecto)
  const antiguo = await db
    .select({ enviadoAt: parte.enviadoAt })
    .from(parte)
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .where(and(...condicionesPendientes))
    .orderBy(asc(parte.enviadoAt))
    .limit(1)

  return {
    totalMinutos: Number(fila?.totalMinutos ?? 0),
    partes: Number(fila?.partes ?? 0),
    empleados: Number(fila?.empleados ?? 0),
    pendientes: Number(fila?.pendientes ?? 0),
    pendienteMasAntiguo: antiguo[0]?.enviadoAt ?? null,
  }
}

export type FilaDetalleProyecto = {
  proyectoId: string
  proyectoNombre: string
  tareaId: string
  tareaNombre: string
  minutos: number
}

export async function detalleParte(parteId: string): Promise<FilaDetalleProyecto[]> {
  return db
    .select({
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      tareaId: tarea.id,
      tareaNombre: tarea.nombre,
      minutos: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
    })
    .from(imputacion)
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .where(eq(imputacion.parteId, parteId))
    .groupBy(proyecto.id, proyecto.nombre, tarea.id, tarea.nombre)
    .orderBy(asc(proyecto.nombre), asc(tarea.nombre))
}

export type LineaExport = {
  empleadoCodigo: string
  empleadoNombre: string
  proyectoCodigo: string
  proyectoNombre: string
  tareaCodigo: string
  tareaNombre: string
  fecha: string
  minutos: number
  estado: string
  isoYear: number
  isoWeek: number
}

export async function lineasParaExportar(
  empresaId: string,
  isoYear: number,
  isoWeek: number,
  permitidos: string[] | null,
  filtros: { estado?: string; proyectoId?: string } = {},
): Promise<LineaExport[]> {
  const condiciones = [eq(parte.empresaId, empresaId), eq(parte.isoYear, isoYear), eq(parte.isoWeek, isoWeek)]

  if (filtros.estado) condiciones.push(sql`${parte.estado}::text = ${filtros.estado}`)
  if (filtros.proyectoId) condiciones.push(eq(tarea.proyectoId, filtros.proyectoId))

  const porProyecto = filtros.proyectoId ? undefined : filtroProyectos(permitidos)
  if (porProyecto) condiciones.push(porProyecto)

  return db
    .select({
      empleadoCodigo: empleado.codigo,
      empleadoNombre: empleado.nombre,
      proyectoCodigo: proyecto.codigo,
      proyectoNombre: proyecto.nombre,
      tareaCodigo: tarea.codigo,
      tareaNombre: tarea.nombre,
      fecha: imputacion.fecha,
      minutos: imputacion.minutos,
      estado: sql<string>`${parte.estado}::text`,
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
    })
    .from(parte)
    .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
    .innerJoin(imputacion, eq(imputacion.parteId, parte.id))
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .where(and(...condiciones))
    .orderBy(asc(empleado.codigo), asc(imputacion.fecha))
}
