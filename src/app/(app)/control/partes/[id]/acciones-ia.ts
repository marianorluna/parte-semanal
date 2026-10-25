'use server'

import { z } from 'zod'
import { depsAsistente } from '@/composition'
import { autorizar } from '@/modules/identidad/application/sesion'
import { redactarMotivoRechazo } from '@/modules/asistente/application/servicio'
import { aResultadoIA, type ResultadoIA } from '../../resultado-ia'

/**
 * La acción solo acepta el id: el contexto lo construye el servidor tras
 * comprobar el alcance del usuario sobre el parte. Nada se revalida porque
 * esta función no escribe.
 */
const esquema = z.object({
  parteId: z.string().uuid(),
})

export async function redactarMotivoAction(input: unknown): Promise<ResultadoIA> {
  try {
    const usuario = await autorizar('ENCARGADO', 'ADMIN')
    const { parteId } = esquema.parse(input)
    const { texto } = await redactarMotivoRechazo(depsAsistente, usuario, parteId)
    return { ok: true, texto }
  } catch (error) {
    return aResultadoIA(error)
  }
}
