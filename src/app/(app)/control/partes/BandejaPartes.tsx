'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { Icono } from '@/components/Iconos'

/**
 * Bandeja plegable de la lista de partes.
 *
 * En móvil los filtros llenan la pantalla, así que la lista arranca cerrada
 * detrás de un botón explícito: se entiende que ahí debajo hay resultados sin
 * tener que adivinarlo por el scroll. Desde `md` el botón desaparece y la
 * lista se muestra siempre.
 */
export function BandejaPartes({
  total,
  abiertaInicial = false,
  children,
}: {
  total: number
  /** Abierta de entrada cuando el usuario ya venía filtrando o paginando. */
  abiertaInicial?: boolean
  children: ReactNode
}) {
  const [abierta, setAbierta] = useState(abiertaInicial)
  const idLista = useId()
  const contenedorRef = useRef<HTMLDivElement>(null)

  function alternar() {
    const siguiente = !abierta
    setAbierta(siguiente)
    if (!siguiente) return
    // La lista aparece justo debajo del botón: se lleva el foco visual al
    // principio para no dejar al usuario en mitad de la página.
    requestAnimationFrame(() => contenedorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-controls={idLista}
        className="boton-primario min-h-11 w-full gap-2 px-4 text-sm md:hidden"
      >
        <Icono nombre="bandeja" className="h-5 w-5" />
        {total === 0 ? 'Ver la lista de partes' : `Ver la lista de partes (${total})`}
        <Icono
          nombre="desplegable"
          className={`h-4 w-4 transition-transform ${abierta ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={idLista}
        ref={contenedorRef}
        className={`scroll-mt-24 space-y-3 ${abierta ? '' : 'hidden md:block'}`}
      >
        {children}
      </div>
    </div>
  )
}
