import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  APP_URL: z.string().url('APP_URL debe ser una URL válida').default('http://localhost:3000'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET debe tener al menos 32 caracteres. Genera uno con: openssl rand -base64 32'),
  TZ: z.string().default('Europe/Madrid'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_PASSWORD: z.string().min(8).default('Demo1234!'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

/**
 * Valida el entorno en el momento de uso, no al importar el módulo:
 * `next build` no debe fallar por variables que solo hacen falta en runtime.
 */
const entornoDeCompilacion: Env = {
  DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/build',
  APP_URL: 'http://localhost:3000',
  AUTH_SECRET: 'compilacion-sin-secreto-real-0000000000',
  TZ: 'Europe/Madrid',
  NODE_ENV: 'production',
  DEMO_PASSWORD: 'Demo1234!',
}

export function env(): Env {
  if (cached) return cached

  // Durante `next build` no hay base de datos ni secretos: las páginas que las
  // usan son dinámicas y no se prerenderizan. La validación real ocurre al arrancar.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    cached = entornoDeCompilacion
    return cached
  }

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Configuración de entorno inválida. ${detalle}`)
  }

  cached = parsed.data
  return cached
}

export function esProduccion(): boolean {
  return process.env.NODE_ENV === 'production'
}
