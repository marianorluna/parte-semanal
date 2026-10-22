'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EstadoParte } from '@/db/schema'
import { aprobarParteAction, rechazarParteAction, reabrirParteAction } from '../actions'

type Props = {
  parteId: string
  version: number
  estado: EstadoParte
}

export function AccionesRevision({ parteId, version, estado }: Props) {
  const router = useRouter()
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState<'ninguno' | 'rechazar' | 'reabrir'>('ninguno')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  async function aprobar() {
    setOcupado(true)
    setError('')
    const respuesta = await aprobarParteAction({ parteId, version })
    setOcupado(false)
    if (!respuesta.success) {
      setError(respuesta.error.message)
      return
    }
    router.refresh()
  }

  async function confirmarMotivo() {
    if (motivo.trim().length < 5) {
      setError('Escribe un motivo de al menos 5 caracteres')
      return
    }

    setOcupado(true)
    setError('')

    const respuesta =
      modo === 'rechazar'
        ? await rechazarParteAction({ parteId, version, motivo })
        : await reabrirParteAction({ parteId, version, motivo })

    setOcupado(false)

    if (!respuesta.success) {
      setError(respuesta.error.message)
      return
    }

    setModo('ninguno')
    setMotivo('')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {estado === 'ENVIADO' ? (
          <>
            <button type="button" onClick={() => void aprobar()} disabled={ocupado} className="boton-primario">
              Aprobar parte
            </button>
            <button type="button" onClick={() => setModo('rechazar')} disabled={ocupado} className="boton-peligro">
              Rechazar
            </button>
          </>
        ) : null}

        {estado === 'APROBADO' ? (
          <button type="button" onClick={() => setModo('reabrir')} disabled={ocupado} className="boton-secundario">
            Reabrir parte
          </button>
        ) : null}
      </div>

      {modo !== 'ninguno' ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <label htmlFor="motivo" className="mb-1 block text-sm font-medium text-slate-700">
            {modo === 'rechazar' ? 'Motivo del rechazo' : 'Motivo de la reapertura'}
          </label>
          <textarea
            id="motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={3}
            className="campo"
            placeholder="Explica qué debe corregir el trabajador"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void confirmarMotivo()} disabled={ocupado} className="boton-primario">
              {ocupado ? 'Guardando...' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => setModo('ninguno')} className="boton-secundario">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
