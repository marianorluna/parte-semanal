import { formatearFecha, formatearRango, type FechaIso } from '@/modules/partes/domain/fechas'
import { minutosAHorasDecimal } from '@/modules/partes/domain/horas'
import type { AvisoPanel } from '@/modules/reporting/application/avisos'
import type { ResumenCumplimiento } from '@/modules/reporting/domain/cumplimiento'
import type { NivelRiesgo } from '@/modules/reporting/domain/riesgo'
import type { Severidad } from '@/modules/reporting/domain/severidad'

export type LineaParte = {
  empleadoCodigo: string
  empleadoNombre: string
  proyectoCodigo: string
  proyectoNombre: string
  tareaCodigo: string
  tareaNombre: string
  fecha: string
  minutos: number
  estado: string
  isoYear: number
  isoWeek: number
}

export type ResumenPartesExport = {
  totalMinutos: number
  partes: number
  empleados: number
  lineas: number
}

export type DatosPartesExport = {
  empresa: string
  semana: { isoYear: number; isoWeek: number; weekStart: FechaIso; weekEnd: FechaIso }
  lineas: LineaParte[]
  resumen: ResumenPartesExport
}

export type ProyectoExport = {
  codigo: string
  nombre: string
  horasPresupuesto: number | null
  minutos: number
  consumoPct: number | null
  plazoPct: number | null
  desviacionPp: number | null
  proyeccionPct: number | null
  nivel: NivelRiesgo
  etiqueta: string
}

export type KpiExport = { etiqueta: string; valor: string; detalle: string; severidad: Severidad }

export type DatosDashboardExport = {
  empresa: string
  hoy: FechaIso
  semanaEtiqueta: string
  kpis: KpiExport[]
  avisos: AvisoPanel[]
  severidadAvisos: Severidad
  cumplimiento: ResumenCumplimiento
  proyectos: ProyectoExport[]
  tendencia: { isoWeek: number; minutos: number }[]
  top: { nombre: string; minutos: number }[]
}

export type DatosParteExport = {
  empresa: string
  parte: {
    id: string
    isoYear: number
    isoWeek: number
    weekStart: string
    weekEnd: string
    estado: string
    totalMinutos: number
    enviadoAt: Date | null
    revisadoAt: Date | null
    motivoRechazo: string | null
    revisorNombre: string | null
    empleadoNombre: string
    empleadoCodigo: string
    imputaciones: {
      id: string
      fecha: string
      minutos: number
      proyectoCodigo: string
      proyectoNombre: string
      tareaCodigo: string
      tareaNombre: string
    }[]
  }
}

export function horas(minutos: number): string {
  return minutosAHorasDecimal(minutos)
}

export function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function desviacion(valor: number | null): string {
  if (valor === null) return '—'
  return `${valor > 0 ? '+' : ''}${valor} pp`
}

export function etiquetaSemana(semana: { isoYear: number; isoWeek: number; weekStart: FechaIso; weekEnd: FechaIso }): string {
  return `Semana ${semana.isoWeek} de ${semana.isoYear} (${formatearRango(semana.weekStart, semana.weekEnd)})`
}

export function fechaLegible(fecha: FechaIso): string {
  return formatearFecha(fecha)
}

/** Nombres seguros para `Content-Disposition`: sin acentos, espacios ni barras. */
export function nombreArchivo(base: string, extension: string): string {
  const limpio = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return `${limpio || 'informe'}.${extension}`
}

export function nombreSemana(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}
