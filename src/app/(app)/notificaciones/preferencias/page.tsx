import Link from 'next/link'
import { requireUsuario } from '@/modules/identidad/application/sesion'
import { depsEmail } from '@/composition'
import { preferenciasDe } from '@/modules/email/application/servicio'
import { FormularioPreferencias } from './FormularioPreferencias'

export const dynamic = 'force-dynamic'

export default async function PreferenciasPage() {
  const usuario = await requireUsuario()
  const preferencias = await preferenciasDe(depsEmail, usuario.id)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Preferencias de avisos</h1>
          <p className="text-sm text-slate-600">
            Elige qué avisos quieres recibir en la app y cuáles también por correo.
          </p>
        </div>
        <Link href="/notificaciones" className="boton-secundario px-3 py-1.5 text-xs">
          Volver a avisos
        </Link>
      </div>

      <div className="tarjeta p-4 sm:p-5">
        <FormularioPreferencias
          preferencias={preferencias}
          proveedorConfigurado={depsEmail.proveedorConfigurado}
        />
      </div>
    </section>
  )
}
