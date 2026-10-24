'use client'

import { useActionState } from 'react'
import type { CuentaAccesoRapido } from '@/modules/identidad/application/cuentas-demo'
import { iniciarSesionRapida, type EstadoLogin } from './actions'

const estadoInicial: EstadoLogin = {}

type Props = { cuentas: readonly CuentaAccesoRapido[] }

/**
 * Botones provisionales para revisar la app sin escribir credenciales. La
 * contraseña se aplica en la Server Action, nunca en el cliente.
 */
export function AccesoRapido({ cuentas }: Props) {
  const [estado, accion, pendiente] = useActionState(iniciarSesionRapida, estadoInicial)

  if (cuentas.length === 0) return null

  return (
    <div className="mt-5">
      <p className="text-center text-[11px] font-semibold tracking-wide text-marca-300 uppercase">
        Acceso rápido (entorno de pruebas)
      </p>

      <form action={accion} className="mt-2 space-y-2">
        {cuentas.map((cuenta) => (
          <button
            key={cuenta.clave}
            type="submit"
            name="cuenta"
            value={cuenta.clave}
            disabled={pendiente}
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-marca-600 bg-marca-800/60 px-3 py-2 text-left text-sm text-white transition-colors hover:bg-marca-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="shrink-0 font-semibold">{cuenta.etiqueta}</span>
            <span className="min-w-0 truncate text-xs text-marca-200">{cuenta.email}</span>
          </button>
        ))}
      </form>

      {estado.error ? (
        <p role="alert" className="mt-2 rounded-md bg-red-950/60 px-3 py-2 text-center text-xs text-red-200">
          {estado.error}
        </p>
      ) : null}
    </div>
  )
}
