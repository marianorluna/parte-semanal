import Link from 'next/link'
import { requireUsuario, rutaInicial } from '@/modules/identidad/application/sesion'

export const dynamic = 'force-dynamic'

export default async function SinAccesoPage() {
  const usuario = await requireUsuario()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="tarjeta max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Sin acceso</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu usuario no tiene permiso para esta sección. Si necesitas acceso, contacta con administración.
        </p>
        <Link href={rutaInicial(usuario)} className="boton-primario mt-6">
          Volver a mi inicio
        </Link>
      </div>
    </main>
  )
}
