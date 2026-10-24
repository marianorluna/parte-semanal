'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { registrarAuditoria } from '@/modules/auditoria/application/registrar'
import { depsAusencias } from '@/composition'
import { resolverAusencia } from '@/modules/ausencias/application/servicio'
import { AppError } from '@/shared/errors'

export type EstadoResolucion = {
  error?: string
  ok?: string
  campo?: Record<string, string>
}

function aError(error: unknown): EstadoResolucion {
  if (error instanceof AppError) return { error: error.message, campo: error.detalles }
  console.error('[control/ausencias]', error)
  return { error: 'No se pudo completar la operación' }
}

const resolucionSchema = z.object({
  ausenciaId: z.string().uuid(),
  decision: z.enum(['APROBADA', 'RECHAZADA']),
  motivo: z.string().trim().max(300),
})

async function resolver(
  formData: FormData,
  decision: 'APROBADA' | 'RECHAZADA',
): Promise<EstadoResolucion> {
  const actor = await autorizar('ENCARGADO', 'ADMIN')
  const parsed = resolucionSchema.safeParse({
    ausenciaId: formData.get('ausenciaId'),
    decision,
    motivo: formData.get('motivo') ?? '',
  })
  if (!parsed.success) {
    const campo: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const clave = issue.path.join('.')
      if (clave && !campo[clave]) campo[clave] = issue.message
    }
    return { error: 'Revisa los campos marcados', campo }
  }

  await resolverAusencia(depsAusencias, actor, parsed.data)
  await registrarAuditoria({
    actorId: actor.id,
    entidad: 'ausencia',
    entidadId: parsed.data.ausenciaId,
    accion: decision === 'APROBADA' ? 'APROBAR_AUSENCIA' : 'RECHAZAR_AUSENCIA',
    motivo: parsed.data.motivo || null,
  })

  revalidatePath('/control/ausencias')
  revalidatePath('/mis-ausencias')
  revalidatePath('/mi-semana')
  revalidatePath('/control/equipo')

  return { ok: decision === 'APROBADA' ? 'Ausencia aprobada' : 'Ausencia rechazada' }
}

export async function aprobarAusenciaAction(
  _prev: EstadoResolucion,
  formData: FormData,
): Promise<EstadoResolucion> {
  try {
    return await resolver(formData, 'APROBADA')
  } catch (error) {
    return aError(error)
  }
}

export async function rechazarAusenciaAction(
  _prev: EstadoResolucion,
  formData: FormData,
): Promise<EstadoResolucion> {
  try {
    return await resolver(formData, 'RECHAZADA')
  } catch (error) {
    return aError(error)
  }
}
