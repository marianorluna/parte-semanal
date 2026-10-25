'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BotonIcono } from '@/components/AccionesIcono'
import { Icono } from '@/components/Iconos'
import { aprobarLoteAction } from './actions'
import { recordarUsuariosAction } from '../acciones-lote'

const LOTE = 100

type Estado = { texto: string; error: boolean } | null

/**
 * Acciones masivas del resumen: aprobar todo lo enviado y recordar a quienes
 * aún deben cargar. La aprobación va en lotes de 100 para no encadenar una
 * transacción gigante y poder informar de los fallos.
 */
export function AccionesPartes({
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
  const [confirmando, setConfirmando] = useState(false)
  const [estado, setEstado] = useState<Estado>(null)

  function aprobarTodos() {
    iniciar(async () => {
      let aprobados = 0
      let fallidos = 0

      for (let inicio = 0; inicio < aprobables.length; inicio += LOTE) {
        const partes = aprobables.slice(inicio, inicio + LOTE)
        const respuesta = await aprobarLoteAction({ partes })
        if (!respuesta.success) {
          setEstado({ texto: respuesta.error.message, error: true })
          setConfirmando(false)
          router.refresh()
          return
        }
        aprobados += respuesta.data.aprobados
        fallidos += respuesta.data.fallidos.length
      }

      setEstado({
        texto:
          fallidos > 0
            ? `${aprobados} aprobados y ${fallidos} con error`
            : `${aprobados} ${aprobados === 1 ? 'parte aprobado' : 'partes aprobados'}`,
        error: fallidos > 0,
      })
      setConfirmando(false)
      router.refresh()
    })
  }

  function recordar() {
    iniciar(async () => {
      const respuesta = await recordarUsuariosAction({
        usuarioIds: recordables,
        isoYear,
        isoWeek,
      })
      setEstado(
        respuesta.ok
          ? { texto: respuesta.mensaje, error: false }
          : { texto: respuesta.error, error: true },
      )
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {aprobables.length > 0 ? (
        confirmando ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-white/10 p-1.5 ring-1 ring-white/20">
            <span className="px-1 text-xs font-medium text-white">
              ¿Aprobar {aprobables.length} {aprobables.length === 1 ? 'parte' : 'partes'}?
            </span>
            <button
              type="button"
              onClick={aprobarTodos}
              disabled={pendiente}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded bg-acento-500 px-3 text-xs font-bold text-marca-950 hover:bg-acento-400 disabled:opacity-50"
            >
              <Icono nombre="check" className="h-4 w-4" />
              {pendiente ? 'Aprobando...' : 'Sí, aprobar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="inline-flex min-h-9 cursor-pointer items-center rounded px-2 text-xs font-semibold text-marca-100 hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <BotonIcono
            icono="check"
            etiqueta={`Aprobar los ${aprobables.length} enviados`}
            variante="primario"
            oscuro
            disabled={pendiente}
            onClick={() => {
              setEstado(null)
              setConfirmando(true)
            }}
          />
        )
      ) : null}

      {recordables.length > 0 ? (
        <BotonIcono
          icono="campana"
          etiqueta={`Recordar a los ${recordables.length} pendientes`}
          variante="secundario"
          oscuro
          disabled={pendiente}
          onClick={recordar}
        />
      ) : null}

      {estado ? (
        <span
          role="status"
          className={`text-xs font-medium ${estado.error ? 'text-red-200' : 'text-acento-200'}`}
        >
          {estado.texto}
        </span>
      ) : null}
    </div>
  )
}
