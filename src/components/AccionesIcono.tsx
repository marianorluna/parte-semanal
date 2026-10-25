import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icono, type NombreIcono } from './Iconos'

/**
 * Acciones con icono y etiqueta contextual. En móvil el hueco es escaso, así
 * que el botón se queda en icono cuadrado de 44 px (el texto sigue existiendo
 * para lectores de pantalla); desde `md` se muestra la etiqueta al lado.
 */
export type VarianteAccion = 'primario' | 'secundario' | 'acento' | 'peligro' | 'fantasma'

const VARIANTES: Record<VarianteAccion, string> = {
  primario: 'border-marca-700 bg-marca-700 text-white hover:border-marca-800 hover:bg-marca-800',
  secundario: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
  acento: 'border-acento-700 bg-acento-600 text-white hover:bg-acento-700',
  peligro: 'border-red-300 bg-white text-red-700 hover:bg-red-50',
  fantasma: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
}

/** Sobre fondos oscuros (hero del dashboard y de partes). */
const VARIANTES_OSCURAS: Record<VarianteAccion, string> = {
  primario: 'border-white bg-white text-marca-900 hover:bg-marca-100',
  secundario: 'border-marca-600 bg-marca-800/60 text-white hover:bg-marca-700',
  acento: 'border-acento-400 bg-acento-600 text-white hover:bg-acento-500',
  peligro: 'border-red-300/60 bg-marca-800/60 text-red-100 hover:bg-red-900/40',
  fantasma: 'border-transparent text-marca-100 hover:bg-marca-800',
}

export type PropsAccionIcono = {
  icono: NombreIcono
  /** Texto visible desde `md` y nombre accesible siempre. */
  etiqueta: string
  variante?: VarianteAccion
  /** Contrapartida sobre superficie oscura. */
  oscuro?: boolean
  contador?: number
  /** Solo el icono también en escritorio; la etiqueta queda para lectores. */
  soloIcono?: boolean
  className?: string
}

export function clasesAccion({
  variante = 'secundario',
  oscuro = false,
}: Pick<PropsAccionIcono, 'variante' | 'oscuro'>): string {
  const base = oscuro ? VARIANTES_OSCURAS[variante] : VARIANTES[variante]
  return `inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${base}`
}

function ContenidoAccion({
  icono,
  etiqueta,
  contador,
  soloIcono = false,
}: Pick<PropsAccionIcono, 'icono' | 'etiqueta' | 'contador' | 'soloIcono'>) {
  return (
    <>
      <Icono nombre={icono} className="h-5 w-5" />
      <span className={soloIcono ? 'sr-only' : 'sr-only md:not-sr-only'}>{etiqueta}</span>
      {contador && contador > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-acento-500 px-1 text-[11px] font-bold text-marca-950">
          {contador > 99 ? '99+' : contador}
        </span>
      ) : null}
    </>
  )
}

export function EnlaceIcono({
  href,
  prefetch,
  children,
  ...props
}: PropsAccionIcono & {
  href: string
  prefetch?: boolean
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-label={props.etiqueta}
      title={props.etiqueta}
      className={`${clasesAccion(props)} ${props.className ?? ''}`}
    >
      <ContenidoAccion {...props} />
      {children}
    </Link>
  )
}

export function BotonIcono({
  onClick,
  type = 'button',
  disabled = false,
  children,
  ...props
}: PropsAccionIcono & {
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={props.etiqueta}
      title={props.etiqueta}
      className={`${clasesAccion(props)} cursor-pointer ${props.className ?? ''}`}
    >
      <ContenidoAccion {...props} />
      {children}
    </button>
  )
}
