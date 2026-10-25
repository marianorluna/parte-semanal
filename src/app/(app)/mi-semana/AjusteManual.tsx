'use client'

import { useState } from 'react'
import type { GrupoProyecto } from '@/modules/partes/application/agrupacion'
import { formatearHorasReloj } from '@/modules/partes/domain/horas'
import { Icono } from '@/components/Iconos'
import type { DiaSemana } from './RejillaSemanal'
import { PanelRapido, type ResultadoAnadir } from './PanelRapido'
import { TiraDias } from './TiraDias'

/**
 * Corrección manual de un día concreto, en un único bloque plegable.
 *
 * Antes eran dos tarjetas seguidas («Ajustar un día» y «Añadir horas a este
 * día») que alejaban la tarjeta verde del resumen. Ahora el título resume el
 * día elegido y sus horas, y el detalle solo ocupa espacio cuando se abre.
 */
export function AjusteManual({
  dias,
  grupos,
  diaSeleccionado,
  deshabilitado,
  totalDia,
  onSeleccionarDia,
  onAnadir,
  puedeDeshacer,
  onDeshacer,
}: {
  dias: DiaSemana[]
  grupos: GrupoProyecto[]
  diaSeleccionado: string
  deshabilitado: boolean
  totalDia: Record<string, number>
  onSeleccionarDia: (fecha: string) => void
  onAnadir: (fecha: string, tareaId: string, minutos: number) => ResultadoAnadir
  puedeDeshacer: boolean
  onDeshacer: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const dia = dias.find((candidato) => candidato.fecha === diaSeleccionado)
  const minutos = totalDia[diaSeleccionado] ?? 0

  return (
    <section className="tarjeta" aria-labelledby="ajuste-manual-titulo">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls="ajuste-manual"
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 p-3 text-left sm:p-4"
      >
        <span className="min-w-0">
          <span id="ajuste-manual-titulo" className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Icono nombre="reloj" className="h-4 w-4 text-marca-600" />
            Ajustar días manualmente
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {dia ? (
              <>
                <span className="capitalize">{dia.dia}</span> {dia.fecha.slice(8, 10)}/
                {dia.fecha.slice(5, 7)} · {formatearHorasReloj(minutos)} imputadas
              </>
            ) : (
              'Elige un día y añade horas a su tarea'
            )}
          </span>
        </span>
        <Icono
          nombre="desplegable"
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto ? (
        <div id="ajuste-manual" className="space-y-3 border-t border-slate-100 p-3 sm:p-4">
          <p className="text-[11px] text-slate-500">Toca el día que quieras corregir.</p>
          <TiraDias
            dias={dias}
            diaSeleccionado={diaSeleccionado}
            totalDia={totalDia}
            onSeleccionarDia={onSeleccionarDia}
          />
          <PanelRapido
            key={diaSeleccionado}
            dias={dias}
            grupos={grupos}
            diaInicial={diaSeleccionado}
            deshabilitado={deshabilitado}
            puedeDeshacer={puedeDeshacer}
            onAnadir={onAnadir}
            onDeshacer={onDeshacer}
            compacto
            sinTarjeta
          />
        </div>
      ) : null}
    </section>
  )
}
