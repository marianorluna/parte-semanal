'use client'

import { cookieModo, type ModoMiSemana } from './modo'

const OPCIONES: { valor: ModoMiSemana; etiqueta: string }[] = [
  { valor: 'rapido', etiqueta: 'Rápido' },
  { valor: 'detalle', etiqueta: 'Detalle' },
]

/**
 * Conmutador de modo. La elección se guarda en una cookie para conservarla
 * entre visitas; no viaja al servidor salvo como preferencia de render.
 */
export function SelectorModo({
  modo,
  onChange,
}: {
  modo: ModoMiSemana
  onChange: (modo: ModoMiSemana) => void
}) {
  return (
    <div
      role="group"
      aria-label="Modo de carga de horas"
      className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 shadow-sm"
    >
      {OPCIONES.map((opcion) => {
        const activo = opcion.valor === modo
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              if (activo) return
              document.cookie = cookieModo(opcion.valor)
              onChange(opcion.valor)
            }}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors ${
              activo ? 'bg-marca-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opcion.valor === 'rapido' ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M4 4h16v16H4z" />
                <path d="M4 10h16" />
                <path d="M10 4v16" />
              </svg>
            )}
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
