'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type EnlaceNav = {
  href: string
  etiqueta: string
  contador?: number
}

function estaActivo(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`)
}

function Contador({ valor }: { valor?: number }) {
  if (!valor || valor <= 0) return null
  return (
    <span className="rounded-full bg-acento-400 px-1.5 py-0.5 text-[11px] font-bold text-marca-950">
      {valor}
    </span>
  )
}

/** Barra horizontal de escritorio. Por debajo de `lg` se usa el drawer. */
export function NavegacionEscritorio({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="hidden items-center gap-1 overflow-x-auto scroll-oscuro lg:flex"
    >
      {enlaces.map((enlace) => {
        const activo = estaActivo(ruta, enlace.href)
        return (
          <Link
            key={enlace.href}
            href={enlace.href}
            aria-current={activo ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
              activo
                ? 'bg-white font-semibold text-marca-900 shadow-sm'
                : 'font-medium text-marca-100 hover:bg-marca-800 hover:text-white'
            }`}
          >
            {enlace.etiqueta}
            <Contador valor={enlace.contador} />
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Menú lateral para móvil y tablet. Sin dependencias: overlay, bloqueo de
 * scroll, cierre con Escape, foco al abrir y devolución del foco al cerrar.
 */
export function MenuNavegacion({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname()
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Derivado de la ruta: al navegar el menú se cierra sin efectos adicionales.
  const abierto = abiertaEn === ruta

  const cerrar = useCallback(() => {
    setAbiertaEn(null)
    botonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!abierto) return

    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar()
        return
      }
      if (evento.key !== 'Tab' || !panelRef.current) return

      const enfocables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((elemento) => elemento.offsetParent !== null)
      if (enfocables.length === 0) return

      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (!primero || !ultimo) return

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = anterior
    }
  }, [abierto, cerrar])

  const panel = abierto ? (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={cerrar}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50"
      />
      <div
        ref={panelRef}
        id="menu-navegacion"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación principal"
        className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-marca-900 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-marca-800 px-4 py-3">
          <span className="text-xs font-semibold tracking-widest text-acento-300 uppercase">Menú</span>
          <button
            type="button"
            onClick={cerrar}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-marca-600 text-white transition-colors hover:bg-marca-800"
            aria-label="Cerrar menú"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav
          aria-label="Navegación principal"
          className="scroll-oscuro flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {enlaces.map((enlace) => {
            const activo = estaActivo(ruta, enlace.href)
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-base transition-colors ${
                  activo
                    ? 'bg-white font-semibold text-marca-900 shadow-sm'
                    : 'font-medium text-marca-100 hover:bg-marca-800 hover:text-white'
                }`}
              >
                {enlace.etiqueta}
                <Contador valor={enlace.contador} />
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  ) : null

  return (
    <div className="lg:hidden">
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbiertaEn(abierto ? null : ruta)}
        aria-expanded={abierto}
        aria-controls="menu-navegacion"
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-marca-600 text-white transition-colors hover:bg-marca-800"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          {abierto ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
