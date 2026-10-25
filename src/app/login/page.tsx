import { redirect } from 'next/navigation'
import { REPOSITORIO_GITHUB } from '@/config/enlaces'
import { env } from '@/config/env'
import { CUENTAS_ACCESO_RAPIDO } from '@/modules/identidad/application/cuentas-demo'
import { usuarioActual, rutaInicial } from '@/modules/identidad/application/sesion'
import { Marca } from '@/components/Marca'
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
          <Marca className="text-xs" />
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

        <div className="mt-6 border-t border-marca-800 pt-4 text-center">
          <a
            href={REPOSITORIO_GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-md border border-marca-700 px-3 py-2 text-sm font-semibold text-marca-100 transition-colors hover:bg-marca-800 hover:text-white"
          >
            <IconoGitHub />
            Ver el código en GitHub
          </a>
          <p className="mt-2 text-[11px] text-marca-300">
            Proyecto abierto con licencia MIT: puedes copiarlo y reutilizarlo.
          </p>
        </div>
      </div>
    </main>
  )
}

function IconoGitHub() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}
