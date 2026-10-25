import { z } from 'zod'

/** Compose puede inyectar variables vacías: se tratan como no definidas. */
const vacioComoUndefined = (valor: unknown): unknown =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  APP_URL: z.string().url('APP_URL debe ser una URL válida').default('http://localhost:3000'),
  AUTH_SECRET: z
    .string()
    .min(32, 'AUTH_SECRET debe tener al menos 32 caracteres. Genera uno con: openssl rand -base64 32'),
  TZ: z.string().default('Europe/Madrid'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_PASSWORD: z.string().min(8).default('Demo1234!'),
  // Interruptor provisional para enseñar los accesos rápidos del login durante
  // las pruebas. Debe quedar apagado fuera de ese periodo.
  ACCESO_RAPIDO_DEMO: z
    .string()
    .optional()
    .transform((valor) => valor === 'true' || valor === '1'),
  // Opcional a propósito: sin secreto el cron de avisos queda deshabilitado
  // (503) y el resto de la app funciona igual.
  CRON_SECRET: z.preprocess(
    vacioComoUndefined,
    z.string().min(16, 'CRON_SECRET debe tener al menos 16 caracteres').optional(),
  ),
  // Opcionales a propósito: sin SMTP_URL los avisos por email quedan en estado
  // SIN_PROVEEDOR y el resto del producto funciona igual.
  SMTP_URL: z.preprocess(
    vacioComoUndefined,
    z.string().url('SMTP_URL debe ser una URL de conexión SMTP válida').optional(),
  ),
  SMTP_FROM: z.preprocess(
    vacioComoUndefined,
    z.string().min(3, 'SMTP_FROM debe indicar el remitente').optional(),
  ),
  // Asistente de IA. Todo opcional a propósito: sin clave las funciones quedan
  // como no configuradas (503) y el resto de la app funciona igual. El
  // proveedor habla el protocolo compatible con OpenAI, así que cambiar de
  // DeepSeek a OpenAI u OpenRouter es cambiar `IA_BASE_URL` e `IA_MODELO`.
  IA_API_KEY: z.preprocess(
    vacioComoUndefined,
    z.string().min(10, 'IA_API_KEY debe tener al menos 10 caracteres').optional(),
  ),
  IA_BASE_URL: z.preprocess(
    vacioComoUndefined,
    z.string().url('IA_BASE_URL debe ser una URL válida').default('https://api.deepseek.com'),
  ),
  IA_MODELO: z.preprocess(vacioComoUndefined, z.string().trim().min(1).optional()),
  IA_TIMEOUT_MS: z.preprocess(
    vacioComoUndefined,
    z.coerce.number().int().min(1_000).max(60_000).default(20_000),
  ),
  IA_MAX_TOKENS: z.preprocess(
    vacioComoUndefined,
    z.coerce.number().int().min(100).max(2_000).default(700),
  ),
  // Reduce los nombres propios a iniciales antes de enviarlos al proveedor.
  IA_PSEUDONIMIZAR: z.preprocess(
    vacioComoUndefined,
    z
      .string()
      .optional()
      .transform((valor) => valor == null || valor === 'true' || valor === '1'),
  ),
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
  ACCESO_RAPIDO_DEMO: false,
  CRON_SECRET: undefined,
  SMTP_URL: undefined,
  SMTP_FROM: undefined,
  IA_API_KEY: undefined,
  IA_BASE_URL: 'https://api.deepseek.com',
  IA_MODELO: undefined,
  IA_TIMEOUT_MS: 20_000,
  IA_MAX_TOKENS: 700,
  IA_PSEUDONIMIZAR: true,
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
