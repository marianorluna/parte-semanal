'use client'

import { useActionState } from 'react'
import { reintentarEmailAction, type EstadoReintento } from './actions'

const inicial: EstadoReintento = {}

export function BotonReintentar({ emailId }: { emailId: string }) {
  const [estado, accion, pendiente] = useActionState(reintentarEmailAction, inicial)

  return (
    <form action={accion} className="space-y-1">
      <input type="hidden" name="emailId" value={emailId} />
      <button type="submit" disabled={pendiente} className="boton-secundario px-2 py-1 text-xs">
        {pendiente ? 'Enviando...' : 'Reintentar'}
      </button>
      {estado.error ? (
        <p role="alert" className="max-w-48 text-[11px] text-red-700">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-[11px] text-acento-800">
          {estado.ok}
        </p>
      ) : null}
    </form>
  )
}
