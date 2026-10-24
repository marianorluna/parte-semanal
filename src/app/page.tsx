import { redirect } from 'next/navigation'
import { rutaInicial, usuarioActual } from '@/modules/identidad/application/sesion'

export const dynamic = 'force-dynamic'

export default async function InicioPage() {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/login')

  redirect(rutaInicial(usuario))
}
