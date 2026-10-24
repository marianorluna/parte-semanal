'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsEmail } from '@/composition'
import { guardarPreferencia } from '@/modules/email/application/servicio'
import type { TipoNotificacion } from '@/db/schema'
import { AppError } from '@/shared/errors'

export type EstadoPreferencias = {
  error?: string
  ok?: string
}

const TIPOS: readonly TipoNotificacion[] = [
  'RECORDATORIO_PARTE',
  'EQUIPO_PENDIENTE',
  'RIESGO_PROYECTO',
]

function marcado(formData: FormData, campo: string): boolean {
  return formData.get(campo) === 'on'
}

export async function guardarPreferenciasAction(
  _prev: EstadoPreferencias,
  formData: FormData,
): Promise<EstadoPreferencias> {
  try {
    const usuario = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')

    // Un checkbox no marcado no viaja en el formulario: se guarda siempre el
    // estado de las dos casillas de los tres tipos para que el opt-out persista.
    for (const tipo of TIPOS) {
      await guardarPreferencia(
        depsEmail,
        usuario.id,
        tipo,
        marcado(formData, `email_${tipo}`),
        marcado(formData, `inApp_${tipo}`),
      )
    }

    revalidatePath('/notificaciones')
    revalidatePath('/notificaciones/preferencias')
    return { ok: 'Preferencias guardadas' }
  } catch (error) {
    if (error instanceof AppError) return { error: error.message }
    console.error('[notificaciones/preferencias]', error)
    return { error: 'No se pudieron guardar las preferencias' }
  }
}
