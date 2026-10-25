'use client'

import { useState, useTransition } from 'react'
import { Icono } from '@/components/Iconos'
import { TarjetaIA } from '@/components/HerramientaIA'
import { resumirSemanaAction } from './acciones-ia'

type Props = {
  isoYear: number
  isoWeek: number
  disponible: boolean
}

/**
 * Herramienta con IA de solo lectura. Nunca escribe, aprueba ni rechaza: solo
 * narra datos que la app ya calculó. El usuario puede plegarla para no perder
 * altura en el panel y limpiar el resultado cuando ya lo ha usado.
 */
export function BriefingSemanal({ isoYear, isoWeek, disponible }: Props) {
  const [pendiente, iniciar] = useTransition()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)

  const hayContenido = Boolean(texto || error)

  function generar() {
    setError('')
    setCopiado(false)

    iniciar(async () => {
      const respuesta = await resumirSemanaAction({ isoYear, isoWeek })
      if (respuesta.ok) {
        setTexto(respuesta.texto)
        return
      }
      setError(respuesta.error)
    })
  }

  function borrar() {
    setTexto('')
    setError('')
    setCopiado(false)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2_000)
    } catch {
      setError('No se pudo copiar el texto al portapapeles')
    }
  }

  return (
    <TarjetaIA
      titulo="Briefing de la semana"
      descripcion="Resume partes pendientes, rechazos y proyectos en riesgo para que sepas por dónde empezar."
      acciones={
        <>
          {hayContenido ? (
            <button
              type="button"
              onClick={borrar}
              className="boton-secundario px-3 py-1.5 text-xs"
              aria-label="Borrar el resumen generado"
              title="Borrar el resumen generado"
            >
              <Icono nombre="cerrar" className="h-4 w-4" />
              Borrar
            </button>
          ) : null}

          {disponible ? (
            <button
              type="button"
              onClick={generar}
              disabled={pendiente}
              className="boton-primario px-3 py-1.5 text-xs"
            >
              <Icono nombre="chispa" className="h-4 w-4" />
              {pendiente ? 'Resumiendo...' : texto ? 'Volver a resumir' : 'Resumir la semana'}
            </button>
          ) : null}
        </>
      }
    >
      {!disponible ? (
        <p className="rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-600">
          El asistente de IA no está configurado. Define <code>IA_API_KEY</code> e{' '}
          <code>IA_MODELO</code> en el servidor para activarlo.
        </p>
      ) : null}

      {texto ? (
        <div className="rounded-lg border border-marca-100 bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-marca-700 uppercase">
            <Icono nombre="chispa" className="h-3.5 w-3.5" />
            Resumen generado
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-800" aria-live="polite">
            {texto}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => void copiar()}
              className="boton-secundario px-2 py-1 text-xs"
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
            <span className="text-[11px] text-slate-500">
              Sugerencia generada por IA. Revisa los datos antes de usarla.
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </TarjetaIA>
  )
}
