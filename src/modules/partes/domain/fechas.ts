/**
 * Fechas de negocio como cadena `YYYY-MM-DD`, sin zona horaria.
 * Todo el cálculo se hace en UTC para que el resultado no dependa del reloj del servidor.
 */

export type FechaIso = string

const MS_DIA = 86_400_000
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/

export function esFechaIso(valor: unknown): valor is FechaIso {
  if (typeof valor !== 'string' || !PATRON_FECHA.test(valor)) return false
  const fecha = new Date(`${valor}T00:00:00.000Z`)
  return !Number.isNaN(fecha.getTime()) && aFechaIso(fecha) === valor
}

export function aFecha(valor: FechaIso): Date {
  if (!esFechaIso(valor)) throw new Error(`Fecha inválida: ${valor}`)
  return new Date(`${valor}T00:00:00.000Z`)
}

export function aFechaIso(fecha: Date): FechaIso {
  return fecha.toISOString().slice(0, 10)
}

export function sumarDias(fecha: FechaIso, dias: number): FechaIso {
  return aFechaIso(new Date(aFecha(fecha).getTime() + dias * MS_DIA))
}

export function diasEntre(desde: FechaIso, hasta: FechaIso): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / MS_DIA)
}

/** Lunes de la semana que contiene la fecha. */
export function inicioDeSemana(fecha: FechaIso): FechaIso {
  const d = aFecha(fecha)
  const diaSemana = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  return aFechaIso(new Date(d.getTime() - (diaSemana - 1) * MS_DIA))
}

export type SemanaIso = {
  isoYear: number
  isoWeek: number
  weekStart: FechaIso
  weekEnd: FechaIso
}

export function semanaIsoDe(fecha: FechaIso): SemanaIso {
  const d = aFecha(fecha)
  const diaSemana = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  const jueves = new Date(d.getTime() + (4 - diaSemana) * MS_DIA)
  const isoYear = jueves.getUTCFullYear()

  const primeroDeAno = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.floor((jueves.getTime() - primeroDeAno.getTime()) / MS_DIA / 7) + 1

  const weekStart = inicioDeSemana(fecha)
  return {
    isoYear,
    isoWeek,
    weekStart,
    weekEnd: sumarDias(weekStart, 6),
  }
}

/** Crea una semana ISO a partir de año y número, con la fecha del lunes. */
export function semanaIso(isoYear: number, isoWeek: number): SemanaIso {
  if (isoWeek < 1 || isoWeek > 53) throw new Error(`Semana ISO fuera de rango: ${isoWeek}`)
  const cuatroDeEnero = new Date(Date.UTC(isoYear, 0, 4))
  const lunesSemanaUno = inicioDeSemana(aFechaIso(cuatroDeEnero))
  const weekStart = sumarDias(lunesSemanaUno, (isoWeek - 1) * 7)
  const calculada = semanaIsoDe(weekStart)
  if (calculada.isoYear !== isoYear || calculada.isoWeek !== isoWeek) {
    throw new Error(`La semana ${isoWeek} no existe en el año ISO ${isoYear}`)
  }
  return calculada
}

/** Siete fechas, de lunes a domingo. */
export function diasDeSemana(isoYear: number, isoWeek: number): FechaIso[] {
  const { weekStart } = semanaIso(isoYear, isoWeek)
  return Array.from({ length: 7 }, (_, i) => sumarDias(weekStart, i))
}

/**
 * Traslada una fecha a la misma posición (lunes, martes...) de otra semana.
 * Se usa al copiar la semana anterior: mantiene el día de la semana aunque
 * cambie el año o la numeración ISO.
 */
export function trasladarFechaASemana(
  fecha: FechaIso,
  origen: Pick<SemanaIso, 'weekStart'>,
  destino: Pick<SemanaIso, 'weekStart'>,
): FechaIso {
  return sumarDias(destino.weekStart, diasEntre(origen.weekStart, fecha))
}

export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const

export function nombreDia(fecha: FechaIso): string {
  const indice = (aFecha(fecha).getUTCDay() + 6) % 7
  return DIAS_CORTOS[indice] ?? ''
}

/** Sábado o domingo según el calendario ISO. */
export function esFinDeSemana(fecha: FechaIso): boolean {
  const diaSemana = aFecha(fecha).getUTCDay()
  return diaSemana === 0 || diaSemana === 6
}

export function formatearFecha(fecha: FechaIso): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export function formatearRango(desde: FechaIso, hasta: FechaIso): string {
  return `${formatearFecha(desde)} a ${formatearFecha(hasta)}`
}

export function hoyEnZona(zona: string): FechaIso {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return partes
}
