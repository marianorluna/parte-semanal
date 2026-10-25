'use client'

import { useMemo, useRef, useState } from 'react'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj, horasAMinutos } from '@/modules/partes/domain/horas'
import type { DiaSemana } from './RejillaSemanal'
import { Select } from '@/components/Select'

export type ResultadoAnadir =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }

type Props = {
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  diaInicial: string
  deshabilitado: boolean
  puedeDeshacer: boolean
  onAnadir: (fecha: string, tareaId: string, minutos: number) => ResultadoAnadir
  /** Sólo hace falta en el modo detalle; el compacto no rellena la semana. */
  onRellenarSemana?: (tareaId: string, minutos: number) => ResultadoAnadir
  onDeshacer: () => void
  /** Variante para el modo rápido: título de un día y sin relleno semanal. */
  compacto?: boolean
  /** Sin borde ni relleno propios: el bloque ya vive dentro de otra tarjeta. */
  sinTarjeta?: boolean
}

const PRESETS = [4, 7, 7.5, 8, 9] as const

function etiquetaPreset(horas: number): string {
  return Number.isInteger(horas) ? `${horas} h` : `${String(horas).replace('.', ',')} h`
}

/**
 * Captura rápida: día, tarea y horas en tres gestos. Suma a la celda existente
 * y deja el foco en las horas para encadenar registros sin usar el ratón.
 */
