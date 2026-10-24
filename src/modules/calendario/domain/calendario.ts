/**
 * Resolución pura del calendario laboral: qué días de una semana se pueden
 * imputar y con qué jornada teórica.
 *
 * Sin I/O y sin reloj: recibe el calendario ya cargado y las fechas a resolver.
 * La misma función se usa en el servidor (validación) y en el cliente (rejilla),
 * así que la UI y la API nunca discrepan.
 */

import { aFecha, type FechaIso } from '@/modules/partes/domain/fechas'
import type { AmbitoFestivo } from './festivos-espana'

export type FestivoCalendario = {
  fecha: FechaIso
  nombre: string
  ambito: AmbitoFestivo
  esLaborable: boolean
}

export type ExcepcionCalendario = {
  fecha: FechaIso
  laborable: boolean
  motivo: string
}

export type CalendarioResuelto = {
  /** Días laborables de la semana, 1 = lunes ... 7 = domingo. */
  diasSemana: readonly number[]
  festivos: readonly FestivoCalendario[]
  excepciones: readonly ExcepcionCalendario[]
  /** Jornada diaria de referencia en minutos. Null = sin jornada configurada. */
  horasDiariasMin: number | null
}

export type MotivoNoLaborable =
  | { tipo: 'FIN_DE_SEMANA' }
  | { tipo: 'FESTIVO'; nombre: string; ambito: AmbitoFestivo }
  | { tipo: 'EXCEPCION'; motivo: string }

export type DiaCalendario = {
  fecha: FechaIso
  /** 1 = lunes ... 7 = domingo. */
  diaSemana: number
  laborable: boolean
  motivo: MotivoNoLaborable | null
  /** Minutos de jornada teórica del día. Null si no hay jornada configurada. */
  horasTeoricasMin: number | null
}

/** Día ISO de la semana: lunes 1, domingo 7. */
export function diaSemanaIso(fecha: FechaIso): number {
  const dia = aFecha(fecha).getUTCDay()
  return dia === 0 ? 7 : dia
}

/** Calendario por defecto: lunes a viernes, sin festivos ni jornada teórica. */
export const CALENDARIO_POR_DEFECTO: CalendarioResuelto = {
  diasSemana: [1, 2, 3, 4, 5],
  festivos: [],
  excepciones: [],
  horasDiariasMin: null,
}

const DIAS_ISO = [1, 2, 3, 4, 5, 6, 7] as const

/** Normaliza los días de la semana: enteros 1-7, sin duplicados y ordenados. */
export function normalizarDiasSemana(dias: readonly number[]): number[] {
  const validos = new Set(dias.filter((dia) => Number.isInteger(dia) && dia >= 1 && dia <= 7))
  return DIAS_ISO.filter((dia) => validos.has(dia))
}

/**
 * Resuelve un día con esta precedencia:
 * 1. Excepción explícita (sábado abierto, puente cerrado).
 * 2. Festivo con `esLaborable` (permite abrir un festivo sin borrarlo).
 * 3. Día de la semana configurado.
 */
export function resolverDia(calendario: CalendarioResuelto, fecha: FechaIso): DiaCalendario {
  const diaSemana = diaSemanaIso(fecha)
  const horasDiariasMin = calendario.horasDiariasMin
  const cerradoTeoricas = horasDiariasMin === null ? null : 0

  const excepcion = calendario.excepciones.find((candidata) => candidata.fecha === fecha)
  if (excepcion) {
    return {
      fecha,
      diaSemana,
      laborable: excepcion.laborable,
      motivo: excepcion.laborable
        ? null
        : { tipo: 'EXCEPCION', motivo: excepcion.motivo },
      horasTeoricasMin: excepcion.laborable ? horasDiariasMin : cerradoTeoricas,
    }
  }

  const festivo = calendario.festivos.find((candidato) => candidato.fecha === fecha)
  if (festivo && !festivo.esLaborable) {
    return {
      fecha,
      diaSemana,
      laborable: false,
      motivo: { tipo: 'FESTIVO', nombre: festivo.nombre, ambito: festivo.ambito },
      horasTeoricasMin: cerradoTeoricas,
    }
  }

  const dias = normalizarDiasSemana(calendario.diasSemana)
  const laborable = dias.includes(diaSemana)
  return {
    fecha,
    diaSemana,
    laborable,
    motivo: laborable ? null : { tipo: 'FIN_DE_SEMANA' },
    horasTeoricasMin: laborable ? horasDiariasMin : cerradoTeoricas,
  }
}

/** Resuelve siete días consecutivos a partir del lunes de la semana. */
export function resolverSemana(calendario: CalendarioResuelto, weekStart: FechaIso): DiaCalendario[] {
  const inicio = aFecha(weekStart)
  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(inicio.getTime() + indice * 86_400_000).toISOString().slice(0, 10)
    return resolverDia(calendario, fecha)
  })
}

export function diasLaborables(dias: readonly DiaCalendario[]): DiaCalendario[] {
  return dias.filter((dia) => dia.laborable)
}

export function fechasLaborables(dias: readonly DiaCalendario[]): FechaIso[] {
  return diasLaborables(dias).map((dia) => dia.fecha)
}

/** Jornada teórica de la semana: suma de los días laborables. */
export function capacidadSemanal(dias: readonly DiaCalendario[]): number | null {
  if (dias.every((dia) => dia.horasTeoricasMin === null)) return null
  return dias.reduce((suma, dia) => suma + (dia.horasTeoricasMin ?? 0), 0)
}

/** Describe el motivo en lenguaje natural, para cabeceras y avisos. */
export function textoMotivo(motivo: MotivoNoLaborable | null): string {
  if (!motivo) return ''
  if (motivo.tipo === 'FIN_DE_SEMANA') return 'Fin de semana'
  if (motivo.tipo === 'FESTIVO') return `Festivo: ${motivo.nombre}`
  return motivo.motivo
}
