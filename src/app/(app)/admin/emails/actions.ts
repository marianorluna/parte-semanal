'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { autorizar } from '@/modules/identidad/application/sesion'
import { depsEmail } from '@/composition'
import { reintentarEmail } from '@/modules/email/application/servicio'
import { AppError } from '@/shared/errors'

export type EstadoReintento = {
  error?: string
  ok?: string
}

const esquema = z.object({
  emailId: z.string().uuid('Correo inválido'),
})

export async function reintentarEmailAction(
  _prev: EstadoReintento,
  formData: FormData,
): Promise<EstadoReintento> {
  try {
    const actor = await autorizar('ADMIN')
    const parsed = esquema.safeParse({ emailId: String(formData.get('emailId') ?? '') })
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Correo inválido' }

    await reintentarEmail(depsEmail, parsed.data.emailId, actor.empresaId)
    revalidatePath('/admin/emails')
    return { ok: 'Reintento encolado' }
  } catch (error) {
    if (error instanceof AppError) return { error: error.message }
    console.error('[admin/emails]', error)
    return { error: 'No se pudo reintentar el envío' }
  }
}
