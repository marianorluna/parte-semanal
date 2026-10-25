'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EstadoParte } from '@/db/schema'
import { EtiquetaIA } from '@/components/HerramientaIA'
import { Icono } from '@/components/Iconos'
import { aprobarParteAction, rechazarParteAction, reabrirParteAction } from '../actions'
import { redactarMotivoAction } from './acciones-ia'

type Props = {
  parteId: string
  version: number
  estado: EstadoParte
  iaDisponible?: boolean
}

export function AccionesRevision({ parteId, version, estado, iaDisponible = false }: Props) {
  const router = useRouter()
  const [motivo, setMotivo] = useState('')
  const [modo, setModo] = useState<'ninguno' | 'rechazar' | 'reabrir'>('ninguno')
  const [ocupado, setOcupado] = useState(false)
  const [redactando, setRedactando] = useState(false)
  const [error, setError] = useState('')
  const refMotivo = useRef<HTMLTextAreaElement>(null)

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

  async function redactar() {
    setRedactando(true)
    setError('')

    const respuesta = await redactarMotivoAction({ parteId })

    setRedactando(false)

    if (!respuesta.ok) {
      setError(respuesta.error)
      return
    }

    setMotivo((actual) => (actual.trim() ? `${actual.trim()}\n\n${respuesta.texto}` : respuesta.texto))
    requestAnimationFrame(() => refMotivo.current?.focus())
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

        {estado === 'APROBADO' || estado === 'ENVIADO' ? (
          <button type="button" onClick={() => setModo('reabrir')} disabled={ocupado} className="boton-secundario">
            Reabrir para corregir
          </button>
        ) : null}
      </div>

      {estado === 'BLOQUEADO' ? (
        <p className="rounded-md border border-marca-200 bg-marca-50 px-3 py-2 text-sm text-marca-900">
          Este parte está bloqueado por el cierre del periodo. Reabre el periodo en Administración &gt; Cierres
          para poder corregirlo.
        </p>
      ) : null}

      {modo !== 'ninguno' ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <label htmlFor="motivo" className="mb-1 block text-sm font-medium text-slate-700">
            {modo === 'rechazar' ? 'Motivo del rechazo' : 'Motivo de la reapertura'}
          </label>
          <textarea
            id="motivo"
            ref={refMotivo}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            rows={3}
            className="campo"
            placeholder="Explica qué debe corregir el trabajador"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirmarMotivo()} disabled={ocupado} className="boton-primario">
              {ocupado ? 'Guardando...' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => setModo('ninguno')} className="boton-secundario">
              Cancelar
            </button>
          </div>

          {modo === 'rechazar' && iaDisponible ? (
            <div className="mt-3 rounded-lg border border-marca-200 bg-linear-to-br from-acento-50 via-white to-marca-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <EtiquetaIA compacta />
                  <p className="mt-1 text-xs text-slate-600">
                    Redacta un borrador con los datos del parte. El texto es tuyo: revísalo y edítalo
                    antes de confirmar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void redactar()}
                  disabled={ocupado || redactando}
                  className="boton-secundario px-3 py-1.5 text-xs"
                >
                  <Icono nombre="chispa" className="h-4 w-4 text-marca-700" />
                  {redactando ? 'Redactando...' : 'Redactar motivo'}
                </button>
              </div>
            </div>
          ) : null}
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
