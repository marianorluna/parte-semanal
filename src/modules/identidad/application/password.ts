import { hash, verify } from '@node-rs/argon2'

/**
 * Parámetros de argon2id alineados con la recomendación OWASP:
 * 19 MiB de memoria, 2 iteraciones y 1 hilo.
 */
const OPCIONES = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPCIONES)
}

export async function verificarPassword(hashGuardado: string, password: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, password)
  } catch {
    return false
  }
}
