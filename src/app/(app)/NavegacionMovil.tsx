'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icono, type NombreIcono } from '@/components/Iconos'
import { PanelMenu } from './Navegacion'
import { estaActivo, type ItemNav } from './navegacion-modelo'

type Acceso = {
  href?: string
  etiqueta: string
  icono: NombreIcono
  contador?: number
}

/** Cuatro accesos como máximo: es lo que cabe sin apretar en un móvil. */
function accesosDe(rol: string, tieneEmpleado: boolean, pendientes: number, noLeidas: number): Acceso[] {
  if (rol === 'TRABAJADOR') {
    return [
      ...(tieneEmpleado ? [{ href: '/mi-semana', etiqueta: 'Mi semana', icono: 'calendario' as const }] : []),
      { href: '/mis-ausencias', etiqueta: 'Ausencias', icono: 'reloj' },
      { href: '/notificaciones', etiqueta: 'Avisos', icono: 'campana', contador: noLeidas },
      { etiqueta: 'Menú', icono: 'menu' },
    ]
  }

  if (rol === 'ADMIN') {
    return [
      ...(tieneEmpleado ? [{ href: '/mi-semana', etiqueta: 'Mi semana', icono: 'calendario' as const }] : []),
      { href: '/control/partes', etiqueta: 'Partes', icono: 'bandeja', contador: pendientes },
      { href: '/control/dashboard', etiqueta: 'Dashboard', icono: 'grafico' },
      { etiqueta: 'Menú', icono: 'menu' },
    ]
  }

  return [
    ...(tieneEmpleado ? [{ href: '/mi-semana', etiqueta: 'Mi semana', icono: 'calendario' as const }] : []),
    { href: '/control/dashboard', etiqueta: 'Dashboard', icono: 'grafico' },
    { href: '/control/partes', etiqueta: 'Partes', icono: 'bandeja', contador: pendientes },
    { etiqueta: 'Menú', icono: 'menu' },
  ]
}

/**
 * Barra inferior tipo app. Solo se pinta en móvil; desde `md` vuelve la
 * cabecera con su menú completo.
 */
export function NavegacionMovil({
  items,
  rol,
  usuario,
  cerrarSesion,
  pendientes,
  noLeidas,
  tieneEmpleado,
}: {
  items: ItemNav[]
  rol: string
  usuario: { nombre: string; rol: string }
  cerrarSesion: () => Promise<void>
  pendientes: number
  noLeidas: number
  tieneEmpleado: boolean
}) {
  const ruta = usePathname()
  const [abierto, setAbierto] = useState(false)
  const accesos = accesosDe(rol, tieneEmpleado, pendientes, noLeidas)

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="barra-inferior no-imprimir fixed inset-x-0 bottom-0 z-40 border-t border-marca-700 bg-marca-900 text-white md:hidden"
      >
        <ul className={`grid ${accesos.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {accesos.map((acceso) => {
            const activo = acceso.href ? estaActivo(ruta, acceso.href) : false
            const clases = `relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
              activo ? 'text-acento-300' : 'text-marca-200'
            }`

            return (
              <li key={acceso.etiqueta}>
                {acceso.href ? (
                  <Link href={acceso.href} aria-current={activo ? 'page' : undefined} className={clases}>
                    {activo ? (
                      <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-acento-400" />
                    ) : null}
                    <span className="relative">
                      <Icono nombre={acceso.icono} className="h-5 w-5" />
                      {acceso.contador && acceso.contador > 0 ? (
                        <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-acento-500 px-1 text-[9px] font-bold text-marca-950">
                          {acceso.contador > 99 ? '99+' : acceso.contador}
                        </span>
                      ) : null}
                    </span>
                    {acceso.etiqueta}
                  </Link>
                ) : (
                  <button type="button" onClick={() => setAbierto(true)} className={`${clases} w-full cursor-pointer`}>
                    <Icono nombre={acceso.icono} className="h-5 w-5" />
                    {acceso.etiqueta}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {abierto ? (
        <PanelMenu
          items={items}
          onCerrar={() => setAbierto(false)}
          usuario={usuario}
          cerrarSesion={cerrarSesion}
        />
      ) : null}
    </>
  )
}
