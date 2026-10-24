/**
 * Reglas puras de cierre de periodos: semana ISO, mes natural, solapes y
 * cobertura de fechas. Sin I/O y sin reloj: las fechas llegan ya resueltas.
 */

import {
  aFechaIso,
  esFechaIso,
  semanaIso,
  sumarDias,
  type FechaIso,
} from '@/modules/partes/domain/fechas'

export const TIPOS_PERIODO = ['SEMANAL', 'MENSUAL'] as const

export type TipoPeriodo = (typeof TIPOS_PERIODO)[number]

export type Rango = { desde: FechaIso; hasta: FechaIso }

export type Periodo = Rango & {
  tipo: TipoPeriodo
  empresaId: string
  empleadoId: string | null
  isoYear: number | null
  isoWeek: number | null
  anio: number
  mes: number | null
}

export type EntradaCierre = {
  tipo: TipoPeriodo
  /** Semanal: nulo cierra toda la empresa. Mensual: siempre un empleado. */
  empleadoId: string | null
  isoYear?: number
  isoWeek?: number
  anio?: number
  mes?: number
}

export type ResultadoPeriodo =
  | { ok: true; periodo: Periodo }
  | { ok: false; mensaje: string; campo: string }

const ANIO_MIN = 2000
const ANIO_MAX = 2100
/** Tope de seguridad al expandir fechas: más de un año no se pide desde la UI. */
const MAX_DIAS_EXPANSION = 400

export function rangoMes(anio: number, mes: number): Rango {
  if (!Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
    throw new Error(`Año fuera de rango: ${anio}`)
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Mes fuera de rango: ${mes}`)
  }
  const desde = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`
  // Día 0 del mes siguiente: último día del mes pedido, sin depender de tablas.
  const hasta = aFechaIso(new Date(Date.UTC(anio, mes, 0)))
  return { desde, hasta }
}

export function rangoSemana(isoYear: number, isoWeek: number): Rango {
  const semana = semanaIso(isoYear, isoWeek)
  return { desde: semana.weekStart, hasta: semana.weekEnd }
}

/**
 * Resuelve el rango y los metadatos del cierre. Un cierre mensual exige
 * empleado: el mes natural se cierra por persona, no de golpe para la empresa.
 */
export function resolverPeriodo(entrada: EntradaCierre, empresaId: string): ResultadoPeriodo {
  if (entrada.tipo === 'SEMANAL') {
    const { isoYear, isoWeek } = entrada
    if (isoYear === undefined || isoWeek === undefined) {
      return { ok: false, mensaje: 'Indica el año y la semana ISO', campo: 'semana' }
    }
    try {
      const rango = rangoSemana(isoYear, isoWeek)
      return {
        ok: true,
        periodo: {
          ...rango,
          tipo: 'SEMANAL',
          empresaId,
          empleadoId: entrada.empleadoId,
          isoYear,
          isoWeek,
          anio: isoYear,
          mes: null,
        },
      }
    } catch {
      return { ok: false, mensaje: 'La semana ISO indicada no existe', campo: 'semana' }
    }
  }

  const empleadoId = entrada.empleadoId?.trim() ?? ''
  if (empleadoId.length === 0) {
    return { ok: false, mensaje: 'El cierre mensual requiere un empleado', campo: 'empleadoId' }
  }

  const { anio, mes } = entrada
  if (anio === undefined || !Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
    return { ok: false, mensaje: 'El año del cierre no es válido', campo: 'anio' }
  }
  if (mes === undefined || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { ok: false, mensaje: 'El mes del cierre no es válido', campo: 'mes' }
  }

  const rango = rangoMes(anio, mes)
  return {
    ok: true,
    periodo: {
      ...rango,
      tipo: 'MENSUAL',
      empresaId,
      empleadoId,
      isoYear: null,
      isoWeek: null,
      anio,
      mes,
    },
  }
}

export function solapaRango(a: Rango, b: Rango): boolean {
  return a.desde <= b.hasta && b.desde <= a.hasta
}

/** Solape dentro del mismo tipo y ámbito: semanal con semanal, mensual con mensual. */
export function haySolape(periodos: readonly Rango[], rango: Rango): Rango | null {
  return periodos.find((periodo) => solapaRango(periodo, rango)) ?? null
}

export function etiquetaPeriodo(periodo: {
  tipo: TipoPeriodo
  isoYear: number | null
  isoWeek: number | null
  anio: number
  mes: number | null
}): string {
  if (periodo.tipo === 'SEMANAL') {
    return `Semana ${periodo.isoWeek} de ${periodo.isoYear}`
  }
  return `Mes ${String(periodo.mes).padStart(2, '0')}/${periodo.anio}`
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? ''
}

/**
 * Fechas del rango que caen dentro de algún periodo cerrado. Se usa al
 * guardar, enviar o revisar: una fecha cerrada no admite escritura.
 */
export function fechasCubiertas(
  periodos: readonly Rango[],
  desde: FechaIso,
  hasta: FechaIso,
): FechaIso[] {
  if (!esFechaIso(desde) || !esFechaIso(hasta) || desde > hasta) return []

  const cubiertas = new Set<FechaIso>()
  let actual = desde
  for (let indice = 0; indice < MAX_DIAS_EXPANSION && actual <= hasta; indice += 1) {
    if (periodos.some((periodo) => periodo.desde <= actual && actual <= periodo.hasta)) {
      cubiertas.add(actual)
    }
    actual = sumarDias(actual, 1)
  }

  return [...cubiertas].sort()
}

export function motivoValido(motivo: string, minimo = 5): string | null {
  if (motivo.trim().length < minimo) return `El motivo debe tener al menos ${minimo} caracteres`
  return null
}
