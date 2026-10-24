import { redirect } from 'next/navigation'
import { env } from '@/config/env'
import { CUENTAS_ACCESO_RAPIDO } from '@/modules/identidad/application/cuentas-demo'
import { usuarioActual, rutaInicial } from '@/modules/identidad/application/sesion'
import { AccesoRapido } from './AccesoRapido'
import { FormularioLogin } from './FormularioLogin'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const usuario = await usuarioActual()
  if (usuario) redirect(rutaInicial(usuario))

  const cuentas = env().ACCESO_RAPIDO_DEMO ? CUENTAS_ACCESO_RAPIDO : []

  return (
    <main className="flex min-h-dvh items-center justify-center bg-marca-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-acento-300 uppercase">Levitec</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Parte semanal de horas</h1>
          <p className="mt-1 text-sm text-marca-200">Accede con tu cuenta de empresa</p>
        </div>

        <div className="tarjeta border-t-4 border-t-acento-500 p-6">
          <FormularioLogin />
        </div>

        <p className="mt-4 text-center text-xs text-marca-300">
          Si no tienes acceso, solicítalo a administración.
        </p>

        <AccesoRapido cuentas={cuentas} />
      </div>
    </main>
  )
}
