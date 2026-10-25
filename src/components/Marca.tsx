import { MARCA } from '@/config/marca'

type Props = {
  /** `oscuro` para fondos de marca (texto claro); `claro` para fondos blancos. */
  tono?: 'oscuro' | 'claro'
  className?: string
}

/**
 * Nombre de la aplicación con el sufijo en un tono más claro. El prefijo
 * conserva el color de marca y el sufijo usa el acento para que la fórmula
 * `LEVI` + `ALGO` se lea como una familia de herramientas.
 */
export function Marca({ tono = 'oscuro', className = '' }: Props) {
  const color =
    tono === 'oscuro'
      ? { prefijo: 'text-acento-300', sufijo: 'text-acento-100' }
      : { prefijo: 'text-marca-800', sufijo: 'text-acento-600' }

  return (
    <span className={`font-semibold tracking-widest uppercase ${className}`}>
      <span className={color.prefijo}>{MARCA.prefijo}</span>
      <span className={color.sufijo}>{MARCA.sufijo}</span>
    </span>
  )
}
