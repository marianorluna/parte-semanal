import { and, asc, count, desc, eq, exists, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { asignacion, empleado, empresa, imputacion, parte, proyecto, tarea, usuario, usuarioProyecto } from '@/db/schema'
import type { FechaIso, SemanaIso } from '@/modules/partes/domain/fechas'

export async function nombreEmpresa(empresaId: string): Promise<string> {
  const filas = await db
    .select({ nombre: empresa.nombre })
    .from(empresa)
    .where(eq(empresa.id, empresaId))
    .limit(1)

  return filas[0]?.nombre ?? 'Levitec'
}

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
  if (filtros.proyectoId) {
    // Un encargado no puede exportar un proyecto que no tenga asignado.
    if (permitidos !== null && !permitidos.includes(filtros.proyectoId)) return []
    condiciones.push(eq(tarea.proyectoId, filtros.proyectoId))
  }

  const porProyecto = filtroProyectos(permitidos)
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

export type FilaConsumoProyecto = {
  proyectoId: string
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  fechaInicio: FechaIso | null
  fechaFin: FechaIso | null
  activo: boolean
  minutos: number
}

/**
 * Consumo acumulado por proyecto (no solo la semana): es la base del motor de
 * riesgo. Excluye borradores para no avisar de horas todavía no enviadas.
 */
export async function consumoTotalPorProyecto(
  empresaId: string,
  permitidos: string[] | null,
): Promise<FilaConsumoProyecto[]> {
  const condiciones = [eq(proyecto.empresaId, empresaId)]
  if (permitidos !== null) {
    if (permitidos.length === 0) return []
    condiciones.push(inArray(proyecto.id, permitidos))
  }

  return db
    .select({
      proyectoId: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      horasPresupuesto: proyecto.horasPresupuesto,
      fechaInicio: proyecto.fechaInicio,
      fechaFin: proyecto.fechaFin,
      activo: proyecto.activo,
      minutos:
        sql<number>`coalesce(sum(${imputacion.minutos}) filter (where ${parte.estado} in ('ENVIADO', 'APROBADO', 'BLOQUEADO')), 0)`.mapWith(
          Number,
        ),
    })
    .from(proyecto)
    .leftJoin(tarea, eq(tarea.proyectoId, proyecto.id))
    .leftJoin(imputacion, eq(imputacion.tareaId, tarea.id))
    .leftJoin(parte, eq(parte.id, imputacion.parteId))
    .where(and(...condiciones))
    .groupBy(
      proyecto.id,
      proyecto.codigo,
      proyecto.nombre,
      proyecto.horasPresupuesto,
      proyecto.fechaInicio,
      proyecto.fechaFin,
      proyecto.activo,
    )
    .orderBy(asc(proyecto.codigo))
}

export type FilaTareaProyecto = {
  tareaId: string
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  minutos: number
}

export async function detalleTareasProyecto(
  empresaId: string,
  proyectoId: string,
): Promise<FilaTareaProyecto[]> {
  return db
    .select({
      tareaId: tarea.id,
      codigo: tarea.codigo,
      nombre: tarea.nombre,
      horasPresupuesto: tarea.horasPresupuesto,
      minutos:
        sql<number>`coalesce(sum(${imputacion.minutos}) filter (where ${parte.estado} in ('ENVIADO', 'APROBADO', 'BLOQUEADO')), 0)`.mapWith(
          Number,
        ),
    })
    .from(tarea)
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .leftJoin(imputacion, eq(imputacion.tareaId, tarea.id))
    .leftJoin(parte, eq(parte.id, imputacion.parteId))
    .where(and(eq(tarea.proyectoId, proyectoId), eq(proyecto.empresaId, empresaId)))
    .groupBy(tarea.id, tarea.codigo, tarea.nombre, tarea.horasPresupuesto)
    .orderBy(asc(tarea.codigo))
}

export async function tendenciaProyecto(
  proyectoId: string,
  desde: FechaIso,
): Promise<FilaSemana[]> {
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
    .where(
      and(
        eq(tarea.proyectoId, proyectoId),
        gte(parte.weekStart, desde),
        sql`${parte.estado} in ('ENVIADO', 'APROBADO', 'BLOQUEADO')`,
      ),
    )
    .groupBy(parte.isoYear, parte.isoWeek, parte.weekStart)
    .orderBy(asc(parte.weekStart))
}

export type MiembroEquipo = {
  empleadoId: string
  usuarioId: string
  nombre: string
  email: string
  codigo: string
  rol: 'TRABAJADOR' | 'ENCARGADO' | 'ADMIN'
}

export type ProyectoDeEmpleado = {
  empleadoId: string
  proyectoId: string
  codigo: string
  nombre: string
}

function existeAsignacionEnSemana(
  semana: SemanaIso,
  opciones: { proyectoId?: string; encargadoUsuarioId: string | null },
) {
  const condiciones = [
    eq(asignacion.empleadoId, usuario.empleadoId),
    eq(asignacion.activa, true),
    lte(asignacion.desde, semana.weekEnd),
    or(isNull(asignacion.hasta), gte(asignacion.hasta, semana.weekStart)),
  ]
  if (opciones.proyectoId) condiciones.push(eq(tarea.proyectoId, opciones.proyectoId))
  if (opciones.encargadoUsuarioId) condiciones.push(eq(usuarioProyecto.usuarioId, opciones.encargadoUsuarioId))

  return exists(
    db
      .select({ uno: sql`1` })
      .from(asignacion)
      .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
      .innerJoin(usuarioProyecto, eq(usuarioProyecto.proyectoId, tarea.proyectoId))
      .where(and(...condiciones)),
  )
}

/**
 * Personas que el revisor puede ver: el encargado solo TRABAJADOR de sus
 * proyectos; el admin, cualquiera de la empresa.
 */
export async function miembrosEquipo(
  empresaId: string,
  semana: SemanaIso,
  opciones: { encargadoUsuarioId: string | null; proyectoId?: string },
): Promise<MiembroEquipo[]> {
  const condiciones = [
    eq(usuario.empresaId, empresaId),
    eq(usuario.activo, true),
    eq(empleado.activo, true),
  ]

  if (opciones.encargadoUsuarioId) {
    condiciones.push(eq(usuario.rol, 'TRABAJADOR'))
    condiciones.push(
      existeAsignacionEnSemana(semana, {
        proyectoId: opciones.proyectoId,
        encargadoUsuarioId: opciones.encargadoUsuarioId,
      }),
    )
  } else if (opciones.proyectoId) {
    condiciones.push(
      existeAsignacionEnSemana(semana, { proyectoId: opciones.proyectoId, encargadoUsuarioId: null }),
    )
  }

  return db
    .select({
      empleadoId: empleado.id,
      usuarioId: usuario.id,
      nombre: empleado.nombre,
      email: usuario.email,
      codigo: empleado.codigo,
      rol: usuario.rol,
    })
    .from(usuario)
    .innerJoin(empleado, eq(empleado.id, usuario.empleadoId))
    .where(and(...condiciones))
    .orderBy(asc(empleado.nombre))
}

export async function proyectosAsignadosEnSemana(
  empleadoIds: string[],
  semana: SemanaIso,
): Promise<ProyectoDeEmpleado[]> {
  if (empleadoIds.length === 0) return []

  return db
    .selectDistinct({
      empleadoId: asignacion.empleadoId,
      proyectoId: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
    })
    .from(asignacion)
    .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .where(
      and(
        inArray(asignacion.empleadoId, empleadoIds),
        eq(asignacion.activa, true),
        lte(asignacion.desde, semana.weekEnd),
        or(isNull(asignacion.hasta), gte(asignacion.hasta, semana.weekStart)),
      ),
    )
    .orderBy(asc(proyecto.codigo))
}

export type ParteDeEmpleado = {
  empleadoId: string
  parteId: string
  estado: 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'BLOQUEADO'
  version: number
  totalMinutos: number
}

export async function partesDeEmpleados(
  empleadoIds: string[],
  isoYear: number,
  isoWeek: number,
): Promise<ParteDeEmpleado[]> {
  if (empleadoIds.length === 0) return []

  return db
    .select({
      empleadoId: parte.empleadoId,
      parteId: parte.id,
      estado: parte.estado,
      version: parte.version,
      totalMinutos: parte.totalMinutos,
    })
    .from(parte)
    .where(
      and(
        inArray(parte.empleadoId, empleadoIds),
        eq(parte.isoYear, isoYear),
        eq(parte.isoWeek, isoWeek),
      ),
    )
}
