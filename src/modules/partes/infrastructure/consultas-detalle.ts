import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditoria, empleado, imputacion, parte, proyecto, tarea, usuario } from '@/db/schema'
import type { EstadoParte } from '@/db/schema'

export type ImputacionDetalle = {
  id: string
  fecha: string
  minutos: number
  nota: string | null
  proyectoCodigo: string
  proyectoNombre: string
  tareaCodigo: string
  tareaNombre: string
}

export type ParteDetalle = {
  id: string
  isoYear: number
  isoWeek: number
  weekStart: string
  estado: EstadoParte
  totalMinutos: number
  version: number
  enviadoAt: Date | null
  revisadoAt: Date | null
  motivoRechazo: string | null
  revisorNombre: string | null
  empleadoId: string
  empleadoNombre: string
  empleadoCodigo: string
  imputaciones: ImputacionDetalle[]
}

export type EventoAuditoria = {
  id: string
  accion: string
  motivo: string | null
  createdAt: Date
  actorNombre: string | null
}

export async function obtenerParteDetalle(parteId: string): Promise<ParteDetalle | null> {
  const filas = await db
    .select({
      id: parte.id,
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
      weekStart: parte.weekStart,
      estado: parte.estado,
      totalMinutos: parte.totalMinutos,
      version: parte.version,
      enviadoAt: parte.enviadoAt,
      revisadoAt: parte.revisadoAt,
      motivoRechazo: parte.motivoRechazo,
      revisorNombre: usuario.nombre,
      empleadoId: empleado.id,
      empleadoNombre: empleado.nombre,
      empleadoCodigo: empleado.codigo,
    })
    .from(parte)
    .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
    .leftJoin(usuario, eq(usuario.id, parte.revisadoPor))
    .where(eq(parte.id, parteId))
    .limit(1)

  const cabecera = filas[0]
  if (!cabecera) return null

  const lineas = await db
    .select({
      id: imputacion.id,
      fecha: imputacion.fecha,
      minutos: imputacion.minutos,
      nota: imputacion.nota,
      proyectoCodigo: proyecto.codigo,
      proyectoNombre: proyecto.nombre,
      tareaCodigo: tarea.codigo,
      tareaNombre: tarea.nombre,
    })
    .from(imputacion)
    .innerJoin(tarea, eq(tarea.id, imputacion.tareaId))
    .innerJoin(proyecto, eq(proyecto.id, tarea.proyectoId))
    .where(eq(imputacion.parteId, parteId))
    .orderBy(asc(imputacion.fecha), asc(proyecto.codigo), asc(tarea.codigo))

  return { ...cabecera, imputaciones: lineas }
}

export async function historialParte(parteId: string): Promise<EventoAuditoria[]> {
  return db
    .select({
      id: auditoria.id,
      accion: auditoria.accion,
      motivo: auditoria.motivo,
      createdAt: auditoria.createdAt,
      actorNombre: usuario.nombre,
    })
    .from(auditoria)
    .leftJoin(usuario, eq(usuario.id, auditoria.actorId))
    .where(and(eq(auditoria.entidad, 'parte'), eq(auditoria.entidadId, parteId)))
    .orderBy(desc(auditoria.createdAt))
    .limit(30)
}
