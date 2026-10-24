import type { FechaIso } from '@/modules/partes/domain/fechas'

/**
 * Claves de idempotencia de los avisos. Repetir el cron no debe duplicar nada,
 * pero un recordatorio manual sí puede emitirse de nuevo al día siguiente.
 * Por eso la ventana forma parte de la clave (ver ADR-009).
 */
export type VentanaAviso = 'viernes' | 'lunes' | 'manual' | FechaIso

export type SemanaAviso = { isoYear: number; isoWeek: number }

function semanaClave(semana: SemanaAviso): string {
  return `${semana.isoYear}-W${String(semana.isoWeek).padStart(2, '0')}`
}

function normalizarVentana(ventana: VentanaAviso, hoy: FechaIso): string {
  if (ventana === 'manual') return `manual-${hoy}`
  if (ventana === 'viernes' || ventana === 'lunes') return ventana
  return `dia-${ventana}`
}

export function claveRecordatorio(
  usuarioId: string,
  semana: SemanaAviso,
  ventana: VentanaAviso,
  hoy: FechaIso,
): string {
  return `recordatorio:${usuarioId}:${semanaClave(semana)}:${normalizarVentana(ventana, hoy)}`
}

export function claveEquipoPendiente(
  usuarioId: string,
  semana: SemanaAviso,
  ventana: VentanaAviso,
  hoy: FechaIso,
): string {
  return `equipo-pendiente:${usuarioId}:${semanaClave(semana)}:${normalizarVentana(ventana, hoy)}`
}

export function claveRiesgoProyecto(
  usuarioId: string,
  proyectoId: string,
  nivel: string,
  hoy: FechaIso,
): string {
  return `riesgo:${usuarioId}:${proyectoId}:${nivel}:${hoy}`
}

export function claveRecordatorioManual(
  usuarioId: string,
  semana: SemanaAviso,
  hoy: FechaIso,
): string {
  return claveRecordatorio(usuarioId, semana, 'manual', hoy)
}
