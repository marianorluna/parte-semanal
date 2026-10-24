/**
 * Firma HMAC de webhooks y política de reintentos. El timestamp va fuera de la
 * firma calculada y se incluye en el mensaje firmado para evitar reenvíos.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const MAX_INTENTOS_ENTREGA = 5
export const TOLERANCIA_FIRMA_SEGUNDOS = 300

/** Retrasos en minutos para los intentos 1..5. El último se repite. */
const RETRASOS_MINUTOS = [1, 5, 15, 60, 240] as const

export function firmarWebhook(secreto: string, timestamp: number, cuerpo: string): string {
  return createHmac('sha256', secreto).update(`${timestamp}.${cuerpo}`).digest('hex')
}

export function firmaValida(
  secreto: string,
  timestamp: number,
  cuerpo: string,
  firmaRecibida: string,
  ahora: number,
  toleranciaSegundos = TOLERANCIA_FIRMA_SEGUNDOS,
): boolean {
  if (!Number.isFinite(timestamp)) return false
  if (Math.abs(ahora - timestamp) > toleranciaSegundos) return false

  const esperada = Buffer.from(firmarWebhook(secreto, timestamp, cuerpo), 'utf8')
  const recibida = Buffer.from(firmaRecibida, 'utf8')
  if (esperada.length !== recibida.length) return false
  return timingSafeEqual(esperada, recibida)
}

export function proximoIntento(intentos: number, ahora: Date): Date {  const indice = Math.min(Math.max(intentos - 1, 0), RETRASOS_MINUTOS.length - 1)
  const minutos = RETRASOS_MINUTOS[indice] ?? RETRASOS_MINUTOS[0]
  return new Date(ahora.getTime() + minutos * 60_000)
}

export function entregaAgotada(intentos: number): boolean {
  return intentos >= MAX_INTENTOS_ENTREGA
}

/** Comparación en tiempo constante para hashes de clave de API. */
export function compararSeguro(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}
