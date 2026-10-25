'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cerrarSesion } from '@/app/login/actions'
import { DialogoAyuda } from '@/components/DialogoAyuda'
import { Icono } from '@/components/Iconos'

type Props = {
  usuario: { nombre: string; rol: string }
  noLeidas: number
  /** Leyenda de colores ya renderizada por el servidor; sin ella no se pinta Info. */
  leyenda?: ReactNode
}

/**
 * Menú de usuario del encabezado. Un único disparador con la inicial del
 * nombre reúne las tareas generales (avisos, ayuda de colores y cierre de
 * sesión), de modo que no haga falta un botón `Salir` suelto en la cabecera ni
 * en el panel lateral.
 *
 * Usa `<details>` nativo, igual que `MenuExportar`: aporta el estado abierto y
 * el teclado sin código propio. El cierre por clic fuera, `Escape` y cambio de
 * ruta se añaden aquí porque un desplegable abierto debe dejar de estorbar.
 */
export function MenuUsuario({ usuario, noLeidas, leyenda }: Props) {
  const detallesRef = useRef<HTMLDetailsElement>(null)
  const disparadorRef = useRef<HTMLElement>(null)
  const [abierto, setAbierto] = useState(false)
  const ruta = usePathname()

  const inicial = usuario.nombre.trim().charAt(0).toUpperCase()
  const etiquetaDisparador =
    noLeidas > 0 ? `Menú de usuario, ${noLeidas} avisos sin leer` : 'Menú de usuario'

  const cerrar = useCallback(() => {
    if (detallesRef.current) detallesRef.current.open = false
  }, [])

  // El layout sobrevive a la navegación: sin esto el panel seguiría abierto
  // sobre la página nueva tras pulsar Avisos.
  useEffect(() => {
    cerrar()
  }, [ruta, cerrar])

  useEffect(() => {
    if (!abierto) return

    function alPulsarFuera(evento: PointerEvent) {
      const detalles = detallesRef.current
      if (!detalles) return
      if (evento.target instanceof Node && detalles.contains(evento.target)) return
      detalles.open = false
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      // Escape cierra primero el diálogo modal de ayuda; el desplegable espera.
      if (document.querySelector('dialog[open]')) return
      if (!detallesRef.current?.open) return
      detallesRef.current.open = false
      disparadorRef.current?.focus()
    }

    document.addEventListener('pointerdown', alPulsarFuera)
    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera)
      document.removeEventListener('keydown', alPulsarTecla)
    }
  }, [abierto])

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
      {/* Identidad solo informativa: no abre nada, la acción vive en el avatar. */}
      <div className="hidden min-w-0 text-right lg:block">
        <p className="max-w-56 truncate text-sm leading-tight font-medium text-white">
          {usuario.nombre}
        </p>
        <p className="text-xs leading-tight text-marca-200">{usuario.rol}</p>
      </div>

      <details
        ref={detallesRef}
        onToggle={(evento) => setAbierto(evento.currentTarget.open)}
        className="relative shrink-0"
      >
        <summary
          ref={disparadorRef}
          aria-label={etiquetaDisparador}
          title={etiquetaDisparador}
          className="-m-0.5 flex cursor-pointer list-none items-center rounded-md p-0.5 text-white transition-colors hover:bg-marca-800 [&::-webkit-details-marker]:hidden"
        >
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-acento-500/20 text-sm font-bold text-acento-200 ring-1 ring-acento-400/40">
            <span aria-hidden="true">{inicial}</span>
            {noLeidas > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-1.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-acento-500 px-1 text-[10px] font-bold text-marca-950"
              >
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            ) : null}
          </span>
        </summary>

        <div className="absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-marca-100 bg-white text-slate-900 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
            <p className="text-xs text-slate-500">{usuario.rol}</p>
          </div>

          <ul className="p-1">
            <li>
              <Link
                href="/notificaciones"
                onClick={cerrar}
                className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-slate-700 transition-colors hover:bg-marca-50 hover:text-marca-900"
              >
                <Icono nombre="campana" className="h-4 w-4 text-marca-700" />
                <span className="min-w-0 flex-1 text-sm font-medium">Avisos</span>
                {noLeidas > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-acento-500 px-1.5 py-0.5 text-[11px] font-bold text-marca-950">
                    {noLeidas > 99 ? '99+' : noLeidas}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Todo leído</span>
                )}
              </Link>
            </li>

            {leyenda ? (
              <li>
                <DialogoAyuda
                  titulo="Colores y significados"
                  etiqueta="Colores y significados"
                  claseDisparador="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-marca-50 hover:text-marca-900"
                  contenidoDisparador={
                    <>
                      <Icono nombre="info" className="h-4 w-4 text-marca-700" />
                      <span className="min-w-0 flex-1 text-left">Colores y significados</span>
                    </>
                  }
                >
                  {leyenda}
                </DialogoAyuda>
              </li>
            ) : null}
          </ul>

          <form action={cerrarSesion} className="border-t border-slate-100 p-1">
            <button
              type="submit"
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
            >
              <Icono nombre="salir" className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </details>
    </div>
  )
}
