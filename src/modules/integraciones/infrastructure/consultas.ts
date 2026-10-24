/**
 * Consultas de lectura de la API pública. Devuelven formas estables y
 * serializables: la app puede cambiar su UI sin romper a un integrador.
 */

import { and, desc, eq, type SQL } from 'drizzle-orm'
import { db } from '@/db/client'
import { empleado, parte, proyecto } from '@/db/schema'

export type ParteApi = {
  id: string
  empleadoId: string
  empleadoCodigo: string
  empleadoNombre: string
  isoYear: number
  isoWeek: number
  weekStart: string
  estado: string
  totalMinutos: number
  version: number
  enviadoAt: Date | null
  revisadoAt: Date | null
}

export type ProyectoApi = {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

export type FiltrosPartes = {
  isoYear?: number
  isoWeek?: number
  estado?: string
  empleadoId?: string
  limite: number
}

export async function listarPartesApi(
  empresaId: string,
  filtros: FiltrosPartes,
): Promise<ParteApi[]> {
  const condiciones: SQL[] = [eq(parte.empresaId, empresaId)]
  if (filtros.isoYear) condiciones.push(eq(parte.isoYear, filtros.isoYear))
  if (filtros.isoWeek) condiciones.push(eq(parte.isoWeek, filtros.isoWeek))
  if (filtros.empleadoId) condiciones.push(eq(parte.empleadoId, filtros.empleadoId))
  if (filtros.estado) {
    condiciones.push(eq(parte.estado, filtros.estado as 'BORRADOR'))
  }

  return db
    .select({
      id: parte.id,
      empleadoId: parte.empleadoId,
      empleadoCodigo: empleado.codigo,
      empleadoNombre: empleado.nombre,
      isoYear: parte.isoYear,
      isoWeek: parte.isoWeek,
      weekStart: parte.weekStart,
      estado: parte.estado,
      totalMinutos: parte.totalMinutos,
      version: parte.version,
      enviadoAt: parte.enviadoAt,
      revisadoAt: parte.revisadoAt,
    })
    .from(parte)
    .innerJoin(empleado, eq(empleado.id, parte.empleadoId))
    .where(and(...condiciones))
    .orderBy(desc(parte.isoYear), desc(parte.isoWeek), empleado.codigo)
    .limit(filtros.limite)
}

export async function listarProyectosApi(empresaId: string): Promise<ProyectoApi[]> {
  return db
    .select({
      id: proyecto.id,
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      activo: proyecto.activo,
    })
    .from(proyecto)
    .where(eq(proyecto.empresaId, empresaId))
    .orderBy(proyecto.codigo)
}

export async function empleadoDeEmpresa(
  empresaId: string,
  empleadoId: string,
): Promise<boolean> {
  const filas = await db
    .select({ id: empleado.id })
    .from(empleado)
    .where(and(eq(empleado.id, empleadoId), eq(empleado.empresaId, empresaId)))
    .limit(1)
  return filas.length > 0
}
