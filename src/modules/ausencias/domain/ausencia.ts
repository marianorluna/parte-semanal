/**
 * Reglas puras de ausencias y vacaciones: solapes, transiciones de estado,
 * reparto por fecha y efecto sobre la capacidad de la rejilla.
 *
 * Sin I/O y sin reloj: recibe las fechas ya calculadas.
 */

import { aFecha, type FechaIso, sumarDias } from '@/modules/partes/domain/fechas'

export const ESTADOS_AUSENCIA = ['SOLICITADA', 'APROBADA', 'RECHAZADA', 'ANULADA'] as const

export type EstadoAusencia = (typeof ESTADOS_AUSENCIA)[number]

export const ETIQUETAS_ESTADO_AUSENCIA: Record<EstadoAusencia, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
}

export type AusenciaVigente = {
  id: string
  empleadoId: string
  desde: FechaIso
  hasta: FechaIso
  /** Null = jornada completa. */
  minutos: number | null
  estado: EstadoAusencia
  tipoId: string
  tipoNombre: string
}

export type Saldo = {
  minutosAsignados: number
  minutosArrastrados: number
}

/** Días naturales del rango, extremos incluidos. */
export function diasEntre(desde: FechaIso, hasta: FechaIso): FechaIso[] {
  if (desde > hasta) return []

  const dias: FechaIso[] = []
  const fin = aFecha(hasta).getTime()
  let actual = desde

  // Guarda contra rangos absurdos (más de cinco años): nunca se pide tanto.
  for (let indice = 0; indice <= 1830; indice += 1) {
    dias.push(actual)
    if (aFecha(actual).getTime() >= fin) break
    actual = sumarDias(actual, 1)
  }

  return dias
}

export function rangosSolapan(a: { desde: FechaIso; hasta: FechaIso }, b: { desde: FechaIso; hasta: FechaIso }): boolean {
  return a.desde <= b.hasta && b.desde <= a.hasta
}

export const TRANSICIONES_AUSENCIA: Record<EstadoAusencia, readonly EstadoAusencia[]> = {
  SOLICITADA: ['APROBADA', 'RECHAZADA', 'ANULADA'],
  APROBADA: ['ANULADA'],
  RECHAZADA: [],
  ANULADA: [],
}

export function transicionValida(actual: EstadoAusencia, siguiente: EstadoAusencia): boolean {
  return TRANSICIONES_AUSENCIA[actual].includes(siguiente)
}

export function esVigente(estado: EstadoAusencia): boolean {
  return estado === 'APROBADA'
}

/** Minutos que consume una ausencia en un día laborable concreto. */
export function minutosEnDia(ausencia: Pick<AusenciaVigente, 'minutos'>, capacidadDiaMin: number | null): number {
  if (ausencia.minutos !== null) return ausencia.minutos
  return capacidadDiaMin ?? 0
}

export type SaldoResumen = {
  asignados: number
  arrastrados: number
  disponibles: number
  consumidos: number
  restantes: number
}

/**
 * Saldo del año: asignado más arrastre menos lo aprobado que consume saldo.
 * Las ausencias que cruzan de año se imputan por fecha, no enteras al primero.
 */
export function calcularSaldo(
  saldo: Saldo,
  consumoPorAnio: Readonly<Record<number, number>>,
  anio: number,
): SaldoResumen {
  const asignados = saldo.minutosAsignados
  const arrastrados = saldo.minutosArrastrados
  const disponibles = asignados + arrastrados
  const consumidos = Math.max(0, consumoPorAnio[anio] ?? 0)

  return {
    asignados,
    arrastrados,
    disponibles,
    consumidos,
    restantes: Math.max(0, disponibles - consumidos),
  }
}

export type DiaBase = {
  fecha: FechaIso
  laborable: boolean
  motivo: string | null
  horasTeoricasMin: number | null
}

export type DiaConAusencia = DiaBase & {
  ausencia: { id: string; nombre: string; minutos: number | null } | null
}

/**
 * Aplica las ausencias aprobadas a los días ya resueltos por el calendario.
 * - Jornada completa: el día pasa a no laborable con el nombre del tipo.
 * - Parcial: sigue laborable, pero la jornada teórica se reduce.
 */
export function aplicarAusenciasADias(
  dias: readonly DiaBase[],
  ausencias: readonly AusenciaVigente[],
): DiaConAusencia[] {
  return dias.map((dia) => {
    const delDia = ausencias.find(
      (ausencia) => ausencia.desde <= dia.fecha && dia.fecha <= ausencia.hasta,
    )

    if (!delDia) return { ...dia, ausencia: null }

    if (delDia.minutos === null) {
      // Un festivo o fin de semana ya cerrado no cambia de capacidad por una
      // ausencia, pero sí se muestra el tipo para no confundir al trabajador.
      if (!dia.laborable) {
        return {
          ...dia,
          ausencia: { id: delDia.id, nombre: delDia.tipoNombre, minutos: null },
        }
      }

      return {
        ...dia,
        laborable: false,
        motivo: delDia.tipoNombre,
        horasTeoricasMin: dia.horasTeoricasMin === null ? null : 0,
        ausencia: { id: delDia.id, nombre: delDia.tipoNombre, minutos: null },
      }
    }

    return {
      ...dia,
      horasTeoricasMin:
        dia.horasTeoricasMin === null ? null : Math.max(0, dia.horasTeoricasMin - delDia.minutos),
      ausencia: { id: delDia.id, nombre: delDia.tipoNombre, minutos: delDia.minutos },
    }
  })
}

export function capacidadDeDias(dias: readonly DiaConAusencia[]): number | null {
  if (dias.every((dia) => dia.horasTeoricasMin === null)) return null
  return dias.reduce((suma, dia) => suma + (dia.horasTeoricasMin ?? 0), 0)
}

export type CapacidadDia = { laborable: boolean; horasTeoricasMin: number | null }

/**
 * Reparte el consumo de una ausencia por año natural, saltando días no
 * laborables. Es la base del saldo de vacaciones cuando la ausencia cruza año.
 */
export function consumoPorAnio(
  ausencia: Pick<AusenciaVigente, 'desde' | 'hasta' | 'minutos'>,
  capacidad: Readonly<Record<string, CapacidadDia>>,
): Record<number, number> {
  const consumo: Record<number, number> = {}

  for (const fecha of diasEntre(ausencia.desde, ausencia.hasta)) {
    const dia = capacidad[fecha]
    if (!dia || !dia.laborable) continue

    const disponible = dia.horasTeoricasMin
    const minutos =
      ausencia.minutos === null
        ? (disponible ?? 0)
        : disponible === null
          ? ausencia.minutos
          : Math.min(ausencia.minutos, disponible)

    if (minutos <= 0) continue

    const anio = Number(fecha.slice(0, 4))
    consumo[anio] = (consumo[anio] ?? 0) + minutos
  }

  return consumo
}
