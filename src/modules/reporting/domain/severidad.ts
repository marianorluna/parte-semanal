import type { NivelRiesgo, ResumenRiesgo } from './riesgo'

/**
 * Semáforo de los indicadores del panel de control. Traduce cifras a una
 * severidad comparable para que la vista web y los informes exportados pinten
 * el mismo color ante el mismo dato. Función pura, sin React ni base de datos.
 */
export type Severidad = 'OK' | 'AVISO' | 'ALERTA' | 'NEUTRO'

/**
 * `NEUTRO` queda por debajo de `OK`: un indicador sin datos no debe competir
 * con un indicador que sí está bien, pero tampoco puede tapar una alerta real.
 */
const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  NEUTRO: 0,
  OK: 1,
  AVISO: 2,
  ALERTA: 3,
}

export const ETIQUETAS_SEVERIDAD: Record<Severidad, string> = {
  ALERTA: 'Atención',
  AVISO: 'Revisar',
  OK: 'En rango',
  NEUTRO: '',
}

/** Porcentaje de partes enviados o aprobados sobre el total del equipo. */
export function severidadCumplimiento(pct: number): Severidad {
  if (pct >= 90) return 'OK'
  if (pct >= 70) return 'AVISO'
  return 'ALERTA'
}

/** Días que lleva esperando el parte más antiguo sin revisar. */
export function severidadAntiguedad(dias: number): Severidad {
  if (dias <= 0) return 'NEUTRO'
  if (dias <= 5) return 'OK'
  if (dias <= 10) return 'AVISO'
  return 'ALERTA'
}

/** Partes enviados esperando revisión del encargado. */
export function severidadPendientesRevision(total: number): Severidad {
  if (total <= 0) return 'OK'
  if (total < 5) return 'AVISO'
  return 'ALERTA'
}

/** Personas que todavía no han cargado ni corregido su parte. */
export function severidadSinEnviar(total: number): Severidad {
  if (total <= 0) return 'OK'
  if (total <= 2) return 'AVISO'
  return 'ALERTA'
}

/** Proyectos con desviación de presupuesto o plazo. */
export function severidadProyectosEnRiesgo(resumen: ResumenRiesgo): Severidad {
  if (resumen.agotados > 0 || resumen.criticos > 0) return 'ALERTA'
  if (resumen.avisos > 0) return 'AVISO'
  return 'OK'
}

/** Equivalencia entre el nivel de riesgo de un proyecto y el semáforo. */
export function severidadDesdeNivelRiesgo(nivel: NivelRiesgo): Severidad {
  if (nivel === 'AGOTADO' || nivel === 'CRITICO') return 'ALERTA'
  if (nivel === 'AVISO') return 'AVISO'
  if (nivel === 'OK') return 'OK'
  return 'NEUTRO'
}

/** La severidad más grave de las dos. Conmutativa. */
export function peorSeveridad(a: Severidad, b: Severidad): Severidad {
  return ORDEN_SEVERIDAD[a] >= ORDEN_SEVERIDAD[b] ? a : b
}
