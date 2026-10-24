import type { db } from '@/db/client'
import { outbox } from '@/db/schema'
import type { Evento } from '../domain/api'

export type EventoParte = {
  empresaId: string
  parteId: string
  evento: Evento
  isoYear: number
  isoWeek: number
  empleadoId: string
  estado: string
  actorId?: string
  motivo?: string | null
}

/**
 * Escribe el evento en el outbox usando la misma transacción que el cambio de
 * estado. Si la transacción revierte, el evento desaparece con ella; si un
 * webhook está caído, la operación de negocio no se ve afectada.
 */
export async function registrarOutbox(tx: typeof db, evento: EventoParte): Promise<void> {
  await tx.insert(outbox).values({
    empresaId: evento.empresaId,
    agregado: 'parte',
    agregadoId: evento.parteId,
    evento: evento.evento,
    payload: {
      parteId: evento.parteId,
      empleadoId: evento.empleadoId,
      isoYear: evento.isoYear,
      isoWeek: evento.isoWeek,
      estado: evento.estado,
      actorId: evento.actorId ?? null,
      motivo: evento.motivo ?? null,
    },
  })
}
