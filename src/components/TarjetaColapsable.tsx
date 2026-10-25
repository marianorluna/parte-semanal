'use client'

import { useId, useState, type ReactNode } from 'react'
import { Icono } from './Iconos'

/**
 * Tarjeta con cabecera siempre visible y contenido plegable.
 *
 * En móvil el panel arranca cerrado para no empujar el resto de la página y
 * deja ver solo el título con su resumen; desde `md` el contenido se muestra
 * completo aunque el estado local siga cerrado, de modo que el escritorio no
 * pierde información por una preferencia pensada para pantallas pequeñas.
 */
export function TarjetaColapsable({
  titulo,
  resumen,
  accion,
  children,
  abiertaInicial = false,
  className = '',
}: {
  /** Título de la tarjeta; puede incluir icono y etiquetas. */
  titulo: ReactNode
  /** Resumen de una línea que se lee con la tarjeta cerrada. */
  resumen?: ReactNode
  /** Acción secundaria de la cabecera (un enlace, un botón). */
  accion?: ReactNode
  children: ReactNode
  abiertaInicial?: boolean
  className?: string
}) {
  const [abierta, setAbierta] = useState(abiertaInicial)
  const idContenido = useId()

  const texto = (
    <>
      <div className="text-sm font-semibold text-slate-900">{titulo}</div>
      {resumen ? <div className="mt-0.5 text-xs text-slate-500">{resumen}</div> : null}
    </>
  )

  return (
    <section className={`tarjeta ${className}`}>
      {/* La acción vive fuera del disparador: un enlace dentro de un botón
          sería interactivo anidado y rompería la navegación por teclado. */}
      <div className="flex items-start gap-2 p-4 md:hidden">
        <button
          type="button"
          onClick={() => setAbierta((valor) => !valor)}
          aria-expanded={abierta}
          aria-controls={idContenido}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
        >
          <span className="min-w-0 flex-1">{texto}</span>
          <Icono
            nombre="desplegable"
            className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
              abierta ? 'rotate-180' : ''
            }`}
          />
        </button>
        {accion ? <div className="shrink-0 self-center">{accion}</div> : null}
      </div>

      <div className="hidden items-start justify-between gap-3 p-4 md:flex">
        <div className="min-w-0">{texto}</div>
        {accion ? <div className="shrink-0">{accion}</div> : null}
      </div>

      <div id={idContenido} className={`px-4 pb-4 ${abierta ? '' : 'hidden md:block'}`}>
        {children}
      </div>
    </section>
  )
}
