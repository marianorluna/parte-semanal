'use client'

import { useId, useRef, type ReactNode } from 'react'
import { Icono } from './Iconos'

/**
 * Botón de información con su diálogo. Es solo el cascarón: el contenido llega
 * ya renderizado desde el servidor como `children`, así que este componente
 * cliente no arrastra datos ni reglas de negocio al bundle.
 *
 * Se usa el `<dialog>` nativo con `showModal()` porque aporta foco atrapado,
 * cierre con `Escape`, backdrop e inerte del resto de la página sin código
 * propio. El bloqueo del scroll de fondo vive en `globals.css`.
 */
export function DialogoAyuda({
  titulo,
  etiqueta = 'Qué significan los colores',
  children,
}: {
  titulo: string
  /** Nombre accesible del disparador. */
  etiqueta?: string
  children: ReactNode
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  function cerrar() {
    dialogoRef.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogoRef.current?.showModal()}
        aria-label={etiqueta}
        title={etiqueta}
        className="no-imprimir inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-marca-600 bg-marca-800/60 text-white transition-colors hover:bg-marca-700"
      >
        <Icono nombre="info" className="h-5 w-5" />
      </button>

      <dialog
        ref={dialogoRef}
        aria-labelledby={idTitulo}
        onClick={(evento) => {
          // El backdrop también dispara el clic en el propio diálogo.
          if (evento.target === evento.currentTarget) cerrar()
        }}
        className="no-imprimir m-auto max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <h2 id={idTitulo} className="text-sm font-semibold text-slate-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            title="Cerrar"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Icono nombre="cerrar" className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3">{children}</div>
      </dialog>
    </>
  )
}
