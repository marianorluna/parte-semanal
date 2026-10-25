import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icono, type NombreIcono } from './Iconos'

/**
 * Acciones con icono y etiqueta contextual. En móvil la etiqueta se apila bajo
 * el icono en 11 px: no hay `hover` ni `title` en táctil, así que el único
 * modo de saber qué hace el botón es leerlo. Desde `md` icono y etiqueta
 * vuelven a compartir fila.
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
  /** Nombre accesible completo: se usa en `aria-label` y `title`. */
  etiqueta: string
  /** Variante abreviada para móvil; desde `md` se muestra la etiqueta completa. */
  etiquetaCorta?: string
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
  soloIcono = false,
}: Pick<PropsAccionIcono, 'variante' | 'oscuro' | 'soloIcono'>): string {
  const base = oscuro ? VARIANTES_OSCURAS[variante] : VARIANTES[variante]
  const disposicion = soloIcono
    ? 'gap-2 px-2.5 text-sm'
    : 'flex-col gap-0.5 px-2 py-1 text-[11px] leading-tight md:flex-row md:gap-2 md:px-2.5 md:py-0 md:text-sm md:leading-normal'
  return `inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${disposicion} ${base}`
}

function ContenidoAccion({
  icono,
  etiqueta,
  etiquetaCorta,
  contador,
  soloIcono = false,
}: Pick<PropsAccionIcono, 'icono' | 'etiqueta' | 'etiquetaCorta' | 'contador' | 'soloIcono'>) {
  return (
    <>
      <span className="relative inline-flex">
        <Icono nombre={icono} className="h-5 w-5" />
        {contador && contador > 0 ? (
          <span className="absolute -top-2 -right-2.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-acento-500 px-1 text-[10px] leading-4 font-bold text-marca-950">
            {contador > 99 ? '99+' : contador}
          </span>
        ) : null}
      </span>
      {soloIcono ? (
        <span className="sr-only">{etiqueta}</span>
      ) : etiquetaCorta ? (
        <>
          <span className="text-center md:hidden">{etiquetaCorta}</span>
          <span className="hidden text-left md:inline">{etiqueta}</span>
        </>
      ) : (
        <span className="text-center md:text-left">{etiqueta}</span>
      )}
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
