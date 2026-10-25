import type { EstadoCumplimiento } from '@/modules/reporting/domain/cumplimiento'
import type { NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import type { Severidad } from '@/modules/reporting/domain/severidad'

/**
 * Equivalentes en hex de las clases semánticas de la web. `@react-pdf/renderer`
 * no entiende Tailwind, así que la paleta de severidad se define aquí una sola
 * vez para todos los documentos exportados.
 */
export type ColoresSemaforo = {
  fondo: string
  texto: string
  borde: string
}

export const PALETA_SEVERIDAD: Record<Severidad, ColoresSemaforo> = {
  ALERTA: { fondo: '#fee2e2', texto: '#991b1b', borde: '#fca5a5' },
  AVISO: { fondo: '#fef3c7', texto: '#92400e', borde: '#fcd34d' },
  OK: { fondo: '#cbf3e6', texto: '#045245', borde: '#98e6d0' },
  NEUTRO: { fondo: '#f1f5f9', texto: '#475569', borde: '#cbd5e1' },
}

export const PALETA_RIESGO: Record<NivelRiesgo, ColoresSemaforo> = {
  AGOTADO: PALETA_SEVERIDAD.ALERTA,
  CRITICO: { fondo: '#ffedd5', texto: '#9a3412', borde: '#fdba74' },
  AVISO: PALETA_SEVERIDAD.AVISO,
  OK: PALETA_SEVERIDAD.OK,
  SIN_PRESUPUESTO: PALETA_SEVERIDAD.NEUTRO,
  SIN_PLAZO: PALETA_SEVERIDAD.NEUTRO,
}

export const PALETA_CUMPLIMIENTO: Record<EstadoCumplimiento, ColoresSemaforo> = {
  SIN_PARTE: { fondo: '#e2e8f0', texto: '#334155', borde: '#cbd5e1' },
  BORRADOR: { fondo: '#f1f5f9', texto: '#334155', borde: '#cbd5e1' },
  ENVIADO: PALETA_SEVERIDAD.AVISO,
  APROBADO: PALETA_SEVERIDAD.OK,
  RECHAZADO: PALETA_SEVERIDAD.ALERTA,
  BLOQUEADO: { fondo: '#043a39', texto: '#ffffff', borde: '#043a39' },
}
