import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditoria, usuario } from '@/db/schema'
import type { FechaIso } from '@/modules/partes/domain/fechas'

export type FilaAuditoria = {
  id: string
  createdAt: Date
  accion: string
  entidad: string
  entidadId: string | null
  motivo: string | null
  actorNombre: string | null
  actorEmail: string | null
  antes: unknown
  despues: unknown
}

export type FiltrosAuditoria = {
  accion?: string
  desde?: FechaIso
  hasta?: FechaIso
  pagina: number
  porPagina: number
}

export async function listarAuditoria(filtros: FiltrosAuditoria): Promise<{ filas: FilaAuditoria[]; total: number }> {
  const condiciones = []
  if (filtros.accion) condiciones.push(eq(auditoria.accion, filtros.accion))
  if (filtros.desde) condiciones.push(gte(auditoria.createdAt, new Date(`${filtros.desde}T00:00:00.000Z`)))
  if (filtros.hasta) condiciones.push(lte(auditoria.createdAt, new Date(`${filtros.hasta}T23:59:59.999Z`)))

  const donde = condiciones.length > 0 ? and(...condiciones) : undefined

  const filas = await db
    .select({
      id: auditoria.id,
      createdAt: auditoria.createdAt,
      accion: auditoria.accion,
      entidad: auditoria.entidad,
      entidadId: auditoria.entidadId,
      motivo: auditoria.motivo,
      actorNombre: usuario.nombre,
      actorEmail: usuario.email,
      antes: auditoria.antes,
      despues: auditoria.despues,
    })
    .from(auditoria)
    .leftJoin(usuario, eq(usuario.id, auditoria.actorId))
    .where(donde)
    .orderBy(desc(auditoria.createdAt))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina)

  const totales = await db.select({ total: count() }).from(auditoria).where(donde)

  return { filas, total: Number(totales[0]?.total ?? 0) }
}

export async function accionesDisponibles(): Promise<string[]> {
  const filas = await db
    .select({ accion: auditoria.accion })
    .from(auditoria)
    .groupBy(auditoria.accion)
    .orderBy(sql`count(*) desc`)

  return filas.map((fila) => fila.accion)
}
