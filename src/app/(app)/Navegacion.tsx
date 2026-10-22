'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type EnlaceNav = {
  href: string
  etiqueta: string
  contador?: number
}

export function Navegacion({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname()

  return (
    <nav aria-label="Navegación principal" className="flex items-center gap-1 overflow-x-auto">
      {enlaces.map((enlace) => {
        const activo = ruta === enlace.href || ruta.startsWith(`${enlace.href}/`)
        return (
          <Link
            key={enlace.href}
            href={enlace.href}
            aria-current={activo ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activo
                ? 'bg-marca-800 text-white'
                : 'text-marca-100 hover:bg-marca-800 hover:text-white'
            }`}
          >
            {enlace.etiqueta}
            {enlace.contador && enlace.contador > 0 ? (
              <span className="rounded-full bg-acento-400 px-1.5 py-0.5 text-[11px] font-bold text-marca-950">
                {enlace.contador}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
