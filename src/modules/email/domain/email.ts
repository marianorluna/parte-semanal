/**
 * Reglas puras del correo: validación de direcciones, claves de idempotencia y
 * preferencias. Sin I/O: el envío real vive en infraestructura.
 */

import type { TipoNotificacion } from '@/db/schema'

/** Validación deliberadamente conservadora: no pretende cubrir RFC 5322. */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function emailValido(direccion: string): boolean {
  return PATRON_EMAIL.test(direccion.trim())
}

/**
 * Clave estable por evento, destinatario y periodo. Reutiliza la del aviso
 * in-app para que un cron repetido no vuelva a encolar el mismo correo.
 */
export function claveEmail(tipo: TipoNotificacion, claveAviso: string): string {
  return `${tipo.toLowerCase()}:${claveAviso}`
}

export type Preferencia = { email: boolean; inApp: boolean }

/** Sin fila de preferencia se envía: el silencio nunca es un opt-out implícito. */
export function debeEnviarEmail(preferencia: Preferencia | undefined): boolean {
  return preferencia ? preferencia.email : true
}

export function debeMostrarInApp(preferencia: Preferencia | undefined): boolean {
  return preferencia ? preferencia.inApp : true
}

export type ResultadoIntento =
  | { tipo: 'ENVIADO' }
  | { tipo: 'SIN_PROVEEDOR' }
  | { tipo: 'FALLIDO'; mensaje: string }

/**
 * Un proveedor no configurado no es un fallo reintentable: reintentar no lo
 * arregla. Un error real sí, hasta agotar los intentos de la cola.
 */
export function interpretarFallo(mensaje: string): ResultadoIntento {
  const normalizado = mensaje.toLowerCase()
  if (
    normalizado.includes('smtp_url') ||
    normalizado.includes('no configurado') ||
    normalizado.includes('sin proveedor')
  ) {
    return { tipo: 'SIN_PROVEEDOR' }
  }
  return { tipo: 'FALLIDO', mensaje }
}
