/**
 * Credenciales de la API. El secreto se muestra una sola vez y en base de
 * datos solo queda un HMAC con `AUTH_SECRET` como pimienta: una copia de la
 * base de datos no permite reconstruir las claves.
 */

import { createHmac, randomBytes } from 'node:crypto'
import { env } from '@/config/env'
import { formatearClave } from '../domain/api'

export function generarCredenciales(): { prefijo: string; secreto: string; clave: string } {
  const prefijo = randomBytes(6).toString('hex')
  const secreto = randomBytes(20).toString('hex')
  return { prefijo, secreto, clave: formatearClave(prefijo, secreto) }
}

export function hashClave(clave: string): string {
  return createHmac('sha256', env().AUTH_SECRET).update(clave).digest('hex')
}

export function generarSecretoWebhook(): string {
  return randomBytes(32).toString('hex')
}
