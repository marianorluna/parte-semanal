import { db } from '@/db/client'
import { auditoria } from '@/db/schema'

export type EntradaAuditoria = {
  actorId: string | null
  entidad: string
  entidadId?: string | null
  accion: string
  antes?: unknown
  despues?: unknown
}

/** Registro append-only. Nunca se actualiza ni se borra desde la aplicación. */
export async function registrarAuditoria(entrada: EntradaAuditoria): Promise<void> {
  try {
    await db.insert(auditoria).values({
      actorId: entrada.actorId,
      entidad: entrada.entidad,
      entidadId: entrada.entidadId ?? null,
      accion: entrada.accion,
      antes: entrada.antes ?? null,
      despues: entrada.despues ?? null,
    })
  } catch (error) {
    // La auditoría no debe tumbar la operación de negocio, pero sí dejar rastro.
    console.error('[auditoria] no se pudo registrar', entrada.accion, error)
  }
}
