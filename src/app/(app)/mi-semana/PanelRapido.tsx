'use client'

import { useMemo, useRef, useState } from 'react'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj, horasAMinutos } from '@/modules/partes/domain/horas'
import type { DiaSemana } from './RejillaSemanal'

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
  onDeshacer: () => void
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
  onDeshacer,
}: Props) {
  const [fecha, setFecha] = useState(diaInicial)
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

  const dia = dias.find((candidato) => candidato.fecha === fecha) ?? dias[0]

  return (
    <section className="tarjeta p-3 sm:p-4" aria-labelledby="carga-rapida-titulo">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="carga-rapida-titulo" className="text-sm font-semibold text-slate-900">
          Añadir horas
        </h2>
        <p className="text-xs text-slate-500">Se suma a lo que ya haya en ese día.</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Día de la imputación">
        {dias.map((candidato) => {
          const activo = candidato.fecha === fecha
          return (
            <button
              key={candidato.fecha}
              type="button"
              onClick={() => setFecha(candidato.fecha)}
              disabled={deshabilitado}
              aria-pressed={activo}
              className={`flex min-w-14 flex-col items-center rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                activo
                  ? 'border-marca-700 bg-marca-700 text-white'
                  : candidato.esHoy
                    ? 'border-acento-400 bg-acento-50 text-marca-900 hover:bg-acento-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="capitalize">{candidato.dia}</span>
              <span className={`text-[11px] font-normal ${activo ? 'text-marca-100' : 'text-slate-500'}`}>
                {candidato.fecha.slice(8, 10)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
        <label className="text-xs font-medium text-slate-600 lg:col-span-4">
          Proyecto
          <select
            value={proyectoId}
            onChange={(evento) => cambiarProyecto(evento.target.value)}
            disabled={deshabilitado}
            className="campo mt-1 py-1.5 text-sm"
          >
            {grupos.map((grupo) => (
              <option key={grupo.proyectoId} value={grupo.proyectoId}>
                {grupo.proyectoCodigo} · {grupo.proyectoNombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-slate-600 lg:col-span-4">
          Tarea
          <select
            value={tareaId}
            onChange={(evento) => setTareaId(evento.target.value)}
            disabled={deshabilitado}
            className="campo mt-1 py-1.5 text-sm"
          >
            {tareasDelProyecto.map((tarea) => (
              <option key={tarea.tareaId} value={tarea.tareaId}>
                {tarea.tareaCodigo} · {tarea.tareaNombre}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs font-medium text-slate-600 lg:col-span-2">
          <label htmlFor="carga-rapida-horas">Horas</label>
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
            className="campo mt-1 py-1.5 text-center text-sm"
            autoComplete="off"
          />
        </div>

        <div className="flex items-end lg:col-span-2">
          <button
            type="button"
            onClick={anadir}
            disabled={deshabilitado}
            className="boton-primario w-full py-2 text-sm"
          >
            Añadir
          </button>
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
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {etiquetaPreset(preset)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />
        <button
          type="button"
          onClick={() => ajustarMinutos(-30)}
          disabled={deshabilitado}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          aria-label="Restar media hora"
        >
          -30 min
        </button>
        <button
          type="button"
          onClick={() => ajustarMinutos(30)}
          disabled={deshabilitado}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
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
    </section>
  )
}
