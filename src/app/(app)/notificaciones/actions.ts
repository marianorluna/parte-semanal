'use server'

import { revalidatePath } from 'next/cache'
import { autorizar } from '@/modules/identidad/application/sesion'
import { repositorioNotificaciones } from '@/composition'

export async function marcarLeida(notificacionId: string): Promise<void> {
  const usuario = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')
  if (!notificacionId) return

  await repositorioNotificaciones.marcarLeida(usuario.id, notificacionId)
  revalidatePath('/notificaciones')
}

export async function marcarTodasLeidas(): Promise<void> {
  const usuario = await autorizar('TRABAJADOR', 'ENCARGADO', 'ADMIN')

  await repositorioNotificaciones.marcarTodasLeidas(usuario.id)
  revalidatePath('/notificaciones')
}
