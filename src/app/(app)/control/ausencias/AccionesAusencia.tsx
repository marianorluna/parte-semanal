'use client'

import { useActionState } from 'react'
import {
  aprobarAusenciaAction,
  rechazarAusenciaAction,
  type EstadoResolucion,
} from './actions'

const inicial: EstadoResolucion = {}

export function AccionesAusencia({ ausenciaId }: { ausenciaId: string }) {
  const [aprobarEstado, aprobar, aprobando] = useActionState(aprobarAusenciaAction, inicial)
  const [rechazarEstado, rechazar, rechazando] = useActionState(rechazarAusenciaAction, inicial)

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={aprobar}>
          <input type="hidden" name="ausenciaId" value={ausenciaId} />
          <button type="submit" disabled={aprobando} className="boton-primario px-2 py-1 text-xs">
            {aprobando ? 'Aprobando...' : 'Aprobar'}
          </button>
        </form>
      </div>

      <form action={rechazar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="ausenciaId" value={ausenciaId} />
        <input
          name="motivo"
          required
          minLength={5}
          className="campo w-full max-w-xs text-xs"
          placeholder="Motivo del rechazo"
        />
        <button type="submit" disabled={rechazando} className="boton-secundario px-2 py-1 text-xs">
          {rechazando ? 'Rechazando...' : 'Rechazar'}
        </button>
      </form>

      {aprobarEstado.error ? <p className="text-xs text-red-700">{aprobarEstado.error}</p> : null}
      {aprobarEstado.ok ? <p className="text-xs text-acento-800">{aprobarEstado.ok}</p> : null}
      {rechazarEstado.error ? <p className="text-xs text-red-700">{rechazarEstado.error}</p> : null}
      {rechazarEstado.ok ? <p className="text-xs text-acento-800">{rechazarEstado.ok}</p> : null}
    </div>
  )
}
