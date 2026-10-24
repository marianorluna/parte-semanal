'use client'

import { useState, useTransition } from 'react'
import { formatearEuros } from '@/modules/coste/domain/coste'
import { recalcularComputoAction } from '../actions'

/**
 * Recalcula el snapshot de cómputo de un parte aprobado. Es la vía explícita
 * para partes aprobados antes del motor de reglas o cuando cambió el convenio.
 */
export function BotonRecalcular({ parteId }: { parteId: string }) {
  const [pendiente, iniciar] = useTransition()
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function recalcular() {
    setMensaje(null)
    setError(null)
    iniciar(async () => {
      const respuesta = await recalcularComputoAction({ parteId })
      if (!respuesta.success) {
        setError(respuesta.error.message)
        return
      }
      setMensaje(
        `${respuesta.data.minutosBase} min base → ${respuesta.data.minutosComputados} min computados · ${formatearEuros(respuesta.data.totalCents)}`,
      )
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={recalcular}
        disabled={pendiente}
        className="text-xs font-medium text-marca-700 hover:underline disabled:opacity-60"
      >
        {pendiente ? 'Recalculando...' : 'Recalcular cómputo y coste'}
      </button>
      {mensaje ? <span className="text-xs text-acento-800">{mensaje}</span> : null}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </span>
  )
}
