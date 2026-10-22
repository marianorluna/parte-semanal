import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { asignacion, empleado, imputacion, proyecto, tarea } from '@/db/schema'
import { AppError } from '@/shared/errors'

export type ProyectoConTotales = {
  id: string
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  activo: boolean
  tareas: number
  minutos: number
}

export async function listarProyectosConTotales(empresaId: string): Promise<ProyectoConTotales[]> {
  const proyectos = await db
    .select({
      id: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      horasPresupuesto: proyecto.horasPresupuesto,
      activo: proyecto.activo,
    })
    .from(proyecto)
    .where(eq(proyecto.empresaId, empresaId))
    .orderBy(asc(proyecto.codigo))

  const ids = proyectos.map((fila) => fila.id)
  if (ids.length === 0) return []

  const [conteoTareas, minutosPorProyecto] = await Promise.all([
    db
      .select({ proyectoId: tarea.proyectoId, total: count() })
      .from(tarea)
      .where(inArray(tarea.proyectoId, ids))
      .groupBy(tarea.proyectoId),
    db
      .select({
        proyectoId: tarea.proyectoId,
        total: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
      })
      .from(imputacion)
      .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
      .where(inArray(tarea.proyectoId, ids))
      .groupBy(tarea.proyectoId),
  ])

  const tareasPorProyecto = new Map(conteoTareas.map((fila) => [fila.proyectoId, Number(fila.total)]))
  const minutos = new Map(minutosPorProyecto.map((fila) => [fila.proyectoId, fila.total]))

  return proyectos.map((fila) => ({
    ...fila,
    tareas: tareasPorProyecto.get(fila.id) ?? 0,
    minutos: minutos.get(fila.id) ?? 0,
  }))
}

export async function crearProyecto(
  empresaId: string,
  datos: { codigo: string; nombre: string; horasPresupuesto: number | null },
): Promise<void> {
  const filas = await db
    .insert(proyecto)
    .values({ empresaId, ...datos, activo: true })
    .onConflictDoNothing({ target: proyecto.codigo })
    .returning({ id: proyecto.id })

  if (!filas[0]) {
    throw new AppError('VALIDACION', `Ya existe un proyecto con el código ${datos.codigo}`, {
      codigo: 'Código duplicado',
    })
  }
}

export async function alternarProyecto(proyectoId: string, activo: boolean): Promise<void> {
  await db.update(proyecto).set({ activo }).where(eq(proyecto.id, proyectoId))
}

export async function obtenerProyecto(proyectoId: string) {
  const filas = await db.select().from(proyecto).where(eq(proyecto.id, proyectoId)).limit(1)
  return filas[0] ?? null
}

export async function listarTareas(proyectoId: string) {
  const tareasDelProyecto = await db
    .select({
      id: tarea.id,
      codigo: tarea.codigo,
      nombre: tarea.nombre,
      horasPresupuesto: tarea.horasPresupuesto,
      activa: tarea.activa,
    })
    .from(tarea)
    .where(eq(tarea.proyectoId, proyectoId))
    .orderBy(asc(tarea.codigo))

  const ids = tareasDelProyecto.map((fila) => fila.id)
  if (ids.length === 0) return []

  const minutosPorTarea = await db
    .select({
      tareaId: imputacion.tareaId,
      total: sql<number>`coalesce(sum(${imputacion.minutos}), 0)`.mapWith(Number),
    })
    .from(imputacion)
    .where(inArray(imputacion.tareaId, ids))
    .groupBy(imputacion.tareaId)

  const minutos = new Map(minutosPorTarea.map((fila) => [fila.tareaId, fila.total]))

  return tareasDelProyecto.map((fila) => ({ ...fila, minutos: minutos.get(fila.id) ?? 0 }))
}

export async function crearTarea(
  proyectoId: string,
  datos: { codigo: string; nombre: string; horasPresupuesto: number | null },
): Promise<void> {
  const filas = await db
    .insert(tarea)
    .values({ proyectoId, ...datos, activa: true })
    .onConflictDoNothing({ target: [tarea.proyectoId, tarea.codigo] })
    .returning({ id: tarea.id })

  if (!filas[0]) {
    throw new AppError('VALIDACION', `Ya existe una tarea ${datos.codigo} en este proyecto`, {
      codigo: 'Código duplicado',
    })
  }
}

export type AsignacionListada = {
  id: string
  empleadoNombre: string
  empleadoCodigo: string
  tareaCodigo: string
  tareaNombre: string
  desde: string
  hasta: string | null
  activa: boolean
}

export async function listarAsignacionesDeProyecto(proyectoId: string): Promise<AsignacionListada[]> {
  return db
    .select({
      id: asignacion.id,
      empleadoNombre: empleado.nombre,
      empleadoCodigo: empleado.codigo,
      tareaCodigo: tarea.codigo,
      tareaNombre: tarea.nombre,
      desde: asignacion.desde,
      hasta: asignacion.hasta,
      activa: asignacion.activa,
    })
    .from(asignacion)
    .innerJoin(empleado, eq(empleado.id, asignacion.empleadoId))
    .innerJoin(tarea, eq(tarea.id, asignacion.tareaId))
    .where(eq(tarea.proyectoId, proyectoId))
    .orderBy(asc(empleado.codigo), asc(tarea.codigo))
}

export async function crearAsignacion(datos: {
  empleadoId: string
  tareaId: string
  desde: string
  hasta: string | null
}): Promise<void> {
  const filas = await db
    .insert(asignacion)
    .values({ ...datos, activa: true })
    .onConflictDoNothing({ target: [asignacion.empleadoId, asignacion.tareaId, asignacion.desde] })
    .returning({ id: asignacion.id })

  if (!filas[0]) {
    throw new AppError('VALIDACION', 'El empleado ya tiene esa tarea asignada con la misma fecha de inicio')
  }
}

export async function desactivarAsignacion(asignacionId: string): Promise<void> {
  await db
    .update(asignacion)
    .set({ activa: false, hasta: new Date().toISOString().slice(0, 10) })
    .where(and(eq(asignacion.id, asignacionId)))
}
