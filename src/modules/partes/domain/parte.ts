import type { EstadoParte } from '@/db/schema'
import { type FechaIso, diasEntre, sumarDias, semanaIsoDe } from './fechas'
import { MINUTOS_POR_DIA, sumarMinutos } from './horas'

export const ESTADOS: readonly EstadoParte[] = ['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO']

const ETIQUETAS: Record<EstadoParte, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

const TRANSICIONES: Record<EstadoParte, readonly EstadoParte[]> = {
  BORRADOR: ['ENVIADO'],
  ENVIADO: ['APROBADO', 'RECHAZADO'],
  APROBADO: ['BORRADOR'],
  RECHAZADO: ['BORRADOR', 'ENVIADO'],
}

export function etiquetaEstado(estado: EstadoParte): string {
  return ETIQUETAS[estado]
}

export function esEditable(estado: EstadoParte): boolean {
  return estado === 'BORRADOR' || estado === 'RECHAZADO'
}

export function puedeTransicionar(desde: EstadoParte, hacia: EstadoParte): boolean {
  return TRANSICIONES[desde].includes(hacia)
}

export type ImputacionEntrada = {
  fecha: FechaIso
  tareaId: string
  minutos: number
}

export type ErrorValidacion = { fecha: FechaIso; tareaId: string; mensaje: string }

export type ValidacionParte =
  | { ok: true; totalMinutos: number; minutosPorDia: Record<FechaIso, number> }
  | { ok: false; errores: ErrorValidacion[] }

/**
 * Valida el contenido de un parte completo. Las reglas viven aquí, no en la UI
 * ni en el handler, y se vuelven a aplicar en el servidor al guardar.
 */
export function validarParte(
  weekStart: FechaIso,
  imputaciones: readonly ImputacionEntrada[],
  opciones: { permitirVacio?: boolean } = {},
): ValidacionParte {
  const errores: ErrorValidacion[] = []
  const minutosPorDia: Record<FechaIso, number> = {}
  const duplicadas = new Set<string>()

  for (const imputacion of imputaciones) {
    const dia = diasEntre(weekStart, imputacion.fecha)
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      errores.push({ ...imputacion, mensaje: 'La fecha no pertenece a esta semana' })
      continue
    }

    if (!Number.isInteger(imputacion.minutos) || imputacion.minutos <= 0) {
      errores.push({ ...imputacion, mensaje: 'Los minutos deben ser mayores que cero' })
      continue
    }

    if (imputacion.minutos > MINUTOS_POR_DIA) {
      errores.push({ ...imputacion, mensaje: 'No se pueden imputar más de 24 horas en un día' })
      continue
    }

    const clave = `${imputacion.fecha}|${imputacion.tareaId}`
    if (duplicadas.has(clave)) {
      errores.push({ ...imputacion, mensaje: 'Hay una fila duplicada para esta tarea y fecha' })
      continue
    }
    duplicadas.add(clave)

    minutosPorDia[imputacion.fecha] = (minutosPorDia[imputacion.fecha] ?? 0) + imputacion.minutos
  }

  for (const [fecha, minutos] of Object.entries(minutosPorDia)) {
    if (minutos > MINUTOS_POR_DIA) {
      errores.push({
        fecha,
        tareaId: '',
        mensaje: 'La suma del día supera las 24 horas',
      })
    }
  }

  if (errores.length > 0) return { ok: false, errores }

  const totalMinutos = sumarMinutos(imputaciones.map((i) => i.minutos))
  if (!opciones.permitirVacio && totalMinutos === 0) {
    return {
      ok: false,
      errores: [{ fecha: weekStart, tareaId: '', mensaje: 'El parte no tiene horas que enviar' }],
    }
  }

  return { ok: true, totalMinutos, minutosPorDia }
}

export function avisosDeParte(weekStart: FechaIso, totalMinutos: number): string[] {
  const avisos: string[] = []
  if (totalMinutos > 48 * 60) avisos.push('La semana supera las 48 horas')
  if (totalMinutos === 0) avisos.push('El parte no tiene horas')
  const semana = semanaIsoDe(weekStart)
  if (semana.weekStart !== weekStart) avisos.push('La fecha de la semana no es un lunes')
  return avisos
}

export function semanaSiguiente(
  isoYear: number,
  isoWeek: number,
): { isoYear: number; isoWeek: number } {
  if (isoWeek >= 52) {
    const candidata = semanaIsoDe(sumarDias(diasDeSemanaSeguro(isoYear, isoWeek), 7))
    return { isoYear: candidata.isoYear, isoWeek: candidata.isoWeek }
  }
  return { isoYear, isoWeek: isoWeek + 1 }
}

export function semanaAnterior(
  isoYear: number,
  isoWeek: number,
): { isoYear: number; isoWeek: number } {
  if (isoWeek <= 1) {
    const candidata = semanaIsoDe(sumarDias(diasDeSemanaSeguro(isoYear, isoWeek), -7))
    return { isoYear: candidata.isoYear, isoWeek: candidata.isoWeek }
  }
  return { isoYear, isoWeek: isoWeek - 1 }
}

function diasDeSemanaSeguro(isoYear: number, isoWeek: number): FechaIso {
  // Lunes de la semana indicada, sin depender de validaciones adicionales.
  const cuatroDeEnero = new Date(Date.UTC(isoYear, 0, 4))
  const dia = cuatroDeEnero.getUTCDay() === 0 ? 7 : cuatroDeEnero.getUTCDay()
  const lunesSemanaUno = new Date(cuatroDeEnero.getTime() - (dia - 1) * 86_400_000)
  return new Date(lunesSemanaUno.getTime() + (isoWeek - 1) * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10)
}
