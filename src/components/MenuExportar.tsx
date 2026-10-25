'use client'

import { useEffect, useRef, useState } from 'react'
import { clasesAccion } from './AccionesIcono'
import { Icono, type NombreIcono } from './Iconos'

/** Una descarga ofrecida por el menú. */
export type AccionExportacion = {
  /** Etiqueta del formato ('CSV', 'Excel', 'PDF'); se usa en el aviso. */
  formato: string
  etiqueta: string
  descripcion: string
  href: string
  /** Nombre real del archivo, calculado en el servidor con `nombreArchivo`. */
  archivo: string
  icono: NombreIcono
}

/** Margen para que el navegador empiece la descarga antes de confirmarla. */
const RETRASO_CONFIRMACION_MS = 900
const DURACION_AVISO_MS = 8000

/**
 * Menú de exportación con nombres explícitos. Un enlace de descarga no cambia
 * de pantalla, así que sin un aviso el usuario no sabe si el botón funcionó:
 * cada opción anuncia el archivo que empieza a bajar.
 *
 * En móvil el disparador ocupa su propia fila y el panel se despliega a lo
 * ancho; desde `md` es un menú desplegable anclado a la derecha.
 */
export function MenuExportar({
  acciones,
  oscuro = false,
}: {
  acciones: AccionExportacion[]
  oscuro?: boolean
}) {
  const detallesRef = useRef<HTMLDetailsElement>(null)
  const disparadorRef = useRef<HTMLElement>(null)
  const temporizadoresRef = useRef<number[]>([])
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(
    () => () => {
      for (const id of temporizadoresRef.current) window.clearTimeout(id)
    },
    [],
  )

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

  function anunciarDescarga(accion: AccionExportacion) {
    if (detallesRef.current) detallesRef.current.open = false
    for (const id of temporizadoresRef.current) window.clearTimeout(id)
    setAviso(`Preparando ${accion.formato}...`)
    temporizadoresRef.current = [
      window.setTimeout(
        () => setAviso(`Descarga iniciada: ${accion.archivo}. Revisa las descargas del dispositivo.`),
        RETRASO_CONFIRMACION_MS,
      ),
      window.setTimeout(() => setAviso(''), DURACION_AVISO_MS),
    ]
  }

  return (
    <div className="flex max-md:basis-full flex-wrap items-center gap-2">
      <details
        ref={detallesRef}
        onToggle={(evento) => setAbierto(evento.currentTarget.open)}
        className="group relative max-md:basis-full"
      >
        <summary
          ref={disparadorRef}
          className={`${clasesAccion({ variante: 'secundario', oscuro })} cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden`}
        >
          <Icono nombre="descarga" className="h-5 w-5" />
          <span className="text-center md:text-left">Exportar</span>
          <Icono
            nombre="desplegable"
            className="hidden h-3.5 w-3.5 transition-transform group-open:rotate-180 md:block"
          />
        </summary>

        <div className="absolute inset-x-0 z-20 mt-1 overflow-hidden rounded-md border border-marca-100 bg-white shadow-lg md:inset-x-auto md:right-0 md:w-72">
          <ul className="divide-y divide-marca-50">
            {acciones.map((accion) => (
              <li key={accion.formato}>
                <a
                  href={accion.href}
                  onClick={() => anunciarDescarga(accion)}
                  className="flex min-h-11 items-center gap-2 px-3 py-2 text-slate-700 hover:bg-marca-50"
                >
                  <Icono nombre={accion.icono} className="h-4 w-4 text-marca-700" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{accion.etiqueta}</span>
                    <span className="block text-xs text-slate-500">{accion.descripcion}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <p
        role="status"
        aria-live="polite"
        className={
          aviso ? `w-full text-xs font-medium ${oscuro ? 'text-acento-200' : 'text-acento-800'}` : 'sr-only'
        }
      >
        {aviso}
      </p>
    </div>
  )
}
