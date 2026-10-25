'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  aprobarEnviadosAction,
  recordarUsuariosAction,
  type ResultadoAccion,
} from '../acciones-lote'
import { aprobarParteAction } from './actions'

function mensajeDe(resultado: ResultadoAccion): { texto: string; error: boolean } {
  return resultado.ok
    ? { texto: resultado.mensaje, error: false }
    : { texto: resultado.error, error: true }
}

export function BotonAprobar({
  parteId,
  version,
  isoYear,
  isoWeek,
}: {
  parteId: string
  version: number
  isoYear: number
  isoWeek: number
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await aprobarParteAction({ parteId, version, isoYear, isoWeek })
            setEstado(mensajeDe(resultado))
            router.refresh()
          })
        }
        className="boton-primario px-2.5 py-1 text-xs"
      >
        {pendiente ? 'Aprobando...' : 'Aprobar'}
      </button>
      {estado ? (
        <span className={`text-[11px] ${estado.error ? 'text-red-700' : 'text-acento-800'}`}>{estado.texto}</span>
      ) : null}
    </span>
  )
}

export function BotonRecordar({
  usuarioId,
  isoYear,
  isoWeek,
}: {
  usuarioId: string
  isoYear: number
  isoWeek: number
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await recordarUsuariosAction({ usuarioIds: [usuarioId], isoYear, isoWeek })
            setEstado(mensajeDe(resultado))
            router.refresh()
          })
        }
        className="boton-secundario px-2.5 py-1 text-xs"
      >
        {pendiente ? 'Enviando...' : 'Recordar'}
      </button>
      {estado ? (
        <span className={`text-[11px] ${estado.error ? 'text-red-700' : 'text-acento-800'}`}>{estado.texto}</span>
      ) : null}
    </span>
  )
}

export function AccionesLote({
  aprobables,
  recordables,
  isoYear,
  isoWeek,
}: {
  aprobables: { parteId: string; version: number }[]
  recordables: string[]
  isoYear: number
  isoWeek: number
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)

  function ejecutar(accion: () => Promise<ResultadoAccion>) {
    iniciar(async () => {
      const resultado = await accion()
      setEstado(mensajeDe(resultado))
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      {aprobables.length > 0 ? (
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            ejecutar(() => aprobarEnviadosAction({ partes: aprobables, isoYear, isoWeek }))
          }
          className="boton-primario boton-campo w-full px-3 text-xs sm:w-auto"
        >
          Aprobar los {aprobables.length} enviados
        </button>
      ) : null}

      {recordables.length > 0 ? (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => ejecutar(() => recordarUsuariosAction({ usuarioIds: recordables, isoYear, isoWeek }))}
          className="boton-secundario boton-campo w-full px-3 text-xs sm:w-auto"
        >
          Recordar a los {recordables.length} pendientes
        </button>
      ) : null}

      {estado ? (
        <span className={`text-xs ${estado.error ? 'text-red-700' : 'text-acento-800'}`}>{estado.texto}</span>
      ) : null}
    </div>
  )
}
