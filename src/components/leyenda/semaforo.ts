import type { Severidad } from '@/modules/reporting/domain/severidad'

/**
 * Colores del semáforo sobre la superficie oscura del hero. Vive aquí, y no en
 * `ResumenDashboard.tsx`, para que la leyenda de colores importe la misma
 * paleta sin cerrar un ciclo de módulos (el dashboard importa la leyenda).
 */
export type ClasesTile = {
  caja: string
  pastilla: string
  icono: string
}

export const TILE: Record<Severidad, ClasesTile> = {
  ALERTA: { caja: 'border-red-400/60 bg-red-500/15', pastilla: 'bg-red-400 text-red-950', icono: 'text-red-200' },
  AVISO: { caja: 'border-amber-300/60 bg-amber-400/15', pastilla: 'bg-amber-300 text-amber-950', icono: 'text-amber-200' },
  OK: { caja: 'border-acento-400/60 bg-acento-500/15', pastilla: 'bg-acento-400 text-marca-950', icono: 'text-acento-200' },
  NEUTRO: { caja: 'border-white/20 bg-white/5', pastilla: 'bg-white/20 text-white', icono: 'text-marca-200' },
}
