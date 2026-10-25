'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsPartes } from '@/composition'
import { aprobarSemana } from '@/modules/partes/application/servicio'
import type { ResultadoAccion } from '../acciones-lote'

const QUIEN_REVISA = ['ADMIN', 'ENCARGADO'] as const

export type { ResultadoAccion } from '../acciones-lote'

export async function aprobarParteAction(input: {
  parteId: string
  version: number
  isoYear: number
  isoWeek: number
}): Promise<ResultadoAccion> {
  try {
    const usuario = await autorizar(...QUIEN_REVISA)
    await aprobarSemana(depsPartes, usuario, { parteId: input.parteId, version: input.version })
    revalidatePath('/control/equipo')
    revalidatePath('/control/partes')
    revalidatePath('/control/dashboard')
    return { ok: true, mensaje: 'Parte aprobado' }
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message }
    console.error('[control/equipo]', error)
    return { ok: false, error: 'No se pudo completar la acción' }
  }
}
