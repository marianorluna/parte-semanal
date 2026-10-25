import Link from 'next/link'
import { Marca } from '@/components/Marca'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-marca-50 px-4 text-center">
      <Marca tono="claro" className="text-xs" />
      <h1 className="text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="max-w-sm text-sm text-slate-600">
        La página o el parte que buscas no existe, se ha borrado o no tienes acceso.
      </p>
      <Link href="/" className="boton-primario mt-2">
        Volver al inicio
      </Link>
    </main>
  )
}
