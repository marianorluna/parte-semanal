import { AppError } from '@/shared/errors'

/**
 * Resultado de una acción del asistente. Vive fuera de los módulos `'use server'`
 * porque Next solo admite exportar funciones async desde ellos.
 */
export type ResultadoIA = { ok: true; texto: string } | { ok: false; error: string }

export function aResultadoIA(error: unknown): ResultadoIA {
  if (error instanceof AppError) {
    return { ok: false, error: error.message }
  }

  console.error('[asistente-ia]', error)
  return { ok: false, error: 'No se pudo completar la consulta al asistente' }
}
