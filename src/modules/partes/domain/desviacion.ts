/**
 * Desviación entre las horas imputadas y la jornada teórica de la semana.
 *
 * Regla de producto (ADR-020): la desviación no bloquea el envío. Una igualdad
 * exacta con la jornada teórica es frágil -la semana en curso, las altas y
 * bajas a mitad de semana, los permisos parciales o los picos de obra producen
 * diferencias legítimas- y bloquear empujaría a rellenar horas en cualquier
 * tarea para poder enviar. En su lugar, una semana ya terminada que no cuadra
 * exige una declaración de motivo.
 *
 * Sin I/O y sin reloj: recibe la capacidad ya resuelta y si la semana cerró.
 */

import { formatearHorasReloj } from './horas'

export const MINIMO_CARACTERES_MOTIVO = 10
export const MAXIMO_CARACTERES_MOTIVO = 500

export const TIPOS_DESVIACION = ['CUADRA', 'EXCESO', 'DEFECTO', 'SIN_CAPACIDAD'] as const

export type TipoDesviacion = (typeof TIPOS_DESVIACION)[number]

export const ETIQUETAS_DESVIACION: Record<TipoDesviacion, string> = {
  CUADRA: 'En jornada',
  EXCESO: 'Por encima de la jornada',
  DEFECTO: 'Por debajo de la jornada',
  SIN_CAPACIDAD: 'Sin jornada teórica',
}

export type DesviacionJornada = {
  capacidadMin: number | null
  /** Imputado menos capacidad. Positivo = exceso, negativo = defecto. */
  diferenciaMin: number | null
  tipo: TipoDesviacion
}

/**
 * Compara el total del parte con la capacidad de la semana. Sin capacidad
 * configurada no hay juicio posible: ni desviación ni motivo exigible.
 */
export function evaluarDesviacion(totalMinutos: number, capacidadMin: number | null): DesviacionJornada {
  if (capacidadMin === null) {
    return { capacidadMin: null, diferenciaMin: null, tipo: 'SIN_CAPACIDAD' }
  }

  const diferenciaMin = totalMinutos - capacidadMin
  if (diferenciaMin > 0) return { capacidadMin, diferenciaMin, tipo: 'EXCESO' }
  if (diferenciaMin < 0) return { capacidadMin, diferenciaMin, tipo: 'DEFECTO' }
  return { capacidadMin, diferenciaMin, tipo: 'CUADRA' }
}

export type OpcionesJustificacion = {
  /** La semana ya terminó: el total debería coincidir con la capacidad. */
  semanaCerrada: boolean
}

/**
 * Solo se exige motivo cuando la semana terminó, hay capacidad conocida y el
 * total no coincide. La semana en curso se envía con un simple aviso.
 */
export function requiereJustificacion(
  desviacion: DesviacionJornada,
  opciones: OpcionesJustificacion,
): boolean {
  if (!opciones.semanaCerrada) return false
  if (desviacion.tipo === 'SIN_CAPACIDAD' || desviacion.tipo === 'CUADRA') return false
  return true
}

/**
 * Valida el texto declarado. Devuelve el mensaje de error o `null` si es
 * válido, igual que el resto de validaciones de dominio.
 */
export function validarMotivoDesviacion(motivo: string): string | null {
  const texto = motivo.trim()
  if (texto.length === 0) return 'Explica por qué la semana no coincide con tu jornada teórica'
  if (texto.length < MINIMO_CARACTERES_MOTIVO) {
    return `Escribe al menos ${MINIMO_CARACTERES_MOTIVO} caracteres`
  }
  if (texto.length > MAXIMO_CARACTERES_MOTIVO) {
    return `El motivo no puede superar ${MAXIMO_CARACTERES_MOTIVO} caracteres`
  }
  return null
}

/** Descripción legible de la desviación, para avisos y detalles del parte. */
export function describirDesviacion(desviacion: DesviacionJornada): string {
  if (desviacion.tipo === 'SIN_CAPACIDAD') return 'Sin jornada teórica configurada'
  if (desviacion.tipo === 'CUADRA') return 'Coincide con la jornada teórica'
  const signo = (desviacion.diferenciaMin ?? 0) > 0 ? '+' : '-'
  return `${signo}${formatearHorasReloj(Math.abs(desviacion.diferenciaMin ?? 0))} respecto a la jornada teórica`
}
