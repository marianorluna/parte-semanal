'use client'

import { useEffect, useRef, useState } from 'react'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import type { DiaSemana } from './RejillaSemanal'

export type CeldaCalculada = {
  fecha: string
  tareaId: string
  minutos: number
  error: string | null
}

type Props = {
  pendiente: boolean
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  celdas: CeldaCalculada[]
  avisos: string[]
  total: number
  onCerrar: () => void
  onConfirmar: () => void
}

/**
 * Doble confirmación antes de enviar: resumen legible, avisos y una casilla
 * obligatoria. Una vez enviado el parte queda bloqueado hasta la revisión.
 * El padre solo lo monta cuando está abierto, así el estado arranca limpio.
 */
export function ModalEnvio({
  pendiente,
  dias,
  grupos,
  celdas,
  avisos,
  total,
  onCerrar,
  onConfirmar,
}: Props) {
  const [revisado, setRevisado] = useState(false)
  const dialogoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogoRef.current?.focus()

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsarTecla)
    return () => document.removeEventListener('keydown', alPulsarTecla)
  }, [onCerrar])

  const porDia = dias
    .map((dia) => ({
      dia,
      minutos: celdas
        .filter((celda) => celda.fecha === dia.fecha)
        .reduce((suma, celda) => suma + celda.minutos, 0),
    }))
    .filter((fila) => fila.minutos > 0)

  const porProyecto = grupos
    .map((grupo) => {
      const ids = new Set(grupo.tareas.map((tarea) => tarea.tareaId))
      const minutos = celdas
        .filter((celda) => ids.has(celda.tareaId))
        .reduce((suma, celda) => suma + celda.minutos, 0)
      return { grupo, minutos }
    })
    .filter((fila) => fila.minutos > 0)

  const diasSinHoras = dias.filter(
    (dia, indice) => indice < 5 && !celdas.some((celda) => celda.fecha === dia.fecha && celda.minutos > 0),
  )

  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="envio-titulo"
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-xl sm:pb-5"
      >
        <h2 id="envio-titulo" className="text-lg font-semibold text-slate-900">
          Revisar y enviar el parte
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Comprueba las horas antes de enviar. Después queda bloqueado: solo podrás corregirlo si tu
          encargado lo reabre.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200">
            <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Por día
            </h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {porDia.map((fila) => (
                <li key={fila.dia.fecha} className="flex justify-between px-3 py-1.5">
                  <span className="capitalize text-slate-700">
                    {fila.dia.dia} {fila.dia.fecha.slice(8, 10)}/{fila.dia.fecha.slice(5, 7)}
                  </span>
                  <span className="font-mono text-slate-800">{formatearHorasReloj(fila.minutos)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-slate-200">
            <h3 className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Por proyecto
            </h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {porProyecto.map((fila) => (
                <li key={fila.grupo.proyectoId} className="flex justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 truncate text-slate-700">
                    <span className="font-medium text-slate-900">{fila.grupo.proyectoCodigo}</span> ·{' '}
                    {fila.grupo.proyectoNombre}
                  </span>
                  <span className="shrink-0 font-mono text-slate-800">{formatearHorasReloj(fila.minutos)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between rounded-md bg-marca-50 px-3 py-2">
          <span className="text-sm font-semibold text-marca-900">Total de la semana</span>
          <span className="font-mono text-lg font-bold text-marca-900">{formatearHorasReloj(total)}</span>
        </div>

        {avisos.length > 0 || diasSinHoras.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
            {diasSinHoras.length > 0 ? (
              <li>
                Sin horas en {diasSinHoras.map((dia) => dia.dia).join(', ')}. Si no trabajaste, puedes enviarlo
                igualmente.
              </li>
            ) : null}
          </ul>
        ) : null}

        <label className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={revisado}
            onChange={(evento) => setRevisado(evento.target.checked)}
            className="mt-0.5"
          />
          <span>
            He revisado el día, el proyecto y las horas. Entiendo que el parte quedará bloqueado hasta que mi
            encargado lo revise.
          </span>
        </label>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCerrar} disabled={pendiente} className="boton-secundario">
            Volver a editar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!revisado || pendiente}
            className="boton-primario"
          >
            {pendiente ? 'Enviando...' : 'Confirmar y enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
