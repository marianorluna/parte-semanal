'use client'

import { useMemo, useRef, useState } from 'react'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj, horasAMinutos, MINUTOS_POR_DIA } from '@/modules/partes/domain/horas'
import { Icono } from '@/components/Iconos'
import { Select } from '@/components/Select'
import type { DiaSemana } from './RejillaSemanal'
import type { ResultadoAnadir } from './PanelRapido'

const PRESETS = [4, 7, 7.5, 8, 9] as const

function etiquetaPreset(horas: number): string {
  return Number.isInteger(horas) ? `${horas} h` : `${String(horas).replace('.', ',')} h`
}

export type CopiaDisponible = {
  origen: { isoYear: number; isoWeek: number } | null
  lineas: number
  totalMinutos: number
  omitidas: number
}

type Props = {
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  deshabilitado: boolean
  totalDia: Record<string, number>
  onRellenarDias: (fechas: string[], tareaId: string, minutos: number) => ResultadoAnadir
  copia: CopiaDisponible
  onCopiarSemana: () => ResultadoAnadir
  puedeDeshacer: boolean
  onDeshacer: () => void
}

/**
 * Modo de carga rápida: elegir proyecto, tarea y horas, y aplicarlas a los
 * días laborables marcados. La idea es resolver la semana en tres toques; el
 * ajuste fino de un día concreto vive en `AjusteManual`.
 */
