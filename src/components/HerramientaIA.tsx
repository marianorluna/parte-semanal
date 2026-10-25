'use client'

import { useId, useState, type ReactNode } from 'react'
import { Icono, type NombreIcono } from './Iconos'

/**
 * Lenguaje visual único para las herramientas con IA: insignia, icono de
 * destello, superficie destacada y filete superior. Centralizarlo evita que
 * cada función de IA invente su propia jerarquía y que una quede como un botón
 * perdido dentro de un formulario.
 */

export function EtiquetaIA({ compacta = false }: { compacta?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-marca-800 font-semibold tracking-wider text-white uppercase ${
        compacta ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[10px]'
      }`}
    >
      <Icono nombre="chispa" className="h-3 w-3 text-acento-300" />
      Herramienta con IA
    </span>
  )
}

type Props = {
  titulo: string
  descripcion: string
  /** Acciones de la cabecera (botón principal, limpiar, etc.). */
  acciones?: ReactNode
  children: ReactNode
  icono?: NombreIcono
  /** Permite plegar el contenido; la cabecera queda siempre visible. */
  colapsable?: boolean
  abiertaInicial?: boolean
}

export function TarjetaIA({
  titulo,
  descripcion,
  acciones,
  children,
  icono = 'chispa',
  colapsable = true,
  abiertaInicial = true,
}: Props) {
  const [abierta, setAbierta] = useState(abiertaInicial)
  const idContenido = useId()
  const idTitulo = useId()

  return (
    <section
      aria-labelledby={idTitulo}
      className="relative overflow-hidden rounded-xl border border-marca-200 bg-linear-to-br from-acento-50 via-white to-marca-50 p-4 shadow-sm sm:p-5"
    >
      {/* Filete superior en menta: separa la herramienta del resto de tarjetas
          sin competir con el hero oscuro que tiene justo encima. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-acento-500 via-marca-600 to-marca-800"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marca-800 text-acento-300 shadow-sm">
            <Icono nombre={icono} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <EtiquetaIA />
            <h2 id={idTitulo} className="mt-1.5 text-base font-semibold text-slate-900 sm:text-lg">
              {titulo}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">{descripcion}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {acciones}
          {colapsable ? (
            <button
              type="button"
              onClick={() => setAbierta((valor) => !valor)}
              aria-expanded={abierta}
              aria-controls={idContenido}
              aria-label={abierta ? `Ocultar ${titulo}` : `Mostrar ${titulo}`}
              title={abierta ? `Ocultar ${titulo}` : `Mostrar ${titulo}`}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-marca-200 bg-white text-marca-800 transition-colors hover:bg-marca-50"
            >
              <Icono
                nombre="desplegable"
                className={`h-4 w-4 transition-transform ${abierta ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </div>
      </div>

      <div id={idContenido} hidden={!abierta} className="mt-3">
        {children}
      </div>
    </section>
  )
}