export function PanelRapido({
  dias,
  grupos,
  diaInicial,
  deshabilitado,
  puedeDeshacer,
  onAnadir,
  onRellenarSemana,
  onDeshacer,
  compacto = false,
  sinTarjeta = false,
}: Props) {
  const [fecha, setFecha] = useState(() => {
    const solicitado = dias.find((candidato) => candidato.fecha === diaInicial && candidato.laborable)
    return solicitado?.fecha ?? dias.find((candidato) => candidato.laborable)?.fecha ?? dias[0]?.fecha ?? ''
  })
  const [proyectoId, setProyectoId] = useState(grupos[0]?.proyectoId ?? '')
  const [tareaId, setTareaId] = useState(grupos[0]?.tareas[0]?.tareaId ?? '')
  const [horas, setHoras] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const horasRef = useRef<HTMLInputElement>(null)

  const tareasDelProyecto = useMemo(
    () => grupos.find((grupo) => grupo.proyectoId === proyectoId)?.tareas ?? [],
    [grupos, proyectoId],
  )

  function cambiarProyecto(nuevoId: string) {
    setProyectoId(nuevoId)
    const grupo = grupos.find((candidato) => candidato.proyectoId === nuevoId)
    setTareaId(grupo?.tareas[0]?.tareaId ?? '')
  }

  function ajustarMinutos(delta: number) {
    const actual = horasAMinutos(horas)
    if (!actual.ok) {
      setError(actual.error)
      return
    }
    const nuevo = Math.min(Math.max(actual.minutos + delta, 0), 24 * 60)
    setHoras(nuevo === 0 ? '' : formatearHorasReloj(nuevo))
    setError('')
    horasRef.current?.focus()
  }

  function anadir() {
    setMensaje('')
    setError('')

    const parseado = horasAMinutos(horas)
    if (!parseado.ok) {
      setError(parseado.error)
      return
    }
    if (parseado.minutos <= 0) {
      setError('Escribe o elige las horas antes de añadir')
      return
    }
    if (!tareaId) {
      setError('Selecciona una tarea')
      return
    }

    const resultado = onAnadir(fecha, tareaId, parseado.minutos)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }

    setMensaje(resultado.mensaje)
    setHoras('')
    horasRef.current?.focus()
  }

  function rellenarSemana() {
    setMensaje('')
    setError('')

    if (!onRellenarSemana) return

    const parseado = horasAMinutos(horas)
    if (!parseado.ok) {
      setError(parseado.error)
      return
    }
    if (parseado.minutos <= 0) {
      setError('Escribe o elige las horas antes de rellenar la semana')
      return
    }
    if (!tareaId) {
      setError('Selecciona una tarea')
      return
    }

    const resultado = onRellenarSemana(tareaId, parseado.minutos)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }

    setMensaje(resultado.mensaje)
    setHoras('')
    horasRef.current?.focus()
  }

  const dia = dias.find((candidato) => candidato.fecha === fecha) ?? dias[0]

  return (
    <section
      className={sinTarjeta ? '' : 'tarjeta p-3 sm:p-4'}
      aria-labelledby={sinTarjeta ? undefined : 'carga-rapida-titulo'}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={sinTarjeta ? undefined : 'carga-rapida-titulo'}
          className="text-sm font-semibold text-slate-900"
        >
          {compacto ? 'Añadir horas a este día' : 'Añadir horas'}
        </h2>
        <p className="text-xs text-slate-500">
          {compacto ? 'Se suma a lo que ya haya.' : 'Se suma a lo que ya haya en ese día.'}
        </p>
      </div>

      {compacto ? null : (
        <div className="mb-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="group" aria-label="Día de la imputación">
          {dias.map((candidato) => {
            const activo = candidato.fecha === fecha
            return (
              <button
                key={candidato.fecha}
                type="button"
                onClick={() => setFecha(candidato.fecha)}
                disabled={deshabilitado || !candidato.laborable}
                aria-pressed={activo}
                title={candidato.laborable ? undefined : (candidato.motivo ?? 'Día no laborable')}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-md border px-1 py-1.5 text-xs font-semibold transition-colors ${
                  activo
                    ? 'border-marca-700 bg-marca-700 text-white'
                    : !candidato.laborable
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : candidato.esHoy
                        ? 'border-acento-400 bg-acento-50 text-marca-900 hover:bg-acento-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="max-w-full truncate capitalize">{candidato.dia}</span>
                <span className={`text-[11px] font-normal ${activo ? 'text-marca-100' : 'text-slate-500'}`}>
                  {candidato.fecha.slice(8, 10)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_9rem_max-content]">
        <Select
          etiqueta="Proyecto"
          valor={proyectoId}
          onChange={cambiarProyecto}
          deshabilitado={deshabilitado}
          className="text-sm"
          classNameContenedor="sm:col-span-3 lg:col-span-1"
          opciones={grupos.map((grupo) => ({
            valor: grupo.proyectoId,
            etiqueta: `${grupo.proyectoCodigo} · ${grupo.proyectoNombre}`,
          }))}
        />

        <Select
          etiqueta="Tarea"
          valor={tareaId}
          onChange={setTareaId}
          deshabilitado={deshabilitado}
          className="text-sm"
          classNameContenedor="sm:col-span-3 lg:col-span-1"
          opciones={tareasDelProyecto.map((tarea) => ({
            valor: tarea.tareaId,
            etiqueta: `${tarea.tareaCodigo} · ${tarea.tareaNombre}`,
          }))}
        />

        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label htmlFor="carga-rapida-horas" className="block text-xs font-medium text-slate-600">
            Horas
          </label>
          <input
            id="carga-rapida-horas"
            ref={horasRef}
            type="text"
            inputMode="decimal"
            value={horas}
            onChange={(evento) => setHoras(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault()
                anadir()
              }
            }}
            disabled={deshabilitado}
            placeholder="7,5"
            className="campo mt-1 block text-center text-sm"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-4 sm:flex-row sm:items-end lg:col-span-1 lg:justify-end">
          <button
            type="button"
            onClick={anadir}
            disabled={deshabilitado}
            className="boton-primario boton-campo w-full text-sm whitespace-nowrap sm:w-auto sm:flex-1 lg:flex-none"
          >
            Añadir
          </button>
          {compacto ? null : (
            <button
              type="button"
              onClick={rellenarSemana}
              disabled={deshabilitado}
              aria-describedby="rellenar-semana-ayuda"
              title="Copia estas horas en los días laborables vacíos del calendario"
              className="boton-acento boton-campo w-full text-sm whitespace-nowrap sm:w-auto sm:flex-1 lg:flex-none"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
              >
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Rellenar semana
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setHoras(String(preset).replace('.', ','))
              setError('')
              horasRef.current?.focus()
            }}
            disabled={deshabilitado}
            className="min-h-11 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {etiquetaPreset(preset)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => ajustarMinutos(-30)}
          disabled={deshabilitado}
          className="min-h-11 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          aria-label="Restar media hora"
        >
          -30 min
        </button>
        <button
          type="button"
          onClick={() => ajustarMinutos(30)}
          disabled={deshabilitado}
          className="min-h-11 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          aria-label="Sumar media hora"
        >
          +30 min
        </button>
      </div>

      <div aria-live="polite" className="min-h-6">
        {error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            {error}
          </p>
        ) : null}
        {mensaje ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-acento-800">
            <span>{mensaje}</span>
            {puedeDeshacer ? (
              <button
                type="button"
                onClick={() => {
                  onDeshacer()
                  setMensaje('')
                  horasRef.current?.focus()
                }}
                className="font-semibold text-marca-700 underline hover:text-marca-900"
              >
                Deshacer
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      {dia ? (
        <p className="mt-1 text-[11px] text-slate-400">
          Se añadirá al {dia.dia} {dia.fecha.slice(8, 10)}/{dia.fecha.slice(5, 7)}. Acepta 7,5 · 7.5 · 7:30.
        </p>
      ) : null}
      {compacto ? null : (
        <p id="rellenar-semana-ayuda" className="text-[11px] text-slate-400">
          «Rellenar semana» copia estas horas en los días laborables de la semana y respeta los días que ya tengan
          horas.
        </p>
      )}
    </section>
  )
}
