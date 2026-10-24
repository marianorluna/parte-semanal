import Link from 'next/link'

/**
 * Campana del encabezado. Sin estado propio: el contador se calcula en el
 * layout del servidor y se refresca al navegar o al marcar avisos como leídos.
 */
export function CampanaNotificaciones({ noLeidas }: { noLeidas: number }) {
  const etiqueta =
    noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos, todo leído'

  return (
    <Link
      href="/notificaciones"
      aria-label={etiqueta}
      title={etiqueta}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-marca-600 text-white transition-colors hover:bg-marca-800"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4.5 w-4.5"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9" />
        <path d="M10.3 21a2 2 0 0 0 3.4 0" />
      </svg>
      {noLeidas > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-acento-500 px-1 text-[10px] font-bold text-marca-950">
          {noLeidas > 99 ? '99+' : noLeidas}
        </span>
      ) : null}
    </Link>
  )
}
