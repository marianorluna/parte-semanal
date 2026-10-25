import type { SVGProps } from 'react'

/**
 * Registro único de iconos de la interfaz. SVG inline sin dependencias: son
 * pocos, se usan una y otra vez y así heredan `currentColor` y el tamaño del
 * texto que los acompaña sin cargar una familia de iconos completa.
 */
export type NombreIcono =
  | 'calendario'
  | 'bandeja'
  | 'grafico'
  | 'menu'
  | 'campana'
  | 'descarga'
  | 'hoja'
  | 'documento'
  | 'check'
  | 'rayo'
  | 'deshacer'
  | 'reloj'
  | 'usuarios'
  | 'alerta'
  | 'filtro'
  | 'flecha-izquierda'
  | 'flecha-derecha'
  | 'cerrar'
  | 'desplegable'
  | 'mas'
  | 'menos'
  | 'lupa'
  | 'salir'

const TRAZOS: Record<NombreIcono, readonly string[]> = {
  calendario: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  bandeja: ['M3 12h5l2 3h4l2-3h5', 'M5 4h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z'],
  grafico: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  campana: ['M18 8a6 6 0 1 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9', 'M10.3 21a2 2 0 0 0 3.4 0'],
  descarga: ['M12 3v12', 'M7 11l5 5 5-5', 'M4 20h16'],
  hoja: ['M4 4h16v16H4z', 'M4 10h16', 'M10 4v16'],
  documento: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'],
  check: ['M20 6L9 17l-5-5'],
  rayo: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  deshacer: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10H9'],
  reloj: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  usuarios: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  alerta: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  filtro: ['M22 3H2l8 9.5V19l4 2v-8.5z'],
  'flecha-izquierda': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'flecha-derecha': ['M5 12h14', 'M12 5l7 7-7 7'],
  cerrar: ['M6 6l12 12', 'M18 6L6 18'],
  desplegable: ['M6 9l6 6 6-6'],
  mas: ['M12 5v14', 'M5 12h14'],
  menos: ['M5 12h14'],
  lupa: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  salir: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
}

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  nombre: NombreIcono
  /** Tamaño en píxeles; por defecto hereda del texto (`1em`) vía clase. */
  className?: string
}

export function Icono({ nombre, className = 'h-4 w-4', ...resto }: Props) {
  return (
    <svg
      {...resto}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {TRAZOS[nombre].map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  )
}