export function ModoCargaRapida({
  dias,
  grupos,
  deshabilitado,
  totalDia,
  onRellenarDias,
  copia,
  onCopiarSemana,
  puedeDeshacer,
  onDeshacer,
}: Props) {
  const laborables = useMemo(
    () => dias.filter((dia) => dia.laborable).map((dia) => dia.fecha),
    [dias],
  )

  const [proyectoId, setProyectoId] = useState(grupos[0]?.proyectoId ?? '')
  const [tareaId, setTareaId] = useState(grupos[0]?.tareas[0]?.tareaId ?? '')
  const [horas, setHoras] = useState('')
  const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(() => new Set(laborables))
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const horasRef = useRef<HTMLInputElement>(null)

  const tareasDelProyecto = useMemo(
    () => grupos.find((grupo) => grupo.proyectoId === proyectoId)?.tareas ?? [],
    [grupos, proyectoId],
  )

  const diasElegidos = laborables.filter((fecha) => seleccion.has(fecha))
  const parseado = horasAMinutos(horas)
  const minutos = parseado.ok ? parseado.minutos : 0

  const diasVacios = diasElegidos.filter((fecha) => (totalDia[fecha] ?? 0) === 0)

  function cambiarProyecto(nuevoId: string) {
    setProyectoId(nuevoId)
    const grupo = grupos.find((candidato) => candidato.proyectoId === nuevoId)
    setTareaId(grupo?.tareas[0]?.tareaId ?? '')
  }

  function alternarDia(fecha: string) {
    setSeleccion((anterior) => {
      const copiaSeleccion = new Set(anterior)
      if (copiaSeleccion.has(fecha)) copiaSeleccion.delete(fecha)
      else copiaSeleccion.add(fecha)
      return copiaSeleccion
    })
    setError('')
  }

  function ajustarMinutos(delta: number) {
    const actual = horasAMinutos(horas)
    if (!actual.ok) {
      setError(actual.error)
      return
    }
    const nuevo = Math.min(Math.max(actual.minutos + delta, 0), MINUTOS_POR_DIA)
    setHoras(nuevo === 0 ? '' : formatearHorasReloj(nuevo))
    setError('')
    horasRef.current?.focus()
  }

  function rellenar() {
    setMensaje('')
    setError('')

    if (!parseado.ok) {
      setError(parseado.error)
      return
    }
    if (parseado.minutos <= 0) {
      setError('Escribe o elige las horas antes de rellenar')
      return
    }
    if (!tareaId) {
      setError('Selecciona una tarea')
      return
    }
    if (diasElegidos.length === 0) {
      setError('Marca al menos un día')
      return
    }

    const resultado = onRellenarDias(diasElegidos, tareaId, parseado.minutos)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setMensaje(resultado.mensaje)
  }

  function copiar() {
    setMensaje('')
    setError('')
    const resultado = onCopiarSemana()
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setMensaje(resultado.mensaje)
  }

  const puedeCopiar = copia.origen !== null && copia.lineas > 0

  return (
    <div className="space-y-3">
      <section className="tarjeta p-3 sm:p-4" aria-labelledby="modo-rapido-titulo">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="modo-rapido-titulo" className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Icono nombre="rayo" className="h-4 w-4 text-acento-600" />
            Rellenar la semana
          </h2>
          <p className="text-[11px] text-slate-500">Solo días vacíos</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            etiqueta="Proyecto"
            valor={proyectoId}
            onChange={cambiarProyecto}
            deshabilitado={deshabilitado}
            className="text-sm"
            opciones={grupos.map((grupo) => ({
              valor: grupo.proyectoId,
              etiqueta: `${grupo.proyectoCodigo} · ${grupo.proyectoNombre}`,
            }))}
          />
          <Select
            etiqueta="Tarea"
            valor={tareaId}
            onChange={(valor) => {
              setTareaId(valor)
              setError('')
            }}
            deshabilitado={deshabilitado}
            className="text-sm"
            opciones={tareasDelProyecto.map((tarea) => ({
              valor: tarea.tareaId,
              etiqueta: `${tarea.tareaCodigo} · ${tarea.tareaNombre}`,
            }))}
          />
        </div>

        <div className="mt-3">
          <label htmlFor="rapido-horas" className="block text-xs font-medium text-slate-600">
            Horas por día
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => ajustarMinutos(-30)}
              disabled={deshabilitado}
              aria-label="Restar media hora"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Icono nombre="menos" />
            </button>
            <input
              id="rapido-horas"
              ref={horasRef}
              type="text"
              inputMode="decimal"
              value={horas}
              onChange={(evento) => {
                setHoras(evento.target.value)
                setError('')
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault()
                  rellenar()
                }
              }}
              disabled={deshabilitado}
              placeholder="8:00"
              autoComplete="off"
              className="campo cifra h-11 flex-1 text-center text-lg font-semibold"
            />
            <button
              type="button"
              onClick={() => ajustarMinutos(30)}
              disabled={deshabilitado}
              aria-label="Sumar media hora"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Icono nombre="mas" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const activo = parseado.ok && parseado.minutos === Math.round(preset * 60)
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setHoras(formatearHorasReloj(Math.round(preset * 60)))
                    setError('')
                  }}
                  disabled={deshabilitado}
                  aria-pressed={activo}
                  className={`min-h-11 rounded-md border px-3 text-sm font-semibold transition-colors ${
                    activo
                      ? 'border-marca-700 bg-marca-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {etiquetaPreset(preset)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">Días</span>
            <div className="flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setSeleccion(new Set(laborables))}
                disabled={deshabilitado}
                className="font-semibold text-marca-700 hover:underline"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                disabled={deshabilitado}
                className="font-semibold text-slate-500 hover:underline"
              >
                Ninguno
              </button>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Días a rellenar">
            {dias.map((dia) => {
              const marcado = seleccion.has(dia.fecha)
              return (
                <button
                  key={dia.fecha}
                  type="button"
                  onClick={() => alternarDia(dia.fecha)}
                  disabled={deshabilitado || !dia.laborable}
                  aria-pressed={marcado}
                  title={dia.laborable ? undefined : (dia.motivo ?? 'Día no laborable')}
                  className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-md border px-0.5 py-1 text-[11px] font-semibold transition-colors ${
                    !dia.laborable
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : marcado
                        ? 'border-acento-600 bg-acento-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="max-w-full truncate capitalize">{dia.dia}</span>
                  <span className={`text-[10px] font-normal ${marcado ? 'text-acento-50' : 'text-slate-400'}`}>
                    {dia.fecha.slice(8, 10)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p className="mt-3 rounded-md bg-marca-50 px-3 py-2 text-sm text-marca-900" aria-live="polite">
          {minutos > 0 && diasVacios.length > 0 ? (
            <>
              <strong className="cifra">{diasVacios.length}</strong>{' '}
              {diasVacios.length === 1 ? 'día' : 'días'} x{' '}
              <strong className="cifra">{formatearHorasReloj(minutos)}</strong> ={' '}
              <strong className="cifra">{formatearHorasReloj(minutos * diasVacios.length)}</strong>
              {diasVacios.length < diasElegidos.length ? (
                <span className="block text-[11px] text-marca-700">
                  {diasElegidos.length - diasVacios.length} de los elegidos ya tienen horas y no se tocan.
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[13px] text-marca-800">
              Elige las horas y los días: verás el total antes de rellenar.
            </span>
          )}
        </p>

        <button
          type="button"
          onClick={rellenar}
          disabled={deshabilitado || diasVacios.length === 0 || minutos <= 0}
          className="boton-primario mt-3 w-full text-sm"
        >
          <Icono nombre="check" />
          {diasVacios.length > 0
            ? `Rellenar ${diasVacios.length} ${diasVacios.length === 1 ? 'día' : 'días'}`
            : 'Rellenar la semana'}
        </button>

        {copia.origen ? (
          <button
            type="button"
            onClick={copiar}
            disabled={deshabilitado || !puedeCopiar}
            className="boton-secundario mt-2 w-full text-sm"
          >
            <Icono nombre="deshacer" />
            Copiar la semana {copia.origen.isoWeek}
            <span className="cifra text-xs font-normal text-slate-500">
              {copia.lineas} {copia.lineas === 1 ? 'registro' : 'registros'} ·{' '}
              {formatearHorasReloj(copia.totalMinutos)}
            </span>
          </button>
        ) : null}

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
                  }}
                  className="font-semibold text-marca-700 underline hover:text-marca-900"
                >
                  Deshacer
                </button>
              ) : null}
            </p>
          ) : null}
          {copia.origen && copia.omitidas > 0 ? (
            <p className="mt-1 text-[11px] text-slate-500">
              {copia.omitidas} {copia.omitidas === 1 ? 'registro no se puede copiar' : 'registros no se pueden copiar'}: tarea
              no asignada o día no laborable.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
