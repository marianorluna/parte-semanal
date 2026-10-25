'use client'

import { useState } from 'react'
import { ESTADOS, etiquetaEstado } from '@/modules/partes/domain/parte'
import { Select } from '@/components/Select'
import { Icono } from '@/components/Iconos'

/**
 * Filtros de la bandeja. En móvil quedan plegados para no empujar la lista
 * fuera de la primera pantalla; desde `md` se muestran siempre abiertos.
 */
export function FiltrosPartes({
  isoYear,
  isoWeek,
  estado,
  proyecto,
  proyectos,
  activos,
}: {
  isoYear: number
  isoWeek: number
  estado: string
  proyecto: string
  proyectos: { id: string; codigo: string; nombre: string }[]
  activos: number
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="tarjeta p-3">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setAbierto((valor) => !valor)}
          aria-expanded={abierto}
          aria-controls="filtros-partes"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
        >
          <Icono nombre="filtro" />
          Filtros
          {activos > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-marca-700 px-1 text-[11px] font-bold text-white">
              {activos}
            </span>
          ) : null}
        </button>
        <a
          href="#bandeja"
          className="inline-flex min-h-11 items-center text-xs font-medium text-marca-700 hover:underline"
        >
          Ir a la lista
        </a>
      </div>

      <form
        id="filtros-partes"
        action="/control/partes"
        method="get"
        className={`${abierto ? 'mt-3 flex' : 'hidden'} flex-col gap-2 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-end`}
      >
        <input type="hidden" name="y" value={isoYear} />
        <input type="hidden" name="w" value={isoWeek} />
        <Select
          etiqueta="Estado"
          name="estado"
          valorInicial={estado}
          className="py-1.5 text-sm"
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            ...ESTADOS.map((valor) => ({ valor, etiqueta: etiquetaEstado(valor) })),
          ]}
        />
        <Select
          etiqueta="Proyecto"
          name="proyecto"
          valorInicial={proyecto}
          className="max-w-64 py-1.5 text-sm"
          opciones={[
            { valor: '', etiqueta: 'Todos' },
            ...proyectos.map((fila) => ({
              valor: fila.id,
              etiqueta: `${fila.codigo} · ${fila.nombre}`,
            })),
          ]}
        />
        <button type="submit" className="boton-primario boton-campo w-full text-xs md:w-auto">
          Filtrar
        </button>
      </form>
    </div>
  )
}
