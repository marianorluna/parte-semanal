import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export default async function InicioPage() {
  const sesion = await auth()
  if (!sesion?.user) redirect('/login')

  if (sesion.user.rol === 'ADMIN') redirect('/admin/usuarios')
  if (sesion.user.rol === 'ENCARGADO') redirect('/control/partes')
  redirect('/mi-semana')
}
